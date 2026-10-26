"use client";

import React, { useState, useMemo } from "react";
import { formatMinor } from "@/lib/betslip";

export interface TransferTargetPlayer {
  id: string;
  name: string;
  club: string;
  position: "GKP" | "DEF" | "MID" | "FWD";
  age: number;
  overallRating: number;
  marketValueMajor: number; // in £ Millions
  releaseClauseMajor: number; // in £ Millions
  currentWeeklyWageMajor: number; // in £ Thousands
  isListed: boolean;
}

export interface TransferRumorItem {
  id: string;
  headline: string;
  feeMajor: number;
  fromClub: string;
  toClub: string;
  status: "COMPLETED" | "BID_ACCEPTED" | "REJECTED_FEE" | "REJECTED_FFP";
  timeAgo: string;
}

const INITIAL_MARKET_PLAYERS: TransferTargetPlayer[] = [
  { id: "tp_1", name: "Erling Haaland", club: "MCI", position: "FWD", age: 24, overallRating: 91, marketValueMajor: 180.0, releaseClauseMajor: 200.0, currentWeeklyWageMajor: 375, isListed: false },
  { id: "tp_2", name: "Mohamed Salah", club: "LIV", position: "MID", age: 32, overallRating: 89, marketValueMajor: 85.0, releaseClauseMajor: 110.0, currentWeeklyWageMajor: 350, isListed: false },
  { id: "tp_3", name: "Cole Palmer", club: "CHE", position: "MID", age: 22, overallRating: 87, marketValueMajor: 110.0, releaseClauseMajor: 140.0, currentWeeklyWageMajor: 180, isListed: false },
  { id: "tp_4", name: "Alexander Isak", club: "NEW", position: "FWD", age: 25, overallRating: 86, marketValueMajor: 95.0, releaseClauseMajor: 125.0, currentWeeklyWageMajor: 160, isListed: true },
  { id: "tp_5", name: "William Saliba", club: "ARS", position: "DEF", age: 23, overallRating: 88, marketValueMajor: 105.0, releaseClauseMajor: 130.0, currentWeeklyWageMajor: 200, isListed: false },
  { id: "tp_6", name: "David Raya", club: "ARS", position: "GKP", age: 29, overallRating: 85, marketValueMajor: 50.0, releaseClauseMajor: 65.0, currentWeeklyWageMajor: 120, isListed: false },
  { id: "tp_7", name: "Florian Wirtz", club: "B04", position: "MID", age: 21, overallRating: 89, marketValueMajor: 135.0, releaseClauseMajor: 150.0, currentWeeklyWageMajor: 150, isListed: true },
  { id: "tp_8", name: "Theo Hernández", club: "MIL", position: "DEF", age: 27, overallRating: 86, marketValueMajor: 70.0, releaseClauseMajor: 85.0, currentWeeklyWageMajor: 130, isListed: true },
];

const INITIAL_RUMORS: TransferRumorItem[] = [
  { id: "rum_1", headline: "Real Madrid trigger release clause for Erling Haaland", feeMajor: 200.0, fromClub: "MCI", toClub: "RMA", status: "COMPLETED", timeAgo: "12 mins ago" },
  { id: "rum_2", headline: "Arsenal reject £75M opening bid from Bayern for Saliba", feeMajor: 75.0, fromClub: "ARS", toClub: "BAY", status: "REJECTED_FEE", timeAgo: "45 mins ago" },
  { id: "rum_3", headline: "PSG transfer bid for Palmer rejected due to FFP wage constraints", feeMajor: 120.0, fromClub: "CHE", toClub: "PSG", status: "REJECTED_FFP", timeAgo: "1 hr ago" },
];

