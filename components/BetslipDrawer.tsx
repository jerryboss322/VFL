"use client";

import Link from "next/link";
import React, { useState } from "react";
import { useApp } from "@/components/AppContext";
import { CashoutSlider } from "@/components/CashoutSlider";
import { api } from "@/lib/api/client";
import { combinedOdds, displayReturnMinor, formatMinor, stakeError } from "@/lib/betslip";
import { playBetPlacedSound, playCashOutSound } from "@/lib/sound";

const QUICK_STAKES_MAJOR = [10, 50, 100, 250];

export function BetslipDrawer() {
  const {
    user,
    wallet,
    openBets,
    slip,
    removeSlipSelection,
    clearSlip,
    setAuthModalOpen,
    notifyBetPlaced,
    refreshAccount,
  } = useApp();

  const [activeTab, setActiveTab] = useState<"slip" | "open">("slip");
  const [stakeMajorInput, setStakeMajorInput] = useState("50");
  const [placing, setPlacing] = useState(false);
  const [refreshingOpen, setRefreshingOpen] = useState(false);
  const [cashingOutId, setCashingOutId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const parsedMajor = Number(stakeMajorInput);
  const stakeMinor = Number.isFinite(parsedMajor) ? Math.round(parsedMajor * 100) : 0;
  const totalOdds = combinedOdds(slip);
  const estReturnMinor = displayReturnMinor(stakeMinor, slip);

  async function handlePlaceBet(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!user) {
      setAuthModalOpen(true);
      return;
    }

    const validationErr = stakeError(stakeMinor);
    if (validationErr) {
      setErrorMsg(validationErr);
      return;
    }

    setPlacing(true);
    const idempotencyKey = `slip-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const res = await api.bets.place({
      selections: slip.map((s) => ({
        oddsId: s.oddsId,
        version: s.version,
        fixtureId: s.fixtureId,
      })),
      stakeMinor,
      idempotencyKey,
    });
    setPlacing(false);

    if (!res.ok) {
      const f = res.failure;
      setErrorMsg(
        f.kind === "network" ? f.message : `${f.error.code}: ${f.error.message}`,
      );
      return;
    }

    setSuccessMsg(
      `Ticket accepted • ${res.data.selections.length} ${
        res.data.selections.length === 1 ? "leg" : "legs"
      } @ ${res.data.recordedOdds.toFixed(2)}`,
    );
    playBetPlacedSound();
    clearSlip();
    notifyBetPlaced();
    setActiveTab("open");
  }

  async function handleRefreshOpenBets() {
    setRefreshingOpen(true);
    await refreshAccount();
    setRefreshingOpen(false);
  }

  async function handleCashOut(betId: string, percentage: number = 100) {
    setCashingOutId(betId);
    const res = await api.bets.cashout(betId, percentage);
    setCashingOutId(null);
    if (res.ok) {
      playCashOutSound();
      await refreshAccount();
    }
  }

  if (user?.isAdmin) {
    return (
      <aside
        aria-label="Operator Monitoring Mode"
        className="overflow-hidden rounded-card border border-peach/40 bg-coal p-5"
      >
        <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-widest text-peach">
          <span className="live-dot h-2 w-2 rounded-full bg-peach" />
          OPERATOR MONITORING MODE
        </div>
        <h2 className="mt-1.5 text-sm font-bold text-bone">
          Betting Disabled for Administrators
        </h2>
        <p className="mt-1.5 text-xs leading-relaxed text-fog">
          Signed in as <strong className="text-bone">{user.email}</strong>. Administrator and staff accounts strictly monitor the simulation, users, and risk book and are not permitted to place bets.
        </p>
        <div className="mt-4 space-y-2 border-t border-line pt-3 font-mono text-xs">
          <Link
            href="/admin"
            className="flex min-h-[40px] w-full items-center justify-center rounded-control bg-peach px-4 py-2 font-bold uppercase tracking-wider text-ink transition-opacity hover:opacity-90"
          >
            Open Admin Operations Console →
          </Link>
        </div>
      </aside>
    );
  }

  return (
    <aside
      id="betslip-container"
      aria-label="Betting Tickets and Open Bets"
      className="b365-card overflow-hidden"
    >
      {/* Two-Column Tab Header: Bet Slip | Open Bets */}
      <div className="grid grid-cols-2 border-b border-[#2B3036] bg-[#16181B] p-1 gap-1">
        <button
          type="button"
          onClick={() => setActiveTab("slip")}
          className={`flex min-h-[36px] items-center justify-center gap-2 rounded px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider transition-colors ${
            activeTab === "slip"
              ? "bg-[#027B5B] text-white border-b-2 border-[#F9DC1C]"
              : "text-[#A3ACB5] hover:text-white hover:bg-white/5 border-b-2 border-transparent"
          }`}
        >
          <span>Bet Slip</span>
          <span
            className={`tnum rounded px-1.5 py-0.2 text-[10px] font-bold ${
              activeTab === "slip"
                ? "bg-[#F9DC1C] text-[#121212]"
                : "bg-[#2B3036] text-[#A3ACB5]"
            }`}
          >
            {slip.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("open")}
          className={`flex min-h-[36px] items-center justify-center gap-2 rounded px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider transition-colors ${
            activeTab === "open"
              ? "bg-[#027B5B] text-white border-b-2 border-[#F9DC1C]"
              : "text-[#A3ACB5] hover:text-white hover:bg-white/5 border-b-2 border-transparent"
          }`}
        >
          <span>Open Bets</span>
          <span
            className={`tnum rounded px-1.5 py-0.2 text-[10px] font-bold ${
              activeTab === "open"
                ? "bg-[#F9DC1C] text-[#121212]"
                : "bg-[#2B3036] text-[#A3ACB5]"
            }`}
          >
            {openBets.length}
          </span>
        </button>
      </div>


      {/* TAB 1: BET SLIP */}
      {activeTab === "slip" && (
        <>
          {slip.length > 0 && (
            <div className="flex items-center justify-between border-b border-[#2B3036] bg-[#16181B] px-3.5 py-1.5 font-mono text-[11px]">
              <span className="font-semibold uppercase text-[#F9DC1C]">
                {slip.length === 1 ? "Standard Single" : `${slip.length}-Fold Parlay`}
              </span>
              <button
                type="button"
                onClick={() => {
                  clearSlip();
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className="uppercase tracking-wider text-[#A3ACB5] hover:text-white"
              >
                Clear All
              </button>
            </div>
          )}

          {slip.length === 0 ? (
            <div className="p-6 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded border border-[#2B3036] bg-[#16181B] font-mono text-xs font-bold text-[#F9DC1C]">
                1X2
              </div>
              <p className="text-xs font-semibold text-white">Your bet slip is empty</p>
              <p className="mt-1 text-xs leading-relaxed text-[#A3ACB5]">
                Select any odds across the European fixtures to populate your ticket.
              </p>
              {successMsg && (
                <div
                  role="status"
                  className="mt-4 rounded border border-[#00E701]/40 bg-[#16181B] p-2.5 font-mono text-xs text-[#00E701]"
                >
                  {successMsg}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handlePlaceBet} className="space-y-3.5 p-3.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-[11px] font-bold text-[#A3ACB5] uppercase">
                  {slip.length === 1 ? "Single Leg" : `${slip.length}-Fold Accumulator`}
                </span>
                <button
                  type="button"
                  onClick={() => clearSlip()}
                  className="font-mono text-[10px] uppercase tracking-wider text-[#A3ACB5] hover:text-[#ED4245] transition-colors"
                >
                  Clear All
                </button>
              </div>

              <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {slip.map((s) => (
                  <li
                    key={s.fixtureId}
                    className="rounded border border-[#2B3036] border-l-2 border-l-[#F9DC1C] bg-[#16181B] p-2.5 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        {s.fixtureLabel && (
                          <p className="font-mono text-[10px] uppercase tracking-wider text-[#A3ACB5]">
                            {s.fixtureLabel}
                          </p>
                        )}
                        <p className="mt-0.5 truncate font-semibold text-white">{s.label}</p>
                        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-[#A3ACB5]">
                          Market: {s.market.replace(/_/g, " ")}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <span className="tnum rounded border border-[#F9DC1C]/40 bg-[#0B3E2F] px-2 py-0.5 font-mono text-xs font-bold text-[#F9DC1C]">
                          {s.decimal.toFixed(2)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeSlipSelection(s.fixtureId)}
                          className="font-mono text-[10px] uppercase text-[#A3ACB5] hover:text-[#ED4245]"
                          aria-label={`Remove ${s.label}`}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="space-y-2 border-t border-[#2B3036] pt-2.5">
                <div className="flex items-center justify-between text-xs">
                  <label htmlFor="slip-stake-input" className="font-medium text-[#A3ACB5]">
                    Stake Amount (XTS)
                  </label>
                  {wallet && (
                    <button
                      type="button"
                      onClick={() =>
                        setStakeMajorInput(
                          String(Math.min(5000, Math.floor(wallet.availableMinor / 100))),
                        )
                      }
                      className="font-mono text-[10px] text-[#F9DC1C] hover:underline"
                    >
                      Bal: {formatMinor(wallet.availableMinor)}
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    id="slip-stake-input"
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="5000"
                    value={stakeMajorInput}
                    onChange={(e) => setStakeMajorInput(e.target.value)}
                    className="tnum min-h-[40px] w-full rounded border border-[#383E45] bg-[#16181B] px-3 py-2 pr-12 font-mono text-sm font-semibold text-white focus:border-[#F9DC1C] focus:outline-none"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-[#A3ACB5]">
                    XTS
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {QUICK_STAKES_MAJOR.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setStakeMajorInput(String(amt))}
                      className="tnum min-h-[32px] rounded border border-[#2B3036] bg-[#2B3036] px-1 py-1 font-mono text-xs font-medium text-white transition-colors hover:border-[#F9DC1C] hover:bg-[#383E45]"
                    >
                      {amt}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      if (wallet) {
                        setStakeMajorInput(
                          String(Math.min(5000, Math.floor(wallet.availableMinor / 100))),
                        );
                      }
                    }}
                    className="tnum min-h-[32px] rounded border border-[#F9DC1C]/50 bg-[#0B3E2F] px-1 py-1 font-mono text-xs font-bold text-[#F9DC1C] transition-colors hover:bg-[#005A42]"
                  >
                    MAX
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 rounded border border-[#2B3036] bg-[#16181B] p-2.5 text-xs">
                <div className="flex justify-between text-[#A3ACB5]">
                  <span>Total Odds</span>
                  <span className="tnum font-mono font-bold text-white">
                    {totalOdds.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-[#A3ACB5]">
                  <span>Stake</span>
                  <span className="tnum font-mono text-white">{formatMinor(stakeMinor)}</span>
                </div>
                <div className="flex justify-between border-t border-[#2B3036] pt-1.5 font-semibold">
                  <span className="text-white">To Return</span>
                  <span className="tnum font-mono text-sm font-bold text-[#F9DC1C]">
                    {formatMinor(estReturnMinor)}
                  </span>
                </div>
              </div>

              {errorMsg && (
                <div
                  role="alert"
                  className="rounded border border-[#ED4245]/40 bg-[#16181B] p-2 font-mono text-xs text-[#ED4245]"
                >
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={placing}
                className="flex min-h-[42px] w-full items-center justify-center rounded bg-[#F9DC1C] px-4 py-2 font-mono text-xs font-black uppercase tracking-wider text-[#121212] transition-colors hover:bg-[#FFDF00] shadow-sm disabled:opacity-50"
              >
                <span>
                  {placing
                    ? "Locking Wager..."
                    : user
                      ? `Place Bet • ${formatMinor(stakeMinor)}`
                      : "Join / Sign In to Place Bet"}
                </span>
              </button>

            </form>
          )}
        </>
      )}

      {/* TAB 2: OPEN BETS COLUMN */}
      {activeTab === "open" && (
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-line pb-2.5 font-mono text-[11px]">
            <span className="text-fog">ACTIVE IN-PLAY &amp; PRE-MATCH</span>
            <button
              type="button"
              disabled={refreshingOpen}
              onClick={() => void handleRefreshOpenBets()}
              className="text-peach hover:underline disabled:opacity-50"
            >
              {refreshingOpen ? "Syncing..." : "Refresh"}
            </button>
          </div>

          {!user ? (
            <div className="py-6 text-center">
              <p className="text-xs text-fog">Sign in to view your active open bets.</p>
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="mt-3 min-h-[38px] rounded-control bg-peach px-4 py-1.5 text-xs font-bold text-ink"
              >
                Sign In
              </button>
            </div>
          ) : openBets.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-xs font-semibold text-bone">No open bets right now</p>
              <p className="mt-1 text-xs text-fog">
                Active wagers appear here until their fixtures complete and settle.
              </p>
            </div>
          ) : (
            <ul className="max-h-96 space-y-2.5 overflow-y-auto pr-1">
              {openBets.map((bet) => {
                const estPayout = Math.round(bet.stakeMinor * Number(bet.recordedOdds));
                return (
                  <li
                    key={bet.id}
                    className="rounded-control border border-line border-l-2 border-l-win bg-graphite p-3 text-xs"
                  >
                    <div className="flex items-center justify-between border-b border-line pb-2 font-mono text-[10px]">
                      <span className="rounded-control bg-peach-dim px-2 py-0.5 font-bold uppercase text-peach">
                        OPEN • {bet.selections.length === 1 ? "SINGLE" : `${bet.selections.length}-FOLD`}
                      </span>
                      <span className="tnum font-bold text-bone">
                        @ {Number(bet.recordedOdds).toFixed(2)}
                      </span>
                    </div>

                    <ul className="my-2 space-y-1.5">
                      {bet.selections.map((leg, i) => (
                        <li key={i} className="flex items-start justify-between gap-2 text-[11px]">
                          <span className="text-bone">{leg.label}</span>
                          <span className="tnum shrink-0 font-mono text-fog">
                            {Number(leg.recordedOdds).toFixed(2)}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <div className="flex items-center justify-between border-t border-line pt-2 font-mono text-[11px]">
                      <span className="text-fog">
                        Stake: <strong className="text-bone">{formatMinor(bet.stakeMinor)}</strong>
                      </span>
                      <span className="text-peach">
                        To Win: <strong>{formatMinor(estPayout)}</strong>
                      </span>
                    </div>

                    <div className="mt-2 pt-1">
                      <CashoutSlider
                        betId={bet.id}
                        stakeMinor={bet.stakeMinor}
                        recordedOdds={Number(bet.recordedOdds)}
                        disabled={cashingOutId === bet.id}
                        onCashOut={handleCashOut}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="border-t border-line pt-3 text-center">
            <Link
              href="/bets"
              className="font-mono text-[11px] font-semibold text-peach hover:underline"
            >
              View Full Bet History (Won / Lost) →
            </Link>
          </div>
        </div>
      )}
    </aside>
  );
}
