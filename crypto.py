import os
import hashlib
from ecdsa import SigningKey, SECP256k1
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


# Generate SECP256k1 key pair
def generate_key_pair():
    private_key = SigningKey.generate(curve=SECP256k1)
    public_key = private_key.get_verifying_key()

    return private_key.to_string().hex(), public_key.to_string().hex()


# Derive wallet address from public key
def generate_address(public_key_hex):
    public_bytes = bytes.fromhex(public_key_hex)
    sha = hashlib.sha256(public_bytes).digest()
    ripemd = hashlib.new('ripemd160', sha).hexdigest()

    return ripemd


# Derive encryption key from password using PBKDF2
def derive_key(password: str, salt: bytes):
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100000,
    )
    return kdf.derive(password.encode())


# Encrypt private key using AES-GCM
def encrypt_private_key(private_key_hex: str, password: str):
    salt = os.urandom(16)
    key = derive_key(password, salt)

    aesgcm = AESGCM(key)
    nonce = os.urandom(12)

    ciphertext = aesgcm.encrypt(nonce, private_key_hex.encode(), None)

    return {
        "ciphertext": ciphertext.hex(),
        "salt": salt.hex(),
        "nonce": nonce.hex()
    }


# Decrypt private key using AES-GCM
def decrypt_private_key(enc_data, password: str):
    salt = bytes.fromhex(enc_data["salt"])
    nonce = bytes.fromhex(enc_data["nonce"])
    ciphertext = bytes.fromhex(enc_data["ciphertext"])

    key = derive_key(password, salt)
    aesgcm = AESGCM(key)

    decrypted = aesgcm.decrypt(nonce, ciphertext, None)

    return decrypted.decode()