import os, hashlib
from ecdsa import SigningKey, SECP256k1, VerifyingKey
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes


def generate_keys():
    sk = SigningKey.generate(curve=SECP256k1)
    vk = sk.get_verifying_key()
    return sk.to_string().hex(), vk.to_string().hex()


def generate_address(pub):
    return hashlib.sha256(bytes.fromhex(pub)).hexdigest()


def derive_key(password, salt):
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(), length=32, salt=salt, iterations=100000
    )
    return kdf.derive(password.encode())


def encrypt_private_key(pk, password):
    salt = os.urandom(16)
    key = derive_key(password, salt)
    aes = AESGCM(key)
    nonce = os.urandom(12)
    ct = aes.encrypt(nonce, pk.encode(), None)
    return {"cipher": ct.hex(), "salt": salt.hex(), "nonce": nonce.hex()}


def decrypt_private_key(data, password):
    key = derive_key(password, bytes.fromhex(data["salt"]))
    aes = AESGCM(key)
    return aes.decrypt(
        bytes.fromhex(data["nonce"]),
        bytes.fromhex(data["cipher"]),
        None,
    ).decode()


def sign(pk, msg):
    sk = SigningKey.from_string(bytes.fromhex(pk), curve=SECP256k1)
    return sk.sign(msg.encode()).hex()


def verify(pub, msg, sig):
    vk = VerifyingKey.from_string(bytes.fromhex(pub), curve=SECP256k1)
    return vk.verify(bytes.fromhex(sig), msg.encode())