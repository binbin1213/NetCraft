"""Password policy tests.

Consolidates the four legacy test_password_validation*.py files, which
duplicated each other and could not run:
  - they imported validate_password from app.auth (the function did not exist)
  - "Short1!" (7 chars) was listed as a valid 8-character password
  - they expected ValueError from UserCreate, but Pydantic wraps validator
    failures in ValidationError
"""

import pytest
from pydantic import ValidationError

from app.auth import validate_password
from app.models import UserCreate


@pytest.mark.parametrize(
    "password",
    [
        "Password1!",
        "P@ssw0rd",
        "A1b2C3d4!",
        "Aa1!@#$%^&*()_+-=[]{}|;:,.<>?/~`",
        "Xa1!" + "x" * 4,  # exactly 8 characters
    ],
)
def test_valid_passwords_accepted(password):
    assert validate_password(password) is None
    assert UserCreate(username="testuser", password=password).password == password


@pytest.mark.parametrize(
    "password, expected",
    [
        ("Short1!", "at least 8 characters"),
        ("Aa1!" + "x" * 125, "at most 128 characters"),
        ("password1!", "uppercase"),
        ("PASSWORD1!", "lowercase"),
        ("Password!!", "number"),
        ("Password1", "special character"),
    ],
)
def test_invalid_passwords_rejected(password, expected):
    with pytest.raises(ValueError, match=expected):
        validate_password(password)


def test_user_create_rejects_weak_password():
    with pytest.raises(ValidationError):
        UserCreate(username="testuser", password="weak")


def test_boundary_lengths():
    # 8 characters is the minimum accepted length.
    validate_password("Ab1!aaaa")
    # 128 characters is still accepted.
    validate_password("Ab1!" + "a" * 124)
    with pytest.raises(ValueError, match="at least 8"):
        validate_password("Ab1!aaa")
    with pytest.raises(ValueError, match="at most 128"):
        validate_password("Ab1!" + "a" * 125)
