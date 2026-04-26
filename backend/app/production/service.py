import json
import hashlib
import time
from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.production.config import get_settings
from app.production.models import (
    Contact,
    Limit,
    PaymentIntent,
    Receipt,
    Transaction,
    User,
    WebhookEvent,
)
from app.production.schemas import (
    ActivityEventResponse,
    ContactCreate,
    PaymentIntentCreate,
    PaymentIntentQuoteRequest,
    PaymentIntentQuoteResponse,
    WebhookEnvelope,
)
from app.production.types import Asset, PaymentIntentStatus, RiskDecision, SupportedChain


USDC_CONTRACTS = {
    SupportedChain.base: "0x0000000000000000000000000000000000000000",
    SupportedChain.arbitrum: "0x0000000000000000000000000000000000000000",
    SupportedChain.polygon: "0x0000000000000000000000000000000000000000",
}

DEFAULT_DAILY_LIMIT_USDC = Decimal("500.00")
FEE_BASE_BY_CHAIN = {
    SupportedChain.base: Decimal("0.20"),
    SupportedChain.arbitrum: Decimal("0.16"),
    SupportedChain.polygon: Decimal("0.10"),
}
FEE_BPS_BY_CHAIN = {
    SupportedChain.base: Decimal("0.0015"),
    SupportedChain.arbitrum: Decimal("0.0014"),
    SupportedChain.polygon: Decimal("0.0012"),
}


class PolicyViolationError(ValueError):
    pass


def ensure_user(db: Session, wallet_address: str) -> User:
    user = db.get(User, wallet_address)
    if user is None:
        user = User(wallet_address=wallet_address)
        db.add(user)
    return user


def _start_of_utc_day(now: datetime | None = None) -> datetime:
    current = now or datetime.now(timezone.utc)
    return current.replace(hour=0, minute=0, second=0, microsecond=0)


def _daily_spend(db: Session, sender_wallet: str, chain: SupportedChain) -> Decimal:
    spent = Decimal("0")
    stmt = select(PaymentIntent).where(
        PaymentIntent.sender_wallet == sender_wallet,
        PaymentIntent.chain == chain.value,
        PaymentIntent.status.in_(
            [
                PaymentIntentStatus.submitted.value,
                PaymentIntentStatus.confirmed.value,
            ]
        ),
        PaymentIntent.created_at >= _start_of_utc_day(),
    )
    for intent in db.scalars(stmt):
        spent += Decimal(intent.amount)
    return spent


def _wallet_daily_limit(db: Session, wallet_address: str, chain: SupportedChain) -> Decimal:
    settings = get_settings()
    default_limit = Decimal(settings.beta_daily_limit_usdc)
    limit = db.scalar(
        select(Limit).where(
            Limit.wallet_address == wallet_address,
            Limit.chain == chain.value,
        )
    )
    if limit is not None:
        return Decimal(limit.daily_limit_usdc)

    new_limit = Limit(
        id=str(uuid4()),
        wallet_address=wallet_address,
        chain=chain.value,
        daily_limit_usdc=default_limit,
    )
    db.add(new_limit)
    db.flush()
    return default_limit


def _evaluate_risk(
    db: Session,
    sender_wallet: str,
    payload: PaymentIntentCreate,
) -> tuple[RiskDecision, str | None]:
    settings = get_settings()
    hard_block_threshold = Decimal(settings.beta_global_daily_limit_usdc)
    warn_threshold = Decimal(settings.beta_daily_limit_usdc)

    if payload.amount >= hard_block_threshold:
        return (
            RiskDecision.block,
            "Payment blocked: amount exceeds hard policy threshold.",
        )

    daily_limit = _wallet_daily_limit(db, sender_wallet, payload.chain_preference)
    spent_today = _daily_spend(db, sender_wallet, payload.chain_preference)
    if spent_today + payload.amount > daily_limit:
        return (
            RiskDecision.block,
            f"Payment blocked: daily limit exceeded ({daily_limit} USDC).",
        )

    if payload.amount >= warn_threshold:
        return RiskDecision.warn, None
    return RiskDecision.allow, None


def _build_tx_hash(seed: str) -> str:
    digest = hashlib.sha256(f"{seed}:{time.time_ns()}".encode()).hexdigest()
    return f"0x{digest}"


