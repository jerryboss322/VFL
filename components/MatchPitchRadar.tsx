"use client";

import React, { useMemo, useState } from "react";
import type { Club, Fixture, MatchEvent } from "@/types/api";
import {
  FORMATION_PRESETS,
  type FormationKey,
  calculateDynamicTeamPositions,
  computePitchControlGrid,
  getExpectedThreat,
} from "@/lib/tactical_engine";

export interface MatchPitchRadarProps {
  fixture: Fixture;
  homeClub?: Club | null;
  awayClub?: Club | null;
  events?: MatchEvent[];
  clockSeconds?: number;
  isLive?: boolean;
}

export function MatchPitchRadar({
  fixture,
  homeClub,
  awayClub,
  events = [],
  clockSeconds = 0,
  isLive = false,
}: MatchPitchRadarProps) {
  const [homeFormation, setHomeFormation] = useState<FormationKey>("4-3-3");
  const [awayFormation, setAwayFormation] = useState<FormationKey>("4-2-3-1");
  const [showPitchGrid, setShowPitchGrid] = useState<boolean>(true);
  const [showPlayerNumbers, setShowPlayerNumbers] = useState<boolean>(true);
  const [showHeatZones, setShowHeatZones] = useState<boolean>(true);

  // Derive ball position and attacking context from latest event or simulated time
  const latestEvent = events.length > 0 ? events[events.length - 1] : null;

  const { ballPos, actionLabel, attackingSide, dangerLevel } = useMemo(() => {
    if (!isLive && fixture.status !== "live") {
      return {
        ballPos: { x: 50, y: 50 },
        actionLabel: fixture.status === "completed" ? "Full Time Whistle" : "Kickoff Approaching",
        attackingSide: "neutral" as const,
        dangerLevel: 0,
      };
    }

    // Deterministic pseudo-random movement based on clock and recent event
    const sec = clockSeconds ?? 0;
    const seed = (sec * 29 + (latestEvent?.minute ?? 0) * 17) % 100;
    const isHome = (sec % 30) < 16;
    const side = isHome ? "home" : "away";

    let x = 50;
    let y = 50;
    let label = "Midfield Possession Battle";
    let danger = 0;

    const eventText = latestEvent?.text?.toLowerCase() ?? "";

    if (eventText.includes("goal") || eventText.includes("scores")) {
      x = isHome ? 94 : 6;
      y = 50 + (seed % 16 - 8);
      label = "GOAL! High Velocity Strike";
      danger = 3;
    } else if (eventText.includes("penalty")) {
      x = isHome ? 88 : 12;
      y = 50;
      label = "PENALTY AWARDED";
      danger = 3;
    } else if (eventText.includes("danger") || eventText.includes("chance") || eventText.includes("shot")) {
      x = isHome ? 78 + (seed % 14) : 22 - (seed % 14);
      y = 30 + (seed % 40);
      label = isHome ? `${fixture.home.name} Dangerous Attack` : `${fixture.away.name} Dangerous Attack`;
      danger = 2;
    } else if (eventText.includes("corner")) {
      x = isHome ? 98 : 2;
      y = seed % 2 === 0 ? 5 : 95;
      label = "Corner Kick (Inswinging)";
      danger = 2;
    } else {
      // Normal continuous flow
      if (isHome) {
        x = 42 + (seed % 46);
        y = 15 + (seed % 70);
        label = x > 72 ? `${fixture.home.name} Final Third Pressure` : `${fixture.home.name} Midfield Progression`;
        danger = x > 72 ? 1 : 0;
      } else {
        x = 58 - (seed % 46);
        y = 15 + (seed % 70);
        label = x < 28 ? `${fixture.away.name} Final Third Pressure` : `${fixture.away.name} Midfield Progression`;
        danger = x < 28 ? 1 : 0;
      }
    }

    return {
      ballPos: { x: Math.max(4, Math.min(96, x)), y: Math.max(6, Math.min(94, y)) },
      actionLabel: latestEvent?.text || label,
      attackingSide: side,
      dangerLevel: danger,
    };
  }, [clockSeconds, fixture, isLive, latestEvent]);

  // Dynamic positions for home and away XI
  const homePlayers = useMemo(() => {
    const preset = FORMATION_PRESETS[homeFormation];
    return calculateDynamicTeamPositions(preset, ballPos, true, 1.1);
  }, [homeFormation, ballPos]);

  const awayPlayers = useMemo(() => {
    const preset = FORMATION_PRESETS[awayFormation];
    return calculateDynamicTeamPositions(preset, ballPos, false, 1.1);
  }, [awayFormation, ballPos]);

  const pitchControlGrid = useMemo(() => {
    return computePitchControlGrid(homePlayers, awayPlayers, 8, 6);
  }, [homePlayers, awayPlayers]);

  const currentXT = useMemo(() => {
    return getExpectedThreat(ballPos.x, ballPos.y, attackingSide === "home");
  }, [ballPos, attackingSide]);

  const fieldTilt = useMemo(() => {
    // Percentage of home vs away control in the opposing final thirds
    const homeFinalThird = pitchControlGrid.filter((c) => c.centerX >= 66);
    const homeTiltScore = homeFinalThird.reduce((acc, c) => acc + (c.controlScore > 0 ? c.controlScore : 0), 0);
    const awayFinalThird = pitchControlGrid.filter((c) => c.centerX <= 33);
    const awayTiltScore = awayFinalThird.reduce((acc, c) => acc + (c.controlScore < 0 ? -c.controlScore : 0), 0);
    const sum = homeTiltScore + awayTiltScore;
    if (sum === 0) return 50;
    return Math.round((homeTiltScore / sum) * 100);
  }, [pitchControlGrid]);

  return (
    <div className="b365-card p-4 space-y-4">
      {/* Header telemetry & Action Callout */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-3">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-accent animate-pulse" />
          <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-white">
            2D Tactical Radar • Match Engine Live Feed
          </h3>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="text-fog">
            Expected Threat:{" "}
            <strong className="text-accent">{currentXT.toFixed(3)} xT</strong>
          </span>
          <span className="text-fog">
            Field Tilt:{" "}
            <strong className="text-gold">{fieldTilt}% Home</strong>
          </span>
        </div>
      </div>

      {/* Action Banner */}
      <div className="flex items-center justify-between rounded-lg bg-surface px-3 py-2 border border-line">
        <div className="flex items-center gap-2">
          <span className={`inline-block h-2 w-2 rounded-full ${
            dangerLevel === 3
              ? "bg-loss animate-ping"
              : dangerLevel === 2
                ? "bg-gold animate-pulse"
                : "bg-accent"
          }`} />
          <span className="font-mono text-xs font-semibold text-white">
            {actionLabel}
          </span>
        </div>
        <div className="font-mono text-[11px] text-fog uppercase">
          Pos: <span className="text-white font-bold">{ballPos.x.toFixed(0)}m, {ballPos.y.toFixed(0)}m</span>
        </div>
      </div>

      {/* Main SVG Pitch Canvas (105m x 68m standard pitch ratio) */}
      <div className="relative aspect-[105/68] w-full overflow-hidden rounded-xl border border-line shadow-2xl bg-[#142e18]">
        <svg
          viewBox="0 0 105 68"
          className="h-full w-full select-none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Alternating lawn stripes */}
            <pattern id="turfPattern" width="10.5" height="68" patternUnits="userSpaceOnUse">
              <rect x="0" y="0" width="5.25" height="68" fill="#143219" />
              <rect x="5.25" y="0" width="5.25" height="68" fill="#17381c" />
            </pattern>

            {/* Glowing filter for ball */}
            <filter id="ballGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="0.8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Radial danger zone glow */}
            <radialGradient id="dangerGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.45" />
              <stop offset="60%" stopColor="#ef4444" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Grass Background */}
          <rect x="0" y="0" width="105" height="68" fill="url(#turfPattern)" />

          {/* Pitch Control Grid overlay (optional) */}
          {showHeatZones && pitchControlGrid.map((cell) => {
            const isHomeDominant = cell.controlScore > 0;
            const opacity = Math.min(0.25, Math.abs(cell.controlScore) * 0.35);
            const color = isHomeDominant ? "#E5B869" : "#38BDF8";
            const w = 105 / 8;
            const h = 68 / 6;
            return (
              <rect
                key={`cell-${cell.col}-${cell.row}`}
                x={cell.col * w}
                y={cell.row * h}
                width={w}
                height={h}
                fill={color}
                fillOpacity={opacity}
                stroke="#ffffff"
                strokeOpacity={showPitchGrid ? 0.05 : 0}
                strokeWidth={0.2}
              />
            );
          })}

          {/* Danger Zone Heat Indicator */}
          {dangerLevel >= 2 && (
            <circle
              cx={(ballPos.x / 100) * 105}
              cy={(ballPos.y / 100) * 68}
              r={12}
              fill="url(#dangerGlow)"
              className="animate-pulse"
            />
          )}

          {/* PITCH MARKINGS (Standard White Lines 0.3px) */}
          <g stroke="#ffffff" strokeWidth="0.35" strokeOpacity="0.75" fill="none">
            {/* Outer Boundary */}
            <rect x="2.5" y="2.5" width="100" height="63" rx="0.5" />

            {/* Halfway Line & Center Circle */}
            <line x1="52.5" y1="2.5" x2="52.5" y2="65.5" />
            <circle cx="52.5" cy="34" r="9.15" />
            <circle cx="52.5" cy="34" r="0.6" fill="#ffffff" />

            {/* Left Box (Home Defending) */}
            <rect x="2.5" y="13.84" width="16.5" height="40.32" />
            <rect x="2.5" y="24.84" width="5.5" height="18.32" />
            <circle cx="13.5" cy="34" r="0.6" fill="#ffffff" />
            {/* Penalty Arc */}
            <path d="M 19 27.5 A 9.15 9.15 0 0 1 19 40.5" />

            {/* Right Box (Away Defending) */}
            <rect x="86" y="13.84" width="16.5" height="40.32" />
            <rect x="97" y="24.84" width="5.5" height="18.32" />
            <circle cx="91.5" cy="34" r="0.6" fill="#ffffff" />
            {/* Penalty Arc */}
            <path d="M 86 27.5 A 9.15 9.15 0 0 0 86 40.5" />

            {/* Corner Arcs */}
            <path d="M 2.5 3.5 A 1 1 0 0 0 3.5 2.5" />
            <path d="M 2.5 64.5 A 1 1 0 0 1 3.5 65.5" />
            <path d="M 102.5 3.5 A 1 1 0 0 1 101.5 2.5" />
            <path d="M 102.5 64.5 A 1 1 0 0 0 101.5 65.5" />

            {/* Goals (Slightly outside boundary) */}
            <rect x="0.5" y="30.34" width="2" height="7.32" strokeWidth="0.5" fill="#ffffff" fillOpacity="0.15" />
            <rect x="102.5" y="30.34" width="2" height="7.32" strokeWidth="0.5" fill="#ffffff" fillOpacity="0.15" />
          </g>

          {/* HOME PLAYERS (Gold Dots) */}
          <g id="home-players">
            {homePlayers.map((p) => {
              const px = (p.currentX / 100) * 105;
              const py = (p.currentY / 100) * 68;
              return (
                <g key={`home-${p.number}`} className="transition-all duration-700 ease-out">
                  <circle
                    cx={px}
                    cy={py}
                    r={1.75}
                    fill="#E5B869"
                    stroke="#0B0E11"
                    strokeWidth="0.4"
                  />
                  {showPlayerNumbers && (
                    <text
                      x={px}
                      y={py + 0.55}
                      fontSize="1.15"
                      fontWeight="bold"
                      fill="#0B0E11"
                      textAnchor="middle"
                      className="font-mono select-none"
                    >
                      {p.number}
                    </text>
                  )}
                </g>
              );
            })}
          </g>

          {/* AWAY PLAYERS (Sky Blue Dots) */}
          <g id="away-players">
            {awayPlayers.map((p) => {
              const px = (p.currentX / 100) * 105;
              const py = (p.currentY / 100) * 68;
              return (
                <g key={`away-${p.number}`} className="transition-all duration-700 ease-out">
                  <circle
                    cx={px}
                    cy={py}
                    r={1.75}
                    fill="#38BDF8"
                    stroke="#0B0E11"
                    strokeWidth="0.4"
                  />
                  {showPlayerNumbers && (
                    <text
                      x={px}
                      y={py + 0.55}
                      fontSize="1.15"
                      fontWeight="bold"
                      fill="#0B0E11"
                      textAnchor="middle"
                      className="font-mono select-none"
                    >
                      {p.number}
                    </text>
                  )}
                </g>
              );
            })}
          </g>

          {/* BALL with pulsing tracking ring */}
          <g className="transition-all duration-500 ease-out">
            <circle
              cx={(ballPos.x / 100) * 105}
              cy={(ballPos.y / 100) * 68}
              r={2.4}
              fill="none"
              stroke="#ffffff"
              strokeWidth="0.3"
              strokeOpacity="0.75"
              className="animate-ping"
            />
            <circle
              cx={(ballPos.x / 100) * 105}
              cy={(ballPos.y / 100) * 68}
              r={1.2}
              fill="#ffffff"
              stroke="#111827"
              strokeWidth="0.3"
              filter="url(#ballGlow)"
            />
          </g>
        </svg>
      </div>

      {/* Interactive Controls & Formation Switchers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-xs">
        {/* Home Tactical Shape */}
        <div className="flex items-center justify-between rounded-lg bg-surface p-2.5 border border-line">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#E5B869]" />
            <span className="font-semibold text-white">{fixture.home.shortName} Formation</span>
          </div>
          <select
            value={homeFormation}
            onChange={(e) => setHomeFormation(e.target.value as FormationKey)}
            className="rounded bg-coal px-2.5 py-1 font-mono text-[11px] text-white border border-line focus:border-accent focus:outline-none"
          >
            {Object.keys(FORMATION_PRESETS).map((key) => (
              <option key={key} value={key}>
                {key} ({FORMATION_PRESETS[key as FormationKey].label})
              </option>
            ))}
          </select>
        </div>

        {/* Away Tactical Shape */}
        <div className="flex items-center justify-between rounded-lg bg-surface p-2.5 border border-line">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#38BDF8]" />
            <span className="font-semibold text-white">{fixture.away.shortName} Formation</span>
          </div>
          <select
            value={awayFormation}
            onChange={(e) => setAwayFormation(e.target.value as FormationKey)}
            className="rounded bg-coal px-2.5 py-1 font-mono text-[11px] text-white border border-line focus:border-accent focus:outline-none"
          >
            {Object.keys(FORMATION_PRESETS).map((key) => (
              <option key={key} value={key}>
                {key} ({FORMATION_PRESETS[key as FormationKey].label})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Display Options Checkboxes */}
      <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-fog pt-1 border-t border-line">
        <label className="flex items-center gap-1.5 cursor-pointer hover:text-white">
          <input
            type="checkbox"
            checked={showHeatZones}
            onChange={(e) => setShowHeatZones(e.target.checked)}
            className="rounded border-line text-accent focus:ring-0"
          />
          Spatial Control Heatmap
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer hover:text-white">
          <input
            type="checkbox"
            checked={showPlayerNumbers}
            onChange={(e) => setShowPlayerNumbers(e.target.checked)}
            className="rounded border-line text-accent focus:ring-0"
          />
          Player Numbers
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer hover:text-white">
          <input
            type="checkbox"
            checked={showPitchGrid}
            onChange={(e) => setShowPitchGrid(e.target.checked)}
            className="rounded border-line text-accent focus:ring-0"
          />
          Grid Subdivisions
        </label>
      </div>
    </div>
  );
}
