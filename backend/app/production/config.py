import os
from functools import lru_cache

from pydantic import BaseModel


class Settings(BaseModel):
    database_url: str = "sqlite:///./production_wallet.db"
    allowed_origins: list[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
    ]
    beta_daily_limit_usdc: str = "500.00"
    beta_global_daily_limit_usdc: str = "5000.00"


def _csv_env(name: str, default: list[str]) -> list[str]:
    raw = os.getenv(name)
    if not raw:
        return default
    return [item.strip() for item in raw.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    defaults = Settings()
    return Settings(
        database_url=os.getenv("PRODUCTION_DATABASE_URL", defaults.database_url),
        allowed_origins=_csv_env(
            "PRODUCTION_ALLOWED_ORIGINS",
            defaults.allowed_origins,
        ),
        beta_daily_limit_usdc=os.getenv(
            "PRODUCTION_BETA_DAILY_LIMIT_USDC",
            defaults.beta_daily_limit_usdc,
        ),
        beta_global_daily_limit_usdc=os.getenv(
            "PRODUCTION_BETA_GLOBAL_DAILY_LIMIT_USDC",
            defaults.beta_global_daily_limit_usdc,
        ),
    )
