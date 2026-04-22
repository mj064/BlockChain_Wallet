# blockchain wallet

a simple python api for managing a crypto wallet. handles keys, addresses, and encryption.

## features
- **api**: built with fastapi for quick wallet creation
- **keys**: uses secp256k1 (industry standard)
- **addresses**: standard sha256 + ripemd160 hashing
- **security**: uses aes-gcm to encrypt your keys with a password

## project structure
```text
BlockChain_Wallet/
├── models/
│   └── wallet_model.py  # request models
├── transactions/
│   ├── tx_model.py      # transaction models
│   └── tx_service.py    # transaction logic
├── wallet/
│   ├── crypto.py        # crypto logic
│   └── service.py       # wallet services
├── main.py              # api entry point
├── .gitignore       
├── requirements.txt     # dependencies
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

## running the api
```bash
uvicorn main:app --reload
```

## api usage
once the server is running, you can create a wallet:
```bash
curl -X POST "http://127.0.0.1:8000/wallet/create" \
     -H "Content-Type: application/json" \
     -d '{"password": "your_secure_password"}'
```

## license
MIT