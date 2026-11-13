"""Application settings, read once at import time and validated eagerly."""

import os
from typing import List


class SettingsError(RuntimeError):
    """Raised when a required environment variable is missing or invalid."""


def _require(name: str, hint: str = "") -> str:
    value = os.getenv(name)
    if not value or not value.strip():
        message = f"Environment variable {name} is not set."
        if hint:
            message = f"{message} {hint}"
        raise SettingsError(message)
    return value.strip()


def _csv(name: str, default: str) -> List[str]:
    raw = os.getenv(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


# JWT signing key. No default on purpose: a published fallback would let anyone
# forge tokens for any user.
SECRET_KEY: str = _require(
    "SECRET_KEY", "Generate one with: openssl rand -hex 32"
)
ALGORITHM: str = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

# CORS. Behind the bundled nginx the frontend is same-origin, so this mostly
# matters for local development against a separate dev server.
ALLOWED_ORIGINS: List[str] = _csv(
    "ALLOWED_ORIGINS", "http://localhost:5173,http://localhost"
)

# Database. Falls back to a local SQLite file for development.
DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///netcraft.db")

# AI provider key. Optional: users may supply their own per request.
DASHSCOPE_API_KEY: str = os.getenv("DASHSCOPE_API_KEY", "")

LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO").upper()
