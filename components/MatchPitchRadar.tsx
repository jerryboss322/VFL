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
  defaultViewMode?: "single" | "squad";
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

interface SinglePlayerState {
  x: number;
  y: number;
  angle: number;
  isHome: boolean;
  number: number;
  role: PlayerRole;
  title: string;
  action: string;
}

interface RadarFrameState {
  ball: { x: number; y: number; z: number };
  trail: TrailPoint[];
  singlePlayer: SinglePlayerState;
  homePositions: { number: number; x: number; y: number }[];
  awayPositions: { number: number; x: number; y: number }[];
  radarScanX: number;
  goalShockwaveRadius: number;
}

export function MatchPitchRadar({
  fixture,
  homeClub,
  awayClub,
  events = [],
  clockSeconds = 0,
  isLive = false,
  defaultViewMode = "single",
}: MatchPitchRadarProps) {
  const [viewMode, setViewMode] = useState<"single" | "squad">(defaultViewMode);
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

  // Dynamic target positions for home and away XI (Tactical squad mode)
  const targetHomePlayers = useMemo(() => {
    const preset = FORMATION_PRESETS[homeFormation];
    return calculateDynamicTeamPositions(preset, targetState.targetPos, true, 1.1);
  }, [homeFormation, targetState.targetPos]);

  const targetAwayPlayers = useMemo(() => {
    const preset = FORMATION_PRESETS[awayFormation];
    return calculateDynamicTeamPositions(preset, targetState.targetPos, false, 1.1);
  }, [awayFormation, targetState.targetPos]);

  // Spatial control grid
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

  // Target data for the SINGLE focal player (Active ball carrier / primary attacker)
  const focalTargetSnapshot = useMemo(() => {
    const isHome =
      targetState.attackingSide === "home" ||
      (targetState.attackingSide === "neutral" && ((clockSeconds ?? 0) % 20 < 10));
    const ballPos = targetState.targetPos;

    let number = 9;
    let role: PlayerRole = "ST";
    let action = "In Possession";
    let targetX = ballPos.x;
    let targetY = ballPos.y;

    if (targetState.isGoal) {
      number = 9;
      role = "ST";
      action = "Goal Strike!";
      targetX = isHome ? Math.max(12, ballPos.x - 3.8) : Math.min(93, ballPos.x + 3.8);
      targetY = ballPos.y;
    } else if (targetState.isShot) {
      number = 9;
      role = "ST";
      action = "Unleashing Shot";
      targetX = isHome ? Math.max(12, ballPos.x - 3.2) : Math.min(93, ballPos.x + 3.2);
      targetY = ballPos.y;
    } else if (targetState.isCorner) {
      number = 7;
      role = "RW";
      action = "Corner Delivery";
      targetX = isHome ? 102.5 : 2.5;
      targetY = ballPos.y > 34 ? 65 : 3;
    } else if (targetState.dangerLevel === 2) {
      number = 10;
      role = "CAM";
      action = "Attacking Penetration";
      targetX = isHome ? Math.max(8, ballPos.x - 2.4) : Math.min(97, ballPos.x + 2.4);
      targetY = ballPos.y;
    } else if (targetState.dangerLevel === 1) {
      number = 8;
      role = "CM";
      action = "Progressive Dribble";
      targetX = isHome ? Math.max(8, ballPos.x - 1.8) : Math.min(97, ballPos.x + 1.8);
      targetY = ballPos.y;
    } else {
      number = 8;
      role = "CM";
      action = "Midfield Orchestration";
      targetX = isHome ? Math.max(6, ballPos.x - 1.5) : Math.min(99, ballPos.x + 1.5);
      targetY = ballPos.y;
    }

    const title = ROLE_LABELS[role] || "Key Playmaker";

    return {
      isHome,
      number,
      role,
      title,
      action,
      targetX,
      targetY,
    };
  }, [targetState, clockSeconds]);

  // ---------------------------------------------------------------------------
  // ULTRA-OPTIMIZED 60 FPS CONTINUOUS PHYSICS ENGINE
  // Consolidated into 1 unified frame state to prevent React reconciliation lag
  // ---------------------------------------------------------------------------
  const [frameState, setFrameState] = useState<RadarFrameState>(() => ({
    ball: { x: 50, y: 50, z: 0 },
    trail: [],
    singlePlayer: {
      x: 48,
      y: 50,
      angle: 0,
      isHome: true,
      number: 9,
      role: "ST",
      title: "Center Forward Striker",
      action: "In Possession",
    },
    homePositions: targetHomePlayers.map((p) => ({ number: p.number, x: p.currentX, y: p.currentY })),
    awayPositions: targetAwayPlayers.map((p) => ({ number: p.number, x: p.currentX, y: p.currentY })),
    radarScanX: 0,
    goalShockwaveRadius: 0,
  }));

  // Mutable refs for zero-overhead animation computations
  const ballPosRef = useRef({ x: 50, y: 50, z: 0 });
  const singlePlayerRef = useRef({ x: 48, y: 50, angle: 0 });
  const homePositionsRef = useRef(
    targetHomePlayers.map((p) => ({ number: p.number, x: p.currentX, y: p.currentY }))
  );
  const awayPositionsRef = useRef(
    targetAwayPlayers.map((p) => ({ number: p.number, x: p.currentX, y: p.currentY }))
  );
  const trailRef = useRef<TrailPoint[]>([]);

  const targetBallRef = useRef(targetState.targetPos);
  const targetFocalRef = useRef(focalTargetSnapshot);
  const targetHomeRef = useRef(targetHomePlayers);
  const targetAwayRef = useRef(targetAwayPlayers);
  const isGoalRef = useRef(targetState.isGoal);
  const viewModeRef = useRef(viewMode);

  useEffect(() => {
    targetBallRef.current = targetState.targetPos;
    isGoalRef.current = targetState.isGoal;
  }, [targetState.targetPos, targetState.isGoal]);

  useEffect(() => {
    targetFocalRef.current = focalTargetSnapshot;
  }, [focalTargetSnapshot]);

  useEffect(() => {
    targetHomeRef.current = targetHomePlayers;
  }, [targetHomePlayers]);

  useEffect(() => {
    targetAwayRef.current = targetAwayPlayers;
  }, [targetAwayPlayers]);

  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  // High-performance single-pass RAF loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();
    let scanPos = 0;
    let shockwave = 0;

    const frameLoop = (time: number) => {
      const dt = Math.min(0.08, (time - lastTime) / 1000);
      lastTime = time;

      // 1. Smooth ball interpolation
      const lerpBallFactor = Math.min(1.0, dt * 6.5);
      const curB = ballPosRef.current;
      const tgtB = targetBallRef.current;

      const nextBX = curB.x + (tgtB.x - curB.x) * lerpBallFactor;
      const nextBY = curB.y + (tgtB.y - curB.y) * lerpBallFactor;
      const nextBZ = curB.z + (tgtB.z - curB.z) * lerpBallFactor;

      ballPosRef.current = { x: nextBX, y: nextBY, z: nextBZ };

      // 2. Ball flight trail
      const currentTrail = trailRef.current;
      const updatedTrail: TrailPoint[] = [
        { x: nextBX, y: nextBY, z: nextBZ, opacity: 0.7 },
        ...currentTrail.slice(0, 5).map((p) => ({ ...p, opacity: p.opacity * 0.72 })),
      ];
      trailRef.current = updatedTrail;

      // 3. Smooth single player interpolation (super fast, sub-0.1ms computation)
      const lerpPlayerFactor = Math.min(1.0, dt * 4.8);
      const curP = singlePlayerRef.current;
      const tgtP = targetFocalRef.current;

      const nextPX = curP.x + (tgtP.targetX - curP.x) * lerpPlayerFactor;
      const nextPY = curP.y + (tgtP.targetY - curP.y) * lerpPlayerFactor;

      // Dynamic angle pointing towards ball or attacking goal
      const dx = nextBX - nextPX;
      const dy = nextBY - nextPY;
      const angle = Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1
        ? Math.atan2(dy, dx) * (180 / Math.PI)
        : curP.angle;

      singlePlayerRef.current = { x: nextPX, y: nextPY, angle };

      // 4. Squad positions (ONLY calculated when in squad mode to prevent unnecessary CPU overhead)
      let nextHome = homePositionsRef.current;
      let nextAway = awayPositionsRef.current;

      if (viewModeRef.current === "squad") {
        nextHome = targetHomeRef.current.map((tgt, i) => {
          const cur = homePositionsRef.current[i] || { x: tgt.currentX, y: tgt.currentY };
          return {
            number: tgt.number,
            x: cur.x + (tgt.currentX - cur.x) * lerpPlayerFactor,
            y: cur.y + (tgt.currentY - cur.y) * lerpPlayerFactor,
          };
        });
        homePositionsRef.current = nextHome;

        nextAway = targetAwayRef.current.map((tgt, i) => {
          const cur = awayPositionsRef.current[i] || { x: tgt.currentX, y: tgt.currentY };
          return {
            number: tgt.number,
            x: cur.x + (tgt.currentX - cur.x) * lerpPlayerFactor,
            y: cur.y + (tgt.currentY - cur.y) * lerpPlayerFactor,
          };
        });
        awayPositionsRef.current = nextAway;
      }

      // 5. Radar scanline beam
      scanPos = (scanPos + dt * 24) % 105;

      // 6. Goal shockwave
      if (isGoalRef.current) {
        shockwave = (shockwave + dt * 40) % 36;
      } else {
        shockwave = 0;
      }

      // Single batched state update for seamless 60 FPS
      setFrameState({
        ball: { x: nextBX, y: nextBY, z: nextBZ },
        trail: updatedTrail,
        singlePlayer: {
          x: nextPX,
          y: nextPY,
          angle,
          isHome: tgtP.isHome,
          number: tgtP.number,
          role: tgtP.role,
          title: tgtP.title,
          action: tgtP.action,
        },
        homePositions: nextHome,
        awayPositions: nextAway,
        radarScanX: scanPos,
        goalShockwaveRadius: shockwave,
      });

      animId = requestAnimationFrame(frameLoop);
    };

    animId = requestAnimationFrame(frameLoop);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Find player currently closest to the ball (possession aura in squad mode)
  const activeSquadCarrier = useMemo(() => {
    if (viewMode !== "squad") return null;
    let closestDist = Infinity;
    let carrier: { isHome: boolean; number: number; x: number; y: number } | null = null;

    for (const p of frameState.homePositions) {
      const d = Math.hypot(p.x - frameState.ball.x, p.y - frameState.ball.y);
      if (d < closestDist && d < 9.0) {
        closestDist = d;
        carrier = { isHome: true, number: p.number, x: p.x, y: p.y };
      }
    }
    for (const p of frameState.awayPositions) {
      const d = Math.hypot(p.x - frameState.ball.x, p.y - frameState.ball.y);
      if (d < closestDist && d < 9.0) {
        closestDist = d;
        carrier = { isHome: false, number: p.number, x: p.x, y: p.y };
      }
    }
    return carrier;
  }, [viewMode, frameState.homePositions, frameState.awayPositions, frameState.ball.x, frameState.ball.y]);

  const { ball, singlePlayer, trail, radarScanX, goalShockwaveRadius } = frameState;

  return (
    <div className="b365-card p-4 space-y-4">
      {/* Header Telemetry, Mode Toggle & Action Callout */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between border-b border-line pb-3">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-accent animate-pulse" />
          <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-white">
            2D Tactical Radar • 60 FPS Live Match Engine
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* View Mode Toggle: Single Player (Default) vs Full 22 Squad */}
          <div className="inline-flex rounded-lg bg-coal p-1 border border-line text-xs font-mono">
            <button
              type="button"
              onClick={() => setViewMode("single")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded font-bold transition-all ${
                viewMode === "single"
                  ? "bg-accent text-night shadow"
                  : "text-fog hover:text-white"
              }`}
            >
              <span>👤</span>
              <span>Single Player (Focus)</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("squad")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded font-bold transition-all ${
                viewMode === "squad"
                  ? "bg-accent text-night shadow"
                  : "text-fog hover:text-white"
              }`}
            >
              <span>👥</span>
              <span>Full 22 Squad</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-3 text-xs font-mono pl-2 border-l border-line">
            <span className="text-fog">
              xT: <strong className="text-accent">{currentXT.toFixed(3)}</strong>
            </span>
            <span className="text-fog">
              Field Tilt: <strong className="text-gold">{fieldTilt}% Home</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Action Banner with Goal Alert & Coords */}
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
          Coords: <span className="text-white font-bold">{ball.x.toFixed(1)}m, {ball.y.toFixed(1)}m</span>
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

          {/* ================================================================= */}
          {/* MODE 1: SINGLE PLAYER FOCUS (Active Ball Carrier / Attacker)      */}
          {/* ================================================================= */}
          {viewMode === "single" && (
            <g id="single-focal-player">
              {/* Active Dribble Tether to Ball */}
              {Math.hypot(singlePlayer.x - ball.x, singlePlayer.y - ball.y) < 14 && (
                <line
                  x1={singlePlayer.x}
                  y1={singlePlayer.y}
                  x2={ball.x}
                  y2={ball.y}
                  stroke={singlePlayer.isHome ? "#E5B869" : "#38BDF8"}
                  strokeWidth="0.45"
                  strokeDasharray="1.2 0.8"
                  strokeOpacity="0.75"
                />
              )}

              {/* Shot Trajectory Vector when Striking */}
              {(targetState.isShot || targetState.isGoal) && (
                <line
                  x1={singlePlayer.x}
                  y1={singlePlayer.y}
                  x2={singlePlayer.isHome ? 102.5 : 2.5}
                  y2={34}
                  stroke="#EF4444"
                  strokeWidth="0.5"
                  strokeDasharray="2 1.5"
                  strokeOpacity="0.85"
                />
              )}

              {/* Outer Glowing Possession Aura Ring */}
              <circle
                cx={singlePlayer.x}
                cy={singlePlayer.y}
                r={5.0}
                fill="none"
                stroke={singlePlayer.isHome ? "#E5B869" : "#38BDF8"}
                strokeWidth="0.4"
                strokeOpacity="0.6"
                strokeDasharray="2.5 1.5"
              />

              {/* Directional Orientation Chevron */}
              <g
                transform={`translate(${singlePlayer.x}, ${singlePlayer.y}) rotate(${singlePlayer.angle})`}
              >
                <polygon
                  points="4.6,0 3.0,-1.4 3.0,1.4"
                  fill={singlePlayer.isHome ? "#E5B869" : "#38BDF8"}
                  opacity="0.9"
                />
              </g>

              {/* Prominent High-Contrast Player Avatar Token */}
              <circle
                cx={singlePlayer.x}
                cy={singlePlayer.y}
                r={3.2}
                fill={singlePlayer.isHome ? "#E5B869" : "#38BDF8"}
                stroke="#0B0E11"
                strokeWidth="0.75"
                className="cursor-pointer"
                onMouseEnter={() =>
                  setHoveredPlayer({
                    isHome: singlePlayer.isHome,
                    number: singlePlayer.number,
                    role: singlePlayer.role,
                    title: singlePlayer.title,
                    rating: 8.4,
                    x: singlePlayer.x,
                    y: singlePlayer.y,
                  })
                }
                onMouseLeave={() => setHoveredPlayer(null)}
              />
              <circle
                cx={singlePlayer.x}
                cy={singlePlayer.y}
                r={2.4}
                fill="none"
                stroke="#0B0E11"
                strokeWidth="0.25"
                strokeOpacity="0.4"
              />

              {/* Squad Jersey Number */}
              <text
                x={singlePlayer.x}
                y={singlePlayer.y + 0.9}
                fontSize="2.4"
                fontWeight="900"
                fill="#0B0E11"
                textAnchor="middle"
                className="font-mono select-none"
              >
                {singlePlayer.number}
              </text>

              {/* Floating Tactical Pill Above Player */}
              <g
                transform={`translate(${Math.max(16, Math.min(89, singlePlayer.x))}, ${Math.max(
                  6.5,
                  singlePlayer.y - 5.5
                )})`}
              >
                <rect
                  x="-18"
                  y="-3.5"
                  width="36"
                  height="5.4"
                  rx="1.2"
                  fill="#0B0E11"
                  fillOpacity="0.92"
                  stroke={singlePlayer.isHome ? "#E5B869" : "#38BDF8"}
                  strokeWidth="0.35"
                />
                <text
                  x="0"
                  y="-0.2"
                  fontSize="1.6"
                  fontWeight="bold"
                  fill="#FFFFFF"
                  textAnchor="middle"
                  className="font-mono"
                >
                  {singlePlayer.isHome ? fixture.home.shortName : fixture.away.shortName} #{singlePlayer.number} • {singlePlayer.role}
                </text>
              </g>

              {/* Dynamic Action Subtitle Below Player */}
              <g
                transform={`translate(${Math.max(16, Math.min(89, singlePlayer.x))}, ${Math.min(
                  64.5,
                  singlePlayer.y + 5.8
                )})`}
              >
                <rect
                  x="-15"
                  y="-2.4"
                  width="30"
                  height="4.0"
                  rx="0.8"
                  fill="#000000"
                  fillOpacity="0.8"
                  stroke="#ffffff"
                  strokeWidth="0.2"
                  strokeOpacity="0.15"
                />
                <text
                  x="0"
                  y="0.3"
                  fontSize="1.25"
                  fontWeight="bold"
                  fill={singlePlayer.isHome ? "#E5B869" : "#38BDF8"}
                  textAnchor="middle"
                  className="font-mono uppercase tracking-wide"
                >
                  {singlePlayer.action}
                </text>
              </g>
            </g>
          )}

          {/* ================================================================= */}
          {/* MODE 2: FULL 22-PLAYER SQUAD RADAR                                */}
          {/* ================================================================= */}
          {viewMode === "squad" && (
            <>
              {/* Possession Aura in Squad Mode */}
              {activeSquadCarrier && (
                <circle
                  cx={(activeSquadCarrier.x / 100) * 105}
                  cy={(activeSquadCarrier.y / 100) * 68}
                  r={3.8}
                  fill="none"
                  stroke={activeSquadCarrier.isHome ? "#E5B869" : "#38BDF8"}
                  strokeWidth="0.4"
                  strokeOpacity="0.8"
                  strokeDasharray="2 1"
                />
              )}

              {/* HOME PLAYERS (Gold Dots - smoothly animated at 60 FPS) */}
              <g id="home-players">
                {frameState.homePositions.map((pos) => {
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
                {frameState.awayPositions.map((pos) => {
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
            </>
          )}

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
              cx={(ball.x / 100) * 105}
              cy={(ball.y / 100) * 68 + ball.z * 0.35}
              rx={1.2 + ball.z * 0.15}
              ry={0.6 + ball.z * 0.1}
              fill="#000000"
              fillOpacity={Math.max(0.12, 0.45 - ball.z * 0.04)}
            />

            {/* Elevated Ball Sphere */}
            <circle
              cx={(ball.x / 100) * 105}
              cy={(ball.y / 100) * 68 - ball.z * 0.55}
              r={1.25 + ball.z * 0.12}
              fill="#ffffff"
              stroke="#111827"
              strokeWidth="0.3"
              filter="url(#ballGlow)"
            />
          </g>

          {/* TACTICAL HOVER CARD (Clean Role & Squad Number — Zero Real Player Names) */}
          {hoveredPlayer && (
            <g
              transform={`translate(${Math.max(14, Math.min(91, hoveredPlayer.x))}, ${Math.max(
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
        {viewMode === "squad" && (
          <label className="flex items-center gap-1.5 cursor-pointer hover:text-white">
            <input
              type="checkbox"
              checked={showPlayerNumbers}
              onChange={(e) => setShowPlayerNumbers(e.target.checked)}
              className="rounded border-line text-accent focus:ring-0"
            />
            Squad Numbers
          </label>
        )}
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
