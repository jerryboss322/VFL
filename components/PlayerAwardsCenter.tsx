"use client";

import React, { useState, useMemo } from "react";

export interface AwardPlayerStats {
  id: string;
  name: string;
  club: string;
  position: "GKP" | "DEF" | "MID" | "FWD";
  appearances: number;
  minutes: number;
  goals: number;
  penaltyGoals: number;
  xg: number;
  assists: number;
  xa: number;
  cleanSheets: number;
  saves: number;
  goalsConceded: number;
  yellowCards: number;
  redCards: number;
}

const SEASON_PLAYERS: AwardPlayerStats[] = [
  {
    id: "p_1",
    name: "Erling Haaland",
    club: "MCI",
    position: "FWD",
    appearances: 28,
    minutes: 2420,
    goals: 27,
    penaltyGoals: 4,
    xg: 24.8,
    assists: 5,
    xa: 4.1,
    cleanSheets: 0,
    saves: 0,
    goalsConceded: 0,
    yellowCards: 2,
    redCards: 0,
  },
  {
    id: "p_2",
    name: "Mohamed Salah",
    club: "LIV",
    position: "MID",
    appearances: 28,
    minutes: 2450,
    goals: 23,
    penaltyGoals: 3,
    xg: 20.2,
    assists: 15,
    xa: 13.4,
    cleanSheets: 0,
    saves: 0,
    goalsConceded: 0,
    yellowCards: 1,
    redCards: 0,
  },
  {
    id: "p_3",
    name: "Cole Palmer",
    club: "CHE",
    position: "MID",
    appearances: 27,
    minutes: 2310,
    goals: 21,
    penaltyGoals: 6,
    xg: 18.4,
    assists: 12,
    xa: 10.8,
    cleanSheets: 0,
    saves: 0,
    goalsConceded: 0,
    yellowCards: 3,
    redCards: 0,
  },
  {
    id: "p_4",
    name: "Alexander Isak",
    club: "NEW",
    position: "FWD",
    appearances: 25,
    minutes: 2040,
    goals: 20,
    penaltyGoals: 2,
    xg: 18.9,
    assists: 4,
    xa: 3.5,
    cleanSheets: 0,
    saves: 0,
    goalsConceded: 0,
    yellowCards: 2,
    redCards: 0,
  },
  {
    id: "p_5",
    name: "Bukayo Saka",
    club: "ARS",
    position: "MID",
    appearances: 27,
    minutes: 2380,
    goals: 16,
    penaltyGoals: 2,
    xg: 15.2,
    assists: 14,
    xa: 13.9,
    cleanSheets: 0,
    saves: 0,
    goalsConceded: 0,
    yellowCards: 3,
    redCards: 0,
  },
  {
    id: "p_6",
    name: "Ollie Watkins",
    club: "AVL",
    position: "FWD",
    appearances: 28,
    minutes: 2460,
    goals: 18,
    penaltyGoals: 0,
    xg: 17.5,
    assists: 10,
    xa: 8.7,
    cleanSheets: 0,
    saves: 0,
    goalsConceded: 0,
    yellowCards: 4,
    redCards: 0,
  },
  {
    id: "p_7",
    name: "David Raya",
    club: "ARS",
    position: "GKP",
    appearances: 28,
    minutes: 2520,
    goals: 0,
    penaltyGoals: 0,
    xg: 0.0,
    assists: 0,
    xa: 0.0,
    cleanSheets: 14,
    saves: 82,
    goalsConceded: 22,
    yellowCards: 1,
    redCards: 0,
  },
  {
    id: "p_8",
    name: "Alisson Becker",
    club: "LIV",
    position: "GKP",
    appearances: 26,
    minutes: 2340,
    goals: 0,
    penaltyGoals: 0,
    xg: 0.0,
    assists: 1,
    xa: 0.1,
    cleanSheets: 12,
    saves: 74,
    goalsConceded: 20,
    yellowCards: 0,
    redCards: 0,
  },
  {
    id: "p_9",
    name: "Ederson",
    club: "MCI",
    position: "GKP",
    appearances: 27,
    minutes: 2430,
    goals: 0,
    penaltyGoals: 0,
    xg: 0.0,
    assists: 0,
    xa: 0.0,
    cleanSheets: 11,
    saves: 68,
    goalsConceded: 26,
    yellowCards: 2,
    redCards: 0,
  },
];

