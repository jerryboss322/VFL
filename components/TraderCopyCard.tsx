"use client";

import React, { useState } from "react";
import { formatMinor } from "@/lib/betslip";

export interface MasterTraderData {
  id: string;
  username: string;
  tier: "ROOKIE" | "PRO_SHARP" | "MASTER" | "LEGENDARY";
  roiPct: number;
  winRatePct: number;
  totalProfitMinor: number;
  maxDrawdownPct: number;
  followersCount: number;
  performanceFeePct: number;
  recentPicks: Array<{
    match: string;
    selection: string;
    odds: number;
    result: "WON" | "LOST" | "PENDING";
  }>;
}

interface TraderCopyCardProps {
  trader: MasterTraderData;
  isFollowing?: boolean;
  onSubscribe: (traderId: string, maxStakeMinor: number, mode: "proportional" | "fixed") => void;
  onUnsubscribe?: (traderId: string) => void;
}

export function TraderCopyCard({
  trader,
  isFollowing = false,
  onSubscribe,
  onUnsubscribe,
}: TraderCopyCardProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [stakeMode, setStakeMode] = useState<"proportional" | "fixed">("proportional");
  const [maxStakeMajor, setMaxStakeMajor] = useState<number>(50); // 50 XTS

  const tierColors = {
    LEGENDARY: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    MASTER: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    PRO_SHARP: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    ROOKIE: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  };

  const handleConfirmCopy = (e: React.FormEvent) => {
    e.preventDefault();
    onSubscribe(trader.id, maxStakeMajor * 100, stakeMode);
    setModalOpen(false);
  };

  return (
    <div className="rounded-xl border border-line bg-graphite p-5 shadow-sm space-y-4 hover:border-line/80 transition flex flex-col justify-between">
      <div>
        {/* Header with Avatar & Tier */}
        <div className="flex items-center justify-between gap-3 border-b border-line/60 pb-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-line flex items-center justify-center font-bold text-accent text-sm border border-accent/20">
              {trader.username.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-white">{trader.username}</span>
                <svg className="h-3.5 w-3.5 text-accent" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-[10px] text-fog font-mono">{trader.followersCount} active followers</span>
            </div>
          </div>

          <span className={`rounded px-2 py-0.5 text-[10px] font-mono font-bold border ${tierColors[trader.tier]}`}>
            {trader.tier}
          </span>
        </div>

        {/* Performance Metrics Grid */}
        <div className="grid grid-cols-3 gap-2 py-3 text-center border-b border-line/60">
          <div className="rounded bg-ink/40 p-2">
            <span className="text-[10px] font-mono text-fog uppercase block">All-Time ROI</span>
            <span className="text-sm font-bold text-emerald-400 font-mono">+{trader.roiPct}%</span>
          </div>
          <div className="rounded bg-ink/40 p-2">
            <span className="text-[10px] font-mono text-fog uppercase block">Win Rate</span>
            <span className="text-sm font-bold text-white font-mono">{trader.winRatePct}%</span>
          </div>
          <div className="rounded bg-ink/40 p-2">
            <span className="text-[10px] font-mono text-fog uppercase block">Net Profit</span>
            <span className="text-sm font-bold text-accent font-mono">{formatMinor(trader.totalProfitMinor)} XTS</span>
          </div>
        </div>

        {/* Recent Picks Feed */}
        <div className="mt-3 space-y-2">
          <span className="text-[10px] font-mono text-fog uppercase block">Recent Wagers</span>
          <div className="space-y-1">
            {trader.recentPicks.map((pick, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs rounded bg-ink/30 px-2 py-1">
                <span className="text-bone font-medium truncate max-w-[150px]">{pick.selection}</span>
                <div className="flex items-center gap-2">
                  <span className="text-fog font-mono">@{pick.odds.toFixed(2)}</span>
                  <span
                    className={`rounded px-1 text-[9px] font-mono font-bold ${
                      pick.result === "WON"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : pick.result === "LOST"
                        ? "bg-red-500/20 text-red-400"
                        : "bg-blue-500/20 text-blue-400"
                    }`}
                  >
                    {pick.result}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Action CTA */}
      <div className="pt-2">
        {isFollowing ? (
          <button
            type="button"
            onClick={() => onUnsubscribe && onUnsubscribe(trader.id)}
            className="w-full rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-500/20 transition"
          >
            Stop Copying Trader
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="w-full rounded-lg bg-accent text-ink px-4 py-2 text-xs font-black hover:brightness-110 transition shadow-md shadow-accent/20"
          >
            Auto-Copy Wagers ({trader.performanceFeePct}% Fee)
          </button>
        )}
      </div>

      {/* Subscription Configuration Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-line bg-graphite p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="text-base font-bold text-white">Mirror {trader.username}</h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-fog hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmCopy} className="space-y-4">
              <div>
                <label className="text-xs font-mono text-fog uppercase block mb-1.5">
                  Stake Allocation Mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setStakeMode("proportional")}
                    className={`rounded-lg p-2.5 text-xs text-center border font-medium transition ${
                      stakeMode === "proportional"
                        ? "bg-accent text-ink border-accent font-bold"
                        : "bg-line text-fog border-transparent hover:text-white"
                    }`}
                  >
                    Proportional
                    <span className="text-[10px] block opacity-80 font-normal">Relative to Bankroll</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStakeMode("fixed")}
                    className={`rounded-lg p-2.5 text-xs text-center border font-medium transition ${
                      stakeMode === "fixed"
                        ? "bg-accent text-ink border-accent font-bold"
                        : "bg-line text-fog border-transparent hover:text-white"
                    }`}
                  >
                    Fixed Stake
                    <span className="text-[10px] block opacity-80 font-normal">Same amount every bet</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-mono text-fog uppercase block mb-1.5">
                  Maximum Stake Ceiling per Bet (XTS)
                </label>
                <input
                  type="number"
                  min="5"
                  max="1000"
                  value={maxStakeMajor}
                  onChange={(e) => setMaxStakeMajor(Number(e.target.value))}
                  className="w-full rounded bg-line px-3 py-2 text-sm text-white font-mono border border-line/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                />
              </div>

              <div className="rounded-lg bg-ink/50 p-3 text-[11px] text-fog space-y-1 border border-line/60">
                <div className="flex justify-between">
                  <span>Performance Fee (on profits only):</span>
                  <span className="text-white font-bold">{trader.performanceFeePct}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Max Allowable Odds Slippage:</span>
                  <span className="text-white font-bold">5.0%</span>
                </div>
                <p className="pt-1 text-[10px] text-zinc-400 leading-normal">
                  You only pay the {trader.performanceFeePct}% fee on winning bets. If a mirrored bet loses or draws, zero fees are deducted.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded bg-line px-4 py-2 text-xs font-bold text-white hover:bg-line/80"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded bg-accent px-5 py-2 text-xs font-black text-ink hover:brightness-110 shadow-md shadow-accent/20"
                >
                  Confirm Auto-Copy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
