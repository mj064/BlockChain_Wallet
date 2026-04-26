from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.production.database import Base
from app.production.types import (
    Asset,
    PaymentIntentStatus,
    RiskDecision,
    SupportedChain,
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "production_users"

    wallet_address: Mapped[str] = mapped_column(String(42), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class Contact(Base):
    __tablename__ = "production_contacts"
    __table_args__ = (
        UniqueConstraint("owner_wallet", "wallet_address", name="uq_contact_owner_wallet"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    owner_wallet: Mapped[str] = mapped_column(String(42), index=True)
    label: Mapped[str] = mapped_column(String(80))
    wallet_address: Mapped[str] = mapped_column(String(42))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
    )


class PaymentIntent(Base):
    __tablename__ = "production_payment_intents"
    __table_args__ = (
        UniqueConstraint(
            "sender_wallet",
            "idempotency_key",
            name="uq_payment_intent_sender_idempotency",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    sender_wallet: Mapped[str] = mapped_column(String(42), index=True)
    recipient: Mapped[str] = mapped_column(String(42), index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(20, 6))
    asset: Mapped[str] = mapped_column(String(12), default=Asset.USDC.value)
    chain: Mapped[str] = mapped_column(String(24), default=SupportedChain.base.value)
    status: Mapped[str] = mapped_column(
        String(32),
        default=PaymentIntentStatus.draft.value,
        index=True,
    )
    risk_decision: Mapped[str] = mapped_column(
        String(16),
        default=RiskDecision.allow.value,
    )
    note: Mapped[str | None] = mapped_column(String(160), nullable=True)
    idempotency_key: Mapped[str | None] = mapped_column(String(120), nullable=True)
    tx_hash: Mapped[str | None] = mapped_column(String(80), nullable=True)
    confirmations: Mapped[int] = mapped_column(default=0)
    receipt_url: Mapped[str | None] = mapped_column(String(300), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
    )


class Transaction(Base):
    __tablename__ = "production_transactions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    payment_intent_id: Mapped[str] = mapped_column(
        ForeignKey("production_payment_intents.id"),
        index=True,
    )
    chain: Mapped[str] = mapped_column(String(24))
    tx_hash: Mapped[str] = mapped_column(String(80), index=True)
    status: Mapped[str] = mapped_column(String(32))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class Receipt(Base):
    __tablename__ = "production_receipts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    payment_intent_id: Mapped[str] = mapped_column(
        ForeignKey("production_payment_intents.id"),
        index=True,
    )
    public_url: Mapped[str] = mapped_column(String(300))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class Limit(Base):
    __tablename__ = "production_limits"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    wallet_address: Mapped[str] = mapped_column(String(42), index=True)
    chain: Mapped[str] = mapped_column(String(24))
    daily_limit_usdc: Mapped[Decimal] = mapped_column(Numeric(20, 6))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class WebhookEvent(Base):
    __tablename__ = "production_webhook_events"
    __table_args__ = (
        UniqueConstraint("source", "event_id", name="uq_webhook_source_event"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    source: Mapped[str] = mapped_column(String(32), index=True)
    event_id: Mapped[str] = mapped_column(String(120), index=True)
    event_type: Mapped[str] = mapped_column(String(120))
    payload: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
