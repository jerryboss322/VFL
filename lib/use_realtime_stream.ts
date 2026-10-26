/**
 * Client-Side Real-Time Streaming Hook & Reconnection Manager.
 *
 * Connects to the backend EventStreamBroker over Server-Sent Events (SSE):
 * - Exponential backoff reconnection with jitter (1s -> 2s -> 4s -> max 30s)
 * - Automatic `Last-Event-ID` restoration to recover dropped packets during network hiccups
 * - Activity watchdog timeout (detects silent socket drops if no heartbeat in 35s)
 * - Connection lifecycle state machine (CONNECTING | OPEN | RECONNECTING | CLOSED)
 */

import { useEffect, useRef, useState, useCallback } from "react";

export type StreamConnectionStatus = "CONNECTING" | "OPEN" | "RECONNECTING" | "CLOSED";

export interface StreamMessage<T = unknown> {
  id: string;
  channel: string;
  event: string;
  data: T;
  receivedAt: number;
}

export interface UseRealtimeStreamOptions<T> {
  enabled?: boolean;
  onMessage?: (message: StreamMessage<T>) => void;
  maxReconnectDelayMs?: number;
}

export function calculateBackoffMs(attempt: number, maxDelayMs = 30000): number {
  const base = Math.min(maxDelayMs, 1000 * Math.pow(1.8, attempt));
  const jitter = base * (0.8 + Math.random() * 0.4);
  return Math.floor(jitter);
}

export function useRealtimeStream<T = unknown>(
  channel: string,
  options?: UseRealtimeStreamOptions<T>
) {
  const enabled = options?.enabled ?? true;
  const onMessage = options?.onMessage;
  const maxDelay = options?.maxReconnectDelayMs ?? 30000;

  const [status, setStatus] = useState<StreamConnectionStatus>("CLOSED");
  const [lastEvent, setLastEvent] = useState<StreamMessage<T> | null>(null);
  const [reconnectCount, setReconnectCount] = useState(0);

  const lastEventIdRef = useRef<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const watchdogTimerRef = useRef<NodeJS.Timeout | null>(null);
  const attemptRef = useRef(0);

  const resetWatchdog = useCallback(() => {
    if (watchdogTimerRef.current) clearTimeout(watchdogTimerRef.current);
    // If no message or keepalive received within 35 seconds, consider socket dead
    watchdogTimerRef.current = setTimeout(() => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        setStatus("RECONNECTING");
      }
    }, 35000);
  }, []);

  const connect = useCallback(() => {
    if (typeof window === "undefined" || !enabled || !channel) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setStatus(attemptRef.current === 0 ? "CONNECTING" : "RECONNECTING");

    const qs = new URLSearchParams();
    qs.set("channel", channel);
    if (lastEventIdRef.current) {
      qs.set("lastEventId", lastEventIdRef.current);
    }

    try {
      const url = `/api/stream?${qs.toString()}`;
      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.onopen = () => {
        setStatus("OPEN");
        attemptRef.current = 0;
        resetWatchdog();
      };

      es.onmessage = (event) => {
        resetWatchdog();
        try {
          const parsed = JSON.parse(event.data);
          const msg: StreamMessage<T> = {
            id: event.lastEventId || `msg-${Date.now()}`,
            channel,
            event: event.type || "message",
            data: parsed,
            receivedAt: Date.now(),
          };

          if (event.lastEventId) {
            lastEventIdRef.current = event.lastEventId;
          }

          setLastEvent(msg);
          if (onMessage) onMessage(msg);
        } catch {
          // Ignore parse errors (e.g. raw keepalive comments)
        }
      };

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;
        setStatus("RECONNECTING");
        setReconnectCount((c) => c + 1);

        attemptRef.current += 1;
        const delay = calculateBackoffMs(attemptRef.current, maxDelay);
        reconnectTimeoutRef.current = setTimeout(connect, delay);
      };
    } catch {
      setStatus("CLOSED");
    }
  }, [channel, enabled, maxDelay, onMessage, resetWatchdog]);

  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      setStatus("CLOSED");
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (watchdogTimerRef.current) clearTimeout(watchdogTimerRef.current);
    };
  }, [connect, enabled]);

  return {
    status,
    lastEvent,
    reconnectCount,
    lastEventId: lastEventIdRef.current,
  };
}
