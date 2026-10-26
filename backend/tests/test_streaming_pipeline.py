"""Unit tests for Real-Time Streaming Pipeline & Server-Sent Events (SSE) Broker."""

import asyncio
import unittest

from backend.app.services.streaming_pipeline import (
    EventStreamBroker,
    StreamEvent,
)


class TestStreamingPipeline(unittest.TestCase):
    def test_sse_wire_formatting(self):
        ev = StreamEvent(
            event_id="evt-42",
            channel="matches:fx-101",
            event_name="goal_scored",
            data={"minute": 72, "scorer": "Haaland", "score": "2-1"},
        )
        sse_str = ev.to_sse_format()
        self.assertIn("id: evt-42\n", sse_str)
        self.assertIn("event: goal_scored\n", sse_str)
        self.assertIn('"scorer":"Haaland"', sse_str)
        self.assertTrue(sse_str.endswith("\n\n"))

    def test_broker_publish_and_subscribe(self):
        async def run_test():
            broker = EventStreamBroker(replay_buffer_size=10)
            q = await broker.subscribe("matches:fx-202")

            # Publish event
            published = await broker.publish(
                channel="matches:fx-202",
                event_name="kickoff",
                data={"status": "live"},
            )

            received = await q.get()
            self.assertEqual(received.event_id, published.event_id)
            self.assertEqual(received.event_name, "kickoff")
            self.assertEqual(received.data["status"], "live")

            await broker.unsubscribe("matches:fx-202", q)

        asyncio.run(run_test())

    def test_replay_buffer_missed_events(self):
        async def run_test():
            broker = EventStreamBroker(replay_buffer_size=10)
            ev1 = await broker.publish("ch-1", "tick", {"c": 1})
            ev2 = await broker.publish("ch-1", "tick", {"c": 2})
            ev3 = await broker.publish("ch-1", "tick", {"c": 3})

            # Reconnecting with Last-Event-ID = ev1.event_id
            missed = broker.get_missed_events("ch-1", ev1.event_id)
            self.assertEqual(len(missed), 2)
            self.assertEqual(missed[0].event_id, ev2.event_id)
            self.assertEqual(missed[1].event_id, ev3.event_id)

        asyncio.run(run_test())


if __name__ == "__main__":
    unittest.main()
