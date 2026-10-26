"use client";

import React from "react";

interface MatchTacticalDossierProps {
  homeName: string;
  awayName: string;
  homeXg?: number;
  awayXg?: number;
  likelyScore?: string;
  scoreProb?: number;
  expertTip?: {
    market: string;
    selection: string;
    odds: number;
    stars: number;
    rationale: string;
  };
  onAddTipToSlip?: () => void;
}

export function MatchTacticalDossier({
  homeName,
  awayName,
  homeXg = 1.94,
  awayXg = 1.28,
  likelyScore = "2 - 1",
  scoreProb = 15.8,
  expertTip = {
    market: "Both Teams To Score",
    selection: "Yes (BTTS)",
    odds: 1.78,
    stars: 5,
    rationale:
      "Both squads maintain aggressive forward profiles with high probability of mutual goalmouth penetration.",
  },
  onAddTipToSlip,
}: MatchTacticalDossierProps) {
  return (
    <div className="rounded-xl border border-line bg-graphite p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-line/60 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-accent animate-pulse"></span>
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
            AI Tactical Intelligence Dossier
          </h3>
        </div>
        <span className="rounded bg-line px-2 py-0.5 text-[10px] font-mono font-bold text-accent">
          DIXON-COLES xG ENGINE
        </span>
      </div>

      {/* xG Comparison & Most Likely Scoreline */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Home Projected xG */}
        <div className="rounded-lg bg-ink/40 p-3 border border-line/60 text-center">
          <span className="text-[10px] font-mono text-fog uppercase block truncate">{homeName}</span>
          <span className="text-xl font-black text-white font-mono">{homeXg.toFixed(2)}</span>
          <span className="text-[10px] text-accent block font-mono">Projected xG</span>
        </div>

        {/* Most Likely Scoreline */}
        <div className="rounded-lg bg-accent/10 border border-accent/30 p-3 text-center">
          <span className="text-[10px] font-mono text-accent uppercase block">Predictive Scoreline</span>
          <span className="text-xl font-black text-white font-mono">{likelyScore}</span>
          <span className="text-[10px] text-zinc-300 block font-mono">{scoreProb}% Probability</span>
        </div>

        {/* Away Projected xG */}
        <div className="rounded-lg bg-ink/40 p-3 border border-line/60 text-center">
          <span className="text-[10px] font-mono text-fog uppercase block truncate">{awayName}</span>
          <span className="text-xl font-black text-white font-mono">{awayXg.toFixed(2)}</span>
          <span className="text-[10px] text-accent block font-mono">Projected xG</span>
        </div>
      </div>

      {/* Expert Value Tip Recommendation */}
      <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/20 p-4 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-mono font-bold">
              QUANTITATIVE VALUE TIP
            </span>
            <span className="text-amber-400 text-xs tracking-wider">
              {"★".repeat(expertTip.stars)}{"☆".repeat(5 - expertTip.stars)}
            </span>
          </div>

          <span className="text-xs font-mono font-black text-emerald-400">
            Recommended @ {expertTip.odds.toFixed(2)}
          </span>
        </div>

        <div>
          <h4 className="text-sm font-bold text-white">
            {expertTip.market}: <span className="text-accent">{expertTip.selection}</span>
          </h4>
          <p className="mt-1 text-xs text-zinc-300 leading-relaxed font-sans">
            {expertTip.rationale}
          </p>
        </div>

        {onAddTipToSlip && (
          <div className="pt-1 flex justify-end">
            <button
              type="button"
              onClick={onAddTipToSlip}
              className="rounded bg-emerald-500 text-ink px-3 py-1 text-xs font-black hover:brightness-110 transition shadow-sm"
            >
              + Add Tip to Betslip
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
