from fastapi import FastAPI
from wallet.service import create_wallet
from models.wallet_model import WalletCreateRequest

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