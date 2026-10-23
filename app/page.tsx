"use client";

import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/AppContext";
import { ClubBadge } from "@/components/ClubBadge";
import { StatePanel } from "@/components/StatePanel";
import { api } from "@/lib/api/client";
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

  return (
    <div className="space-y-5">
      {/* League Broadcast Status & Countdown Banner */}
      <section className="pitch-grid relative overflow-hidden rounded-card border border-line bg-coal p-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-control bg-graphite px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-bone">
                {selectedLeague?.country ?? "EUROPE"} • {selectedLeague?.shortName ?? "VFN"}
              </span>
              {isCurrentlyLive ? (
                <span className="inline-flex items-center gap-1.5 rounded-control bg-live/20 px-2.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider text-live">
                  <span className="live-dot h-2 w-2 rounded-full bg-live" />
                  MATCHDAY {activeLiveMd} IN PLAY • {clockToMinute(activeLiveClock)}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-control border border-peach/40 bg-peach-dim px-2.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider text-peach">
                  <span className="live-dot h-2 w-2 rounded-full bg-peach" />
                  PRE-MATCH WINDOW • MATCHDAY {nextMdNumber}
                </span>
              )}
            </div>

            <h1 className="text-lg font-bold tracking-tight text-bone sm:text-xl">
              {selectedLeague?.name ?? "European Football"} —{" "}
              {isCurrentlyLive
                ? `Matchday ${activeLiveMd} Live`
                : `Matchday ${nextMdNumber} Pre-Match Markets`}
            </h1>
            <p className="text-xs text-fog">
              {isCurrentlyLive
                ? `Matches are underway. Matchday ${
                    nextMdNumber ?? (activeLiveMd ?? 1) + 1
                  } kicks off automatically 4 minutes after full-time settlement.`
                : `All Matchday ${nextMdNumber} fixtures kick off simultaneously when the 4-minute countdown reaches 00:00.`}
            </p>
          </div>

          {/* Right: Digital Clock / Countdown */}
          <div className="flex shrink-0 items-center gap-4 rounded-card border border-line bg-ink px-4 py-3">
            {isCurrentlyLive ? (
              <div className="text-right">
                <span className="block font-mono text-[10px] uppercase tracking-widest text-fog">
                  MATCH CLOCK
                </span>
                <span className="tnum font-mono text-2xl font-bold text-live">
                  {clockToMinute(activeLiveClock)}
                </span>
                <span className="block font-mono text-[10px] text-fog">
                  {formatCountdown(480 - activeLiveClock)} REM
                </span>
              </div>
            ) : (
              <div className="text-right">
                <span className="block font-mono text-[10px] uppercase tracking-widest text-fog">
                  KICKOFF IN
                </span>
                <span className="tnum font-mono text-2xl font-bold text-peach">
                  {formatCountdown(secondsUntilKickoff)}
                </span>
                <span className="block font-mono text-[10px] text-win">
                  BETTING OPEN
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-ink">
          <div
            className={`h-full transition-all duration-700 ${
              isCurrentlyLive ? "bg-live" : "bg-peach"
            }`}
            style={{
              width: `${isCurrentlyLive ? liveProgressPct : countdownProgressPct}%`,
            }}
          />
        </div>
      </section>

      {/* Matchday Ribbon */}
      <div
        className="flex items-center gap-1.5 overflow-x-auto pb-1"
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
              className={`min-h-[38px] shrink-0 inline-flex items-center gap-2 rounded-control border px-3.5 py-1.5 font-mono text-xs font-semibold transition-colors ${
                isSelected
                  ? "border-peach bg-peach-dim text-peach"
                  : "border-line bg-coal text-fog hover:border-fog hover:text-bone"
              }`}
            >
              <span>Matchday {md}</span>
              {status === "live" && (
                <span className="live-dot h-2 w-2 rounded-full bg-live" title="Live" />
              )}
              {status === "completed" && (
                <span className="text-[10px] text-fog/70">FT</span>
              )}
              {status === "upcoming" && md === nextMdNumber && (
                <span className="text-[10px] text-win">OPEN</span>
              )}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setSelectedMatchday("all")}
          className={`min-h-[38px] shrink-0 rounded-control border px-3 py-1.5 font-mono text-xs font-semibold transition-colors ${
            selectedMatchday === "all"
              ? "border-peach bg-peach-dim text-peach"
              : "border-line bg-coal text-fog hover:border-fog hover:text-bone"
          }`}
        >
          All Matchdays
        </button>
      </div>

      {/* Market Selector & Status Filter Bar */}
      <div className="space-y-2.5 rounded-card border border-line bg-coal p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 font-mono text-[11px] uppercase tracking-wider text-fog">
              Quick Market:
            </span>
            {(
              [
                { key: "match_winner", label: "1X2 Result" },
                { key: "double_chance", label: "Double Chance" },
                { key: "draw_no_bet", label: "Draw No Bet" },
                { key: "over_under_2_5", label: "Over/Under 2.5" },
                { key: "both_teams_to_score", label: "BTTS" },
                { key: "half_time_result", label: "Half-Time 1X2" },
                { key: "odd_even_goals", label: "Odd/Even Goals" },
                { key: "first_team_to_score", label: "First Goal" },
              ] as const
            ).map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setActiveMarketKey(m.key)}
                className={`min-h-[34px] rounded-control border px-2.5 py-1 text-xs font-medium transition-colors ${
                  activeMarketKey === m.key
                    ? "border-peach/60 bg-peach-dim text-peach"
                    : "border-transparent bg-graphite/40 text-fog hover:bg-graphite hover:text-bone"
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
                className={`min-h-[32px] rounded-control border px-2.5 py-1 font-mono text-[11px] uppercase transition-colors ${
                  statusFilter === st
                    ? "border-line bg-graphite text-bone"
                    : "border-transparent text-fog hover:text-bone"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Search & Favourite Clubs Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2.5">
          <div className="relative flex-1 sm:max-w-xs">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search club or short code (e.g. Arsenal, RMA, PSG)..."
              className="w-full rounded-control border border-line bg-ink px-3 py-1.5 text-xs text-bone placeholder:text-fog focus:border-peach focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFavOnly((v) => !v)}
              className={`min-h-[32px] rounded-control border px-3 py-1 font-mono text-[11px] transition-colors ${
                favOnly
                  ? "border-peach bg-peach-dim text-peach"
                  : "border-line bg-ink text-fog hover:text-bone"
              }`}
            >
              ★ Favourites ({favoriteClubs.length})
            </button>
            <span className="font-mono text-[11px] text-fog">
              27 Markets per Match
            </span>
          </div>
        </div>
      </div>

      {/* Stationary Fixture Rows */}
      {visibleFixtures.length === 0 ? (
        <StatePanel tone="empty" title="No fixtures match the current filter." />
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-card border border-line bg-coal">
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
                className="group relative flex flex-col gap-4 p-4.5 transition-all duration-200 hover:bg-white/[0.03] md:flex-row md:items-center md:justify-between"
              >
                {/* Left Column: Status & Clubs */}
                <div className="flex flex-1 items-center gap-4">
                  <div className={`flex w-22 shrink-0 flex-col items-center justify-center rounded-xl border py-2 px-1 text-center font-mono shadow-xs ${
                    isLive
                      ? "border-live/40 bg-live/10 text-live"
                      : isUpcoming
                        ? "border-peach/30 bg-peach/5 text-peach"
                        : "border-white/5 bg-ink/70 text-fog/80"
                  }`}>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-fog/70">MD {fx.matchday}</span>
                    {isLive && (
                      <span className="tnum mt-0.5 inline-flex items-center gap-1.5 text-xs font-black tracking-wide text-live">
                        <span className="live-dot h-2 w-2 rounded-full bg-live" />
                        {clockToMinute(fx.clockSeconds)}
                      </span>
                    )}
                    {isUpcoming && (
                      <span className="tnum mt-0.5 text-xs font-bold text-peach">
                        {fxSecLeft > 0 && fxSecLeft <= 3600
                          ? formatCountdown(fxSecLeft)
                          : new Date(fx.kickoffAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                      </span>
                    )}
                    {isCompleted && (
                      <span className="mt-0.5 text-xs font-bold text-fog/70">FT</span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <button
                          type="button"
                          onClick={() => toggleFavoriteClub(fx.home.id)}
                          className={`text-sm transition-transform hover:scale-125 ${
                            favoriteClubs.includes(fx.home.id)
                              ? "text-peach drop-shadow-xs"
                              : "text-fog/30 hover:text-fog"
                          }`}
                          title="Pin club to favourites"
                        >
                          ★
                        </button>
                        <ClubBadge
                          shortName={fx.home.shortName}
                          name={fx.home.name}
                          size="md"
                        />
                        <Link
                          href={`/clubs/${fx.home.id}`}
                          className="truncate text-sm font-bold text-bone transition-colors hover:text-peach"
                        >
                          {fx.home.name}
                        </Link>
                      </div>
                      {(isLive || isCompleted) && (
                        <span
                          className={`tnum font-mono text-lg font-black tracking-tight px-2 py-0.5 rounded-lg ${
                            isLive ? "bg-live/20 text-live border border-live/30" : "text-bone"
                          }`}
                        >
                          {fx.homeGoals ?? 0}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <button
                          type="button"
                          onClick={() => toggleFavoriteClub(fx.away.id)}
                          className={`text-sm transition-transform hover:scale-125 ${
                            favoriteClubs.includes(fx.away.id)
                              ? "text-peach drop-shadow-xs"
                              : "text-fog/30 hover:text-fog"
                          }`}
                          title="Pin club to favourites"
                        >
                          ★
                        </button>
                        <ClubBadge
                          shortName={fx.away.shortName}
                          name={fx.away.name}
                          size="md"
                        />
                        <Link
                          href={`/clubs/${fx.away.id}`}
                          className="truncate text-sm font-bold text-bone transition-colors hover:text-peach"
                        >
                          {fx.away.name}
                        </Link>
                      </div>
                      {(isLive || isCompleted) && (
                        <span
                          className={`tnum font-mono text-lg font-black tracking-tight px-2 py-0.5 rounded-lg ${
                            isLive ? "bg-live/20 text-live border border-live/30" : "text-bone"
                          }`}
                        >
                          {fx.awayGoals ?? 0}
                        </span>
                      )}
                    </div>
                  </div>

                </div>

                {/* Right Column: Odds Selection Buttons + Match Detail Link */}
                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                  {displayedMarket ? (
                    <div className="grid flex-1 grid-cols-3 gap-1.5 sm:flex-initial sm:flex">
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
                            className={`min-h-[44px] min-w-[88px] rounded-xl border px-3 py-2 transition-all duration-150 ${
                              selected
                                ? "border-peach bg-peach text-ink font-black shadow-md shadow-peach/25 scale-[1.02]"
                                : disabled
                                  ? "cursor-not-allowed border-white/5 bg-ink/40 text-fog/30"
                                  : "border-white/10 bg-[#121926]/90 text-bone hover:border-peach/50 hover:bg-[#182234] hover:shadow-xs active:scale-[0.98]"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2.5 font-mono text-xs">
                              <span
                                className={
                                  selected
                                    ? "text-ink/80 font-black"
                                    : "text-fog/70 font-semibold text-[10px]"
                                }
                              >
                                {tag}
                              </span>
                              <span className={`tnum font-bold ${selected ? "text-ink font-black" : "text-peach"}`}>
                                {opt.decimal.toFixed(2)}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}

                  <Link
                    href={`/matches/${fx.id}`}
                    className="min-h-[44px] inline-flex items-center justify-center rounded-xl border border-white/10 bg-coal/80 px-3.5 py-2 font-mono text-xs font-semibold text-fog hover:text-peach hover:border-peach/40 hover:bg-coal transition-all"

                    title="View match details & all 27 markets"
                  >
                    +27 Markets →
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