export function PlayerAwardsCenter() {
  const [activeTab, setActiveTab] = useState<"boot" | "playmaker" | "glove" | "fairplay">("boot");
  const [searchQuery, setSearchQuery] = useState("");

  // Golden Boot ranking: goals DESC, assists DESC, minutes ASC
  const goldenBootList = useMemo(() => {
    return [...SEASON_PLAYERS]
      .filter((p) => p.position !== "GKP")
      .sort((a, b) => b.goals - a.goals || b.assists - a.assists || a.minutes - b.minutes);
  }, []);

  // Playmaker ranking: assists DESC, xa DESC, minutes ASC
  const playmakerList = useMemo(() => {
    return [...SEASON_PLAYERS]
      .filter((p) => p.position !== "GKP")
      .sort((a, b) => b.assists - a.assists || b.xa - a.xa || a.minutes - b.minutes);
  }, []);

  // Golden Glove ranking: clean sheets DESC, save % DESC
  const goldenGloveList = useMemo(() => {
    return [...SEASON_PLAYERS]
      .filter((p) => p.position === "GKP")
      .sort((a, b) => {
        if (b.cleanSheets !== a.cleanSheets) return b.cleanSheets - a.cleanSheets;
        const savePctA = a.saves / Math.max(1, a.saves + a.goalsConceded);
        const savePctB = b.saves / Math.max(1, b.saves + b.goalsConceded);
        return savePctB - savePctA;
      });
  }, []);

  // Fair play: yellow * 1 + red * 3 ASC
  const fairPlayList = useMemo(() => {
    return [...SEASON_PLAYERS].sort((a, b) => {
      const demeritsA = a.yellowCards * 1 + a.redCards * 3;
      const demeritsB = b.yellowCards * 1 + b.redCards * 3;
      return demeritsA - demeritsB || b.minutes - a.minutes;
    });
  }, []);

  const currentList = useMemo(() => {
    let list: AwardPlayerStats[] = [];
    if (activeTab === "boot") list = goldenBootList;
    else if (activeTab === "playmaker") list = playmakerList;
    else if (activeTab === "glove") list = goldenGloveList;
    else list = fairPlayList;

    if (!searchQuery) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (p) => p.name.toLowerCase().includes(q) || p.club.toLowerCase().includes(q)
    );
  }, [activeTab, goldenBootList, playmakerList, goldenGloveList, fairPlayList, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-amber-950/60 via-slate-900 to-slate-900/90 p-6 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-0.5 text-xs font-semibold text-amber-300">
                Seasonal Honors
              </span>
              <span className="text-xs text-white/50">Official League Individual Awards</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">
              Player Honors & Awards Race
            </h1>
            <p className="text-sm text-white/60">
              Authoritative race tracking for the Golden Boot, Playmaker Award, Golden Glove, and Fair Play index.
            </p>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="mt-6 flex flex-wrap gap-2 pt-2 border-t border-white/10">
          <button
            onClick={() => setActiveTab("boot")}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === "boot"
                ? "bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/20"
                : "bg-white/5 text-white/60 hover:text-white"
            }`}
          >
            🥇 Golden Boot (Top Scorer)
          </button>
          <button
            onClick={() => setActiveTab("playmaker")}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === "playmaker"
                ? "bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/20"
                : "bg-white/5 text-white/60 hover:text-white"
            }`}
          >
            🎯 Playmaker (Most Assists)
          </button>
          <button
            onClick={() => setActiveTab("glove")}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === "glove"
                ? "bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/20"
                : "bg-white/5 text-white/60 hover:text-white"
            }`}
          >
            🧤 Golden Glove (Clean Sheets)
          </button>
          <button
            onClick={() => setActiveTab("fairplay")}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === "fairplay"
                ? "bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/20"
                : "bg-white/5 text-white/60 hover:text-white"
            }`}
          >
            ⚖️ Fair Play Trophy
          </button>
        </div>
      </div>

      {/* Main Leaderboard Table */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 shadow-lg backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
          <h2 className="text-base font-bold text-white">
            {activeTab === "boot" && "Golden Boot Standings"}
            {activeTab === "playmaker" && "Playmaker Award Standings"}
            {activeTab === "glove" && "Golden Glove Standings"}
            {activeTab === "fairplay" && "Fair Play Disciplinary Index"}
          </h2>
          <input
            type="text"
            placeholder="Search player or club..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded-xl border border-white/10 bg-slate-950 px-3.5 py-1.5 text-xs text-white placeholder-white/30 focus:border-amber-400 focus:outline-none"
          />
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-white/50 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Rank</th>
                <th className="py-3 px-3">Player</th>
                <th className="py-3 px-3">Club</th>
                <th className="py-3 px-3">Pos</th>
                <th className="py-3 px-3 text-right">Apps (Mins)</th>
                {activeTab === "boot" && (
                  <>
                    <th className="py-3 px-4 text-right text-amber-300 font-bold">Goals</th>
                    <th className="py-3 px-3 text-right">Pens</th>
                    <th className="py-3 px-3 text-right">xG</th>
                    <th className="py-3 px-3 text-right">xG &Delta;</th>
                    <th className="py-3 px-3 text-right">Goals/90</th>
                    <th className="py-3 px-3 text-right">Assists</th>
                  </>
                )}
                {activeTab === "playmaker" && (
                  <>
                    <th className="py-3 px-4 text-right text-amber-300 font-bold">Assists</th>
                    <th className="py-3 px-3 text-right">xA</th>
                    <th className="py-3 px-3 text-right">xA &Delta;</th>
                    <th className="py-3 px-3 text-right">Assists/90</th>
                    <th className="py-3 px-3 text-right">Goals</th>
                  </>
                )}
                {activeTab === "glove" && (
                  <>
                    <th className="py-3 px-4 text-right text-amber-300 font-bold">Clean Sheets</th>
                    <th className="py-3 px-3 text-right">Saves</th>
                    <th className="py-3 px-3 text-right">Goals Conceded</th>
                    <th className="py-3 px-3 text-right">Save %</th>
                  </>
                )}
                {activeTab === "fairplay" && (
                  <>
                    <th className="py-3 px-3 text-right">Yellows</th>
                    <th className="py-3 px-3 text-right">Reds</th>
                    <th className="py-3 px-4 text-right text-emerald-400 font-bold">Demerits</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {currentList.map((player, idx) => {
                const nineties = Math.max(0.1, player.minutes / 90.0);
                const gP90 = (player.goals / nineties).toFixed(2);
                const aP90 = (player.assists / nineties).toFixed(2);
                const xgDelta = (player.goals - player.xg).toFixed(1);
                const xaDelta = (player.assists - player.xa).toFixed(1);
                const shotsFaced = player.saves + player.goalsConceded;
                const savePct = shotsFaced > 0 ? ((player.saves / shotsFaced) * 100).toFixed(1) : "0.0";
                const demerits = player.yellowCards * 1 + player.redCards * 3;

                return (
                  <tr key={player.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold">
                      {idx === 0 ? "🥇 1" : idx === 1 ? "🥈 2" : idx === 2 ? "🥉 3" : `#${idx + 1}`}
                    </td>
                    <td className="py-3.5 px-3 font-semibold text-white">{player.name}</td>
                    <td className="py-3.5 px-3">
                      <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] font-bold text-white/70">
                        {player.club}
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] font-bold text-white/50">
                        {player.position}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono text-white/60">
                      {player.appearances} ({player.minutes}&apos;)
                    </td>

                    {activeTab === "boot" && (
                      <>
                        <td className="py-3.5 px-4 text-right font-mono text-base font-black text-amber-300">
                          {player.goals}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono text-white/50">
                          {player.penaltyGoals}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono text-white/70">
                          {player.xg.toFixed(1)}
                        </td>
                        <td className={`py-3.5 px-3 text-right font-mono font-bold ${parseFloat(xgDelta) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {parseFloat(xgDelta) >= 0 ? `+${xgDelta}` : xgDelta}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono text-white/80">
                          {gP90}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono text-white/60">
                          {player.assists}
                        </td>
                      </>
                    )}

                    {activeTab === "playmaker" && (
                      <>
                        <td className="py-3.5 px-4 text-right font-mono text-base font-black text-amber-300">
                          {player.assists}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono text-white/70">
                          {player.xa.toFixed(1)}
                        </td>
                        <td className={`py-3.5 px-3 text-right font-mono font-bold ${parseFloat(xaDelta) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {parseFloat(xaDelta) >= 0 ? `+${xaDelta}` : xaDelta}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono text-white/80">
                          {aP90}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono text-white/60">
                          {player.goals}
                        </td>
                      </>
                    )}

                    {activeTab === "glove" && (
                      <>
                        <td className="py-3.5 px-4 text-right font-mono text-base font-black text-amber-300">
                          {player.cleanSheets}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono text-white/70">
                          {player.saves}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono text-white/60">
                          {player.goalsConceded}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono font-bold text-emerald-400">
                          {savePct}%
                        </td>
                      </>
                    )}

                    {activeTab === "fairplay" && (
                      <>
                        <td className="py-3.5 px-3 text-right font-mono text-amber-300">
                          {player.yellowCards}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono text-rose-400">
                          {player.redCards}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400">
                          {demerits} pts
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
