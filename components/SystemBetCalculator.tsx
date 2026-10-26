"use client";

import React, { useState, useMemo } from "react";
import type { Selection } from "@/lib/betslip";
import { formatMinor } from "@/lib/betslip";

export interface SystemBetConfig {
  id: string;
  name: string;
  requiredCount: number;
  betsCount: number;
  breakdown: string;
  minWinThreshold: string;
}

export const SYSTEM_BETS: SystemBetConfig[] = [
  {
    id: "trixie",
    name: "Trixie",
    requiredCount: 3,
    betsCount: 4,
    breakdown: "3 Doubles, 1 Treble",
    minWinThreshold: "2 winning selections to see a return",
  },
  {
    id: "patent",
    name: "Patent",
    requiredCount: 3,
    betsCount: 7,
    breakdown: "3 Singles, 3 Doubles, 1 Treble",
    minWinThreshold: "1 winning selection guarantees a return",
  },
  {
    id: "yankee",
    name: "Yankee",
    requiredCount: 4,
    betsCount: 11,
    breakdown: "6 Doubles, 4 Trebles, 1 Four-Fold",
    minWinThreshold: "2 winning selections to see a return",
  },
  {
    id: "lucky_15",
    name: "Lucky 15",
    requiredCount: 4,
    betsCount: 15,
    breakdown: "4 Singles, 6 Doubles, 4 Trebles, 1 Four-Fold",
    minWinThreshold: "1 winning selection guarantees a return",
  },
  {
    id: "canadian",
    name: "Canadian / Super Yankee",
    requiredCount: 5,
    betsCount: 26,
    breakdown: "10 Doubles, 10 Trebles, 5 Four-Folds, 1 Five-Fold",
    minWinThreshold: "2 winning selections to see a return",
  },
  {
    id: "lucky_31",
    name: "Lucky 31",
    requiredCount: 5,
    betsCount: 31,
    breakdown: "5 Singles, 10 Doubles, 10 Trebles, 5 Four-Folds, 1 Five-Fold",
    minWinThreshold: "1 winning selection guarantees a return",
  },
  {
    id: "heinz",
    name: "Heinz",
    requiredCount: 6,
    betsCount: 57,
    breakdown: "15 Doubles, 20 Trebles, 15 Four-Folds, 6 Five-Folds, 1 Six-Fold",
    minWinThreshold: "2 winning selections to see a return",
  },
  {
    id: "lucky_63",
    name: "Lucky 63",
    requiredCount: 6,
    betsCount: 63,
    breakdown: "6 Singles, 15 Doubles, 20 Trebles, 15 Four-Folds, 6 Five-Folds, 1 Six-Fold",
    minWinThreshold: "1 winning selection guarantees a return",
  },
  {
    id: "super_heinz",
    name: "Super Heinz",
    requiredCount: 7,
    betsCount: 120,
    breakdown: "21 Doubles, 35 Trebles, 35 Four-Folds, 21 Five-Folds, 7 Six-Folds, 1 Seven-Fold",
    minWinThreshold: "2 winning selections to see a return",
  },
  {
    id: "goliath",
    name: "Goliath",
    requiredCount: 8,
    betsCount: 247,
    breakdown: "28 Doubles, 56 Trebles, 70 Four-Folds, 56 Five-Folds, 28 Six-Folds, 8 Seven-Folds, 1 Eight-Fold",
    minWinThreshold: "2 winning selections to see a return",
  },
];

interface SystemBetCalculatorProps {
  selections: Selection[];
  unitStakeMinor: number;
  onSelectSystem?: (systemId: string, totalStakeMinor: number) => void;
}

