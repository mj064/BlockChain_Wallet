import re
from datetime import datetime
from decimal import Decimal, ROUND_DOWN

from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator

from app.production.types import (
    Asset,
    PaymentIntentStatus,
    RiskDecision,
    SupportedChain,
)


ADDRESS_RE = re.compile(r"^0[xX][a-fA-F0-9]{40}$")
CENT = Decimal("0.01")


def normalize_wallet_address(value: str) -> str:
    if not ADDRESS_RE.match(value or ""):
        raise ValueError("Expected a 0x-prefixed EVM address")
    return value.lower()


def normalize_amount(value: Decimal) -> Decimal:
    if value <= 0:
        raise ValueError("Amount must be greater than zero")
    if value > Decimal("10000"):
        raise ValueError("Amount exceeds private beta limit")
    return value.quantize(CENT, rounding=ROUND_DOWN)


class PaymentIntentCreate(BaseModel):
    recipient: str
    amount: Decimal
    chain_preference: SupportedChain = Field(alias="chainPreference")
    note: str | None = Field(default=None, max_length=160)

    @field_validator("recipient")
    @classmethod
    def recipient_must_be_wallet(cls, value: str) -> str:
        return normalize_wallet_address(value)

    @field_validator("amount")
    @classmethod
    def amount_must_be_positive(cls, value: Decimal) -> Decimal:
        return normalize_amount(value)


class PaymentIntentQuoteRequest(BaseModel):
    recipient: str
    amount: Decimal
    chain_preference: SupportedChain = Field(alias="chainPreference")

    @field_validator("recipient")
    @classmethod
    def recipient_must_be_wallet(cls, value: str) -> str:
        return normalize_wallet_address(value)

    @field_validator("amount")
    @classmethod
    def amount_must_be_positive(cls, value: Decimal) -> Decimal:
        return normalize_amount(value)


class PaymentIntentQuoteResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    recipient: str
    amount: Decimal
    asset: Asset
    chain: SupportedChain
    risk_decision: RiskDecision = Field(alias="riskDecision")
    estimated_network_fee: Decimal = Field(alias="estimatedNetworkFee")
    estimated_settlement_amount: Decimal = Field(alias="estimatedSettlementAmount")
    policy_notice: str | None = Field(default=None, alias="policyNotice")
    daily_limit_usdc: Decimal = Field(alias="dailyLimitUsdc")
    daily_spent_usdc: Decimal = Field(alias="dailySpentUsdc")
    daily_available_usdc: Decimal = Field(alias="dailyAvailableUsdc")

    @field_serializer("amount", "estimated_network_fee", "estimated_settlement_amount", "daily_limit_usdc", "daily_spent_usdc", "daily_available_usdc")
    def serialize_money(self, value: Decimal) -> str:
        return f"{value.quantize(CENT):f}"


class PaymentIntentConfirmRequest(BaseModel):
    confirmations: int = Field(default=1, ge=1, le=256)


class PaymentIntentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str
    sender_wallet: str = Field(alias="senderWallet")
    recipient: str
    amount: Decimal
    asset: Asset
    chain: SupportedChain
    status: PaymentIntentStatus
    risk_decision: RiskDecision = Field(alias="riskDecision")
    note: str | None
    tx_hash: str | None = Field(alias="txHash")
    confirmations: int
    receipt_url: str | None = Field(alias="receiptUrl")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")

    @field_serializer("amount")
    def serialize_amount(self, value: Decimal) -> str:
        return f"{value.quantize(CENT):f}"


class ActivityEventResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    kind: str
    intent_id: str = Field(alias="intentId")
    chain: SupportedChain
    asset: Asset
    amount: Decimal
    status: PaymentIntentStatus | None = None
    tx_hash: str | None = Field(default=None, alias="txHash")
    receipt_url: str | None = Field(default=None, alias="receiptUrl")
    webhook_source: str | None = Field(default=None, alias="webhookSource")
    webhook_type: str | None = Field(default=None, alias="webhookType")
    occurred_at: datetime = Field(alias="occurredAt")

    @field_serializer("amount")
    def serialize_amount(self, value: Decimal) -> str:
        return f"{value.quantize(CENT):f}"


class ContactCreate(BaseModel):
    label: str = Field(min_length=1, max_length=80)
    wallet_address: str = Field(alias="walletAddress")

    @field_validator("wallet_address")
    @classmethod
    def wallet_address_must_be_valid(cls, value: str) -> str:
        return normalize_wallet_address(value)


class ContactResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str
    owner_wallet: str = Field(alias="ownerWallet")
    label: str
    wallet_address: str = Field(alias="walletAddress")


class ContactDeleteResponse(BaseModel):
    deleted: bool
    contact_id: str = Field(alias="contactId")


class PortfolioBalance(BaseModel):
    chain: SupportedChain
    asset: Asset = Asset.USDC
    amount: Decimal
    contract_address: str = Field(alias="contractAddress")

    @field_serializer("amount")
    def serialize_amount(self, value: Decimal) -> str:
        return f"{value.quantize(CENT):f}"


class PortfolioResponse(BaseModel):
    wallet_address: str = Field(alias="walletAddress")
    balances: list[PortfolioBalance]


class WebhookEnvelope(BaseModel):
    event_id: str = Field(alias="eventId")
    type: str
    payload: dict


class WebhookAccepted(BaseModel):
    accepted: bool
    event_id: str = Field(alias="eventId")
