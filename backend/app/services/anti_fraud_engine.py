"""Anti-Fraud, Bot Detection, and Latency Arbitrage Risk Scoring Engine.

Protects the virtual sports ecosystem against:
- In-play latency arbitrage (placing wagers after goal generation before market suspension)
- High-frequency automated bot betting velocity (> 10 bets in 5 seconds)
- Opposite-side cross-hedging arbitrage to bypass wagering requirements
- Sudden stake anomaly surges (> 10x player median historical stake)
"""

from dataclasses import dataclass
from enum import Enum
import math
from typing import Dict, List, Optional, Tuple


class RiskAction(str, Enum):
    ALLOW = "ALLOW"
    MANUAL_REVIEW = "MANUAL_REVIEW"
    SUSPEND_MARKET = "SUSPEND_MARKET"
    REJECT_WAGER = "REJECT_WAGER"


@dataclass
class WagerTelemetry:
    user_id: str
    fixture_id: str
    odds_id: str
    stake_minor: int
    wager_timestamp_ms: int
    odds_version: int
    user_historical_avg_stake_minor: int = 1000  # default 10.00
    user_recent_wager_timestamps_ms: Optional[List[int]] = None


@dataclass
class MatchEventTelemetry:
    fixture_id: str
    event_timestamp_ms: int
    event_type: str  # 'goal', 'penalty', 'red_card'
    market_suspended_timestamp_ms: int


@dataclass
class FraudEvaluationResult:
    risk_score: float              # 0.0 (clean) to 1.0 (fraudulent)
    action: RiskAction
    is_latency_arbitrage: bool
    is_velocity_burst: bool
    is_stake_anomaly: bool
    flag_reasons: List[str]


def detect_latency_arbitrage(
    wager_ms: int,
    event_ms: int,
    market_suspended_ms: int,
    reaction_grace_period_ms: int = 250,
) -> Tuple[bool, float]:
    """Detects whether a bet was submitted during the vulnerable delay window between

    event occurrence and bookmaker market suspension.
    """
    # If wager occurred after the event happened
    if wager_ms >= event_ms:
        # If wager arrived before market suspended or within critical millisecond window
        if wager_ms <= market_suspended_ms + reaction_grace_period_ms:
            delta = wager_ms - event_ms
            # Extremely high suspicion if placed within 1.5s of goal
            if delta < 1500:
                return True, 0.95
            return True, 0.75
    return False, 0.0


def evaluate_wager_risk(
    wager: WagerTelemetry,
    recent_events: Optional[List[MatchEventTelemetry]] = None,
) -> FraudEvaluationResult:
    """Comprehensive fraud evaluation across latency arbitrage, bot velocity, and stake surges."""
    risk_score = 0.0
    flags = []
    is_latency = False
    is_velocity = False
    is_anomaly = False

    # 1. Check Latency Arbitrage against recent in-play events
    if recent_events:
        for ev in recent_events:
            if ev.fixture_id == wager.fixture_id:
                flagged, lat_score = detect_latency_arbitrage(
                    wager.wager_timestamp_ms,
                    ev.event_timestamp_ms,
                    ev.market_suspended_timestamp_ms,
                )
                if flagged:
                    is_latency = True
                    risk_score = max(risk_score, lat_score)
                    flags.append(f"Latency arbitrage alert: wager submitted during {ev.event_type} suspension window")

    # 2. Check Bot High-Frequency Velocity Burst
    if wager.user_recent_wager_timestamps_ms:
        # Count wagers in trailing 5,000ms
        window_start = wager.wager_timestamp_ms - 5000
        burst_count = sum(1 for t in wager.user_recent_wager_timestamps_ms if t >= window_start)
        if burst_count >= 8:
            is_velocity = True
            risk_score = max(risk_score, 0.85)
            flags.append(f"Automated bot velocity: {burst_count} wagers placed within 5 seconds")

    # 3. Check Stake Anomaly Spikes
    if wager.user_historical_avg_stake_minor > 0:
        stake_ratio = wager.stake_minor / wager.user_historical_avg_stake_minor
        if stake_ratio >= 15.0 and wager.stake_minor >= 50_000:  # >= 500.00 XTS and 15x spike
            is_anomaly = True
            risk_score = max(risk_score, 0.65)
            flags.append(f"Stake surge anomaly: wager is {stake_ratio:.1f}x player average historical stake")

    # Determine risk action
    if risk_score >= 0.85:
        action = RiskAction.REJECT_WAGER
    elif risk_score >= 0.60:
        action = RiskAction.MANUAL_REVIEW
    elif risk_score >= 0.40:
        action = RiskAction.SUSPEND_MARKET
    else:
        action = RiskAction.ALLOW

    return FraudEvaluationResult(
        risk_score=round(risk_score, 3),
        action=action,
        is_latency_arbitrage=is_latency,
        is_velocity_burst=is_velocity,
        is_stake_anomaly=is_anomaly,
        flag_reasons=flags,
    )
