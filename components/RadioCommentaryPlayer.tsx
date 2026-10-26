"use client";

import React, { useState, useEffect } from "react";
import { stadiumCrowdEngine } from "@/lib/crowd_audio_engine";

export interface RadioCommentaryLine {
  id: string;
  speaker: string;
  role: "Lead Play-by-Play" | "Tactical Analyst" | "Pitchside Reporter";
  text: string;
  tone: "GOAL" | "TACTICAL" | "VAR" | "BUILDUP";
  timestampMinute: number;
}

interface RadioCommentaryPlayerProps {
  homeName: string;
  awayName: string;
}

const INITIAL_TRANSCRIPT: RadioCommentaryLine[] = [
  {
    id: "rad_1",
    speaker: "Marcus Sterling",
    role: "Lead Play-by-Play",
    text: "Welcome back to live European football! High stakes under the floodlights as both sides emerge from the tunnel.",
    tone: "BUILDUP",
    timestampMinute: 1,
  },
  {
    id: "rad_2",
    speaker: "Alan McCrory",
    role: "Tactical Analyst",
    text: "Expect an intense midfield press early on. Look at how compact the visiting defense has set up.",
    tone: "TACTICAL",
    timestampMinute: 3,
  },
  {
    id: "rad_3",
    speaker: "Clara Vane",
    role: "Pitchside Reporter",
    text: "Marcus, the manager has been barking instructions to push the high wing-backs into the final third.",
    tone: "BUILDUP",
    timestampMinute: 7,
  },
];

