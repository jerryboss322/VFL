"use client";

import React, { useState } from "react";
import { BotStrategyTester } from "@/components/BotStrategyTester";

const STRATEGY_PRESETS = [
  {
    id: "preset-value-sharp",
    name: "Quantitative Value Sharp",
    description: "Bets when model-derived Expected Value (EV) exceeds market price by at least 4.5%.",
    kellyMultiplier: "0.33 (Third Kelly)",
    targetMarkets: "Asian Handicap & Over/Under 2.5",
    expectedSharpe: "1.84",
  },
  {
    id: "preset-conservative",
    name: "Conservative Bankroll Guard",
    description: "Caps maximum exposure to 2.0% per match with strict 0.25x Quarter Kelly scaling.",
    kellyMultiplier: "0.25 (Quarter Kelly)",
    targetMarkets: "1X2 & Double Chance",
    expectedSharpe: "2.12",
  },
  {
    id: "preset-arbitrage",
    name: "High-Frequency Synthetic Arbitrage",
    description: "Exploits transient cross-book price imbalances to lock in guaranteed risk-free margins.",
    kellyMultiplier: "Proportional Inversion",
    targetMarkets: "Both Teams To Score & 1X2",
    expectedSharpe: "3.45",
  },
];

export default function BotStudioPage() {
  const [selectedPreset, setSelectedPreset] = useState<string>("preset-value-sharp");

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-accent animate-pulse"></span>
            <span className="text-xs font-mono font-bold tracking-wider text-accent uppercase">
              Algorithmic Strategy Lab
            </span>
          </div>
          <h1 className="mt-1 text-2xl md:text-3xl font-extrabold text-white">
            Bot Trading Studio & Backtester
          </h1>
          <p className="mt-1 text-sm text-fog max-w-2xl">
            Design, calibrate, and backtest algorithmic sports betting strategies. Calculate fractional
            Kelly bankroll sizing, scan for cross-market synthetic arbitrage, and simulate historical performance.
          </p>
        </div>

        {/* Global Strategy Engine Pill */}
        <div className="flex items-center gap-3 bg-graphite border border-line rounded-lg px-4 py-2 self-start md:self-auto shadow-sm">
          <div className="text-center">
            <span className="text-[10px] uppercase font-mono text-fog block">Execution Mode</span>
            <span className="text-xs font-bold text-accent font-mono">SUB-50MS API</span>
          </div>
          <div className="h-8 w-px bg-line"></div>
          <div className="text-center">
            <span className="text-[10px] uppercase font-mono text-fog block">Max Sizing</span>
            <span className="text-base font-bold text-white font-mono">5% Cap</span>
          </div>
        </div>
      </div>

      {/* Preset Strategy Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {STRATEGY_PRESETS.map((p) => {
          const isSelected = p.id === selectedPreset;

          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedPreset(p.id)}
              className={`rounded-xl p-5 border text-left transition flex flex-col justify-between space-y-3 ${
                isSelected
                  ? "bg-accent/15 border-accent shadow-md shadow-accent/10"
                  : "bg-graphite border-line hover:border-line/80 hover:bg-line/20"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <h3 className={`text-sm font-bold ${isSelected ? "text-white" : "text-bone"}`}>
                    {p.name}
                  </h3>
                  <span className="text-[10px] font-mono text-accent">Sharpe: {p.expectedSharpe}</span>
                </div>
                <p className="mt-1 text-xs text-fog leading-relaxed">{p.description}</p>
              </div>

              <div className="border-t border-line/40 pt-2 text-[11px] font-mono text-fog flex items-center justify-between">
                <span>{p.kellyMultiplier}</span>
                <span className="text-bone">{p.targetMarkets}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Interactive Backtester & Kelly Calculator */}
      <BotStrategyTester />

      {/* Algorithmic Risk Rules Footer */}
      <div className="rounded-xl border border-line bg-graphite p-6 space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
          Algorithmic Trading Rules & Risk Controls
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-fog leading-relaxed">
          <div className="space-y-1 rounded-lg bg-ink/40 p-3 border border-line/60">
            <h4 className="font-bold text-bone">1. Fractional Kelly Defense</h4>
            <p>
              Full Kelly staking maximizes bankroll growth in the limit, but produces extreme volatility.
              Using 0.25x to 0.50x fractional Kelly retains ~80% of growth while reducing drawdown risk by 75%.
            </p>
          </div>
          <div className="space-y-1 rounded-lg bg-ink/40 p-3 border border-line/60">
            <h4 className="font-bold text-bone">2. Maximum Velocity Ceiling</h4>
            <p>
              Automated orders are bounded by our token bucket rate limiter (100 req/sec) to prevent runaway
              infinite loops or duplicate stake submissions.
            </p>
          </div>
          <div className="space-y-1 rounded-lg bg-ink/40 p-3 border border-line/60">
            <h4 className="font-bold text-bone">3. Idempotency Guarantees</h4>
            <p>
              Every algorithmic order must include a unique UUIDv4 idempotency key. Network retries are
              safely de-duplicated by the core ledger without double-charging your wallet.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
