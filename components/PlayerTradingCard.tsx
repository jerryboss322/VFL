"use client";

import React, { useState } from "react";
import { formatMinor } from "@/lib/betslip";

export interface PlayerStockData {
  id: string;
  name: string;
  club: string;
  position: "FWD" | "MID" | "DEF" | "GKP";
  sharePriceMinor: number;
  change24hPct: number;
  dividendYieldPct: number;
  sharesAvailable: number;
  sharesOwned: number;
  averageCostBasisMinor: number;
}

interface PlayerTradingCardProps {
  player: PlayerStockData;
  onTrade: (playerId: string, side: "BUY" | "SELL", shares: number) => void;
}

export function PlayerTradingCard({ player, onTrade }: PlayerTradingCardProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [sharesQuantity, setSharesQuantity] = useState<number>(10);

  const isPositive = player.change24hPct >= 0;
  const currentPriceMajor = player.sharePriceMinor / 100;
  const estimatedTotalCost = (currentPriceMajor * sharesQuantity).toFixed(2);

  const handleExecuteTrade = (e: React.FormEvent) => {
    e.preventDefault();
    onTrade(player.id, side, sharesQuantity);
    setModalOpen(false);
  };

  return (
    <div className="rounded-xl border border-line bg-graphite p-5 shadow-sm space-y-4 hover:border-line/80 transition flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line/60 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">{player.name}</h3>
              <span className="rounded bg-line px-1.5 py-0.5 text-[9px] font-mono font-bold text-fog">
                {player.position}
              </span>
            </div>
            <span className="text-xs text-fog">{player.club}</span>
          </div>

          <div className="text-right">
            <span className="text-sm font-black text-white font-mono">
              {formatMinor(player.sharePriceMinor)} XTS
            </span>
            <span
              className={`block text-[10px] font-mono font-bold ${
                isPositive ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {isPositive ? `+${player.change24hPct}%` : `${player.change24hPct}%`}
            </span>
          </div>
        </div>

        {/* Financial Metrics */}
        <div className="grid grid-cols-2 gap-2 py-3 border-b border-line/60 text-xs">
          <div className="rounded bg-ink/40 p-2">
            <span className="text-[10px] font-mono text-fog uppercase block">Dividend Yield</span>
            <span className="text-xs font-bold text-accent font-mono">
              {player.dividendYieldPct.toFixed(1)}% / Matchday
            </span>
          </div>
          <div className="rounded bg-ink/40 p-2">
            <span className="text-[10px] font-mono text-fog uppercase block">My Holding</span>
            <span className="text-xs font-bold text-white font-mono">
              {player.sharesOwned} shares
            </span>
          </div>
        </div>
      </div>

      {/* CTA Button */}
      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={() => {
            setSide("BUY");
            setModalOpen(true);
          }}
          className="flex-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 px-3 py-2 text-xs font-bold text-emerald-400 hover:bg-emerald-500/30 transition text-center"
        >
          Buy Shares
        </button>
        {player.sharesOwned > 0 && (
          <button
            type="button"
            onClick={() => {
              setSide("SELL");
              setModalOpen(true);
            }}
            className="flex-1 rounded-lg bg-red-500/20 border border-red-500/40 px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-500/30 transition text-center"
          >
            Sell Shares
          </button>
        )}
      </div>

      {/* Trade Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-line bg-graphite p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="text-base font-bold text-white">
                  {side === "BUY" ? "Purchase" : "Liquidate"} {player.name} Shares
                </h3>
                <span className="text-xs text-fog font-mono">AMM Spot: {formatMinor(player.sharePriceMinor)} XTS</span>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-fog hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleExecuteTrade} className="space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-mono text-fog uppercase">Quantity (Shares)</span>
                  <span className="text-white font-bold">{sharesQuantity} shares</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max={side === "BUY" ? 100 : Math.max(1, player.sharesOwned)}
                  value={sharesQuantity}
                  onChange={(e) => setSharesQuantity(Number(e.target.value))}
                  className="w-full accent-accent"
                />
              </div>

              <div className="rounded-lg bg-ink/50 p-3 text-xs space-y-1.5 border border-line/60 font-mono">
                <div className="flex justify-between">
                  <span className="text-fog">Estimated Total:</span>
                  <span className="text-white font-bold text-sm">{estimatedTotalCost} XTS</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-fog">AMM Liquidity Spread:</span>
                  <span className="text-bone">1.5%</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-fog">Expected Dividend / Match:</span>
                  <span className="text-accent">
                    +{(sharesQuantity * 5.0).toFixed(2)} XTS / Goal
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded bg-line px-4 py-2 text-xs font-bold text-white hover:bg-line/80"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`rounded px-5 py-2 text-xs font-black transition shadow-md ${
                    side === "BUY"
                      ? "bg-emerald-500 text-ink hover:brightness-110 shadow-emerald-500/20"
                      : "bg-red-500 text-white hover:brightness-110 shadow-red-500/20"
                  }`}
                >
                  Confirm {side} Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
