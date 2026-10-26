"use client";

import React, { useState } from "react";
import { useApp } from "./AppContext";

export interface BracketClub {
  id: string;
  name: string;
  short: string;
}

export interface BracketTie {
  slot: number;
  clubA: BracketClub;
  clubB: BracketClub;
  leg1: string;
  leg2: string;
  aggregate: string;
  winnerId: string;
  winnerName: string;
  status: "upcoming" | "in_play" | "completed";
  summary?: string;
}

export interface TournamentBracketData {
  slug: string;
  name: string;
  currentRound: string;
  champion?: BracketClub;
  rounds: {
    roundOf16: BracketTie[];
    quarterFinals: BracketTie[];
    semiFinals: BracketTie[];
    final: {
      clubA: BracketClub;
      clubB: BracketClub;
      score: string;
      winnerId: string;
      winnerName: string;
      status: string;
      summary: string;
    };
  };
}

interface TournamentBracketViewProps {
  bracket: TournamentBracketData;
}

export function TournamentBracketView({ bracket }: TournamentBracketViewProps) {
  const [selectedTie, setSelectedTie] = useState<BracketTie | null>(null);

  const { roundOf16, quarterFinals, semiFinals, final } = bracket.rounds;

  return (
    <div className="space-y-6">
      {/* Champion Podium Spotlight */}
      {bracket.champion && (
        <div className="bg-gradient-to-r from-amber-950/60 via-amber-900/30 to-neutral-900 border border-amber-500/40 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-2xl">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-3xl shadow-inner">
              🏆
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold block">
                European Champion
              </span>
              <h2 className="text-2xl font-black text-neutral-100">{bracket.champion.name}</h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Victor of the Virtual European Champions Cup Knockout Tournament
              </p>
            </div>
          </div>
          <div className="text-right bg-neutral-950/60 border border-amber-500/20 px-4 py-2.5 rounded-xl font-mono text-xs">
            <span className="text-neutral-500 block text-[10px] uppercase">Final Result</span>
            <span className="text-amber-300 font-bold text-sm">{final.score}</span>
            <span className="text-neutral-400 block text-[10px] mt-0.5">{final.winnerName} Lift the Cup</span>
          </div>
        </div>
      )}

      {/* Interactive Horizontal Tree Bracket */}
      <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-6 shadow-xl overflow-x-auto">
        <div className="min-w-[960px] grid grid-cols-4 gap-6 relative">
          {/* Column 1: Round of 16 */}
          <div className="space-y-4">
            <div className="text-center pb-2 border-b border-neutral-800">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-300">
                Round of 16
              </span>
              <span className="text-[10px] font-mono text-neutral-500 block">2-Legged Aggregate</span>
            </div>
            <div className="space-y-3">
              {roundOf16.map((tie) => (
                <TieCard
                  key={`r16-${tie.slot}`}
                  tie={tie}
                  isSelected={selectedTie?.slot === tie.slot && selectedTie?.winnerId === tie.winnerId}
                  onClick={() => setSelectedTie(tie)}
                />
              ))}
            </div>
          </div>

          {/* Column 2: Quarter-Finals */}
          <div className="space-y-8 flex flex-col justify-around">
            <div className="text-center pb-2 border-b border-neutral-800">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-300">
                Quarter-Finals
              </span>
              <span className="text-[10px] font-mono text-neutral-500 block">2-Legged Aggregate</span>
            </div>
            <div className="space-y-12">
              {quarterFinals.map((tie) => (
                <TieCard
                  key={`qf-${tie.slot}`}
                  tie={tie}
                  isSelected={selectedTie?.slot === tie.slot && selectedTie?.winnerId === tie.winnerId}
                  onClick={() => setSelectedTie(tie)}
                />
              ))}
            </div>
          </div>

          {/* Column 3: Semi-Finals */}
          <div className="space-y-12 flex flex-col justify-around">
            <div className="text-center pb-2 border-b border-neutral-800">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-300">
                Semi-Finals
              </span>
              <span className="text-[10px] font-mono text-neutral-500 block">2-Legged Aggregate</span>
            </div>
            <div className="space-y-24">
              {semiFinals.map((tie) => (
                <TieCard
                  key={`sf-${tie.slot}`}
                  tie={tie}
                  isSelected={selectedTie?.slot === tie.slot && selectedTie?.winnerId === tie.winnerId}
                  onClick={() => setSelectedTie(tie)}
                />
              ))}
            </div>
          </div>

          {/* Column 4: Grand Final */}
          <div className="flex flex-col justify-center space-y-4">
            <div className="text-center pb-2 border-b border-amber-500/30">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400">
                Grand Final
              </span>
              <span className="text-[10px] font-mono text-neutral-400 block">Neutral Venue Showdown</span>
            </div>

            <div className="bg-gradient-to-b from-amber-950/40 to-neutral-950 border-2 border-amber-500/50 rounded-xl p-4 shadow-xl text-center space-y-3">
              <div className="text-2xl">🏆</div>

              <div className="space-y-2">
                <div
                  className={`p-2 rounded font-mono text-xs flex items-center justify-between ${
                    final.winnerId === final.clubA.id
                      ? "bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40"
                      : "bg-neutral-900 text-neutral-400"
                  }`}
                >
                  <span>{final.clubA.name}</span>
                  {final.winnerId === final.clubA.id && <span className="text-xs">👑 WINNER</span>}
                </div>

                <div className="text-xs font-mono text-neutral-500 font-bold uppercase tracking-widest">
                  VS
                </div>

                <div
                  className={`p-2 rounded font-mono text-xs flex items-center justify-between ${
                    final.winnerId === final.clubB.id
                      ? "bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40"
                      : "bg-neutral-900 text-neutral-400"
                  }`}
                >
                  <span>{final.clubB.name}</span>
                  {final.winnerId === final.clubB.id && <span className="text-xs">👑 WINNER</span>}
                </div>
              </div>

              <div className="pt-2 border-t border-neutral-800 text-[11px] font-mono text-amber-400 font-semibold">
                Score: {final.score}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Selected Tie Breakdown Modal / Drawer */}
      {selectedTie && (
        <div className="p-4 bg-neutral-950/90 border border-neutral-700 rounded-xl space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
            <h4 className="text-xs font-bold text-neutral-200">
              Tie Telemetry: {selectedTie.clubA.name} vs {selectedTie.clubB.name}
            </h4>
            <button
              onClick={() => setSelectedTie(null)}
              className="text-neutral-500 hover:text-neutral-200 text-base leading-none"
            >
              &times;
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center font-mono text-xs">
            <div className="bg-neutral-900 p-2 rounded">
              <span className="text-[10px] text-neutral-500 block uppercase">Leg 1</span>
              <span className="font-bold text-neutral-200">{selectedTie.leg1}</span>
            </div>
            <div className="bg-neutral-900 p-2 rounded">
              <span className="text-[10px] text-neutral-500 block uppercase">Leg 2</span>
              <span className="font-bold text-neutral-200">{selectedTie.leg2}</span>
            </div>
            <div className="bg-neutral-900 p-2 rounded border border-amber-500/30">
              <span className="text-[10px] text-amber-400 block uppercase">Aggregate</span>
              <span className="font-bold text-amber-300">{selectedTie.aggregate}</span>
            </div>
          </div>
          {selectedTie.summary && (
            <p className="text-xs font-mono text-neutral-400">{selectedTie.summary}</p>
          )}
        </div>
      )}
    </div>
  );
}

