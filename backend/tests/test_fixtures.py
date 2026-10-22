"""Fixture endpoint tests."""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import seed_match_data


async def test_list_fixtures_empty(client):
    resp = await client.get("/fixtures")
    assert resp.status_code == 200, resp.text
    assert resp.json() == []


async def test_list_fixtures(client, db_session: AsyncSession):
    await seed_match_data(db_session)
    resp = await client.get("/fixtures")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert len(data) == 1
    assert data[0]["status"] == "upcoming"
    assert data[0]["home"]["name"] == "Home United"
    assert data[0]["away"]["name"] == "Away City"
    uuid.UUID(data[0]["id"])


async def test_get_fixture(client, db_session: AsyncSession):
    data = await seed_match_data(db_session)
    resp = await client.get(f"/fixtures/{data['fixture_id']}")
    assert resp.status_code == 200, resp.text
    fx = resp.json()
    assert fx["id"] == str(data["fixture_id"])
    assert fx["home"]["name"] == "Home United"
    assert fx["away"]["name"] == "Away City"


async def test_get_fixture_not_found(client):
    resp = await client.get(f"/fixtures/{uuid.uuid4()}")
    assert resp.status_code == 404, resp.text


async def test_create_fixture(client, db_session: AsyncSession):
    data = await seed_match_data(db_session)
    resp = await client.post(
        "/fixtures",
        json={
            "season_id": str(data["season_id"]),
            "home_club_id": str(data["home_club_id"]),
            "away_club_id": str(data["away_club_id"]),
            "matchday": 2,
            "kickoff_at": "2025-02-01T14:00:00Z",
        },
    )
    assert resp.status_code == 201, resp.text
    fx = resp.json()
    assert fx["matchday"] == 2
    assert fx["home"]["name"] == "Home United"
    assert fx["away"]["name"] == "Away City"
