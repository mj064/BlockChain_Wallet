from app.wallet.crypto import generate_keys, generate_address, encrypt_private_key

def create_wallet(password):
    priv, pub = generate_keys()
    return {
        "address": generate_address(pub),
        "public_key": pub,
        "encrypted_private_key": encrypt_private_key(priv, password)
    }