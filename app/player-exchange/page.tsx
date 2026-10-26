"use client";

import React, { useState } from "react";
import { PlayerTradingCard, type PlayerStockData } from "@/components/PlayerTradingCard";
import { formatMinor } from "@/lib/betslip";

const MOCK_PLAYERS: PlayerStockData[] = [
  {
    id: "ply-haaland",
    name: "Erling Haaland",
    club: "Manchester Blue",
    position: "FWD",
    sharePriceMinor: 8450, // 84.50 XTS
    change24hPct: 6.8,
    dividendYieldPct: 14.2,
    sharesAvailable: 8420,
    sharesOwned: 25,
    averageCostBasisMinor: 7800,
  },
  {
    id: "ply-mbappe",
    name: "Kylian Mbappé",
    club: "Madrid Chamartín",
    position: "FWD",
    sharePriceMinor: 9200, // 92.00 XTS
    change24hPct: 4.1,
    dividendYieldPct: 15.0,
    sharesAvailable: 6100,
    sharesOwned: 10,
    averageCostBasisMinor: 8900,
  },
  {
    id: "ply-vinicius",
    name: "Vinícius Júnior",
    club: "Madrid Chamartín",
    position: "FWD",
    sharePriceMinor: 7600, // 76.00 XTS
    change24hPct: -1.8,
    dividendYieldPct: 12.5,
    sharesAvailable: 11400,
    sharesOwned: 0,
    averageCostBasisMinor: 0,
  },
  {
    id: "ply-bellingham",
    name: "Jude Bellingham",
    club: "Madrid Chamartín",
    position: "MID",
    sharePriceMinor: 8100, // 81.00 XTS
    change24hPct: 3.2,
    dividendYieldPct: 13.8,
    sharesAvailable: 9500,
    sharesOwned: 15,
    averageCostBasisMinor: 7500,
  },
  {
    id: "ply-saka",
    name: "Bukayo Saka",
    club: "London North",
    position: "MID",
    sharePriceMinor: 6900, // 69.00 XTS
    change24hPct: 2.5,
    dividendYieldPct: 11.4,
    sharesAvailable: 14200,
    sharesOwned: 0,
    averageCostBasisMinor: 0,
  },
  {
    id: "ply-debruyne",
    name: "Kevin De Bruyne",
    club: "Manchester Blue",
    position: "MID",
    sharePriceMinor: 7400, // 74.00 XTS
    change24hPct: -0.9,
    dividendYieldPct: 16.5,
    sharesAvailable: 7800,
    sharesOwned: 5,
    averageCostBasisMinor: 7600,
  },
  {
    id: "ply-vandijk",
    name: "Virgil van Dijk",
    club: "Liverpool Red",
    position: "DEF",
    sharePriceMinor: 5200, // 52.00 XTS
    change24hPct: 1.2,
    dividendYieldPct: 9.8,
    sharesAvailable: 18000,
    sharesOwned: 0,
    averageCostBasisMinor: 0,
  },
  {
    id: "ply-saliba",
    name: "William Saliba",
    club: "London North",
    position: "DEF",
    sharePriceMinor: 4800, // 48.00 XTS
    change24hPct: 3.5,
    dividendYieldPct: 8.9,
    sharesAvailable: 22000,
    sharesOwned: 0,
    averageCostBasisMinor: 0,
  },
];

