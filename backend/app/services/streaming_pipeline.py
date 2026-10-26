"""Real-Time Streaming Pipeline, Server-Sent Events (SSE) & Event Channel Broker.

Provides low-latency multiplexed event streaming for live matchday fixtures:
- Channel subscription broker: `matches:{fixture_id}`, `odds:{league_id}`, `ledger:{wallet_id}`
- RFC 8895 Server-Sent Events (SSE) protocol formatter with incremental Event IDs
- Sliding window replay cache (100 recent events) for reconnection catchup via `Last-Event-ID`
- Periodic keep-alive heartbeats (:keepalive comments) to prevent proxy socket timeouts
- Non-blocking client registration and safe cleanup on socket disconnects
"""

import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timezone
import json
import time
from typing import AsyncGenerator, Dict, List, Optional, Set


@dataclass
class StreamEvent:
    event_id: str
    channel: str
    event_name: str
    data: Dict
    created_at_unix: float = field(default_factory=time.time)

    def to_sse_format(self) -> str:
        """Formats the event into standard SSE text wire protocol."""
        data_str = json.dumps(self.data, separators=(",", ":"))
        return f"id: {self.event_id}\nevent: {self.event_name}\ndata: {data_str}\n\n"


class EventStreamBroker:
    """In-memory multiplexing broker for SSE and real-time client push streams."""

    def __init__(self, replay_buffer_size: int = 100):
        self._subscribers: Dict[str, Set[asyncio.Queue]] = {}
        self._replay_buffer: List[StreamEvent] = []
        self._replay_buffer_size = replay_buffer_size
        self._event_counter = 0
        self._lock = asyncio.Lock()

    async def subscribe(self, channel: str) -> asyncio.Queue:
        """Subscribes an active client queue to a specific topic channel."""
        async with self._lock:
            q: asyncio.Queue = asyncio.Queue(maxsize=250)
            if channel not in self._subscribers:
                self._subscribers[channel] = set()
            self._subscribers[channel].add(q)
            return q

    async def unsubscribe(self, channel: str, q: asyncio.Queue) -> None:
        """Unsubscribes and cleans up a client queue."""
        async with self._lock:
            if channel in self._subscribers:
                self._subscribers[channel].discard(q)
                if not self._subscribers[channel]:
                    del self._subscribers[channel]

    async def publish(self, channel: str, event_name: str, data: Dict) -> StreamEvent:
        """Broadcasts an event to all subscribed client queues and appends to replay cache."""
        async with self._lock:
            self._event_counter += 1
            event = StreamEvent(
                event_id=f"evt-{self._event_counter}",
                channel=channel,
                event_name=event_name,
                data=data,
            )

            # Maintain sliding replay buffer
            self._replay_buffer.append(event)
            if len(self._replay_buffer) > self._replay_buffer_size:
                self._replay_buffer.pop(0)

            # Deliver to channel subscribers
            subscribers = self._subscribers.get(channel, set()).copy()
            for q in subscribers:
                try:
                    q.put_nowait(event)
                except asyncio.QueueFull:
                    # Drop slow consumer gracefully
                    pass

            return event

    def get_missed_events(self, channel: str, last_event_id: str) -> List[StreamEvent]:
        """Fetches missed events for a reconnecting client starting after `last_event_id`."""
        missed: List[StreamEvent] = []
        found_last = False

        for ev in self._replay_buffer:
            if found_last and ev.channel == channel:
                missed.append(ev)
            elif ev.event_id == last_event_id:
                found_last = True

        return missed

    async def stream_generator(
        self,
        channel: str,
        last_event_id: Optional[str] = None,
        heartbeat_interval_sec: float = 15.0,
    ) -> AsyncGenerator[str, None]:
        """Asynchronous generator yielding formatted SSE frames with automatic heartbeats."""
        q = await self.subscribe(channel)
        try:
            # First yield any missed events from replay buffer
            if last_event_id:
                missed = self.get_missed_events(channel, last_event_id)
                for ev in missed:
                    yield ev.to_sse_format()

            # Stream live events with heartbeat timeout
            while True:
                try:
                    event = await asyncio.wait_for(q.get(), timeout=heartbeat_interval_sec)
                    yield event.to_sse_format()
                except asyncio.TimeoutError:
                    # Heartbeat comment to keep socket alive
                    yield ":keepalive\n\n"
        finally:
            await self.unsubscribe(channel, q)


# Global singleton streaming broker
global_stream_broker = EventStreamBroker()