export function RadioCommentaryPlayer({ homeName, awayName }: RadioCommentaryPlayerProps) {
  const [transcript, setTranscript] = useState<RadioCommentaryLine[]>(INITIAL_TRANSCRIPT);
  const [activeSpeaker, setActiveSpeaker] = useState<string>("Marcus Sterling");
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isTtsEnabled, setIsTtsEnabled] = useState<boolean>(false);
  const [duckingLevel, setDuckingLevel] = useState<number>(85); // 85% normal crowd

  const speakText = (text: string, pitch = 1.0, rate = 1.05) => {
    if (!isTtsEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = pitch;
    utterance.rate = rate;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const triggerGoalDialog = () => {
    setIsSpeaking(true);
    setDuckingLevel(35); // Duck crowd to 35%
    setActiveSpeaker("Marcus Sterling");

    const goalText = `GOAL! SENSATIONAL FINISH! ${homeName.toUpperCase()} FIND THE BREAKTHROUGH! THE STADIUM ERUPTS!`;
    const newLine1: RadioCommentaryLine = {
      id: `rad_${Date.now()}_1`,
      speaker: "Marcus Sterling",
      role: "Lead Play-by-Play",
      text: goalText,
      tone: "GOAL",
      timestampMinute: Math.floor(Math.random() * 85) + 1,
    };

    setTranscript((prev) => [...prev, newLine1]);
    stadiumCrowdEngine.triggerRefereeWhistle(false);
    stadiumCrowdEngine.triggerGoalRoar();
    speakText(goalText, 1.25, 1.15);

    setTimeout(() => {
      setActiveSpeaker("Alan McCrory");
      setDuckingLevel(70);
      const analystText = `You simply cannot give him that much space inside the penalty area. Pure technical perfection off the laces, Marcus.`;
      const newLine2: RadioCommentaryLine = {
        id: `rad_${Date.now()}_2`,
        speaker: "Alan McCrory",
        role: "Tactical Analyst",
        text: analystText,
        tone: "TACTICAL",
        timestampMinute: newLine1.timestampMinute,
      };
      setTranscript((prev) => [...prev, newLine2]);
      speakText(analystText, 0.9, 1.0);

      setTimeout(() => {
        setIsSpeaking(false);
        setDuckingLevel(85);
      }, 3500);
    }, 2800);
  };

  const triggerVarDisputeDialog = () => {
    setIsSpeaking(true);
    setActiveSpeaker("Marcus Sterling");
    setDuckingLevel(80);

    const varText = `Hold on, the referee has his finger to his ear! We have a potential VAR review underway!`;
    const newLine1: RadioCommentaryLine = {
      id: `rad_var_${Date.now()}_1`,
      speaker: "Marcus Sterling",
      role: "Lead Play-by-Play",
      text: varText,
      tone: "VAR",
      timestampMinute: 55,
    };

    setTranscript((prev) => [...prev, newLine1]);
    speakText(varText, 1.1, 1.05);

    setTimeout(() => {
      setActiveSpeaker("Clara Vane");
      const pitchsideText = `Marcus, Alan, the dugout is in total disbelief down here. The coaching staff is demanding an on-field review!`;
      const newLine2: RadioCommentaryLine = {
        id: `rad_var_${Date.now()}_2`,
        speaker: "Clara Vane",
        role: "Pitchside Reporter",
        text: pitchsideText,
        tone: "VAR",
        timestampMinute: 55,
      };
      setTranscript((prev) => [...prev, newLine2]);
      speakText(pitchsideText, 1.15, 1.1);

      setTimeout(() => {
        setIsSpeaking(false);
      }, 3000);
    }, 2500);
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 p-5 shadow-2xl backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-0.5 text-xs font-semibold text-indigo-400">
              <span className="h-2 w-2 rounded-full bg-indigo-400 animate-ping" />
              Live Studio Radio Booth
            </span>
            <span className="text-xs text-white/50">{homeName} vs {awayName}</span>
          </div>
          <h3 className="mt-1.5 text-lg font-bold text-white">Dual-Broadcaster Radio Stream</h3>
        </div>

        {/* Studio Controls */}
        <div className="flex items-center gap-3">
          {/* TTS Audio Speech Toggle */}
          <button
            type="button"
            onClick={() => setIsTtsEnabled(!isTtsEnabled)}
            className={`rounded-xl border px-3.5 py-1.5 text-xs font-semibold transition-all ${
              isTtsEnabled
                ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-300"
                : "border-white/10 bg-white/5 text-white/50 hover:text-white"
            }`}
          >
            {isTtsEnabled ? "🎙 Speech Synthesis: ON" : "🔇 Speech Synthesis: OFF"}
          </button>

          {/* Simulate Action Triggers */}
          <button
            type="button"
            onClick={triggerGoalDialog}
            className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-300 hover:bg-rose-500/20"
          >
            Simulate Goal ⚽
          </button>
          <button
            type="button"
            onClick={triggerVarDisputeDialog}
            className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-500/20"
          >
            VAR Dispute 📺
          </button>
        </div>
      </div>

      {/* Broadcaster Booth Avatars */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Lead Announcer */}
        <div
          className={`rounded-xl border p-3 transition-all ${
            activeSpeaker === "Marcus Sterling" && isSpeaking
              ? "border-indigo-500/60 bg-indigo-500/10 ring-1 ring-indigo-500/40 shadow-lg shadow-indigo-500/10"
              : "border-white/5 bg-slate-950/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-white">Marcus Sterling</div>
            {activeSpeaker === "Marcus Sterling" && isSpeaking && (
              <span className="h-2 w-2 rounded-full bg-indigo-400 animate-ping" />
            )}
          </div>
          <div className="text-[10px] text-indigo-300/80">Lead Play-by-Play</div>
          <div className="mt-2 flex items-center gap-1">
            <span className="h-2 w-1 rounded-full bg-indigo-400 animate-pulse" />
            <span className="h-3 w-1 rounded-full bg-indigo-400 animate-pulse" />
            <span className="h-2 w-1 rounded-full bg-indigo-400 animate-pulse" />
            <span className="text-[10px] text-white/40 ml-1">On Air</span>
          </div>
        </div>

        {/* Tactical Color Analyst */}
        <div
          className={`rounded-xl border p-3 transition-all ${
            activeSpeaker === "Alan McCrory" && isSpeaking
              ? "border-amber-500/60 bg-amber-500/10 ring-1 ring-amber-500/40 shadow-lg shadow-amber-500/10"
              : "border-white/5 bg-slate-950/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-white">Alan McCrory</div>
            {activeSpeaker === "Alan McCrory" && isSpeaking && (
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
            )}
          </div>
          <div className="text-[10px] text-amber-300/80">Tactical Color Analyst</div>
          <div className="mt-2 text-[10px] text-white/40">Tactical Shape & Formations</div>
        </div>

        {/* Pitchside Reporter */}
        <div
          className={`rounded-xl border p-3 transition-all ${
            activeSpeaker === "Clara Vane" && isSpeaking
              ? "border-emerald-500/60 bg-emerald-500/10 ring-1 ring-emerald-500/40 shadow-lg shadow-emerald-500/10"
              : "border-white/5 bg-slate-950/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-white">Clara Vane</div>
            {activeSpeaker === "Clara Vane" && isSpeaking && (
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            )}
          </div>
          <div className="text-[10px] text-emerald-300/80">Pitchside Touchline Reporter</div>
          <div className="mt-2 text-[10px] text-white/40">Dugout & Injury Telemetry</div>
        </div>
      </div>

      {/* Live Transcript Stream */}
      <div className="mt-4 max-h-[180px] overflow-y-auto space-y-2 pr-1 rounded-xl bg-slate-950/60 border border-white/5 p-3">
        {transcript.slice().reverse().map((line) => (
          <div
            key={line.id}
            className={`rounded-lg p-2.5 text-xs transition-colors ${
              line.tone === "GOAL"
                ? "bg-rose-500/10 border border-rose-500/30"
                : line.tone === "VAR"
                ? "bg-amber-500/10 border border-amber-500/30"
                : "bg-white/[0.02] border border-white/5"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-white flex items-center gap-2">
                {line.speaker}
                <span className="text-[10px] text-white/40 font-normal">({line.role})</span>
              </span>
              <span className="font-mono text-[10px] text-white/40">{line.timestampMinute}&apos;</span>
            </div>
            <p className="text-white/80 leading-relaxed">{line.text}</p>
          </div>
        ))}
      </div>

      {/* Ducking Telemetry Bar */}
      <div className="mt-3 flex items-center justify-between text-[11px] text-white/40">
        <span>Acoustic Mix: Crowd Ambience ({duckingLevel}%)</span>
        <span>Prosody SSML Markup Active</span>
      </div>
    </div>
  );
}
