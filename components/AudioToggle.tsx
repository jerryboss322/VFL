"use client";

import React, { useEffect, useState } from "react";
import { isAudioEnabled, playBetPlacedSound, setAudioEnabled } from "@/lib/sound";

export function AudioToggle() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    setEnabled(isAudioEnabled());
  }, []);

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    setAudioEnabled(next);
    if (next) {
      playBetPlacedSound();
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={enabled ? "Mute Match Sound Effects" : "Enable Match Sound Effects"}
      title={enabled ? "Sound FX: Active (Click to Mute)" : "Sound FX: Muted (Click to Enable)"}
      className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 font-mono text-[11px] font-bold transition-all ${
        enabled
          ? "border-accent/40 bg-brand-dark text-accent hover:bg-graphite"
          : "border-line bg-coal text-fog hover:text-bone"
      }`}
    >
      {enabled ? (
        <>
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
            />
          </svg>
          <span className="hidden sm:inline">AUDIO ON</span>
        </>
      ) : (
        <>
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
            />
          </svg>
          <span className="hidden sm:inline">MUTED</span>
        </>
      )}
    </button>
  );
}
