"use client";

import React, { useState } from "react";
import { WebhookTesterModal } from "@/components/WebhookTesterModal";

export default function DeveloperApiPage() {
  const [apiKey] = useState("vfl_live_8f3a92b10492cda19582049e21");
  const [webhookSecret] = useState("whsec_591a0c4f8205bd7912a48e");
  const [copiedKey, setCopiedKey] = useState(false);
  const [testerOpen, setTesterOpen] = useState(false);
  const [codeTab, setCodeTab] = useState<"python" | "typescript" | "curl">("python");

  const handleCopyKey = () => {
    navigator.clipboard.writeText(apiKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const pythonSnippet = `import hmac
import hashlib
import requests

API_KEY = "${apiKey}"
BASE_URL = "https://vfl-psi.vercel.app/api"

# 1. Fetch live in-play fixtures with real-time decimal odds
response = requests.get(
    f"{BASE_URL}/fixtures",
    headers={"Authorization": f"Bearer {API_KEY}"},
    params={"status": "live"}
)
fixtures = response.json()
print(f"Active Live Fixtures: {len(fixtures)}")

# 2. Place an automated sharp bet with idempotency key
bet_payload = {
    "fixtureId": fixtures[0]["id"],
    "marketKey": "1X2",
    "oddsId": fixtures[0]["odds"]["markets"][0]["options"][0]["oddsId"],
    "stakeMinor": 50000, # 500.00 XTS
    "idempotencyKey": "bot-order-99201"
}
order_res = requests.post(f"{BASE_URL}/bets", json=bet_payload)
print(f"Order Status: {order_res.status_code}")`;

  const tsSnippet = `import axios from 'axios';

const API_KEY = "${apiKey}";
const BASE_URL = "https://vfl-psi.vercel.app/api";

async function runTradingBot() {
  // 1. Fetch live odds feed
  const { data: fixtures } = await axios.get(\`\${BASE_URL}/fixtures?status=live\`, {
    headers: { Authorization: \`Bearer \${API_KEY}\` }
  });

  console.log(\`Monitoring \${fixtures.length} matches...\`);

  // 2. Submit high-frequency algorithmic wager
  const { data: ticket } = await axios.post(\`\${BASE_URL}/bets\`, {
    fixtureId: fixtures[0].id,
    marketKey: "TOTAL_GOALS_25",
    oddsId: "odds-opt-over25",
    stakeMinor: 25000, // 250.00 XTS
    idempotencyKey: crypto.randomUUID()
  });

  console.log(\`Ticket accepted: \${ticket.id}\`);
}
runTradingBot();`;

  const curlSnippet = `# Fetch live fixtures with strict cache-busting
curl -X GET "https://vfl-psi.vercel.app/api/fixtures?status=live" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json"

# Place algorithmic sportsbook ticket
curl -X POST "https://vfl-psi.vercel.app/api/bets" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "fixtureId": "fx-mci-liv-01",
    "marketKey": "1X2",
    "oddsId": "opt-home-win",
    "stakeMinor": 10000,
    "idempotencyKey": "curl-test-001"
  }'`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-accent animate-pulse"></span>
            <span className="text-xs font-mono font-bold tracking-wider text-accent uppercase">
              Algorithmic Trading & Developer Suite
            </span>
          </div>
          <h1 className="mt-1 text-2xl md:text-3xl font-extrabold text-white">
            Developer API & Webhook Gateway
          </h1>
          <p className="mt-1 text-sm text-fog max-w-2xl">
            Low-latency REST endpoints, streaming HMAC-SHA256 event webhooks, and programmatic bet placement
            for algorithmic funds, syndicates, and quant traders.
          </p>
        </div>

        {/* Rate Limit Token Bucket Pill */}
        <div className="flex items-center gap-3 bg-graphite border border-line rounded-lg px-4 py-2 self-start md:self-auto shadow-sm">
          <div className="text-center">
            <span className="text-[10px] uppercase font-mono text-fog block">Rate Limit</span>
            <span className="text-base font-bold text-accent font-mono">100 req/s</span>
          </div>
          <div className="h-8 w-px bg-line"></div>
          <div className="text-center">
            <span className="text-[10px] uppercase font-mono text-fog block">Burst Limit</span>
            <span className="text-base font-bold text-white font-mono">150 max</span>
          </div>
        </div>
      </div>

      {/* API Key Credentials Card */}
      <div className="rounded-xl border border-line bg-graphite p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white">Live Production API Key</h2>
            <p className="text-xs text-fog">Use this key in the Authorization header: Bearer &lt;key&gt;</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyKey}
              className="rounded bg-accent text-ink px-3 py-1.5 text-xs font-black hover:brightness-110 transition shadow-md shadow-accent/20"
            >
              {copiedKey ? "Copied ✓" : "Copy API Key"}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-ink/60 p-3 rounded-lg border border-line font-mono text-xs">
          <code className="text-accent flex-1 truncate">{apiKey}</code>
          <span className="rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold">
            ACTIVE
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px] font-mono text-fog">
          <div>Scope: <strong className="text-white">read:fixtures</strong></div>
          <div>Scope: <strong className="text-white">read:odds</strong></div>
          <div>Scope: <strong className="text-white">write:bets</strong></div>
          <div>Scope: <strong className="text-white">stream:webhooks</strong></div>
        </div>
      </div>

      {/* Webhooks Manager Card */}
      <div className="rounded-xl border border-line bg-graphite p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line/60 pb-3">
          <div>
            <h2 className="text-base font-bold text-white">Webhook Subscriptions</h2>
            <p className="text-xs text-fog">Real-time push notifications signed with HMAC-SHA256</p>
          </div>
          <button
            type="button"
            onClick={() => setTesterOpen(true)}
            className="rounded bg-line px-3 py-1.5 text-xs font-bold text-white hover:bg-line/80 transition"
          >
            Launch Webhook Tester
          </button>
        </div>

        <div className="rounded-lg bg-ink/40 p-4 border border-line/60 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="space-y-1">
              <span className="font-mono text-bone font-bold block truncate max-w-md">
                https://api.quantfund.test/vfl-hooks
              </span>
              <span className="text-fog font-mono text-[10px]">
                Events: match.goal_scored, odds.movement_alert, bet.settled
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-mono font-bold">
                200 OK (0 Failures)
              </span>
            </div>
          </div>

          <div className="text-[11px] font-mono text-fog border-t border-line/40 pt-2 flex items-center justify-between">
            <span>Signing Secret: <code className="text-zinc-300">{webhookSecret}</code></span>
            <span>Tolerance: 300s window</span>
          </div>
        </div>
      </div>

      {/* Interactive Code Integration Sandbox */}
      <div className="rounded-xl border border-line bg-graphite overflow-hidden space-y-0">
        <div className="p-4 border-b border-line bg-charcoal flex items-center justify-between">
          <div className="flex items-center gap-2">
            {(["python", "typescript", "curl"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setCodeTab(tab)}
                className={`rounded px-3 py-1 text-xs font-mono font-bold uppercase transition ${
                  codeTab === tab
                    ? "bg-accent text-ink"
                    : "bg-line text-fog hover:text-white"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <span className="text-[11px] font-mono text-fog">REST API v2.0</span>
        </div>

        <pre className="p-5 bg-ink text-xs font-mono text-bone overflow-x-auto leading-relaxed">
          {codeTab === "python" ? pythonSnippet : codeTab === "typescript" ? tsSnippet : curlSnippet}
        </pre>
      </div>

      {/* Webhook Tester Modal */}
      {testerOpen && (
        <WebhookTesterModal
          onClose={() => setTesterOpen(false)}
          secretKey={webhookSecret}
        />
      )}
    </div>
  );
}
