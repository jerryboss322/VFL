"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useApp } from "@/components/AppContext";
import { LEAGUE_LOGOS } from "@/lib/clubLogos";

export interface ScheduledFixtureItem {
  id: string;
  matchday: number;
  homeClub: { name: string; short: string; stadium: string };
  awayClub: { name: string; short: string };
  kickoffTimeStr: string;
  status: "UPCOMING" | "LIVE" | "FINISHED";
  score?: { home: number; away: number };
  bestOdds: { home: number; draw: number; away: number };
}

// Generate representative 10-matchday fixtures across the 6 clubs
const TOTAL_MATCHDAYS = 10;
const CLUBS = [
  { name: "Arsenal", short: "ARS", stadium: "Emirates Stadium" },
  { name: "Chelsea", short: "CHE", stadium: "Stamford Bridge" },
  { name: "Liverpool", short: "LIV", stadium: "Anfield" },
  { name: "Manchester City", short: "MCI", stadium: "Etihad Stadium" },
  { name: "Manchester United", short: "MUN", stadium: "Old Trafford" },
  { name: "Tottenham Hotspur", short: "TOT", stadium: "Tottenham Stadium" },
];

function generateMockCalendar(): ScheduledFixtureItem[] {
  const items: ScheduledFixtureItem[] = [];
  let idCounter = 1;

  for (let md = 1; md <= TOTAL_MATCHDAYS; md++) {
    // 3 matches per matchday
    const isPast = md < 4;
    const isLive = md === 4;
    const isUpcoming = md > 4;

    const pairs = [
      [CLUBS[0]!, CLUBS[1]!],
      [CLUBS[2]!, CLUBS[3]!],
      [CLUBS[4]!, CLUBS[5]!],
    ];

    pairs.forEach(([c1, c2], idx) => {
      const defaultClub = { name: "Club", short: "CLB", stadium: "Stadium" };
      const safeC1 = c1 ?? defaultClub;
      const safeC2 = c2 ?? defaultClub;
      // Invert home/away for second half of season
      const home = md <= 5 ? safeC1 : safeC2;
      const away = md <= 5 ? safeC2 : safeC1;

      items.push({
        id: `cal_fix_${idCounter++}`,
        matchday: md,
        homeClub: { name: home.name, short: home.short, stadium: home.stadium },
        awayClub: { name: away.name, short: away.short },
        kickoffTimeStr: isPast
          ? "Final"
          : isLive
          ? "Live Now"
          : `Matchday ${md} \u2022 19:45`,
        status: isPast ? "FINISHED" : isLive ? "LIVE" : "UPCOMING",
        score: isPast
          ? { home: (idx * 2) % 3, away: (idx + 1) % 2 }
          : isLive
          ? { home: 1, away: 0 }
          : undefined,
        bestOdds: {
          home: parseFloat((1.90 + (idx * 0.25)).toFixed(2)),
          draw: 3.40,
          away: parseFloat((3.20 - (idx * 0.15)).toFixed(2)),
        },
      });
    });
  }

  return items;
}

const ALL_CALENDAR_FIXTURES = generateMockCalendar();

