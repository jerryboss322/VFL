"use client";

import React, { useMemo, useState } from "react";
import type { Fixture, MatchEvent } from "@/types/api";

export interface TacticalHeatmapProps {
  fixture: Fixture;
  events?: MatchEvent[];
  clockSeconds?: number;
}

interface HeatPoint {
  x: number; // 0-100
  y: number; // 0-100
  intensity: number; // 0.1 - 1.0
  side: "home" | "away";
}

export function TacticalHeatmap({
  fixture,
  events = [],
  clockSeconds = 0,
}: TacticalHeatmapProps) {
  const [filterSide, setFilterSide] = useState<"all" | "home" | "away">("all");
  const [densityMode, setDensityMode] = useState<"touches" | "danger" | "shots">("touches");

  // Generate synthetic and event-based spatial touch distribution
  const heatPoints = useMemo<HeatPoint[]>(() => {
    const pts: HeatPoint[] = [];
    const sec = clockSeconds ?? 0;

    // 1. Incorporate recorded match events
    for (const ev of events) {
      const isHome = (ev.payload?.side ?? (ev.clubId === fixture.home.id ? "home" : "away")) === "home";
      const seed = (ev.minute * 37) % 100;
      let x = isHome ? 75 : 25;
      let y = 30 + (seed % 40);

      const text = ev.text.toLowerCase();
      if (text.includes("corner")) {
        x = isHome ? 98 : 2;
        y = seed % 2 === 0 ? 5 : 95;
      } else if (text.includes("goal") || text.includes("shot")) {
        x = isHome ? 88 + (seed % 10) : 12 - (seed % 10);
        y = 40 + (seed % 20);
      }

      pts.push({
        x: Math.max(3, Math.min(97, x)),
        y: Math.max(5, Math.min(95, y)),
        intensity: text.includes("goal") ? 1.0 : 0.8,
        side: isHome ? "home" : "away",
      });
    }

    // 2. Generate systematic tactical touches based on club ratings
    const homeAtt = fixture.home.attackRating ?? 1.2;
    const awayAtt = fixture.away.attackRating ?? 1.1;

    // Home tactical touches (skewed to right side of pitch)
    for (let i = 0; i < 40; i++) {
      const s = (i * 23 + sec) % 100;
      const x = 30 + (s % 62) * (homeAtt / 1.2);
      const y = 10 + (s % 80);
      pts.push({
        x: Math.max(5, Math.min(95, x)),
        y: Math.max(8, Math.min(92, y)),
        intensity: 0.4 + (s % 50) / 100,
        side: "home",
      });
    }

    // Away tactical touches (skewed to left side of pitch)
    for (let i = 0; i < 40; i++) {
      const s = (i * 29 + sec * 3) % 100;
      const x = 70 - (s % 62) * (awayAtt / 1.2);
      const y = 10 + (s % 80);
      pts.push({
        x: Math.max(5, Math.min(95, x)),
        y: Math.max(8, Math.min(92, y)),
        intensity: 0.4 + (s % 50) / 100,
        side: "away",
      });
    }

    return pts;
  }, [events, clockSeconds, fixture]);

  const filteredPoints = useMemo(() => {
    if (filterSide === "all") return heatPoints;
    return heatPoints.filter((p) => p.side === filterSide);
  }, [heatPoints, filterSide]);

  // Spatial territorial breakdown percentages
  const territoryStats = useMemo(() => {
    const relevant = filteredPoints;
    if (relevant.length === 0) return { defThird: 33, midThird: 34, attThird: 33 };

    let def = 0;
    let mid = 0;
    let att = 0;

    for (const p of relevant) {
      if (filterSide === "away") {
        if (p.x > 66) def++;
        else if (p.x >= 33) mid++;
        else att++;
      } else {
        if (p.x < 33) def++;
        else if (p.x <= 66) mid++;
        else att++;
      }
    }

    const total = def + mid + att;
    return {
      defThird: Math.round((def / total) * 100),
      midThird: Math.round((mid / total) * 100),
      attThird: Math.round((att / total) * 100),
    };
  }, [filteredPoints, filterSide]);

  // Flank attacking bias
  const flankBias = useMemo(() => {
    let left = 0;
    let center = 0;
    let right = 0;
    for (const p of filteredPoints) {
      if (p.y < 35) left++;
      else if (p.y <= 65) center++;
      else right++;
    }
    const sum = left + center + right;
    if (sum === 0) return { left: 33, center: 34, right: 33 };
    return {
      left: Math.round((left / sum) * 100),
      center: Math.round((center / sum) * 100),
      right: Math.round((right / sum) * 100),
    };
  }, [filteredPoints]);

  return (
    <div className="b365-card p-4 space-y-4">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-line pb-3 gap-2">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-gold" />
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-white">
            Positional Touch Density & Heatmap Engine
          </h3>
        </div>

        {/* Team Selector Tabs */}
        <div className="flex items-center gap-1.5 rounded-lg bg-surface p-1 border border-line text-xs font-mono">
          <button
            type="button"
            onClick={() => setFilterSide("all")}
            className={`rounded px-2.5 py-1 transition-all ${
              filterSide === "all" ? "bg-accent text-white font-bold" : "text-fog hover:text-white"
            }`}
          >
            Combined
          </button>
          <button
            type="button"
            onClick={() => setFilterSide("home")}
            className={`rounded px-2.5 py-1 transition-all ${
              filterSide === "home" ? "bg-[#E5B869] text-black font-bold" : "text-fog hover:text-white"
            }`}
          >
            {fixture.home.shortName}
          </button>
          <button
            type="button"
            onClick={() => setFilterSide("away")}
            className={`rounded px-2.5 py-1 transition-all ${
              filterSide === "away" ? "bg-[#38BDF8] text-black font-bold" : "text-fog hover:text-white"
            }`}
          >
            {fixture.away.shortName}
          </button>
        </div>
      </div>

      {/* SVG Pitch Heatmap */}
      <div className="relative aspect-[105/68] w-full overflow-hidden rounded-xl border border-line shadow-2xl bg-[#0e1f11]">
        <svg
          viewBox="0 0 105 68"
          className="h-full w-full select-none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Radial heat spot gradient */}
            <radialGradient id="heatSpotHome" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#E5B869" stopOpacity="0.65" />
              <stop offset="50%" stopColor="#ef4444" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
            </radialGradient>

            <radialGradient id="heatSpotAway" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.65" />
              <stop offset="50%" stopColor="#6366f1" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Pitch background */}
          <rect x="0" y="0" width="105" height="68" fill="#122b17" />

          {/* Heat blobs */}
          {filteredPoints.map((pt, idx) => {
            const cx = (pt.x / 100) * 105;
            const cy = (pt.y / 100) * 68;
            const radius = 6 + pt.intensity * 6;
            const gradId = pt.side === "home" ? "url(#heatSpotHome)" : "url(#heatSpotAway)";
            return (
              <circle
                key={`heat-${idx}`}
                cx={cx}
                cy={cy}
                r={radius}
                fill={gradId}
              />
            );
          })}

          {/* PITCH MARKINGS */}
          <g stroke="#ffffff" strokeWidth="0.35" strokeOpacity="0.6" fill="none">
            <rect x="2.5" y="2.5" width="100" height="63" rx="0.5" />
            <line x1="52.5" y1="2.5" x2="52.5" y2="65.5" />
            <circle cx="52.5" cy="34" r="9.15" />
            <rect x="2.5" y="13.84" width="16.5" height="40.32" />
            <rect x="86" y="13.84" width="16.5" height="40.32" />
            <circle cx="13.5" cy="34" r="0.6" fill="#ffffff" />
            <circle cx="91.5" cy="34" r="0.6" fill="#ffffff" />
            <circle cx="52.5" cy="34" r="0.6" fill="#ffffff" />
          </g>
        </svg>
      </div>

      {/* Territorial Distribution Bars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1 text-xs font-mono">
        {/* Third of Pitch Control */}
        <div className="rounded-lg bg-surface p-3 border border-line space-y-2">
          <div className="flex items-center justify-between text-white font-bold">
            <span>Territory Distribution</span>
            <span className="text-fog">33% / 34% / 33% Baseline</span>
          </div>
          <div className="flex h-3 w-full overflow-hidden rounded bg-coal">
            <div
              style={{ width: `${territoryStats.defThird}%` }}
              className="bg-fog/40 flex items-center justify-center text-[9px] text-white"
              title="Defensive Third"
            >
              {territoryStats.defThird}%
            </div>
            <div
              style={{ width: `${territoryStats.midThird}%` }}
              className="bg-gold/80 flex items-center justify-center text-[9px] text-black font-bold"
              title="Middle Third"
            >
              {territoryStats.midThird}%
            </div>
            <div
              style={{ width: `${territoryStats.attThird}%` }}
              className="bg-accent flex items-center justify-center text-[9px] text-white font-bold"
              title="Attacking Third"
            >
              {territoryStats.attThird}%
            </div>
          </div>
          <div className="flex justify-between text-[10px] text-fog">
            <span>Defensive 1/3</span>
            <span>Middle 1/3</span>
            <span>Final 1/3</span>
          </div>
        </div>

        {/* Flank Attack Bias */}
        <div className="rounded-lg bg-surface p-3 border border-line space-y-2">
          <div className="flex items-center justify-between text-white font-bold">
            <span>Flank Attack Channels</span>
            <span className="text-accent">{flankBias.left}% - {flankBias.center}% - {flankBias.right}%</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
            <div className="rounded bg-coal p-1.5 border border-line">
              <span className="text-fog block text-[10px]">Left Flank</span>
              <strong className="text-white text-xs">{flankBias.left}%</strong>
            </div>
            <div className="rounded bg-coal p-1.5 border border-line">
              <span className="text-fog block text-[10px]">Center Lane</span>
              <strong className="text-gold text-xs">{flankBias.center}%</strong>
            </div>
            <div className="rounded bg-coal p-1.5 border border-line">
              <span className="text-fog block text-[10px]">Right Flank</span>
              <strong className="text-white text-xs">{flankBias.right}%</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