def _ensure_transaction_record(db: Session, intent: PaymentIntent) -> None:
    if not intent.tx_hash:
        return
    existing = db.scalar(
        select(Transaction).where(
            Transaction.payment_intent_id == intent.id,
            Transaction.tx_hash == intent.tx_hash,
        )
    )
    if existing is not None:
        existing.status = intent.status
        return
    db.add(
        Transaction(
            id=str(uuid4()),
            payment_intent_id=intent.id,
            chain=intent.chain,
            tx_hash=intent.tx_hash,
            status=intent.status,
        )
    )


def _ensure_receipt_record(db: Session, intent: PaymentIntent) -> None:
    if not intent.receipt_url:
        return
    existing = db.scalar(
        select(Receipt).where(
            Receipt.payment_intent_id == intent.id,
            Receipt.public_url == intent.receipt_url,
        )
    )
    if existing is not None:
        return
    db.add(
        Receipt(
            id=str(uuid4()),
            payment_intent_id=intent.id,
            public_url=intent.receipt_url,
        )
    )


def _extract_tx_hash_from_payload(payload: str) -> str | None:
    try:
        data = json.loads(payload)
    except (TypeError, ValueError):
        return None

    candidates = [
        data.get("hash") if isinstance(data, dict) else None,
        data.get("txHash") if isinstance(data, dict) else None,
    ]

    payload_obj = data.get("payload") if isinstance(data, dict) else None
    if isinstance(payload_obj, dict):
        candidates.extend([
            payload_obj.get("hash"),
            payload_obj.get("txHash"),
            payload_obj.get("transactionHash"),
        ])

    for candidate in candidates:
        if isinstance(candidate, str) and candidate:
            return candidate.lower()
    return None


def create_payment_intent(
    db: Session,
    sender_wallet: str,
    payload: PaymentIntentCreate,
    idempotency_key: str | None,
) -> tuple[PaymentIntent, bool]:
    ensure_user(db, sender_wallet)
    if idempotency_key:
        existing = db.scalar(
            select(PaymentIntent).where(
                PaymentIntent.sender_wallet == sender_wallet,
                PaymentIntent.idempotency_key == idempotency_key,
            )
        )
        if existing is not None:
            return existing, False

    risk_decision, reason = _evaluate_risk(db, sender_wallet, payload)
    if risk_decision is RiskDecision.block:
        raise PolicyViolationError(reason or "Payment blocked by policy")

    intent = PaymentIntent(
        id=str(uuid4()),
        sender_wallet=sender_wallet,
        recipient=payload.recipient,
        amount=payload.amount,
        asset=Asset.USDC.value,
        chain=payload.chain_preference.value,
        status=PaymentIntentStatus.draft.value,
        risk_decision=risk_decision.value,
        note=payload.note,
        idempotency_key=idempotency_key,
    )
    db.add(intent)
    db.commit()
    db.refresh(intent)
    return intent, True


def quote_payment_intent(
    db: Session,
    sender_wallet: str,
    payload: PaymentIntentQuoteRequest,
) -> PaymentIntentQuoteResponse:
    risk_decision, reason = _evaluate_risk(
        db,
        sender_wallet,
        PaymentIntentCreate(
            recipient=payload.recipient,
            amount=payload.amount,
            chainPreference=payload.chain_preference,
            note=None,
        ),
    )

    base_fee = FEE_BASE_BY_CHAIN[payload.chain_preference]
    variable_fee = payload.amount * FEE_BPS_BY_CHAIN[payload.chain_preference]
    estimated_network_fee = (base_fee + variable_fee).quantize(Decimal("0.01"))
    estimated_settlement_amount = max(
        Decimal("0.00"),
        (payload.amount - estimated_network_fee).quantize(Decimal("0.01")),
    )

    daily_limit = _wallet_daily_limit(db, sender_wallet, payload.chain_preference)
    daily_spent = _daily_spend(db, sender_wallet, payload.chain_preference)
    daily_available = max(Decimal("0.00"), (daily_limit - daily_spent).quantize(Decimal("0.01")))

    return PaymentIntentQuoteResponse(
        recipient=payload.recipient,
        amount=payload.amount,
        asset=Asset.USDC,
        chain=payload.chain_preference,
        riskDecision=risk_decision,
        estimatedNetworkFee=estimated_network_fee,
        estimatedSettlementAmount=estimated_settlement_amount,
        policyNotice=reason,
        dailyLimitUsdc=daily_limit,
        dailySpentUsdc=daily_spent,
        dailyAvailableUsdc=daily_available,
    )


