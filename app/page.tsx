"use client";

import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/AppContext";
import { ClubBadge } from "@/components/ClubBadge";
import { StatePanel } from "@/components/StatePanel";
import { api } from "@/lib/api/client";
import { LEAGUE_LOGOS } from "@/lib/clubLogos";
import { playGoalChime } from "@/lib/sound";

import type {
  Fixture,
  FixtureOdds,
  FixtureStatus,
  MarketKey,
  OddsOption,
} from "@/types/api";

function clockToMinute(clockSeconds: number | null): string {
  if (clockSeconds === null || clockSeconds <= 0) return "1'";
  if (clockSeconds === 240) return "45' HT (10s Break)";
  if (clockSeconds >= 480) return "FT";
  const min = Math.max(1, Math.min(90, Math.round((clockSeconds / 480) * 90)));
  return `${min}'`;
}

function formatCountdown(secondsRemaining: number): string {
  const clamped = Math.max(0, Math.floor(secondsRemaining));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export default function HomePage() {
  const { selectedLeagueId, selectedLeague, slip, toggleSlipSelection, refreshAccount } =
    useApp();
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [oddsMap, setOddsMap] = useState<Record<string, FixtureOdds>>({});
  const [oddsMovementMap, setOddsMovementMap] = useState<Record<string, "up" | "down">>({});
  const fetchedOddsIdsRef = useRef<Set<string>>(new Set());
  const prevHadLiveRef = useRef<boolean>(false);
  const prevLiveGoalsSumRef = useRef<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMatchday, setSelectedMatchday] = useState<number | "all">(2);
  const [statusFilter, setStatusFilter] = useState<FixtureStatus | "all">("all");
  const [activeMarketKey, setActiveMarketKey] = useState<MarketKey>("match_winner");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [favOnly, setFavOnly] = useState<boolean>(false);
  const [favoriteClubs, setFavoriteClubs] = useState<string[]>([]);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("vfu_fav_clubs");
      if (raw) setFavoriteClubs(JSON.parse(raw) as string[]);
    } catch {
      // ignore storage errors
    }
  }, []);

  const toggleFavoriteClub = useCallback((clubId: string) => {
    setFavoriteClubs((prev) => {
      const next = prev.includes(clubId)
        ? prev.filter((id) => id !== clubId)
        : [...prev, clubId];
      try {
        window.localStorage.setItem("vfu_fav_clubs", JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const loadFixtures = useCallback(
    async (isInitial = false) => {
      if (!selectedLeagueId) return;
      if (isInitial) setLoading(true);
      const res = await api.fixtures.list(undefined, undefined, selectedLeagueId);
      if (!res.ok) {
        const f = res.failure;
        setError(
          f.kind === "network" ? f.message : `${f.error.code}: ${f.error.message}`,
        );
        setLoading(false);
        return;
      }
      setError(null);
      // Sort deterministically by matchday + id so fixture rows never jump or reorder
      const sorted = [...res.data].sort(
        (a, b) => a.matchday - b.matchday || a.id.localeCompare(b.id),
      );

      // Deduplicate fixtures: guarantee no matchup or club occurs more than once on the same matchday
      const seenPairings = new Set<string>();
      const seenClubsByMd = new Map<number, Set<string>>();
      const deduped: Fixture[] = [];

      for (const fx of sorted) {
        const homeId = fx.home.id;
        const awayId = fx.away.id;
        const pairKey = `${fx.matchday}-${[homeId, awayId].sort().join("-")}`;
        if (seenPairings.has(pairKey)) continue;

        let clubsInMd = seenClubsByMd.get(fx.matchday);
        if (!clubsInMd) {
          clubsInMd = new Set<string>();
          seenClubsByMd.set(fx.matchday, clubsInMd);
        }
        if (clubsInMd.has(homeId) || clubsInMd.has(awayId)) {
          // One of the clubs already has a match on this matchday, skip duplicate
          continue;
        }

        seenPairings.add(pairKey);
        clubsInMd.add(homeId);
        clubsInMd.add(awayId);
        deduped.push(fx);
      }

      setFixtures(deduped);
      setLoading(false);

      // Audio Telemetry: Detect live goals scored and play celebration chime
      const liveGoalsSum = deduped
        .filter((x) => x.status === "live")
        .reduce((acc, x) => acc + (x.homeGoals ?? 0) + (x.awayGoals ?? 0), 0);
      if (!isInitial && prevLiveGoalsSumRef.current !== null && liveGoalsSum > prevLiveGoalsSumRef.current) {
        playGoalChime();
      }
      prevLiveGoalsSumRef.current = liveGoalsSum;

      const currentlyHasLive = deduped.some((x) => x.status === "live");
      // Only refresh wallet/openBets once when a live matchday finishes and settles
      if (prevHadLiveRef.current && !currentlyHasLive) {
        void refreshAccount();
      }
      prevHadLiveRef.current = currentlyHasLive;

      if (isInitial && deduped.length > 0) {
        const activeFx =
          deduped.find((x) => x.status === "live") ||
          deduped.find((x) => x.status === "upcoming") ||
          deduped[0];
        if (activeFx) setSelectedMatchday(activeFx.matchday);
      }
    },
    [selectedLeagueId, refreshAccount],
  );

  useEffect(() => {
    if (!selectedLeagueId) return;
    void loadFixtures(true);
    const pollInterval = setInterval(() => {
      void loadFixtures(false);
    }, 5000);
    const clockInterval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => {
      clearInterval(pollInterval);
      clearInterval(clockInterval);
    };
  }, [selectedLeagueId, loadFixtures]);

  const currentMd = useMemo(() => {
    const live = fixtures.find((f) => f.status === "live");
    if (live) return live.matchday;
    const upcoming = fixtures.filter((f) => f.status === "upcoming");
    if (upcoming.length > 0) return Math.min(...upcoming.map((f) => f.matchday));
    if (fixtures.length > 0) return Math.max(...fixtures.map((f) => f.matchday));
    return 1;
  }, [fixtures]);

  // Max matchdays: 34 for 18-club leagues (Ligue 1, Eredivisie), 38 for 20-club leagues
  const maxSeasonMd = useMemo(() => {
    if (selectedLeague?.shortName === "FL1" || selectedLeague?.shortName === "ERE") {
      return 34;
    }
    return 38;
  }, [selectedLeague]);

  // Restrict matchday ribbon to strictly: Previous, Current, Next
  const threeMatchdays = useMemo(() => {
    const prev = currentMd > 1 ? currentMd - 1 : null;
    const curr = currentMd;
    const next = currentMd < maxSeasonMd ? currentMd + 1 : null;

    const statusForMd = (md: number): FixtureStatus => {
      const mFx = fixtures.filter((f) => f.matchday === md);
      if (mFx.some((f) => f.status === "live")) return "live";
      if (mFx.some((f) => f.status === "upcoming")) return "upcoming";
      return "completed";
    };

    const list: Array<{
      matchday: number;
      slot: "previous" | "current" | "next";
      status: FixtureStatus;
    }> = [];

    if (prev !== null) {
      list.push({ matchday: prev, slot: "previous", status: statusForMd(prev) });
    }
    list.push({ matchday: curr, slot: "current", status: statusForMd(curr) });
    if (next !== null) {
      list.push({ matchday: next, slot: "next", status: statusForMd(next) });
    }
    return list;
  }, [currentMd, maxSeasonMd, fixtures]);

  useEffect(() => {
    if (threeMatchdays.length > 0) {
      const valid = threeMatchdays.map((m) => m.matchday);
      if (typeof selectedMatchday !== "number" || !valid.includes(selectedMatchday)) {
        setSelectedMatchday(currentMd);
      }
    }
  }, [currentMd, threeMatchdays, selectedMatchday]);

  const liveFixturesAll = useMemo(
    () => fixtures.filter((f) => f.status === "live"),
    [fixtures],
  );
  const nextUpcomingFixtures = useMemo(() => {
    const upcoming = fixtures.filter((f) => f.status === "upcoming");
    if (upcoming.length === 0) return [];
    const minMd = Math.min(...upcoming.map((f) => f.matchday));
    return upcoming.filter((f) => f.matchday === minMd);
  }, [fixtures]);

  const visibleFixtures = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const targetMd = typeof selectedMatchday === "number" ? selectedMatchday : currentMd;
    return fixtures.filter((f) => {
      if (f.matchday !== targetMd) return false;
      if (statusFilter !== "all" && f.status !== statusFilter) return false;
      if (
        favOnly &&
        !favoriteClubs.includes(f.home.id) &&
        !favoriteClubs.includes(f.away.id)
      ) {
        return false;
      }
      if (
        q &&
        !f.home.name.toLowerCase().includes(q) &&
        !f.away.name.toLowerCase().includes(q) &&
        !f.home.shortName.toLowerCase().includes(q) &&
        !f.away.shortName.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [fixtures, selectedMatchday, currentMd, statusFilter, favOnly, favoriteClubs, searchQuery]);

  useEffect(() => {
    async function loadOddsData() {
      // Fetch missing odds and refresh active/live fixtures
      const targets = visibleFixtures.filter(
        (f) => !fetchedOddsIdsRef.current.has(f.id) || f.status === "live",
      );
      if (targets.length === 0) return;
      targets.forEach((f) => fetchedOddsIdsRef.current.add(f.id));

      const results = await Promise.all(
        targets.map(async (fx) => {
          const r = await api.fixtures.odds(fx.id);
          return r.ok ? ([fx.id, r.data] as const) : null;
        }),
      );

      setOddsMap((prev) => {
        const next = { ...prev };
        const movements: Record<string, "up" | "down"> = {};

        for (const item of results) {
          if (!item) continue;
          const [fxId, newOdds] = item;
          const oldOdds = prev[fxId];

          if (oldOdds) {
            for (const newMarket of newOdds.markets) {
              const oldMarket = oldOdds.markets.find((m) => m.key === newMarket.key);
              if (!oldMarket) continue;
              for (const newOpt of newMarket.options) {
                const oldOpt = oldMarket.options.find(
                  (o) => o.oddsId === newOpt.oddsId || o.outcome === newOpt.outcome,
                );
                if (oldOpt && oldOpt.decimal !== newOpt.decimal) {
                  movements[newOpt.oddsId] = newOpt.decimal > oldOpt.decimal ? "up" : "down";
                }
              }
            }
          }
          next[fxId] = newOdds;
        }

        if (Object.keys(movements).length > 0) {
          setOddsMovementMap((current) => ({ ...current, ...movements }));
          setTimeout(() => {
            setOddsMovementMap((current) => {
              const updated = { ...current };
              for (const k of Object.keys(movements)) {
                delete updated[k];
              }
              return updated;
            });
          }, 1800);
        }

        return next;
      });
    }

    void loadOddsData();
    const interval = setInterval(() => {
      void loadOddsData();
    }, 4000);
    return () => clearInterval(interval);
  }, [visibleFixtures]);

  const isCurrentlyLive = liveFixturesAll.length > 0;
  const nextKickoffMs = nextUpcomingFixtures[0]
    ? new Date(nextUpcomingFixtures[0].kickoffAt).getTime()
    : null;
  const secondsUntilKickoff =
    nextKickoffMs !== null
      ? Math.max(0, Math.round((nextKickoffMs - nowMs) / 1000))
      : 0;

  // Trigger immediate load when countdown reaches 0 to transition seamlessly to live in-play
  const triggeredKickoffRef = useRef(false);
  useEffect(() => {
    if (secondsUntilKickoff === 0 && !isCurrentlyLive && fixtures.length > 0) {
      if (!triggeredKickoffRef.current) {
        triggeredKickoffRef.current = true;
        void loadFixtures(false);
      }
    } else if (secondsUntilKickoff > 0) {
      triggeredKickoffRef.current = false;
    }
  }, [secondsUntilKickoff, isCurrentlyLive, fixtures.length, loadFixtures]);

  if (loading) {
    return (
      <StatePanel
        tone="loading"
        title={`Loading ${selectedLeague?.name ?? "League"} fixtures...`}
      />
    );
  }

  if (error) {
    return (
      <StatePanel tone="disconnected" title="Backend not reachable" detail={error} />
    );
  }

  if (fixtures.length === 0) {
    return <StatePanel tone="empty" title="No fixtures scheduled for this league" />;
  }

  const activeLiveMd = isCurrentlyLive ? liveFixturesAll[0]?.matchday : null;
  const activeLiveClock = isCurrentlyLive
    ? Math.max(...liveFixturesAll.map((f) => f.clockSeconds ?? 0))
    : 0;
  const liveProgressPct = Math.min(100, Math.round((activeLiveClock / 480) * 100));

  const nextMdNumber = nextUpcomingFixtures[0]?.matchday ?? null;
  const countdownProgressPct = Math.min(
    100,
    Math.max(0, Math.round(((240 - secondsUntilKickoff) / 240) * 100)),
  );

  const currentLeagueLogo = selectedLeague ? (LEAGUE_LOGOS[selectedLeague.shortName] || LEAGUE_LOGOS[selectedLeague.name]) : null;

  return (
    <div className="space-y-3">
      {/* VFL Clean Dark Sportsbook Header */}
      <section className="b365-card p-4">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-center gap-3.5">
            {currentLeagueLogo && (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-[#16181B] p-2 border border-[#2B3036]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={currentLeagueLogo}
                  alt={selectedLeague?.name ?? "League"}
                  className="h-8 w-8 object-contain"
                />
              </div>
            )}
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#A3ACB5]">
                  SOCCER • {selectedLeague?.country?.toUpperCase() ?? "EUROPE"} • {selectedLeague?.name?.toUpperCase()}
                </span>
                {isCurrentlyLive ? (
                  <span className="inline-flex items-center gap-1.5 rounded bg-live/20 px-2 py-0.5 font-mono text-[10px] font-black uppercase text-live">
                    <span className="live-dot h-1.5 w-1.5 rounded-full bg-live" />
                    LIVE IN-PLAY • {clockToMinute(activeLiveClock)}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded bg-brand-dark px-2 py-0.5 font-mono text-[10px] font-bold text-accent">
                    PRE-MATCH • MD {nextMdNumber}
                  </span>
                )}
              </div>

              <h1 className="text-lg font-bold tracking-tight text-white">
                {selectedLeague?.name ?? "European Football"}
              </h1>
              <p className="text-xs text-fog">
                {isCurrentlyLive
                  ? `Matchday ${activeLiveMd} in progress. Real-time dynamic ledger settlement.`
                  : `Next automated kickoff in ${formatCountdown(secondsUntilKickoff)}.`}
              </p>
            </div>
          </div>

          {/* Right: VFL Match Clock Module */}
          <div className="flex shrink-0 items-center gap-3 rounded bg-coal px-3.5 py-2 border border-line">
            {isCurrentlyLive ? (
              <div className="text-right">
                <span className="block font-mono text-[10px] uppercase font-bold tracking-wider text-fog">
                  MATCH TIME
                </span>
                <span className="tnum font-mono text-xl font-black text-live">
                  {clockToMinute(activeLiveClock)}
                </span>
                <span className="block font-mono text-[10px] text-fog">
                  {formatCountdown(480 - activeLiveClock)} REMAINING
                </span>
              </div>
            ) : (
              <div className="text-right">
                <span className="block font-mono text-[10px] uppercase font-bold tracking-wider text-fog">
                  KICKOFF
                </span>
                <span className="tnum font-mono text-xl font-bold text-accent">
                  {formatCountdown(secondsUntilKickoff)}
                </span>
                <span className="block font-mono text-[10px] font-bold text-win">
                  BETTING OPEN
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Minimal Progress Bar */}
        <div className="mt-3 h-1 w-full overflow-hidden rounded bg-coal">
          <div
            className={`h-full transition-all duration-700 ${
              isCurrentlyLive ? "bg-live" : "bg-accent"
            }`}
            style={{
              width: `${isCurrentlyLive ? liveProgressPct : countdownProgressPct}%`,
            }}
          />
        </div>
      </section>

      {/* Matchday Ribbon: Strictly Previous, Current, Next */}
      <div
        className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1"
        role="tablist"
        aria-label="Matchdays Navigation"
      >
        {threeMatchdays.map(({ matchday: md, slot, status }) => {
          const isSelected = selectedMatchday === md;
          return (
            <button
              key={md}
              type="button"
              onClick={() => setSelectedMatchday(md)}
              className={`min-h-[34px] shrink-0 inline-flex items-center gap-2 rounded-lg px-4 py-1.5 font-mono text-xs font-semibold transition-all ${
                isSelected
                  ? "bg-graphite text-accent font-bold border-b-2 border-accent shadow-sm"
                  : "bg-coal text-fog hover:text-white hover:bg-graphite"
              }`}
            >
              <span className="uppercase tracking-wider">
                {slot === "previous"
                  ? `PREVIOUS (MD ${md})`
                  : slot === "current"
                    ? `CURRENT (MD ${md})`
                    : `NEXT (MD ${md})`}
              </span>
              {status === "live" && (
                <span className="live-dot h-2 w-2 rounded-full bg-live" title="Live In-Play" />
              )}
              {status === "completed" && (
                <span className="text-[10px] text-fog">FT</span>
              )}
              {status === "upcoming" && (
                <span className="rounded bg-accent/20 px-1.5 py-0.2 text-[10px] font-bold text-accent">
                  OPEN
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Market Selector & Status Filter Bar */}
      <div className="b365-card p-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-1 font-mono text-[10px] uppercase font-bold tracking-wider text-accent">
              MARKETS:
            </span>
            {(
              [
                { key: "match_winner", label: "Full Time Result" },
                { key: "double_chance", label: "Double Chance" },
                { key: "over_under_2_5", label: "Goals Over/Under" },
                { key: "both_teams_to_score", label: "Both Teams to Score" },
                { key: "half_time_result", label: "1st Half Result" },
                { key: "second_half_result", label: "2nd Half Result" },
                { key: "first_half_goals_ou", label: "1st Half Over/Under" },
                { key: "second_half_goals_ou", label: "2nd Half Over/Under" },
                { key: "odd_even_goals", label: "Odd/Even Goals" },
              ] as const
            ).map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setActiveMarketKey(m.key)}
                className={`min-h-[30px] rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  activeMarketKey === m.key
                    ? "bg-accent text-ink font-bold shadow-sm"
                    : "bg-coal text-fog hover:text-white hover:bg-graphite"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            {(["all", "live", "upcoming", "completed"] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`min-h-[28px] rounded px-2 py-0.5 font-mono text-[11px] uppercase transition-colors ${
                  statusFilter === st
                    ? "bg-accent text-ink font-bold shadow-sm"
                    : "text-fog hover:text-white hover:bg-coal"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Search & Favourite Clubs Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#2B3036] pt-2">
          <div className="relative flex-1 sm:max-w-xs">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search club or team..."
              className="w-full rounded border border-line bg-graphite px-3 py-1 text-xs text-white placeholder:text-fog/60 focus:border-accent focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setFavOnly((v) => !v)}
              className={`min-h-[28px] rounded border px-2.5 py-0.5 font-mono text-[11px] transition-colors ${
                favOnly
                  ? "border-accent bg-accent text-ink font-bold shadow-sm"
                  : "border-line bg-graphite text-fog hover:text-white"
              }`}
            >
              ★ Favourites ({favoriteClubs.length})
            </button>
            <span className="font-mono text-[11px] text-fog">
              27 Markets
            </span>
          </div>
        </div>
      </div>

      {/* Stationary Fixture Rows */}
      {visibleFixtures.length === 0 ? (
        <StatePanel tone="empty" title="No fixtures match the current filter." />
      ) : (
        <div className="b365-card overflow-hidden">
          {/* Header Strip for Match List */}
          <div className="hidden md:flex items-center justify-between bg-coal px-4 py-2 border-b border-line font-mono text-[11px] text-fog">
            <div className="w-16">TIME / MD</div>
            <div className="flex-1 pl-3">MATCH &amp; TEAMS</div>
            <div className="flex items-center gap-1.5 justify-end">
              <span className="w-[74px] text-center font-bold text-accent">1</span>
              <span className="w-[74px] text-center font-bold text-accent">X</span>
              <span className="w-[74px] text-center font-bold text-accent">2</span>
              <span className="w-14 text-center">MORE</span>
            </div>
          </div>

          {visibleFixtures.map((fx) => {
            const fxOdds = oddsMap[fx.id];
            const displayedMarket =
              fxOdds?.markets.find((m) => m.key === activeMarketKey) ??
              fxOdds?.markets[0];
            const isUpcoming = fx.status === "upcoming";
            const isLive = fx.status === "live";
            const isCompleted = fx.status === "completed";
            const isHalftime = isLive && fx.clockSeconds === 240;
            const attackSeed = ((fx.clockSeconds ?? 0) * 17) % 100;
            const isHomeAttacking = isLive && !isHalftime && attackSeed < 53;
            const isAwayAttacking = isLive && !isHalftime && !isHomeAttacking;

            const fxKoMs = new Date(fx.kickoffAt).getTime();
            const fxSecLeft = Math.max(0, Math.round((fxKoMs - nowMs) / 1000));

            return (
              <div
                key={fx.id}
                className="b365-row flex flex-col gap-3 p-3.5 md:flex-row md:items-center md:justify-between"
              >
                {/* Left Column: Match Clock & Scoreboard Badge */}
                <div className="flex flex-1 items-center gap-3">
                  <div className={`flex w-16 shrink-0 flex-col items-center justify-center rounded py-1.5 px-1 text-center font-mono ${
                    isLive
                      ? "b365-score-live"
                      : isUpcoming
                        ? "bg-coal border border-line text-white"
                        : "bg-coal text-fog"
                  }`}>
                    <span className="text-[10px] font-bold uppercase text-fog">
                      MD {fx.matchday}
                    </span>
                    {isLive && (
                      <span className={`tnum mt-0.5 inline-flex items-center gap-1 text-[11px] font-bold ${isHalftime ? "text-gold" : "text-live"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${isHalftime ? "bg-gold" : "bg-live live-dot"}`} />
                        {isHalftime ? "HT 10s" : clockToMinute(fx.clockSeconds)}
                      </span>
                    )}
                    {isUpcoming && (
                      <span className="tnum mt-0.5 text-[11px] font-bold text-white">
                        {fxSecLeft > 0 && fxSecLeft <= 3600
                          ? formatCountdown(fxSecLeft)
                          : new Date(fx.kickoffAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                      </span>
                    )}
                    {isCompleted && (
                      <span className="mt-0.5 text-[11px] font-semibold text-fog">FT</span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleFavoriteClub(fx.home.id)}
                          className={`text-xs transition-colors ${
                            favoriteClubs.includes(fx.home.id)
                              ? "text-accent"
                              : "text-fog/40 hover:text-white"
                          }`}
                          title="Pin club to favourites"
                        >
                          ★
                        </button>
                        <ClubBadge
                          shortName={fx.home.shortName}
                          name={fx.home.name}
                          size="sm"
                        />
                        <Link
                          href={`/clubs/${fx.home.id}`}
                          className="truncate text-xs font-semibold text-white hover:text-accent transition-colors"
                        >
                          {fx.home.name}
                        </Link>
                        {isHomeAttacking && (
                          <span className="inline-flex items-center gap-1 rounded bg-blue-600/25 px-1.5 py-0.2 font-mono text-[9px] font-bold text-blue-400 border border-blue-500/40 animate-pulse">
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                            ATTACKING
                          </span>
                        )}
                      </div>
                      {(isLive || isCompleted) && (
                        <div
                          className={`tnum font-mono text-xs font-bold px-2 py-0.5 rounded min-w-[24px] text-center ${
                            isLive
                              ? "bg-live/25 text-live font-black"
                              : "bg-coal text-white border border-line"
                          }`}
                        >
                          {fx.homeGoals ?? 0}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleFavoriteClub(fx.away.id)}
                          className={`text-xs transition-colors ${
                            favoriteClubs.includes(fx.away.id)
                              ? "text-accent"
                              : "text-fog/40 hover:text-white"
                          }`}
                          title="Pin club to favourites"
                        >
                          ★
                        </button>
                        <ClubBadge
                          shortName={fx.away.shortName}
                          name={fx.away.name}
                          size="sm"
                        />
                        <Link
                          href={`/clubs/${fx.away.id}`}
                          className="truncate text-xs font-semibold text-white hover:text-accent transition-colors"
                        >
                          {fx.away.name}
                        </Link>
                        {isAwayAttacking && (
                          <span className="inline-flex items-center gap-1 rounded bg-red-600/25 px-1.5 py-0.2 font-mono text-[9px] font-bold text-red-400 border border-red-500/40 animate-pulse">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                            ATTACKING
                          </span>
                        )}
                      </div>
                      {(isLive || isCompleted) && (
                        <div
                          className={`tnum font-mono text-xs font-bold px-2 py-0.5 rounded min-w-[24px] text-center ${
                            isLive
                              ? "bg-live/25 text-live font-black"
                              : "bg-coal text-white border border-line"
                          }`}
                        >
                          {fx.awayGoals ?? 0}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column: VFL Odds Selection Buttons */}
                <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
                  {displayedMarket ? (
                    <div className="grid flex-1 grid-cols-3 gap-1 sm:flex-initial sm:flex">
                      {displayedMarket.options.map((opt: OddsOption) => {
                        const selected = slip.some(
                          (s) => s.fixtureId === fx.id && s.oddsId === opt.oddsId,
                        );
                        const isBettingOpen = isUpcoming || isLive;
                        const is1HMarket = [
                          "half_time_result",
                          "first_half_goals_ou",
                          "ht_correct_score",
                          "ht_ft",
                          "ht_ft_and_ou_2_5",
                        ].includes(displayedMarket.key);
                        const is1HFinished = (fx.clockSeconds ?? 0) >= 240 || isCompleted;
                        const disabled = !isBettingOpen || opt.suspended || (is1HMarket && is1HFinished);
                        const movement = oddsMovementMap[opt.oddsId];
                        let tag = opt.label;
                        if (opt.outcome === "home" || opt.outcome === "ht_home" || opt.outcome === "2h_home") tag = "1";
                        else if (opt.outcome === "draw" || opt.outcome === "ht_draw" || opt.outcome === "2h_draw") tag = "X";
                        else if (opt.outcome === "away" || opt.outcome === "ht_away" || opt.outcome === "2h_away") tag = "2";
                        else if (opt.outcome === "dc_1x") tag = "1X";
                        else if (opt.outcome === "dc_12") tag = "12";
                        else if (opt.outcome === "dc_x2") tag = "X2";
                        else if (opt.outcome === "over_2_5") tag = "O 2.5";
                        else if (opt.outcome === "under_2_5") tag = "U 2.5";
                        else if (opt.outcome === "btts_yes") tag = "YES";
                        else if (opt.outcome === "btts_no") tag = "NO";
                        else if (opt.outcome === "odd_goals") tag = "ODD";
                        else if (opt.outcome === "even_goals") tag = "EVEN";
                        else if (opt.outcome === "first_goal_home") tag = "1ST H";
                        else if (opt.outcome === "first_goal_none") tag = "NO GL";
                        else if (opt.outcome === "first_goal_away") tag = "1ST A";

                        return (
                          <button
                            key={opt.oddsId}
                            type="button"
                            aria-pressed={selected}
                            disabled={disabled}
                            onClick={() =>
                              toggleSlipSelection({
                                fixtureId: fx.id,
                                fixtureLabel: `${selectedLeague?.shortName ?? "VFN"} MD ${fx.matchday} • ${fx.home.shortName} v ${fx.away.shortName}`,
                                market: displayedMarket.key,
                                oddsId: opt.oddsId,
                                version: opt.version,
                                label: `${fx.home.name} v ${fx.away.name} — ${opt.label}`,
                                decimal: opt.decimal,
                              })
                            }
                            className={`min-h-[38px] w-full sm:w-[74px] shrink-0 rounded px-2 py-1 transition-all text-xs font-mono flex items-center justify-between gap-1 ${
                              selected
                                ? "bg-accent border border-accent text-ink font-black shadow-sm"
                                : disabled
                                  ? "bg-coal/40 border border-transparent text-fog/30 cursor-not-allowed"
                                  : movement === "up"
                                    ? "b365-odds-btn odds-flash-up"
                                    : movement === "down"
                                      ? "b365-odds-btn odds-flash-down"
                                      : "b365-odds-btn"
                            }`}
                          >
                            <span className={selected ? "text-ink font-bold text-[10px]" : "text-fog text-[10px]"}>
                              {tag}
                            </span>
                            <span className="flex items-center gap-0.5">
                              {is1HMarket && is1HFinished ? (
                                <span className="font-mono text-[9px] font-bold text-loss">LOCKED</span>
                              ) : (
                                <span className={`tnum font-bold ${selected ? "text-ink font-black" : "b365-odds-value"}`}>
                                  {opt.decimal.toFixed(2)}
                                </span>
                              )}
                              {movement === "up" && (
                                <span className="font-mono text-[9px] font-black text-[#00E701]" title="Odds lengthened">▲</span>
                              )}
                              {movement === "down" && (
                                <span className="font-mono text-[9px] font-black text-[#ED4245]" title="Odds shortened">▼</span>
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}

                  <Link
                    href={`/matches/${fx.id}`}
                    className="min-h-[38px] w-full sm:w-14 shrink-0 inline-flex items-center justify-center rounded border border-[#383E45] bg-[#2B3036] px-1 py-1 font-mono text-xs font-medium text-[#A3ACB5] hover:text-white hover:bg-[#383E45] transition-colors"
                    title="View match details & all 27 markets"
                  >
                    +27 →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