export function FixtureCalendarGrid() {
  const { selectedLeague } = useApp();
  const [selectedMatchday, setSelectedMatchday] = useState<number>(4); // Default to active matchday

  const currentMdFixtures = ALL_CALENDAR_FIXTURES.filter(
    (f) => f.matchday === selectedMatchday
  );

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-emerald-950/60 via-slate-900 to-slate-900/90 p-6 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-0.5 text-xs font-semibold text-emerald-400">
                Double Round-Robin Schedule
              </span>
              <span className="text-xs text-white/50">10 Matchdays &bull; 30 Total Fixtures</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">
              League Season Calendar
            </h1>
            <p className="text-sm text-white/60">
              Deterministic Berger circle rotation schedule. Every club plays home and away once per rival.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedMatchday(4)}
              className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20 transition-colors"
            >
              Jump to Live Matchday (MD 4)
            </button>
          </div>
        </div>

        {/* Matchday Horizontal Selector Pills */}
        <div className="mt-6 flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {Array.from({ length: TOTAL_MATCHDAYS }, (_, i) => i + 1).map((md) => {
            const isSelected = selectedMatchday === md;
            const isLive = md === 4;
            const isPast = md < 4;

            return (
              <button
                key={md}
                onClick={() => setSelectedMatchday(md)}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                  isSelected
                    ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20 scale-105"
                    : isLive
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : isPast
                    ? "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                    : "bg-black/30 text-white/40 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span>MD {md}</span>
                {isLive && (
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Matchday Fixture Cards Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            Matchday {selectedMatchday} Fixtures
            <span className="text-xs font-normal text-white/40">
              ({currentMdFixtures.length} matches scheduled)
            </span>
          </h2>
          <span className="text-xs text-white/40">
            {selectedMatchday <= 5 ? "First Half (Venues Set)" : "Second Half (Venues Reversed)"}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {currentMdFixtures.map((fx) => (
            <div
              key={fx.id}
              className="flex flex-col justify-between rounded-2xl border border-white/10 bg-slate-900/80 p-5 shadow-lg backdrop-blur-md transition-all hover:border-emerald-500/30 hover:bg-slate-900"
            >
              {/* Header / Venue */}
              <div className="flex items-center justify-between pb-3 border-b border-white/5 text-[11px]">
                <span className="text-white/40 truncate">{fx.homeClub.stadium}</span>
                <span
                  className={`rounded px-2 py-0.5 text-[9px] font-bold ${
                    fx.status === "LIVE"
                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse"
                      : fx.status === "FINISHED"
                      ? "bg-white/5 text-white/40"
                      : "bg-sky-500/20 text-sky-300"
                  }`}
                >
                  {fx.kickoffTimeStr}
                </span>
              </div>

              {/* Matchup Center */}
              <div className="py-5 space-y-3">
                {/* Home Team */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 font-mono text-[10px] font-bold text-white/80">
                      {fx.homeClub.short}
                    </span>
                    <span className="font-bold text-white text-sm">{fx.homeClub.name}</span>
                  </div>
                  {fx.score && (
                    <span className="font-mono text-lg font-black text-white">
                      {fx.score.home}
                    </span>
                  )}
                </div>

                {/* Away Team */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 font-mono text-[10px] font-bold text-white/80">
                      {fx.awayClub.short}
                    </span>
                    <span className="font-bold text-white text-sm">{fx.awayClub.name}</span>
                  </div>
                  {fx.score && (
                    <span className="font-mono text-lg font-black text-white">
                      {fx.score.away}
                    </span>
                  )}
                </div>
              </div>

              {/* Odds Footer or Match Center Link */}
              <div className="pt-3 border-t border-white/5">
                {fx.status === "FINISHED" ? (
                  <div className="text-center text-xs font-semibold text-white/40">
                    Match Concluded &bull; Full Time
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-lg bg-slate-950/60 p-1.5 border border-white/5">
                      <div className="text-[9px] text-white/40">1</div>
                      <div className="font-mono font-bold text-emerald-400">
                        {fx.bestOdds.home.toFixed(2)}
                      </div>
                    </div>
                    <div className="rounded-lg bg-slate-950/60 p-1.5 border border-white/5">
                      <div className="text-[9px] text-white/40">X</div>
                      <div className="font-mono font-bold text-amber-300">
                        {fx.bestOdds.draw.toFixed(2)}
                      </div>
                    </div>
                    <div className="rounded-lg bg-slate-950/60 p-1.5 border border-white/5">
                      <div className="text-[9px] text-white/40">2</div>
                      <div className="font-mono font-bold text-sky-400">
                        {fx.bestOdds.away.toFixed(2)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
