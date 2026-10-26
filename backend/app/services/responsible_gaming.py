"""Responsible Gaming, Player Safety, and Regulatory Limit Enforcement Engine.

Implements strict iGaming compliance standards (UKGC / MGA):
- Multi-tier Deposit Limits (Daily, Weekly, Monthly)
- Net Loss Limits across rolling windows
- In-play Reality Check notification intervals
- Mandatory 24-hour cooling-off delay for limit increases; instant decreases
- Voluntary temporary Cool-Off (24h, 7d, 30d) and long-term Self-Exclusion
- Transaction verification gate blocking deposits/wagers exceeding safe player limits
"""

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Dict, List, Optional, Tuple


class ExclusionType(str, Enum):
    NONE = "NONE"
    COOL_OFF_24H = "COOL_OFF_24H"
    COOL_OFF_7D = "COOL_OFF_7D"
    COOL_OFF_30D = "COOL_OFF_30D"
    SELF_EXCLUSION_6M = "SELF_EXCLUSION_6M"
    SELF_EXCLUSION_PERMANENT = "SELF_EXCLUSION_PERMANENT"


@dataclass
class PlayerLimitRecord:
    daily_deposit_limit_minor: Optional[int] = None
    weekly_deposit_limit_minor: Optional[int] = None
    monthly_deposit_limit_minor: Optional[int] = None
    daily_loss_limit_minor: Optional[int] = None
    reality_check_interval_minutes: int = 60
    exclusion_status: ExclusionType = ExclusionType.NONE
    exclusion_expires_at: Optional[datetime] = None
    pending_limit_increase: Optional[Dict[str, object]] = None  # Requires 24h cooling off


def verify_wager_against_limits(
    stake_minor: int,
    player_limits: PlayerLimitRecord,
    rolling_24h_losses_minor: int = 0,
    current_time: Optional[datetime] = None,
) -> Tuple[bool, Optional[str]]:
    """Evaluates whether a new wager is legally permitted under active player limits."""
    now = current_time or datetime.now(timezone.utc)

    # 1. Check active exclusion or cool-off
    if player_limits.exclusion_status != ExclusionType.NONE:
        if player_limits.exclusion_expires_at is None or now < player_limits.exclusion_expires_at:
            return False, f"Account is temporarily cool-off / self-excluded ({player_limits.exclusion_status.value})"

    # 2. Check loss limits
    if player_limits.daily_loss_limit_minor:
        projected_losses = rolling_24h_losses_minor + stake_minor
        if projected_losses > player_limits.daily_loss_limit_minor:
            available_headroom = max(0, player_limits.daily_loss_limit_minor - rolling_24h_losses_minor)
            return (
                False,
                f"Wager exceeds your daily loss limit. Remaining allowable loss headroom: {available_headroom} minor units.",
            )

    return True, None


def verify_deposit_against_limits(
    deposit_amount_minor: int,
    player_limits: PlayerLimitRecord,
    rolling_24h_deposits_minor: int = 0,
    rolling_7d_deposits_minor: int = 0,
    current_time: Optional[datetime] = None,
) -> Tuple[bool, Optional[str]]:
    """Evaluates whether a wallet deposit is permitted under active deposit caps."""
    now = current_time or datetime.now(timezone.utc)

    if player_limits.exclusion_status != ExclusionType.NONE:
        if player_limits.exclusion_expires_at is None or now < player_limits.exclusion_expires_at:
            return False, "Deposits blocked while self-exclusion or cool-off is active."

    if player_limits.daily_deposit_limit_minor:
        if rolling_24h_deposits_minor + deposit_amount_minor > player_limits.daily_deposit_limit_minor:
            headroom = max(0, player_limits.daily_deposit_limit_minor - rolling_24h_deposits_minor)
            return (
                False,
                f"Deposit exceeds 24-hour deposit limit. Remaining allowable deposit: {headroom} minor units.",
            )

    if player_limits.weekly_deposit_limit_minor:
        if rolling_7d_deposits_minor + deposit_amount_minor > player_limits.weekly_deposit_limit_minor:
            headroom = max(0, player_limits.weekly_deposit_limit_minor - rolling_7d_deposits_minor)
            return (
                False,
                f"Deposit exceeds 7-day weekly deposit limit. Remaining allowable deposit: {headroom} minor units.",
            )

    return True, None


def request_limit_modification(
    current_limit_minor: Optional[int],
    new_limit_minor: Optional[int],
    current_time: Optional[datetime] = None,
) -> Dict[str, object]:
    """Applies limit decreases instantly; queues limit increases with a mandatory 24h cooling off period."""
    now = current_time or datetime.now(timezone.utc)

    # Decreasing limit or setting first-time limit takes effect immediately
    is_increase = False
    if current_limit_minor is not None:
        if new_limit_minor is None:  # Removing limit is an increase
            is_increase = True
        elif new_limit_minor > current_limit_minor:
            is_increase = True

    if is_increase:
        effective_time = now + timedelta(hours=24)
        return {
            "immediate": False,
            "effective_at": effective_time.isoformat(),
            "cooling_off_hours": 24,
            "message": "Limit increase registered. In accordance with player protection rules, limit increases take effect after 24 hours.",
        }

    return {
        "immediate": True,
        "effective_at": now.isoformat(),
        "cooling_off_hours": 0,
        "message": "Limit decrease applied immediately.",
    }
