"""Betting tests: validation, stake reservation, settlement idempotency, ledger consistency."""

from unittest.mock import patch

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bet import Bet
from app.models.fixture import Fixture
from app.models.ledger import LedgerEntry
from app.models.user import User
from app.models.wallet import Wallet
from app.schemas.bet import BetSelectionIn, PlaceBetRequest
from app.services.betting import BettingError, place_bet, settle_bet
from tests.conftest import seed_match_data


async def _auth_headers(token: str):
    return {"Authorization": f"Bearer {token}"}


async def _register_and_login(client, email: str = "bettor@example.com"):
    await client.post(
        "/auth/register",
        json={"email": email, "password": "Password123!", "display_name": "Bettor"},
    )
    resp = await client.post(
        "/auth/login", json={"email": email, "password": "Password123!"}
    )
    return resp.json()["access_token"]


async def test_place_bet_reserves_stake_and_ledger(client, db_session: AsyncSession):
    data = await seed_match_data(db_session)

    result = await db_session.execute(select(User).limit(1))
    user = result.scalar_one()
    result = await db_session.execute(select(Fixture).where(Fixture.id == data["fixture_id"]))
    fixture = result.scalar_one()

    bet = await place_bet(
        db_session,
        user,
        fixture,
        PlaceBetRequest(
            selections=[BetSelectionIn(odds_id="home_win", version=1)],
            stake_minor=5000,
            idempotency_key="bet-1",
        ),
    )
    assert bet["status"] == "pending"
    assert bet["stake_minor"] == 5000
    assert bet["recorded_odds"] == 2.10

    # Wallet: stake reserved
    result = await db_session.execute(select(Wallet).where(Wallet.user_id == user.id))
    wallet = result.scalar_one()
    assert wallet.available_minor == 1000000 - 5000
    assert wallet.reserved_minor == 5000

    # Ledger entries exist
    result = await db_session.execute(
        select(LedgerEntry).where(LedgerEntry.user_id == user.id).order_by(LedgerEntry.created_at)
    )
    entries = result.scalars().all()
    assert any(e.kind == "stake_reserve" for e in entries)
    assert any(e.amount_minor == -5000 for e in entries)


async def test_place_bet_duplicate_idempotency_key(client, db_session: AsyncSession):
    data = await seed_match_data(db_session)

    result = await db_session.execute(select(User).limit(1))
    user = result.scalar_one()
    result = await db_session.execute(select(Fixture).where(Fixture.id == data["fixture_id"]))
    fixture = result.scalar_one()

    await place_bet(
        db_session,
        user,
        fixture,
        PlaceBetRequest(
            selections=[BetSelectionIn(odds_id="home_win", version=1)],
            stake_minor=5000,
            idempotency_key="dup-key",
        ),
    )

    try:
        await place_bet(
            db_session,
            user,
            fixture,
            PlaceBetRequest(
                selections=[BetSelectionIn(odds_id="home_win", version=1)],
                stake_minor=5000,
                idempotency_key="dup-key",
            ),
        )
        pytest.fail("Expected BettingError for duplicate bet")
    except BettingError as e:
        assert e.code == "DUPLICATE_BET"


async def test_place_bet_insufficient_funds(client, db_session: AsyncSession):
    data = await seed_match_data(db_session)

    result = await db_session.execute(select(User).limit(1))
    user = result.scalar_one()
    result = await db_session.execute(select(Fixture).where(Fixture.id == data["fixture_id"]))
    fixture = result.scalar_one()

    # Set wallet to 0 available
    result = await db_session.execute(select(Wallet).where(Wallet.user_id == user.id))
    wallet = result.scalar_one()
    wallet.available_minor = 0
    await db_session.commit()

    try:
        await place_bet(
            db_session,
            user,
            fixture,
            PlaceBetRequest(
                selections=[BetSelectionIn(odds_id="home_win", version=1)],
                stake_minor=5000,
                idempotency_key="poor-bet",
            ),
        )
        pytest.fail("Expected BettingError for insufficient funds")
    except BettingError as e:
        assert e.code == "INSUFFICIENT_FUNDS"


