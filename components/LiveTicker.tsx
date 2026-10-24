"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import { useApp } from "@/components/AppContext";
import { api } from "@/lib/api/client";
import type { Fixture } from "@/types/api";

function clockToMinute(clockSeconds: number | null): string {
  if (clockSeconds === null || clockSeconds <= 0) return "1'";
  if (clockSeconds >= 480) return "FT";
  const min = Math.max(1, Math.min(90, Math.round((clockSeconds / 480) * 90)));
  return `${min}'`;
}

export function LiveTicker() {
  const { selectedLeagueId, selectedLeague } = useApp();
  const [fixtures, setFixtures] = useState<Fixture[]>([]);

  useEffect(() => {
    if (!selectedLeagueId) return;

    let active = true;
    async function fetchTicker() {
      const res = await api.fixtures.list(undefined, undefined, selectedLeagueId);
      if (res.ok && active) {
        setFixtures(res.data);
      }
    }

    void fetchTicker();
    const interval = setInterval(fetchTicker, 4000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [selectedLeagueId]);

  const liveFixtures = fixtures.filter((f) => f.status === "live");
  const upcomingFixtures = fixtures.filter((f) => f.status === "upcoming").slice(0, 4);
  const displayItems = liveFixtures.length > 0 ? liveFixtures : upcomingFixtures;

  if (displayItems.length === 0) return null;

  return (
    <aside
      aria-label="Live Match Ticker"
      className="border-b border-line/60 bg-[#0E1522]/95 px-4 py-1 text-xs backdrop-blur-sm"
    >
      <div className="mx-auto flex max-w-7xl items-center gap-3 overflow-hidden">
        <div className="flex shrink-0 items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-accent">
          {liveFixtures.length > 0 ? (
            <>
              <span className="live-dot h-2 w-2 rounded-full bg-live" />
              <span>LIVE IN-PLAY:</span>
            </>
          ) : (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              <span>UPCOMING:</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-0.5">
          {displayItems.map((fx) => {
            const isLive = fx.status === "live";
            return (
              <Link
                key={fx.id}
                href={`/matches/${fx.id}`}
                className="group flex shrink-0 items-center gap-2 rounded bg-coal/70 px-2.5 py-1 text-[11px] border border-line/50 transition-all hover:border-accent hover:bg-coal"
              >
                <span className="font-semibold text-bone group-hover:text-accent">
                  {fx.home.shortName}
                </span>

                {isLive ? (
                  <span className="rounded bg-black/40 px-1.5 py-0.2 font-mono text-[11px] font-bold text-accent">
                    {fx.homeGoals ?? 0} - {fx.awayGoals ?? 0}
                  </span>
                ) : (
                  <span className="font-mono text-[10px] text-fog">vs</span>
                )}

                <span className="font-semibold text-bone group-hover:text-accent">
                  {fx.away.shortName}
                </span>

                {isLive && (
                  <span className="font-mono text-[10px] font-bold text-live">
                    {clockToMinute(fx.clockSeconds)}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