def get_payment_intent(
    db: Session,
    sender_wallet: str,
    intent_id: str,
) -> PaymentIntent | None:
    return db.scalar(
        select(PaymentIntent).where(
            PaymentIntent.id == intent_id,
            PaymentIntent.sender_wallet == sender_wallet,
        )
    )


def list_payment_intents(
    db: Session,
    sender_wallet: str,
    *,
    limit: int = 25,
    status: PaymentIntentStatus | None = None,
    chain: SupportedChain | None = None,
) -> list[PaymentIntent]:
    stmt = select(PaymentIntent).where(PaymentIntent.sender_wallet == sender_wallet)
    if status is not None:
        stmt = stmt.where(PaymentIntent.status == status.value)
    if chain is not None:
        stmt = stmt.where(PaymentIntent.chain == chain.value)
    stmt = stmt.order_by(PaymentIntent.created_at.desc()).limit(limit)
    return list(db.scalars(stmt).all())


def submit_payment_intent(
    db: Session,
    sender_wallet: str,
    intent_id: str,
) -> PaymentIntent | None:
    intent = get_payment_intent(db, sender_wallet, intent_id)
    if intent is None:
        return None

    if intent.status == PaymentIntentStatus.confirmed.value:
        return intent
    if intent.status == PaymentIntentStatus.submitted.value:
        return intent
    if intent.status in {
        PaymentIntentStatus.failed.value,
        PaymentIntentStatus.expired.value,
    }:
        raise PolicyViolationError("Cannot submit a finalized payment intent")

    intent.status = PaymentIntentStatus.submitted.value
    intent.tx_hash = intent.tx_hash or _build_tx_hash(intent.id)
    intent.confirmations = max(0, int(intent.confirmations or 0))
    _ensure_transaction_record(db, intent)
    db.commit()
    db.refresh(intent)
    return intent


def confirm_payment_intent(
    db: Session,
    sender_wallet: str,
    intent_id: str,
    *,
    confirmations: int = 1,
) -> PaymentIntent | None:
    intent = get_payment_intent(db, sender_wallet, intent_id)
    if intent is None:
        return None

    if intent.status in {
        PaymentIntentStatus.failed.value,
        PaymentIntentStatus.expired.value,
    }:
        raise PolicyViolationError("Cannot confirm a failed or expired payment intent")

    intent.tx_hash = intent.tx_hash or _build_tx_hash(intent.id)
    intent.confirmations = max(0, int(intent.confirmations or 0)) + confirmations
    if intent.confirmations > 0:
        intent.status = PaymentIntentStatus.confirmed.value
        if not intent.receipt_url:
            intent.receipt_url = f"https://receipts.blockchain-wallet.local/{intent.id}"
    else:
        intent.status = PaymentIntentStatus.submitted.value

    _ensure_transaction_record(db, intent)
    _ensure_receipt_record(db, intent)
    db.commit()
    db.refresh(intent)
    return intent


