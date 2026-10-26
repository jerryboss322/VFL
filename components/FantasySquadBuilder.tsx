"use client";

import React, { useState, useMemo } from "react";
import { formatMinor } from "@/lib/betslip";

export interface FantasyPlayer {
  playerId: string;
  name: string;
  clubId: string;
  clubShort?: string;
  position: "GK" | "DEF" | "MID" | "FWD";
  priceMinor: number;
  formRating?: number;
  selectedByPercent?: number;
  totalSeasonPoints?: number;
}

export interface FantasySquadBuilderProps {
  availablePlayers: FantasyPlayer[];
  initialStartingXi?: FantasyPlayer[];
  initialBench?: FantasyPlayer[];
  initialCaptainId?: string;
  initialViceCaptainId?: string;
  budgetCapMinor?: number;
  onSaveSquad: (data: {
    teamName: string;
    formation: string;
    captainId: string;
    viceCaptainId: string;
    startingXi: FantasyPlayer[];
    bench: FantasyPlayer[];
  }) => Promise<void>;
  saving?: boolean;
}

export function FantasySquadBuilder({
  availablePlayers,
  initialStartingXi = [],
  initialBench = [],
  initialCaptainId = "",
  initialViceCaptainId = "",
  budgetCapMinor = 100_000_000,
  onSaveSquad,
  saving = false,
}: FantasySquadBuilderProps) {
  const [teamName, setTeamName] = useState("Apex Tacticians");
  const [formation, setFormation] = useState<string>("4-4-2");
  const [startingXi, setStartingXi] = useState<FantasyPlayer[]>(initialStartingXi);
  const [bench, setBench] = useState<FantasyPlayer[]>(initialBench);
  const [captainId, setCaptainId] = useState<string>(initialCaptainId);
  const [viceCaptainId, setViceCaptainId] = useState<string>(initialViceCaptainId);

  // Player search modal / drawer state
  const [pickerPosition, setPickerPosition] = useState<string | null>(null);
  const [pickerTargetIndex, setPickerTargetIndex] = useState<{ isBench: boolean; index: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClubFilter, setSelectedClubFilter] = useState("all");

  // Budget calculations
  const totalSpentMinor = useMemo(() => {
    const s1 = startingXi.reduce((acc, p) => acc + (p.priceMinor || 0), 0);
    const s2 = bench.reduce((acc, p) => acc + (p.priceMinor || 0), 0);
    return s1 + s2;
  }, [startingXi, bench]);

  const bankBalanceMinor = budgetCapMinor - totalSpentMinor;

  // Club quotas
  const clubCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of [...startingXi, ...bench]) {
      if (p.clubId) {
        map[p.clubId] = (map[p.clubId] || 0) + 1;
      }
    }
    return map;
  }, [startingXi, bench]);

  // Position slots according to formation
  // Formation format e.g. "4-4-2" -> 4 DEF, 4 MID, 2 FWD
  const formationParts = formation.split("-").map(Number);
  const numDef = formationParts[0] || 4;
  const numMid = formationParts[1] || 4;
  const numFwd = formationParts[2] || 2;

  // Filtered players for picker drawer
  const filteredAvailable = useMemo(() => {
    return availablePlayers.filter((p) => {
      if (pickerPosition && p.position !== pickerPosition) return false;
      if (selectedClubFilter !== "all" && p.clubId !== selectedClubFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !(p.clubShort || "").toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [availablePlayers, pickerPosition, selectedClubFilter, searchQuery]);

  const openPicker = (pos: string, isBench: boolean, index: number) => {
    setPickerPosition(pos);
    setPickerTargetIndex({ isBench, index });
    setSearchQuery("");
  };

  const handleSelectPlayer = (player: FantasyPlayer) => {
    if (!pickerTargetIndex) return;

    // Check if player is already selected anywhere in squad
    const inStarting = startingXi.some((p) => p.playerId === player.playerId);
    const inBench = bench.some((p) => p.playerId === player.playerId);
    if (inStarting || inBench) {
      alert(`${player.name} is already in your squad!`);
      return;
    }

    // Check club quota (max 3)
    const existingFromClub = clubCounts[player.clubId] || 0;
    if (existingFromClub >= 3) {
      alert(`Maximum 3 players allowed from the same club!`);
      return;
    }

    if (pickerTargetIndex.isBench) {
      const next = [...bench];
      next[pickerTargetIndex.index] = player;
      setBench(next);
    } else {
      const next = [...startingXi];
      next[pickerTargetIndex.index] = player;
      setStartingXi(next);
      if (!captainId) setCaptainId(player.playerId);
      else if (!viceCaptainId && player.playerId !== captainId) setViceCaptainId(player.playerId);
    }

    setPickerPosition(null);
    setPickerTargetIndex(null);
  };

  const handleAutoFill = () => {
    // Fill empty slots with best value players
    const currentIds = new Set([...startingXi, ...bench].map((p) => p.playerId));
    const gks = availablePlayers.filter((p) => p.position === "GK" && !currentIds.has(p.playerId));
    const defs = availablePlayers.filter((p) => p.position === "DEF" && !currentIds.has(p.playerId));
    const mids = availablePlayers.filter((p) => p.position === "MID" && !currentIds.has(p.playerId));
    const fwds = availablePlayers.filter((p) => p.position === "FWD" && !currentIds.has(p.playerId));

    const newXi: FantasyPlayer[] = [];
    if (gks[0]) newXi.push(gks[0]);
    for (let i = 0; i < numDef && defs[i]; i++) newXi.push(defs[i]!);
    for (let i = 0; i < numMid && mids[i]; i++) newXi.push(mids[i]!);
    for (let i = 0; i < numFwd && fwds[i]; i++) newXi.push(fwds[i]!);

    const newBench: FantasyPlayer[] = [];
    if (gks[1]) newBench.push(gks[1]);
    if (defs[numDef]) newBench.push(defs[numDef]!);
    if (mids[numMid]) newBench.push(mids[numMid]!);
    if (fwds[numFwd]) newBench.push(fwds[numFwd]!);

    setStartingXi(newXi);
    setBench(newBench);
    if (newXi[0]) setCaptainId(newXi[0].playerId);
    if (newXi[1]) setViceCaptainId(newXi[1].playerId);
  };

  const handleSave = async () => {
    if (startingXi.length < 11) {
      alert("Please select all 11 starting players before saving!");
      return;
    }
    if (bankBalanceMinor < 0) {
      alert("Your squad exceeds the 100.0M budget cap! Please make transfers to balance the budget.");
      return;
    }
    if (!captainId || !viceCaptainId) {
      alert("Please nominate both a Captain (2x points) and Vice-Captain!");
      return;
    }

    await onSaveSquad({
      teamName,
      formation,
      captainId,
      viceCaptainId,
      startingXi,
      bench,
    });
  };

  // Group starting XI by position lines for pitch layout
  const gkList = startingXi.filter((p) => p.position === "GK");
  const defList = startingXi.filter((p) => p.position === "DEF");
  const midList = startingXi.filter((p) => p.position === "MID");
  const fwdList = startingXi.filter((p) => p.position === "FWD");

  return (
    <div className="space-y-4">
      {/* Top Controls & Budget Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-neutral-900 border border-neutral-800 rounded-xl p-4">
        <div>
          <label className="text-[11px] font-mono uppercase text-neutral-400 block mb-1">Squad Name</label>
          <input
            type="text"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-700 rounded px-2.5 py-1.5 text-xs text-neutral-100 font-semibold focus:border-amber-400 focus:outline-none"
          />
        </div>

        <div>
          <label className="text-[11px] font-mono uppercase text-neutral-400 block mb-1">Tactical Formation</label>
          <select
            value={formation}
            onChange={(e) => setFormation(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-700 rounded px-2.5 py-1.5 text-xs text-neutral-100 font-mono focus:border-amber-400 focus:outline-none"
          >
            <option value="4-4-2">4-4-2 Standard</option>
            <option value="4-3-3">4-3-3 Attacking</option>
            <option value="3-5-2">3-5-2 Midfield Control</option>
            <option value="5-3-2">5-3-2 Counter Shield</option>
            <option value="3-4-3">3-4-3 Wing Blitz</option>
          </select>
        </div>

        <div>
          <label className="text-[11px] font-mono uppercase text-neutral-400 block mb-1">Bank Remaining</label>
          <div className="flex items-center justify-between bg-neutral-950 border border-neutral-800 rounded px-2.5 py-1.5">
            <span className={`text-xs font-mono font-bold ${bankBalanceMinor < 0 ? "text-rose-400" : "text-emerald-400"}`}>
              {formatMinor(bankBalanceMinor)}
            </span>
            <span className="text-[10px] text-neutral-500 font-mono">of 100.0M</span>
          </div>
        </div>

        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={handleAutoFill}
            className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 py-1.5 px-3 rounded text-xs font-mono font-semibold transition-colors"
          >
            Auto-Pick
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold py-1.5 px-3 rounded text-xs font-mono transition-all shadow-md disabled:opacity-50"
          >
            {saving ? "Saving..." : "Lock Squad"}
          </button>
        </div>
      </div>

      {/* Main Pitch View */}
      <div className="relative rounded-2xl overflow-hidden border border-emerald-900/60 bg-gradient-to-b from-emerald-950/70 via-emerald-900/40 to-emerald-950/80 p-6 min-h-[520px] flex flex-col justify-between shadow-2xl">
        {/* Pitch Turf SVG Markings */}
        <div className="absolute inset-0 pointer-events-none opacity-20">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <rect x="5%" y="5%" width="90%" height="90%" fill="none" stroke="#fff" strokeWidth="2" />
            <line x1="5%" y1="50%" x2="95%" y2="50%" stroke="#fff" strokeWidth="2" />
            <circle cx="50%" cy="50%" r="60" fill="none" stroke="#fff" strokeWidth="2" />
            <circle cx="50%" cy="50%" r="4" fill="#fff" />
            <rect x="30%" y="5%" width="40%" height="18%" fill="none" stroke="#fff" strokeWidth="2" />
            <rect x="30%" y="77%" width="40%" height="18%" fill="none" stroke="#fff" strokeWidth="2" />
          </svg>
        </div>

        {/* 1. Forward Line */}
        <div className="relative z-10 flex justify-around items-center pt-2">
          {Array.from({ length: numFwd }).map((_, idx) => {
            const player = fwdList[idx];
            return (
              <PlayerPitchCard
                key={`fwd-${idx}`}
                player={player}
                placeholderPos="FWD"
                isCaptain={player?.playerId === captainId}
                isVice={player?.playerId === viceCaptainId}
                onOpenPicker={() => openPicker("FWD", false, idx + 1 + numDef + numMid)}
                onSetCaptain={() => player && setCaptainId(player.playerId)}
                onSetVice={() => player && setViceCaptainId(player.playerId)}
              />
            );
          })}
        </div>

        {/* 2. Midfield Line */}
        <div className="relative z-10 flex justify-around items-center">
          {Array.from({ length: numMid }).map((_, idx) => {
            const player = midList[idx];
            return (
              <PlayerPitchCard
                key={`mid-${idx}`}
                player={player}
                placeholderPos="MID"
                isCaptain={player?.playerId === captainId}
                isVice={player?.playerId === viceCaptainId}
                onOpenPicker={() => openPicker("MID", false, idx + 1 + numDef)}
                onSetCaptain={() => player && setCaptainId(player.playerId)}
                onSetVice={() => player && setViceCaptainId(player.playerId)}
              />
            );
          })}
        </div>

        {/* 3. Defense Line */}
        <div className="relative z-10 flex justify-around items-center">
          {Array.from({ length: numDef }).map((_, idx) => {
            const player = defList[idx];
            return (
              <PlayerPitchCard
                key={`def-${idx}`}
                player={player}
                placeholderPos="DEF"
                isCaptain={player?.playerId === captainId}
                isVice={player?.playerId === viceCaptainId}
                onOpenPicker={() => openPicker("DEF", false, idx + 1)}
                onSetCaptain={() => player && setCaptainId(player.playerId)}
                onSetVice={() => player && setViceCaptainId(player.playerId)}
              />
            );
          })}
        </div>

        {/* 4. Goalkeeper */}
        <div className="relative z-10 flex justify-center items-center pb-2">
          <PlayerPitchCard
            player={gkList[0]}
            placeholderPos="GK"
            isCaptain={gkList[0]?.playerId === captainId}
            isVice={gkList[0]?.playerId === viceCaptainId}
            onOpenPicker={() => openPicker("GK", false, 0)}
            onSetCaptain={() => gkList[0] && setCaptainId(gkList[0].playerId)}
            onSetVice={() => gkList[0] && setViceCaptainId(gkList[0].playerId)}
          />
        </div>
      </div>

      {/* Substitutes Bench Bar */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
        <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-400 mb-3 flex items-center gap-2">
          <span>Substitutes Bench</span>
          <span className="text-[10px] text-neutral-500 font-normal">Auto-replaces starters who play 0 minutes</span>
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {["GK", "DEF", "MID", "FWD"].map((pos, bIdx) => {
            const benchPlayer = bench[bIdx];
            return (
              <div
                key={`bench-${pos}-${bIdx}`}
                className="bg-neutral-950/70 border border-neutral-800 rounded-lg p-2 flex items-center justify-between"
              >
                {benchPlayer ? (
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-6 h-6 rounded bg-neutral-800 flex items-center justify-center font-mono text-[10px] font-bold text-amber-400">
                      {benchPlayer.position}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-neutral-200 truncate">{benchPlayer.name}</p>
                      <p className="text-[10px] font-mono text-neutral-400">{formatMinor(benchPlayer.priceMinor)}</p>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => openPicker(pos, true, bIdx)}
                    className="w-full text-center py-2 text-xs font-mono text-neutral-500 hover:text-amber-400 transition-colors"
                  >
                    + Pick {pos}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Player Selection Drawer Modal */}
      {pickerPosition && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-neutral-100 flex items-center gap-2">
                  <span>Select {pickerPosition}</span>
                  <span className="text-[10px] font-mono bg-emerald-950 text-emerald-400 border border-emerald-800 px-1.5 py-0.5 rounded">
                    {filteredAvailable.length} Available
                  </span>
                </h3>
              </div>
              <button
                onClick={() => setPickerPosition(null)}
                className="text-neutral-400 hover:text-neutral-100 text-lg leading-none p-1"
              >
                &times;
              </button>
            </div>

            {/* Search & Club filter */}
            <div className="p-3 border-b border-neutral-800 bg-neutral-950/60 flex gap-2">
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by player or club..."
                className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1.5 text-xs text-neutral-200 focus:border-amber-400 focus:outline-none"
              />
            </div>

            {/* Scrollable Player List */}
            <div className="overflow-y-auto divide-y divide-neutral-800 p-2 space-y-1">
              {filteredAvailable.map((player) => (
                <div
                  key={player.playerId}
                  className="flex items-center justify-between p-2.5 rounded-lg hover:bg-neutral-800/60 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-neutral-100 truncate">{player.name}</span>
                      <span className="text-[10px] font-mono text-neutral-400 bg-neutral-800 px-1.5 py-0.2 rounded">
                        {player.clubShort || player.clubId}
                      </span>
                    </div>
                    <div className="text-[10px] text-neutral-500 font-mono mt-0.5 flex gap-3">
                      <span>Form: {player.formRating?.toFixed(1) ?? "6.0"}</span>
                      <span>Pts: {player.totalSeasonPoints ?? 0}</span>
                      <span>Own: {player.selectedByPercent?.toFixed(1) ?? "10"}%</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-bold text-amber-400">
                      {formatMinor(player.priceMinor)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSelectPlayer(player)}
                      className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-neutral-950 font-mono text-xs font-bold transition-colors"
                    >
                      Pick
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PlayerPitchCard({
  player,
  placeholderPos,
  isCaptain,
  isVice,
  onOpenPicker,
  onSetCaptain,
  onSetVice,
}: {
  player?: FantasyPlayer;
  placeholderPos: string;
  isCaptain?: boolean;
  isVice?: boolean;
  onOpenPicker: () => void;
  onSetCaptain: () => void;
  onSetVice: () => void;
}) {
  if (!player) {
    return (
      <button
        type="button"
        onClick={onOpenPicker}
        className="w-16 h-20 rounded-xl border-2 border-dashed border-white/20 bg-black/40 hover:bg-black/60 hover:border-amber-400/60 flex flex-col items-center justify-center gap-1 transition-all group"
      >
        <span className="text-lg text-white/40 group-hover:text-amber-400 transition-colors">+</span>
        <span className="text-[10px] font-mono font-bold text-white/50">{placeholderPos}</span>
      </button>
    );
  }

  return (
    <div className="w-20 flex flex-col items-center group relative">
      {/* Captaincy badges */}
      <div className="flex items-center gap-1 mb-1">
        {isCaptain && (
          <span className="w-4 h-4 rounded-full bg-amber-500 text-neutral-950 text-[9px] font-black font-mono flex items-center justify-center shadow-md">
            C
          </span>
        )}
        {isVice && (
          <span className="w-4 h-4 rounded-full bg-neutral-300 text-neutral-950 text-[9px] font-black font-mono flex items-center justify-center shadow-md">
            V
          </span>
        )}
      </div>

      {/* Jersey Icon button */}
      <button
        type="button"
        onClick={onOpenPicker}
        title="Click to swap player"
        className="w-12 h-12 rounded-xl bg-gradient-to-b from-neutral-800 to-neutral-900 border border-neutral-700/80 shadow-lg flex flex-col items-center justify-center transition-transform hover:scale-105 active:scale-95"
      >
        <span className="text-[10px] font-black font-mono text-amber-400">{player.position}</span>
        <span className="text-[9px] font-mono text-neutral-400 uppercase">{player.clubShort || "VFL"}</span>
      </button>

      {/* Name and price pill */}
      <div className="mt-1 w-full text-center bg-black/80 backdrop-blur-sm border border-neutral-800 rounded px-1 py-0.5 shadow">
        <p className="text-[10px] font-semibold text-neutral-200 truncate">{player.name}</p>
        <p className="text-[9px] font-mono text-amber-400 font-bold">{formatMinor(player.priceMinor)}</p>
      </div>

      {/* Hover Captaincy quick controls */}
      <div className="absolute -top-7 hidden group-hover:flex items-center gap-1 bg-neutral-950 border border-neutral-700 rounded p-0.5 shadow-xl z-20">
        <button
          type="button"
          onClick={onSetCaptain}
          title="Make Captain (2x points)"
          className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500 text-neutral-950 hover:bg-amber-400"
        >
          (C)
        </button>
        <button
          type="button"
          onClick={onSetVice}
          title="Make Vice-Captain"
          className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-neutral-700 text-neutral-200 hover:bg-neutral-600"
        >
          (V)
        </button>
      </div>
    </div>
  );
}
