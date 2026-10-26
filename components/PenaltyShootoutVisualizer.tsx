"use client";

import React, { useState } from "react";
import { stadiumCrowdEngine } from "@/lib/crowd_audio_engine";

export type SpotCorner = "TOP_LEFT" | "TOP_RIGHT" | "BOTTOM_LEFT" | "BOTTOM_RIGHT" | "CENTER";

export interface KickHistoryItem {
  kickNum: number;
  team: "HOME" | "AWAY";
  takerName: string;
  target: SpotCorner;
  gkDive: SpotCorner;
  outcome: "GOAL" | "SAVED" | "WOODWORK" | "OFF_TARGET";
}

const CORNERS: { id: SpotCorner; label: string; x: string; y: string }[] = [
  { id: "TOP_LEFT", label: "Top Left", x: "15%", y: "20%" },
  { id: "TOP_RIGHT", label: "Top Right", x: "85%", y: "20%" },
  { id: "BOTTOM_LEFT", label: "Bottom Left", x: "15%", y: "80%" },
  { id: "BOTTOM_RIGHT", label: "Bottom Right", x: "85%", y: "80%" },
  { id: "CENTER", label: "Panenka (Center)", x: "50%", y: "50%" },
];

export function PenaltyShootoutVisualizer() {
  const [selectedCorner, setSelectedCorner] = useState<SpotCorner>("BOTTOM_RIGHT");
  const [homeScore, setHomeScore] = useState(2);
  const [awayScore, setAwayScore] = useState(1);
  const [activeRound, setActiveRound] = useState(3);
  const [isSuddenDeath, setIsSuddenDeath] = useState(false);
  const [lastOutcome, setLastOutcome] = useState<string | null>(null);
  const [isKicking, setIsKicking] = useState(false);
  const [history, setHistory] = useState<KickHistoryItem[]>([
    { kickNum: 1, team: "HOME", takerName: "Bukayo Saka", target: "BOTTOM_RIGHT", gkDive: "BOTTOM_LEFT", outcome: "GOAL" },
    { kickNum: 2, team: "AWAY", takerName: "Cole Palmer", target: "TOP_LEFT", gkDive: "BOTTOM_LEFT", outcome: "GOAL" },
    { kickNum: 3, team: "HOME", takerName: "Martin Odegaard", target: "TOP_RIGHT", gkDive: "BOTTOM_RIGHT", outcome: "GOAL" },
    { kickNum: 4, team: "AWAY", takerName: "Enzo Fernandez", target: "BOTTOM_LEFT", gkDive: "BOTTOM_LEFT", outcome: "SAVED" },
  ]);

  const handleTakeKick = () => {
    if (isKicking) return;
    setIsKicking(true);
    setLastOutcome(null);

    // Referee whistle blast before kick
    stadiumCrowdEngine.triggerRefereeWhistle(false);

    // Simulate GK dive
    const allCorners: SpotCorner[] = ["TOP_LEFT", "TOP_RIGHT", "BOTTOM_LEFT", "BOTTOM_RIGHT", "CENTER"];
    const gkDive = allCorners[Math.floor(Math.random() * allCorners.length)]!;

    setTimeout(() => {
      let outcome: "GOAL" | "SAVED" | "WOODWORK" | "OFF_TARGET" = "GOAL";
      if (gkDive === selectedCorner) {
        outcome = Math.random() < 0.65 ? "SAVED" : "GOAL";
      } else {
        const roll = Math.random();
        if (roll < 0.08) outcome = "WOODWORK";
        else if (roll < 0.12) outcome = "OFF_TARGET";
        else outcome = "GOAL";
      }

      if (outcome === "GOAL") {
        setHomeScore((prev) => prev + 1);
        stadiumCrowdEngine.triggerGoalRoar();
        setLastOutcome("GOAL! CLINICAL FINISH INTO THE CORNER!");
      } else if (outcome === "SAVED") {
        stadiumCrowdEngine.triggerMissedChanceGroan();
        setLastOutcome("SAVED! GOALKEEPER GUESSES CORRECTLY!");
      } else {
        stadiumCrowdEngine.triggerMissedChanceGroan();
        setLastOutcome("MISSED! OFF THE WOODWORK!");
      }

      setHistory((prev) => [
        ...prev,
        {
          kickNum: prev.length + 1,
          team: "HOME",
          takerName: "Kai Havertz",
          target: selectedCorner,
          gkDive,
          outcome,
        },
      ]);

      setIsKicking(false);
      setActiveRound((prev) => prev + 1);
      if (activeRound >= 5 && homeScore === awayScore) {
        setIsSuddenDeath(true);
      }
    }, 800);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-rose-950/60 via-slate-900 to-slate-900/90 p-6 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-0.5 text-xs font-semibold text-rose-400">
                <span className="h-2 w-2 rounded-full bg-rose-400 animate-ping" />
                Knockout Cup Shootout
              </span>
              {isSuddenDeath && (
                <span className="rounded-full bg-amber-500/20 px-3 py-0.5 text-xs font-bold text-amber-300 border border-amber-500/30 animate-pulse">
                  SUDDEN DEATH
                </span>
              )}
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">
              Penalty Shootout Stage
            </h1>
            <p className="text-sm text-white/60">
              Interactive 12-yard spot kick duel. Target the goal corners against the diving goalkeeper.
            </p>
          </div>

          {/* Scoreboard Pill */}
          <div className="flex items-center gap-6 rounded-2xl border border-white/10 bg-black/50 px-6 py-3">
            <div className="text-center">
              <div className="text-xs font-bold text-white">ARSENAL</div>
              <div className="font-mono text-3xl font-black text-emerald-400">{homeScore}</div>
            </div>
            <div className="font-mono text-xl font-bold text-white/30">:</div>
            <div className="text-center">
              <div className="text-xs font-bold text-white">CHELSEA</div>
              <div className="font-mono text-3xl font-black text-rose-400">{awayScore}</div>
            </div>
          </div>
        </div>

        {/* Penalty Kicks Progression Dots */}
        <div className="mt-6 grid grid-cols-2 gap-4 pt-4 border-t border-white/10 text-xs">
          <div>
            <div className="text-white/50 mb-2 font-semibold">Arsenal Penalties:</div>
            <div className="flex gap-2">
              {Array.from({ length: 5 }).map((_, i) => {
                const kick = history.filter((h) => h.team === "HOME")[i];
                return (
                  <div
                    key={i}
                    className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-xs border ${
                      !kick
                        ? "border-white/10 bg-white/5 text-white/20"
                        : kick.outcome === "GOAL"
                        ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                        : "border-rose-500 bg-rose-500/20 text-rose-300"
                    }`}
                  >
                    {!kick ? i + 1 : kick.outcome === "GOAL" ? "\u2714" : "\u2718"}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div className="text-white/50 mb-2 font-semibold">Chelsea Penalties:</div>
            <div className="flex gap-2">
              {Array.from({ length: 5 }).map((_, i) => {
                const kick = history.filter((h) => h.team === "AWAY")[i];
                return (
                  <div
                    key={i}
                    className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-xs border ${
                      !kick
                        ? "border-white/10 bg-white/5 text-white/20"
                        : kick.outcome === "GOAL"
                        ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                        : "border-rose-500 bg-rose-500/20 text-rose-300"
                    }`}
                  >
                    {!kick ? i + 1 : kick.outcome === "GOAL" ? "\u2714" : "\u2718"}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Outcome Toast */}
      {lastOutcome && (
        <div
          className={`rounded-xl border p-4 text-center text-sm font-bold animate-in fade-in ${
            lastOutcome.startsWith("GOAL")
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
              : "border-rose-500/40 bg-rose-500/10 text-rose-300"
          }`}
        >
          {lastOutcome}
        </div>
      )}

      {/* 3D Goal Perspective Canvas & Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Goal Net Canvas */}
        <div className="lg:col-span-8">
          <div className="relative h-[360px] rounded-2xl border-4 border-slate-700 bg-gradient-to-b from-slate-900 via-emerald-950/40 to-emerald-900/80 p-6 shadow-2xl overflow-hidden flex flex-col justify-end">
            {/* Crossbar & Net Grid lines */}
            <div className="absolute inset-x-8 top-8 bottom-0 border-t-8 border-x-8 border-white shadow-2xl bg-[radial-gradient(#ffffff15_1px,transparent_1px)] [background-size:16px_16px]">
              {/* Goalkeeper Silhouette */}
              <div
                className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-20 h-44 bg-gradient-to-t from-amber-400 to-amber-200 rounded-t-full shadow-2xl transition-all duration-500 flex flex-col items-center justify-start pt-2 ${
                  isKicking ? "scale-95 translate-y-2 opacity-80" : ""
                }`}
              >
                <div className="h-8 w-8 rounded-full bg-amber-100 border border-amber-500" />
                <span className="mt-1 text-[9px] font-black text-slate-950 uppercase">GK</span>
              </div>

              {/* Target Corner Nodes */}
              {CORNERS.map((corner) => {
                const isSelected = selectedCorner === corner.id;
                return (
                  <button
                    key={corner.id}
                    onClick={() => setSelectedCorner(corner.id)}
                    style={{ left: corner.x, top: corner.y }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full p-2 transition-all cursor-pointer ${
                      isSelected
                        ? "h-14 w-14 bg-rose-500 text-slate-950 ring-4 ring-rose-400 shadow-xl shadow-rose-500/50 scale-110"
                        : "h-10 w-10 bg-black/60 text-white border border-white/30 hover:scale-105"
                    } flex items-center justify-center font-bold text-[10px]`}
                  >
                    {isSelected ? "\u25ce" : "\u25cb"}
                  </button>
                );
              })}
            </div>

            {/* Grass Pitch Line */}
            <div className="relative z-10 text-center pb-2">
              <span className="text-[11px] font-mono text-white/50 tracking-wider uppercase">
                12-Yard Spot Kick Mark &bull; Goal Frame 7.32m &times; 2.44m
              </span>
            </div>
          </div>
        </div>

        {/* Spot Kick Controls */}
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 shadow-lg backdrop-blur-md">
            <h3 className="text-base font-bold text-white mb-2">Execute Spot Kick</h3>
            <p className="text-xs text-white/50 mb-4">
              Select your intended placement corner and fire into the net.
            </p>

            <div className="space-y-2 mb-5">
              <div className="text-xs font-semibold text-white/80">Selected Target:</div>
              <div className="rounded-xl border border-white/10 bg-slate-950 p-3 font-mono text-sm font-bold text-rose-400 flex items-center justify-between">
                <span>{CORNERS.find((c) => c.id === selectedCorner)?.label}</span>
                <span className="text-xs text-white/40">76% Conversion</span>
              </div>
            </div>

            <button
              onClick={handleTakeKick}
              disabled={isKicking}
              className={`w-full rounded-xl py-3.5 text-xs font-bold text-slate-950 transition-all shadow-lg active:scale-95 ${
                isKicking
                  ? "bg-white/20 text-white/40 cursor-not-allowed"
                  : "bg-rose-500 hover:bg-rose-400 shadow-rose-500/20"
              }`}
            >
              {isKicking ? "Executing Spot Kick..." : "Fire Penalty (\u26bd)"}
            </button>
          </div>

          {/* Shootout History Feed */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 shadow-lg backdrop-blur-md">
            <h4 className="text-xs font-bold text-white mb-3 uppercase tracking-wider">
              Shootout Log
            </h4>
            <div className="max-h-[160px] overflow-y-auto space-y-2 pr-1 text-xs">
              {history.slice().reverse().map((h) => (
                <div
                  key={h.kickNum}
                  className="flex items-center justify-between rounded-lg border border-white/5 bg-slate-950/50 px-3 py-2"
                >
                  <div>
                    <span className="font-bold text-white mr-1.5">#{h.kickNum}</span>
                    <span className="text-white/80">{h.takerName}</span>
                    <span className="text-[10px] text-white/40 ml-1.5">({h.team})</span>
                  </div>
                  <span
                    className={`font-mono text-[10px] font-bold ${
                      h.outcome === "GOAL" ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {h.outcome}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
