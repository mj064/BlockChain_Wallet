import time
import json
from wallet.crypto import (
    decrypt_private_key,
    sign_transaction,
    verify_signature
)


# decrypt key and sign the transaction
def create_transaction(data):
    private_key = decrypt_private_key(
        data.encrypted_private_key,
        data.password
    )

    # prepare transaction data
    tx = {
        "sender": data.sender_public_key,
        "receiver": data.receiver_address,
        "amount": data.amount,
        "timestamp": time.time()
    }

    tx_string = json.dumps(tx, sort_keys=True)

    # sign the payload
    signature = sign_transaction(private_key, tx_string)

    tx["signature"] = signature

    return tx


# verify if a transaction is valid
def validate_transaction(tx):
    signature = tx["signature"]

    tx_copy = tx.copy()
    del tx_copy["signature"]

    tx_string = json.dumps(tx_copy, sort_keys=True)

    return verify_signature(
        tx["sender"],
        tx_string,
        signature
    )