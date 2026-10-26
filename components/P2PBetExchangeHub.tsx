"use client";

import React, { useState, useMemo } from "react";
import { formatMinor } from "@/lib/betslip";

export type P2POfferSide = "BACK" | "LAY";

export interface P2PMarketListing {
  id: string;
  fixtureName: string;
  selection: string;
  bestBackOdds: number;
  availableBackMinor: number;
  bestLayOdds: number;
  availableLayMinor: number;
  totalVolumeMinor: number;
}

export interface P2PActiveDuel {
  id: string;
  fixtureName: string;
  selection: string;
  side: P2POfferSide;
  opponent: string;
  odds: number;
  stakeMinor: number;
  liabilityMinor: number;
  escrowPotMinor: number;
  matchedAt: string;
  status: "MATCHED" | "SETTLED_WON" | "SETTLED_LOST";
}

const INITIAL_MARKETS: P2PMarketListing[] = [
  {
    id: "m_1",
    fixtureName: "Arsenal vs Chelsea",
    selection: "Arsenal (Home Win)",
    bestBackOdds: 2.14,
    availableBackMinor: 1450_00,
    bestLayOdds: 2.18,
    availableLayMinor: 2100_00,
    totalVolumeMinor: 18240_00,
  },
  {
    id: "m_2",
    fixtureName: "Arsenal vs Chelsea",
    selection: "Over 2.5 Goals",
    bestBackOdds: 1.88,
    availableBackMinor: 890_00,
    bestLayOdds: 1.92,
    availableLayMinor: 1250_00,
    totalVolumeMinor: 9400_00,
  },
  {
    id: "m_3",
    fixtureName: "Liverpool vs Man City",
    selection: "Draw",
    bestBackOdds: 3.55,
    availableBackMinor: 620_00,
    bestLayOdds: 3.65,
    availableLayMinor: 480_00,
    totalVolumeMinor: 12150_00,
  },
  {
    id: "m_4",
    fixtureName: "Liverpool vs Man City",
    selection: "Man City (Away Win)",
    bestBackOdds: 2.30,
    availableBackMinor: 3100_00,
    bestLayOdds: 2.34,
    availableLayMinor: 1850_00,
    totalVolumeMinor: 24600_00,
  },
  {
    id: "m_5",
    fixtureName: "Real Madrid vs Barcelona",
    selection: "Both Teams To Score - YES",
    bestBackOdds: 1.62,
    availableBackMinor: 4500_00,
    bestLayOdds: 1.66,
    availableLayMinor: 3200_00,
    totalVolumeMinor: 31200_00,
  },
];

const INITIAL_DUELS: P2PActiveDuel[] = [
  {
    id: "duel_881",
    fixtureName: "Arsenal vs Chelsea",
    selection: "Arsenal (Home Win)",
    side: "BACK",
    opponent: "ViperTrader_UK",
    odds: 2.16,
    stakeMinor: 50_00,
    liabilityMinor: 58_00,
    escrowPotMinor: 108_00,
    matchedAt: "10 mins ago",
    status: "MATCHED",
  },
  {
    id: "duel_879",
    fixtureName: "Real Madrid vs Barcelona",
    selection: "Barcelona (Away Win)",
    side: "LAY",
    opponent: "CatalanWhale_99",
    odds: 2.90,
    stakeMinor: 30_00,
    liabilityMinor: 57_00,
    escrowPotMinor: 87_00,
    matchedAt: "42 mins ago",
    status: "MATCHED",
  },
];

