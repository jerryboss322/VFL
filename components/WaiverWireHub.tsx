"use client";

import React, { useState } from "react";
import { formatMinor } from "@/lib/betslip";

export interface FreeAgentPlayer {
  id: string;
  name: string;
  club: string;
  position: "GKP" | "DEF" | "MID" | "FWD";
  priceMajor: number;
  form: number;
  projectedPoints: number;
  waiverOwnershipPct: number;
}

export interface UserRosterPlayer {
  id: string;
  name: string;
  club: string;
  position: "GKP" | "DEF" | "MID" | "FWD";
  priceMajor: number;
  totalPoints: number;
}

export interface ClaimItem {
  id: string;
  addPlayer: FreeAgentPlayer;
  dropPlayer: UserRosterPlayer;
  bidMinor: number;
  timestamp: number;
  status: "PENDING" | "SUCCESSFUL" | "OUTBID";
}

const INITIAL_FREE_AGENTS: FreeAgentPlayer[] = [
  { id: "fa_1", name: "Morgan Rogers", club: "AVL", position: "MID", priceMajor: 5.4, form: 7.2, projectedPoints: 12.4, waiverOwnershipPct: 34.2 },
  { id: "fa_2", name: "Liam Delap", club: "IPS", position: "FWD", priceMajor: 5.6, form: 6.8, projectedPoints: 11.2, waiverOwnershipPct: 22.5 },
  { id: "fa_3", name: "Lewis Hall", club: "NEW", position: "DEF", priceMajor: 4.5, form: 6.5, projectedPoints: 9.8, waiverOwnershipPct: 18.0 },
  { id: "fa_4", name: "Bart Verbruggen", club: "BHA", position: "GKP", priceMajor: 4.5, form: 5.9, projectedPoints: 8.5, waiverOwnershipPct: 14.1 },
  { id: "fa_5", name: "Mikkel Damsgaard", club: "BRE", position: "MID", priceMajor: 5.0, form: 6.1, projectedPoints: 9.1, waiverOwnershipPct: 9.4 },
  { id: "fa_6", name: "Ola Aina", club: "NFO", position: "DEF", priceMajor: 4.7, form: 6.9, projectedPoints: 10.5, waiverOwnershipPct: 28.7 },
  { id: "fa_7", name: "Evanilson", club: "BOU", position: "FWD", priceMajor: 5.9, form: 6.0, projectedPoints: 10.0, waiverOwnershipPct: 15.3 },
  { id: "fa_8", name: "Mads Hermansen", club: "LEI", position: "GKP", priceMajor: 4.5, form: 5.5, projectedPoints: 7.8, waiverOwnershipPct: 8.2 },
];

const INITIAL_USER_ROSTER: UserRosterPlayer[] = [
  { id: "r_1", name: "David Raya", club: "ARS", position: "GKP", priceMajor: 5.5, totalPoints: 84 },
  { id: "r_2", name: "Alisson Becker", club: "LIV", position: "GKP", priceMajor: 5.5, totalPoints: 76 },
  { id: "r_3", name: "William Saliba", club: "ARS", position: "DEF", priceMajor: 6.5, totalPoints: 92 },
  { id: "r_4", name: "Josko Gvardiol", club: "MCI", position: "DEF", priceMajor: 6.0, totalPoints: 88 },
  { id: "r_5", name: "Pedro Porro", club: "TOT", position: "DEF", priceMajor: 5.5, totalPoints: 79 },
  { id: "r_6", name: "Virgil van Dijk", club: "LIV", position: "DEF", priceMajor: 6.0, totalPoints: 86 },
  { id: "r_7", name: "Dan Burn", club: "NEW", position: "DEF", priceMajor: 4.4, totalPoints: 48 },
  { id: "r_8", name: "Mohamed Salah", club: "LIV", position: "MID", priceMajor: 13.5, totalPoints: 142 },
  { id: "r_9", name: "Cole Palmer", club: "CHE", position: "MID", priceMajor: 11.0, totalPoints: 134 },
  { id: "r_10", name: "Bukayo Saka", club: "ARS", position: "MID", priceMajor: 10.5, totalPoints: 120 },
  { id: "r_11", name: "Phil Foden", club: "MCI", position: "MID", priceMajor: 9.5, totalPoints: 105 },
  { id: "r_12", name: "Dwight McNeil", club: "EVE", position: "MID", priceMajor: 5.2, totalPoints: 52 },
  { id: "r_13", name: "Erling Haaland", club: "MCI", position: "FWD", priceMajor: 15.0, totalPoints: 168 },
  { id: "r_14", name: "Ollie Watkins", club: "AVL", position: "FWD", priceMajor: 9.0, totalPoints: 112 },
  { id: "r_15", name: "Rodrigo Muniz", club: "FUL", position: "FWD", priceMajor: 5.8, totalPoints: 56 },
];

