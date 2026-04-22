# BlockChain_Wallet

a full-stack decentralized blockchain wallet with p2p networking, proof-of-work mining, and a modern react dashboard.

## features
- **wallet**: ecdsa key generation, sha-256 address derivation, aes-gcm encrypted key storage
- **transactions**: signed transactions with ecdsa, broadcast loop prevention, mempool management
- **blockchain**: sha-256 proof-of-work, genesis block, chain validation
- **consensus**: longest-chain rule across p2p nodes
- **balance tracking**: real-time balance and full transaction history per address
- **frontend**: dark glassmorphism 5-page react dashboard

## project structure
```text
BlockChain_Wallet/
├── backend/
│   ├── app/
│   │   ├── blockchain/  # block + chain logic
│   │   ├── network/     # p2p node + consensus
│   │   ├── transactions/# signing + verification
│   │   ├── wallet/      # crypto primitives
│   │   └── main.py      # fastapi node api
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/  # sidebar
│   │   ├── pages/       # dashboard, send, explorer, mine, network
│   │   ├── App.js
│   │   ├── api.js
│   │   └── index.css    # dark design system
│   └── package.json
├── docker-compose.yml
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

## api endpoints
| method | route | description |
|--------|-------|-------------|
| POST | `/wallet` | create encrypted wallet |
| GET | `/balance/{addr}` | get address balance |
| GET | `/history/{addr}` | transaction history |
| POST | `/tx` | create signed transaction |
| POST | `/tx/add` | broadcast transaction |
| GET | `/mine/{addr}` | mine a block |
| GET | `/chain` | full blockchain |
| GET | `/mempool` | pending transactions |
| GET | `/stats` | chain statistics |
| POST | `/node/add` | register peer node |
| GET | `/resolve` | run consensus |

## docker (3-node network)
```bash
docker-compose up --build
```

## license
MIT