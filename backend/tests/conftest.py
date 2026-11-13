import os
import sys
import pathlib

# Ensure `app` is importable when pytest runs from backend/
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

# Must be set before importing the app: auth.py fails fast without it.
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pytest-only")
os.environ.setdefault("DATABASE_URL", "sqlite:///./test_netcraft.db")

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from app.database import get_session
from app.main import app

TEST_ENGINE = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)


@pytest.fixture(name="session")
def session_fixture():
    SQLModel.metadata.create_all(TEST_ENGINE)
    with Session(TEST_ENGINE) as session:
        yield session
    SQLModel.metadata.drop_all(TEST_ENGINE)


@pytest.fixture(name="client")
def client_fixture(session: Session):
    def get_session_override():
        yield session

    app.dependency_overrides[get_session] = get_session_override
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


@pytest.fixture(name="auth_headers")
def auth_headers_fixture(client: TestClient):
    """Register + login a user and return the Authorization header."""
    credentials = {"username": "alice", "password": "Str0ng!Pass"}
    client.post("/register", json=credentials)
    response = client.post(
        "/token",
        data={"username": credentials["username"], "password": credentials["password"]},
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
