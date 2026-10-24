"use client";

import React, { useState } from "react";
import { formatMinor } from "@/lib/betslip";

interface Props {
  betId: string;
  stakeMinor: number;
  recordedOdds: number;
  cashoutValueMinor?: number;
  currentOdds?: number;
  cashoutAvailable?: boolean;
  disabled?: boolean;
  onCashOut: (betId: string, percentage: number) => Promise<void>;
}

export function CashoutSlider({
  betId,
  stakeMinor,
  recordedOdds,
  cashoutValueMinor,
  currentOdds,
  cashoutAvailable = true,
  disabled = false,
  onCashOut,
}: Props) {
  const [open, setOpen] = useState(false);
  const [percentage, setPercentage] = useState(100);
  const [loading, setLoading] = useState(false);

  // Dynamic cashout value derived from live odds movement
  const fullCashout = cashoutValueMinor !== undefined
    ? cashoutValueMinor
    : (currentOdds && currentOdds > 0
        ? Math.round((stakeMinor * (recordedOdds / currentOdds)) * 0.92)
        : Math.round(stakeMinor * 0.92));

  const isAvailable = cashoutAvailable && fullCashout > 0;
  const cashoutValue = Math.round(fullCashout * (percentage / 100));
  const cashedStake = Math.round(stakeMinor * (percentage / 100));
  const remainingStake = Math.max(0, stakeMinor - cashedStake);
  const remainingPotentialReturn = Math.round(remainingStake * recordedOdds);
  const isProfit = fullCashout > stakeMinor;

  async function handleConfirm() {
    setLoading(true);
    await onCashOut(betId, percentage);
    setLoading(false);
    setOpen(false);
  }

  if (!open) {
    if (!isAvailable) {
      return (
        <div className="flex items-center gap-1.5 w-full">
          <button
            type="button"
            disabled
            className="flex-1 rounded-control border border-line bg-graphite/40 py-1.5 px-3 font-mono text-[11px] font-semibold text-fog cursor-not-allowed opacity-60"
          >
            🔒 Cash Out Suspended
          </button>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1.5 w-full">
        <button
          type="button"
          disabled={disabled || loading}
          onClick={handleConfirm}
          className={`flex-1 rounded-control border py-1.5 px-3 font-mono text-[11px] font-bold transition-all hover:opacity-90 disabled:opacity-50 ${
            isProfit
              ? "border-win/60 bg-win/20 text-win"
              : "border-accent/60 bg-accent/15 text-accent"
          }`}
        >
          {loading
            ? "Settling Cash Out..."
            : `Cash Out ${formatMinor(fullCashout)}${isProfit ? " (In Profit)" : ""}`}
        </button>
        <button
          type="button"
          disabled={disabled || loading}
          onClick={() => setOpen(true)}
          title="Partial Cash Out Slider"
          aria-label="Open Partial Cash Out Slider"
          className="flex h-[31px] w-[31px] items-center justify-center rounded-control border border-accent/60 bg-accent/15 text-accent hover:bg-accent/25 transition-colors disabled:opacity-50"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
            />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2.5 rounded border border-accent/40 bg-coal/90 p-2.5 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-accent">
          PARTIAL CASH OUT SLIDER
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="font-mono text-[10px] uppercase text-fog hover:text-bone"
        >
          ✕ Cancel
        </button>
      </div>

      {/* Preset Percentage Quick Chips */}
      <div className="grid grid-cols-4 gap-1">
        {[25, 50, 75, 100].map((pct) => (
          <button
            key={pct}
            type="button"
            onClick={() => setPercentage(pct)}
            className={`min-h-[26px] rounded font-mono text-[10px] font-bold transition-all ${
              percentage === pct
                ? "bg-accent text-ink"
                : "bg-graphite text-fog hover:text-bone hover:bg-line"
            }`}
          >
            {pct}%
          </button>
        ))}
      </div>

      {/* Range Slider */}
      <div className="space-y-1">
        <div className="flex justify-between font-mono text-[10px] text-fog">
          <span>25%</span>
          <span className="font-bold text-accent">{percentage}%</span>
          <span>100% (Full)</span>
        </div>
        <input
          type="range"
          min={25}
          max={100}
          step={25}
          value={percentage}
          onChange={(e) => setPercentage(Number(e.target.value))}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-graphite accent-accent"
        />
      </div>

      {/* Payout & Remaining Breakdown */}
      <div className="space-y-1 rounded bg-ink/70 p-2 font-mono text-[10px]">
        <div className="flex justify-between">
          <span className="text-fog">Credited Now:</span>
          <span className="font-bold text-accent">{formatMinor(cashoutValue)}</span>
        </div>
        {percentage < 100 && (
          <>
            <div className="flex justify-between">
              <span className="text-fog">Remaining Stake:</span>
              <span className="text-bone">{formatMinor(remainingStake)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-fog">Potential Return:</span>
              <span className="font-bold text-win">{formatMinor(remainingPotentialReturn)}</span>
            </div>
          </>
        )}
      </div>

      {/* Action Confirmation Button */}
      <button
        type="button"
        disabled={disabled || loading}
        onClick={handleConfirm}
        className="w-full rounded bg-accent py-1.5 font-mono text-xs font-bold uppercase text-ink transition-all hover:bg-accent-gold active:scale-95 disabled:opacity-50"
      >
        {loading
          ? "Settling Cash Out..."
          : `Cash Out ${formatMinor(cashoutValue)} (${percentage}%)`}
      </button>
    </div>
  );
}
