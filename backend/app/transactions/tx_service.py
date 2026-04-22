import json, time
from app.wallet.crypto import decrypt_private_key, sign, verify

def create_tx(data):
    pk = decrypt_private_key(data["enc_pk"], data["password"])
    tx = {
        "sender": data["pub"],
        "receiver": data["to"],
        "amount": data["amt"],
        "timestamp": time.time()
    }
    msg = json.dumps(tx, sort_keys=True)
    tx["sig"] = sign(pk, msg)
    return tx

def verify_tx(tx):
    sig = tx["sig"]
    t = tx.copy()
    del t["sig"]
    msg = json.dumps(t, sort_keys=True)
    return verify(tx["sender"], msg, sig)