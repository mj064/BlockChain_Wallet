from pydantic import BaseModel


class TransactionRequest(BaseModel):
    sender_public_key: str
    receiver_address: str
    amount: float
    password: str
    encrypted_private_key: dict