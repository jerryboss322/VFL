"use client";

import React, { useState, useEffect } from "react";
import { stadiumCrowdEngine } from "@/lib/crowd_audio_engine";

export function StadiumSoundboard() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [threatLevel, setThreatLevel] = useState(0.3);

  const toggleDrone = () => {
    if (!isPlaying) {
      stadiumCrowdEngine.startStadiumDrone();
      setIsPlaying(true);
    }
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    stadiumCrowdEngine.setMuted(next);
  };

  const handleThreatChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setThreatLevel(val);
    stadiumCrowdEngine.setThreatExcitement(val);
  };

  return (
    <div className="rounded-xl border border-line bg-graphite p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between border-b border-line/60 pb-2">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
          <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
            Spatial Stadium Soundboard
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleMute}
            className={`rounded px-2 py-0.5 text-[10px] font-mono font-bold transition ${
              isMuted ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-line text-fog hover:text-white"
            }`}
          >
            {isMuted ? "MUTED" : "UNMUTED"}
          </button>
          {!isPlaying && (
            <button
              type="button"
              onClick={toggleDrone}
              className="rounded bg-accent text-ink px-2.5 py-0.5 text-[10px] font-black hover:brightness-110 shadow-sm"
            >
              Start Ambience
            </button>
          )}
        </div>
      </div>

      {/* Threat Excitement Modulation Slider */}
      <div>
        <div className="flex justify-between text-[11px] font-mono mb-1">
          <span className="text-fog">Crowd Excitement (xT Threat)</span>
          <span className="text-accent font-bold">{Math.round(threatLevel * 100)}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={threatLevel}
          onChange={handleThreatChange}
          className="w-full accent-accent h-1.5 bg-line rounded-lg cursor-pointer"
        />
      </div>

      {/* Instant Audio Cue Triggers */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
        <button
          type="button"
          onClick={() => {
            toggleDrone();
            stadiumCrowdEngine.triggerGoalRoar();
          }}
          className="rounded-lg bg-emerald-500/20 border border-emerald-500/40 p-2 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/30 transition text-center"
        >
          ⚽ Goal Roar
        </button>

        <button
          type="button"
          onClick={() => {
            toggleDrone();
            stadiumCrowdEngine.triggerMissedChanceGroan();
          }}
          className="rounded-lg bg-amber-500/20 border border-amber-500/40 p-2 text-[11px] font-bold text-amber-300 hover:bg-amber-500/30 transition text-center"
        >
          😮 Missed Chance
        </button>

        <button
          type="button"
          onClick={() => {
            toggleDrone();
            stadiumCrowdEngine.triggerRefereeWhistle(false);
          }}
          className="rounded-lg bg-line p-2 text-[11px] font-bold text-white hover:bg-line/80 transition text-center"
        >
          🔔 Whistle
        </button>

        <button
          type="button"
          onClick={() => {
            toggleDrone();
            stadiumCrowdEngine.triggerRefereeWhistle(true);
          }}
          className="rounded-lg bg-line p-2 text-[11px] font-bold text-accent hover:bg-line/80 transition text-center"
        >
          🏁 Full Time (x3)
        </button>
      </div>
    </div>
  );
}
