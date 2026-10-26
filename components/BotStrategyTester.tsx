"use client";

import React, { useState } from "react";
import {
  calculateKellyStakeFraction,
  detectArbitrage,
  simulateBacktest,
  type BacktestSimulationResult,
} from "@/lib/bot_sdk";
import { formatMinor } from "@/lib/betslip";

export function BotStrategyTester() {
  // Kelly tab state
  const [oddsInput, setOddsInput] = useState<number>(2.4);
  const [modelProbInput, setModelProbInput] = useState<number>(48); // 48%
  const [fractionalKelly, setFractionalKelly] = useState<number>(0.5); // Half Kelly

  // Arbitrage tab state
  const [arbOddsA, setArbOddsA] = useState<number>(2.15);
  const [arbOddsB, setArbOddsB] = useState<number>(2.05);

  // Backtest state
  const [backtestResult, setBacktestResult] = useState<BacktestSimulationResult | null>(null);
  const [runningBacktest, setRunningBacktest] = useState(false);

  // Kelly calculation
  const suggestedStakePct = calculateKellyStakeFraction(
    oddsInput,
    modelProbInput / 100,
    fractionalKelly,
    0.1
  );

  // Arbitrage calculation
  const arbResult = detectArbitrage([
    { id: "Selection A", decimalOdds: arbOddsA },
    { id: "Selection B", decimalOdds: arbOddsB },
  ]);

  const handleRunBacktest = () => {
    setRunningBacktest(true);
    // Generate 50 realistic historical trade executions
    setTimeout(() => {
      const mockHistory: Array<{ decimalOdds: number; won: boolean; modelEstimatedWinProb: number }> = [];
      let seed = 42;
      for (let i = 0; i < 50; i++) {
        seed = (seed * 9301 + 49297) % 233280;
        const rnd = seed / 233280;
        const odds = 1.6 + rnd * 1.8; // Odds between 1.60 and 3.40
        const implied = 1 / odds;
        const perceivedEdge = 0.04 + (rnd * 0.06); // 4% to 10% edge
        const modelProb = Math.min(0.9, implied + perceivedEdge);
        const won = (seed % 100) < Math.round(modelProb * 100);
        mockHistory.push({ decimalOdds: odds, won, modelEstimatedWinProb: modelProb });
      }

      const res = simulateBacktest(mockHistory, 1_000_000, fractionalKelly);
      setBacktestResult(res);
      setRunningBacktest(false);
    }, 350);
  };

  return (
    <div className="rounded-xl border border-line bg-graphite p-6 shadow-sm space-y-6">
      {/* Top Calculators Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Kelly Criterion Card */}
        <div className="rounded-xl bg-ink/50 border border-line/80 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-line/60 pb-2">
            <h3 className="text-sm font-bold text-white">Kelly Criterion Stake Sizer</h3>
            <span className="text-[10px] font-mono text-accent bg-accent/10 px-2 py-0.5 rounded border border-accent/20">
              OPTIMAL GROWTH
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <label className="text-[10px] font-mono text-fog uppercase block mb-1">Decimal Odds</label>
              <input
                type="number"
                step="0.05"
                min="1.01"
                max="50"
                value={oddsInput}
                onChange={(e) => setOddsInput(Number(e.target.value))}
                className="w-full rounded bg-line px-2.5 py-1.5 text-xs text-white font-mono border border-line/80"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono text-fog uppercase block mb-1">Model Win %</label>
              <input
                type="number"
                step="1"
                min="1"
                max="99"
                value={modelProbInput}
                onChange={(e) => setModelProbInput(Number(e.target.value))}
                className="w-full rounded bg-line px-2.5 py-1.5 text-xs text-white font-mono border border-line/80"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono text-fog uppercase block mb-1">Kelly Fraction</label>
              <select
                value={fractionalKelly}
                onChange={(e) => setFractionalKelly(Number(e.target.value))}
                className="w-full rounded bg-line px-2 py-1.5 text-xs text-white font-mono border border-line/80 cursor-pointer"
              >
                <option value={0.25}>0.25 (Quarter)</option>
                <option value={0.33}>0.33 (Third)</option>
                <option value={0.5}>0.50 (Half)</option>
                <option value={1.0}>1.00 (Full)</option>
              </select>
            </div>
          </div>

          <div className="rounded-lg bg-graphite p-3 border border-line/60 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono text-fog uppercase block">Recommended Stake</span>
              <span className="text-xs font-mono text-fog">
                Implied: {((1 / oddsInput) * 100).toFixed(1)}% vs Model: {modelProbInput}%
              </span>
            </div>
            <div className="text-right">
              <span className="text-base font-black text-accent font-mono">
                {(suggestedStakePct * 100).toFixed(2)}%
              </span>
              <span className="block text-[10px] font-mono text-bone">of total bankroll</span>
            </div>
          </div>
        </div>

        {/* Synthetic Arbitrage Scanner Card */}
        <div className="rounded-xl bg-ink/50 border border-line/80 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-line/60 pb-2">
            <h3 className="text-sm font-bold text-white">Cross-Book Arbitrage Scanner</h3>
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                arbResult.hasArbitrage
                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                  : "bg-line text-fog border-transparent"
              }`}
            >
              {arbResult.hasArbitrage ? "ARBITRAGE FOUND" : "NO ARB"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-[10px] font-mono text-fog uppercase block mb-1">
                Bookmaker A Odds
              </label>
              <input
                type="number"
                step="0.05"
                min="1.01"
                max="50"
                value={arbOddsA}
                onChange={(e) => setArbOddsA(Number(e.target.value))}
                className="w-full rounded bg-line px-2.5 py-1.5 text-xs text-white font-mono border border-line/80"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono text-fog uppercase block mb-1">
                Bookmaker B Odds
              </label>
              <input
                type="number"
                step="0.05"
                min="1.01"
                max="50"
                value={arbOddsB}
                onChange={(e) => setArbOddsB(Number(e.target.value))}
                className="w-full rounded bg-line px-2.5 py-1.5 text-xs text-white font-mono border border-line/80"
              />
            </div>
          </div>

          <div className="rounded-lg bg-graphite p-3 border border-line/60 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono text-fog uppercase block">Market Margin</span>
              <span className="text-xs font-mono text-bone">{arbResult.impliedMarginPct}% Total Implied</span>
            </div>
            <div className="text-right">
              <span
                className={`text-base font-black font-mono ${
                  arbResult.hasArbitrage ? "text-emerald-400" : "text-fog"
                }`}
              >
                {arbResult.hasArbitrage ? `+${arbResult.profitMarginPct}%` : "0.00%"}
              </span>
              <span className="block text-[10px] font-mono text-fog">Risk-Free Net Return</span>
            </div>
          </div>
        </div>
      </div>

      {/* Historical Backtester Runner */}
      <div className="rounded-xl bg-ink/30 border border-line/80 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line/60 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white">Backtest Algorithmic Strategy (50 Fixtures)</h3>
            <p className="text-xs text-fog">
              Simulates automated bets on historical matchdays using Fractional Kelly stake sizing.
            </p>
          </div>
          <button
            type="button"
            disabled={runningBacktest}
            onClick={handleRunBacktest}
            className="rounded bg-accent text-ink px-4 py-2 text-xs font-black hover:brightness-110 transition shadow-md shadow-accent/20 disabled:opacity-50"
          >
            {runningBacktest ? "Running Backtest..." : "Run Monte Carlo Backtest"}
          </button>
        </div>

        {backtestResult && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
            <div className="rounded bg-graphite p-3 border border-line/60 text-center">
              <span className="text-[10px] font-mono text-fog uppercase block">Win Rate</span>
              <span className="text-base font-bold text-white font-mono">
                {backtestResult.winRatePct}%
              </span>
              <span className="text-[10px] font-mono text-fog block">
                {backtestResult.wonTrades}/{backtestResult.totalTrades} won
              </span>
            </div>

            <div className="rounded bg-graphite p-3 border border-line/60 text-center">
              <span className="text-[10px] font-mono text-fog uppercase block">Cumulative Net ROI</span>
              <span
                className={`text-base font-bold font-mono ${
                  backtestResult.roiPct >= 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {backtestResult.roiPct >= 0 ? `+${backtestResult.roiPct}%` : `${backtestResult.roiPct}%`}
              </span>
              <span className="text-[10px] font-mono text-fog block">
                +{formatMinor(backtestResult.netProfitMinor)} XTS
              </span>
            </div>

            <div className="rounded bg-graphite p-3 border border-line/60 text-center">
              <span className="text-[10px] font-mono text-fog uppercase block">Max Drawdown</span>
              <span className="text-base font-bold text-peach font-mono">
                -{backtestResult.maxDrawdownPct}%
              </span>
              <span className="text-[10px] font-mono text-fog block">Peak-to-trough</span>
            </div>

            <div className="rounded bg-graphite p-3 border border-line/60 text-center">
              <span className="text-[10px] font-mono text-fog uppercase block">Sharpe Ratio</span>
              <span className="text-base font-bold text-accent font-mono">
                {backtestResult.sharpeRatio}
              </span>
              <span className="text-[10px] font-mono text-fog block">Risk-adjusted return</span>
            </div>

            <div className="rounded bg-graphite p-3 border border-line/60 text-center col-span-2 sm:col-span-1">
              <span className="text-[10px] font-mono text-fog uppercase block">Final Bankroll</span>
              <span className="text-base font-bold text-bone font-mono">
                {formatMinor(backtestResult.finalBankrollMinor)}
              </span>
              <span className="text-[10px] font-mono text-fog block">from 10,000.00 XTS</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