def list_activity_events(
    db: Session,
    sender_wallet: str,
    *,
    limit: int = 50,
) -> list[ActivityEventResponse]:
    intents = list_payment_intents(db, sender_wallet, limit=max(1, min(100, limit * 2)))
    if not intents:
        return []

    intents_by_id = {intent.id: intent for intent in intents}
    intent_ids = list(intents_by_id.keys())

    transactions = list(
        db.scalars(
            select(Transaction)
            .where(Transaction.payment_intent_id.in_(intent_ids))
            .order_by(Transaction.created_at.desc())
        ).all()
    )
    receipts = list(
        db.scalars(
            select(Receipt)
            .where(Receipt.payment_intent_id.in_(intent_ids))
            .order_by(Receipt.created_at.desc())
        ).all()
    )
    webhook_events = list(
        db.scalars(
            select(WebhookEvent)
            .order_by(WebhookEvent.created_at.desc())
            .limit(max(10, limit * 4))
        ).all()
    )

    events: list[ActivityEventResponse] = []
    for intent in intents:
        events.append(
            ActivityEventResponse(
                id=f"intent:{intent.id}:created",
                kind="intent_created",
                intentId=intent.id,
                chain=intent.chain,
                asset=intent.asset,
                amount=intent.amount,
                status=intent.status,
                occurredAt=intent.created_at,
            )
        )

    for tx in transactions:
        intent = intents_by_id.get(tx.payment_intent_id)
        if intent is None:
            continue
        events.append(
            ActivityEventResponse(
                id=f"tx:{tx.id}",
                kind="tx_submitted",
                intentId=intent.id,
                chain=intent.chain,
                asset=intent.asset,
                amount=intent.amount,
                status=tx.status,
                txHash=tx.tx_hash,
                occurredAt=tx.created_at,
            )
        )

    for receipt in receipts:
        intent = intents_by_id.get(receipt.payment_intent_id)
        if intent is None:
            continue
        events.append(
            ActivityEventResponse(
                id=f"receipt:{receipt.id}",
                kind="receipt_issued",
                intentId=intent.id,
                chain=intent.chain,
                asset=intent.asset,
                amount=intent.amount,
                status=intent.status,
                txHash=intent.tx_hash,
                receiptUrl=receipt.public_url,
                occurredAt=receipt.created_at,
            )
        )

    tx_hash_to_intent: dict[str, PaymentIntent] = {}
    for intent in intents:
        if intent.tx_hash:
            tx_hash_to_intent[intent.tx_hash.lower()] = intent

    for webhook_event in webhook_events:
        extracted_hash = _extract_tx_hash_from_payload(webhook_event.payload)
        if not extracted_hash:
            continue

        intent = tx_hash_to_intent.get(extracted_hash)
        if intent is None:
            continue

        events.append(
            ActivityEventResponse(
                id=f"webhook:{webhook_event.id}",
                kind="webhook_received",
                intentId=intent.id,
                chain=intent.chain,
                asset=intent.asset,
                amount=intent.amount,
                status=intent.status,
                txHash=intent.tx_hash,
                webhookSource=webhook_event.source,
                webhookType=webhook_event.event_type,
                occurredAt=webhook_event.created_at,
            )
        )

    events.sort(key=lambda item: item.occurred_at, reverse=True)
    return events[:limit]


def create_contact(
    db: Session,
    owner_wallet: str,
    payload: ContactCreate,
) -> Contact:
    ensure_user(db, owner_wallet)
    existing = db.scalar(
        select(Contact).where(
            Contact.owner_wallet == owner_wallet,
            Contact.wallet_address == payload.wallet_address,
        )
    )
    if existing is not None:
        existing.label = payload.label
        db.commit()
        db.refresh(existing)
        return existing

    contact = Contact(
        id=str(uuid4()),
        owner_wallet=owner_wallet,
        label=payload.label,
        wallet_address=payload.wallet_address,
    )
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact


def list_contacts(db: Session, owner_wallet: str) -> list[Contact]:
    stmt = (
        select(Contact)
        .where(Contact.owner_wallet == owner_wallet)
        .order_by(Contact.updated_at.desc())
    )
    return list(db.scalars(stmt).all())


def delete_contact(db: Session, owner_wallet: str, contact_id: str) -> bool:
    contact = db.scalar(
        select(Contact).where(
            Contact.id == contact_id,
            Contact.owner_wallet == owner_wallet,
        )
    )
    if contact is None:
        return False

    db.delete(contact)
    db.commit()
    return True


def portfolio_balances(wallet_address: str) -> dict:
    return {
        "walletAddress": wallet_address,
        "balances": [
            {
                "chain": chain.value,
                "asset": Asset.USDC.value,
                "amount": Decimal("0.00"),
                "contractAddress": contract,
            }
            for chain, contract in USDC_CONTRACTS.items()
        ],
    }


def record_webhook(
    db: Session,
    source: str,
    envelope: WebhookEnvelope,
) -> WebhookEvent:
    existing = db.scalar(
        select(WebhookEvent).where(
            WebhookEvent.source == source,
            WebhookEvent.event_id == envelope.event_id,
        )
    )
    if existing is not None:
        return existing

    event = WebhookEvent(
        id=str(uuid4()),
        source=source,
        event_id=envelope.event_id,
        event_type=envelope.type,
        payload=json.dumps(envelope.payload, sort_keys=True),
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event
