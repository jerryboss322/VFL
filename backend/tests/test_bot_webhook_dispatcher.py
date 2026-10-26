"""Unit tests for Developer API, Bot Webhook Dispatcher & Algorithmic Trading Gateway Engine."""

import json
import time
import unittest

from backend.app.services.bot_webhook_dispatcher import (
    TokenBucketRateLimiter,
    WebhookEventType,
    WebhookSubscription,
    calculate_retry_backoff_seconds,
    prepare_webhook_dispatch,
    sign_webhook_payload,
    verify_webhook_signature,
)


class TestBotWebhookDispatcher(unittest.TestCase):
    def setUp(self):
        self.secret = "whsec_test_secret_key_8492019"
        self.payload = b'{"event":"match.goal_scored","home_goals":2}'

    def test_signature_generation_and_verification(self):
        now_ts = int(time.time())
        header = sign_webhook_payload(self.payload, self.secret, now_ts)
        self.assertIn("t=", header)
        self.assertIn(",v1=", header)

        valid = verify_webhook_signature(header, self.payload, self.secret, max_drift_seconds=60)
        self.assertTrue(valid)

    def test_tampered_payload_fails_verification(self):
        now_ts = int(time.time())
        header = sign_webhook_payload(self.payload, self.secret, now_ts)
        tampered_payload = b'{"event":"match.goal_scored","home_goals":3}'

        valid = verify_webhook_signature(header, tampered_payload, self.secret)
        self.assertFalse(valid)

    def test_expired_timestamp_fails_verification(self):
        old_ts = int(time.time()) - 1000  # 1000s in the past
        header = sign_webhook_payload(self.payload, self.secret, old_ts)

        valid = verify_webhook_signature(header, self.payload, self.secret, max_drift_seconds=300)
        self.assertFalse(valid)

    def test_prepare_webhook_dispatch_filtering(self):
        sub = WebhookSubscription(
            subscription_id="sub-1",
            developer_id="dev-quant-fund",
            target_url="https://api.quantfund.test/vfl-hooks",
            secret_key=self.secret,
            subscribed_events=[WebhookEventType.MATCH_GOAL_SCORED],
        )

        # Matched event
        dispatch = prepare_webhook_dispatch(
            subscription=sub,
            event_type=WebhookEventType.MATCH_GOAL_SCORED,
            event_data={"fixture_id": "fx-101", "minute": 34, "scorer": "Haaland"},
        )
        self.assertIsNotNone(dispatch)
        self.assertEqual(dispatch["url"], "https://api.quantfund.test/vfl-hooks")
        self.assertIn("X-VFL-Signature-256", dispatch["headers"])

        # Unmatched event -> returns None
        unmatched = prepare_webhook_dispatch(
            subscription=sub,
            event_type=WebhookEventType.VAR_REVIEW_STARTED,
            event_data={},
        )
        self.assertIsNone(unmatched)

    def test_token_bucket_rate_limiter(self):
        limiter = TokenBucketRateLimiter(capacity=5, refill_rate_per_sec=1.0)
        # Consume 5 tokens immediately
        for _ in range(5):
            self.assertTrue(limiter.consume(1))
        # 6th token should fail because bucket is exhausted
        self.assertFalse(limiter.consume(1))

    def test_exponential_backoff_calculation(self):
        self.assertEqual(calculate_retry_backoff_seconds(1), 5)
        self.assertEqual(calculate_retry_backoff_seconds(2), 25)
        self.assertEqual(calculate_retry_backoff_seconds(3), 125)
        self.assertEqual(calculate_retry_backoff_seconds(4), 600)


if __name__ == "__main__":
    unittest.main()