export default function PlayerExchangePage() {
  const [players, setPlayers] = useState<PlayerStockData[]>(MOCK_PLAYERS);
  const [positionFilter, setPositionFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Compute portfolio metrics
  const portfolioValuationMinor = players.reduce(
    (acc, p) => acc + p.sharesOwned * p.sharePriceMinor,
    0
  );
  const portfolioCostBasisMinor = players.reduce(
    (acc, p) => acc + p.sharesOwned * p.averageCostBasisMinor,
    0
  );
  const unrealizedPnLMinor = portfolioValuationMinor - portfolioCostBasisMinor;
  const totalSharesCount = players.reduce((acc, p) => acc + p.sharesOwned, 0);

  const handleTrade = (playerId: string, side: "BUY" | "SELL", quantity: number) => {
    setPlayers((prev) =>
      prev.map((p) => {
        if (p.id !== playerId) return p;
        const newOwned = side === "BUY" ? p.sharesOwned + quantity : Math.max(0, p.sharesOwned - quantity);
        return {
          ...p,
          sharesOwned: newOwned,
        };
      })
    );
    const targetPlayer = players.find((x) => x.id === playerId);
    setToastMessage(
      `Order Executed: ${side} ${quantity} shares of ${targetPlayer?.name} @ ${formatMinor(
        targetPlayer?.sharePriceMinor ?? 0
      )} XTS.`
    );
    setTimeout(() => setToastMessage(null), 4000);
  };

  const filteredPlayers = players.filter((p) => {
    if (positionFilter !== "ALL" && p.position !== positionFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.club.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-mono font-bold tracking-wider text-emerald-400 uppercase">
              Virtual Stock Exchange
            </span>
          </div>
          <h1 className="mt-1 text-2xl md:text-3xl font-extrabold text-white">
            Player Share Trading & Dividend Floor
          </h1>
          <p className="mt-1 text-sm text-fog max-w-2xl">
            Trade fractional shares of elite football athletes with Automated Market Maker (AMM) instant
            liquidity. Earn continuous dividend yields on every matchday goal, assist, and clean sheet.
          </p>
        </div>

        {/* Market Status Pill */}
        <div className="flex items-center gap-3 bg-graphite border border-line rounded-lg px-4 py-2 self-start md:self-auto shadow-sm">
          <div className="text-center">
            <span className="text-[10px] uppercase font-mono text-fog block">Market State</span>
            <span className="text-xs font-bold text-emerald-400">OPEN (24/7 AMM)</span>
          </div>
          <div className="h-8 w-px bg-line"></div>
          <div className="text-center">
            <span className="text-[10px] uppercase font-mono text-fog block">AMM Spread</span>
            <span className="text-base font-bold text-accent">1.5%</span>
          </div>
        </div>
      </div>

      {/* Floating Notification */}
      {toastMessage && (
        <div className="rounded-lg bg-emerald-500/20 border border-emerald-500/40 p-3 text-xs font-medium text-emerald-300 animate-fadeIn flex items-center justify-between">
          <span>{toastMessage}</span>
          <button type="button" onClick={() => setToastMessage(null)} className="text-white hover:text-emerald-300 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Trader Portfolio Summary Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-line bg-graphite p-4 space-y-1">
          <span className="text-[10px] font-mono text-fog uppercase">Portfolio Value</span>
          <div className="text-xl font-black text-white font-mono">
            {formatMinor(portfolioValuationMinor)} <span className="text-xs font-bold text-accent">XTS</span>
          </div>
          <span className="text-[10px] text-fog font-mono">{totalSharesCount} total shares</span>
        </div>

        <div className="rounded-xl border border-line bg-graphite p-4 space-y-1">
          <span className="text-[10px] font-mono text-fog uppercase">Unrealized PnL</span>
          <div
            className={`text-xl font-black font-mono ${
              unrealizedPnLMinor >= 0 ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {unrealizedPnLMinor >= 0 ? `+${formatMinor(unrealizedPnLMinor)}` : formatMinor(unrealizedPnLMinor)}{" "}
            <span className="text-xs font-bold text-fog">XTS</span>
          </div>
          <span className="text-[10px] text-fog font-mono">Cost basis: {formatMinor(portfolioCostBasisMinor)} XTS</span>
        </div>

        <div className="rounded-xl border border-line bg-graphite p-4 space-y-1">
          <span className="text-[10px] font-mono text-fog uppercase">Matchday Dividends</span>
          <div className="text-xl font-black text-accent font-mono">
            +425.00 <span className="text-xs font-bold text-fog">XTS</span>
          </div>
          <span className="text-[10px] text-emerald-400 font-mono">Yield credited automatically</span>
        </div>

        <div className="rounded-xl border border-line bg-graphite p-4 space-y-1">
          <span className="text-[10px] font-mono text-fog uppercase">Athletes Held</span>
          <div className="text-xl font-black text-white font-mono">
            {players.filter((p) => p.sharesOwned > 0).length}{" "}
            <span className="text-xs font-bold text-fog">Footballers</span>
          </div>
          <span className="text-[10px] text-fog font-mono">Diversified across 2 clubs</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {["ALL", "FWD", "MID", "DEF", "GKP"].map((pos) => (
            <button
              key={pos}
              type="button"
              onClick={() => setPositionFilter(pos)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                positionFilter === pos
                  ? "bg-accent text-ink font-bold shadow-md shadow-accent/20"
                  : "bg-graphite text-fog hover:text-white border border-line"
              }`}
            >
              {pos === "ALL" ? "All Positions" : pos}
            </button>
          ))}
        </div>

        <div>
          <input
            type="text"
            placeholder="Search player or club..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded bg-graphite px-3 py-1.5 text-xs text-white placeholder-fog border border-line focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent w-64"
          />
        </div>
      </div>

      {/* Player Share Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {filteredPlayers.map((player) => (
          <PlayerTradingCard key={player.id} player={player} onTrade={handleTrade} />
        ))}
      </div>

      {/* Financial Mechanics Card */}
      <div className="rounded-xl border border-line bg-graphite p-6 space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
          Player Stock Economics & Matchday Yields
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-fog leading-relaxed">
          <div className="space-y-1 rounded-lg bg-ink/40 p-3 border border-line/60">
            <h4 className="font-bold text-bone">1. Performance Dividends</h4>
            <p>
              Holding shares yields cash payouts every matchday: +5.00 XTS per goal scored, +2.50 XTS per
              assist, and +3.00 XTS for a defensive clean sheet.
            </p>
          </div>
          <div className="space-y-1 rounded-lg bg-ink/40 p-3 border border-line/60">
            <h4 className="font-bold text-bone">2. AMM Bonding Curve</h4>
            <p>
              Pricing follows a constant-product formula ($x \cdot y = k$). As traders buy shares, pool price
              rises exponentially. As traders sell shares, cash is instantly returned from reserves.
            </p>
          </div>
          <div className="space-y-1 rounded-lg bg-ink/40 p-3 border border-line/60">
            <h4 className="font-bold text-bone">3. Guaranteed Liquidity</h4>
            <p>
              Zero counterparty waiting time. The automated liquidity pool guarantees instant order
              execution 24/7 with a 1.5% fixed bid-ask spread.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
