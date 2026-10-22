"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/AppContext";
import { StatePanel } from "@/components/StatePanel";
import { api } from "@/lib/api/client";
import { formatMinor } from "@/lib/betslip";
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
  }, [loadBets, betPlacedCounter]);

  const handleCashout = async (betId: string) => {
    setCashingOutId(betId);
    const res = await api.bets.cashout(betId);
    setCashingOutId(null);
    if (res.ok) {
      await Promise.all([loadBets(), refreshAccount()]);
    }
  };

  if (!user) {
    return (
      <div className="rounded-card border border-line bg-coal p-6">
        <p className="text-sm font-medium text-bone">Sign in to view your bet history</p>
        <p className="mt-1 text-xs text-fog">
          All pending and settled single or accumulator bets are tracked here.
        </p>
        <button
          type="button"
          onClick={() => setAuthModalOpen(true)}
          className="mt-4 min-h-[44px] rounded-control bg-peach px-4 py-2 text-xs font-semibold text-ink"
        >
          Sign In / Register
        </button>
      </div>
    );
  }

  if (user.isAdmin) {
    return (
      <div className="rounded-card border border-peach/40 bg-coal p-6">
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-peach">
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
          className="mt-4 inline-flex min-h-[40px] items-center rounded-control bg-peach px-4 py-2 font-mono text-xs font-bold uppercase text-ink"
        >
          Go to Admin Operations Console →
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-coal p-4">
        <div>
          <h1 className="text-lg font-semibold text-bone">My Bets</h1>
          <p className="text-xs text-fog">
            Bets settle automatically when all selected fixtures reach full time.
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {(["all", "pending", "won", "lost", "void"] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`min-h-[36px] rounded-control border px-3 py-1 text-xs capitalize transition-colors ${
                statusFilter === st
                  ? "border-peach bg-peach-dim text-peach"
                  : "border-line bg-graphite text-fog hover:text-bone"
              }`}
            >
              {st === "void" ? "cashed out" : st}
            </button>
          ))}
        </div>
      </div>

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
                            : "bg-peach-dim text-peach"
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
                      <span className="tnum font-semibold text-peach">
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
                      <span className="tnum font-semibold text-peach">
                        Cashed Out: {formatMinor(b.returnMinor ?? 0)}
                      </span>
                    ) : (
                      <>
                        <span className="tnum text-peach">
                          Potential Return:{" "}
                          {formatMinor(Math.round(b.stakeMinor * Number(b.recordedOdds)))}
                        </span>
                        <button
                          type="button"
                          disabled={cashingOutId === b.id}
                          onClick={() => void handleCashout(b.id)}
                          className="rounded-control border border-peach/60 bg-peach-dim px-3 py-1.5 font-mono text-[11px] font-bold text-peach transition-opacity hover:opacity-90 disabled:opacity-50"
                        >
                          {cashingOutId === b.id
                            ? "Cashing Out..."
                            : `Cash Out ${formatMinor(Math.round(b.stakeMinor * 0.92))}`}
                        </button>
                      </>
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
