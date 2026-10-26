"use client";

import React, { useState } from "react";
import { formatMinor } from "@/lib/betslip";
import type { Bet } from "@/types/api";

interface AutoCashoutModalProps {
  bet: Bet;
  onClose: () => void;
  onSaveRule: (betId: string, rule: { takeProfitMinor?: number; stopLossMinor?: number; partialPercent: number }) => void;
}

export function AutoCashoutModal({ bet, onClose, onSaveRule }: AutoCashoutModalProps) {
  const [takeProfitMajor, setTakeProfitMajor] = useState<string>(
    String(Math.round(((bet.stakeMinor * Number(bet.recordedOdds)) * 0.8) / 100))
  );
  const [enableStopLoss, setEnableStopLoss] = useState<boolean>(false);
  const [stopLossMajor, setStopLossMajor] = useState<string>(
    String(Math.round((bet.stakeMinor * 0.4) / 100))
  );
  const [partialPercent, setPartialPercent] = useState<number>(100);
  const [saving, setSaving] = useState<boolean>(false);

  const potentialMaxReturnMinor = Math.round(bet.stakeMinor * Number(bet.recordedOdds));

  const handleSave = () => {
    setSaving(true);
    const tpMinor = takeProfitMajor ? Math.round(Number(takeProfitMajor) * 100) : undefined;
    const slMinor = enableStopLoss && stopLossMajor ? Math.round(Number(stopLossMajor) * 100) : undefined;

    onSaveRule(bet.id, {
      takeProfitMinor: tpMinor,
      stopLossMinor: slMinor,
      partialPercent,
    });
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 space-y-4 p-5">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div>
            <h3 className="font-bold text-neutral-100 text-sm flex items-center gap-2">
              <span>Automated Cashout Rule</span>
              <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.2 rounded">
                Risk Engine
              </span>
            </h3>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Lock in guaranteed profits or establish stop-loss floors automatically.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-100 text-lg leading-none"
          >
            &times;
          </button>
        </div>

        {/* Wager Summary */}
        <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3 text-xs font-mono space-y-1">
          <div className="flex justify-between text-neutral-400">
            <span>Original Stake:</span>
            <span className="text-neutral-200">{formatMinor(bet.stakeMinor)}</span>
          </div>
          <div className="flex justify-between text-neutral-400">
            <span>Potential Return:</span>
            <span className="text-emerald-400 font-bold">{formatMinor(potentialMaxReturnMinor)}</span>
          </div>
        </div>

        {/* Take-Profit Target */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <label className="font-semibold text-neutral-200">Take-Profit Target (XTS)</label>
            <span className="text-[10px] font-mono text-emerald-400">Cashout when offer exceeds</span>
          </div>
          <div className="relative">
            <input
              type="number"
              step="1"
              value={takeProfitMajor}
              onChange={(e) => setTakeProfitMajor(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs font-mono text-neutral-100 focus:border-amber-400 focus:outline-none"
              placeholder="e.g. 150"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-neutral-500">
              XTS
            </span>
          </div>
        </div>

        {/* Stop-Loss Protection Floor */}
        <div className="space-y-2 pt-2 border-t border-neutral-800">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-neutral-200 flex items-center gap-2">
              <input
                type="checkbox"
                checked={enableStopLoss}
                onChange={(e) => setEnableStopLoss(e.target.checked)}
                className="accent-amber-400 rounded"
              />
              <span>Enable Stop-Loss Protection</span>
            </label>
            <span className="text-[10px] font-mono text-rose-400">Preserve Bankroll</span>
          </div>

          {enableStopLoss && (
            <div className="relative animate-in fade-in">
              <input
                type="number"
                step="1"
                value={stopLossMajor}
                onChange={(e) => setStopLossMajor(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs font-mono text-neutral-100 focus:border-amber-400 focus:outline-none"
                placeholder="e.g. 30"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-neutral-500">
                XTS
              </span>
            </div>
          )}
        </div>

        {/* Partial Cashout Amount Slider */}
        <div className="space-y-1.5 pt-2 border-t border-neutral-800">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-neutral-300 font-semibold">Cashout Percentage</span>
            <span className="text-amber-400 font-bold">{partialPercent}%</span>
          </div>
          <input
            type="range"
            min={10}
            max={100}
            step={10}
            value={partialPercent}
            onChange={(e) => setPartialPercent(Number(e.target.value))}
            className="w-full accent-amber-400"
          />
          <div className="flex justify-between text-[10px] font-mono text-neutral-500">
            <span>Partial (10%)</span>
            <span>Half (50%)</span>
            <span>Full (100%)</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-mono text-xs font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-mono text-xs font-bold transition-all shadow-md disabled:opacity-50"
          >
            {saving ? "Saving..." : "Set Rule"}
          </button>
        </div>
      </div>
    </div>
  );
}
