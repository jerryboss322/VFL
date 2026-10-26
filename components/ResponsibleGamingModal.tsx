"use client";

import React, { useState } from "react";
import { formatMinor } from "@/lib/betslip";

interface ResponsibleGamingModalProps {
  onClose: () => void;
  onSaveLimits: (limits: {
    dailyDepositMinor?: number;
    weeklyDepositMinor?: number;
    dailyLossMinor?: number;
    realityCheckMinutes: number;
  }) => void;
}

export function ResponsibleGamingModal({ onClose, onSaveLimits }: ResponsibleGamingModalProps) {
  const [dailyDepositMajor, setDailyDepositMajor] = useState("500");
  const [weeklyDepositMajor, setWeeklyDepositMajor] = useState("2000");
  const [dailyLossMajor, setDailyLossMajor] = useState("300");
  const [realityCheckMinutes, setRealityCheckMinutes] = useState(60);
  const [confirmationNotice, setConfirmationNotice] = useState<string | null>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const dDep = dailyDepositMajor ? Math.round(Number(dailyDepositMajor) * 100) : undefined;
    const wDep = weeklyDepositMajor ? Math.round(Number(weeklyDepositMajor) * 100) : undefined;
    const dLoss = dailyLossMajor ? Math.round(Number(dailyLossMajor) * 100) : undefined;

    onSaveLimits({
      dailyDepositMinor: dDep,
      weeklyDepositMinor: wDep,
      dailyLossMinor: dLoss,
      realityCheckMinutes,
    });

    setConfirmationNotice(
      "Limits submitted. Limit decreases take effect immediately. In accordance with player protection rules, any limit increases will take effect after a 24-hour cooling off period."
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-5 space-y-4 animate-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div>
            <h3 className="font-bold text-neutral-100 text-sm flex items-center gap-2">
              <span>Responsible Gaming Controls</span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 border border-emerald-800 px-1.5 py-0.2 rounded">
                Safe Play
              </span>
            </h3>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Set custom spending limits and session alerts to stay in control of your wagering.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-100 text-lg leading-none"
          >
            &times;
          </button>
        </div>

        {confirmationNotice ? (
          <div className="space-y-4 text-xs font-mono">
            <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-xl text-emerald-300">
              {confirmationNotice}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl font-bold transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-3.5 text-xs">
            {/* Daily Deposit Limit */}
            <div className="space-y-1">
              <label className="font-semibold text-neutral-200">24-Hour Deposit Limit (XTS)</label>
              <input
                type="number"
                min="10"
                step="10"
                value={dailyDepositMajor}
                onChange={(e) => setDailyDepositMajor(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs font-mono text-neutral-100 focus:border-amber-400 focus:outline-none"
              />
            </div>

            {/* Weekly Deposit Limit */}
            <div className="space-y-1">
              <label className="font-semibold text-neutral-200">7-Day Weekly Deposit Limit (XTS)</label>
              <input
                type="number"
                min="50"
                step="50"
                value={weeklyDepositMajor}
                onChange={(e) => setWeeklyDepositMajor(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs font-mono text-neutral-100 focus:border-amber-400 focus:outline-none"
              />
            </div>

            {/* Daily Net Loss Limit */}
            <div className="space-y-1">
              <label className="font-semibold text-neutral-200">Daily Net Loss Ceiling (XTS)</label>
              <input
                type="number"
                min="10"
                step="10"
                value={dailyLossMajor}
                onChange={(e) => setDailyLossMajor(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs font-mono text-neutral-100 focus:border-amber-400 focus:outline-none"
              />
            </div>

            {/* Reality Check Interval */}
            <div className="space-y-1">
              <label className="font-semibold text-neutral-200">Reality Check Interval</label>
              <select
                value={realityCheckMinutes}
                onChange={(e) => setRealityCheckMinutes(Number(e.target.value))}
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs font-mono text-neutral-100 focus:border-amber-400 focus:outline-none"
              >
                <option value={30}>Every 30 Minutes</option>
                <option value={60}>Every 60 Minutes (Standard)</option>
                <option value={90}>Every 90 Minutes</option>
              </select>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-mono text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-mono text-xs font-bold transition-all shadow-md"
              >
                Confirm Limits
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
