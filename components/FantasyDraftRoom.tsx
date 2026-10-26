"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { formatMinor } from "@/lib/betslip";

export interface DraftPlayer {
  id: string;
  name: string;
  club: string;
  position: "GKP" | "DEF" | "MID" | "FWD";
  vorpScore: number;
  projectedPoints: number;
  priceMajor: number;
  image?: string;
}

export interface DraftPickRecord {
  overallPick: number;
  roundNumber: number;
  pickInRound: number;
  teamId: string;
  teamName: string;
  player?: DraftPlayer;
  timestamp?: number;
}

export interface DraftTeam {
  id: string;
  name: string;
  isUser: boolean;
  roster: DraftPlayer[];
}

const INITIAL_TEAMS: DraftTeam[] = [
  { id: "team_1", name: "Apex Strikers (You)", isUser: true, roster: [] },
  { id: "team_2", name: "London Royals", isUser: false, roster: [] },
  { id: "team_3", name: "Bavarian Titans", isUser: false, roster: [] },
  { id: "team_4", name: "Catalan Kings", isUser: false, roster: [] },
];

const INITIAL_PLAYERS: DraftPlayer[] = [
  { id: "p1", name: "Erling Haaland", club: "MCI", position: "FWD", vorpScore: 16.8, projectedPoints: 245, priceMajor: 15.0 },
  { id: "p2", name: "Mohamed Salah", club: "LIV", position: "MID", vorpScore: 15.2, projectedPoints: 232, priceMajor: 13.5 },
  { id: "p3", name: "Bukayo Saka", club: "ARS", position: "MID", vorpScore: 12.9, projectedPoints: 210, priceMajor: 10.5 },
  { id: "p4", name: "Cole Palmer", club: "CHE", position: "MID", vorpScore: 13.4, projectedPoints: 218, priceMajor: 11.0 },
  { id: "p5", name: "Trent Alexander-Arnold", club: "LIV", position: "DEF", vorpScore: 10.5, projectedPoints: 175, priceMajor: 7.5 },
  { id: "p6", name: "Ollie Watkins", club: "AVL", position: "FWD", vorpScore: 11.7, projectedPoints: 195, priceMajor: 9.0 },
  { id: "p7", name: "William Saliba", club: "ARS", position: "DEF", vorpScore: 9.2, projectedPoints: 158, priceMajor: 6.5 },
  { id: "p8", name: "David Raya", club: "ARS", position: "GKP", vorpScore: 7.8, projectedPoints: 142, priceMajor: 5.5 },
  { id: "p9", name: "Alisson Becker", club: "LIV", position: "GKP", vorpScore: 7.4, projectedPoints: 138, priceMajor: 5.5 },
  { id: "p10", name: "Gabriel Magalhães", club: "ARS", position: "DEF", vorpScore: 8.9, projectedPoints: 152, priceMajor: 6.0 },
  { id: "p11", name: "Phil Foden", club: "MCI", position: "MID", vorpScore: 11.5, projectedPoints: 192, priceMajor: 9.5 },
  { id: "p12", name: "Alexander Isak", club: "NEW", position: "FWD", vorpScore: 10.8, projectedPoints: 184, priceMajor: 8.5 },
  { id: "p13", name: "Virgil van Dijk", club: "LIV", position: "DEF", vorpScore: 8.5, projectedPoints: 146, priceMajor: 6.0 },
  { id: "p14", name: "Son Heung-min", club: "TOT", position: "MID", vorpScore: 10.2, projectedPoints: 178, priceMajor: 9.5 },
  { id: "p15", name: "Emiliano Martínez", club: "AVL", position: "GKP", vorpScore: 6.9, projectedPoints: 130, priceMajor: 5.0 },
  { id: "p16", name: "Josko Gvardiol", club: "MCI", position: "DEF", vorpScore: 8.1, projectedPoints: 140, priceMajor: 6.0 },
  { id: "p17", name: "Kai Havertz", club: "ARS", position: "FWD", vorpScore: 9.7, projectedPoints: 168, priceMajor: 8.0 },
  { id: "p18", name: "Bruno Fernandes", club: "MUN", position: "MID", vorpScore: 9.9, projectedPoints: 172, priceMajor: 8.5 },
  { id: "p19", name: "Pedro Porro", club: "TOT", position: "DEF", vorpScore: 7.6, projectedPoints: 135, priceMajor: 5.5 },
  { id: "p20", name: "Guglielmo Vicario", club: "TOT", position: "GKP", vorpScore: 6.4, projectedPoints: 124, priceMajor: 5.0 },
];

const TOTAL_ROUNDS = 15;

