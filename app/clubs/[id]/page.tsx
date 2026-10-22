"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import React, { useEffect, useState } from "react";
import { ClubBadge } from "@/components/ClubBadge";
import { StatePanel } from "@/components/StatePanel";
import { api } from "@/lib/api/client";
import type { ClubProfileData } from "@/types/api";

export default function ClubProfilePage() {
  const params = useParams<{ id: string }>();
  const clubId = params?.id ?? "";
  const [data, setData] = useState<ClubProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clubId) return;
    let active = true;
    async function load() {
      setLoading(true);
      const res = await api.clubs.get(clubId);
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
  }, [clubId]);

  if (loading) {
    return <StatePanel tone="loading" title="Loading club profile & historical records..." />;
  }

  if (error || !data) {
    return (
      <StatePanel
        tone="error"
        title="Unable to load club profile"
        detail={error ?? "Club not found"}
      />
    );
  }

  const { club, league, stats, fixtures } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between font-mono text-xs">
        <Link
          href="/table"
          className="inline-flex items-center gap-1.5 text-fog transition-colors hover:text-peach"
        >
          ← STANDINGS
        </Link>
        <span className="text-fog">
          {league?.country ?? "EUROPE"} • {league?.name ?? "CLUB PROFILE"}
        </span>
      </div>

      {/* Club Header & Strength Ratings */}
      <section className="pitch-grid rounded-card border border-line bg-coal p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <ClubBadge shortName={club.shortName} name={club.name} size="lg" />
            <div>
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-peach">
                {league?.name ?? "European Competition"} • {club.shortName}
              </span>
              <h1 className="mt-0.5 text-xl font-bold text-bone sm:text-2xl">
                {club.name}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-xs">
                <span className="rounded-control border border-line bg-ink px-2.5 py-1 text-bone">
                  ATT RATING:{" "}
                  <strong className="text-peach">
                    {(club.attackRating ?? 1.0).toFixed(2)}
                  </strong>
                </span>
                <span className="rounded-control border border-line bg-ink px-2.5 py-1 text-bone">
                  DEF RATING:{" "}
                  <strong className="text-win">
                    {(club.defenseRating ?? 1.0).toFixed(2)}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          {/* Form Guide */}
          <div className="flex flex-col items-start sm:items-end">
            <span className="font-mono text-[10px] uppercase tracking-wider text-fog">
              RECENT FORM (LAST 5)
            </span>
            <div className="mt-1.5 flex items-center gap-1.5 font-mono">
              {stats.form.length === 0 ? (
                <span className="text-xs text-fog">No completed matches yet</span>
              ) : (
                stats.form.map((res, idx) => (
                  <span
                    key={idx}
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-control text-xs font-bold ${
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
          </div>
        </div>

        {/* Season Records Strip */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {[
            { label: "PLAYED", val: stats.played },
            { label: "WON / DRAWN / LOST", val: `${stats.won} / ${stats.drawn} / ${stats.lost}` },
            { label: "GOALS FOR", val: stats.gf },
            { label: "GOALS AGAINST", val: stats.ga },
            { label: "GOAL DIFF", val: stats.gd > 0 ? `+${stats.gd}` : stats.gd },
            { label: "CLEAN SHEETS", val: stats.cleanSheets },
            { label: "POINTS", val: stats.points, highlight: true },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-control border border-line bg-ink p-3 font-mono"
            >
              <span className="block text-[10px] uppercase text-fog">{item.label}</span>
              <span
                className={`tnum mt-1 block text-base font-bold ${
                  item.highlight ? "text-peach" : "text-bone"
                }`}
              >
                {item.val}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Club Fixtures & Results */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-bone">
            Season Fixtures &amp; Results ({fixtures.length})
          </h2>
          <span className="font-mono text-xs text-fog">
            Biggest Win: <strong className="text-bone">{stats.biggestWin}</strong>
          </span>
        </div>

        <div className="divide-y divide-line overflow-hidden rounded-card border border-line bg-coal">
          {fixtures.map((fx) => {
            const isHome = fx.home.id === club.id;
            const opp = isHome ? fx.away : fx.home;
            return (
              <div
                key={fx.id}
                className="flex flex-wrap items-center justify-between gap-4 px-4 py-3.5 text-xs hover:bg-graphite/30"
              >
                <div className="flex items-center gap-3">
                  <span className="tnum w-14 rounded-control border border-line bg-ink px-2 py-1 text-center font-mono text-[11px] text-fog">
                    MD {fx.matchday}
                  </span>
                  <span className="w-12 font-mono text-[10px] uppercase text-fog">
                    {isHome ? "HOME" : "AWAY"}
                  </span>
                  <ClubBadge shortName={opp.shortName} name={opp.name} size="sm" />
                  <Link
                    href={`/clubs/${opp.id}`}
                    className="font-semibold text-bone hover:text-peach"
                  >
                    vs {opp.name}
                  </Link>
                </div>

                <div className="flex items-center gap-3 font-mono">
                  {fx.status === "completed" ? (
                    <span className="tnum rounded-control border border-line bg-ink px-3 py-1 font-bold text-bone">
                      {fx.homeGoals ?? 0} - {fx.awayGoals ?? 0} (FT)
                    </span>
                  ) : fx.status === "live" ? (
                    <span className="tnum rounded-control bg-live/20 px-3 py-1 font-bold text-live">
                      LIVE {fx.homeGoals ?? 0} - {fx.awayGoals ?? 0}
                    </span>
                  ) : (
                    <span className="rounded-control bg-graphite px-3 py-1 text-fog">
                      UPCOMING
                    </span>
                  )}
                  <Link
                    href={`/matches/${fx.id}`}
                    className="rounded-control border border-line bg-ink px-3 py-1 text-peach hover:border-peach"
                  >
                    Match Center →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