export function TransferMarketHub() {
  const [players, setPlayers] = useState<TransferTargetPlayer[]>(INITIAL_MARKET_PLAYERS);
  const [rumors, setRumors] = useState<TransferRumorItem[]>(INITIAL_RUMORS);
  const [clubCashBudgetMajor, setClubCashBudgetMajor] = useState<number>(240.0); // £240M
  const [annualRevenueMajor] = useState<number>(650.0); // £650M turnover
  const [currentWageBillMajor, setCurrentWageBillMajor] = useState<number>(340.0); // £340M (52.3% FFP)

  // Bid Modal state
  const [selectedPlayer, setSelectedPlayer] = useState<TransferTargetPlayer | null>(null);
  const [bidFeeMajor, setBidFeeMajor] = useState<number>(80);
  const [bidWageMajor, setBidWageMajor] = useState<number>(200);
  const [filterPos, setFilterPos] = useState<"ALL" | "GKP" | "DEF" | "MID" | "FWD">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // FFP current and projected ratio
  const currentFfpRatio = (currentWageBillMajor / annualRevenueMajor) * 100;
  const addedAnnualWageMajor = (bidWageMajor * 52) / 1000.0;
  const projectedWageBillMajor = currentWageBillMajor + addedAnnualWageMajor;
  const projectedFfpRatio = (projectedWageBillMajor / annualRevenueMajor) * 100;

  const handleOpenBid = (player: TransferTargetPlayer, isBuyout = false) => {
    setSelectedPlayer(player);
    setBidFeeMajor(isBuyout ? player.releaseClauseMajor : player.marketValueMajor);
    setBidWageMajor(Math.round(player.currentWeeklyWageMajor * 1.25));
  };

  const handleConfirmBid = () => {
    if (!selectedPlayer) return;

    if (bidFeeMajor > clubCashBudgetMajor) {
      alert("Transfer bid fee exceeds your available cash budget!");
      return;
    }

    if (projectedFfpRatio > 70.0) {
      alert("Offer rejected: Added wages breach UEFA Financial Fair Play 70% threshold!");
      return;
    }

    const isBuyout = bidFeeMajor >= selectedPlayer.releaseClauseMajor;
    const isAccepted = isBuyout || bidFeeMajor >= selectedPlayer.marketValueMajor * 0.95;

    if (!isAccepted) {
      alert(`Bid of £${bidFeeMajor}M was rejected by ${selectedPlayer.club}: fee is below their valuation.`);
      setRumors((prev) => [
        {
          id: `rum_${Date.now()}`,
          headline: `Bid for ${selectedPlayer.name} rejected by ${selectedPlayer.club}`,
          feeMajor: bidFeeMajor,
          fromClub: selectedPlayer.club,
          toClub: "Your Club",
          status: "REJECTED_FEE",
          timeAgo: "Just now",
        },
        ...prev,
      ]);
      setSelectedPlayer(null);
      return;
    }

    // Execute transfer
    setClubCashBudgetMajor((prev) => prev - bidFeeMajor);
    setCurrentWageBillMajor(projectedWageBillMajor);
    setPlayers((prev) => prev.filter((p) => p.id !== selectedPlayer.id));

    setRumors((prev) => [
      {
        id: `rum_${Date.now()}`,
        headline: `OFFICIAL: ${selectedPlayer.name} completes £${bidFeeMajor}M transfer!`,
        feeMajor: bidFeeMajor,
        fromClub: selectedPlayer.club,
        toClub: "Your Club",
        status: "COMPLETED",
        timeAgo: "Just now",
      },
      ...prev,
    ]);

    setSuccessToast(`Transfer Complete! ${selectedPlayer.name} signed for £${bidFeeMajor}M!`);
    setTimeout(() => setSuccessToast(null), 5000);
    setSelectedPlayer(null);
  };

  const filteredPlayers = useMemo(() => {
    return players.filter((p) => {
      if (filterPos !== "ALL" && p.position !== filterPos) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return p.name.toLowerCase().includes(q) || p.club.toLowerCase().includes(q);
      }
      return true;
    });
  }, [players, filterPos, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-emerald-950/60 via-slate-900 to-slate-900/90 p-6 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-0.5 text-xs font-semibold text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                Summer Transfer Window Open
              </span>
              <span className="text-xs text-white/50">Deadline Day: 4 Days Remaining</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">
              Club Transfer Market &amp; FFP Desk
            </h1>
            <p className="text-sm text-white/60">
              Scout top European talent, negotiate transfer fees, trigger contractual release clauses, and maintain FFP compliance.
            </p>
          </div>

          {/* Club Financial Fair Play Health Card */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-xl border border-white/10 bg-black/40 px-5 py-3 text-center">
              <div className="text-[10px] font-semibold tracking-wider text-white/40 uppercase">
                Cash Transfer Budget
              </div>
              <div className="font-mono text-xl font-bold text-emerald-400">
                &pound;{clubCashBudgetMajor.toFixed(1)}M
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/40 px-5 py-3 text-center">
              <div className="text-[10px] font-semibold tracking-wider text-white/40 uppercase">
                FFP Wage Ratio
              </div>
              <div className={`font-mono text-xl font-bold ${currentFfpRatio > 65 ? "text-amber-300" : "text-sky-400"}`}>
                {currentFfpRatio.toFixed(1)}% / 70.0%
              </div>
              <div className="text-[9px] text-white/40">UEFA Ceiling: 70.0%</div>
            </div>
          </div>
        </div>
      </div>

      {successToast && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-center text-xs font-bold text-emerald-300 animate-in fade-in">
          {successToast}
        </div>
      )}

      {/* Main Grid: Transfer Market (Left) & Live Rumors Feed (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Transfer Market Table */}
        <div className="lg:col-span-8 space-y-4">
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 shadow-lg backdrop-blur-md">
            {/* Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
              <h2 className="text-base font-bold text-white">Transfer Targets ({filteredPlayers.length})</h2>
              
              <div className="flex gap-1 rounded-xl bg-slate-800/80 p-1 text-xs">
                {(["ALL", "GKP", "DEF", "MID", "FWD"] as const).map((pos) => (
                  <button
                    key={pos}
                    onClick={() => setFilterPos(pos)}
                    className={`rounded-lg px-2.5 py-1 font-semibold transition-all ${
                      filterPos === pos
                        ? "bg-emerald-500 text-slate-950 shadow"
                        : "text-white/60 hover:text-white"
                    }`}
                  >
                    {pos}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3">
              <input
                type="text"
                placeholder="Search player or club..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-2 text-xs text-white placeholder-white/30 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            {/* Table */}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-white/50 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-3">Player</th>
                    <th className="py-3 px-2">Club</th>
                    <th className="py-3 px-2">Pos</th>
                    <th className="py-3 px-2">OVR</th>
                    <th className="py-3 px-3 text-right">Market Value</th>
                    <th className="py-3 px-3 text-right text-rose-400">Release Clause</th>
                    <th className="py-3 px-3 text-right">Wages</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredPlayers.map((player) => (
                    <tr key={player.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 px-3">
                        <div className="font-semibold text-white">{player.name}</div>
                        <div className="text-[10px] text-white/40">{player.age} yrs old</div>
                      </td>
                      <td className="py-3.5 px-2">
                        <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] font-bold text-white/70">
                          {player.club}
                        </span>
                      </td>
                      <td className="py-3.5 px-2">
                        <span className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] font-bold text-white/50">
                          {player.position}
                        </span>
                      </td>
                      <td className="py-3.5 px-2 font-mono font-bold text-emerald-400">
                        {player.overallRating}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono text-white font-semibold">
                        &pound;{player.marketValueMajor.toFixed(1)}M
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-rose-300">
                        &pound;{player.releaseClauseMajor.toFixed(1)}M
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono text-white/60">
                        &pound;{player.currentWeeklyWageMajor}k/wk
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenBid(player, false)}
                            className="rounded-lg bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-1 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500 hover:text-slate-950 transition-colors"
                          >
                            Bid
                          </button>
                          <button
                            onClick={() => handleOpenBid(player, true)}
                            className="rounded-lg bg-rose-500/20 border border-rose-500/30 px-2.5 py-1 text-[11px] font-bold text-rose-300 hover:bg-rose-500 hover:text-white transition-colors"
                          >
                            Buyout
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Live Rumors & Completed Deals */}
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 shadow-lg backdrop-blur-md">
            <h3 className="text-sm font-bold text-white mb-3">Live Transfer Wire &amp; Rumors</h3>
            <div className="space-y-3">
              {rumors.map((r) => (
                <div
                  key={r.id}
                  className="rounded-xl border border-white/5 bg-slate-950/40 p-3.5 space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`rounded px-2 py-0.5 text-[9px] font-black ${
                        r.status === "COMPLETED"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : r.status === "REJECTED_FFP"
                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      }`}
                    >
                      {r.status.replace("_", " ")}
                    </span>
                    <span className="font-mono text-[10px] text-white/40">{r.timeAgo}</span>
                  </div>
                  <p className="font-semibold text-white text-[11px] leading-snug">{r.headline}</p>
                  <div className="font-mono text-[10px] text-white/40">
                    Fee: &pound;{r.feeMajor.toFixed(1)}M &bull; {r.fromClub} &rarr; {r.toClub}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Transfer Bid & Contract Negotiation Modal */}
      {selectedPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400">
                  Transfer Negotiation Desk
                </span>
                <h3 className="text-lg font-bold text-white">Sign {selectedPlayer.name}</h3>
              </div>
              <button
                onClick={() => setSelectedPlayer(null)}
                className="rounded-lg p-1.5 text-white/40 hover:bg-white/5 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Target Overview */}
            <div className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-950 p-3.5 text-xs">
              <div>
                <div className="font-bold text-white">{selectedPlayer.name} ({selectedPlayer.position})</div>
                <div className="text-[11px] text-white/50">{selectedPlayer.club} &bull; Rating: {selectedPlayer.overallRating}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-white/40 uppercase">Release Clause</div>
                <div className="font-mono font-bold text-rose-400">&pound;{selectedPlayer.releaseClauseMajor.toFixed(1)}M</div>
              </div>
            </div>

            {/* Transfer Fee Input */}
            <div>
              <div className="flex justify-between text-xs font-semibold text-white/80 mb-1.5">
                <span>Offered Transfer Fee (&pound; Millions):</span>
                <span className="font-mono text-emerald-400 font-bold">&pound;{bidFeeMajor}.0M</span>
              </div>
              <input
                type="number"
                min="5"
                max={Math.floor(clubCashBudgetMajor)}
                value={bidFeeMajor}
                onChange={(e) => setBidFeeMajor(Number(e.target.value) || 5)}
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-2 font-mono text-sm font-bold text-white focus:border-emerald-500 focus:outline-none"
              />
              <div className="mt-1 flex justify-between text-[10px] text-white/40">
                <span>Market Value: &pound;{selectedPlayer.marketValueMajor.toFixed(1)}M</span>
                <span>Max Cash Budget: &pound;{clubCashBudgetMajor.toFixed(1)}M</span>
              </div>
            </div>

            {/* Weekly Wage Offer */}
            <div>
              <div className="flex justify-between text-xs font-semibold text-white/80 mb-1.5">
                <span>Offered Weekly Wage (&pound; Thousands):</span>
                <span className="font-mono text-sky-400 font-bold">&pound;{bidWageMajor}k/wk</span>
              </div>
              <input
                type="number"
                min="20"
                max="600"
                value={bidWageMajor}
                onChange={(e) => setBidWageMajor(Number(e.target.value) || 20)}
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-2 font-mono text-sm font-bold text-white focus:border-sky-500 focus:outline-none"
              />
            </div>

            {/* FFP Impact Forecast */}
            <div className="rounded-xl border border-white/10 bg-slate-950 p-4 space-y-2 text-xs">
              <div className="flex justify-between text-white/60">
                <span>Current Wage Bill:</span>
                <span className="font-mono text-white">&pound;{currentWageBillMajor.toFixed(1)}M/yr ({currentFfpRatio.toFixed(1)}%)</span>
              </div>
              <div className="flex justify-between text-white/60">
                <span>Projected Post-Transfer Wage Bill:</span>
                <span className={`font-mono font-bold ${projectedFfpRatio > 70 ? "text-rose-400" : "text-emerald-400"}`}>
                  &pound;{projectedWageBillMajor.toFixed(1)}M/yr ({projectedFfpRatio.toFixed(1)}%)
                </span>
              </div>
              <div className="pt-2 border-t border-white/5 flex justify-between font-bold text-white">
                <span>UEFA 70% Cap Compliance:</span>
                <span className={`font-mono ${projectedFfpRatio <= 70 ? "text-emerald-400" : "text-rose-400"}`}>
                  {projectedFfpRatio <= 70 ? "\u2714 COMPLIANT" : "\u2718 BREACH RISK"}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setSelectedPlayer(null)}
                className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-white/60 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBid}
                className="rounded-xl bg-emerald-500 px-6 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 active:scale-95 shadow-lg shadow-emerald-500/20"
              >
                Submit Transfer Offer (&pound;{bidFeeMajor}M)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
