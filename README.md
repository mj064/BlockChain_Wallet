# BlockChain Wallet

A lightweight Python-based blockchain wallet core implementing secure key management, address derivation, and encrypted storage.

## Features

- **Asymmetric Cryptography**: Uses the SECP256k1 elliptic curve (industry standard) for secure key pair generation.
- **Address Derivation**: Implements standard SHA-256 and RIPEMD-160 hashing for generating wallet addresses.
- **Secure Persistence**: Employs PBKDF2 for key derivation and AES-GCM (Authenticated Encryption) to safely encrypt private keys with a password.

## Project Structure

```text
BlockChain_Wallet/
├── wallet/
│   └── crypto.py    # Core cryptographic primitives
├── .gitignore       # Git exclusion rules
├── requirements.txt # Project dependencies
└── README.md        # Documentation
```

## Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/mj064/BlockChain_Wallet.git
    cd BlockChain_Wallet
    ```

2.  **Install dependencies**:
    ```bash
    pip install -r requirements.txt
    ```

## Quick Start

```python
from wallet.crypto import generate_key_pair, generate_address

# Generate a new identity
private_key, public_key = generate_key_pair()
address = generate_address(public_key)

print(f"Address: {address}")
```

## License

This project is open-source and available under the MIT License.