"use client";

import React, { useEffect, useState } from "react";
import { StatePanel } from "@/components/StatePanel";
import { api } from "@/lib/api/client";
import { formatMinor } from "@/lib/betslip";
import type { LeaderboardPayload } from "@/types/api";

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      const res = await api.platform.leaderboard();
      if (!active) return;
      if (!res.ok) {
        const f = res.failure;
        setError(f.kind === "network" ? f.message : `${f.error.code}: ${f.error.message}`);
      } else {
        setData(res.data);
        setError(null);
      }
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <StatePanel tone="loading" title="Loading trader leaderboard & challenges..." />;
  }

  if (error || !data) {
    return (
      <StatePanel
        tone="error"
        title="Could not load leaderboard"
        detail={error ?? "Unknown error"}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="pitch-grid rounded-card border border-line bg-coal p-5">
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-peach">
          TRADER RANKINGS &amp; PREDICTION CONTESTS
        </span>
        <h1 className="mt-1 text-lg font-bold text-bone">
          Global Exchange Leaderboard (Simulated XTS)
        </h1>
        <p className="mt-0.5 text-xs text-fog">
          Ranked by total simulated equity (Available + Reserved In-Play), net profit, and settlement win rate.
        </p>
      </div>

      {/* Daily Challenges Strip */}
      <section className="space-y-3">
        <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-bone">
          Active Daily Challenges &amp; Milestones
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          {data.dailyChallenges.map((ch) => (
            <div
              key={ch.id}
              className="flex flex-col justify-between rounded-card border border-line bg-coal p-4"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-bone">
                    {ch.title}
                  </span>
                  <span className="rounded-control border border-peach/40 bg-peach-dim px-2 py-0.5 font-mono text-[10px] font-bold text-peach">
                    {ch.rewardLabel}
                  </span>
                </div>
                <p className="mt-2 text-xs text-fog">{ch.description}</p>
              </div>
              <div className="mt-3 border-t border-line pt-2 font-mono text-[10px] text-win">
                STATUS: ACTIVE IN ALL 6 LEAGUES
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Leaderboard Table */}
      <div className="overflow-x-auto rounded-card border border-line bg-coal">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-line bg-graphite/60 font-mono text-[11px] uppercase text-fog">
              <th className="px-4 py-3 font-semibold">Rank</th>
              <th className="px-4 py-3 font-semibold">Trader</th>
              <th className="px-4 py-3 font-semibold">Achievements</th>
              <th className="px-4 py-3 text-right font-semibold">Tickets (W/L)</th>
              <th className="px-4 py-3 text-right font-semibold">Win Rate</th>
              <th className="px-4 py-3 text-right font-semibold">Net P&amp;L</th>
              <th className="px-4 py-3 text-right font-bold text-bone">Total Equity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data.leaderboard.map((row) => {
              const isProfit = row.netProfitMinor > 0;
              const isLoss = row.netProfitMinor < 0;
              return (
                <tr key={row.userId} className="transition-colors hover:bg-graphite/30">
                  <td className="tnum px-4 py-3.5 font-mono font-bold text-peach">
                    #{row.rank}
                  </td>
                  <td className="px-4 py-3.5 font-semibold text-bone">
                    {row.displayName}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex flex-wrap gap-1">
                      {row.badges.length === 0 ? (
                        <span className="font-mono text-[10px] text-fog">New Trader</span>
                      ) : (
                        row.badges.map((b) => (
                          <span
                            key={b}
                            className="rounded-control border border-line bg-ink px-2 py-0.5 font-mono text-[10px] text-peach"
                          >
                            {b}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="tnum px-4 py-3.5 text-right font-mono text-fog">
                    {row.totalBets} ({row.wonBets}W / {row.lostBets}L)
                  </td>
                  <td className="tnum px-4 py-3.5 text-right font-mono font-semibold text-bone">
                    {row.winRate.toFixed(1)}%
                  </td>
                  <td
                    className={`tnum px-4 py-3.5 text-right font-mono font-semibold ${
                      isProfit ? "text-win" : isLoss ? "text-loss" : "text-fog"
                    }`}
                  >
                    {isProfit ? "+" : ""}
                    {formatMinor(row.netProfitMinor, "XTS")}
                  </td>
                  <td className="tnum px-4 py-3.5 text-right font-mono text-sm font-bold text-bone">
                    {formatMinor(row.totalEquityMinor, "XTS")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
