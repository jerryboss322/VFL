"use client";

import React, { useState, useEffect } from "react";
import { speechCommentary, type SpokenCommentaryItem } from "@/lib/speech_commentary";

interface AudioCommentaryPlayerProps {
  homeName?: string;
  awayName?: string;
}

export function AudioCommentaryPlayer({ homeName = "Home", awayName = "Away" }: AudioCommentaryPlayerProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeItem, setActiveItem] = useState<SpokenCommentaryItem | null>(null);
  const [history, setHistory] = useState<SpokenCommentaryItem[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [selectedLang, setSelectedLang] = useState<"en" | "es" | "de" | "fr" | "it">("en");
  const [speedRate, setSpeedRate] = useState<number>(1.1);

  useEffect(() => {
    const unsub = speechCommentary.subscribe((item, speaking) => {
      setIsSpeaking(speaking);
      if (item) {
        setActiveItem(item);
      }
      setHistory(speechCommentary.getHistory());
    });
    return unsub;
  }, []);

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    speechCommentary.setMuted(next);
  };

  const handleTestShout = (type: "goal" | "save" | "woodwork") => {
    const testLines: Record<string, string> = {
      goal: `GOAL! Spectacular top corner strike for ${homeName}! Unbelievable scenes!`,
      save: `WHAT A SAVE! The goalkeeper denies ${awayName} with an acrobatic fingertip save!`,
      woodwork: `OFF THE POST! ${homeName} rattle the frame of the goal!`,
    };

    const goalLine = testLines.goal ?? `GOAL! What a strike for ${homeName}!`;
    speechCommentary.speak({
      id: `test-${Date.now()}`,
      minute: 75,
      text: testLines[type] ?? goalLine,
      urgency: type === "goal" ? "CRITICAL" : "HIGH",
      pitch: type === "goal" ? 1.35 : 1.15,
      rate: speedRate,
      volume: 1.0,
      timestampMs: Date.now(),
    });
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 shadow-lg space-y-4">
      {/* Top Header & Visualizer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          {/* Animated Broadcast Wave Bars */}
          <div className="flex items-end gap-1 h-6 w-8">
            <span className={`w-1.5 rounded-full bg-amber-400 transition-all ${isSpeaking ? "h-6 animate-pulse" : "h-2"}`} />
            <span className={`w-1.5 rounded-full bg-amber-400 transition-all ${isSpeaking ? "h-4 animate-bounce" : "h-1.5"}`} />
            <span className={`w-1.5 rounded-full bg-amber-400 transition-all ${isSpeaking ? "h-5 animate-pulse" : "h-2.5"}`} />
            <span className={`w-1.5 rounded-full bg-amber-400 transition-all ${isSpeaking ? "h-3 animate-bounce" : "h-1"}`} />
          </div>

          <div>
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-100 flex items-center gap-2">
              <span>Dynamic Audio Commentary</span>
              {isSpeaking && (
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 border border-emerald-800 px-1.5 py-0.2 rounded animate-pulse">
                  ON AIR
                </span>
              )}
            </h3>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Live AI voice synthesis reacting dynamically to match danger, saves, and goals.
            </p>
          </div>
        </div>

        {/* Audio Controls */}
        <div className="flex items-center gap-2">
          {/* Speed Selector */}
          <div className="flex items-center bg-neutral-950 border border-neutral-800 rounded p-0.5 text-[10px] font-mono">
            {[1.0, 1.2, 1.4].map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => setSpeedRate(rate)}
                className={`px-1.5 py-0.5 rounded transition-colors ${
                  speedRate === rate ? "bg-amber-500 text-neutral-950 font-bold" : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>

          {/* Mute Button */}
          <button
            type="button"
            onClick={handleToggleMute}
            className={`px-3 py-1.5 rounded text-xs font-mono font-bold border transition-colors flex items-center gap-1.5 ${
              isMuted
                ? "bg-rose-950/60 border-rose-800 text-rose-300"
                : "bg-neutral-800 border-neutral-700 text-neutral-200 hover:border-neutral-500"
            }`}
          >
            <span>{isMuted ? "🔇 Muted" : "🔊 Live Audio"}</span>
          </button>
        </div>
      </div>

      {/* Active Spoken Line Spotlight */}
      <div className="bg-neutral-950 border border-neutral-800/80 rounded-lg p-3 min-h-[48px] flex items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="text-[10px] font-mono uppercase text-amber-400 block font-bold mb-0.5">
            {activeItem ? `${activeItem.minute}' Broadcast Telemetry` : "Standby for Match Commentary"}
          </span>
          <p className="text-xs font-medium text-neutral-200 truncate">
            {activeItem ? activeItem.text : "Awaiting next live tactical event or shot on goal..."}
          </p>
        </div>

        {/* Quick Demo Test Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => handleTestShout("goal")}
            className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 rounded text-[10px] font-mono font-bold text-amber-300 transition-colors"
          >
            ⚽ Goal!
          </button>
          <button
            type="button"
            onClick={() => handleTestShout("save")}
            className="px-2 py-1 bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 rounded text-[10px] font-mono font-bold text-sky-300 transition-colors"
          >
            🧤 Save!
          </button>
          <button
            type="button"
            onClick={() => handleTestShout("woodwork")}
            className="px-2 py-1 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 rounded text-[10px] font-mono font-bold text-purple-300 transition-colors"
          >
            💥 Post!
          </button>
        </div>
      </div>

      {/* Commentary History Feed */}
      {history.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-mono uppercase text-neutral-500 font-bold block">
            Recent Commentary Transcript
          </span>
          <div className="max-h-32 overflow-y-auto space-y-1 divide-y divide-neutral-800/50 pr-1">
            {history.map((h) => (
              <div key={h.id} className="pt-1 flex items-start gap-2 text-xs font-mono">
                <span className="text-amber-400 font-bold shrink-0">{h.minute}&apos;</span>
                <span className="text-neutral-300 leading-snug">{h.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
