"use client";

import React, { useState, useEffect } from "react";

export interface VarIncidentData {
  id: string;
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  minute: number;
  incidentType:
    | "GOAL_POSSIBLE_OFFSIDE"
    | "GOAL_POSSIBLE_FOUL"
    | "GOAL_POSSIBLE_HANDBALL"
    | "PENALTY_POSSIBLE_FOUL"
    | "PENALTY_POSSIBLE_DIVING"
    | "POSSIBLE_RED_CARD"
    | "MISTAKEN_IDENTITY";
  onFieldDecision: string;
  reviewOutcome:
    | "CONFIRMED_ORIGINAL_DECISION"
    | "OVERTURNED_GOAL_DISALLOWED"
    | "OVERTURNED_PENALTY_AWARDED"
    | "OVERTURNED_PENALTY_CANCELLED"
    | "OVERTURNED_RED_CARD_AWARDED"
    | "OVERTURNED_YELLOW_RESCINDED";
  monitorReviewConducted: boolean;
  reviewDurationSeconds: number;
  narrativeExplanation: string;
  telemetry?: {
    attackerLimbXMm: number;
    defenderLimbXMm: number;
    marginMm: number;
    isOffside: boolean;
    confidenceLevel: number;
    calibratedFrame: number;
  };
}

interface VarReviewModalProps {
  incident: VarIncidentData | null;
  onClose: () => void;
}

