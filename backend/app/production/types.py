from enum import Enum


class SupportedChain(str, Enum):
    base = "base"
    arbitrum = "arbitrum"
    polygon = "polygon"


class Asset(str, Enum):
    USDC = "USDC"


class PaymentIntentStatus(str, Enum):
    draft = "draft"
    awaiting_signature = "awaiting_signature"
    submitted = "submitted"
    confirmed = "confirmed"
    failed = "failed"
    expired = "expired"


class RiskDecision(str, Enum):
    allow = "allow"
    warn = "warn"
    block = "block"
