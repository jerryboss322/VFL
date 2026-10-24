"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/AppContext";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ClubBadge } from "@/components/ClubBadge";
import { StatePanel } from "@/components/StatePanel";
import { api } from "@/lib/api/client";
import { playGoalChime, playWhistleSound } from "@/lib/sound";
import type {
  Fixture,
  FixtureOdds,
  MarketCategory,
  MarketKey,
  MatchEvent,
} from "@/types/api";

function formatClock(clockSeconds: number | null | undefined, status: string): string {
  if (status === "completed") return "90' FULL TIME";
  if (status === "upcoming") return "PRE-MATCH";
  const sec = clockSeconds ?? 0;
  const min = Math.max(1, Math.min(90, Math.round((sec / 480) * 90)));
  return `${min}' IN PLAY`;
}

function formatCountdown(secondsRemaining: number): string {
  const clamped = Math.max(0, Math.floor(secondsRemaining));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export default function MatchDetailPage() {
  const params = useParams<{ id: string }>();
  const fixtureId = params?.id ?? "";
  const { slip, toggleSlipSelection } = useApp();

  const [fixture, setFixture] = useState<Fixture | null>(null);
  const [odds, setOdds] = useState<FixtureOdds | null>(null);
  const [oddsMovementMap, setOddsMovementMap] = useState<Record<string, "up" | "down">>({});
  const prevOddsRef = useRef<FixtureOdds | null>(null);
  const prevGoalsRef = useRef<number | null>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  // Market category tab & search
  const [marketCategory, setMarketCategory] = useState<"all" | MarketCategory>("all");
  const [marketSearch, setMarketSearch] = useState<string>("");

  // Simulation Replay scrubber for completed matches
  const [replayMode, setReplayMode] = useState<boolean>(false);
  const [replaySecond, setReplaySecond] = useState<number>(480);

  const loadData = useCallback(async () => {
    if (!fixtureId) return;
    const [fxRes, oddsRes, evRes] = await Promise.all([
      api.fixtures.get(fixtureId),
      api.fixtures.odds(fixtureId),
      api.fixtures.events(fixtureId),
    ]);

    if (!fxRes.ok) {
      const f = fxRes.failure;
      setError(f.kind === "network" ? f.message : `${f.error.code}: ${f.error.message}`);
      setLoading(false);
      return;
    }

    const fx = fxRes.data;
    setFixture(fx);
    if (fx.status === "live") {
      const totalGoals = (fx.homeGoals ?? 0) + (fx.awayGoals ?? 0);
      if (prevGoalsRef.current !== null && totalGoals > prevGoalsRef.current) {
        playGoalChime();
      }
      prevGoalsRef.current = totalGoals;
    } else {
      prevGoalsRef.current = null;
    }
    if (oddsRes.ok) {
      const newOdds = oddsRes.data;
      const oldOdds = prevOddsRef.current;
      if (oldOdds) {
        const movements: Record<string, "up" | "down"> = {};
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
      }
      prevOddsRef.current = newOdds;
      setOdds(newOdds);
    }
    if (evRes.ok) setEvents(evRes.data);
    setError(null);
    setLoading(false);
  }, [fixtureId]);

  useEffect(() => {
    void loadData();
    const timer = setInterval(() => {
      void loadData();
    }, 3000);
    const clockTimer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => {
      clearInterval(timer);
      clearInterval(clockTimer);
    };
  }, [loadData]);

  // Auto-advance replay scrubber when replay mode is active
  useEffect(() => {
    if (!replayMode) return;
    const iv = setInterval(() => {
      setReplaySecond((prev) => {
        if (prev >= 480) {
          setReplayMode(false);
          return 480;
        }
        return Math.min(480, prev + 8);
      });
    }, 300);
    return () => clearInterval(iv);
  }, [replayMode]);

  const isUpcoming = fixture?.status === "upcoming";
  const isLive = fixture?.status === "live";
  const isCompleted = fixture?.status === "completed";

  const effectiveClock = useMemo(() => {
    if (!fixture) return 0;
    if (isCompleted) return replaySecond;
    if (isLive) return fixture.clockSeconds ?? 0;
    return 0;
  }, [fixture, isCompleted, isLive, replaySecond]);

  const visibleEvents = useMemo(() => {
    if (!fixture || isUpcoming) return [];
    return events.filter((ev) => ev.minute <= effectiveClock);
  }, [events, fixture, isUpcoming, effectiveClock]);

  // Compute dynamic scoreline at effectiveClock (supports Simulation Replay scrubber)
  const displayedScore = useMemo(() => {
    if (!fixture) return { home: 0, away: 0 };
    if (isCompleted && effectiveClock < 480) {
      let h = 0;
      let a = 0;
      for (const ev of visibleEvents) {
        if (ev.type === "goal") {
          if (ev.payload?.side === "home") h += 1;
          else if (ev.payload?.side === "away") a += 1;
        }
      }
      return { home: h, away: a };
    }
    return {
      home: fixture.homeGoals ?? 0,
      away: fixture.awayGoals ?? 0,
    };
  }, [fixture, isCompleted, effectiveClock, visibleEvents]);

  // Compute deterministic 2D pitch ball coordinates from clock & latest event
  const pitchTelemetry = useMemo(() => {
    const lastEv = visibleEvents[visibleEvents.length - 1];
    if (!fixture || isUpcoming || effectiveClock <= 0) {
      return { x: 50, y: 50, label: "Awaiting Kickoff at Center Circle", side: "neutral" };
    }
    if (effectiveClock === 240 && !isCompleted) {
      return {
        x: 50,
        y: 50,
        label: "HALF-TIME WHISTLE (45') • 10-Second Break",
        side: "neutral",
      };
    }
    const side = lastEv?.payload?.side;
    const seed = (effectiveClock * 17 + (visibleEvents.length + 1) * 31) % 100;
    const yOffset = 22 + (seed % 56);
    if (lastEv?.type === "goal") {
      return {
        x: side === "home" ? 93 : 7,
        y: 50,
        label: lastEv.text,
        side: side ?? "neutral",
      };
    }
    if (side === "home") {
      return {
        x: 62 + (seed % 26),
        y: yOffset,
        label: lastEv?.text || `${fixture.home.name} attacking into final third`,
        side: "home",
      };
    }
    if (side === "away") {
      return {
        x: 12 + (seed % 26),
        y: yOffset,
        label: lastEv?.text || `${fixture.away.name} launching dangerous counter`,
        side: "away",
      };
    }
    return {
      x: 42 + (seed % 16),
      y: yOffset,
      label: lastEv?.text || "Midfield tactical battle",
      side: "neutral",
    };
  }, [fixture, isUpcoming, isCompleted, effectiveClock, visibleEvents]);

  const filteredMarkets = useMemo(() => {
    const all = odds?.markets ?? [];
    const q = marketSearch.trim().toLowerCase();
    return all.filter((m) => {
      if (marketCategory !== "all" && m.category && m.category !== marketCategory) {
        return false;
      }
      if (
        q &&
        !(m.label || m.key).toLowerCase().includes(q) &&
        !m.options.some((o) => o.label.toLowerCase().includes(q))
      ) {
        return false;
      }
      return true;
    });
  }, [odds, marketCategory, marketSearch]);

  if (loading) {
    return <StatePanel tone="loading" title="Loading match center telemetry..." />;
  }

  if (error || !fixture) {
    return (
      <StatePanel
        tone="error"
        title="Unable to load match"
        detail={error ?? "Fixture not found"}
      />
    );
  }

  const koMs = new Date(fixture.kickoffAt).getTime();
  const secondsToKickoff = Math.max(0, Math.round((koMs - nowMs) / 1000));
  const matchProgressPct = Math.min(100, Math.round((effectiveClock / 480) * 100));

  // Trigger immediate load when countdown reaches 0 to transition seamlessly to live in-play
  const triggeredKickoffRef = useRef(false);
  useEffect(() => {
    if (isUpcoming && secondsToKickoff === 0) {
      if (!triggeredKickoffRef.current) {
        triggeredKickoffRef.current = true;
        void loadData();
      }
    } else if (secondsToKickoff > 0) {
      triggeredKickoffRef.current = false;
    }
  }, [isUpcoming, secondsToKickoff, loadData]);

  return (
    <div className="space-y-6">
      {/* Top Breadcrumbs */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Breadcrumbs
          items={[
            { label: "Matches", href: "/" },
            { label: `MD ${fixture.matchday}` },
            { label: `${fixture.home.shortName} vs ${fixture.away.shortName}` },
          ]}
        />
        <span className="font-mono text-[11px] text-fog">
          MATCHDAY {fixture.matchday} • 27 MARKETS ACTIVE
        </span>
      </div>

      {/* VFL Broadcast Scoreboard Card */}
      <div
        className="b365-card p-5"
        aria-live="polite"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2B3036] pb-3.5 font-mono text-xs">
          <span
            className={`tnum inline-flex items-center gap-1.5 rounded px-2.5 py-1 font-bold ${
              isLive
                ? "b365-score-live"
                : isUpcoming
                  ? "bg-brand-dark text-accent border border-accent/30"
                  : "bg-coal text-fog border border-line"
            }`}
          >
            {isLive && <span className="live-dot h-1.5 w-1.5 rounded-full bg-live" />}
            {isCompleted && effectiveClock < 480
              ? `REPLAY ${Math.max(1, Math.round((effectiveClock / 480) * 90))}'`
              : formatClock(fixture.clockSeconds, fixture.status)}
          </span>

          {isUpcoming && (
            <span className="tnum rounded border border-line bg-coal px-3 py-1 font-bold text-accent">
              KICKOFF IN {formatCountdown(secondsToKickoff)}
            </span>
          )}
          {isLive && (
            <span className="tnum text-fog font-medium">
              ELAPSED: {fixture.clockSeconds ?? 0}s / 480s
            </span>
          )}
          {isCompleted && (
            <span className="text-win font-semibold">OFFICIAL RESULT • MARKETS SETTLED</span>
          )}
        </div>

        <div className="my-5 grid grid-cols-3 items-center gap-4 text-center">
          {/* Home Club */}
          <div className="flex flex-col items-center">
            <ClubBadge
              shortName={fixture.home.shortName}
              name={fixture.home.name}
              size="lg"
            />
            <Link
              href={`/clubs/${fixture.home.id}`}
              className="mt-2.5 text-base font-bold text-white transition-colors hover:text-accent sm:text-lg"
            >
              {fixture.home.name}
            </Link>
            <span className="mt-1 font-mono text-[11px] font-semibold text-fog">
              HOME SQUAD • {fixture.home.shortName}
            </span>
          </div>

          {/* Center Score / Countdown Board */}
          <div className="flex flex-col items-center justify-center">
            {isUpcoming ? (
              <div className="rounded border border-line bg-coal px-6 py-3.5">
                <span className="block font-mono text-[10px] uppercase font-bold tracking-widest text-fog">
                  STARTS IN
                </span>
                <span className="tnum font-mono text-3xl font-bold text-accent sm:text-4xl">
                  {formatCountdown(secondsToKickoff)}
                </span>
                <span className="mt-1 block font-mono text-[10px] font-bold text-win">
                  ● TRADING ACTIVE
                </span>
              </div>
            ) : (
              <div className="relative">
                <div className={`tnum flex items-center gap-4 rounded border border-[#2B3036] bg-[#16181B] px-6 py-3 font-mono font-bold tracking-wider ${
                  isLive ? "text-live text-4xl sm:text-5xl border-live/40 bg-live/10" : "text-[#FFDF00] text-4xl sm:text-5xl"
                }`}>
                  <span>{displayedScore.home}</span>
                  <span className="text-[#A3ACB5]/40 font-light">:</span>
                  <span>{displayedScore.away}</span>
                </div>
                {isLive && (
                  <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-live px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-white">
                    LIVE
                  </div>
                )}
              </div>
            )}
          </div>


          {/* Away Club */}
          <div className="flex flex-col items-center">
            <ClubBadge
              shortName={fixture.away.shortName}
              name={fixture.away.name}
              size="lg"
            />
            <Link
              href={`/clubs/${fixture.away.id}`}
              className="mt-3 text-base font-bold text-bone transition-colors hover:text-peach sm:text-xl"
            >
              {fixture.away.name}
            </Link>
            <span className="mt-1 font-mono text-[11px] font-semibold text-fog">
              AWAY SQUAD • {fixture.away.shortName}
            </span>
          </div>
        </div>

        {/* 2D Animated SVG Tactical Pitch Visualizer */}
        <div className="my-5 overflow-hidden rounded-card border border-line bg-ink p-3.5">
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px]">
            <div className="flex items-center gap-2">
              <span className="uppercase tracking-wider text-fog font-bold">
                TACTICAL RADAR
              </span>
              {pitchTelemetry.side === "home" ? (
                <span className="inline-flex items-center gap-1.5 rounded bg-blue-600/20 px-2 py-0.5 text-[11px] font-bold text-blue-400 border border-blue-500/50 shadow-sm shadow-blue-500/20">
                  <span className="h-2 w-2 rounded-full bg-blue-500 animate-ping" />
                  ATTACKING: {fixture.home.name.toUpperCase()} (HOME • BLUE →)
                </span>
              ) : pitchTelemetry.side === "away" ? (
                <span className="inline-flex items-center gap-1.5 rounded bg-red-600/20 px-2 py-0.5 text-[11px] font-bold text-red-400 border border-red-500/50 shadow-sm shadow-red-500/20">
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
                  (← AWAY • RED) ATTACKING: {fixture.away.name.toUpperCase()}
                </span>
              ) : effectiveClock === 240 && !isCompleted ? (
                <span className="inline-flex items-center gap-1.5 rounded bg-gold/20 px-2 py-0.5 text-[11px] font-bold text-gold border border-gold/40">
                  <span className="h-2 w-2 rounded-full bg-gold" />
                  HALF-TIME (10s BREAK)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded bg-graphite px-2 py-0.5 text-[10px] text-fog">
                  MIDFIELD PHASE
                </span>
              )}
            </div>
            <span className="truncate text-peach font-semibold">{pitchTelemetry.label}</span>
          </div>
          <svg
            viewBox="0 0 100 56"
            className="h-40 w-full rounded-control border border-line bg-[#0B111A] sm:h-48"
            role="img"
            aria-label="2D Football Pitch Visualizer"
          >
            {/* SVG Defs for Attacking Waves: Home is Blue, Away is Red */}
            <defs>
              <linearGradient id="homeAttackGlow" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#0080FF" stopOpacity="0" />
                <stop offset="100%" stopColor="#0080FF" stopOpacity="0.30" />
              </linearGradient>
              <linearGradient id="awayAttackGlow" x1="1" y1="0" x2="0" y2="0">
                <stop offset="0%" stopColor="#FF2D55" stopOpacity="0" />
                <stop offset="100%" stopColor="#FF2D55" stopOpacity="0.30" />
              </linearGradient>
            </defs>

            {/* Tactical attacking third pressure highlights */}
            {pitchTelemetry.side === "home" && (
              <rect x="50" y="2" width="48" height="52" fill="url(#homeAttackGlow)" />
            )}
            {pitchTelemetry.side === "away" && (
              <rect x="2" y="2" width="48" height="52" fill="url(#awayAttackGlow)" />
            )}

            {/* Outer pitch lines */}
            <rect
              x="2"
              y="2"
              width="96"
              height="52"
              fill="none"
              stroke="#242F44"
              strokeWidth="0.6"
            />
            {/* Halfway line & center circle */}
            <line x1="50" y1="2" x2="50" y2="54" stroke="#242F44" strokeWidth="0.6" />
            <circle
              cx="50"
              cy="28"
              r="7"
              fill="none"
              stroke="#242F44"
              strokeWidth="0.6"
            />
            <circle cx="50" cy="28" r="0.8" fill="#6CA6E8" />
            {/* Left penalty box */}
            <rect
              x="2"
              y="13"
              width="14"
              height="30"
              fill="none"
              stroke="#242F44"
              strokeWidth="0.6"
            />
            <rect
              x="2"
              y="20"
              width="5"
              height="16"
              fill="none"
              stroke="#242F44"
              strokeWidth="0.6"
            />
            {/* Right penalty box */}
            <rect
              x="84"
              y="13"
              width="14"
              height="30"
              fill="none"
              stroke="#242F44"
              strokeWidth="0.6"
            />
            <rect
              x="93"
              y="20"
              width="5"
              height="16"
              fill="none"
              stroke="#242F44"
              strokeWidth="0.6"
            />

            {/* Goal markers on timeline */}
            {visibleEvents
              .filter((e) => e.type === "goal")
              .map((g, i) => {
                const isH = g.payload?.side === "home";
                return (
                  <circle
                    key={g.id || i}
                    cx={isH ? 91 : 9}
                    cy={18 + ((i * 7) % 20)}
                    r="1.4"
                    fill={isH ? "#0080FF" : "#FF2D55"}
                    opacity="0.9"
                  />
                );
              })}

            {/* Active Ball Position: Home Attacking = Blue (#0080FF), Away Attacking = Red (#FF2D55) */}
            <circle
              cx={pitchTelemetry.x}
              cy={(pitchTelemetry.y / 100) * 52 + 2}
              r="4.2"
              fill={
                pitchTelemetry.side === "home"
                  ? "#0080FF"
                  : pitchTelemetry.side === "away"
                    ? "#FF2D55"
                    : "#00E599"
              }
              opacity="0.30"
              className="animate-pulse"
            />
            <circle
              cx={pitchTelemetry.x}
              cy={(pitchTelemetry.y / 100) * 52 + 2}
              r="1.6"
              fill={
                pitchTelemetry.side === "home"
                  ? "#0080FF"
                  : pitchTelemetry.side === "away"
                    ? "#FF2D55"
                    : "#FFFFFF"
              }
              stroke="#FFFFFF"
              strokeWidth="0.6"
            />
          </svg>
        </div>

        {/* 90-Minute Match Progress Timeline Bar + Simulation Replay Controls */}
        <div className="space-y-2">
          <div className="flex justify-between font-mono text-[10px] text-fog">
            <span>0&apos; KICKOFF</span>
            <span className={effectiveClock === 240 && !isCompleted ? "text-gold font-bold animate-pulse" : ""}>
              45&apos; HT (10s BREAK)
            </span>
            <span>90&apos; FULL TIME</span>
          </div>
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-ink">
            <div
              className={`h-full transition-all duration-300 ${
                isLive ? "bg-live" : isCompleted ? "bg-win" : "bg-peach"
              }`}
              style={{ width: `${matchProgressPct}%` }}
            />
          </div>

          {/* Simulation Replay Bar for Completed Matches */}
          {isCompleted && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-control border border-line bg-ink px-3.5 py-2.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] font-bold uppercase text-peach">
                  SIMULATION REPLAY:
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (replaySecond >= 480) setReplaySecond(0);
                    setReplayMode((v) => !v);
                  }}
                  className="rounded-control border border-peach/50 bg-peach-dim px-2.5 py-1 font-mono text-[11px] font-bold text-peach hover:opacity-90"
                >
                  {replayMode ? "Pause Replay" : "▶ Play Match Replay"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReplayMode(false);
                    setReplaySecond(480);
                  }}
                  className="rounded-control border border-line bg-graphite px-2.5 py-1 font-mono text-[11px] text-fog hover:text-bone"
                >
                  Reset to 90&apos; FT
                </button>
              </div>
              <div className="flex flex-1 items-center gap-3 sm:max-w-xs">
                <input
                  type="range"
                  min={0}
                  max={480}
                  step={4}
                  value={replaySecond}
                  onChange={(e) => {
                    setReplayMode(false);
                    setReplaySecond(Number(e.target.value));
                  }}
                  className="w-full accent-[#6CA6E8]"
                  aria-label="Replay timeline scrubber"
                />
                <span className="tnum w-12 text-right font-mono text-xs font-bold text-bone">
                  {Math.max(1, Math.round((replaySecond / 480) * 90))}&apos;
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 27 Betting Markets Suite with Category Filter */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-coal p-3.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: "all", label: `All (${odds?.markets.length ?? 27})` },
                { id: "result", label: "Match Result" },
                { id: "half_time", label: "1st & 2nd Half" },
                { id: "goals", label: "Goals" },
                { id: "combo", label: "Combinations" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMarketCategory(tab.id)}
                className={`min-h-[36px] rounded-control border px-3 py-1.5 font-mono text-xs font-semibold transition-colors ${
                  marketCategory === tab.id
                    ? "border-peach bg-peach-dim text-peach"
                    : "border-line bg-ink text-fog hover:text-bone"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="search"
              value={marketSearch}
              onChange={(e) => setMarketSearch(e.target.value)}
              placeholder="Filter markets (e.g. Handicap, Score, BTTS)..."
              className="rounded-control border border-line bg-ink px-3 py-1.5 text-xs text-bone placeholder:text-fog focus:border-peach focus:outline-none"
            />
          </div>
        </div>

        {filteredMarkets.length === 0 ? (
          <StatePanel tone="empty" title="No markets match your filter" />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filteredMarkets.map((market) => {
              const isGridMarket = market.options.length > 4;
              const is1HMarket = [
                "half_time_result",
                "first_half_goals_ou",
                "ht_correct_score",
                "ht_ft",
                "ht_ft_and_ou_2_5",
              ].includes(market.key);
              const is1HFinished = (fixture.clockSeconds ?? 0) >= 240 || isCompleted;
              const isMarketLocked = (is1HMarket && is1HFinished) || market.suspended;

              return (
                <div
                  key={market.key}
                  className={`rounded-card border border-line bg-coal p-4 ${
                    market.options.length >= 9 ? "md:col-span-2" : ""
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-line pb-2.5">
                    <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-bone">
                      {market.label || market.key.replace(/_/g, " ")}
                    </h3>
                    <div className="flex items-center gap-2">
                      {is1HMarket && is1HFinished && (
                        <span className="rounded bg-loss/20 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-loss border border-loss/40">
                          🔒 1H Closed
                        </span>
                      )}
                      {market.category && (
                        <span className="rounded-control bg-graphite px-2 py-0.5 font-mono text-[10px] uppercase text-fog">
                          {market.category}
                        </span>
                      )}
                    </div>
                  </div>
                  <div
                    className={`mt-3 grid gap-2 ${
                      market.options.length >= 9
                        ? " sm:grid-cols-3 lg:grid-cols-4"
                        : isGridMarket
                          ? "sm:grid-cols-2"
                          : "grid-cols-1"
                    }`}
                  >
                    {market.options.map((opt) => {
                      const selected = slip.some(
                        (s) => s.fixtureId === fixture.id && s.oddsId === opt.oddsId,
                      );
                      const isBettingOpen = isUpcoming || isLive;
                      const disabled = !isBettingOpen || opt.suspended || (is1HMarket && is1HFinished);
                      const movement = oddsMovementMap[opt.oddsId];
                      return (
                        <button
                          key={opt.oddsId}
                          type="button"
                          aria-pressed={selected}
                          disabled={disabled}
                          onClick={() =>
                            toggleSlipSelection({
                              fixtureId: fixture.id,
                              fixtureLabel: `MD ${fixture.matchday} • ${fixture.home.shortName} v ${fixture.away.shortName}`,
                              market: market.key as MarketKey,
                              oddsId: opt.oddsId,
                              version: opt.version,
                              label: `${fixture.home.shortName} v ${fixture.away.shortName} — ${opt.label}`,
                              decimal: opt.decimal,
                            })
                          }
                          className={`flex min-h-[42px] w-full items-center justify-between gap-2 rounded-control border px-3 py-2 text-xs transition-colors ${
                            selected
                              ? "border-accent bg-accent/15 text-accent font-bold"
                              : disabled
                                ? "cursor-not-allowed border-line/40 bg-ink/30 text-fog/30"
                                : movement === "up"
                                  ? "border-win bg-win/10 text-win odds-flash-up"
                                  : movement === "down"
                                    ? "border-loss bg-loss/10 text-loss odds-flash-down"
                                    : "border-line bg-graphite text-bone hover:border-accent/60"
                          }`}
                        >
                          <span className="truncate text-left font-medium">
                            {opt.label}
                          </span>
                          <span className="tnum shrink-0 font-mono font-bold flex items-center gap-1">
                            {is1HMarket && is1HFinished ? (
                              <span className="rounded bg-loss/15 px-1.5 py-0.5 font-mono text-[9px] font-bold text-loss">
                                🔒 LOCKED
                              </span>
                            ) : (
                              <>
                                <span>{opt.decimal.toFixed(2)}</span>
                                {movement === "up" && (
                                  <span className="font-mono text-[9px] font-black text-win animate-bounce" title="Odds drifted out">▲</span>
                                )}
                                {movement === "down" && (
                                  <span className="font-mono text-[9px] font-black text-loss animate-bounce" title="Odds shortened">▼</span>
                                )}
                              </>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Live Commentary Feed */}
      <section className="space-y-3">
        <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-bone">
          Live Match Telemetry &amp; Commentary
        </h2>
        {visibleEvents.length === 0 ? (
          <StatePanel
            tone="empty"
            title={
              isUpcoming
                ? `Match kicks off automatically in ${formatCountdown(secondsToKickoff)}. Place your pre-match wagers across all 27 markets above.`
                : "Awaiting opening match telemetry..."
            }
          />
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-coal">
            {[...visibleEvents].reverse().map((ev, idx) => {
              const displayMin =
                ev.payload?.display_minute ??
                Math.max(1, Math.min(90, Math.round((ev.minute / 480) * 90)));
              const isGoal = ev.type === "goal";
              const isCard = ev.type === "card";
              const isRed = Boolean(ev.payload?.is_red);
              return (
                <li
                  key={ev.id || idx}
                  className={`flex items-center gap-4 px-4 py-3 text-xs ${
                    isGoal
                      ? "bg-win/5"
                      : isRed
                        ? "bg-loss/5"
                        : ""
                  }`}
                >
                  <span className="tnum w-10 font-mono font-bold text-fog">
                    {displayMin}&apos;
                  </span>
                  <span
                    className={`w-24 shrink-0 rounded-control px-2 py-0.5 text-center font-mono text-[10px] font-bold uppercase ${
                      isGoal
                        ? "border border-win/40 bg-win/20 text-win"
                        : isRed
                          ? "border border-loss/60 bg-loss/20 text-loss font-black"
                          : isCard
                            ? "border border-amber-400/50 bg-amber-400/15 text-amber-300"
                            : "bg-graphite text-fog"
                    }`}
                  >
                    {isRed
                      ? "RED CARD"
                      : isCard
                        ? "YELLOW CARD"
                        : ev.type.replace("_", " ")}
                  </span>
                  <span
                    className={
                      isGoal
                        ? "font-semibold text-bone"
                        : isRed
                          ? "font-semibold text-loss"
                          : "text-bone"
                    }
                  >
                    {ev.text}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
