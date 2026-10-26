"use client";

import React, { useState } from "react";
import { formatMinor } from "@/lib/betslip";

export interface OrderLevel {
  priceMinor: number;
  quantity: number;
  totalVolume: number;
}

export interface TradeTapeItem {
  id: string;
  priceMinor: number;
  quantity: number;
  side: "BUY" | "SELL";
  time: string;
}

interface OrderBookDOMProps {
  playerName: string;
  spotPriceMinor: number;
  onPlaceLimitOrder?: (side: "BUY" | "SELL", priceMinor: number, quantity: number) => void;
}

export function OrderBookDOM({ playerName, spotPriceMinor, onPlaceLimitOrder }: OrderBookDOMProps) {
  const [activeSide, setActiveSide] = useState<"BUY" | "SELL">("BUY");
  const [limitPriceMajor, setLimitPriceMajor] = useState<number>(spotPriceMinor / 100);
  const [quantity, setQuantity] = useState<number>(10);

  // Mock L2 bids & asks around spot price
  const bids: OrderLevel[] = [
    { priceMinor: spotPriceMinor - 50, quantity: 45, totalVolume: 45 },
    { priceMinor: spotPriceMinor - 100, quantity: 120, totalVolume: 165 },
    { priceMinor: spotPriceMinor - 150, quantity: 80, totalVolume: 245 },
    { priceMinor: spotPriceMinor - 200, quantity: 210, totalVolume: 455 },
    { priceMinor: spotPriceMinor - 250, quantity: 150, totalVolume: 605 },
  ];

  const asks: OrderLevel[] = [
    { priceMinor: spotPriceMinor + 50, quantity: 35, totalVolume: 35 },
    { priceMinor: spotPriceMinor + 100, quantity: 90, totalVolume: 125 },
    { priceMinor: spotPriceMinor + 150, quantity: 140, totalVolume: 265 },
    { priceMinor: spotPriceMinor + 200, quantity: 75, totalVolume: 340 },
    { priceMinor: spotPriceMinor + 250, quantity: 260, totalVolume: 600 },
  ];

  const recentTape: TradeTapeItem[] = [
    { id: "t1", priceMinor: spotPriceMinor, quantity: 25, side: "BUY", time: "16:48:22" },
    { id: "t2", priceMinor: spotPriceMinor, quantity: 10, side: "BUY", time: "16:48:19" },
    { id: "t3", priceMinor: spotPriceMinor - 50, quantity: 40, side: "SELL", time: "16:47:55" },
    { id: "t4", priceMinor: spotPriceMinor + 50, quantity: 15, side: "BUY", time: "16:47:30" },
  ];

  const maxBidVol = bids[bids.length - 1]?.totalVolume ?? 1;
  const maxAskVol = asks[asks.length - 1]?.totalVolume ?? 1;
  const spreadMinor = (asks[0]?.priceMinor ?? spotPriceMinor) - (bids[0]?.priceMinor ?? spotPriceMinor);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onPlaceLimitOrder) {
      onPlaceLimitOrder(activeSide, Math.round(limitPriceMajor * 100), quantity);
    }
  };

  return (
    <div className="rounded-xl border border-line bg-graphite p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-line/60 pb-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-accent animate-pulse"></span>
          <h3 className="text-sm font-bold text-white">
            Level 2 Order Book &amp; Depth of Market (DOM)
          </h3>
        </div>
        <span className="text-xs font-mono text-fog">
          Asset: <strong className="text-white">{playerName}</strong>
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Order Book Ladder */}
        <div className="lg:col-span-8 space-y-2">
          <div className="grid grid-cols-3 text-[10px] font-mono text-fog uppercase border-b border-line pb-1 px-2">
            <span>Price (XTS)</span>
            <span className="text-right">Size (Shares)</span>
            <span className="text-right">Cumulative Depth</span>
          </div>

          {/* Asks (Sells - Red descending to spread) */}
          <div className="space-y-0.5">
            {asks.slice().reverse().map((ask) => {
              const depthPct = Math.min(100, Math.round((ask.totalVolume / maxAskVol) * 100));
              return (
                <div
                  key={ask.priceMinor}
                  className="relative flex items-center justify-between text-xs font-mono px-2 py-0.5 hover:bg-line/30 transition cursor-pointer"
                  onClick={() => setLimitPriceMajor(ask.priceMinor / 100)}
                >
                  <div
                    className="absolute right-0 top-0 bottom-0 bg-red-500/10 pointer-events-none"
                    style={{ width: `${depthPct}%` }}
                  />
                  <span className="text-red-400 font-bold z-10">{formatMinor(ask.priceMinor)}</span>
                  <span className="text-bone text-right z-10">{ask.quantity}</span>
                  <span className="text-fog text-right z-10">{ask.totalVolume}</span>
                </div>
              );
            })}
          </div>

          {/* Spread Bar */}
          <div className="my-1 py-1 px-3 bg-charcoal rounded flex items-center justify-between text-xs font-mono border border-line/80">
            <span className="text-fog">
              Spread: <strong className="text-accent">{formatMinor(spreadMinor)} XTS</strong>
            </span>
            <span className="text-white font-bold">Mid: {formatMinor(spotPriceMinor)} XTS</span>
          </div>

          {/* Bids (Buys - Green) */}
          <div className="space-y-0.5">
            {bids.map((bid) => {
              const depthPct = Math.min(100, Math.round((bid.totalVolume / maxBidVol) * 100));
              return (
                <div
                  key={bid.priceMinor}
                  className="relative flex items-center justify-between text-xs font-mono px-2 py-0.5 hover:bg-line/30 transition cursor-pointer"
                  onClick={() => setLimitPriceMajor(bid.priceMinor / 100)}
                >
                  <div
                    className="absolute right-0 top-0 bottom-0 bg-emerald-500/10 pointer-events-none"
                    style={{ width: `${depthPct}%` }}
                  />
                  <span className="text-emerald-400 font-bold z-10">{formatMinor(bid.priceMinor)}</span>
                  <span className="text-bone text-right z-10">{bid.quantity}</span>
                  <span className="text-fog text-right z-10">{bid.totalVolume}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Limit Order Ticket Submission Form */}
        <div className="lg:col-span-4 rounded-xl bg-ink/50 border border-line p-4 space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveSide("BUY")}
              className={`flex-1 rounded py-1.5 text-xs font-bold font-mono transition ${
                activeSide === "BUY"
                  ? "bg-emerald-500 text-ink shadow-md shadow-emerald-500/20"
                  : "bg-line text-fog hover:text-white"
              }`}
            >
              LIMIT BUY
            </button>
            <button
              type="button"
              onClick={() => setActiveSide("SELL")}
              className={`flex-1 rounded py-1.5 text-xs font-bold font-mono transition ${
                activeSide === "SELL"
                  ? "bg-red-500 text-white shadow-md shadow-red-500/20"
                  : "bg-line text-fog hover:text-white"
              }`}
            >
              LIMIT SELL
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-[10px] font-mono text-fog uppercase block mb-1">
                Limit Price (XTS)
              </label>
              <input
                type="number"
                step="0.10"
                min="1"
                value={limitPriceMajor}
                onChange={(e) => setLimitPriceMajor(Number(e.target.value))}
                className="w-full rounded bg-line px-2.5 py-1.5 text-xs text-white font-mono border border-line/80"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono text-fog uppercase block mb-1">
                Quantity (Shares)
              </label>
              <input
                type="number"
                min="1"
                max="1000"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full rounded bg-line px-2.5 py-1.5 text-xs text-white font-mono border border-line/80"
              />
            </div>

            <div className="border-t border-line/60 pt-2 text-xs font-mono space-y-1">
              <div className="flex justify-between text-fog">
                <span>Total Value:</span>
                <span className="text-white font-bold">{(limitPriceMajor * quantity).toFixed(2)} XTS</span>
              </div>
              <div className="flex justify-between text-[11px] text-fog">
                <span>Execution:</span>
                <span className="text-accent">Price-Time Priority</span>
              </div>
            </div>

            <button
              type="submit"
              className={`w-full rounded py-2 text-xs font-black transition shadow-md ${
                activeSide === "BUY"
                  ? "bg-emerald-500 text-ink hover:brightness-110 shadow-emerald-500/20"
                  : "bg-red-500 text-white hover:brightness-110 shadow-red-500/20"
              }`}
            >
              Submit {activeSide} Order
            </button>
          </form>

          {/* Trade Tape */}
          <div className="border-t border-line/60 pt-3 space-y-1">
            <span className="text-[10px] font-mono text-fog uppercase block">Recent Fills</span>
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {recentTape.map((trade) => (
                <div key={trade.id} className="flex justify-between text-[10px] font-mono">
                  <span className={trade.side === "BUY" ? "text-emerald-400" : "text-red-400"}>
                    {trade.side} {trade.quantity} @ {formatMinor(trade.priceMinor)}
                  </span>
                  <span className="text-fog">{trade.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
