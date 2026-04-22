from fastapi import FastAPI
from wallet.service import create_wallet
from models.wallet_model import WalletCreateRequest
from transactions.tx_model import TransactionRequest
from transactions.tx_service import create_transaction, validate_transaction
from blockchain.blockchain import Blockchain
from network.node import Node


app = FastAPI()


@app.get("/")
def root():
    return {"message": "SecureChain Wallet API Running"}


@app.post("/wallet/create")
def create_wallet_api(request: WalletCreateRequest):
    wallet = create_wallet(request.password)

    return {
        "message": "Wallet created successfully",
        "wallet": wallet
    }

@app.post("/transaction/create")
def create_tx(request: TransactionRequest):
    tx = create_transaction(request)

    return {
        "message": "Transaction created",
        "transaction": tx
    }


@app.post("/transaction/verify")
def verify_tx(tx: dict):
    is_valid = validate_transaction(tx)

    return {
        "valid": is_valid
    }
    
blockchain = Blockchain()


@app.post("/transaction/add")
def add_transaction(tx: dict):
    blockchain.add_transaction(tx)
    return {"message": "Transaction added to mempool"}


@app.get("/mine/{miner_address}")
def mine(miner_address: str):
    block = blockchain.mine_block(miner_address)

    return {
        "message": "Block mined!",
        "block": block.__dict__
    }


@app.get("/chain")
def get_chain():
    return {
        "length": len(blockchain.chain),
        "chain": [block.__dict__ for block in blockchain.chain]
    }


@app.get("/validate")
def validate_chain():
    return {"valid": blockchain.is_chain_valid()}
    

node = Node()


# register a new node
@app.post("/node/register")
def register_node(node_url: str):
    node.register_node(node_url)
    return {"message": "Node added", "nodes": list(node.nodes)}


# broadcast a transaction to the network
@app.post("/transaction/broadcast")
def broadcast_tx(tx: dict):
    blockchain.add_transaction(tx)
    node.broadcast_transaction(tx)

    return {"message": "Transaction broadcasted"}


# sync the chain (consensus)
@app.get("/nodes/resolve")
def consensus():
    replaced = node.resolve_conflicts(blockchain)

    return {
        "replaced": replaced,
        "chain_length": len(blockchain.chain)
    }
    