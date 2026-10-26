"use client";

import React, { useState } from "react";

interface WebhookTesterModalProps {
  onClose: () => void;
  secretKey: string;
}

export function WebhookTesterModal({ onClose, secretKey }: WebhookTesterModalProps) {
  const [eventType, setEventType] = useState<string>("match.goal_scored");
  const [targetUrl, setTargetUrl] = useState<string>("https://webhook.site/demo");
  const [sending, setSending] = useState(false);
  const [responseLog, setResponseLog] = useState<{
    status: number;
    signature: string;
    body: string;
    durationMs: number;
  } | null>(null);

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);

    const now = Math.floor(Date.now() / 1000);
    const mockPayload = {
      id: `evt-${now}-${eventType.replace(".", "-")}`,
      type: eventType,
      created_at: new Date().toISOString(),
      data: {
        fixture_id: "fx-mci-liv-01",
        home_club: "Manchester Blue",
        away_club: "Liverpool Red",
        minute: 68,
        event_type: "GOAL",
        score: "2 - 1",
        scorer: "Erling Haaland",
      },
    };

    const bodyStr = JSON.stringify(mockPayload, null, 2);
    // Simulated delivery with HMAC preview
    setTimeout(() => {
      setResponseLog({
        status: 200,
        signature: `t=${now},v1=e4f8b2c179a6d03487c5512e9b04fcda176328a994ef0a3b2c1598471da6e2bb`,
        body: bodyStr,
        durationMs: 42,
      });
      setSending(false);
    }, 400);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-2xl rounded-xl border border-line bg-graphite p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-accent animate-ping"></span>
            <h3 className="text-base font-bold text-white">Live Webhook Dispatch Simulator</h3>
          </div>
          <button type="button" onClick={onClose} className="text-fog hover:text-white">
            ✕
          </button>
        </div>

        <form onSubmit={handleSendTest} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-mono text-fog uppercase block mb-1">
                Event Type
              </label>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className="w-full rounded bg-line px-3 py-2 text-xs text-white border border-line/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
              >
                <option value="match.goal_scored">match.goal_scored</option>
                <option value="odds.movement_alert">odds.movement_alert</option>
                <option value="var.review_started">var.review_started</option>
                <option value="var.decision_rendered">var.decision_rendered</option>
                <option value="match.full_time">match.full_time</option>
                <option value="bet.settled">bet.settled</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-mono text-fog uppercase block mb-1">
                Target Endpoint URL
              </label>
              <input
                type="url"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                required
                className="w-full rounded bg-line px-3 py-2 text-xs text-white font-mono border border-line/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={sending}
            className="w-full rounded bg-accent px-4 py-2 text-xs font-black text-ink hover:brightness-110 transition shadow-md shadow-accent/20 disabled:opacity-50"
          >
            {sending ? "Signing & Dispatching Payload..." : "Dispatch Signed Test Event"}
          </button>
        </form>

        {responseLog && (
          <div className="space-y-3 pt-2 border-t border-line">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-fog">
                HTTP Status: <strong className="text-emerald-400">{responseLog.status} OK</strong>
              </span>
              <span className="text-fog">Roundtrip: {responseLog.durationMs}ms</span>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-mono text-fog uppercase block">
                Generated Header: X-VFL-Signature-256
              </span>
              <code className="text-[11px] font-mono text-accent block bg-ink/60 p-2 rounded border border-line break-all">
                {responseLog.signature}
              </code>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-mono text-fog uppercase block">Payload Body (JSON)</span>
              <pre className="text-[11px] font-mono text-bone bg-ink/60 p-3 rounded border border-line overflow-x-auto max-h-48">
                {responseLog.body}
              </pre>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-line px-4 py-1.5 text-xs font-bold text-white hover:bg-line/80"
          >
            Close Simulator
          </button>
        </div>
      </div>
    </div>
  );
}
