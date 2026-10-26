"""Developer API, Bot Webhook Dispatcher & Algorithmic Trading Gateway Engine.

Enables algorithmic sports traders to consume streaming match and odds telemetry:
- Cryptographically signed webhook payloads (HMAC-SHA256 with timestamp verification)
- Exponential backoff retry mechanism (4 attempts with jitter)
- Event types: match.kicked_off, match.goal_scored, odds.movement_alert, var.review_started, bet.settled
- Token bucket rate limiter for low-latency algorithmic trading bots
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
import hashlib
import hmac
import json
import time
from typing import Any, Dict, List, Optional, Tuple


class WebhookEventType(str, Enum):
    MATCH_KICKED_OFF = "match.kicked_off"
    MATCH_GOAL_SCORED = "match.goal_scored"
    ODDS_MOVEMENT_ALERT = "odds.movement_alert"
    VAR_REVIEW_STARTED = "var.review_started"
    VAR_DECISION_RENDERED = "var.decision_rendered"
    MATCH_FULL_TIME = "match.full_time"
    BET_SETTLED = "bet.settled"


@dataclass
class WebhookSubscription:
    subscription_id: str
    developer_id: str
    target_url: str
    secret_key: str
    subscribed_events: List[WebhookEventType]
    active: bool = True
    consecutive_failures: int = 0
    max_retries: int = 4


@dataclass
class WebhookDeliveryAttempt:
    delivery_id: str
    subscription_id: str
    event_type: WebhookEventType
    payload_json: str
    signature: str
    attempt_number: int
    status_code: Optional[int]
    success: bool
    error_message: Optional[str]
    delivered_at: str


class TokenBucketRateLimiter:
    """High-performance token bucket rate limiter for algorithmic API endpoints."""

    def __init__(self, capacity: int = 100, refill_rate_per_sec: float = 20.0):
        self.capacity = float(capacity)
        self.refill_rate = refill_rate_per_sec
        self.tokens = float(capacity)
        self.last_refill = time.monotonic()

    def consume(self, tokens_requested: int = 1) -> bool:
        now = time.monotonic()
        elapsed = now - self.last_refill
        self.tokens = min(self.capacity, self.tokens + elapsed * self.refill_rate)
        self.last_refill = now

        if self.tokens >= tokens_requested:
            self.tokens -= tokens_requested
            return True
        return False


def sign_webhook_payload(payload_bytes: bytes, secret_key: str, timestamp_sec: int) -> str:
    """Signs a webhook payload using HMAC-SHA256 with timestamp protection against replay attacks."""
    to_sign = f"t={timestamp_sec}.".encode("utf-8") + payload_bytes
    signature = hmac.new(
        secret_key.encode("utf-8"),
        to_sign,
        hashlib.sha256,
    ).hexdigest()
    return f"t={timestamp_sec},v1={signature}"


def verify_webhook_signature(
    header_val: str,
    payload_bytes: bytes,
    secret_key: str,
    max_drift_seconds: int = 300,
) -> bool:
    """Verifies that an incoming webhook signature is authentic and within the drift window."""
    try:
        parts = dict(item.split("=", 1) for item in header_val.split(","))
        ts = int(parts.get("t", 0))
        sig = parts.get("v1", "")

        now = int(time.time())
        if abs(now - ts) > max_drift_seconds:
            return False

        expected_sig = sign_webhook_payload(payload_bytes, secret_key, ts).split("v1=")[1]
        return hmac.compare_digest(sig, expected_sig)
    except Exception:
        return False


def prepare_webhook_dispatch(
    subscription: WebhookSubscription,
    event_type: WebhookEventType,
    event_data: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    """Constructs a signed dispatch envelope if the subscription matches the event."""
    if not subscription.active:
        return None
    if event_type not in subscription.subscribed_events:
        return None

    now_ts = int(time.time())
    payload = {
        "id": f"evt-{now_ts}-{event_type.value.replace('.', '-')}",
        "type": event_type.value,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "data": event_data,
    }
    payload_bytes = json.dumps(payload, sort_keys=True).encode("utf-8")
    header_sig = sign_webhook_payload(payload_bytes, subscription.secret_key, now_ts)

    return {
        "url": subscription.target_url,
        "headers": {
            "Content-Type": "application/json",
            "User-Agent": "VirtualFootballUniverse-Webhook/2.0",
            "X-VFL-Signature-256": header_sig,
        },
        "payload": payload,
    }


def calculate_retry_backoff_seconds(attempt: int) -> int:
    """Exponential backoff schedule: 1 -> 5s, 2 -> 25s, 3 -> 125s, 4 -> 600s."""
    backoffs = {1: 5, 2: 25, 3: 125, 4: 600}
    return backoffs.get(attempt, 600)
