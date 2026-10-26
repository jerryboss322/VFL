"use client";

import React, { useState } from "react";
import { TraderCopyCard, type MasterTraderData } from "@/components/TraderCopyCard";

const MOCK_TRADERS: MasterTraderData[] = [
  {
    id: "trader-alfa",
    username: "ApexQuant",
    tier: "LEGENDARY",
    roiPct: 42.8,
    winRatePct: 68.4,
    totalProfitMinor: 18450000, // 184,500.00 XTS
    maxDrawdownPct: 8.2,
    followersCount: 1420,
    performanceFeePct: 10.0,
    recentPicks: [
      { match: "Manchester Blue vs London North", selection: "Manchester Blue AH -1.0", odds: 1.95, result: "WON" },
      { match: "Madrid Chamartín vs Catalonia Blau", selection: "Over 3.5 Goals", odds: 2.30, result: "WON" },
      { match: "Munich Red vs Dortmund Black", selection: "BTTS & Over 2.5", odds: 1.85, result: "PENDING" },
    ],
  },
  {
    id: "trader-bravo",
    username: "NordicSniper",
    tier: "MASTER",
    roiPct: 36.2,
    winRatePct: 62.1,
    totalProfitMinor: 11200000,
    maxDrawdownPct: 11.5,
    followersCount: 890,
    performanceFeePct: 10.0,
    recentPicks: [
      { match: "Milan Nerazzurri vs Milan Rossoneri", selection: "Under 2.5 Goals", odds: 1.90, result: "WON" },
      { match: "Paris Red-Blue vs Marseille", selection: "Paris Red-Blue AH -1.5", odds: 2.15, result: "LOST" },
      { match: "London Blue vs Liverpool Red", selection: "Draw", odds: 3.40, result: "WON" },
    ],
  },
  {
    id: "trader-charlie",
    username: "UnderdogVanguard",
    tier: "PRO_SHARP",
    roiPct: 29.5,
    winRatePct: 54.0,
    totalProfitMinor: 7800000,
    maxDrawdownPct: 14.1,
    followersCount: 512,
    performanceFeePct: 8.0,
    recentPicks: [
      { match: "Amsterdam vs Rotterdam", selection: "Amsterdam Win & Over 2.5", odds: 2.05, result: "WON" },
      { match: "Birmingham vs Newcastle White", selection: "Birmingham AH +0.5", odds: 1.88, result: "WON" },
      { match: "Turin Black-White vs Rome Yellow-Red", selection: "Over 2.5 Goals", odds: 2.10, result: "PENDING" },
    ],
  },
  {
    id: "trader-delta",
    username: "StatisticalEdge",
    tier: "PRO_SHARP",
    roiPct: 24.1,
    winRatePct: 60.5,
    totalProfitMinor: 6450000,
    maxDrawdownPct: 9.8,
    followersCount: 384,
    performanceFeePct: 8.0,
    recentPicks: [
      { match: "Madrid Athletic vs Seville White", selection: "Under 2.25 Goals", odds: 1.82, result: "WON" },
      { match: "London Lilywhites vs London East", selection: "London Lilywhites Win", odds: 1.75, result: "LOST" },
      { match: "Dortmund Black vs Leipzig Red", selection: "Over 3.0 Asian Goals", odds: 1.95, result: "WON" },
    ],
  },
];