export function SystemBetCalculator({
  selections,
  unitStakeMinor,
  onSelectSystem,
}: SystemBetCalculatorProps) {
  const count = selections.length;

  const availableSystems = useMemo(() => {
    return SYSTEM_BETS.filter((s) => s.requiredCount === count);
  }, [count]);

  const [activeSystemId, setActiveSystemId] = useState<string>(
    availableSystems[0]?.id || ""
  );

  const currentSystem = useMemo(() => {
    return availableSystems.find((s) => s.id === activeSystemId) || availableSystems[0];
  }, [availableSystems, activeSystemId]);

  // Calculate theoretical max return assuming all selections win
  // For each combination of size k, return = unitStake * product(odds)
  const maxReturnMinor = useMemo(() => {
    if (!currentSystem || count < 3) return 0;
    const odds = selections.map((s) => s.decimal);
    let totalReturn = 0;

    // Helper to get combinations
    function getCombos<T>(arr: T[], k: number): T[][] {
      if (k === 0) return [[]];
      if (arr.length === 0 || k > arr.length) return [];
      const [head, ...tail] = arr;
      if (head === undefined) return [];
      const withHead = getCombos(tail, k - 1).map((c) => [head, ...c]);
      const withoutHead = getCombos(tail, k);
      return [...withHead, ...withoutHead];
    }

    const hasSingles = currentSystem.id.startsWith("lucky") || currentSystem.id === "patent";
    const startSize = hasSingles ? 1 : 2;

    for (let size = startSize; size <= count; size++) {
      const combos = getCombos(odds, size);
      for (const combo of combos) {
        const comboOdds = combo.reduce((acc, o) => acc * o, 1);
        totalReturn += Math.round(unitStakeMinor * comboOdds);
      }
    }
    return totalReturn;
  }, [currentSystem, selections, unitStakeMinor, count]);

  if (count < 3) {
    return (
      <div className="p-3 bg-neutral-900/60 border border-neutral-800 rounded-lg text-xs text-neutral-400">
        <p className="font-semibold text-neutral-300 mb-1">Permutation & System Bets</p>
        <p>Add {3 - count} more selection{3 - count === 1 ? "" : "s"} to unlock Trixie, Patent, Yankee, and cover bets.</p>
      </div>
    );
  }

  const totalLines = currentSystem?.betsCount || 0;
  const totalStakeMinor = totalLines * unitStakeMinor;

  return (
    <div className="bg-neutral-950/80 border border-neutral-800 rounded-xl p-3.5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-200">System Bets</span>
          <span className="text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded">
            {count} Selections
          </span>
        </div>
      </div>

      {/* Available System Bet Tabs */}
      <div className="grid grid-cols-2 gap-2">
        {availableSystems.map((sys) => {
          const isSelected = (currentSystem?.id === sys.id);
          return (
            <button
              key={sys.id}
              type="button"
              onClick={() => {
                setActiveSystemId(sys.id);
                onSelectSystem?.(sys.id, sys.betsCount * unitStakeMinor);
              }}
              className={`p-2 rounded-lg text-left border transition-all ${
                isSelected
                  ? "bg-amber-500/15 border-amber-500 text-amber-300"
                  : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-100">{sys.name}</span>
                <span className="text-[10px] font-mono text-neutral-400">{sys.betsCount} bets</span>
              </div>
              <div className="text-[10px] text-neutral-400 truncate mt-0.5">{sys.breakdown}</div>
            </button>
          );
        })}
      </div>

      {/* System Details Card */}
      {currentSystem && (
        <div className="p-2.5 bg-neutral-900/90 border border-neutral-800/80 rounded-lg space-y-2 text-xs">
          <div className="text-[11px] text-emerald-400 flex items-center gap-1.5">
            <span>🛡️</span>
            <span>{currentSystem.minWinThreshold}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-neutral-800 font-mono text-[11px]">
            <div>
              <span className="text-neutral-500 block">Total Lines:</span>
              <span className="text-neutral-200 font-bold">{totalLines} bets</span>
            </div>
            <div>
              <span className="text-neutral-500 block">Total Stake:</span>
              <span className="text-amber-300 font-bold">{formatMinor(totalStakeMinor)}</span>
            </div>
            <div>
              <span className="text-neutral-500 block">Potential Max Return:</span>
              <span className="text-emerald-400 font-bold">{formatMinor(maxReturnMinor)}</span>
            </div>
            <div>
              <span className="text-neutral-500 block">Max Profit:</span>
              <span className="text-emerald-300 font-bold">
                {formatMinor(Math.max(0, maxReturnMinor - totalStakeMinor))}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
