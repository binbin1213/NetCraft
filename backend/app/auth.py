"""Backward-compatible re-exports.

Security primitives now live in ``app.core.security`` (config in
``app.core.config``). This module stays so existing imports keep working;
new code should import from ``app.core.security`` directly.
"""

from .core.config import (  # noqa: F401
    ACCESS_TOKEN_EXPIRE_MINUTES,
    ALGORITHM,
    SECRET_KEY,
)
from .core.security import (  # noqa: F401
    create_access_token,
    get_password_hash,
    validate_password,
    verify_password,
)

__all__ = [
    "ACCESS_TOKEN_EXPIRE_MINUTES",
    "ALGORITHM",
    "SECRET_KEY",
    "create_access_token",
    "get_password_hash",
    "validate_password",
    "verify_password",
]
