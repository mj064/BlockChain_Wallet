# BlockChain_Wallet

a decentralized p2p blockchain implementation with a compact, efficient structure.

## features
- **hashing**: fixed reproducible sha-256 block hashing
- **consensus**: restored longest-chain rule for node synchronization
- **broadcast**: loop-prevention logic for decentralized transaction sharing
- **ui**: polished single-page react interface for wallet and mining

## project structure
```text
BlockChain_Wallet/
├── backend/
│   ├── app/
│   │   ├── blockchain/ # blocks and chain logic
│   │   ├── network/    # p2p and consensus
│   │   ├── wallet/     # keys and crypto
│   │   └── main.py     # node api
│   └── Dockerfile
├── frontend/
│   ├── src/            # react source code
│   └── package.json
└── README.md
```

## setup

### backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### frontend
```bash
cd frontend
npm install
npm start
```

## compact api
- `POST /wallet`: create a new encrypted wallet
- `POST /tx`: prepare a signed transaction
- `POST /tx/add`: add and broadcast a transaction
- `GET /mine/{addr}`: mine a block and earn rewards
- `GET /chain`: view the full blockchain
- `POST /node/add`: register a peer node
- `GET /resolve`: sync chain with the network (consensus)

## license
MIT