export function P2PBetExchangeHub() {
  const [markets, setMarkets] = useState<P2PMarketListing[]>(INITIAL_MARKETS);
  const [duels, setDuels] = useState<P2PActiveDuel[]>(INITIAL_DUELS);
  const [selectedMarket, setSelectedMarket] = useState<P2PMarketListing>(INITIAL_MARKETS[0]!);
  const [offerSide, setOfferSide] = useState<P2POfferSide>("BACK");
  const [targetOdds, setTargetOdds] = useState<number>(2.14);
  const [stakeMajor, setStakeMajor] = useState<number>(25);
  const [userBalanceMinor] = useState<number>(500_00); // £500.00
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Escrow math
  const stakeMinor = Math.round(stakeMajor * 100);
  const potentialProfitMinor = Math.round(stakeMinor * (targetOdds - 1.0));
  const layerLiabilityMinor = potentialProfitMinor;
  const escrowRequiredMinor = offerSide === "BACK" ? stakeMinor : layerLiabilityMinor;

  const handlePostOffer = (e: React.FormEvent) => {
    e.preventDefault();
    if (escrowRequiredMinor > userBalanceMinor) {
      alert("Insufficient wallet balance for escrow lock!");
      return;
    }

    const newDuel: P2PActiveDuel = {
      id: `duel_${Date.now()}`,
      fixtureName: selectedMarket.fixtureName,
      selection: selectedMarket.selection,
      side: offerSide,
      opponent: "PeerMarketMaker_P2P",
      odds: targetOdds,
      stakeMinor,
      liabilityMinor: layerLiabilityMinor,
      escrowPotMinor: stakeMinor + layerLiabilityMinor,
      matchedAt: "Just now",
      status: "MATCHED",
    };

    setDuels((prev) => [newDuel, ...prev]);
    setSuccessToast(
      `P2P ${offerSide} contract matched for £${stakeMajor}.00 @ ${targetOdds.toFixed(2)}!`
    );
    setTimeout(() => setSuccessToast(null), 5000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-sky-950/60 via-slate-900 to-slate-900/90 p-6 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-0.5 text-xs font-semibold text-sky-400">
                <span className="h-2 w-2 rounded-full bg-sky-400 animate-ping" />
                Zero Margin P2P Exchange
              </span>
              <span className="text-xs text-white/50">Peer-to-Peer &bull; 2.0% Net Win Commission</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">
              Peer-to-Peer Betting Exchange
            </h1>
            <p className="text-sm text-white/60">
              Back for or Lay against outcomes directly with other traders. True odds with full escrow protection.
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/40 px-5 py-3">
            <div>
              <div className="text-[10px] font-semibold tracking-wider text-white/40 uppercase">
                Escrow Collateral Available
              </div>
              <div className="font-mono text-xl font-bold text-sky-400">
                &pound;{(userBalanceMinor / 100).toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {successToast && (
        <div className="rounded-xl border border-sky-500/40 bg-sky-500/10 p-4 text-center text-xs font-bold text-sky-300 animate-in fade-in">
          {successToast}
        </div>
      )}

      {/* Main Grid: Marketplace Board & Order Ticket */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Markets Board */}
        <div className="lg:col-span-8 space-y-4">
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 shadow-lg backdrop-blur-md">
            <h2 className="text-base font-bold text-white mb-4">Live Exchange Markets</h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-white/50 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Match & Selection</th>
                    <th className="py-3 px-3 text-center bg-sky-500/10 text-sky-400">
                      Back (Bet For)
                    </th>
                    <th className="py-3 px-3 text-center bg-rose-500/10 text-rose-400">
                      Lay (Bet Against)
                    </th>
                    <th className="py-3 px-4 text-right">Matched Volume</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {markets.map((m) => {
                    const isSelected = selectedMarket.id === m.id;
                    return (
                      <tr
                        key={m.id}
                        className={`transition-colors cursor-pointer ${
                          isSelected ? "bg-white/[0.04] ring-1 ring-sky-500/50" : "hover:bg-white/[0.02]"
                        }`}
                        onClick={() => {
                          setSelectedMarket(m);
                          setTargetOdds(offerSide === "BACK" ? m.bestBackOdds : m.bestLayOdds);
                        }}
                      >
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-white">{m.selection}</div>
                          <div className="text-[11px] text-white/50">{m.fixtureName}</div>
                        </td>

                        {/* Back Box */}
                        <td className="py-2 px-3 text-center bg-sky-500/5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedMarket(m);
                              setOfferSide("BACK");
                              setTargetOdds(m.bestBackOdds);
                            }}
                            className="w-full rounded-lg bg-sky-500/20 hover:bg-sky-500/40 border border-sky-500/30 py-2 px-3 transition-colors text-center"
                          >
                            <div className="font-mono text-sm font-black text-sky-300">
                              {m.bestBackOdds.toFixed(2)}
                            </div>
                            <div className="font-mono text-[10px] text-sky-200/60">
                              &pound;{(m.availableBackMinor / 100).toFixed(0)}
                            </div>
                          </button>
                        </td>

                        {/* Lay Box */}
                        <td className="py-2 px-3 text-center bg-rose-500/5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedMarket(m);
                              setOfferSide("LAY");
                              setTargetOdds(m.bestLayOdds);
                            }}
                            className="w-full rounded-lg bg-rose-500/20 hover:bg-rose-500/40 border border-rose-500/30 py-2 px-3 transition-colors text-center"
                          >
                            <div className="font-mono text-sm font-black text-rose-300">
                              {m.bestLayOdds.toFixed(2)}
                            </div>
                            <div className="font-mono text-[10px] text-rose-200/60">
                              &pound;{(m.availableLayMinor / 100).toFixed(0)}
                            </div>
                          </button>
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono text-white/60">
                          &pound;{(m.totalVolumeMinor / 100).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Active Duels / Matched Contracts */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 shadow-lg backdrop-blur-md">
            <h3 className="text-base font-bold text-white mb-3">Your Matched P2P Contracts</h3>
            <div className="space-y-3">
              {duels.map((d) => (
                <div
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/5 bg-slate-950/40 p-4 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded px-2.5 py-1 text-[10px] font-black ${
                        d.side === "BACK"
                          ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                          : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                      }`}
                    >
                      {d.side}
                    </span>
                    <div>
                      <div className="font-bold text-white">{d.selection}</div>
                      <div className="text-[11px] text-white/50">
                        {d.fixtureName} &bull; vs <span className="text-white/80 font-medium">{d.opponent}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-[10px] text-white/40 uppercase">Matched Odds</div>
                      <div className="font-mono font-bold text-white">{d.odds.toFixed(2)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-white/40 uppercase">Stake / Risk</div>
                      <div className="font-mono font-bold text-white">
                        &pound;{(d.stakeMinor / 100).toFixed(2)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-white/40 uppercase">Escrow Pot</div>
                      <div className="font-mono font-bold text-emerald-400">
                        &pound;{(d.escrowPotMinor / 100).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: P2P Order Ticket */}
        <div className="lg:col-span-4">
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 shadow-lg backdrop-blur-md sticky top-6">
            <h3 className="text-base font-bold text-white mb-1">Place Exchange Order</h3>
            <p className="text-xs text-white/50 mb-4">
              Match instantly against the book or post an open maker offer.
            </p>

            {/* Back vs Lay Toggle */}
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-950 p-1 mb-4">
              <button
                type="button"
                onClick={() => {
                  setOfferSide("BACK");
                  setTargetOdds(selectedMarket.bestBackOdds);
                }}
                className={`rounded-lg py-2 text-xs font-bold transition-all ${
                  offerSide === "BACK"
                    ? "bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20"
                    : "text-white/60 hover:text-white"
                }`}
              >
                BACK (Bet For)
              </button>
              <button
                type="button"
                onClick={() => {
                  setOfferSide("LAY");
                  setTargetOdds(selectedMarket.bestLayOdds);
                }}
                className={`rounded-lg py-2 text-xs font-bold transition-all ${
                  offerSide === "LAY"
                    ? "bg-rose-500 text-slate-950 shadow-md shadow-rose-500/20"
                    : "text-white/60 hover:text-white"
                }`}
              >
                LAY (Bet Against)
              </button>
            </div>

            {/* Selection info */}
            <div className="rounded-xl border border-white/5 bg-slate-950/60 p-3 mb-4">
              <div className="text-[10px] text-white/40 uppercase font-semibold">Selection</div>
              <div className="text-sm font-bold text-white">{selectedMarket.selection}</div>
              <div className="text-xs text-white/50">{selectedMarket.fixtureName}</div>
            </div>

            {/* Odds Input */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-white/80 mb-1.5">Target Odds</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTargetOdds((prev) => Math.max(1.02, parseFloat((prev - 0.02).toFixed(2))))}
                  className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm font-bold text-white hover:bg-white/5"
                >
                  -
                </button>
                <input
                  type="number"
                  step="0.01"
                  min="1.02"
                  value={targetOdds}
                  onChange={(e) => setTargetOdds(parseFloat(e.target.value) || 1.02)}
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-2 text-center font-mono text-base font-bold text-white focus:border-sky-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setTargetOdds((prev) => parseFloat((prev + 0.02).toFixed(2)))}
                  className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm font-bold text-white hover:bg-white/5"
                >
                  +
                </button>
              </div>
            </div>

            {/* Stake Input */}
            <div className="mb-5">
              <label className="block text-xs font-semibold text-white/80 mb-1.5">
                {offerSide === "BACK" ? "Backer Stake (£)" : "Backer Stake to Lay (£)"}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-sm text-white/40">&pound;</span>
                <input
                  type="number"
                  min="1"
                  value={stakeMajor}
                  onChange={(e) => setStakeMajor(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full rounded-xl border border-white/10 bg-slate-950 pl-7 pr-4 py-2 font-mono text-sm font-bold text-white focus:border-sky-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Liability & Escrow Summary Box */}
            <div className="rounded-xl border border-white/10 bg-slate-950 p-4 space-y-2 text-xs mb-5">
              <div className="flex justify-between text-white/60">
                <span>{offerSide === "BACK" ? "Your Stake:" : "Backer Stake:"}</span>
                <span className="font-mono text-white">&pound;{stakeMajor}.00</span>
              </div>
              <div className="flex justify-between text-white/60">
                <span>{offerSide === "BACK" ? "Potential Profit:" : "Your Liability (Escrow):"}</span>
                <span
                  className={`font-mono font-bold ${
                    offerSide === "BACK" ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  &pound;{(potentialProfitMinor / 100).toFixed(2)}
                </span>
              </div>
              <div className="pt-2 border-t border-white/5 flex justify-between font-bold text-white">
                <span>Escrow Locked:</span>
                <span className="font-mono text-sky-400">
                  &pound;{(escrowRequiredMinor / 100).toFixed(2)}
                </span>
              </div>
            </div>

            <button
              onClick={handlePostOffer}
              className={`w-full rounded-xl py-3 text-xs font-bold text-slate-950 transition-all active:scale-95 shadow-lg ${
                offerSide === "BACK"
                  ? "bg-sky-400 hover:bg-sky-300 shadow-sky-400/20"
                  : "bg-rose-400 hover:bg-rose-300 shadow-rose-400/20"
              }`}
            >
              Confirm {offerSide} Order (&pound;{(escrowRequiredMinor / 100).toFixed(2)})
            </button>
            <p className="mt-2 text-center text-[10px] text-white/40">
              Exchange commission: 2.0% deducted from net winnings upon settlement.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
