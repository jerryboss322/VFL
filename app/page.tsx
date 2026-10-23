"use client";

import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/AppContext";
import { ClubBadge } from "@/components/ClubBadge";
import { StatePanel } from "@/components/StatePanel";
import { api } from "@/lib/api/client";
import { LEAGUE_LOGOS } from "@/lib/clubLogos";

import type {
  Fixture,
  FixtureOdds,
  FixtureStatus,
  MarketKey,
  OddsOption,
} from "@/types/api";

function clockToMinute(clockSeconds: number | null): string {
  if (clockSeconds === null || clockSeconds <= 0) return "1'";
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
  const fetchedOddsIdsRef = useRef<Set<string>>(new Set());
  const prevHadLiveRef = useRef<boolean>(false);

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
      setFixtures(sorted);
      setLoading(false);

      const currentlyHasLive = sorted.some((x) => x.status === "live");
      // Only refresh wallet/openBets once when a live matchday finishes and settles
      if (prevHadLiveRef.current && !currentlyHasLive) {
        void refreshAccount();
      }
      prevHadLiveRef.current = currentlyHasLive;

      if (isInitial && sorted.length > 0) {
        const activeFx =
          sorted.find((x) => x.status === "live") ||
          sorted.find((x) => x.status === "upcoming") ||
          sorted[0];
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

  const matchdays = useMemo(() => {
    const map = new Map<number, { matchday: number; status: FixtureStatus }>();
    for (const f of fixtures) {
      const prev = map.get(f.matchday);
      if (!prev) {
        map.set(f.matchday, { matchday: f.matchday, status: f.status });
      } else if (f.status === "live") {
        prev.status = "live";
      } else if (f.status === "upcoming" && prev.status === "completed") {
        prev.status = "upcoming";
      }
    }
    return Array.from(map.values()).sort((a, b) => a.matchday - b.matchday);
  }, [fixtures]);

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
    return fixtures.filter((f) => {
      if (selectedMatchday !== "all" && f.matchday !== selectedMatchday) return false;
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
  }, [fixtures, selectedMatchday, statusFilter, favOnly, favoriteClubs, searchQuery]);

  useEffect(() => {
    async function loadMissingOdds() {
      const missing = visibleFixtures.filter(
        (f) => !fetchedOddsIdsRef.current.has(f.id),
      );
      if (missing.length === 0) return;
      missing.forEach((f) => fetchedOddsIdsRef.current.add(f.id));

      const results = await Promise.all(
        missing.map(async (fx) => {
          const r = await api.fixtures.odds(fx.id);
          return r.ok ? ([fx.id, r.data] as const) : null;
        }),
      );
      setOddsMap((prev) => {
        const next = { ...prev };
        for (const item of results) {
          if (item) next[item[0]] = item[1];
        }
        return next;
      });
    }
    void loadMissingOdds();
  }, [visibleFixtures]);

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

  const isCurrentlyLive = liveFixturesAll.length > 0;
  const activeLiveMd = isCurrentlyLive ? liveFixturesAll[0]?.matchday : null;
  const activeLiveClock = isCurrentlyLive
    ? Math.max(...liveFixturesAll.map((f) => f.clockSeconds ?? 0))
    : 0;
  const liveProgressPct = Math.min(100, Math.round((activeLiveClock / 480) * 100));

  const nextMdNumber = nextUpcomingFixtures[0]?.matchday ?? null;
  const nextKickoffMs = nextUpcomingFixtures[0]
    ? new Date(nextUpcomingFixtures[0].kickoffAt).getTime()
    : null;
  const secondsUntilKickoff =
    nextKickoffMs !== null
      ? Math.max(0, Math.round((nextKickoffMs - nowMs) / 1000))
      : 0;
  const countdownProgressPct = Math.min(
    100,
    Math.max(0, Math.round(((240 - secondsUntilKickoff) / 240) * 100)),
  );

  const currentLeagueLogo = selectedLeague ? (LEAGUE_LOGOS[selectedLeague.shortName] || LEAGUE_LOGOS[selectedLeague.name]) : null;

  return (
    <div className="space-y-3">
      {/* Bet365-Style Clean Dark Sportsbook Header */}
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
                  <span className="inline-flex items-center gap-1.5 rounded bg-[#0B3E2F] px-2 py-0.5 font-mono text-[10px] font-bold text-[#F9DC1C]">
                    PRE-MATCH • MD {nextMdNumber}
                  </span>
                )}
              </div>

              <h1 className="text-lg font-bold tracking-tight text-white">
                {selectedLeague?.name ?? "European Football"}
              </h1>
              <p className="text-xs text-[#A3ACB5]">
                {isCurrentlyLive
                  ? `Matchday ${activeLiveMd} in progress. Real-time dynamic ledger settlement.`
                  : `Next automated kickoff in ${formatCountdown(secondsUntilKickoff)}.`}
              </p>
            </div>
          </div>

          {/* Right: Bet365 Match Clock Module */}
          <div className="flex shrink-0 items-center gap-3 rounded bg-[#16181B] px-3.5 py-2 border border-[#2B3036]">
            {isCurrentlyLive ? (
              <div className="text-right">
                <span className="block font-mono text-[10px] uppercase font-bold tracking-wider text-[#A3ACB5]">
                  MATCH TIME
                </span>
                <span className="tnum font-mono text-xl font-black text-live">
                  {clockToMinute(activeLiveClock)}
                </span>
                <span className="block font-mono text-[10px] text-[#A3ACB5]">
                  {formatCountdown(480 - activeLiveClock)} REMAINING
                </span>
              </div>
            ) : (
              <div className="text-right">
                <span className="block font-mono text-[10px] uppercase font-bold tracking-wider text-[#A3ACB5]">
                  KICKOFF
                </span>
                <span className="tnum font-mono text-xl font-bold text-[#F9DC1C]">
                  {formatCountdown(secondsUntilKickoff)}
                </span>
                <span className="block font-mono text-[10px] font-bold text-[#00E701]">
                  BETTING OPEN
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Minimal Progress Bar */}
        <div className="mt-3 h-1 w-full overflow-hidden rounded bg-[#16181B]">
          <div
            className={`h-full transition-all duration-700 ${
              isCurrentlyLive ? "bg-live" : "bg-[#027B5B]"
            }`}
            style={{
              width: `${isCurrentlyLive ? liveProgressPct : countdownProgressPct}%`,
            }}
          />
        </div>
      </section>

      {/* Matchday Ribbon */}
      <div
        className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1"
        role="tablist"
        aria-label="Matchdays"
      >
        {matchdays.map(({ matchday: md, status }) => {
          const isSelected = selectedMatchday === md;
          return (
            <button
              key={md}
              type="button"
              onClick={() => setSelectedMatchday(md)}
              className={`min-h-[32px] shrink-0 inline-flex items-center gap-1.5 rounded px-3 py-1 font-mono text-xs font-semibold transition-all ${
                isSelected
                  ? "bg-[#027B5B] text-white font-bold border-b-2 border-[#F9DC1C]"
                  : "bg-[#1F2327] text-[#A3ACB5] hover:text-white hover:bg-[#2B3036]"
              }`}
            >
              <span>MD {md}</span>
              {status === "live" && (
                <span className="live-dot h-1.5 w-1.5 rounded-full bg-live" title="Live" />
              )}
              {status === "completed" && (
                <span className="text-[10px] text-[#A3ACB5]">FT</span>
              )}
              {status === "upcoming" && md === nextMdNumber && (
                <span className="text-[10px] font-bold text-[#F9DC1C]">OPEN</span>
              )}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setSelectedMatchday("all")}
          className={`min-h-[32px] shrink-0 rounded px-3 py-1 font-mono text-xs font-semibold transition-all ${
            selectedMatchday === "all"
              ? "bg-[#027B5B] text-white font-bold border-b-2 border-[#F9DC1C]"
              : "bg-[#1F2327] text-[#A3ACB5] hover:text-white hover:bg-[#2B3036]"
          }`}
        >
          All
        </button>
      </div>

      {/* Market Selector & Status Filter Bar */}
      <div className="b365-card p-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-1 font-mono text-[10px] uppercase font-bold tracking-wider text-[#F9DC1C]">
              MARKETS:
            </span>
            {(
              [
                { key: "match_winner", label: "Full Time Result" },
                { key: "double_chance", label: "Double Chance" },
                { key: "draw_no_bet", label: "Draw No Bet" },
                { key: "over_under_2_5", label: "Goals Over/Under" },
                { key: "both_teams_to_score", label: "Both Teams to Score" },
                { key: "half_time_result", label: "Half Time Result" },
                { key: "odd_even_goals", label: "Odd/Even Goals" },
                { key: "first_team_to_score", label: "First Team to Score" },
              ] as const
            ).map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setActiveMarketKey(m.key)}
                className={`min-h-[30px] rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  activeMarketKey === m.key
                    ? "bg-[#027B5B] text-white font-bold"
                    : "bg-[#2B3036] text-[#A3ACB5] hover:text-white hover:bg-[#383E45]"
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
                    ? "bg-[#027B5B] text-white font-bold"
                    : "text-[#A3ACB5] hover:text-white"
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
              className="w-full rounded border border-[#383E45] bg-[#16181B] px-3 py-1 text-xs text-white placeholder:text-[#A3ACB5]/60 focus:border-[#F9DC1C] focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setFavOnly((v) => !v)}
              className={`min-h-[28px] rounded border px-2.5 py-0.5 font-mono text-[11px] transition-colors ${
                favOnly
                  ? "border-[#F9DC1C] bg-[#F9DC1C] text-[#121212] font-bold"
                  : "border-[#383E45] bg-[#16181B] text-[#A3ACB5] hover:text-white"
              }`}
            >
              ★ Favourites ({favoriteClubs.length})
            </button>
            <span className="font-mono text-[11px] text-[#A3ACB5]">
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
          <div className="hidden md:flex items-center justify-between bg-[#16181B] px-4 py-2 border-b border-[#2B3036] font-mono text-[11px] text-[#A3ACB5]">
            <div className="w-20">TIME / MD</div>
            <div className="flex-1">MATCH</div>
            <div className="flex items-center gap-2 justify-end w-72">
              <span className="flex-1 text-center font-bold text-[#F9DC1C]">1</span>
              <span className="flex-1 text-center font-bold text-[#F9DC1C]">X</span>
              <span className="flex-1 text-center font-bold text-[#F9DC1C]">2</span>
              <span className="w-16 text-center">MORE</span>
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
                        ? "bg-[#16181B] border border-[#2B3036] text-white"
                        : "bg-[#16181B] text-[#A3ACB5]"
                  }`}>
                    <span className="text-[10px] font-bold uppercase text-[#A3ACB5]">
                      MD {fx.matchday}
                    </span>
                    {isLive && (
                      <span className="tnum mt-0.5 inline-flex items-center gap-1 text-[11px] font-bold text-live">
                        <span className="live-dot h-1 w-1 rounded-full bg-live" />
                        {clockToMinute(fx.clockSeconds)}
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
                      <span className="mt-0.5 text-[11px] font-semibold text-[#A3ACB5]">FT</span>
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
                              ? "text-[#F9DC1C]"
                              : "text-[#A3ACB5]/40 hover:text-white"
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
                          className="truncate text-xs font-semibold text-white hover:text-[#F9DC1C] transition-colors"
                        >
                          {fx.home.name}
                        </Link>
                      </div>
                      {(isLive || isCompleted) && (
                        <div
                          className={`tnum font-mono text-xs font-bold px-2 py-0.5 rounded min-w-[24px] text-center ${
                            isLive
                              ? "bg-live/25 text-live font-black"
                              : "bg-[#16181B] text-white border border-[#2B3036]"
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
                              ? "text-[#F9DC1C]"
                              : "text-[#A3ACB5]/40 hover:text-white"
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
                          className="truncate text-xs font-semibold text-white hover:text-[#F9DC1C] transition-colors"
                        >
                          {fx.away.name}
                        </Link>
                      </div>
                      {(isLive || isCompleted) && (
                        <div
                          className={`tnum font-mono text-xs font-bold px-2 py-0.5 rounded min-w-[24px] text-center ${
                            isLive
                              ? "bg-live/25 text-live font-black"
                              : "bg-[#16181B] text-white border border-[#2B3036]"
                          }`}
                        >
                          {fx.awayGoals ?? 0}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column: Bet365 Odds Selection Buttons */}
                <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
                  {displayedMarket ? (
                    <div className="grid flex-1 grid-cols-3 gap-1 sm:flex-initial sm:flex">
                      {displayedMarket.options.map((opt: OddsOption) => {
                        const selected = slip.some(
                          (s) => s.fixtureId === fx.id && s.oddsId === opt.oddsId,
                        );
                        const disabled = !isUpcoming || opt.suspended;
                        let tag = opt.label;
                        if (opt.outcome === "home" || opt.outcome === "ht_home") tag = "1";
                        else if (opt.outcome === "draw" || opt.outcome === "ht_draw") tag = "X";
                        else if (opt.outcome === "away" || opt.outcome === "ht_away") tag = "2";
                        else if (opt.outcome === "dc_1x") tag = "1X";
                        else if (opt.outcome === "dc_12") tag = "12";
                        else if (opt.outcome === "dc_x2") tag = "X2";
                        else if (opt.outcome === "dnb_home") tag = "1 DNB";
                        else if (opt.outcome === "dnb_away") tag = "2 DNB";
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
                            className={`min-h-[38px] min-w-[70px] rounded px-2.5 py-1 transition-all text-xs font-mono flex items-center justify-between gap-2 ${
                              selected
                                ? "bg-[#F9DC1C] border border-[#F9DC1C] text-[#121212] font-black"
                                : disabled
                                  ? "bg-[#16181B]/50 border border-transparent text-[#A3ACB5]/30 cursor-not-allowed"
                                  : "b365-odds-btn"
                            }`}
                          >
                            <span className={selected ? "text-[#121212]/80 font-bold text-[10px]" : "text-[#A3ACB5] text-[10px]"}>
                              {tag}
                            </span>
                            <span className={`tnum font-bold ${selected ? "text-[#121212] font-black" : "b365-odds-value"}`}>
                              {opt.decimal.toFixed(2)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}

                  <Link
                    href={`/matches/${fx.id}`}
                    className="min-h-[38px] inline-flex items-center justify-center rounded border border-[#383E45] bg-[#2B3036] px-2.5 py-1 font-mono text-xs font-medium text-[#A3ACB5] hover:text-white hover:bg-[#383E45] transition-colors"
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
