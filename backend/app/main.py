from fastapi import FastAPI
from app.wallet.service import create_wallet
from app.transactions.tx_service import create_tx, verify_tx
from app.blockchain.blockchain import Blockchain
from app.network.node import Node

app=FastAPI()
bc=Blockchain()
node=Node()

@app.post("/wallet")
def wallet(p:dict): return create_wallet(p["password"])

@app.post("/tx")
def tx(data:dict): return create_tx(data)

@app.post("/tx/add")
def add(tx:dict):
    # verify and check if already in pool to prevent broadcast loops
    if verify_tx(tx) and tx not in bc.pending:
        bc.add_tx(tx)
        node.broadcast(tx)
        return {"msg":"added"}
    return {"error":"invalid or duplicate"}

@app.get("/mine/{addr}")
def mine(addr:str): return bc.mine(addr).__dict__

@app.get("/chain")
def chain(): return [b.__dict__ for b in bc.chain]

@app.get("/valid")
def valid(): return {"valid":bc.valid()}

@app.post("/node/add")
def add_node(n:dict):
    node.add(n["url"])
    return {"msg":"node added"}

@app.get("/resolve")
def resolve():
    r = node.resolve(bc)
    return {"replaced": r, "len": len(bc.chain)}