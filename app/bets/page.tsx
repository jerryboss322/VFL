"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/AppContext";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CashoutSlider } from "@/components/CashoutSlider";
import { StatePanel } from "@/components/StatePanel";
import { api } from "@/lib/api/client";
import { formatMinor } from "@/lib/betslip";
import { playCashOutSound } from "@/lib/sound";
import type { Bet, BetStatus } from "@/types/api";

export default function BetsPage() {
  const { user, setAuthModalOpen, betPlacedCounter, refreshAccount } = useApp();
  const [bets, setBets] = useState<Bet[]>([]);
  const [statusFilter, setStatusFilter] = useState<BetStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cashingOutId, setCashingOutId] = useState<string | null>(null);

  const loadBets = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await api.bets.list(statusFilter === "all" ? undefined : statusFilter);
    if (!res.ok) {
      const f = res.failure;
      setError(f.kind === "network" ? f.message : `${f.error.code}: ${f.error.message}`);
    } else {
      setBets(res.data);
      setError(null);
    }
    setLoading(false);
  }, [user, statusFilter]);

  useEffect(() => {
    void loadBets();
    const interval = setInterval(() => {
      void loadBets();
    }, 2500);
    return () => clearInterval(interval);
  }, [loadBets, betPlacedCounter]);

  const handleCashout = async (betId: string, percentage: number = 100) => {
    setCashingOutId(betId);
    const res = await api.bets.cashout(betId, percentage);
    setCashingOutId(null);
    if (res.ok) {
      playCashOutSound();
      await Promise.all([loadBets(), refreshAccount()]);
    }
  };

  // Performance P/L Metrics (Betfair Account Summary style)
  const metrics = useMemo(() => {
    let totalStake = 0;
    let totalReturn = 0;
    let wonCount = 0;
    let lostCount = 0;
    let pendingCount = 0;

    for (const b of bets) {
      totalStake += b.stakeMinor;
      if (b.status === "won") {
        wonCount += 1;
        totalReturn += b.returnMinor ?? 0;
      } else if (b.status === "lost") {
        lostCount += 1;
      } else if (b.status === "void") {
        totalReturn += b.returnMinor ?? 0;
      } else if (b.status === "pending") {
        pendingCount += 1;
      }
    }

    const settledCount = wonCount + lostCount;
    const winRate = settledCount > 0 ? Math.round((wonCount / settledCount) * 100) : 0;
    const netProfitMinor = totalReturn - (totalStake - (pendingCount > 0 ? bets.filter(b => b.status === "pending").reduce((acc, b) => acc + b.stakeMinor, 0) : 0));

    return {
      totalCount: bets.length,
      wonCount,
      lostCount,
      pendingCount,
      winRate,
      totalStake,
      totalReturn,
      netProfitMinor,
    };
  }, [bets]);

  if (!user) {
    return (
      <div className="space-y-4">
        <Breadcrumbs items={[{ label: "My Bets" }]} />
        <div className="rounded-card border border-line bg-coal p-6">
          <p className="text-sm font-medium text-bone">Sign in to view your bet history</p>
          <p className="mt-1 text-xs text-fog">
            All pending and settled single or accumulator bets are tracked here.
          </p>
          <button
            type="button"
            onClick={() => setAuthModalOpen(true)}
            className="mt-4 min-h-[44px] rounded-control bg-accent px-4 py-2 text-xs font-semibold text-ink transition-transform active:scale-95"
          >
            Sign In / Register
          </button>
        </div>
      </div>
    );
  }

  if (user.isAdmin) {
    return (
      <div className="space-y-4">
        <Breadcrumbs items={[{ label: "My Bets" }]} />
        <div className="rounded-card border border-accent/40 bg-coal p-6">
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-accent">
            OPERATOR MONITORING ACCOUNT
          </span>
          <h1 className="mt-1 text-base font-bold text-bone">
            Administrators Do Not Place Personal Bets
          </h1>
          <p className="mt-1 text-xs text-fog">
            Signed in as <strong className="text-bone">{user.email}</strong>. Operator accounts only monitor platform activity, risk exposure, and user tickets from the Admin Operations Console.
          </p>
          <a
            href="/admin"
            className="mt-4 inline-flex min-h-[40px] items-center rounded-control bg-accent px-4 py-2 font-mono text-xs font-bold uppercase text-ink"
          >
            Go to Admin Operations Console →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Breadcrumbs items={[{ label: "My Bets" }]} />

      {/* Header and Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-coal p-4">
        <div>
          <h1 className="text-lg font-semibold text-bone">My Bets & Tickets</h1>
          <p className="text-xs text-fog">
            Bets settle automatically in real time when selected fixtures conclude.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(["all", "pending", "won", "lost", "void"] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`min-h-[36px] rounded-control border px-3 py-1 text-xs capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                statusFilter === st
                  ? "border-accent bg-accent/15 text-accent font-bold"
                  : "border-line bg-graphite text-fog hover:text-bone"
              }`}
            >
              {st === "void" ? "cashed out" : st}
            </button>
          ))}
          <button
            type="button"
            onClick={() => void loadBets()}
            title="Refresh bets list"
            aria-label="Refresh bets list"
            className="min-h-[36px] min-w-[36px] rounded-control border border-line bg-graphite px-2.5 py-1 text-fog hover:text-white transition-colors"
          >
            ↻
          </button>
        </div>
      </div>

      {/* Betfair-Style Performance Metrics Strip */}
      {bets.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-card border border-line bg-coal p-3.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-fog">Tickets Placed</span>
            <span className="tnum mt-1 block font-mono text-lg font-bold text-bone">
              {metrics.totalCount} <span className="text-xs font-normal text-fog">({metrics.pendingCount} open)</span>
            </span>
          </div>

          <div className="rounded-card border border-line bg-coal p-3.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-fog">Win Rate</span>
            <span className="tnum mt-1 block font-mono text-lg font-bold text-accent">
              {metrics.winRate}% <span className="text-xs font-normal text-fog">({metrics.wonCount}W / {metrics.lostCount}L)</span>
            </span>
          </div>

          <div className="rounded-card border border-line bg-coal p-3.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-fog">Total Staked</span>
            <span className="tnum mt-1 block font-mono text-lg font-bold text-bone">
              {formatMinor(metrics.totalStake)}
            </span>
          </div>

          <div className="rounded-card border border-line bg-coal p-3.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-fog">Total Settled Returns</span>
            <span className={`tnum mt-1 block font-mono text-lg font-bold ${metrics.totalReturn > 0 ? "text-win" : "text-fog"}`}>
              {formatMinor(metrics.totalReturn)}
            </span>
          </div>
        </div>
      )}

      {loading ? (
        <StatePanel tone="loading" title="Loading your bets..." />
      ) : error ? (
        <StatePanel tone="error" title="Failed to load bets" detail={error} />
      ) : bets.length === 0 ? (
        <StatePanel tone="empty" title="No bets found for the selected filter." />
      ) : (
        <div className="space-y-3">
          {bets.map((b) => {
            const isWon = b.status === "won";
            const isLost = b.status === "lost";
            return (
              <div
                key={b.id}
                className="rounded-card border border-line bg-coal p-4 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-control px-2.5 py-0.5 font-semibold uppercase ${
                        isWon
                          ? "bg-win/20 text-win"
                          : isLost
                            ? "bg-loss/20 text-loss"
                            : "bg-accent/15 text-accent"
                      }`}
                    >
                      {b.status}
                    </span>
                    <span className="text-fog">
                      {b.selections.length === 1
                        ? "Single"
                        : `${b.selections.length}-Fold Accumulator`}
                    </span>
                  </div>
                  <span className="tnum text-fog">
                    Placed {new Date(b.placedAt).toLocaleString()}
                  </span>
                </div>

                <ul className="my-3 space-y-2">
                  {b.selections.map((s, idx) => (
                    <li
                      key={idx}
                      className="flex items-center justify-between rounded-control bg-graphite px-3 py-2"
                    >
                      <div>
                        <span className="font-medium text-bone">{s.label}</span>
                        <span className="ml-2 uppercase text-fog">
                          ({s.market.replace(/_/g, " ")})
                        </span>
                      </div>
                      <span className="tnum font-semibold text-accent">
                        {Number(s.recordedOdds).toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-3">
                  <div className="flex gap-6">
                    <div>
                      <span className="text-fog">Stake: </span>
                      <span className="tnum font-semibold text-bone">
                        {formatMinor(b.stakeMinor)}
                      </span>
                    </div>
                    <div>
                      <span className="text-fog">Combined Odds: </span>
                      <span className="tnum font-semibold text-bone">
                        {Number(b.recordedOdds).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {isWon ? (
                      <span className="tnum font-bold text-win">
                        Won Return: {formatMinor(b.returnMinor ?? 0)}
                      </span>
                    ) : isLost ? (
                      <span className="tnum text-loss">Return: 0.00 XTS</span>
                    ) : b.status === "void" ? (
                      <span className="tnum font-semibold text-accent">
                        Cashed Out: {formatMinor(b.returnMinor ?? 0)}
                      </span>
                    ) : (
                      <div className="flex flex-col gap-2 min-w-[220px]">
                        <span className="tnum text-accent">
                          Potential Return:{" "}
                          {formatMinor(Math.round(b.stakeMinor * Number(b.recordedOdds)))}
                        </span>
                        <CashoutSlider
                          betId={b.id}
                          stakeMinor={b.stakeMinor}
                          recordedOdds={Number(b.recordedOdds)}
                          cashoutValueMinor={b.cashoutValueMinor}
                          currentOdds={b.currentOdds}
                          cashoutAvailable={b.cashoutAvailable}
                          disabled={cashingOutId === b.id}
                          onCashOut={handleCashout}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
