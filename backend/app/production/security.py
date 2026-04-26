from typing import Annotated

from fastapi import Header, HTTPException

from app.production.schemas import normalize_wallet_address


def require_wallet_address(
    wallet_address: Annotated[str | None, Header(alias="X-Wallet-Address")] = None,
) -> str:
    if not wallet_address:
        raise HTTPException(status_code=401, detail="Missing X-Wallet-Address header")
    try:
        return normalize_wallet_address(wallet_address)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