async def test_place_bet_stake_out_of_range(client, db_session: AsyncSession):
    from app.core.config import settings

    data = await seed_match_data(db_session)

    result = await db_session.execute(select(User).limit(1))
    user = result.scalar_one()
    result = await db_session.execute(select(Fixture).where(Fixture.id == data["fixture_id"]))
    fixture = result.scalar_one()

    # Below minimum
    try:
        await place_bet(
            db_session,
            user,
            fixture,
            PlaceBetRequest(
                selections=[BetSelectionIn(odds_id="home_win", version=1)],
                stake_minor=settings.MIN_STAKE_MINOR - 1,
                idempotency_key="low-stake",
            ),
        )
        pytest.fail("Expected BettingError for stake below minimum")
    except BettingError as e:
        assert e.code == "STAKE_OUT_OF_RANGE"

    # Above maximum
    try:
        await place_bet(
            db_session,
            user,
            fixture,
            PlaceBetRequest(
                selections=[BetSelectionIn(odds_id="home_win", version=1)],
                stake_minor=settings.MAX_STAKE_MINOR + 1,
                idempotency_key="high-stake",
            ),
        )
        pytest.fail("Expected BettingError for stake above maximum")
    except BettingError as e:
        assert e.code == "STAKE_OUT_OF_RANGE"


async def test_settle_bet_won(client, db_session: AsyncSession):
    data = await seed_match_data(db_session)

    result = await db_session.execute(select(User).limit(1))
    user = result.scalar_one()
    result = await db_session.execute(select(Fixture).where(Fixture.id == data["fixture_id"]))
    fixture = result.scalar_one()

    bet_dict = await place_bet(
        db_session,
        user,
        fixture,
        PlaceBetRequest(
            selections=[BetSelectionIn(odds_id="home_win", version=1)],
            stake_minor=5000,
            idempotency_key="won-bet",
        ),
    )
    assert bet_dict["status"] == "pending"

    # Fetch the Bet ORM object for settle_bet
    result = await db_session.execute(select(Bet).where(Bet.id == bet_dict["id"]))
    bet = result.scalar_one()

    settled = await settle_bet(db_session, bet, fixture, won=True)
    assert settled["status"] == "won"
    # return = stake * odds = 5000 * 2.10 = 10500
    assert settled["return_minor"] == 10500

    # Wallet: reserved released, winnings credited
    result = await db_session.execute(select(Wallet).where(Wallet.user_id == user.id))
    wallet = result.scalar_one()
    assert wallet.reserved_minor == 0
    assert wallet.available_minor == 1000000 - 5000 + 10500  # 1005500

    # Ledger: settlement_win entry
    result = await db_session.execute(
        select(LedgerEntry).where(LedgerEntry.kind == "settlement_win")
    )
    win_entries = result.scalars().all()
    assert len(win_entries) == 1
    assert win_entries[0].amount_minor == 10500


async def test_settle_bet_lost(client, db_session: AsyncSession):
    data = await seed_match_data(db_session)

    result = await db_session.execute(select(User).limit(1))
    user = result.scalar_one()
    result = await db_session.execute(select(Fixture).where(Fixture.id == data["fixture_id"]))
    fixture = result.scalar_one()

    bet_dict = await place_bet(
        db_session,
        user,
        fixture,
        PlaceBetRequest(
            selections=[BetSelectionIn(odds_id="home_win", version=1)],
            stake_minor=5000,
            idempotency_key="lost-bet",
        ),
    )

    result = await db_session.execute(select(Bet).where(Bet.id == bet_dict["id"]))
    bet = result.scalar_one()

    settled = await settle_bet(db_session, bet, fixture, won=False)
    assert settled["status"] == "lost"
    assert settled["return_minor"] is None

    # Wallet: reserved released, no winnings
    result = await db_session.execute(select(Wallet).where(Wallet.user_id == user.id))
    wallet = result.scalar_one()
    assert wallet.reserved_minor == 0
    assert wallet.available_minor == 1000000 - 5000  # stake forfeited

    # Ledger: settlement_loss entry
    result = await db_session.execute(
        select(LedgerEntry).where(LedgerEntry.kind == "settlement_loss")
    )
    loss_entries = result.scalars().all()
    assert len(loss_entries) == 1
    assert loss_entries[0].amount_minor == 0


async def test_settle_bet_idempotent(client, db_session: AsyncSession):
    data = await seed_match_data(db_session)

    result = await db_session.execute(select(User).limit(1))
    user = result.scalar_one()
    result = await db_session.execute(select(Fixture).where(Fixture.id == data["fixture_id"]))
    fixture = result.scalar_one()

    bet_dict = await place_bet(
        db_session,
        user,
        fixture,
        PlaceBetRequest(
            selections=[BetSelectionIn(odds_id="home_win", version=1)],
            stake_minor=5000,
            idempotency_key="idempotent-bet",
        ),
    )

    result = await db_session.execute(select(Bet).where(Bet.id == bet_dict["id"]))
    bet = result.scalar_one()

    settled1 = await settle_bet(db_session, bet, fixture, won=True)
    settled2 = await settle_bet(db_session, bet, fixture, won=True)
    assert settled1["status"] == settled2["status"] == "won"
    assert settled1["return_minor"] == settled2["return_minor"] == 10500

    # Only one settlement_win ledger entry
    result = await db_session.execute(
        select(LedgerEntry).where(LedgerEntry.kind == "settlement_win")
    )
    assert len(result.scalars().all()) == 1


