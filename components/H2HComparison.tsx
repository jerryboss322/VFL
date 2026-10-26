"use client";

import React, { useState, useEffect } from "react";
import type { Club } from "@/types/api";

interface H2HComparisonProps {
  homeClub: Club;
  awayClub: Club;
}

interface H2HData {
  clubA: {
    id: string;
    name: string;
    shortName: string;
    attackRating: number;
    defenseRating: number;
    radar: {
      attack: number;
      defense: number;
      form: number;
      possession: number;
      pressing: number;
      setPieces: number;
    };
  };
  clubB: {
    id: string;
    name: string;
    shortName: string;
    attackRating: number;
    defenseRating: number;
    radar: {
      attack: number;
      defense: number;
      form: number;
      possession: number;
      pressing: number;
      setPieces: number;
    };
  };
  clashHistory: {
    total_matches: number;
    club_a_wins: number;
    club_b_wins: number;
    draws: number;
    club_a_goals: number;
    club_b_goals: number;
    avg_goals_per_match: number;
    btts_percentage: number;
    clean_sheets_a: number;
    clean_sheets_b: number;
  };
  predictiveMatrix: {
    home_xg: number;
    away_xg: number;
    home_win_probability: number;
    draw_probability: number;
    away_win_probability: number;
    over_2_5_probability: number;
    under_2_5_probability: number;
    btts_yes_probability: number;
    btts_no_probability: number;
    top_scores: Array<{ score: string; probability: number }>;
  };
}

export function H2HComparison({ homeClub, awayClub }: H2HComparisonProps) {
  const [data, setData] = useState<H2HData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchH2H() {
      try {
        setLoading(true);
        const res = await fetch(`/api/analytics/h2h/${homeClub.id}/${awayClub.id}`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
        console.error("Failed to load H2H analytics", err);
      } finally {
        setLoading(false);
      }
    }
    if (homeClub.id && awayClub.id) {
      void fetchH2H();
    }
  }, [homeClub.id, awayClub.id]);

  if (loading || !data) {
    return (
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 text-center text-xs font-mono text-neutral-400">
        Computing Poisson goal expectations and tactical clash telemetry...
      </div>
    );
  }

  const { predictiveMatrix, clashHistory, clubA, clubB } = data;

  const homeWinPct = Math.round(predictiveMatrix.home_win_probability * 100);
  const drawPct = Math.round(predictiveMatrix.draw_probability * 100);
  const awayWinPct = Math.round(predictiveMatrix.away_win_probability * 100);

  const radarMetrics = [
    { label: "Attack Power", key: "attack" as const },
    { label: "Defensive Solidity", key: "defense" as const },
    { label: "Form Momentum", key: "form" as const },
    { label: "Possession Control", key: "possession" as const },
    { label: "High Pressing", key: "pressing" as const },
    { label: "Set Pieces", key: "setPieces" as const },
  ];

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-lg space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
        <div>
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-200 flex items-center gap-2">
            <span>Predictive Intelligence & Head-to-Head</span>
            <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.2 rounded">
              Poisson xG Engine
            </span>
          </h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            Dixon-Coles bivariate goal expectancy and tactical rating comparison.
          </p>
        </div>
        <div className="text-right font-mono text-xs text-neutral-400">
          Expected Goals: <b className="text-neutral-100">{predictiveMatrix.home_xg}</b> - <b className="text-neutral-100">{predictiveMatrix.away_xg}</b>
        </div>
      </div>

      {/* 1. Win / Draw / Away Probability Segmented Bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs font-mono font-semibold">
          <span className="text-amber-400">{homeClub.shortName || homeClub.name}: {homeWinPct}%</span>
          <span className="text-neutral-400">Draw: {drawPct}%</span>
          <span className="text-sky-400">{awayClub.shortName || awayClub.name}: {awayWinPct}%</span>
        </div>
        <div className="h-3 w-full rounded-full overflow-hidden flex bg-neutral-950 border border-neutral-800">
          <div style={{ width: `${homeWinPct}%` }} className="bg-amber-500 h-full transition-all duration-500" />
          <div style={{ width: `${drawPct}%` }} className="bg-neutral-600 h-full transition-all duration-500" />
          <div style={{ width: `${awayWinPct}%` }} className="bg-sky-500 h-full transition-all duration-500" />
        </div>
      </div>

      {/* 2. Top Poisson Predicted Scores */}
      <div className="space-y-2">
        <span className="text-[11px] font-mono uppercase text-neutral-400 font-bold block">
          Most Probable Full-Time Scores
        </span>
        <div className="grid grid-cols-5 gap-2 font-mono text-xs text-center">
          {predictiveMatrix.top_scores.map((sc) => (
            <div
              key={sc.score}
              className="bg-neutral-950/80 border border-neutral-800 rounded-lg p-2.5 transition-colors hover:border-amber-500/40"
            >
              <span className="font-black text-sm text-neutral-100 block">{sc.score}</span>
              <span className="text-[10px] text-amber-400 font-bold block mt-0.5">
                {(sc.probability * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Goals & BTTS Probabilities */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
        <div className="bg-neutral-950/60 border border-neutral-800 rounded-lg p-2.5 text-center">
          <span className="text-[10px] text-neutral-500 block uppercase">Over 2.5 Goals</span>
          <span className="text-sm font-bold text-emerald-400">
            {(predictiveMatrix.over_2_5_probability * 100).toFixed(1)}%
          </span>
        </div>
        <div className="bg-neutral-950/60 border border-neutral-800 rounded-lg p-2.5 text-center">
          <span className="text-[10px] text-neutral-500 block uppercase">Under 2.5 Goals</span>
          <span className="text-sm font-bold text-neutral-300">
            {(predictiveMatrix.under_2_5_probability * 100).toFixed(1)}%
          </span>
        </div>
        <div className="bg-neutral-950/60 border border-neutral-800 rounded-lg p-2.5 text-center">
          <span className="text-[10px] text-neutral-500 block uppercase">BTTS: Yes</span>
          <span className="text-sm font-bold text-amber-400">
            {(predictiveMatrix.btts_yes_probability * 100).toFixed(1)}%
          </span>
        </div>
        <div className="bg-neutral-950/60 border border-neutral-800 rounded-lg p-2.5 text-center">
          <span className="text-[10px] text-neutral-500 block uppercase">Historic BTTS Rate</span>
          <span className="text-sm font-bold text-neutral-300">
            {clashHistory.btts_percentage}%
          </span>
        </div>
      </div>

      {/* 4. Head-to-Head Radar Metric Comparison Bars */}
      <div className="space-y-3 pt-2 border-t border-neutral-800">
        <span className="text-[11px] font-mono uppercase text-neutral-400 font-bold block">
          Tactical Metric Showdown
        </span>
        <div className="space-y-2.5">
          {radarMetrics.map((m) => {
            const valA = clubA.radar[m.key] || 70;
            const valB = clubB.radar[m.key] || 70;

            return (
              <div key={m.key} className="space-y-1">
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-amber-400 font-semibold">{valA}</span>
                  <span className="text-neutral-400">{m.label}</span>
                  <span className="text-sky-400 font-semibold">{valB}</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 h-1.5">
                  <div className="bg-neutral-950 rounded-full overflow-hidden flex justify-end">
                    <div
                      style={{ width: `${valA}%` }}
                      className="bg-amber-500 h-full rounded-full"
                    />
                  </div>
                  <div className="bg-neutral-950 rounded-full overflow-hidden flex justify-start">
                    <div
                      style={{ width: `${valB}%` }}
                      className="bg-sky-500 h-full rounded-full"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
