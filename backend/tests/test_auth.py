"""Authentication endpoint tests."""

import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.user import UserCreate, UserLogin


async def _register(client, email: str, password: str = "Password123!", display_name: str = "Test User"):
    return await client.post(
        "/auth/register",
        json={"email": email, "password": password, "display_name": display_name},
    )


async def test_register_success(client, db_session: AsyncSession):
    resp = await _register(client, "alice@example.com")
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["email"] == "alice@example.com"
    assert data["display_name"] == "Test User"
    assert data["is_active"] is True
    assert data["is_admin"] is False
    uuid.UUID(data["id"])


async def test_register_duplicate_email(client, db_session: AsyncSession):
    await _register(client, "bob@example.com")
    resp = await _register(client, "bob@example.com")
    assert resp.status_code == 409, resp.text
    assert resp.json()["detail"] == "Email already registered"


async def test_register_invalid_email(client):
    resp = await client.post(
        "/auth/register",
        json={"email": "not-an-email", "password": "Password123!", "display_name": "X"},
    )
    assert resp.status_code == 422, resp.text


async def test_register_short_password(client):
    resp = await client.post(
        "/auth/register",
        json={"email": "carol@example.com", "password": "short", "display_name": "Carol"},
    )
    assert resp.status_code == 422, resp.text


async def test_login_success(client, db_session: AsyncSession):
    await _register(client, "dave@example.com")
    resp = await client.post(
        "/auth/login",
        json={"email": "dave@example.com", "password": "Password123!"},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


async def test_login_wrong_password(client, db_session: AsyncSession):
    await _register(client, "erin@example.com")
    resp = await client.post(
        "/auth/login",
        json={"email": "erin@example.com", "password": "WrongPassword!"},
    )
    assert resp.status_code == 401, resp.text


async def test_login_unknown_user(client):
    resp = await client.post(
        "/auth/login",
        json={"email": "nobody@example.com", "password": "Password123!"},
    )
    assert resp.status_code == 401, resp.text


async def test_me_endpoint(client, db_session: AsyncSession):
    await _register(client, "frank@example.com")
    login_resp = await client.post(
        "/auth/login",
        json={"email": "frank@example.com", "password": "Password123!"},
    )
    token = login_resp.json()["access_token"]

    resp = await client.get(
        "/auth/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["email"] == "frank@example.com"


async def test_me_unauthenticated(client):
    resp = await client.get("/auth/me")
    assert resp.status_code == 401, resp.text


async def test_logout(client):
    resp = await client.post("/auth/logout")
    assert resp.status_code == 204, resp.text