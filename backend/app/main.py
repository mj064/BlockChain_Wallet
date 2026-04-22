from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.wallet.service import create_wallet
from app.transactions.tx_service import create_tx, verify_tx
from app.blockchain.blockchain import Blockchain
from app.network.node import Node

app = FastAPI(title="BlockChain Wallet API")
bc = Blockchain()
node = Node()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root(): return {"status": "online", "blocks": len(bc.chain)}

@app.post("/wallet")
def wallet(p: dict): return create_wallet(p["password"])

@app.post("/tx")
def tx(data: dict): return create_tx(data)

@app.post("/tx/add")
def add_tx(data: dict):
    if verify_tx(data) and data not in bc.pending:
        bc.add_tx(data)
        node.broadcast(data)
        return {"msg": "added"}
    raise HTTPException(400, "invalid or duplicate transaction")

@app.get("/balance/{addr}")
def balance(addr: str):
    return {"address": addr, "balance": bc.get_balance(addr)}

@app.get("/history/{addr}")
def history(addr: str):
    return bc.get_tx_history(addr)

@app.get("/mempool")
def mempool():
    return {"count": len(bc.pending), "transactions": bc.pending}

@app.get("/stats")
def stats():
    total_txs = sum(len(b.transactions) for b in bc.chain)
    return {
        "blocks": len(bc.chain),
        "pending": len(bc.pending),
        "total_txs": total_txs,
        "difficulty": bc.diff,
        "valid": bc.valid()
    }

@app.get("/mine/{addr}")
def mine(addr: str): return bc.mine(addr).__dict__

@app.get("/chain")
def chain(): return [b.__dict__ for b in bc.chain]

@app.get("/valid")
def valid(): return {"valid": bc.valid()}

@app.post("/node/add")
def add_node(n: dict):
    node.add(n["url"])
    return {"msg": "node added", "nodes": list(node.nodes)}

@app.get("/nodes")
def get_nodes(): return {"nodes": list(node.nodes)}

@app.get("/resolve")
def resolve():
    r = node.resolve(bc)
    return {"replaced": r, "len": len(bc.chain)}