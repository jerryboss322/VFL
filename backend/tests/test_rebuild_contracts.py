"""Integration tests for rebuilt contracts: camelCase + cookie auth, accumulators, 3-market odds, standings."""

from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import (
    _create_club,
    _create_fixture,
    _create_league,
    _create_season,
    seed_match_data,
)


async def test_cookie_auth_and_camel_case_contracts(client, db_session: AsyncSession):
    await seed_match_data(db_session)

    # Register using camelCase displayName and rely on httpOnly cookie (no Authorization header)
    reg_resp = await client.post(
        "/auth/register",
        json={
            "email": "cookie_user@example.com",
            "password": "Password123!",
            "displayName": "Cookie Bettor",
        },
    )
    assert reg_resp.status_code == 201, reg_resp.text
    user_data = reg_resp.json()
    assert user_data["displayName"] == "Cookie Bettor"
    assert user_data["display_name"] == "Cookie Bettor"
    assert "vfu_session" in reg_resp.cookies

    # Call /auth/me using only the session cookie
    me_resp = await client.get("/auth/me")
    assert me_resp.status_code == 200, me_resp.text
    assert me_resp.json()["displayName"] == "Cookie Bettor"

    # Check wallet and initial_grant transaction in camelCase
    wallet_resp = await client.get("/wallet")
    assert wallet_resp.status_code == 200, wallet_resp.text
    w = wallet_resp.json()
    assert w["availableMinor"] == 1000000
    assert w["reservedMinor"] == 0
    assert w["simulated"] is True

    tx_resp = await client.get("/wallet/transactions")
    assert tx_resp.status_code == 200, tx_resp.text
    txs = tx_resp.json()
    assert len(txs) == 1
    assert txs[0]["kind"] == "initial_grant"
    assert txs[0]["amountMinor"] == 1000000


async def test_three_markets_and_accumulator_bet(client, db_session: AsyncSession):
    league_id = await _create_league(db_session)
    season_id = await _create_season(db_session, league_id)
    c1 = await _create_club(db_session, "Alpha FC", "ALP")
    c2 = await _create_club(db_session, "Beta FC", "BET")
    c3 = await _create_club(db_session, "Gamma FC", "GAM")
    c4 = await _create_club(db_session, "Delta FC", "DEL")

    fx1 = await _create_fixture(db_session, season_id, c1, c2, matchday=1)
    fx2 = await _create_fixture(db_session, season_id, c3, c4, matchday=1)
    await db_session.commit()

    # Fetch auto-generated 3-market odds for both fixtures
    odds1_resp = await client.get(f"/fixtures/{fx1}/odds")
    assert odds1_resp.status_code == 200, odds1_resp.text
    markets1 = odds1_resp.json()["markets"]
    assert {m["key"] for m in markets1} == {
        "match_winner",
        "over_under_2_5",
        "both_teams_to_score",
    }

    odds2_resp = await client.get(f"/fixtures/{fx2}/odds")
    assert odds2_resp.status_code == 200, odds2_resp.text
    markets2 = odds2_resp.json()["markets"]

    sel1_id = markets1[0]["options"][0]["oddsId"]
    sel2_id = markets2[1]["options"][0]["oddsId"]

    await client.post(
        "/auth/register",
        json={
            "email": "acca@example.com",
            "password": "Password123!",
            "displayName": "Acca Player",
        },
    )

    # Duplicate selection on the same match is rejected
    dup_resp = await client.post(
        "/bets",
        json={
            "selections": [
                {"oddsId": markets1[0]["options"][0]["oddsId"], "version": 1},
                {"oddsId": markets1[0]["options"][1]["oddsId"], "version": 1},
            ],
            "stakeMinor": 2000,
            "idempotencyKey": "dup-match-test",
        },
    )
    assert dup_resp.status_code == 409, dup_resp.text
    assert dup_resp.json()["code"] == "DUPLICATE_MATCH_SELECTION"

    # Valid 2-match accumulator succeeds
    acca_resp = await client.post(
        "/bets",
        json={
            "selections": [
                {"oddsId": sel1_id, "version": 1},
                {"oddsId": sel2_id, "version": 1},
            ],
            "stakeMinor": 2000,
            "idempotencyKey": "valid-acca-1",
        },
    )
    assert acca_resp.status_code == 201, acca_resp.text
    acca_bet = acca_resp.json()
    assert len(acca_bet["selections"]) == 2
    assert acca_bet["stakeMinor"] == 2000


async def test_league_table_includes_zero_game_clubs(client, db_session: AsyncSession):
    await seed_match_data(db_session)
    await db_session.commit()

    resp = await client.get("/league/table")
    assert resp.status_code == 200, resp.text
    rows = resp.json()
    assert len(rows) == 2
    assert rows[0]["played"] == 0
    assert rows[0]["club"]["shortName"] in ("HOM", "AWY")
