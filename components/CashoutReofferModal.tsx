"use client";

import React, { useState, useEffect } from "react";
import { formatMinor } from "@/lib/betslip";
import { playCashOutSound } from "@/lib/sound";

export type SlippagePreference = "ACCEPT_HIGHER_ONLY" | "ACCEPT_ALL_CHANGES" | "ACCEPT_EXACT";

interface CashoutReofferModalProps {
  isOpen: boolean;
  onClose: () => void;
  betId: string;
  initialOfferMinor: number;
  originalStakeMinor: number;
  maxReturnMinor: number;
  onConfirmCashout: (betId: string, percentage: number, executionMinor: number) => Promise<void>;
}

export function CashoutReofferModal({
  isOpen,
  onClose,
  betId,
  initialOfferMinor,
  originalStakeMinor,
  maxReturnMinor,
  onConfirmCashout,
}: CashoutReofferModalProps) {
  const [currentOfferMinor, setCurrentOfferMinor] = useState(initialOfferMinor);
  const [cashoutPct, setCashoutPct] = useState(100);
  const [slippageMode, setSlippageMode] = useState<SlippagePreference>("ACCEPT_HIGHER_ONLY");
  const [isPriceChanged, setIsPriceChanged] = useState(false);
  const [priceChangeDeltaMinor, setPriceChangeDeltaMinor] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [takeProfitMajor, setTakeProfitMajor] = useState<number>(
    Math.round((maxReturnMinor * 0.8) / 100)
  );
  const [stopLossMajor, setStopLossMajor] = useState<number>(
    Math.round((originalStakeMinor * 0.5) / 100)
  );
  const [autoCashoutEnabled, setAutoCashoutEnabled] = useState(false);

  // Sync initial offer when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentOfferMinor(initialOfferMinor);
      setIsPriceChanged(false);
      setPriceChangeDeltaMinor(0);
    }
  }, [isOpen, initialOfferMinor]);

  // Simulate in-play price fluctuation every few seconds
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      // 30% chance of price drift in play
      if (Math.random() < 0.35) {
        const driftPct = (Math.random() * 0.08 - 0.04); // -4% to +4%
        const delta = Math.round(initialOfferMinor * driftPct);
        const newOffer = Math.max(100, initialOfferMinor + delta);

        if (newOffer !== currentOfferMinor) {
          setPriceChangeDeltaMinor(newOffer - currentOfferMinor);
          setCurrentOfferMinor(newOffer);
          setIsPriceChanged(true);
        }
      }
    }, 4500);

    return () => clearInterval(interval);
  }, [isOpen, initialOfferMinor, currentOfferMinor]);

  if (!isOpen) return null;

  const partialOfferMinor = Math.round((currentOfferMinor * cashoutPct) / 100);
  const partialStakeMinor = Math.round((originalStakeMinor * cashoutPct) / 100);
  const remainingStakeMinor = originalStakeMinor - partialStakeMinor;

  const handleExecute = async () => {
    setIsSubmitting(true);
    playCashOutSound();
    await onConfirmCashout(betId, cashoutPct, partialOfferMinor);
    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-accent">
              In-Play Risk Engine
            </span>
            <h3 className="text-lg font-bold text-white">Cash Out Slippage Protection</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/40 hover:bg-white/5 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Live Offer Highlight Card */}
        <div className="rounded-xl border border-white/10 bg-slate-950 p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-white/50">
            <span>Current Real-Time Offer:</span>
            <span>Original Stake: {formatMinor(originalStakeMinor)}</span>
          </div>

          <div className="flex items-baseline justify-between">
            <div className="font-mono text-3xl font-black text-emerald-400">
              {formatMinor(partialOfferMinor)}
            </div>
            {isPriceChanged && (
              <span
                className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${
                  priceChangeDeltaMinor > 0
                    ? "bg-emerald-500/20 text-emerald-300 animate-pulse"
                    : "bg-rose-500/20 text-rose-300 animate-pulse"
                }`}
              >
                {priceChangeDeltaMinor > 0 ? `+${formatMinor(priceChangeDeltaMinor)}` : formatMinor(priceChangeDeltaMinor)}
              </span>
            )}
          </div>

          <div className="flex justify-between text-[11px] text-white/40 pt-1 border-t border-white/5">
            <span>Max Potential Return: {formatMinor(maxReturnMinor)}</span>
            <span>{cashoutPct}% Cashout</span>
          </div>
        </div>

        {/* Price Change Warning Alert */}
        {isPriceChanged && priceChangeDeltaMinor < 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
            <strong>Price Moved In-Play:</strong> The offer has shifted from{" "}
            {formatMinor(currentOfferMinor - priceChangeDeltaMinor)} to {formatMinor(currentOfferMinor)}.
            Review and confirm below.
          </div>
        )}

        {/* Partial Cashout Slider */}
        <div>
          <div className="flex justify-between text-xs font-semibold text-white/80 mb-2">
            <span>Partial Cash Out Split:</span>
            <span className="font-mono text-emerald-400">{cashoutPct}%</span>
          </div>
          <input
            type="range"
            min="10"
            max="100"
            step="10"
            value={cashoutPct}
            onChange={(e) => setCashoutPct(Number(e.target.value))}
            className="w-full accent-emerald-500 cursor-pointer"
          />
          <div className="mt-1 flex justify-between text-[10px] text-white/40">
            <span>10% (Leave 90% Running)</span>
            <span>100% (Full Cashout)</span>
          </div>
          {cashoutPct < 100 && (
            <p className="mt-1.5 text-[11px] text-white/50">
              Remaining active stake in play: <strong className="text-white">{formatMinor(remainingStakeMinor)}</strong>
            </p>
          )}
        </div>

        {/* Slippage Mode Preferences */}
        <div>
          <label className="block text-xs font-semibold text-white/80 mb-2">
            Execution Slippage Mode:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <button
              type="button"
              onClick={() => setSlippageMode("ACCEPT_HIGHER_ONLY")}
              className={`rounded-xl border p-2.5 text-left transition-all ${
                slippageMode === "ACCEPT_HIGHER_ONLY"
                  ? "border-emerald-500 bg-emerald-500/15 text-white ring-1 ring-emerald-500/40"
                  : "border-white/5 bg-slate-950/60 text-white/50 hover:text-white"
              }`}
            >
              <div className="font-bold">Accept Higher</div>
              <div className="text-[10px] text-white/40 mt-0.5">Auto-reoffer if drops</div>
            </button>

            <button
              type="button"
              onClick={() => setSlippageMode("ACCEPT_ALL_CHANGES")}
              className={`rounded-xl border p-2.5 text-left transition-all ${
                slippageMode === "ACCEPT_ALL_CHANGES"
                  ? "border-emerald-500 bg-emerald-500/15 text-white ring-1 ring-emerald-500/40"
                  : "border-white/5 bg-slate-950/60 text-white/50 hover:text-white"
              }`}
            >
              <div className="font-bold">Accept All</div>
              <div className="text-[10px] text-white/40 mt-0.5">Instant execution</div>
            </button>

            <button
              type="button"
              onClick={() => setSlippageMode("ACCEPT_EXACT")}
              className={`rounded-xl border p-2.5 text-left transition-all ${
                slippageMode === "ACCEPT_EXACT"
                  ? "border-emerald-500 bg-emerald-500/15 text-white ring-1 ring-emerald-500/40"
                  : "border-white/5 bg-slate-950/60 text-white/50 hover:text-white"
              }`}
            >
              <div className="font-bold">Exact Match</div>
              <div className="text-[10px] text-white/40 mt-0.5">&plusmn;1.5% max drift</div>
            </button>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-white/60 hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExecute}
            disabled={isSubmitting}
            className="rounded-xl bg-emerald-500 px-6 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 active:scale-95 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
          >
            {isSubmitting ? "Processing..." : `Confirm Cash Out (${formatMinor(partialOfferMinor)})`}
          </button>
        </div>
      </div>
    </div>
  );
}
