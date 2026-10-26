"use client";

import React, { useMemo } from "react";
import type { FantasyPlayer } from "./FantasySquadBuilder";

export interface LivePlayerPerformance {
  playerId: string;
  name: string;
  clubShort: string;
  position: string;
  minutesPlayed: number;
  goals: number;
  assists: number;
  cleanSheet: boolean;
  yellowCards: number;
  redCards: number;
  bonusPoints: number;
  totalPoints: number;
  isCaptain?: boolean;
  isVice?: boolean;
  isSubbedIn?: boolean;
}

interface FantasyPerformanceTrackerProps {
  gameweek: number;
  rosterTeamName: string;
  overallRank: number;
  gameweekPoints: number;
  livePlayers: LivePlayerPerformance[];
  benchPlayers: LivePlayerPerformance[];
  dreamTeam: LivePlayerPerformance[];
}

export function FantasyPerformanceTracker({
  gameweek,
  rosterTeamName,
  overallRank,
  gameweekPoints,
  livePlayers,
  benchPlayers,
  dreamTeam,
}: FantasyPerformanceTrackerProps) {
  const activePlayingCount = useMemo(() => {
    return livePlayers.filter((p) => p.minutesPlayed > 0).length;
  }, [livePlayers]);

  const topPerformer = useMemo(() => {
    if (!livePlayers.length) return null;
    return [...livePlayers].sort((a, b) => b.totalPoints - a.totalPoints)[0];
  }, [livePlayers]);

  return (
    <div className="space-y-4">
      {/* Gameweek Summary Header */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3.5">
          <span className="text-[10px] font-mono uppercase text-neutral-500 block">Gameweek {gameweek}</span>
          <span className="text-xl font-mono font-black text-amber-400">+{gameweekPoints} pts</span>
          <span className="text-[10px] text-neutral-400 block mt-0.5">{rosterTeamName}</span>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3.5">
          <span className="text-[10px] font-mono uppercase text-neutral-500 block">Global Manager Rank</span>
          <span className="text-xl font-mono font-black text-neutral-100">#{overallRank}</span>
          <span className="text-[10px] text-emerald-400 font-mono block mt-0.5">Top 5% Tier</span>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3.5">
          <span className="text-[10px] font-mono uppercase text-neutral-500 block">Players Active</span>
          <span className="text-xl font-mono font-black text-neutral-100">{activePlayingCount} / 11</span>
          <span className="text-[10px] text-neutral-400 font-mono block mt-0.5">In-Play or Completed</span>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3.5">
          <span className="text-[10px] font-mono uppercase text-neutral-500 block">Star Performer</span>
          <span className="text-sm font-bold text-neutral-100 truncate block">
            {topPerformer ? topPerformer.name : "None"}
          </span>
          <span className="text-[10px] text-amber-400 font-mono block mt-0.5">
            {topPerformer ? `+${topPerformer.totalPoints} pts` : "0 pts"}
          </span>
        </div>
      </div>

      {/* Starting XI Performance Table */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 shadow-lg space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-200 flex items-center gap-2">
            <span>Starting XI Live Performance</span>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 border border-emerald-800 px-1.5 py-0.2 rounded">
              Live Tally
            </span>
          </h3>
          <span className="text-[10px] font-mono text-neutral-500">
            Captaincy doubled (2x) automatically
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-neutral-800/80 text-[10px] font-mono text-neutral-500 uppercase">
                <th className="py-2 px-2">Player</th>
                <th className="py-2 px-2">Club</th>
                <th className="py-2 px-2">Pos</th>
                <th className="py-2 px-2 text-center">Mins</th>
                <th className="py-2 px-2 text-center">G</th>
                <th className="py-2 px-2 text-center">A</th>
                <th className="py-2 px-2 text-center">CS</th>
                <th className="py-2 px-2 text-center">Cards</th>
                <th className="py-2 px-2 text-center">Bonus</th>
                <th className="py-2 px-2 text-right">Pts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/40 font-mono">
              {livePlayers.map((p) => {
                const multiplier = p.isCaptain ? 2 : 1;
                const netPoints = p.totalPoints * multiplier;

                return (
                  <tr key={p.playerId} className="hover:bg-neutral-800/30 transition-colors">
                    <td className="py-2.5 px-2">
                      <div className="flex items-center gap-1.5">
                        {p.isCaptain && (
                          <span className="w-4 h-4 rounded-full bg-amber-500 text-neutral-950 text-[9px] font-black flex items-center justify-center">
                            C
                          </span>
                        )}
                        {p.isVice && (
                          <span className="w-4 h-4 rounded-full bg-neutral-300 text-neutral-950 text-[9px] font-black flex items-center justify-center">
                            V
                          </span>
                        )}
                        <span className="font-semibold text-neutral-200">{p.name}</span>
                        {p.isSubbedIn && (
                          <span className="text-[9px] text-emerald-400 bg-emerald-950 px-1 rounded">
                            Auto-Sub
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-neutral-400">{p.clubShort}</td>
                    <td className="py-2.5 px-2">
                      <span className="px-1.5 py-0.2 rounded bg-neutral-800 text-[10px] font-bold text-amber-400">
                        {p.position}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-center text-neutral-300">{p.minutesPlayed}&apos;</td>
                    <td className="py-2.5 px-2 text-center text-amber-400 font-bold">{p.goals || "-"}</td>
                    <td className="py-2.5 px-2 text-center text-neutral-300">{p.assists || "-"}</td>
                    <td className="py-2.5 px-2 text-center text-emerald-400">
                      {p.cleanSheet ? "✓" : "-"}
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      {p.redCards > 0 ? (
                        <span className="text-rose-500 font-bold">🟥</span>
                      ) : p.yellowCards > 0 ? (
                        <span className="text-amber-400">🟨</span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="py-2.5 px-2 text-center text-amber-300 font-bold">
                      {p.bonusPoints > 0 ? `+${p.bonusPoints}` : "-"}
                    </td>
                    <td className="py-2.5 px-2 text-right">
                      <span className="font-black text-sm text-neutral-100">
                        {netPoints > 0 ? `+${netPoints}` : netPoints}
                      </span>
                      {p.isCaptain && (
                        <span className="text-[9px] text-neutral-500 block font-normal">(x2)</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bench Live Performance */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 shadow-lg space-y-2">
        <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-400">
          Bench Reserve Points
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
          {benchPlayers.map((bp) => (
            <div
              key={bp.playerId}
              className="bg-neutral-950/70 border border-neutral-800 rounded-lg p-2 flex items-center justify-between"
            >
              <div className="min-w-0">
                <p className="font-semibold text-neutral-200 truncate">{bp.name}</p>
                <p className="text-[10px] text-neutral-500">{bp.position} • {bp.clubShort}</p>
              </div>
              <span className="text-sm font-bold text-neutral-400">+{bp.totalPoints}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Gameweek Dream Team Spotlight */}
      <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-4 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <span>⭐ Matchday Dream Team</span>
          </h3>
          <span className="text-[10px] font-mono text-neutral-400">Highest-scoring XI across Europe</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          {dreamTeam.map((dt) => (
            <div
              key={dt.playerId}
              className="bg-neutral-950/80 border border-amber-500/20 rounded-lg p-2 text-center"
            >
              <span className="text-[10px] font-mono text-amber-400 font-bold block">{dt.position}</span>
              <p className="text-xs font-semibold text-neutral-100 truncate mt-0.5">{dt.name}</p>
              <p className="text-[10px] text-neutral-500">{dt.clubShort}</p>
              <span className="mt-1 inline-block px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 font-mono text-[10px] font-bold">
                +{dt.totalPoints} pts
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
