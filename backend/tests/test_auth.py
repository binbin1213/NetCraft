"""Authentication flow: register, login, protected access."""

from datetime import datetime, timedelta, timezone

import pytest
from jose import jwt

from app.auth import ALGORITHM, SECRET_KEY, validate_password


def test_register_and_login(client):
    response = client.post(
        "/register", json={"username": "bob", "password": "Str0ng!Pass"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["username"] == "bob"
    assert "password" not in body
    assert "password_hash" not in body

    response = client.post(
        "/token", data={"username": "bob", "password": "Str0ng!Pass"}
    )
    assert response.status_code == 200
    assert response.json()["token_type"] == "bearer"


def test_duplicate_username_rejected(client):
    payload = {"username": "carol", "password": "Str0ng!Pass"}
    assert client.post("/register", json=payload).status_code == 200
    assert client.post("/register", json=payload).status_code == 400


def test_wrong_password_rejected(client):
    client.post("/register", json={"username": "dave", "password": "Str0ng!Pass"})
    response = client.post(
        "/token", data={"username": "dave", "password": "WrongPass1!"}
    )
    assert response.status_code == 400


def test_users_me_requires_token(client):
    assert client.get("/users/me").status_code == 401


def test_users_me_with_token(client, auth_headers):
    response = client.get("/users/me", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["username"] == "alice"


def test_invalid_token_rejected(client):
    response = client.get("/users/me", headers={"Authorization": "Bearer not-a-jwt"})
    assert response.status_code == 401


def test_token_lifetime_is_seven_days(client):
    """The JWT lifetime must follow ACCESS_TOKEN_EXPIRE_MINUTES (7 days)."""
    client.post("/register", json={"username": "erin", "password": "Str0ng!Pass"})
    token = client.post(
        "/token", data={"username": "erin", "password": "Str0ng!Pass"}
    ).json()["access_token"]

    claims = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    # Compare against a timezone-aware now: datetime.utcnow().timestamp()
    # would reinterpret the naive value in local time and skew the result.
    now = int(datetime.now(timezone.utc).timestamp())
    lifetime = claims["exp"] - now
    assert timedelta(days=6, hours=23) < timedelta(seconds=lifetime) <= timedelta(days=7)


@pytest.mark.parametrize(
    "password",
    ["Short1!", "alllowercase1!", "ALLUPPERCASE1!", "NoNumber!!", "NoSpecial1"],
)
def test_weak_passwords_rejected(client, password):
    response = client.post(
        "/register", json={"username": "weak", "password": password}
    )
    assert response.status_code == 422


def test_validate_password_accepts_strong_value():
    assert validate_password("Str0ng!Pass") is None
