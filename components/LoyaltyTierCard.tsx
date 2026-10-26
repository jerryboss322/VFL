"use client";

import React from "react";

export interface LoyaltyTierInfo {
  tier: string;
  xp: number;
  cashbackRate: number;
  progressPercentage: number;
  nextTierXp: number;
}

const TIER_COLORS: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  BRONZE: { bg: "from-amber-950/60 to-neutral-900", text: "text-amber-500", border: "border-amber-700/60", glow: "shadow-amber-950/30" },
  SILVER: { bg: "from-slate-800/60 to-neutral-900", text: "text-slate-300", border: "border-slate-500/60", glow: "shadow-slate-800/30" },
  GOLD: { bg: "from-yellow-950/60 to-neutral-900", text: "text-yellow-400", border: "border-yellow-500/60", glow: "shadow-yellow-950/30" },
  PLATINUM: { bg: "from-teal-950/60 to-neutral-900", text: "text-teal-300", border: "border-teal-500/60", glow: "shadow-teal-950/30" },
  DIAMOND: { bg: "from-sky-950/60 to-neutral-900", text: "text-sky-300", border: "border-sky-500/60", glow: "shadow-sky-950/30" },
  MASTER: { bg: "from-purple-950/60 to-neutral-900", text: "text-purple-300", border: "border-purple-500/60", glow: "shadow-purple-950/30" },
};

export function LoyaltyTierCard({ tierInfo }: { tierInfo: LoyaltyTierInfo }) {
  const theme = TIER_COLORS[tierInfo.tier.toUpperCase()] ?? {
    bg: "from-amber-950/60 to-neutral-900",
    text: "text-amber-500",
    border: "border-amber-700/60",
    glow: "shadow-amber-950/30",
  };

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${theme.bg} border ${theme.border} p-6 shadow-xl ${theme.glow}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-2.5 py-0.5 rounded-full font-mono text-xs font-black uppercase tracking-wider bg-black/60 border ${theme.border} ${theme.text}`}>
              VIP {tierInfo.tier}
            </span>
            <span className="text-[11px] font-mono text-neutral-400">
              {(tierInfo.cashbackRate * 100).toFixed(1)}% Active Cashback
            </span>
          </div>
          <h3 className="text-2xl font-black text-neutral-100 font-mono tracking-tight">
            {tierInfo.xp.toLocaleString()} <span className="text-sm font-semibold text-neutral-400">Total XP</span>
          </h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            Earn XP on every wager and daily streak login to unlock higher cashback rates.
          </p>
        </div>

        <div className="bg-black/50 border border-neutral-800 rounded-xl px-4 py-3 min-w-[200px]">
          <div className="flex justify-between text-xs font-mono mb-1.5">
            <span className="text-neutral-400">Next Tier Progress</span>
            <span className={`font-bold ${theme.text}`}>{tierInfo.progressPercentage}%</span>
          </div>
          <div className="h-2 w-full bg-neutral-950 rounded-full overflow-hidden border border-neutral-800">
            <div
              style={{ width: `${tierInfo.progressPercentage}%` }}
              className="h-full bg-amber-400 rounded-full transition-all duration-500"
            />
          </div>
          <span className="text-[10px] font-mono text-neutral-500 block text-right mt-1">
            Target: {tierInfo.nextTierXp.toLocaleString()} XP
          </span>
        </div>
      </div>
    </div>
  );
}
