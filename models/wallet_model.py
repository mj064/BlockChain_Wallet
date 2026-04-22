from pydantic import BaseModel


class WalletCreateRequest(BaseModel):
    password: str