async def test_ledger_balance_consistency(client, db_session: AsyncSession):
    """Verify wallet balance_after_minor is consistent across ledger entries."""
    data = await seed_match_data(db_session)

    result = await db_session.execute(select(User).limit(1))
    user = result.scalar_one()
    result = await db_session.execute(select(Fixture).where(Fixture.id == data["fixture_id"]))
    fixture = result.scalar_one()

    bet_dict = await place_bet(
        db_session,
        user,
        fixture,
        PlaceBetRequest(
            selections=[BetSelectionIn(odds_id="home_win", version=1)],
            stake_minor=5000,
            idempotency_key="ledger-bet",
        ),
    )

    result = await db_session.execute(select(Bet).where(Bet.id == bet_dict["id"]))
    bet = result.scalar_one()
    await settle_bet(db_session, bet, fixture, won=True)

    result = await db_session.execute(
        select(LedgerEntry).where(LedgerEntry.wallet_id == user.id).order_by(LedgerEntry.created_at)
    )
    entries = result.scalars().all()
    assert len(entries) >= 2  # stake_reserve + settlement_win

    # Final balance_after_minor should equal wallet.available_minor
    result = await db_session.execute(select(Wallet).where(Wallet.user_id == user.id))
    wallet = result.scalar_one()
    assert entries[-1].balance_after_minor == wallet.available_minor


async def test_place_bet_api_endpoint(client, db_session: AsyncSession):
    data = await seed_match_data(db_session)
    token = await _register_and_login(client)

    resp = await client.post(
        "/bets",
        json={
            "selections": [{"odds_id": "home_win", "version": 1}],
            "stake_minor": 5000,
            "idempotency_key": "api-bet-1",
        },
        headers=await _auth_headers(token),
    )
    assert resp.status_code == 201, resp.text
    bet = resp.json()
    assert bet["status"] == "pending"
    assert bet["stake_minor"] == 5000
    assert bet["recorded_odds"] == 2.10


async def test_place_bet_unauthenticated(client, db_session: AsyncSession):
    data = await seed_match_data(db_session)
    resp = await client.post(
        "/bets",
        json={
            "selections": [{"odds_id": "home_win", "version": 1}],
            "stake_minor": 5000,
            "idempotency_key": "no-auth-bet",
        },
    )
    assert resp.status_code == 401, resp.text


async def test_list_bets(client, db_session: AsyncSession):
    data = await seed_match_data(db_session)
    token = await _register_and_login(client)

    await client.post(
        "/bets",
        json={
            "selections": [{"odds_id": "home_win", "version": 1}],
            "stake_minor": 5000,
            "idempotency_key": "list-bet-1",
        },
        headers=await _auth_headers(token),
    )

    resp = await client.get("/bets", headers=await _auth_headers(token))
    assert resp.status_code == 200, resp.text
    bets = resp.json()
    assert len(bets) == 1


async def test_settle_bet_endpoint(client, db_session: AsyncSession):
    data = await seed_match_data(db_session)
    token = await _register_and_login(client)

    place_resp = await client.post(
        "/bets",
        json={
            "selections": [{"odds_id": "home_win", "version": 1}],
            "stake_minor": 5000,
            "idempotency_key": "settle-api-bet",
        },
        headers=await _auth_headers(token),
    )
    bet_id = place_resp.json()["id"]

    resp = await client.post(
        f"/bets/{bet_id}/settle?won=true",
        headers=await _auth_headers(token),
    )
    assert resp.status_code == 200, resp.text
    settled = resp.json()
    assert settled["status"] == "won"


async def test_settle_bet_not_found(client):
    token = await _register_and_login(client)
    import uuid

    resp = await client.post(
        f"/bets/{uuid.uuid4()}/settle?won=true",
        headers=await _auth_headers(token),
    )
    assert resp.status_code == 404, resp.text


async def test_settle_bet_not_yours(client, db_session: AsyncSession):
    data = await seed_match_data(db_session)
    token_a = await _register_and_login(client, "user_a@example.com")
    token_b = await _register_and_login(client, "user_b@example.com")

    place_resp = await client.post(
        "/bets",
        json={
            "selections": [{"odds_id": "home_win", "version": 1}],
            "stake_minor": 5000,
            "idempotency_key": "not-yours-bet",
        },
        headers=await _auth_headers(token_a),
    )
    bet_id = place_resp.json()["id"]

    resp = await client.post(
        f"/bets/{bet_id}/settle?won=true",
        headers=await _auth_headers(token_b),
    )
    assert resp.status_code == 403, resp.text