function generateSnakeTimeline(teams: DraftTeam[]): DraftPickRecord[] {
  const timeline: DraftPickRecord[] = [];
  let overall = 1;
  for (let r = 1; r <= TOTAL_ROUNDS; r++) {
    const roundTeams = r % 2 !== 0 ? teams : [...teams].reverse();
    roundTeams.forEach((t, idx) => {
      timeline.push({
        overallPick: overall++,
        roundNumber: r,
        pickInRound: idx + 1,
        teamId: t.id,
        teamName: t.name,
      });
    });
  }
  return timeline;
}

export function FantasyDraftRoom() {
  const [teams, setTeams] = useState<DraftTeam[]>(INITIAL_TEAMS);
  const [availablePlayers, setAvailablePlayers] = useState<DraftPlayer[]>(INITIAL_PLAYERS);
  const [pickTimeline, setPickTimeline] = useState<DraftPickRecord[]>(() =>
    generateSnakeTimeline(INITIAL_TEAMS)
  );
  const [currentPickIndex, setCurrentPickIndex] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState(45);
  const [isDraftActive, setIsDraftActive] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [posFilter, setPosFilter] = useState<"ALL" | "GKP" | "DEF" | "MID" | "FWD">("ALL");
  const [selectedRosterTeamId, setSelectedRosterTeamId] = useState<string>("team_1");

  const currentPick = pickTimeline[currentPickIndex] || null;
  const isComplete = currentPickIndex >= pickTimeline.length;

  const activeTeam = useMemo(() => {
    if (!currentPick) return null;
    return teams.find((t) => t.id === currentPick.teamId) || null;
  }, [currentPick, teams]);

  // Check quota for a team
  const canTeamPickPos = useCallback((team: DraftTeam, pos: string) => {
    const gkp = team.roster.filter((p) => p.position === "GKP").length;
    const def = team.roster.filter((p) => p.position === "DEF").length;
    const mid = team.roster.filter((p) => p.position === "MID").length;
    const fwd = team.roster.filter((p) => p.position === "FWD").length;

    if (pos === "GKP" && gkp >= 2) return false;
    if (pos === "DEF" && def >= 5) return false;
    if (pos === "MID" && mid >= 5) return false;
    if (pos === "FWD" && fwd >= 3) return false;
    return true;
  }, []);

  const handleMakePick = useCallback((player: DraftPlayer) => {
    if (!currentPick || !activeTeam) return;
    if (!canTeamPickPos(activeTeam, player.position)) {
      alert(`Positional quota reached for ${player.position}!`);
      return;
    }

    // Execute pick
    const updatedPick: DraftPickRecord = {
      ...currentPick,
      player,
      timestamp: Date.now(),
    };

    setPickTimeline((prev) => {
      const copy = [...prev];
      copy[currentPickIndex] = updatedPick;
      return copy;
    });

    setTeams((prev) =>
      prev.map((t) =>
        t.id === activeTeam.id ? { ...t, roster: [...t.roster, player] } : t
      )
    );

    setAvailablePlayers((prev) => prev.filter((p) => p.id !== player.id));
    setCurrentPickIndex((prev) => prev + 1);
    setTimerSeconds(45);
  }, [currentPick, activeTeam, canTeamPickPos, currentPickIndex]);

  const triggerAutoPick = useCallback(() => {
    if (!currentPick || !activeTeam || availablePlayers.length === 0) return;
    // Find highest VORP player that fits active team's quota
    const candidate = availablePlayers.find((p) => canTeamPickPos(activeTeam, p.position));
    if (candidate) {
      handleMakePick(candidate);
    }
  }, [currentPick, activeTeam, availablePlayers, canTeamPickPos, handleMakePick]);

  // Turn countdown timer
  useEffect(() => {
    if (!isDraftActive || isComplete) return;

    const interval = setInterval(() => {
      setTimerSeconds((prev) => {
        if (prev <= 1) {
          // Auto pick when timer hits 0
          triggerAutoPick();
          return 45;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isDraftActive, isComplete, triggerAutoPick]);

  // Filtered pool
  const filteredPlayers = useMemo(() => {
    return availablePlayers
      .filter((p) => {
        if (posFilter !== "ALL" && p.position !== posFilter) return false;
        if (
          searchTerm &&
          !p.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !p.club.toLowerCase().includes(searchTerm.toLowerCase())
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => b.vorpScore - a.vorpScore);
  }, [availablePlayers, posFilter, searchTerm]);

  const selectedTeam: DraftTeam =
    teams.find((t) => t.id === selectedRosterTeamId) ??
    teams[0] ?? {
      id: "team_1",
      name: "Apex Strikers (You)",
      isUser: true,
      roster: [],
    };

  return (
    <div className="space-y-6">
      {/* Draft Command Header */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-emerald-950/60 via-slate-900 to-slate-900/90 p-6 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-0.5 text-xs font-semibold text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                Live Snake Draft
              </span>
              <span className="text-xs text-white/50">15 Rounds &bull; 4 Teams &bull; 60 Total Picks</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">
              Fantasy Draft War Room
            </h1>
            <p className="text-sm text-white/60">
              Value-Over-Replacement (VORP) algorithmic draft board with real-time snake rotation.
            </p>
          </div>

          {/* Clock & Status */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/40 px-5 py-3">
              <div className="text-right">
                <div className="text-[10px] font-semibold tracking-wider text-white/40 uppercase">
                  Turn Timer
                </div>
                <div className={`font-mono text-2xl font-bold ${timerSeconds <= 10 ? "text-rose-400 animate-pulse" : "text-amber-300"}`}>
                  00:{timerSeconds.toString().padStart(2, "0")}
                </div>
              </div>
              <div className="h-10 w-10 rounded-full border-2 border-amber-400/40 flex items-center justify-center font-mono text-sm font-bold text-amber-300">
                {timerSeconds}
              </div>
            </div>

            <button
              onClick={triggerAutoPick}
              className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs font-semibold text-amber-300 transition-colors hover:bg-amber-500/20 active:scale-95"
            >
              Auto-Pick (VORP)
            </button>
          </div>
        </div>

        {/* Current Pick Bar */}
        {!isComplete && currentPick && (
          <div className="mt-6 flex flex-wrap items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 font-black text-lg">
                #{currentPick.overallPick}
              </div>
              <div>
                <div className="text-xs text-white/50">ON THE CLOCK</div>
                <div className="text-lg font-bold text-white flex items-center gap-2">
                  {currentPick.teamName}
                  {activeTeam?.isUser && (
                    <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/30">
                      YOUR TURN
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-white/50">Round {currentPick.roundNumber} &bull; Pick {currentPick.pickInRound}</div>
              <div className="text-xs font-mono text-emerald-400">
                {currentPick.roundNumber % 2 !== 0 ? "Regular Order (1 \u2192 4)" : "Snake Order (4 \u2192 1)"}
              </div>
            </div>
          </div>
        )}

        {isComplete && (
          <div className="mt-6 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-center text-emerald-300 font-bold">
            \u2714 Draft Complete! Rosters are locked for Gameweek 1.
          </div>
        )}
      </div>

      {/* Main Grid: Available Players Pool (Left) & Live Draft Board / Roster (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Player Pool */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 shadow-lg backdrop-blur-md">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
              <h2 className="text-base font-bold text-white">Available Player Pool ({filteredPlayers.length})</h2>
              
              {/* Position Tabs */}
              <div className="flex gap-1 rounded-xl bg-slate-800/80 p-1 text-xs">
                {(["ALL", "GKP", "DEF", "MID", "FWD"] as const).map((pos) => (
                  <button
                    key={pos}
                    onClick={() => setPosFilter(pos)}
                    className={`rounded-lg px-2.5 py-1 font-semibold transition-all ${
                      posFilter === pos
                        ? "bg-emerald-500 text-slate-950 shadow"
                        : "text-white/60 hover:text-white"
                    }`}
                  >
                    {pos}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Input */}
            <div className="mt-3">
              <input
                type="text"
                placeholder="Search player or club..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2.5 text-xs text-white placeholder-white/30 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* Players Table */}
            <div className="mt-4 overflow-x-auto max-h-[520px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-900 text-white/50 uppercase tracking-wider text-[10px] border-b border-white/10">
                  <tr>
                    <th className="py-2.5 px-3">Player</th>
                    <th className="py-2.5 px-2">Club</th>
                    <th className="py-2.5 px-2">Pos</th>
                    <th className="py-2.5 px-2 text-right">VORP</th>
                    <th className="py-2.5 px-2 text-right">Proj Pts</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredPlayers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-white/40">
                        No players match current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredPlayers.map((player) => {
                      const canPick = activeTeam ? canTeamPickPos(activeTeam, player.position) : false;
                      const isUserTurn = activeTeam?.isUser && !isComplete;

                      return (
                        <tr key={player.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-3 font-semibold text-white">
                            {player.name}
                          </td>
                          <td className="py-3 px-2">
                            <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] font-bold text-white/80 border border-white/10">
                              {player.club}
                            </span>
                          </td>
                          <td className="py-3 px-2">
                            <span
                              className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                                player.position === "FWD"
                                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                  : player.position === "MID"
                                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                  : player.position === "DEF"
                                  ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                                  : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              }`}
                            >
                              {player.position}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-right font-mono font-bold text-emerald-400">
                            +{player.vorpScore.toFixed(1)}
                          </td>
                          <td className="py-3 px-2 text-right font-mono text-white/80">
                            {player.projectedPoints}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={() => handleMakePick(player)}
                              disabled={!isUserTurn || !canPick}
                              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                                isUserTurn && canPick
                                  ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400 active:scale-95 shadow-md shadow-emerald-500/20"
                                  : "bg-white/5 text-white/30 cursor-not-allowed border border-white/5"
                              }`}
                            >
                              {isUserTurn ? (canPick ? "Draft" : "Slot Full") : "Pick"}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Team Rosters & Draft History */}
        <div className="lg:col-span-5 space-y-4">
          {/* Team Roster Viewer */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 shadow-lg backdrop-blur-md">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h2 className="text-base font-bold text-white">Roster Breakdown</h2>
              {/* Team Selector Pills */}
              <div className="flex gap-1">
                {teams.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedRosterTeamId(t.id)}
                    className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition-all ${
                      selectedRosterTeamId === t.id
                        ? "bg-white/20 text-white"
                        : "text-white/40 hover:text-white"
                    }`}
                  >
                    {t.name.split(" ")[0]}
                  </button>
                ))}
              </div>
            </div>

            {/* Positional Quotas */}
            <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
              <div className="rounded-xl border border-white/5 bg-slate-950/40 p-2">
                <div className="text-[10px] text-white/40">GKP</div>
                <div className="text-sm font-bold text-emerald-400">
                  {selectedTeam.roster.filter((p) => p.position === "GKP").length} / 2
                </div>
              </div>
              <div className="rounded-xl border border-white/5 bg-slate-950/40 p-2">
                <div className="text-[10px] text-white/40">DEF</div>
                <div className="text-sm font-bold text-sky-400">
                  {selectedTeam.roster.filter((p) => p.position === "DEF").length} / 5
                </div>
              </div>
              <div className="rounded-xl border border-white/5 bg-slate-950/40 p-2">
                <div className="text-[10px] text-white/40">MID</div>
                <div className="text-sm font-bold text-amber-400">
                  {selectedTeam.roster.filter((p) => p.position === "MID").length} / 5
                </div>
              </div>
              <div className="rounded-xl border border-white/5 bg-slate-950/40 p-2">
                <div className="text-[10px] text-white/40">FWD</div>
                <div className="text-sm font-bold text-rose-400">
                  {selectedTeam.roster.filter((p) => p.position === "FWD").length} / 3
                </div>
              </div>
            </div>

            {/* Picked Players List */}
            <div className="mt-4 max-h-[220px] overflow-y-auto space-y-2 pr-1">
              {selectedTeam.roster.length === 0 ? (
                <div className="py-6 text-center text-xs text-white/40">
                  No players drafted yet for this team.
                </div>
              ) : (
                selectedTeam.roster.map((player, idx) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-950/40 px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-white/30">#{idx + 1}</span>
                      <span className="font-semibold text-white">{player.name}</span>
                      <span className="text-[10px] text-white/40">{player.club}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] font-bold text-white/70">
                        {player.position}
                      </span>
                      <span className="font-mono text-[11px] font-bold text-emerald-400">
                        +{player.vorpScore.toFixed(1)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Draft Picks Feed */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 shadow-lg backdrop-blur-md">
            <h3 className="text-sm font-bold text-white mb-3">Live Pick Feed</h3>
            <div className="max-h-[200px] overflow-y-auto space-y-2 pr-1">
              {pickTimeline
                .filter((p) => p.player)
                .slice(-6)
                .reverse()
                .map((pick) => (
                  <div
                    key={pick.overallPick}
                    className="flex items-center justify-between rounded-xl border border-emerald-500/10 bg-emerald-500/5 px-3 py-2 text-xs"
                  >
                    <div>
                      <span className="font-bold text-emerald-400 mr-2">Pick #{pick.overallPick}</span>
                      <span className="text-white/80 font-medium">{pick.player?.name}</span>
                      <span className="text-white/40 ml-1.5">({pick.player?.position})</span>
                    </div>
                    <div className="text-[11px] text-white/50">{pick.teamName.split(" ")[0]}</div>
                  </div>
                ))}
              {pickTimeline.filter((p) => p.player).length === 0 && (
                <div className="py-4 text-center text-xs text-white/30">
                  Waiting for initial pick...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
