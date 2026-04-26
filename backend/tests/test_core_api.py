import sys
from pathlib import Path

from fastapi.testclient import TestClient


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

OWNER = "0x" + "a" * 40
RECIPIENT = "0x" + "b" * 40


def _client(tmp_path, monkeypatch):
    monkeypatch.setenv(
        "PRODUCTION_DATABASE_URL",
        f"sqlite:///{(tmp_path / 'core-wallet.db').as_posix()}",
    )
    monkeypatch.setenv("PRODUCTION_ALLOWED_ORIGINS", "http://localhost:5173")

    from app.main import app, bc, node
    from app.blockchain.blockchain import Blockchain
    from app.network.node import Node
    from app.production.config import get_settings
    from app.production.database import init_db, reset_engine_for_tests

    get_settings.cache_clear()
    reset_engine_for_tests()
    init_db()

    # Keep tests deterministic by resetting in-memory chain state each test.
    fresh_chain = Blockchain()
    fresh_node = Node()
    bc.chain = fresh_chain.chain
    bc.pending = fresh_chain.pending
    bc.diff = fresh_chain.diff
    node.nodes = fresh_node.nodes

    return TestClient(app)


def test_root_and_health_report_online(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)

    root = client.get("/")
    health = client.get("/health")

    assert root.status_code == 200
    assert root.json()["status"] == "online"
    assert root.json()["blocks"] == 1

    assert health.status_code == 200
    assert health.json()["status"] == "ok"
    assert health.json()["blocks"] == 1
    assert health.json()["pending"] == 0


def test_wallet_tx_add_duplicate_guard_and_mempool(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)

    wallet = client.post("/wallet", json={"password": "hunter2"})
    assert wallet.status_code == 200
    wallet_body = wallet.json()
    assert "address" in wallet_body
    assert "public_key" in wallet_body
    assert "encrypted_private_key" in wallet_body

    tx = client.post(
        "/tx",
        json={
            "enc_pk": wallet_body["encrypted_private_key"],
            "password": "hunter2",
            "pub": wallet_body["public_key"],
            "to": RECIPIENT,
            "amt": 7.25,
        },
    )
    assert tx.status_code == 200

    add_first = client.post("/tx/add", json=tx.json())
    add_second = client.post("/tx/add", json=tx.json())

    assert add_first.status_code == 200
    assert add_first.json()["msg"] == "added"
    assert add_second.status_code == 400

    pool = client.get("/mempool")
    assert pool.status_code == 200
    assert pool.json()["count"] == 1


def test_mine_updates_balance_and_history(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)

    mined = client.get(f"/mine/{OWNER}")
    assert mined.status_code == 200
    mined_block = mined.json()
    assert mined_block["index"] == 1

    balance = client.get(f"/balance/{OWNER}")
    history = client.get(f"/history/{OWNER}")
    stats = client.get("/stats")
    valid = client.get("/valid")

    assert balance.status_code == 200
    assert balance.json()["balance"] == 50.0

    assert history.status_code == 200
    assert len(history.json()) >= 1
    assert history.json()[0]["receiver"] == OWNER

    assert stats.status_code == 200
    assert stats.json()["blocks"] == 2
    assert stats.json()["valid"] is True

    assert valid.status_code == 200
    assert valid.json()["valid"] is True