function TieCard({
  tie,
  isSelected,
  onClick,
}: {
  tie: BracketTie;
  isSelected?: boolean;
  onClick: () => void;
}) {
  const aWon = tie.winnerId === tie.clubA.id;
  const bWon = tie.winnerId === tie.clubB.id;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-xl border p-2.5 transition-all text-xs font-mono shadow-sm ${
        isSelected
          ? "bg-amber-500/15 border-amber-500 text-amber-200 shadow-md"
          : "bg-neutral-950/80 border-neutral-800 hover:border-neutral-600 text-neutral-300"
      }`}
    >
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className={`truncate ${aWon ? "font-bold text-neutral-100" : "text-neutral-400"}`}>
            {tie.clubA.short || tie.clubA.name}
          </span>
          {aWon && <span className="text-[10px] text-emerald-400 font-bold">✓</span>}
        </div>

        <div className="flex items-center justify-between">
          <span className={`truncate ${bWon ? "font-bold text-neutral-100" : "text-neutral-400"}`}>
            {tie.clubB.short || tie.clubB.name}
          </span>
          {bWon && <span className="text-[10px] text-emerald-400 font-bold">✓</span>}
        </div>
      </div>

      <div className="mt-2 pt-1.5 border-t border-neutral-800/80 flex items-center justify-between text-[10px] text-neutral-500">
        <span>Agg: <b className="text-amber-400">{tie.aggregate}</b></span>
        <span>L1: {tie.leg1} | L2: {tie.leg2}</span>
      </div>
    </button>
  );
}
