from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response
from sqlalchemy.orm import Session

from app.production.database import get_db
from app.production.schemas import (
    ActivityEventResponse,
    ContactCreate,
    ContactDeleteResponse,
    ContactResponse,
    PaymentIntentConfirmRequest,
    PaymentIntentCreate,
    PaymentIntentQuoteRequest,
    PaymentIntentQuoteResponse,
    PaymentIntentResponse,
    PortfolioResponse,
    WebhookAccepted,
    WebhookEnvelope,
)
from app.production.security import require_wallet_address
from app.production.service import (
    create_contact,
    create_payment_intent,
    delete_contact,
    confirm_payment_intent,
    get_payment_intent,
    list_contacts,
    list_activity_events,
    list_payment_intents,
    portfolio_balances,
    PolicyViolationError,
    quote_payment_intent,
    record_webhook,
    submit_payment_intent,
)
from app.production.types import PaymentIntentStatus, SupportedChain


router = APIRouter(prefix="/api/v1", tags=["production-wallet"])


@router.post(
    "/payment-intents/quote",
    response_model=PaymentIntentQuoteResponse,
)
def quote_payment_intent_route(
    payload: PaymentIntentQuoteRequest,
    wallet_address: Annotated[str, Depends(require_wallet_address)],
    db: Annotated[Session, Depends(get_db)],
):
    return quote_payment_intent(db, wallet_address, payload)


@router.post(
    "/payment-intents",
    response_model=PaymentIntentResponse,
    status_code=201,
)
def post_payment_intent(
    payload: PaymentIntentCreate,
    response: Response,
    wallet_address: Annotated[str, Depends(require_wallet_address)],
    db: Annotated[Session, Depends(get_db)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
):
    try:
        intent, created = create_payment_intent(
            db=db,
            sender_wallet=wallet_address,
            payload=payload,
            idempotency_key=idempotency_key,
        )
    except PolicyViolationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    response.status_code = 201 if created else 200
    return intent


@router.get("/payment-intents", response_model=list[PaymentIntentResponse])
def list_payment_intents_route(
    wallet_address: Annotated[str, Depends(require_wallet_address)],
    db: Annotated[Session, Depends(get_db)],
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    status: Annotated[PaymentIntentStatus | None, Query()] = None,
    chain: Annotated[SupportedChain | None, Query()] = None,
):
    return list_payment_intents(
        db,
        wallet_address,
        limit=limit,
        status=status,
        chain=chain,
    )


@router.get("/activity", response_model=list[ActivityEventResponse])
def list_activity_route(
    wallet_address: Annotated[str, Depends(require_wallet_address)],
    db: Annotated[Session, Depends(get_db)],
    limit: Annotated[int, Query(ge=1, le=100)] = 30,
):
    return list_activity_events(db, wallet_address, limit=limit)


@router.get("/payment-intents/{intent_id}", response_model=PaymentIntentResponse)
def get_payment_intent_route(
    intent_id: str,
    wallet_address: Annotated[str, Depends(require_wallet_address)],
    db: Annotated[Session, Depends(get_db)],
):
    intent = get_payment_intent(db, wallet_address, intent_id)
    if intent is None:
        raise HTTPException(status_code=404, detail="Payment intent not found")
    return intent


@router.post(
    "/payment-intents/{intent_id}/submit",
    response_model=PaymentIntentResponse,
)
def submit_payment_intent_route(
    intent_id: str,
    wallet_address: Annotated[str, Depends(require_wallet_address)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        intent = submit_payment_intent(db, wallet_address, intent_id)
    except PolicyViolationError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    if intent is None:
        raise HTTPException(status_code=404, detail="Payment intent not found")
    return intent


@router.post(
    "/payment-intents/{intent_id}/confirm",
    response_model=PaymentIntentResponse,
)
def confirm_payment_intent_route(
    intent_id: str,
    body: PaymentIntentConfirmRequest,
    wallet_address: Annotated[str, Depends(require_wallet_address)],
    db: Annotated[Session, Depends(get_db)],
):
    try:
        intent = confirm_payment_intent(
            db,
            wallet_address,
            intent_id,
            confirmations=body.confirmations,
        )
    except PolicyViolationError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    if intent is None:
        raise HTTPException(status_code=404, detail="Payment intent not found")
    return intent


@router.post("/contacts", response_model=ContactResponse, status_code=201)
def post_contact(
    payload: ContactCreate,
    wallet_address: Annotated[str, Depends(require_wallet_address)],
    db: Annotated[Session, Depends(get_db)],
):
    return create_contact(db, wallet_address, payload)


@router.get("/contacts", response_model=list[ContactResponse])
def get_contacts(
    wallet_address: Annotated[str, Depends(require_wallet_address)],
    db: Annotated[Session, Depends(get_db)],
):
    return list_contacts(db, wallet_address)


@router.delete("/contacts/{contact_id}", response_model=ContactDeleteResponse)
def remove_contact(
    contact_id: str,
    wallet_address: Annotated[str, Depends(require_wallet_address)],
    db: Annotated[Session, Depends(get_db)],
):
    deleted = delete_contact(db, wallet_address, contact_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Contact not found")
    return {"deleted": True, "contactId": contact_id}


@router.get("/portfolio", response_model=PortfolioResponse)
def get_portfolio(wallet_address: Annotated[str, Depends(require_wallet_address)]):
    return portfolio_balances(wallet_address)


@router.post("/webhooks/alchemy", response_model=WebhookAccepted, status_code=202)
def post_alchemy_webhook(
    payload: WebhookEnvelope,
    db: Annotated[Session, Depends(get_db)],
):
    event = record_webhook(db, "alchemy", payload)
    return {"accepted": True, "eventId": event.event_id}


@router.post("/webhooks/circle", response_model=WebhookAccepted, status_code=202)
def post_circle_webhook(
    payload: WebhookEnvelope,
    db: Annotated[Session, Depends(get_db)],
):
    event = record_webhook(db, "circle", payload)
    return {"accepted": True, "eventId": event.event_id}
