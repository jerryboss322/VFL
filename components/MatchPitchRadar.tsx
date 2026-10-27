"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Club, Fixture, MatchEvent } from "@/types/api";
import {
  FORMATION_PRESETS,
  type FormationKey,
  type PlayerRole,
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

const ROLE_LABELS: Record<PlayerRole, string> = {
  GK: "Starting Goalkeeper",
  CB: "Central Defender",
  LB: "Left Wingback",
  RB: "Right Wingback",
  LWB: "Left Attacking Wingback",
  RWB: "Right Attacking Wingback",
  CDM: "Defensive Anchor",
  CM: "Box-to-Box Midfielder",
  CAM: "Advanced Playmaker",
  LM: "Left Wide Midfielder",
  RM: "Right Wide Midfielder",
  LW: "Left Inverted Winger",
  RW: "Right Inverted Winger",
  ST: "Center Forward Striker",
  CF: "Second Striker",
};

interface TrailPoint {
  x: number;
  y: number;
  z: number;
  opacity: number;
}

interface HoveredPlayer {
  isHome: boolean;
  number: number;
  role: PlayerRole;
  title: string;
  rating: number;
  x: number;
  y: number;
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
  const [showHeatZones, setShowHeatZones] = useState<boolean>(false);
  const [showRadarSweep, setShowRadarSweep] = useState<boolean>(true);
  const [hoveredPlayer, setHoveredPlayer] = useState<HoveredPlayer | null>(null);

  // Derive ball target and attacking context from latest event or simulated time
  const latestEvent = events.length > 0 ? events[events.length - 1] : null;

  const targetState = useMemo(() => {
    if (!isLive && fixture.status !== "live") {
      return {
        targetPos: { x: 50, y: 50, z: 0 },
        actionLabel: fixture.status === "completed" ? "Full Time Whistle" : "Kickoff Approaching",
        attackingSide: "neutral" as const,
        dangerLevel: 0,
        isGoal: false,
        isCorner: false,
        isShot: false,
      };
    }

    const sec = clockSeconds ?? 0;
    const seed = (sec * 29 + (latestEvent?.minute ?? 0) * 17) % 100;
    const isHome = (sec % 30) < 16;
    const side = isHome ? "home" : "away";

    let x = 50;
    let y = 50;
    let z = 0;
    let label = "Midfield Possession Battle";
    let danger = 0;
    let isGoal = false;
    let isCorner = false;
    let isShot = false;

    const eventText = latestEvent?.text?.toLowerCase() ?? "";

    if (eventText.includes("goal") || eventText.includes("scores")) {
      x = isHome ? 96 : 4;
      y = 50 + ((seed % 16) - 8);
      z = 2.4;
      label = isHome ? `GOAL! ${fixture.home.shortName} Strike` : `GOAL! ${fixture.away.shortName} Strike`;
      danger = 3;
      isGoal = true;
      isShot = true;
    } else if (eventText.includes("penalty")) {
      x = isHome ? 88 : 12;
      y = 50;
      z = 1.2;
      label = "PENALTY KICK AWARDED";
      danger = 3;
      isShot = true;
    } else if (eventText.includes("danger") || eventText.includes("chance") || eventText.includes("shot")) {
      x = isHome ? 80 + (seed % 14) : 20 - (seed % 14);
      y = 30 + (seed % 40);
      z = 2.0;
      label = isHome ? `${fixture.home.name} Dangerous Attack` : `${fixture.away.name} Dangerous Attack`;
      danger = 2;
      isShot = true;
    } else if (eventText.includes("corner")) {
      x = isHome ? 98 : 2;
      y = seed % 2 === 0 ? 5 : 95;
      z = 5.5;
      label = "Corner Kick (Inswinging Arc)";
      danger = 2;
      isCorner = true;
    } else {
      // Fluid possession progression
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
      targetPos: {
        x: Math.max(4, Math.min(96, x)),
        y: Math.max(6, Math.min(94, y)),
        z,
      },
      actionLabel: latestEvent?.text || label,
      attackingSide: side,
      dangerLevel: danger,
      isGoal,
      isCorner,
      isShot,
    };
  }, [clockSeconds, fixture, isLive, latestEvent]);

  // Dynamic target positions for home and away XI
  const targetHomePlayers = useMemo(() => {
    const preset = FORMATION_PRESETS[homeFormation];
    return calculateDynamicTeamPositions(preset, targetState.targetPos, true, 1.1);
  }, [homeFormation, targetState.targetPos]);

  const targetAwayPlayers = useMemo(() => {
    const preset = FORMATION_PRESETS[awayFormation];
    return calculateDynamicTeamPositions(preset, targetState.targetPos, false, 1.1);
  }, [awayFormation, targetState.targetPos]);

  // Spatial control grid (throttled to target updates only to eliminate 60fps re-calc overhead)
  const pitchControlGrid = useMemo(() => {
    return computePitchControlGrid(targetHomePlayers, targetAwayPlayers, 8, 6);
  }, [targetHomePlayers, targetAwayPlayers]);

  const currentXT = useMemo(() => {
    return getExpectedThreat(targetState.targetPos.x, targetState.targetPos.y, targetState.attackingSide === "home");
  }, [targetState.targetPos, targetState.attackingSide]);

  const fieldTilt = useMemo(() => {
    const homeFinalThird = pitchControlGrid.filter((c) => c.centerX >= 66);
    const homeTiltScore = homeFinalThird.reduce((acc, c) => acc + (c.controlScore > 0 ? c.controlScore : 0), 0);
    const awayFinalThird = pitchControlGrid.filter((c) => c.centerX <= 33);
    const awayTiltScore = awayFinalThird.reduce((acc, c) => acc + (c.controlScore < 0 ? -c.controlScore : 0), 0);
    const sum = homeTiltScore + awayTiltScore;
    if (sum === 0) return 50;
    return Math.round((homeTiltScore / sum) * 100);
  }, [pitchControlGrid]);

  // ---------------------------------------------------------------------------
  // 60 FPS CONTINUOUS PHYSICS & INTERPOLATION ENGINE
  // ---------------------------------------------------------------------------
  const [renderedBall, setRenderedBall] = useState({ x: 50, y: 50, z: 0 });
  const [trail, setTrail] = useState<TrailPoint[]>([]);
  const [homePositions, setHomePositions] = useState(() =>
    targetHomePlayers.map((p) => ({ number: p.number, x: p.currentX, y: p.currentY }))
  );
  const [awayPositions, setAwayPositions] = useState(() =>
    targetAwayPlayers.map((p) => ({ number: p.number, x: p.currentX, y: p.currentY }))
  );
  const [radarScanX, setRadarScanX] = useState<number>(0);
  const [goalShockwaveRadius, setGoalShockwaveRadius] = useState<number>(0);

  // Keep references for animation frame calculations without triggering hook re-subscriptions
  const ballPosRef = useRef({ x: 50, y: 50, z: 0 });
  const targetBallRef = useRef(targetState.targetPos);
  const targetHomeRef = useRef(targetHomePlayers);
  const targetAwayRef = useRef(targetAwayPlayers);
  const isGoalRef = useRef(targetState.isGoal);
  const trailRef = useRef<TrailPoint[]>([]);

  useEffect(() => {
    targetBallRef.current = targetState.targetPos;
    isGoalRef.current = targetState.isGoal;
  }, [targetState.targetPos, targetState.isGoal]);

  useEffect(() => {
    targetHomeRef.current = targetHomePlayers;
  }, [targetHomePlayers]);

  useEffect(() => {
    targetAwayRef.current = targetAwayPlayers;
  }, [targetAwayPlayers]);

  // High-performance requestAnimationFrame 60fps Loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();
    let scanPos = 0;
    let shockwave = 0;

    const frameLoop = (time: number) => {
      const dt = Math.min(0.08, (time - lastTime) / 1000);
      lastTime = time;

      // Smooth ball interpolation (lerp factor based on delta time)
      const lerpBallFactor = Math.min(1.0, dt * 6.5);
      const curB = ballPosRef.current;
      const tgtB = targetBallRef.current;

      const nextX = curB.x + (tgtB.x - curB.x) * lerpBallFactor;
      const nextY = curB.y + (tgtB.y - curB.y) * lerpBallFactor;
      const nextZ = curB.z + (tgtB.z - curB.z) * lerpBallFactor;

      ballPosRef.current = { x: nextX, y: nextY, z: nextZ };
      setRenderedBall({ x: nextX, y: nextY, z: nextZ });

      // Trail recording (sample every ~3 frames)
      const currentTrail = trailRef.current;
      const updatedTrail: TrailPoint[] = [
        { x: nextX, y: nextY, z: nextZ, opacity: 0.65 },
        ...currentTrail
          .slice(0, 5)
          .map((p) => ({ ...p, opacity: p.opacity * 0.75 })),
      ];
      trailRef.current = updatedTrail;
      setTrail(updatedTrail);

      // Smooth player drifting towards tactical anchors
      const lerpPlayerFactor = Math.min(1.0, dt * 4.2);
      setHomePositions((prev) =>
        targetHomeRef.current.map((tgt, i) => {
          const current = prev[i] || { x: tgt.currentX, y: tgt.currentY };
          return {
            number: tgt.number,
            x: current.x + (tgt.currentX - current.x) * lerpPlayerFactor,
            y: current.y + (tgt.currentY - current.y) * lerpPlayerFactor,
          };
        })
      );

      setAwayPositions((prev) =>
        targetAwayRef.current.map((tgt, i) => {
          const current = prev[i] || { x: tgt.currentX, y: tgt.currentY };
          return {
            number: tgt.number,
            x: current.x + (tgt.currentX - current.x) * lerpPlayerFactor,
            y: current.y + (tgt.currentY - current.y) * lerpPlayerFactor,
          };
        })
      );

      // Radar scanline position
      scanPos = (scanPos + dt * 24) % 105;
      setRadarScanX(scanPos);

      // Goal shockwave effect
      if (isGoalRef.current) {
        shockwave = (shockwave + dt * 40) % 36;
        setGoalShockwaveRadius(shockwave);
      } else {
        setGoalShockwaveRadius(0);
      }

      animId = requestAnimationFrame(frameLoop);
    };

    animId = requestAnimationFrame(frameLoop);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Find player currently closest to the ball (possession highlight)
  const activeCarrier = useMemo(() => {
    let closestDist = Infinity;
    let carrier: { isHome: boolean; number: number; x: number; y: number } | null = null;

    for (const p of homePositions) {
      const d = Math.hypot(p.x - renderedBall.x, p.y - renderedBall.y);
      if (d < closestDist && d < 9.0) {
        closestDist = d;
        carrier = { isHome: true, number: p.number, x: p.x, y: p.y };
      }
    }
    for (const p of awayPositions) {
      const d = Math.hypot(p.x - renderedBall.x, p.y - renderedBall.y);
      if (d < closestDist && d < 9.0) {
        closestDist = d;
        carrier = { isHome: false, number: p.number, x: p.x, y: p.y };
      }
    }
    return carrier;
  }, [homePositions, awayPositions, renderedBall.x, renderedBall.y]);

  return (
    <div className="b365-card p-4 space-y-4">
      {/* Header telemetry & Action Callout */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-3">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-accent animate-pulse" />
          <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-white">
            2D Tactical Radar • 60 FPS Live Match Engine
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

      {/* Action Banner with Goal Alert */}
      <div className="flex items-center justify-between rounded-lg bg-surface px-3 py-2 border border-line">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${
              targetState.dangerLevel === 3
                ? "bg-loss animate-ping"
                : targetState.dangerLevel === 2
                  ? "bg-gold animate-pulse"
                  : "bg-accent"
            }`}
          />
          <span className="font-mono text-xs font-semibold text-white flex items-center gap-2">
            {targetState.isGoal && <span className="text-gold font-black">⚽ GOAL!</span>}
            {targetState.actionLabel}
          </span>
        </div>
        <div className="font-mono text-[11px] text-fog uppercase">
          Coords: <span className="text-white font-bold">{renderedBall.x.toFixed(1)}m, {renderedBall.y.toFixed(1)}m</span>
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
              <feGaussianBlur in="SourceGraphic" stdDeviation="0.6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Shockwave gradient for goal celebration */}
            <radialGradient id="goalShockwave" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#E5B869" stopOpacity="0.8" />
              <stop offset="60%" stopColor="#E5B869" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#E5B869" stopOpacity="0" />
            </radialGradient>

            {/* Danger target glow */}
            <radialGradient id="dangerReticle" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.5" />
              <stop offset="70%" stopColor="#ef4444" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Grass Background */}
          <rect x="0" y="0" width="105" height="68" fill="url(#turfPattern)" />

          {/* Radar Sweep Line (Tactical Scan Broadcast Effect) */}
          {showRadarSweep && (
            <line
              x1={radarScanX}
              y1="2.5"
              x2={radarScanX}
              y2="65.5"
              stroke="#38BDF8"
              strokeWidth="0.6"
              strokeOpacity="0.22"
            />
          )}

          {/* Pitch Control Grid overlay (optional) */}
          {showHeatZones &&
            pitchControlGrid.map((cell) => {
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

          {/* PITCH MARKINGS */}
          <g stroke="#ffffff" strokeWidth="0.35" strokeOpacity="0.75" fill="none">
            {/* Outer Boundary */}
            <rect x="2.5" y="2.5" width="100" height="63" rx="0.5" />

            {/* Halfway Line & Center Circle */}
            <line x1="52.5" y1="2.5" x2="52.5" y2="65.5" />
            <circle cx="52.5" cy="34" r="9.15" />
            <circle cx="52.5" cy="34" r="0.6" fill="#ffffff" />

            {/* Left Box (Home Box) */}
            <rect x="2.5" y="13.84" width="16.5" height="40.32" />
            <rect x="2.5" y="24.84" width="5.5" height="18.32" />
            <circle cx="13.5" cy="34" r="0.6" fill="#ffffff" />
            <path d="M 19 27.5 A 9.15 9.15 0 0 1 19 40.5" />

            {/* Right Box (Away Box) */}
            <rect x="86" y="13.84" width="16.5" height="40.32" />
            <rect x="97" y="24.84" width="5.5" height="18.32" />
            <circle cx="91.5" cy="34" r="0.6" fill="#ffffff" />
            <path d="M 86 27.5 A 9.15 9.15 0 0 0 86 40.5" />

            {/* Corner Arcs */}
            <path d="M 2.5 3.5 A 1 1 0 0 0 3.5 2.5" />
            <path d="M 2.5 64.5 A 1 1 0 0 1 3.5 65.5" />
            <path d="M 102.5 3.5 A 1 1 0 0 1 101.5 2.5" />
            <path d="M 102.5 64.5 A 1 1 0 0 0 101.5 65.5" />

            {/* Goals */}
            <rect x="0.5" y="30.34" width="2" height="7.32" strokeWidth="0.5" fill="#ffffff" fillOpacity="0.15" />
            <rect x="102.5" y="30.34" width="2" height="7.32" strokeWidth="0.5" fill="#ffffff" fillOpacity="0.15" />
          </g>

          {/* DANGER TARGET RETICLE */}
          {targetState.dangerLevel >= 2 && (
            <g>
              <circle
                cx={targetState.targetPos.x > 50 ? 94 : 11}
                cy={34}
                r={14}
                fill="url(#dangerReticle)"
              />
              <circle
                cx={targetState.targetPos.x > 50 ? 94 : 11}
                cy={34}
                r={6}
                stroke="#ef4444"
                strokeWidth="0.3"
                strokeDasharray="1.5 1.5"
                fill="none"
              />
            </g>
          )}

          {/* GOAL CELEBRATION SHOCKWAVE RINGS */}
          {targetState.isGoal && goalShockwaveRadius > 0 && (
            <g>
              <circle
                cx={targetState.targetPos.x > 50 ? 102.5 : 2.5}
                cy={34}
                r={goalShockwaveRadius}
                fill="none"
                stroke="#E5B869"
                strokeWidth={0.8}
                strokeOpacity={Math.max(0, 1 - goalShockwaveRadius / 36)}
              />
              <circle
                cx={targetState.targetPos.x > 50 ? 102.5 : 2.5}
                cy={34}
                r={Math.max(0, goalShockwaveRadius - 8)}
                fill="none"
                stroke="#ffffff"
                strokeWidth={0.5}
                strokeOpacity={Math.max(0, 1 - goalShockwaveRadius / 36)}
              />
            </g>
          )}

          {/* ACTIVE CARRIER POSSESSION AURA */}
          {activeCarrier && (
            <circle
              cx={(activeCarrier.x / 100) * 105}
              cy={(activeCarrier.y / 100) * 68}
              r={3.8}
              fill="none"
              stroke={activeCarrier.isHome ? "#E5B869" : "#38BDF8"}
              strokeWidth="0.4"
              strokeOpacity="0.8"
              strokeDasharray="2 1"
            />
          )}

          {/* HOME PLAYERS (Gold Dots - smoothly animated at 60 FPS) */}
          <g id="home-players">
            {homePositions.map((pos) => {
              const baseData = targetHomePlayers.find((p) => p.number === pos.number);
              const px = (pos.x / 100) * 105;
              const py = (pos.y / 100) * 68;
              const role = baseData?.role || "CM";
              const title = ROLE_LABELS[role] || "Outfield Player";

              return (
                <g
                  key={`home-${pos.number}`}
                  className="cursor-pointer"
                  onMouseEnter={() =>
                    setHoveredPlayer({
                      isHome: true,
                      number: pos.number,
                      role,
                      title,
                      rating: baseData?.rating || 7.2,
                      x: px,
                      y: py,
                    })
                  }
                  onMouseLeave={() => setHoveredPlayer(null)}
                >
                  <circle
                    cx={px}
                    cy={py}
                    r={1.85}
                    fill="#E5B869"
                    stroke="#0B0E11"
                    strokeWidth="0.45"
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
                      {pos.number}
                    </text>
                  )}
                </g>
              );
            })}
          </g>

          {/* AWAY PLAYERS (Sky Blue Dots - smoothly animated at 60 FPS) */}
          <g id="away-players">
            {awayPositions.map((pos) => {
              const baseData = targetAwayPlayers.find((p) => p.number === pos.number);
              const px = (pos.x / 100) * 105;
              const py = (pos.y / 100) * 68;
              const role = baseData?.role || "CM";
              const title = ROLE_LABELS[role] || "Outfield Player";

              return (
                <g
                  key={`away-${pos.number}`}
                  className="cursor-pointer"
                  onMouseEnter={() =>
                    setHoveredPlayer({
                      isHome: false,
                      number: pos.number,
                      role,
                      title,
                      rating: baseData?.rating || 7.2,
                      x: px,
                      y: py,
                    })
                  }
                  onMouseLeave={() => setHoveredPlayer(null)}
                >
                  <circle
                    cx={px}
                    cy={py}
                    r={1.85}
                    fill="#38BDF8"
                    stroke="#0B0E11"
                    strokeWidth="0.45"
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
                      {pos.number}
                    </text>
                  )}
                </g>
              );
            })}
          </g>

          {/* BALL MOTION TRAIL (Comet passing streak) */}
          <g id="ball-flight-trail">
            {trail.map((p, idx) => (
              <circle
                key={`trail-${idx}`}
                cx={(p.x / 100) * 105}
                cy={(p.y / 100) * 68 - p.z * 0.45}
                r={Math.max(0.4, 1.2 - idx * 0.18)}
                fill="#ffffff"
                fillOpacity={p.opacity * (1 - idx / 6)}
              />
            ))}
          </g>

          {/* BALL & 2.5D DYNAMIC SHADOW */}
          <g id="ball-group">
            {/* Dynamic Ground Shadow */}
            <ellipse
              cx={(renderedBall.x / 100) * 105}
              cy={(renderedBall.y / 100) * 68 + renderedBall.z * 0.35}
              rx={1.2 + renderedBall.z * 0.15}
              ry={0.6 + renderedBall.z * 0.1}
              fill="#000000"
              fillOpacity={Math.max(0.12, 0.45 - renderedBall.z * 0.04)}
            />

            {/* Elevated Ball Sphere */}
            <circle
              cx={(renderedBall.x / 100) * 105}
              cy={(renderedBall.y / 100) * 68 - renderedBall.z * 0.55}
              r={1.25 + renderedBall.z * 0.12}
              fill="#ffffff"
              stroke="#111827"
              strokeWidth="0.3"
              filter="url(#ballGlow)"
            />
          </g>

          {/* TACTICAL HOVER CARD (Clean Role & Squad Number — Zero Real Player Names) */}
          {hoveredPlayer && (
            <g
              transform={`translate(${Math.max(12, Math.min(93, hoveredPlayer.x))}, ${Math.max(
                10,
                hoveredPlayer.y - 8
              )})`}
            >
              <rect
                x="-18"
                y="-6.5"
                width="36"
                height="8.5"
                rx="1"
                fill="#0B0E11"
                stroke={hoveredPlayer.isHome ? "#E5B869" : "#38BDF8"}
                strokeWidth="0.35"
                fillOpacity="0.95"
              />
              <text
                x="0"
                y="-3.5"
                fontSize="1.6"
                fontWeight="bold"
                fill="#ffffff"
                textAnchor="middle"
                className="font-mono"
              >
                {hoveredPlayer.isHome ? fixture.home.shortName : fixture.away.shortName} #{hoveredPlayer.number} • {hoveredPlayer.role}
              </text>
              <text
                x="0"
                y="-1.0"
                fontSize="1.15"
                fill="#A1A1AA"
                textAnchor="middle"
                className="font-mono"
              >
                {hoveredPlayer.title}
              </text>
            </g>
          )}
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
            checked={showRadarSweep}
            onChange={(e) => setShowRadarSweep(e.target.checked)}
            className="rounded border-line text-accent focus:ring-0"
          />
            Tactical Scanline Beam
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer hover:text-white">
          <input
            type="checkbox"
            checked={showPlayerNumbers}
            onChange={(e) => setShowPlayerNumbers(e.target.checked)}
            className="rounded border-line text-accent focus:ring-0"
          />
          Squad Numbers
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer hover:text-white">
          <input
            type="checkbox"
            checked={showHeatZones}
            onChange={(e) => setShowHeatZones(e.target.checked)}
            className="rounded border-line text-accent focus:ring-0"
          />
          Spatial Control Heatmap
        </label>
      </div>
    </div>
  );
}