export function VarReviewModal({ incident, onClose }: VarReviewModalProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrameOffset, setCurrentFrameOffset] = useState(0);
  const [zoomLevel, setZoomLevel] = useState<"1x" | "2x" | "4x">("1x");

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying) {
      timer = setInterval(() => {
        setCurrentFrameOffset((prev) => (prev >= 20 ? -20 : prev + 1));
      }, 100);
    }
    return () => clearInterval(timer);
  }, [isPlaying]);

  if (!incident) return null;

  const isOverturned = incident.reviewOutcome.startsWith("OVERTURNED");
  const isOffsideType = incident.incidentType === "GOAL_POSSIBLE_OFFSIDE";
  const telemetry = incident.telemetry;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="var-review-title"
    >
      <div className="relative w-full max-w-3xl rounded-xl border border-line bg-graphite shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Broadcast Bar */}
        <div className="flex items-center justify-between border-b border-line bg-charcoal px-5 py-3">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 rounded bg-red-600/20 px-2 py-0.5 text-xs font-mono font-bold text-red-400 border border-red-500/30 animate-pulse">
              <span className="h-2 w-2 rounded-full bg-red-500"></span>
              VAR REVIEW ACTIVE
            </span>
            <span className="text-xs font-mono text-fog">
              ID: {incident.id.slice(0, 8)} • MIN {incident.minute}&apos;
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-fog hover:text-white hover:bg-line transition focus-visible:outline-none"
            aria-label="Close VAR Review"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Match and Incident Header */}
        <div className="px-5 py-3 bg-ink/50 border-b border-line/60 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="var-review-title" className="text-base font-bold text-bone">
              {incident.homeTeam} vs {incident.awayTeam}
            </h2>
            <p className="text-xs text-fog">
              Review Type: <span className="text-white font-medium">{incident.incidentType.replace(/_/g, " ")}</span>
            </p>
          </div>

          <div className="text-right">
            <span className="text-xs text-fog block">On-field Initial Decision</span>
            <span className="text-xs font-semibold text-amber-400">{incident.onFieldDecision}</span>
          </div>
        </div>

        {/* Replay Screen / SAOT Visualizer */}
        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          <div className="relative aspect-video w-full rounded-lg bg-emerald-950/40 border border-emerald-900/40 overflow-hidden flex flex-col justify-between p-4 shadow-inner">
            {/* Simulated Pitch Grid */}
            <div className="absolute inset-0 bg-[radial-gradient(#15803d_1px,transparent_1px)] [background-size:16px_16px] opacity-25"></div>

            {/* Stadium Pitch Markings */}
            <svg className="absolute inset-0 h-full w-full pointer-events-none opacity-40" viewBox="0 0 800 450">
              <rect x="20" y="20" width="760" height="410" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
              <line x1="400" y1="20" x2="400" y2="430" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
              <circle cx="400" cy="225" r="70" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
              <rect x="20" y="125" width="130" height="200" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
              <rect x="650" y="125" width="130" height="200" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
            </svg>

            {/* Top Telemetry Overlay */}
            <div className="relative z-10 flex items-center justify-between text-[11px] font-mono text-zinc-300 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded border border-white/10">
              <div className="flex items-center gap-3">
                <span className="text-emerald-400 font-bold">SAOT CAM 04 (3D CALIBRATED)</span>
                <span>FRAME: #{(telemetry?.calibratedFrame ?? 8420) + currentFrameOffset}</span>
              </div>
              <div className="flex items-center gap-2">
                <span>FPS: 120.0</span>
                <span>ZOOM: {zoomLevel}</span>
              </div>
            </div>

            {/* 3D Semi-Automated Lines Graphic (when offside) */}
            {isOffsideType && telemetry ? (
              <div className="relative z-10 my-auto flex items-center justify-center h-48">
                <div className="relative w-full max-w-lg h-36 border border-white/10 bg-black/30 rounded p-2 flex items-center justify-center">
                  {/* Calibrated Defender Line */}
                  <div
                    className="absolute top-2 bottom-2 w-0.5 bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.8)] flex flex-col justify-between items-center"
                    style={{ left: "42%" }}
                  >
                    <span className="text-[9px] font-mono bg-blue-600 text-white px-1 rounded -translate-y-4">
                      DEFENDER
                    </span>
                    <span className="h-2 w-2 rounded-full bg-blue-400"></span>
                  </div>

                  {/* Calibrated Attacker Line */}
                  <div
                    className="absolute top-2 bottom-2 w-0.5 bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.8)] flex flex-col justify-between items-center"
                    style={{
                      left: telemetry.isOffside ? "48%" : "38%",
                    }}
                  >
                    <span className="text-[9px] font-mono bg-red-600 text-white px-1 rounded -translate-y-4">
                      ATTACKER
                    </span>
                    <span className="h-2 w-2 rounded-full bg-red-400"></span>
                  </div>

                  {/* Measurement Banner */}
                  <div className="absolute bottom-2 bg-black/80 px-2 py-1 rounded border border-white/20 text-center">
                    <span className="text-[10px] font-mono text-fog block">DELTA MARGIN</span>
                    <span
                      className={`text-xs font-mono font-bold ${
                        telemetry.isOffside ? "text-red-400" : "text-emerald-400"
                      }`}
                    >
                      {telemetry.marginMm > 0 ? `+${telemetry.marginMm} mm (OFFSIDE)` : `${telemetry.marginMm} mm (ONSIDE)`}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* Pitchside Monitor Replay View */
              <div className="relative z-10 my-auto flex flex-col items-center justify-center h-48 space-y-2">
                <div className="rounded-full bg-black/60 p-3 border border-white/20">
                  <svg className="h-10 w-10 text-accent animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.5"
                      d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <span className="text-xs font-mono text-zinc-300 bg-black/70 px-3 py-1 rounded border border-white/10">
                  {incident.monitorReviewConducted
                    ? "ON-FIELD REFEREE MONITOR REVIEW COMPLETED"
                    : "VAR DIRECT BOOTH CONFIRMATION IN PROGRESS"}
                </span>
              </div>
            )}

            {/* Bottom Controls Bar */}
            <div className="relative z-10 flex items-center justify-between text-xs bg-black/70 backdrop-blur-sm px-3 py-2 rounded border border-white/10">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="rounded bg-line px-2.5 py-1 text-white hover:bg-accent hover:text-ink font-semibold transition"
                >
                  {isPlaying ? "Pause ❚❚" : "Play ▶"}
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentFrameOffset((p) => p - 1)}
                  className="rounded bg-line px-2 py-1 text-fog hover:text-white"
                  title="Previous frame"
                >
                  -1 F
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentFrameOffset((p) => p + 1)}
                  className="rounded bg-line px-2 py-1 text-fog hover:text-white"
                  title="Next frame"
                >
                  +1 F
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-fog text-[10px]">ZOOM:</span>
                {(["1x", "2x", "4x"] as const).map((z) => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => setZoomLevel(z)}
                    className={`rounded px-1.5 py-0.5 text-[10px] font-mono ${
                      zoomLevel === z ? "bg-accent text-ink font-bold" : "bg-line text-fog hover:text-white"
                    }`}
                  >
                    {z}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Official Decision Outcome Card */}
          <div
            className={`rounded-lg border p-4 ${
              isOverturned
                ? "border-red-500/40 bg-red-950/20"
                : "border-emerald-500/40 bg-emerald-950/20"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-fog">Final Decision Rendered</span>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded font-mono ${
                  isOverturned
                    ? "bg-red-500/20 text-red-400 border border-red-500/40"
                    : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                }`}
              >
                {isOverturned ? "OVERTURNED" : "CONFIRMED"}
              </span>
            </div>

            <h3 className="mt-1 text-base font-bold text-white">
              {incident.reviewOutcome.replace(/_/g, " ")}
            </h3>

            <p className="mt-2 text-xs text-zinc-300 leading-relaxed">
              {incident.narrativeExplanation}
            </p>

            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 border-t border-line/40 pt-2 text-[11px] font-mono text-fog">
              <div>
                <span>Duration: </span>
                <span className="text-bone font-medium">{incident.reviewDurationSeconds}s</span>
              </div>
              <div>
                <span>OFR Monitor: </span>
                <span className="text-bone font-medium">
                  {incident.monitorReviewConducted ? "Yes (Screen)" : "No (Factual)"}
                </span>
              </div>
              <div>
                <span>Confidence: </span>
                <span className="text-accent font-medium">
                  {telemetry ? `${Math.round(telemetry.confidenceLevel * 100)}%` : "100% High"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-line bg-charcoal px-5 py-3 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-line px-4 py-1.5 text-xs font-bold text-white hover:bg-line/80 transition"
          >
            Close Telemetry Review
          </button>
        </div>
      </div>
    </div>
  );
}
