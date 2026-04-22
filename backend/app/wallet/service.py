from wallet.crypto import (
    generate_key_pair,
    generate_address,
    encrypt_private_key
)


def create_wallet(password: str):
    private_key, public_key = generate_key_pair()
    address = generate_address(public_key)

    encrypted_data = encrypt_private_key(private_key, password)

    return {
        "address": address,
        "public_key": public_key,
        "encrypted_private_key": encrypted_data
    }