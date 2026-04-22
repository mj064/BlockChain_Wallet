# blockchain wallet

a simple python script for managing a crypto wallet. handles keys, addresses, and encryption.

## features
- **keys**: uses secp256k1 (industry standard)
- **addresses**: standard sha256 + ripemd160 hashing
- **security**: uses aes-gcm to encrypt your keys with a password

## project structure
```text
BlockChain_Wallet/
├── wallet/
│   └── crypto.py    # the core logic
├── .gitignore       
├── requirements.txt # pip libs
└── README.md        
```

## setup
1.  **clone it**:
    ```bash
    git clone https://github.com/mj064/BlockChain_Wallet.git
    cd BlockChain_Wallet
    ```

2.  **install deps**:
    ```bash
    pip install -r requirements.txt
    ```

## usage
```python
from wallet.crypto import generate_key_pair, generate_address

# create a new wallet
priv, pub = generate_key_pair()
addr = generate_address(pub)

print(f"Address: {addr}")
```

## license
MIT