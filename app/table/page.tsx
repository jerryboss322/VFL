"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import { useApp } from "@/components/AppContext";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ClubBadge } from "@/components/ClubBadge";
import { StatePanel } from "@/components/StatePanel";
import { api } from "@/lib/api/client";
import type { TableRow } from "@/types/api";

export default function LeagueTablePage() {
  const { selectedLeagueId, selectedLeague } = useApp();
  const [rows, setRows] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedLeagueId) return;
    let active = true;
    async function load() {
      setLoading(true);
      const res = await api.league.table(selectedLeagueId);
      if (!active) return;
      if (!res.ok) {
        const f = res.failure;
        setError(f.kind === "network" ? f.message : `${f.error.code}: ${f.error.message}`);
      } else {
        setRows(res.data);
        setError(null);
      }
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [selectedLeagueId]);

  if (loading) {
    return (
      <StatePanel
        tone="loading"
        title={`Loading ${selectedLeague?.name ?? "League"} standings...`}
      />
    );
  }

  if (error) {
    return <StatePanel tone="error" title="Could not load standings" detail={error} />;
  }

  if (rows.length === 0) {
    return <StatePanel tone="empty" title="No clubs registered in this league" />;
  }

  return (
    <div className="space-y-4">
      <Breadcrumbs items={[{ label: "Standings", href: "/table" }, { label: selectedLeague?.name ?? "League" }]} />

      <div className="pitch-grid rounded-card border border-line bg-coal p-5">
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-accent">
          {selectedLeague?.country ?? "EUROPE"} • OFFICIAL STANDINGS
        </span>
        <h1 className="mt-1 text-lg font-bold text-bone">
          {selectedLeague?.name ?? "League"} Table ({rows.length} Clubs)
        </h1>
        <p className="mt-0.5 text-xs text-fog">
          Tie-breakers: Points (PTS), Goal Difference (GD), Goals For (GF). Select any league above to switch tables.
        </p>
      </div>

      <div className="overflow-x-auto rounded-card border border-line bg-coal">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-line bg-graphite/60 font-mono text-[11px] uppercase text-fog">
              <th className="px-3 py-3 font-semibold">#</th>
              <th className="px-3 py-3 font-semibold">Club</th>
              <th className="px-3 py-3 text-right font-semibold">P</th>
              <th className="px-3 py-3 text-right font-semibold">W</th>
              <th className="px-3 py-3 text-right font-semibold">D</th>
              <th className="px-3 py-3 text-right font-semibold">L</th>
              <th className="px-3 py-3 text-right font-semibold">GF</th>
              <th className="px-3 py-3 text-right font-semibold">GA</th>
              <th className="px-3 py-3 text-right font-semibold">GD</th>
              <th className="px-3 py-3 text-right font-bold text-bone">PTS</th>
              <th className="px-3 py-3 text-center font-semibold">Last 5</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r, idx) => {
              const pos = r.position ?? idx + 1;
              const gd = r.gd ?? r.gf - r.ga;
              const isTopFour = pos <= 4;
              const isRelegation = pos > rows.length - 3;
              return (
                <tr
                  key={r.club.id}
                  className="transition-colors hover:bg-graphite/40"
                >
                  <td
                    className={`tnum px-3 py-3 font-mono font-bold ${
                      isTopFour
                        ? "border-l-2 border-l-win text-win"
                        : isRelegation
                          ? "border-l-2 border-l-loss text-loss"
                          : "text-fog"
                    }`}
                  >
                    {pos}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2.5">
                      <ClubBadge
                        shortName={r.club.shortName}
                        name={r.club.name}
                        size="sm"
                      />
                      <Link
                        href={`/clubs/${r.club.id}`}
                        className="font-semibold text-bone transition-colors hover:text-peach"
                      >
                        {r.club.name}
                      </Link>
                    </div>
                  </td>
                  <td className="tnum px-3 py-3 text-right font-mono text-bone">
                    {r.played}
                  </td>
                  <td className="tnum px-3 py-3 text-right font-mono text-fog">
                    {r.won}
                  </td>
                  <td className="tnum px-3 py-3 text-right font-mono text-fog">
                    {r.drawn}
                  </td>
                  <td className="tnum px-3 py-3 text-right font-mono text-fog">
                    {r.lost}
                  </td>
                  <td className="tnum px-3 py-3 text-right font-mono text-fog">
                    {r.gf}
                  </td>
                  <td className="tnum px-3 py-3 text-right font-mono text-fog">
                    {r.ga}
                  </td>
                  <td className="tnum px-3 py-3 text-right font-mono text-bone">
                    {gd > 0 ? `+${gd}` : gd}
                  </td>
                  <td className="tnum px-3 py-3 text-right font-mono text-sm font-bold text-peach">
                    {r.points}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-center gap-1 font-mono">
                      {(r.form ?? []).length === 0 ? (
                        <span className="text-fog">—</span>
                      ) : (
                        (r.form ?? []).map((res, i) => (
                          <span
                            key={i}
                            className={`inline-flex h-5 w-5 items-center justify-center rounded-control text-[10px] font-bold ${
                              res === "W"
                                ? "bg-win/20 text-win"
                                : res === "L"
                                  ? "bg-loss/20 text-loss"
                                  : "bg-graphite text-fog"
                            }`}
                          >
                            {res}
                          </span>
                        ))
                      )}
                    </div>
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
