r"""Virtual Player Stock Exchange & Fractional Share Trading Floor Engine.

Allows traders to buy and sell fractional shares of virtual football players:
- Automated Market Maker (AMM) constant-product pricing model ($x \cdot y = k$)
- Matchday dividend yield distribution based on player performance (Rating, Goals, Clean Sheet)
- Instant liquidity and bid/ask spread execution in integer minor units
- Portfolio equity tracking, average cost basis, and realized/unrealized PnL
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Dict, List, Optional, Tuple


@dataclass
class PlayerSharePool:
    player_id: str
    player_name: str
    club_name: str
    position: str
    cash_reserve_minor: int       # Virtual cash in AMM pool
    shares_reserve: int            # Total shares in AMM pool
    total_shares_issued: int
    base_dividend_yield_minor: int = 500  # 5.00 XTS base dividend per share per goal
    spread_pct: float = 1.5               # 1.5% bid-ask spread


@dataclass
class TraderPlayerPosition:
    trader_id: str
    player_id: str
    shares_owned: int
    average_buy_price_minor: int
    total_dividends_earned_minor: int = 0


@dataclass
class TradeExecutionResult:
    success: bool
    side: str  # "BUY" or "SELL"
    shares: int
    price_per_share_minor: int
    total_cost_or_proceeds_minor: int
    new_pool_price_minor: int
    error_message: Optional[str] = None


def get_current_share_price_minor(pool: PlayerSharePool) -> int:
    """Returns the spot price per share in minor units based on AMM pool reserves."""
    if pool.shares_reserve <= 0:
        return 1000  # Default 10.00 XTS minimum
    return int(pool.cash_reserve_minor / pool.shares_reserve)


def execute_share_trade(
    pool: PlayerSharePool,
    trader_position: Optional[TraderPlayerPosition],
    side: str,
    shares_requested: int,
    trader_balance_minor: int,
) -> Tuple[TradeExecutionResult, PlayerSharePool, TraderPlayerPosition]:
    """Executes a BUY or SELL of player shares via Constant Product AMM."""
    if shares_requested <= 0:
        return (
            TradeExecutionResult(False, side, 0, 0, 0, get_current_share_price_minor(pool), "INVALID_QUANTITY"),
            pool,
            trader_position or TraderPlayerPosition("", pool.player_id, 0, 0),
        )

    pos = trader_position or TraderPlayerPosition(
        trader_id="anonymous",
        player_id=pool.player_id,
        shares_owned=0,
        average_buy_price_minor=0,
    )

    k = pool.cash_reserve_minor * pool.shares_reserve

    if side.upper() == "BUY":
        if shares_requested >= pool.shares_reserve:
            return (
                TradeExecutionResult(False, side, 0, 0, 0, get_current_share_price_minor(pool), "INSUFFICIENT_POOL_LIQUIDITY"),
                pool,
                pos,
            )

        new_shares_reserve = pool.shares_reserve - shares_requested
        new_cash_reserve = int(k / new_shares_reserve)
        base_cash_delta = new_cash_reserve - pool.cash_reserve_minor
        total_cost = int(base_cash_delta * (1.0 + pool.spread_pct / 100.0))

        if total_cost > trader_balance_minor:
            return (
                TradeExecutionResult(False, side, 0, 0, 0, get_current_share_price_minor(pool), "INSUFFICIENT_FUNDS"),
                pool,
                pos,
            )

        price_per_share = int(total_cost / shares_requested)

        # Update position
        new_shares_owned = pos.shares_owned + shares_requested
        new_avg_cost = int(
            (pos.shares_owned * pos.average_buy_price_minor + total_cost) / new_shares_owned
        )
        pos.shares_owned = new_shares_owned
        pos.average_buy_price_minor = new_avg_cost

        # Update pool
        pool.shares_reserve = new_shares_reserve
        pool.cash_reserve_minor = new_cash_reserve

        return (
            TradeExecutionResult(
                success=True,
                side="BUY",
                shares=shares_requested,
                price_per_share_minor=price_per_share,
                total_cost_or_proceeds_minor=total_cost,
                new_pool_price_minor=get_current_share_price_minor(pool),
            ),
            pool,
            pos,
        )

    elif side.upper() == "SELL":
        if pos.shares_owned < shares_requested:
            return (
                TradeExecutionResult(False, side, 0, 0, 0, get_current_share_price_minor(pool), "INSUFFICIENT_SHARES_OWNED"),
                pool,
                pos,
            )

        new_shares_reserve = pool.shares_reserve + shares_requested
        new_cash_reserve = int(k / new_shares_reserve)
        base_proceeds = pool.cash_reserve_minor - new_cash_reserve
        net_proceeds = int(base_proceeds * (1.0 - pool.spread_pct / 100.0))

        if net_proceeds <= 0 or net_proceeds > pool.cash_reserve_minor:
            return (
                TradeExecutionResult(False, side, 0, 0, 0, get_current_share_price_minor(pool), "POOL_CASH_EXHAUSTION"),
                pool,
                pos,
            )

        price_per_share = int(net_proceeds / shares_requested)

        # Update position
        pos.shares_owned -= shares_requested
        if pos.shares_owned == 0:
            pos.average_buy_price_minor = 0

        # Update pool
        pool.shares_reserve = new_shares_reserve
        pool.cash_reserve_minor = new_cash_reserve

        return (
            TradeExecutionResult(
                success=True,
                side="SELL",
                shares=shares_requested,
                price_per_share_minor=price_per_share,
                total_cost_or_proceeds_minor=net_proceeds,
                new_pool_price_minor=get_current_share_price_minor(pool),
            ),
            pool,
            pos,
        )

    return (
        TradeExecutionResult(False, side, 0, 0, 0, get_current_share_price_minor(pool), "INVALID_SIDE"),
        pool,
        pos,
    )


def compute_matchday_player_dividends(
    player_position: TraderPlayerPosition,
    goals_scored: int,
    assists_provided: int,
    match_rating: float,  # 0.0 to 10.0
    is_clean_sheet: bool,
    base_yield_minor: int = 500,
) -> int:
    """Calculates total minor dividend payout for a player's share holdings on matchday."""
    if player_position.shares_owned <= 0:
        return 0

    per_share_dividend = 0

    # Goals: 5.00 XTS per goal
    per_share_dividend += goals_scored * base_yield_minor

    # Assists: 2.50 XTS per assist
    per_share_dividend += assists_provided * (base_yield_minor // 2)

    # Clean Sheet bonus for defensive players: 3.00 XTS
    if is_clean_sheet:
        per_share_dividend += int(base_yield_minor * 0.6)

    # Star performance rating bonus (> 8.0 rating)
    if match_rating >= 8.5:
        per_share_dividend += base_yield_minor
    elif match_rating >= 7.5:
        per_share_dividend += base_yield_minor // 2

    total_payout = per_share_dividend * player_position.shares_owned
    player_position.total_dividends_earned_minor += total_payout
    return total_payout
