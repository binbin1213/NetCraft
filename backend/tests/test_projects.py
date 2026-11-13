"""Project CRUD and per-user isolation."""

import pytest


def _create_project(client, headers, name="Lab"):
    response = client.post(
        "/projects/",
        headers=headers,
        json={"name": name, "description": "test", "data": [{"nodes": [], "edges": []}]},
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_create_and_read_project(client, auth_headers):
    project = _create_project(client, auth_headers)
    assert project["name"] == "Lab"
    assert project["user_id"] is not None

    response = client.get(f"/projects/{project['id']}", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["id"] == project["id"]


def test_list_only_returns_own_projects(client, auth_headers):
    _create_project(client, auth_headers, name="Mine")
    response = client.get("/projects/", headers=auth_headers)
    assert response.status_code == 200
    assert [p["name"] for p in response.json()] == ["Mine"]


def test_update_project(client, auth_headers):
    project = _create_project(client, auth_headers)
    response = client.put(
        f"/projects/{project['id']}",
        headers=auth_headers,
        json={"name": "Renamed"},
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Renamed"


def test_delete_project(client, auth_headers):
    project = _create_project(client, auth_headers)
    assert client.delete(f"/projects/{project['id']}", headers=auth_headers).status_code == 200
    assert client.get(f"/projects/{project['id']}", headers=auth_headers).status_code == 404


def test_other_user_cannot_read_project(client, auth_headers):
    project = _create_project(client, auth_headers, name="Private")

    client.post("/register", json={"username": "mallory", "password": "Str0ng!Pass"})
    token = client.post(
        "/token", data={"username": "mallory", "password": "Str0ng!Pass"}
    ).json()["access_token"]
    other_headers = {"Authorization": f"Bearer {token}"}

    assert client.get(f"/projects/{project['id']}", headers=other_headers).status_code == 403


def test_other_user_cannot_delete_project(client, auth_headers):
    project = _create_project(client, auth_headers, name="Private2")

    client.post("/register", json={"username": "trudy", "password": "Str0ng!Pass"})
    token = client.post(
        "/token", data={"username": "trudy", "password": "Str0ng!Pass"}
    ).json()["access_token"]
    other_headers = {"Authorization": f"Bearer {token}"}

    assert client.delete(f"/projects/{project['id']}", headers=other_headers).status_code == 403


def test_projects_require_auth(client):
    assert client.get("/projects/").status_code == 401
    assert client.post("/projects/", json={"name": "x"}).status_code == 401


def test_chat_requires_auth(client):
    response = client.post("/api/chat", json={"messages": [{"role": "user", "content": "hi"}]})
    assert response.status_code == 401


def test_update_refreshes_updated_at(client, auth_headers):
    """updated_at must move forward on every update."""
    project = _create_project(client, auth_headers, name="Stamp")
    before = project["updated_at"]

    response = client.put(
        f"/projects/{project['id']}",
        headers=auth_headers,
        json={"name": "Stamp2"},
    )
    assert response.status_code == 200
    assert response.json()["updated_at"] > before
