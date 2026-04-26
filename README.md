# BlockChain_Wallet

BlockChain_Wallet is a full-stack crypto wallet playground with two tracks:

- a custom blockchain + P2P node backend (mining, mempool, consensus)
- a production-style USDC payment workflow with settlement activity tooling in the frontend

This repo is useful if you want to experiment with both core blockchain mechanics and a practical payment-intent UX.

## What You Get

### Core chain and node features

- ECDSA wallet/key flow with encrypted storage support
- Transaction signing and verification
- Mempool, block mining, and chain validation
- Basic node networking and longest-chain resolution

### Production payments UI flow

- Payment intent create, submit, and confirm flow
- Contact book for saved recipient addresses
- Settlement activity timeline (intent, tx, receipt, webhook)
- Activity filters by event kind and webhook source
- Activity export (JSON and CSV) with metadata and deterministic checksums

## Project Layout

```text
BlockChain_Wallet/
├── backend/
│   ├── app/
│   │   ├── blockchain/
│   │   ├── network/
│   │   ├── transactions/
│   │   ├── wallet/
│   │   ├── production/
│   │   └── main.py
│   ├── tests/
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── production/
│   │   ├── pages/
│   │   └── components/
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml
├── graphify-out/
└── README.md
```

## Quick Start

### 1) Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

## Running Tests

### Backend tests

```bash
python -m pytest backend/tests -q
```

### Frontend tests

```bash
npm --prefix frontend run test -- --run
```

## Health Check

The backend now exposes a lightweight runtime check endpoint:

- GET /health
	- returns status, current block count, and pending transaction count

Example:

```bash
curl http://localhost:8000/health
```

## Settlement Activity Export Notes

The production wallet export is designed for audit/debug workflows, not just display.

- JSON export shape:
	- metadata
	- events
- CSV export includes metadata header rows before event rows.
- Metadata includes:
	- schemaVersion
	- filter state
	- generatedAtUtc
	- eventCount
	- kind/source counts
	- eventsChecksum

Important behavior:

- source labels are normalized to ALCHEMY, CIRCLE, NONE, OTHER
- metadata filterSource is canonicalized to ALL, ALCHEMY, CIRCLE, NONE, or OTHER
- sorting is deterministic for stable output/checksum
- invalid/unparseable timestamps do not crash the UI

## Docker

To run the multi-node setup:

```bash
docker-compose up --build
```

## CI and Dependency Checks

GitHub Actions workflows are included under .github/workflows:

- ci.yml
	- runs backend tests (pytest)
	- runs frontend tests (vitest)
	- runs frontend build
- dependency-checks.yml
	- scheduled weekly dependency checks
	- pip check + pip outdated listing
	- npm audit (high severity threshold)

## License

MIT