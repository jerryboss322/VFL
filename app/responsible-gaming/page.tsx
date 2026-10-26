"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { ResponsibleGamingModal } from "@/components/ResponsibleGamingModal";
import { formatMinor } from "@/lib/betslip";

export default function ResponsibleGamingPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [dailyDepositLimitMinor, setDailyDepositLimitMinor] = useState(50000); // 500.00 XTS
  const [current24hDepositsMinor, setCurrent24hDepositsMinor] = useState(12000); // 120.00 XTS
  const [weeklyDepositLimitMinor, setWeeklyDepositLimitMinor] = useState(200000); // 2,000.00 XTS
  const [current7dDepositsMinor, setCurrent7dDepositsMinor] = useState(45000); // 450.00 XTS
  const [dailyLossLimitMinor, setDailyLossLimitMinor] = useState(30000); // 300.00 XTS
  const [current24hLossesMinor, setCurrent24hLossesMinor] = useState(8000); // 80.00 XTS
  const [realityCheckMinutes, setRealityCheckMinutes] = useState(60);
  const [coolOffSuccess, setCoolOffSuccess] = useState<string | null>(null);

  const depositHeadroomMinor = Math.max(0, dailyDepositLimitMinor - current24hDepositsMinor);
  const depositPct = Math.round((current24hDepositsMinor / dailyDepositLimitMinor) * 100);

  const lossHeadroomMinor = Math.max(0, dailyLossLimitMinor - current24hLossesMinor);
  const lossPct = Math.round((current24hLossesMinor / dailyLossLimitMinor) * 100);

  const handleApplyLimits = (limits: {
    dailyDepositMinor?: number;
    weeklyDepositMinor?: number;
    dailyLossMinor?: number;
    realityCheckMinutes: number;
  }) => {
    if (limits.dailyDepositMinor) setDailyDepositLimitMinor(limits.dailyDepositMinor);
    if (limits.weeklyDepositMinor) setWeeklyDepositLimitMinor(limits.weeklyDepositMinor);
    if (limits.dailyLossMinor) setDailyLossLimitMinor(limits.dailyLossMinor);
    setRealityCheckMinutes(limits.realityCheckMinutes);
  };

  const handleActivateCoolOff = (period: string) => {
    setCoolOffSuccess(
      `Cool-off period (${period}) activated. Your wagering and deposit capabilities have been suspended for safety.`
    );
  };

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Safer Gambling Hero Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-950/70 via-neutral-900 to-neutral-950 border border-emerald-700/50 p-6 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono uppercase font-bold tracking-wider">
                  Player Protection &amp; Safety
                </span>
                <span className="text-xs font-mono text-neutral-400">UKGC &amp; MGA Standards</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-neutral-100 tracking-tight">
                Responsible Gaming Center
              </h1>
              <p className="text-xs text-neutral-400 max-w-xl mt-1">
                Virtual football is entertainment. We provide transparent mathematical tools, financial ceilings, and cooling-off periods to ensure you remain in control.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold font-mono text-xs transition-all shadow-md shrink-0"
            >
              ⚙️ Modify Limits
            </button>
          </div>
        </div>

        {coolOffSuccess && (
          <div className="p-3 bg-amber-500/20 border border-amber-500/40 rounded-xl text-xs text-amber-300 font-mono flex items-center justify-between">
            <span>{coolOffSuccess}</span>
            <button
              onClick={() => setCoolOffSuccess(null)}
              className="text-amber-400 hover:text-white text-base leading-none"
            >
              &times;
            </button>
          </div>
        )}

        {/* Active Protection Ceilings Dashboard */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl space-y-5">
          <h2 className="text-sm font-bold text-neutral-100 flex items-center gap-2">
            <span>Active Financial Ceilings &amp; Usage</span>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 border border-emerald-800 px-1.5 py-0.2 rounded">
              Enforced Live
            </span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 24-Hour Deposit Ceiling */}
            <div className="bg-neutral-950/70 border border-neutral-800 rounded-xl p-4 space-y-3 font-mono">
              <div className="flex justify-between items-start text-xs">
                <div>
                  <span className="text-neutral-400 block text-[11px]">24-Hour Deposit Limit</span>
                  <span className="text-base font-bold text-neutral-100">{formatMinor(dailyDepositLimitMinor)}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-neutral-500 block">Remaining Headroom</span>
                  <span className="text-xs font-bold text-emerald-400">{formatMinor(depositHeadroomMinor)}</span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-neutral-500">
                  <span>Deposited: {formatMinor(current24hDepositsMinor)}</span>
                  <span>{depositPct}% Used</span>
                </div>
                <div className="h-2 w-full bg-neutral-900 rounded-full overflow-hidden border border-neutral-800">
                  <div
                    style={{ width: `${depositPct}%` }}
                    className={`h-full rounded-full transition-all duration-500 ${
                      depositPct > 80 ? "bg-rose-500" : "bg-emerald-500"
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Daily Net Loss Ceiling */}
            <div className="bg-neutral-950/70 border border-neutral-800 rounded-xl p-4 space-y-3 font-mono">
              <div className="flex justify-between items-start text-xs">
                <div>
                  <span className="text-neutral-400 block text-[11px]">Daily Net Loss Limit</span>
                  <span className="text-base font-bold text-neutral-100">{formatMinor(dailyLossLimitMinor)}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-neutral-500 block">Remaining Headroom</span>
                  <span className="text-xs font-bold text-amber-400">{formatMinor(lossHeadroomMinor)}</span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-neutral-500">
                  <span>Net Loss: {formatMinor(current24hLossesMinor)}</span>
                  <span>{lossPct}% Reached</span>
                </div>
                <div className="h-2 w-full bg-neutral-900 rounded-full overflow-hidden border border-neutral-800">
                  <div
                    style={{ width: `${lossPct}%` }}
                    className={`h-full rounded-full transition-all duration-500 ${
                      lossPct > 80 ? "bg-rose-500" : "bg-amber-500"
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 text-xs font-mono">
            <div className="bg-neutral-950/50 border border-neutral-800/80 rounded-lg p-2.5">
              <span className="text-[10px] text-neutral-500 block uppercase">Weekly Deposit Cap</span>
              <span className="text-neutral-200 font-bold">{formatMinor(weeklyDepositLimitMinor)}</span>
            </div>
            <div className="bg-neutral-950/50 border border-neutral-800/80 rounded-lg p-2.5">
              <span className="text-[10px] text-neutral-500 block uppercase">Reality Check Alert</span>
              <span className="text-neutral-200 font-bold">Every {realityCheckMinutes} Minutes</span>
            </div>
            <div className="bg-neutral-950/50 border border-neutral-800/80 rounded-lg p-2.5">
              <span className="text-[10px] text-neutral-500 block uppercase">Limit Increase Policy</span>
              <span className="text-emerald-400 font-bold">24-Hour Cooling Off</span>
            </div>
          </div>
        </div>

        {/* Time-Out & Cool-Off Options */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div>
            <h2 className="text-sm font-bold text-neutral-100 flex items-center gap-2">
              <span>Time-Out &amp; Voluntary Cool-Off</span>
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Need a break? Take a temporary time-out to pause your gaming activity. You cannot place wagers or deposit funds during a cool-off.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
            <button
              type="button"
              onClick={() => handleActivateCoolOff("24 Hours")}
              className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-amber-500/50 text-left transition-all space-y-1"
            >
              <span className="font-bold text-amber-400 block">24-Hour Breather</span>
              <p className="text-[11px] text-neutral-400 leading-snug">Quick cool-off pause expiring automatically after 24 hours.</p>
            </button>

            <button
              type="button"
              onClick={() => handleActivateCoolOff("7 Days")}
              className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-amber-500/50 text-left transition-all space-y-1"
            >
              <span className="font-bold text-amber-400 block">7-Day Time-Out</span>
              <p className="text-[11px] text-neutral-400 leading-snug">One week timeout to take a step back and reset.</p>
            </button>

            <button
              type="button"
              onClick={() => handleActivateCoolOff("30 Days")}
              className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-amber-500/50 text-left transition-all space-y-1"
            >
              <span className="font-bold text-amber-400 block">30-Day Extended Break</span>
              <p className="text-[11px] text-neutral-400 leading-snug">One month timeout with formal account lock.</p>
            </button>
          </div>
        </div>

        {/* Support Helplines & Resources */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl space-y-3">
          <h2 className="text-sm font-bold text-neutral-100">Confidential Advice &amp; Free Support</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-neutral-950/60 border border-neutral-800 rounded-xl space-y-1">
              <span className="font-bold text-emerald-400">GamCare UK</span>
              <p className="text-[11px] text-neutral-400">Free 24/7 phone helpline and live confidential web chat.</p>
              <span className="text-[10px] font-mono text-neutral-300 block pt-1">0808 8020 133</span>
            </div>

            <div className="p-3 bg-neutral-950/60 border border-neutral-800 rounded-xl space-y-1">
              <span className="font-bold text-emerald-400">BeGambleAware</span>
              <p className="text-[11px] text-neutral-400">Independent charity providing confidential guidance and self-assessment tools.</p>
              <span className="text-[10px] font-mono text-neutral-300 block pt-1">begambleaware.org</span>
            </div>

            <div className="p-3 bg-neutral-950/60 border border-neutral-800 rounded-xl space-y-1">
              <span className="font-bold text-emerald-400">Gambling Therapy</span>
              <p className="text-[11px] text-neutral-400">Global multilingual support forums and emotional wellness assistance.</p>
              <span className="text-[10px] font-mono text-neutral-300 block pt-1">gamblingtherapy.org</span>
            </div>
          </div>
        </div>
      </div>

      {modalOpen && (
        <ResponsibleGamingModal
          onClose={() => setModalOpen(false)}
          onSaveLimits={handleApplyLimits}
        />
      )}
    </AppShell>
  );
}
