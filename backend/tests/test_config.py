"""Settings validation and health endpoint.

Eager validation is verified in a subprocess so the failing import cannot
poison this process's already-imported modules.
"""

import subprocess
import sys
from pathlib import Path

import pytest

from app.core.config import SettingsError, _csv, _require

BACKEND_DIR = Path(__file__).resolve().parents[1]


def test_require_returns_trimmed_value(monkeypatch):
    monkeypatch.setenv("SOME_KEY", "  value  ")
    assert _require("SOME_KEY") == "value"


def test_require_rejects_missing_value(monkeypatch):
    monkeypatch.delenv("SOME_KEY", raising=False)
    with pytest.raises(SettingsError) as excinfo:
        _require("SOME_KEY")
    assert "SOME_KEY" in str(excinfo.value)


def test_require_rejects_blank_value(monkeypatch):
    monkeypatch.setenv("SOME_KEY", "   ")
    with pytest.raises(SettingsError):
        _require("SOME_KEY")


def test_require_includes_hint(monkeypatch):
    monkeypatch.delenv("SOME_KEY", raising=False)
    with pytest.raises(SettingsError) as excinfo:
        _require("SOME_KEY", "Generate one with: openssl rand -hex 32")
    assert "openssl rand -hex 32" in str(excinfo.value)


def test_csv_splits_and_trims(monkeypatch):
    monkeypatch.setenv("SOME_LIST", " https://a.test , https://b.test ,, ")
    assert _csv("SOME_LIST", "fallback") == ["https://a.test", "https://b.test"]


def test_csv_falls_back_when_unset(monkeypatch):
    monkeypatch.delenv("SOME_LIST", raising=False)
    assert _csv("SOME_LIST", "http://localhost:5173") == ["http://localhost:5173"]


def test_missing_secret_key_aborts_startup():
    """Importing the app without SECRET_KEY must fail loudly, not silently."""
    import os

    env = {**os.environ, "SECRET_KEY": ""}
    env.pop("SECRET_KEY", None)  # truly unset, not just blank
    result = subprocess.run(
        [sys.executable, "-c", "import app.main"],
        cwd=BACKEND_DIR,
        env=env,
        capture_output=True,
        text=True,
    )
    assert result.returncode != 0
    assert "SECRET_KEY" in result.stderr
    assert "openssl rand -hex 32" in result.stderr


def test_health_endpoint(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
