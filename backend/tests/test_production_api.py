import sys
from decimal import Decimal
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import select


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

OWNER = "0x" + "a" * 40
RECIPIENT = "0x" + "b" * 40


def _client(tmp_path, monkeypatch):
    monkeypatch.setenv(
        "PRODUCTION_DATABASE_URL",
        f"sqlite:///{(tmp_path / 'wallet.db').as_posix()}",
    )
    monkeypatch.setenv("PRODUCTION_ALLOWED_ORIGINS", "http://localhost:5173")

    from app.main import app
    from app.production.config import get_settings
    from app.production.database import init_db, reset_engine_for_tests

    get_settings.cache_clear()
    reset_engine_for_tests()
    init_db()
    return TestClient(app)


def test_payment_intent_requires_authenticated_wallet(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)

    response = client.post(
        "/api/v1/payment-intents",
        json={
            "recipient": RECIPIENT,
            "amount": "12.50",
            "chainPreference": "base",
            "note": "Dinner",
        },
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Missing X-Wallet-Address header"


def test_payment_intent_rejects_invalid_amount(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)

    response = client.post(
        "/api/v1/payment-intents",
        headers={"X-Wallet-Address": OWNER},
        json={
            "recipient": RECIPIENT,
            "amount": "0",
            "chainPreference": "base",
            "note": "Zero amount",
        },
    )

    assert response.status_code == 422


def test_quote_payment_intent_returns_fee_and_net_amount(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)

    response = client.post(
        "/api/v1/payment-intents/quote",
        headers={"X-Wallet-Address": OWNER},
        json={
            "recipient": RECIPIENT,
            "amount": "50.00",
            "chainPreference": "base",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["recipient"] == RECIPIENT
    assert body["amount"] == "50.00"
    assert body["asset"] == "USDC"
    assert body["chain"] == "base"
    assert body["riskDecision"] == "allow"
    assert body["estimatedNetworkFee"] == "0.28"
    assert body["estimatedSettlementAmount"] == "49.72"
    assert body["policyNotice"] is None
    assert body["dailyLimitUsdc"] == "500.00"
    assert body["dailySpentUsdc"] == "0.00"
    assert body["dailyAvailableUsdc"] == "500.00"


def test_quote_payment_intent_marks_blocked_risk(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)

    response = client.post(
        "/api/v1/payment-intents/quote",
        headers={"X-Wallet-Address": OWNER},
        json={
            "recipient": RECIPIENT,
            "amount": "5000.00",
            "chainPreference": "base",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["riskDecision"] == "block"
    assert "blocked" in (body["policyNotice"] or "").lower()


def test_quote_reflects_accumulated_daily_spend(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)

    # Create and submit an intent to accumulate daily spend
    created = client.post(
        "/api/v1/payment-intents",
        headers={"X-Wallet-Address": OWNER},
        json={
            "recipient": RECIPIENT,
            "amount": "150.00",
            "chainPreference": "base",
        },
    )
    assert created.status_code == 201
    intent_id = created.json()["id"]

    # Submit it to count toward daily spend
    submitted = client.post(
        f"/api/v1/payment-intents/{intent_id}/submit",
        headers={"X-Wallet-Address": OWNER},
    )
    assert submitted.status_code == 200

    # Now quote another payment; should show updated daily spend
    quote = client.post(
        "/api/v1/payment-intents/quote",
        headers={"X-Wallet-Address": OWNER},
        json={
            "recipient": RECIPIENT,
            "amount": "50.00",
            "chainPreference": "base",
        },
    )

    assert quote.status_code == 200
    body = quote.json()
    assert body["dailySpentUsdc"] == "150.00"
    assert body["dailyAvailableUsdc"] == "350.00"


def test_create_payment_intent_stores_safe_fields(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)

    response = client.post(
        "/api/v1/payment-intents",
        headers={"X-Wallet-Address": OWNER, "Idempotency-Key": "pay-dinner"},
        json={
            "recipient": RECIPIENT.upper(),
            "amount": "12.50",
            "chainPreference": "base",
            "note": "Dinner",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["senderWallet"] == OWNER.lower()
    assert body["recipient"] == RECIPIENT.lower()
    assert body["amount"] == "12.50"
    assert body["asset"] == "USDC"
    assert body["chain"] == "base"
    assert body["status"] == "draft"
    assert body["riskDecision"] == "allow"
    assert "password" not in body
    assert "private" not in str(body).lower()


def test_idempotency_key_reuses_payment_intent(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    payload = {
        "recipient": RECIPIENT,
        "amount": "7.25",
        "chainPreference": "polygon",
        "note": "Coffee",
    }

    first = client.post(
        "/api/v1/payment-intents",
        headers={"X-Wallet-Address": OWNER, "Idempotency-Key": "same-payment"},
        json=payload,
    )
    second = client.post(
        "/api/v1/payment-intents",
        headers={"X-Wallet-Address": OWNER, "Idempotency-Key": "same-payment"},
        json=payload,
    )

    assert first.status_code == 201
    assert second.status_code == 200
    assert second.json()["id"] == first.json()["id"]


def test_payment_intent_warns_for_large_amount(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)

    response = client.post(
        "/api/v1/payment-intents",
        headers={"X-Wallet-Address": OWNER},
        json={
            "recipient": RECIPIENT,
            "amount": "500.00",
            "chainPreference": "base",
            "note": "Large transfer",
        },
    )

    assert response.status_code == 201
    assert response.json()["riskDecision"] == "warn"


def test_payment_intent_blocked_when_policy_threshold_exceeded(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)

    response = client.post(
        "/api/v1/payment-intents",
        headers={"X-Wallet-Address": OWNER},
        json={
            "recipient": RECIPIENT,
            "amount": "5000.00",
            "chainPreference": "base",
            "note": "Blocked transfer",
        },
    )

    assert response.status_code == 422
    assert "blocked" in response.json()["detail"].lower()


def test_payment_intent_lifecycle_submit_then_confirm(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    created = client.post(
        "/api/v1/payment-intents",
        headers={"X-Wallet-Address": OWNER},
        json={
            "recipient": RECIPIENT,
            "amount": "21.00",
            "chainPreference": "base",
            "note": "Lifecycle",
        },
    )
    assert created.status_code == 201
    intent_id = created.json()["id"]

    submitted = client.post(
        f"/api/v1/payment-intents/{intent_id}/submit",
        headers={"X-Wallet-Address": OWNER},
    )
    assert submitted.status_code == 200
    assert submitted.json()["status"] == "submitted"
    assert submitted.json()["txHash"] is not None

    confirmed = client.post(
        f"/api/v1/payment-intents/{intent_id}/confirm",
        headers={"X-Wallet-Address": OWNER},
        json={"confirmations": 2},
    )
    assert confirmed.status_code == 200
    assert confirmed.json()["status"] == "confirmed"
    assert confirmed.json()["confirmations"] >= 2
    assert confirmed.json()["receiptUrl"] is not None


def test_get_payment_intent_not_found_returns_404(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)

    response = client.get(
        "/api/v1/payment-intents/intent_missing",
        headers={"X-Wallet-Address": OWNER},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Payment intent not found"


def test_submit_and_confirm_intent_not_found_return_404(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)

    submit_response = client.post(
        "/api/v1/payment-intents/intent_missing/submit",
        headers={"X-Wallet-Address": OWNER},
    )
    confirm_response = client.post(
        "/api/v1/payment-intents/intent_missing/confirm",
        headers={"X-Wallet-Address": OWNER},
        json={"confirmations": 1},
    )

    assert submit_response.status_code == 404
    assert submit_response.json()["detail"] == "Payment intent not found"
    assert confirm_response.status_code == 404
    assert confirm_response.json()["detail"] == "Payment intent not found"


def test_submit_payment_intent_rejects_failed_status(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)

    created = client.post(
        "/api/v1/payment-intents",
        headers={"X-Wallet-Address": OWNER},
        json={
            "recipient": RECIPIENT,
            "amount": "9.00",
            "chainPreference": "base",
        },
    )
    assert created.status_code == 201
    intent_id = created.json()["id"]

    from app.production.database import get_session_factory
    from app.production.models import PaymentIntent
    from app.production.types import PaymentIntentStatus

    with get_session_factory()() as db:
        intent = db.scalar(select(PaymentIntent).where(PaymentIntent.id == intent_id))
        assert intent is not None
        intent.status = PaymentIntentStatus.failed.value
        db.commit()

    response = client.post(
        f"/api/v1/payment-intents/{intent_id}/submit",
        headers={"X-Wallet-Address": OWNER},
    )

    assert response.status_code == 409
    assert "finalized" in response.json()["detail"].lower()


def test_confirm_payment_intent_rejects_expired_status(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)

    created = client.post(
        "/api/v1/payment-intents",
        headers={"X-Wallet-Address": OWNER},
        json={
            "recipient": RECIPIENT,
            "amount": "11.00",
            "chainPreference": "base",
        },
    )
    assert created.status_code == 201
    intent_id = created.json()["id"]

    from app.production.database import get_session_factory
    from app.production.models import PaymentIntent
    from app.production.types import PaymentIntentStatus

    with get_session_factory()() as db:
        intent = db.scalar(select(PaymentIntent).where(PaymentIntent.id == intent_id))
        assert intent is not None
        intent.status = PaymentIntentStatus.expired.value
        db.commit()

    response = client.post(
        f"/api/v1/payment-intents/{intent_id}/confirm",
        headers={"X-Wallet-Address": OWNER},
        json={"confirmations": 1},
    )

    assert response.status_code == 409
    assert "failed or expired" in response.json()["detail"].lower()


def test_confirm_payment_intent_rejects_invalid_confirmation_count(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)

    created = client.post(
        "/api/v1/payment-intents",
        headers={"X-Wallet-Address": OWNER},
        json={
            "recipient": RECIPIENT,
            "amount": "13.00",
            "chainPreference": "base",
        },
    )
    assert created.status_code == 201
    intent_id = created.json()["id"]

    response = client.post(
        f"/api/v1/payment-intents/{intent_id}/confirm",
        headers={"X-Wallet-Address": OWNER},
        json={"confirmations": 0},
    )

    assert response.status_code == 422


def test_activity_feed_includes_transaction_and_receipt_events(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)

    created = client.post(
        "/api/v1/payment-intents",
        headers={"X-Wallet-Address": OWNER},
        json={
            "recipient": RECIPIENT,
            "amount": "19.00",
            "chainPreference": "base",
            "note": "Activity",
        },
    )
    assert created.status_code == 201
    intent_id = created.json()["id"]

    submitted = client.post(
        f"/api/v1/payment-intents/{intent_id}/submit",
        headers={"X-Wallet-Address": OWNER},
    )
    assert submitted.status_code == 200

    confirmed = client.post(
        f"/api/v1/payment-intents/{intent_id}/confirm",
        headers={"X-Wallet-Address": OWNER},
        json={"confirmations": 1},
    )
    assert confirmed.status_code == 200

    activity = client.get(
        "/api/v1/activity?limit=20",
        headers={"X-Wallet-Address": OWNER},
    )
    assert activity.status_code == 200
    body = activity.json()
    kinds = {event["kind"] for event in body}
    assert "intent_created" in kinds
    assert "tx_submitted" in kinds
    assert "receipt_issued" in kinds
    assert any(event["intentId"] == intent_id for event in body)
    assert body[0]["kind"] == "receipt_issued"

    limited = client.get(
        "/api/v1/activity?limit=2",
        headers={"X-Wallet-Address": OWNER},
    )
    assert limited.status_code == 200
    limited_body = limited.json()
    assert len(limited_body) == 2
    assert [event["kind"] for event in limited_body] == [
        "receipt_issued",
        "tx_submitted",
    ]


def test_activity_feed_includes_wallet_matched_webhook_events(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)

    created = client.post(
        "/api/v1/payment-intents",
        headers={"X-Wallet-Address": OWNER},
        json={
            "recipient": RECIPIENT,
            "amount": "22.00",
            "chainPreference": "base",
            "note": "Webhook match",
        },
    )
    assert created.status_code == 201
    intent_id = created.json()["id"]

    submitted = client.post(
        f"/api/v1/payment-intents/{intent_id}/submit",
        headers={"X-Wallet-Address": OWNER},
    )
    assert submitted.status_code == 200
    tx_hash = submitted.json()["txHash"]
    assert tx_hash is not None

    webhook = client.post(
        "/api/v1/webhooks/alchemy",
        json={
            "eventId": "evt_wallet_match",
            "type": "MINED_TRANSACTION",
            "payload": {
                "hash": tx_hash,
                "network": "base-mainnet",
            },
        },
    )
    assert webhook.status_code == 202

    activity = client.get(
        "/api/v1/activity?limit=20",
        headers={"X-Wallet-Address": OWNER},
    )
    assert activity.status_code == 200
    body = activity.json()

    webhook_events = [event for event in body if event["kind"] == "webhook_received"]
    assert len(webhook_events) >= 1
    assert any(event["intentId"] == intent_id for event in webhook_events)
    assert any(event["webhookSource"] == "alchemy" for event in webhook_events)
    assert any(event["webhookType"] == "MINED_TRANSACTION" for event in webhook_events)


def test_payment_intent_listing_filtering(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    for amount in ["12.00", "15.00"]:
        created = client.post(
            "/api/v1/payment-intents",
            headers={"X-Wallet-Address": OWNER},
            json={
                "recipient": RECIPIENT,
                "amount": amount,
                "chainPreference": "base",
                "note": f"intent-{amount}",
            },
        )
        assert created.status_code == 201

    all_intents = client.get(
        "/api/v1/payment-intents?limit=10",
        headers={"X-Wallet-Address": OWNER},
    )
    assert all_intents.status_code == 200
    assert len(all_intents.json()) >= 2

    first_id = all_intents.json()[0]["id"]
    submit_first = client.post(
        f"/api/v1/payment-intents/{first_id}/submit",
        headers={"X-Wallet-Address": OWNER},
    )
    assert submit_first.status_code == 200

    submitted_only = client.get(
        "/api/v1/payment-intents?status=submitted&limit=10",
        headers={"X-Wallet-Address": OWNER},
    )
    assert submitted_only.status_code == 200
    assert all(item["status"] == "submitted" for item in submitted_only.json())


def test_contact_create_normalizes_wallet_address(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)

    response = client.post(
        "/api/v1/contacts",
        headers={"X-Wallet-Address": OWNER},
        json={"label": "Maya", "walletAddress": RECIPIENT.upper()},
    )

    assert response.status_code == 201
    assert response.json()["ownerWallet"] == OWNER.lower()
    assert response.json()["walletAddress"] == RECIPIENT.lower()
    assert response.json()["label"] == "Maya"


def test_contacts_list_and_delete(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)

    created = client.post(
        "/api/v1/contacts",
        headers={"X-Wallet-Address": OWNER},
        json={"label": "Maya", "walletAddress": RECIPIENT},
    )
    assert created.status_code == 201
    contact_id = created.json()["id"]

    listed = client.get("/api/v1/contacts", headers={"X-Wallet-Address": OWNER})
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    deleted = client.delete(
        f"/api/v1/contacts/{contact_id}",
        headers={"X-Wallet-Address": OWNER},
    )
    assert deleted.status_code == 200
    assert deleted.json() == {"deleted": True, "contactId": contact_id}

    listed_again = client.get("/api/v1/contacts", headers={"X-Wallet-Address": OWNER})
    assert listed_again.status_code == 200
    assert listed_again.json() == []


def test_portfolio_returns_supported_usdc_balances(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)

    response = client.get("/api/v1/portfolio", headers={"X-Wallet-Address": OWNER})

    assert response.status_code == 200
    body = response.json()
    assert body["walletAddress"] == OWNER.lower()
    assert {item["chain"] for item in body["balances"]} == {
        "base",
        "arbitrum",
        "polygon",
    }
    assert all(item["asset"] == "USDC" for item in body["balances"])
    assert sum(Decimal(item["amount"]) for item in body["balances"]) == Decimal("0")


def test_webhook_ingestion_records_alchemy_events(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)

    response = client.post(
        "/api/v1/webhooks/alchemy",
        json={
            "eventId": "evt_123",
            "type": "MINED_TRANSACTION",
            "payload": {"hash": "0xabc", "network": "base-mainnet"},
        },
    )

    assert response.status_code == 202
    assert response.json() == {"accepted": True, "eventId": "evt_123"}


def test_webhook_ingestion_is_idempotent_on_event_id(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)

    payload = {
        "eventId": "evt_repeat_1",
        "type": "MINED_TRANSACTION",
        "payload": {"hash": "0xabc", "network": "base-mainnet"},
    }

    first = client.post("/api/v1/webhooks/alchemy", json=payload)
    second = client.post("/api/v1/webhooks/alchemy", json=payload)

    assert first.status_code == 202
    assert second.status_code == 202
    assert first.json() == {"accepted": True, "eventId": "evt_repeat_1"}
    assert second.json() == {"accepted": True, "eventId": "evt_repeat_1"}

    from app.production.database import get_session_factory
    from app.production.models import WebhookEvent

    with get_session_factory()() as db:
        events = list(
            db.scalars(
                select(WebhookEvent).where(
                    WebhookEvent.source == "alchemy",
                    WebhookEvent.event_id == "evt_repeat_1",
                )
            )
        )
    assert len(events) == 1
