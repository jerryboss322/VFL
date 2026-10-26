"use client";

import React, { useMemo } from "react";
import type { Fixture, MatchEvent } from "@/types/api";

export interface MatchMomentumChartProps {
  fixture: Fixture;
  events?: MatchEvent[];
  clockSeconds?: number;
  isLive?: boolean;
}

interface MinutePressurePoint {
  minute: number;
  homePressure: number; // 0 - 100
  awayPressure: number; // 0 - 100
  netPressure: number; // -100 (full away) to +100 (full home)
  event?: MatchEvent;
}

export function MatchMomentumChart({
  fixture,
  events = [],
  clockSeconds = 0,
  isLive = false,
}: MatchMomentumChartProps) {
  const currentMinute = Math.max(1, Math.min(90, Math.round((clockSeconds / 480) * 90)));

  // Generate deterministic pressure wave across all 90 minutes
  const timeline = useMemo<MinutePressurePoint[]>(() => {
    const points: MinutePressurePoint[] = [];
    const eventMap = new Map<number, MatchEvent>();

    for (const ev of events) {
      const min = Math.max(1, Math.min(90, Math.round((ev.minute / 480) * 90)));
      if (!eventMap.has(min)) {
        eventMap.set(min, ev);
      }
    }

    const homeStrength = (fixture.home.attackRating ?? 1.2) / (fixture.away.defenseRating ?? 1.1);
    const awayStrength = (fixture.away.attackRating ?? 1.1) / (fixture.home.defenseRating ?? 1.2);

    for (let m = 1; m <= 90; m++) {
      // Harmonic sinusoidal pressure waves
      const wave1 = Math.sin(m * 0.18) * 35;
      const wave2 = Math.cos(m * 0.08 + 1.2) * 25;
      const bias = (homeStrength - awayStrength) * 20;

      let net = wave1 + wave2 + bias;

      const ev = eventMap.get(m);
      if (ev) {
        const isEvHome = ev.payload?.side === "home" || ev.clubId === fixture.home.id;
        const text = ev.text.toLowerCase();
        if (text.includes("goal") || text.includes("scores")) {
          net = isEvHome ? 85 : -85;
        } else if (text.includes("shot") || text.includes("chance")) {
          net = isEvHome ? 65 : -65;
        } else if (text.includes("corner")) {
          net = isEvHome ? 50 : -50;
        }
      }

      const clampedNet = Math.max(-95, Math.min(95, Math.round(net)));
      const homeP = Math.max(10, Math.min(95, Math.round(50 + clampedNet / 2)));
      const awayP = 100 - homeP;

      points.push({
        minute: m,
        homePressure: homeP,
        awayPressure: awayP,
        netPressure: clampedNet,
        event: ev,
      });
    }

    return points;
  }, [events, fixture]);

  // SVG dimensions: 900px wide (10px per minute) x 160px high
  const width = 900;
  const height = 160;
  const centerY = height / 2;

  // Render SVG polygon path for Home dominance (positive area above center)
  const homePathD = useMemo(() => {
    let d = `M 0 ${centerY} `;
    for (const p of timeline) {
      const x = (p.minute / 90) * width;
      const y = p.netPressure > 0 ? centerY - (p.netPressure / 100) * (centerY - 10) : centerY;
      d += `L ${x.toFixed(1)} ${y.toFixed(1)} `;
    }
    d += `L ${width} ${centerY} Z`;
    return d;
  }, [timeline, width, centerY]);

  // Render SVG polygon path for Away dominance (negative area below center)
  const awayPathD = useMemo(() => {
    let d = `M 0 ${centerY} `;
    for (const p of timeline) {
      const x = (p.minute / 90) * width;
      const y = p.netPressure < 0 ? centerY - (p.netPressure / 100) * (centerY - 10) : centerY;
      d += `L ${x.toFixed(1)} ${y.toFixed(1)} `;
    }
    d += `L ${width} ${centerY} Z`;
    return d;
  }, [timeline, width, centerY]);

  // Pressure summary metrics
  const { currentHomeDominance, currentLabel } = useMemo(() => {
    const currentPoint = timeline[currentMinute - 1] ?? timeline[0] ?? {
      minute: 1,
      homePressure: 50,
      awayPressure: 50,
      netPressure: 0,
    };
    const net = currentPoint.netPressure;
    const isHome = net >= 0;
    const label =
      Math.abs(net) > 60
        ? `${isHome ? fixture.home.shortName : fixture.away.shortName} High Pressure Surge`
        : Math.abs(net) > 25
          ? `${isHome ? fixture.home.shortName : fixture.away.shortName} Sustained Possession`
          : "Contested Midfield Battle";

    return {
      currentHomeDominance: currentPoint.homePressure,
      currentLabel: label,
    };
  }, [timeline, currentMinute, fixture]);

  return (
    <div className="b365-card p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-line pb-3 gap-2">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-accent" />
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-white">
            Match Momentum & Attacking Pressure Wave (1&apos; - 90&apos;)
          </h3>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="text-[#E5B869] font-bold">{fixture.home.shortName} ({currentHomeDominance}%)</span>
          <span className="text-fog">vs</span>
          <span className="text-[#38BDF8] font-bold">({100 - currentHomeDominance}%) {fixture.away.shortName}</span>
        </div>
      </div>

      {/* Real-time Momentum Summary Banner */}
      <div className="flex items-center justify-between rounded-lg bg-surface px-3 py-2 border border-line text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="text-accent font-bold">LIVE TELEMETRY:</span>
          <span className="text-white">{currentLabel}</span>
        </div>
        <div className="text-fog">
          Minute: <span className="text-white font-bold">{currentMinute}&apos;</span>
        </div>
      </div>

      {/* SVG Momentum Wave Container */}
      <div className="relative w-full overflow-x-auto no-scrollbar rounded-xl bg-coal border border-line p-2">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full min-w-[600px] h-36 select-none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Home Momentum Gradient (Amber) */}
            <linearGradient id="homeWaveGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#E5B869" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#E5B869" stopOpacity="0.1" />
            </linearGradient>

            {/* Away Momentum Gradient (Blue) */}
            <linearGradient id="awayWaveGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.8" />
            </linearGradient>
          </defs>

          {/* Grid lines: 15', 30', 45' (HT), 60', 75', 90' */}
          {[15, 30, 45, 60, 75, 90].map((min) => {
            const gx = (min / 90) * width;
            return (
              <g key={`grid-${min}`}>
                <line
                  x1={gx}
                  y1={0}
                  x2={gx}
                  y2={height}
                  stroke="#ffffff"
                  strokeOpacity={min === 45 ? 0.35 : 0.08}
                  strokeWidth={min === 45 ? 1.5 : 0.8}
                  strokeDasharray={min === 45 ? "none" : "3,3"}
                />
                <text
                  x={gx - 4}
                  y={height - 4}
                  fill="#94A3B8"
                  fontSize="9"
                  fontFamily="monospace"
                >
                  {min === 45 ? "HT 45'" : `${min}'`}
                </text>
              </g>
            );
          })}

          {/* Neutral Axis (Y = centerY) */}
          <line
            x1={0}
            y1={centerY}
            x2={width}
            y2={centerY}
            stroke="#ffffff"
            strokeOpacity={0.25}
            strokeWidth={1}
          />

          {/* Home Wave Fill */}
          <path d={homePathD} fill="url(#homeWaveGrad)" />

          {/* Away Wave Fill */}
          <path d={awayPathD} fill="url(#awayWaveGrad)" />

          {/* Key Match Events Badges on Timeline */}
          {timeline
            .filter((p) => p.event)
            .map((p) => {
              const ex = (p.minute / 90) * width;
              const isHomeEvent = (p.event?.payload?.side ?? (p.event?.clubId === fixture.home.id ? "home" : "away")) === "home";
              const ey = isHomeEvent ? centerY - 45 : centerY + 45;
              const isGoal = p.event?.text.toLowerCase().includes("goal");

              return (
                <g key={`event-${p.minute}`}>
                  <line
                    x1={ex}
                    y1={centerY}
                    x2={ex}
                    y2={ey}
                    stroke={isGoal ? "#E5B869" : "#ffffff"}
                    strokeWidth={isGoal ? 1.5 : 0.8}
                    strokeDasharray="2,2"
                  />
                  <circle
                    cx={ex}
                    cy={ey}
                    r={isGoal ? 6 : 4}
                    fill={isGoal ? "#E5B869" : isHomeEvent ? "#E5B869" : "#38BDF8"}
                    stroke="#0B0E11"
                    strokeWidth={1.2}
                  />
                  <text
                    x={ex}
                    y={ey + (isGoal ? 3 : 2.5)}
                    fontSize={isGoal ? "7.5" : "6"}
                    fontWeight="bold"
                    fill="#0B0E11"
                    textAnchor="middle"
                    fontFamily="monospace"
                  >
                    {isGoal ? "⚽" : p.minute}
                  </text>
                </g>
              );
            })}

          {/* Live Progress Scrubber Cursor */}
          {(isLive || fixture.status === "live") && (
            <g>
              <line
                x1={(currentMinute / 90) * width}
                y1={0}
                x2={(currentMinute / 90) * width}
                y2={height}
                stroke="#22c55e"
                strokeWidth={2}
                className="animate-pulse"
              />
              <circle
                cx={(currentMinute / 90) * width}
                cy={centerY}
                r={4}
                fill="#22c55e"
                stroke="#0B0E11"
                strokeWidth={1.5}
              />
            </g>
          )}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-fog pt-1 border-t border-line">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#E5B869]" />
            {fixture.home.name} Attacking Dominance
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#38BDF8]" />
            {fixture.away.name} Attacking Dominance
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span>⚽ Goal Scored</span>
          <span>• Event Trigger</span>
        </div>
      </div>
    </div>
  );
}