export default function CopyTradingPage() {
  const [traders] = useState<MasterTraderData[]>(MOCK_TRADERS);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});
  const [filterTier, setFilterTier] = useState<string>("ALL");
  const [notification, setNotification] = useState<string | null>(null);

  const handleSubscribe = (traderId: string, maxStakeMinor: number, mode: "proportional" | "fixed") => {
    setFollowingMap((prev) => ({ ...prev, [traderId]: true }));
    const t = traders.find((x) => x.id === traderId);
    setNotification(
      `Successfully mirrored ${t?.username ?? "trader"} (${mode.toUpperCase()} mode, cap ${maxStakeMinor / 100} XTS).`
    );
    setTimeout(() => setNotification(null), 4000);
  };

  const handleUnsubscribe = (traderId: string) => {
    setFollowingMap((prev) => ({ ...prev, [traderId]: false }));
    const t = traders.find((x) => x.id === traderId);
    setNotification(`Stopped copying ${t?.username ?? "trader"}.`);
    setTimeout(() => setNotification(null), 3000);
  };

  const filteredTraders = traders.filter((t) => {
    if (filterTier === "ALL") return true;
    return t.tier === filterTier;
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-accent animate-pulse"></span>
            <span className="text-xs font-mono font-bold tracking-wider text-accent uppercase">
              Social Wagering Hub
            </span>
          </div>
          <h1 className="mt-1 text-2xl md:text-3xl font-extrabold text-white">
            Trader Copy-Betting & Portfolio Mirroring
          </h1>
          <p className="mt-1 text-sm text-fog max-w-2xl">
            Automatically mirror the verified wagers of elite sportsbook sharps. Stakes scale
            proportionately to your bankroll with slippage guard and high-water mark fee splits.
          </p>
        </div>

        {/* Global Statistics Pill */}
        <div className="flex items-center gap-3 bg-graphite border border-line rounded-lg px-4 py-2 self-start md:self-auto shadow-sm">
          <div className="text-center">
            <span className="text-[10px] uppercase font-mono text-fog block">Total Copiers</span>
            <span className="text-base font-bold text-white">3,206</span>
          </div>
          <div className="h-8 w-px bg-line"></div>
          <div className="text-center">
            <span className="text-[10px] uppercase font-mono text-fog block">Copier Payouts</span>
            <span className="text-base font-bold text-accent">+438,900 XTS</span>
          </div>
        </div>
      </div>

      {/* Floating Notification */}
      {notification && (
        <div className="rounded-lg bg-accent/20 border border-accent/40 p-3 text-xs font-medium text-accent animate-fadeIn flex items-center justify-between">
          <span>{notification}</span>
          <button type="button" onClick={() => setNotification(null)} className="text-white hover:text-accent font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Filter Chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-fog mr-2 font-mono">FILTER BY TIER:</span>
        {[
          { id: "ALL", label: "All Master Traders" },
          { id: "LEGENDARY", label: "Legendary" },
          { id: "MASTER", label: "Master" },
          { id: "PRO_SHARP", label: "Pro Sharp" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilterTier(tab.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              filterTier === tab.id
                ? "bg-accent text-ink font-bold shadow-md shadow-accent/20"
                : "bg-graphite text-fog hover:text-white border border-line"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Traders Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTraders.map((trader) => (
          <TraderCopyCard
            key={trader.id}
            trader={trader}
            isFollowing={followingMap[trader.id] ?? false}
            onSubscribe={handleSubscribe}
            onUnsubscribe={handleUnsubscribe}
          />
        ))}
      </div>

      {/* How Copy-Trading Works Footer */}
      <div className="rounded-xl border border-line bg-graphite p-6 space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
          How Proportional Copy-Betting Works
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-fog leading-relaxed">
          <div className="space-y-1 rounded-lg bg-ink/40 p-3 border border-line/60">
            <h4 className="font-bold text-bone">1. Proportional Bankroll Sizing</h4>
            <p>
              When a master trader stakes 5% of their bankroll, your account automatically mirrors with
              exactly 5% of your available funds, capped at your chosen ceiling.
            </p>
          </div>
          <div className="space-y-1 rounded-lg bg-ink/40 p-3 border border-line/60">
            <h4 className="font-bold text-bone">2. High-Water Mark Fee Split</h4>
            <p>
              The 8–10% performance fee applies purely to net winning profits. If a copied ticket loses,
              zero fees are charged.
            </p>
          </div>
          <div className="space-y-1 rounded-lg bg-ink/40 p-3 border border-line/60">
            <h4 className="font-bold text-bone">3. Automated Slippage Protection</h4>
            <p>
              If live market odds move unfavorably by more than 5% before your mirror completes, the bet is
              automatically cancelled to protect your edge.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