export function WaiverWireHub() {
  const [freeAgents, setFreeAgents] = useState<FreeAgentPlayer[]>(INITIAL_FREE_AGENTS);
  const [userRoster, setUserRoster] = useState<UserRosterPlayer[]>(INITIAL_USER_ROSTER);
  const [fabBalanceMinor, setFabBalanceMinor] = useState<number>(78_00); // £78.00 remaining
  const [waiverPriorityRank, setWaiverPriorityRank] = useState<number>(2); // #2 priority
  const [pendingClaims, setPendingClaims] = useState<ClaimItem[]>([
    {
      id: "claim_ex_1",
      addPlayer: INITIAL_FREE_AGENTS[0]!,
      dropPlayer: INITIAL_USER_ROSTER[11]!,
      bidMinor: 14_00,
      timestamp: Date.now() - 3600_000,
      status: "PENDING",
    },
  ]);

  // Modal claim state
  const [selectedAddPlayer, setSelectedAddPlayer] = useState<FreeAgentPlayer | null>(null);
  const [selectedDropPlayerId, setSelectedDropPlayerId] = useState<string>("");
  const [bidAmountMajor, setBidAmountMajor] = useState<number>(5);
  const [activeTab, setActiveTab] = useState<"pool" | "claims" | "ledger">("pool");
  const [posFilter, setPosFilter] = useState<"ALL" | "GKP" | "DEF" | "MID" | "FWD">("ALL");

  const openClaimModal = (player: FreeAgentPlayer) => {
    setSelectedAddPlayer(player);
    // Auto-select a droppable player with the same position if available
    const samePos = userRoster.find((p) => p.position === player.position);
    setSelectedDropPlayerId(samePos ? samePos.id : (userRoster[0]?.id ?? ""));
    setBidAmountMajor(Math.min(5, Math.floor(fabBalanceMinor / 100)));
  };

  const handleConfirmClaim = () => {
    if (!selectedAddPlayer) return;
    const dropPlayer = userRoster.find((p) => p.id === selectedDropPlayerId);
    if (!dropPlayer) {
      alert("Please select a player from your roster to drop");
      return;
    }

    const bidMinor = Math.round(bidAmountMajor * 100);
    if (bidMinor > fabBalanceMinor) {
      alert("Bid exceeds your remaining FAB balance");
      return;
    }

    // Check quota if cross-position
    if (dropPlayer.position !== selectedAddPlayer.position) {
      const currentPosCount = userRoster.filter((p) => p.position === selectedAddPlayer.position).length;
      const maxAllowed = selectedAddPlayer.position === "GKP" ? 2 : selectedAddPlayer.position === "FWD" ? 3 : 5;
      if (currentPosCount >= maxAllowed) {
        alert(`Cannot add another ${selectedAddPlayer.position}; maximum ${maxAllowed} reached.`);
        return;
      }
    }

    const newClaim: ClaimItem = {
      id: `claim_${Date.now()}`,
      addPlayer: selectedAddPlayer,
      dropPlayer,
      bidMinor,
      timestamp: Date.now(),
      status: "PENDING",
    };

    setPendingClaims((prev) => [newClaim, ...prev]);
    setSelectedAddPlayer(null);
  };

  const handleCancelClaim = (claimId: string) => {
    setPendingClaims((prev) => prev.filter((c) => c.id !== claimId));
  };

  const filteredPool = freeAgents.filter((p) => {
    if (posFilter !== "ALL" && p.position !== posFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & FAB Stat Cards */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-slate-900 via-emerald-950/40 to-slate-900 p-6 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-0.5 text-xs font-semibold text-emerald-400">
                Waivers Active
              </span>
              <span className="text-xs text-white/50">Next Cycle: Tuesday 03:00 UTC</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">
              Waiver Wire & Free Agency
            </h1>
            <p className="text-sm text-white/60">
              Blind-auction Free Agent Acquisition Budget (FAB) and rolling priority player claims.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* FAB Budget Card */}
            <div className="rounded-xl border border-white/10 bg-black/40 px-5 py-3 text-center">
              <div className="text-[10px] font-semibold tracking-wider text-white/40 uppercase">
                Remaining FAB
              </div>
              <div className="font-mono text-xl font-bold text-emerald-400">
                &pound;{(fabBalanceMinor / 100).toFixed(2)}
              </div>
              <div className="text-[10px] text-white/40">Initial: &pound;100.00</div>
            </div>

            {/* Waiver Priority Card */}
            <div className="rounded-xl border border-white/10 bg-black/40 px-5 py-3 text-center">
              <div className="text-[10px] font-semibold tracking-wider text-white/40 uppercase">
                Waiver Priority
              </div>
              <div className="font-mono text-xl font-bold text-amber-300">
                #{waiverPriorityRank} of 12
              </div>
              <div className="text-[10px] text-white/40">Tie-Break Rank</div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mt-6 flex border-b border-white/10 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("pool")}
            className={`pb-3 px-4 transition-colors ${
              activeTab === "pool"
                ? "border-b-2 border-emerald-400 text-white"
                : "text-white/50 hover:text-white"
            }`}
          >
            Available Free Agents ({freeAgents.length})
          </button>
          <button
            onClick={() => setActiveTab("claims")}
            className={`pb-3 px-4 transition-colors flex items-center gap-1.5 ${
              activeTab === "claims"
                ? "border-b-2 border-emerald-400 text-white"
                : "text-white/50 hover:text-white"
            }`}
          >
            Pending Claims
            {pendingClaims.length > 0 && (
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.2 text-[10px] font-bold text-emerald-400">
                {pendingClaims.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === "pool" && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 shadow-lg backdrop-blur-md">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
            <h2 className="text-base font-bold text-white">Free Agent Pool</h2>
            <div className="flex gap-1 rounded-xl bg-slate-800/80 p-1 text-xs">
              {(["ALL", "GKP", "DEF", "MID", "FWD"] as const).map((pos) => (
                <button
                  key={pos}
                  onClick={() => setPosFilter(pos)}
                  className={`rounded-lg px-3 py-1 font-semibold transition-all ${
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

          {/* Table */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-white/50 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Player</th>
                  <th className="py-3 px-3">Club</th>
                  <th className="py-3 px-3">Pos</th>
                  <th className="py-3 px-3 text-right">Price</th>
                  <th className="py-3 px-3 text-right">Recent Form</th>
                  <th className="py-3 px-3 text-right">Proj Pts</th>
                  <th className="py-3 px-3 text-right">Ownership</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredPool.map((p) => (
                  <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-white">{p.name}</td>
                    <td className="py-3.5 px-3">
                      <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] font-bold text-white/70">
                        {p.club}
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                          p.position === "FWD"
                            ? "bg-rose-500/20 text-rose-300"
                            : p.position === "MID"
                            ? "bg-amber-500/20 text-amber-300"
                            : p.position === "DEF"
                            ? "bg-sky-500/20 text-sky-300"
                            : "bg-emerald-500/20 text-emerald-300"
                        }`}
                      >
                        {p.position}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono text-white/80">
                      &pound;{p.priceMajor.toFixed(1)}m
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono font-bold text-emerald-400">
                      {p.form.toFixed(1)}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono text-white">
                      {p.projectedPoints.toFixed(1)}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono text-white/60">
                      {p.waiverOwnershipPct.toFixed(1)}%
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => openClaimModal(p)}
                        className="rounded-lg bg-emerald-500/20 border border-emerald-500/30 px-3 py-1.5 text-xs font-bold text-emerald-300 transition-colors hover:bg-emerald-500 hover:text-slate-950"
                      >
                        Claim Player
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Claims Queue View */}
      {activeTab === "claims" && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 shadow-lg backdrop-blur-md">
          <h2 className="text-base font-bold text-white mb-4">Pending Waiver Claims ({pendingClaims.length})</h2>
          {pendingClaims.length === 0 ? (
            <div className="py-12 text-center text-white/40">
              No active claims queued. Browse the Free Agent pool to make a claim.
            </div>
          ) : (
            <div className="space-y-3">
              {pendingClaims.map((claim, idx) => (
                <div
                  key={claim.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/5 bg-slate-950/40 p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-sm font-bold text-white/70">
                      #{idx + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-sm font-bold text-white">
                        <span className="text-emerald-400">ADD: {claim.addPlayer.name}</span>
                        <span className="text-white/40">&bull;</span>
                        <span className="text-rose-400">DROP: {claim.dropPlayer.name}</span>
                      </div>
                      <div className="mt-0.5 text-xs text-white/40">
                        {claim.addPlayer.club} ({claim.addPlayer.position}) &larr; {claim.dropPlayer.club} ({claim.dropPlayer.position})
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-[10px] text-white/40 uppercase">FAB Blind Bid</div>
                      <div className="font-mono text-sm font-bold text-amber-300">
                        &pound;{(claim.bidMinor / 100).toFixed(2)}
                      </div>
                    </div>
                    <button
                      onClick={() => handleCancelClaim(claim.id)}
                      className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20"
                    >
                      Cancel Claim
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Submit Claim Modal */}
      {selectedAddPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Submit Waiver Claim</h3>
            <p className="mt-1 text-xs text-white/60">
              Submit an add/drop transaction request to execute during the next clearing cycle.
            </p>

            {/* Player to Add */}
            <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                Player To Add
              </div>
              <div className="mt-1 flex items-center justify-between">
                <div className="font-bold text-white text-base">{selectedAddPlayer.name}</div>
                <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                  {selectedAddPlayer.club} &bull; {selectedAddPlayer.position}
                </span>
              </div>
            </div>

            {/* Select Player to Drop */}
            <div className="mt-4">
              <label className="block text-xs font-semibold text-white/80 mb-2">
                Select Roster Player To Drop:
              </label>
              <select
                value={selectedDropPlayerId}
                onChange={(e) => setSelectedDropPlayerId(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
              >
                {userRoster.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.position} &bull; {p.club} &bull; &pound;{p.priceMajor.toFixed(1)}m)
                  </option>
                ))}
              </select>
            </div>

            {/* FAB Bid Slider */}
            <div className="mt-5">
              <div className="flex items-center justify-between text-xs font-semibold text-white/80">
                <span>Free Agent Budget (FAB) Bid:</span>
                <span className="font-mono text-emerald-400 font-bold">&pound;{bidAmountMajor}.00</span>
              </div>
              <input
                type="range"
                min="0"
                max={Math.floor(fabBalanceMinor / 100)}
                value={bidAmountMajor}
                onChange={(e) => setBidAmountMajor(Number(e.target.value))}
                className="mt-2 w-full accent-emerald-500 cursor-pointer"
              />
              <div className="mt-1 flex justify-between text-[10px] text-white/40">
                <span>&pound;0.00 (Minimum)</span>
                <span>Max Available: &pound;{(fabBalanceMinor / 100).toFixed(2)}</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-white/10">
              <button
                onClick={() => setSelectedAddPlayer(null)}
                className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-white/70 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmClaim}
                className="rounded-xl bg-emerald-500 px-5 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 active:scale-95 shadow-lg shadow-emerald-500/20"
              >
                Confirm Claim (&pound;{bidAmountMajor}.00)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
