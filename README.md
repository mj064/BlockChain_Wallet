# securechain

a decentralized p2p blockchain implementation with a full web interface.

## features
- **blockchain**: linked blocks with sha-256 hashing and proof of work
- **mining**: cpu mining with adjustable difficulty and block rewards
- **p2p networking**: node registration and transaction broadcasting
- **consensus**: resolve conflicts using the longest-chain rule
- **wallet**: secure ecdsa keys, address derivation, and encrypted storage
- **ui**: modern react dashboard for wallet management and chain exploring

## project structure
```text
securechain/
├── backend/
│   ├── app/
│   │   ├── blockchain/
│   │   ├── models/
│   │   ├── network/
│   │   ├── transactions/
│   │   ├── wallet/
│   │   └── main.py
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── App.js
│   │   └── api.js
│   ├── package.json
│   └── public/
├── docker-compose.yml
└── README.md
```

## setup

### backend
1.  **install deps**:
    ```bash
    cd backend
    pip install -r requirements.txt
    ```

2.  **run node**:
    ```bash
    uvicorn app.main:app --reload
    ```

### frontend
1.  **install deps**:
    ```bash
    cd frontend
    npm install
    ```

2.  **run ui**:
    ```bash
    npm start
    ```

## docker
run a 3-node network locally:
```bash
docker-compose up --build
```

## license
MIT