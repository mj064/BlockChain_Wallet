# blockchain wallet

a decentralized p2p blockchain implementation in python. features a full node with mining, transaction broadcasting, and consensus.

## features
- **blockchain**: linked blocks with sha-256 hashing and proof of work
- **mining**: cpu mining with adjustable difficulty and block rewards
- **p2p networking**: node registration and transaction broadcasting
- **consensus**: resolve conflicts using the longest-chain rule
- **wallet**: secure ecdsa keys, address derivation, and encrypted storage
- **api**: full fastapi interface for interacting with the node

## project structure
```text
BlockChain_Wallet/
├── blockchain/
│   ├── block.py         # block data structure
│   └── blockchain.py    # chain logic and mining
├── models/
│   └── wallet_model.py  # pydantic models
├── network/
│   └── node.py          # p2p networking logic
├── transactions/
│   ├── tx_model.py      
│   └── tx_service.py    
├── wallet/
│   ├── crypto.py        
│   └── service.py       
├── main.py              # node entry point
├── requirements.txt     
└── README.md        
```

## setup
1.  **clone and install**:
    ```bash
    git clone https://github.com/mj064/BlockChain_Wallet.git
    cd BlockChain_Wallet
    pip install -r requirements.txt
    ```

2.  **run a node**:
    ```bash
    uvicorn main:app --reload --port 8000
    ```

## api usage

### mining
mine pending transactions and earn rewards:
```bash
curl http://127.0.0.1:8000/mine/your_wallet_address
```

### p2p networking
register a peer node:
```bash
curl -X POST "http://127.0.0.1:8000/node/register" \
     -H "Content-Type: application/json" \
     -d '"http://127.0.0.1:8001"'
```

sync your chain with the network (consensus):
```bash
curl http://127.0.0.1:8000/nodes/resolve
```

### transactions
broadcast a transaction to the network:
```bash
curl -X POST "http://127.0.0.1:8000/transaction/broadcast" \
     -H "Content-Type: application/json" \
     -d '{...}'
```

## license
MIT