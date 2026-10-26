"use client";

import React, { useState } from "react";
import { useApp } from "./AppContext";
import {
  formatAsianHandicapLine,
  explainAsianHandicapLine,
  generateAsianHandicapOptions,
  type AsianHandicapOption,
} from "@/lib/asian_handicap";
import type { Fixture } from "@/types/api";

interface AsianHandicapTableProps {
  fixture: Fixture;
}

export function AsianHandicapTable({ fixture }: AsianHandicapTableProps) {
  const { slip, toggleSlipSelection } = useApp();
  const [selectedExplainer, setSelectedExplainer] = useState<AsianHandicapOption | null>(null);

  const homeName = fixture.home.shortName || fixture.home.name;
  const awayName = fixture.away.shortName || fixture.away.name;

  // Generate lines
  const lines = generateAsianHandicapOptions(homeName, awayName, 0.3);

  const handleSelect = (
    opt: AsianHandicapOption,
    side: "home" | "away",
    handicapVal: number,
    odds: number
  ) => {
    const isHome = side === "home";
    const team = isHome ? homeName : awayName;
    const effectiveH = isHome ? handicapVal : -handicapVal;
    const sign = effectiveH > 0 ? `+${effectiveH}` : `${effectiveH}`;
    const formattedLine = formatAsianHandicapLine(effectiveH);

    toggleSlipSelection({
      fixtureId: fixture.id,
      fixtureLabel: `${homeName} vs ${awayName}`,
      market: "asian_handicap",
      oddsId: `ah_${fixture.id}_${side}_${effectiveH}`,
      version: 1,
      label: `${team} (${formattedLine})`,
      decimal: odds,
    });
  };

  const isSelected = (side: "home" | "away", handicapVal: number) => {
    const effectiveH = side === "home" ? handicapVal : -handicapVal;
    const oddsId = `ah_${fixture.id}_${side}_${effectiveH}`;
    return slip.some((s) => s.oddsId === oddsId);
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 shadow-lg">
      <div className="flex items-center justify-between pb-3 border-b border-neutral-800 mb-4">
        <div>
          <h3 className="font-semibold text-neutral-100 flex items-center gap-2">
            <span>Asian Handicap & Alternative Spreads</span>
            <span className="text-[10px] font-mono uppercase bg-emerald-950 text-emerald-400 border border-emerald-800 px-1.5 py-0.5 rounded">
              Split-Line Engine
            </span>
          </h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            Quarter lines (+/-0.25, +/-0.75) eliminate full draw losses by splitting stakes into dual half-bets.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-neutral-400 uppercase tracking-wider px-2 py-1 bg-neutral-950/60 rounded mb-2">
        <div className="col-span-5 text-left">{homeName}</div>
        <div className="col-span-2 text-center">Handicap Line</div>
        <div className="col-span-5 text-right">{awayName}</div>
      </div>

      <div className="space-y-1.5">
        {lines.map((opt) => {
          const homeSelected = isSelected("home", opt.handicap);
          const awaySelected = isSelected("away", opt.handicap);
          const formattedLine = formatAsianHandicapLine(opt.handicap);
          const inverseLine = formatAsianHandicapLine(-opt.handicap);

          return (
            <div
              key={opt.key}
              className="grid grid-cols-12 gap-2 items-center p-1.5 rounded-lg bg-neutral-800/40 hover:bg-neutral-800/70 transition-colors"
            >
              {/* Home Selection Button */}
              <div className="col-span-5">
                <button
                  type="button"
                  onClick={() => handleSelect(opt, "home", opt.handicap, opt.homeOdds)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs font-mono font-bold transition-all border ${
                    homeSelected
                      ? "bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm"
                      : "bg-neutral-900 border-neutral-700/60 text-neutral-200 hover:border-neutral-500"
                  }`}
                >
                  <span className="truncate">{homeName} ({formattedLine})</span>
                  <span className="text-amber-400 ml-2">{opt.homeOdds.toFixed(2)}</span>
                </button>
              </div>

              {/* Line center badge & explainer button */}
              <div className="col-span-2 flex justify-center">
                <button
                  type="button"
                  title="Click to view line settlement rules"
                  onClick={() => setSelectedExplainer(selectedExplainer?.key === opt.key ? null : opt)}
                  className="px-2 py-1 rounded bg-neutral-900/90 border border-neutral-700/80 text-[11px] font-mono text-neutral-300 hover:text-emerald-400 hover:border-emerald-600 transition-colors"
                >
                  {formattedLine}
                </button>
              </div>

              {/* Away Selection Button */}
              <div className="col-span-5">
                <button
                  type="button"
                  onClick={() => handleSelect(opt, "away", opt.handicap, opt.awayOdds)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs font-mono font-bold transition-all border ${
                    awaySelected
                      ? "bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm"
                      : "bg-neutral-900 border-neutral-700/60 text-neutral-200 hover:border-neutral-500"
                  }`}
                >
                  <span className="truncate">{awayName} ({inverseLine})</span>
                  <span className="text-amber-400 ml-2">{opt.awayOdds.toFixed(2)}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Explainer Drawer / Popover */}
      {selectedExplainer && (
        <div className="mt-4 p-3 bg-neutral-950/90 border border-neutral-700 rounded-lg text-xs animate-in fade-in duration-200">
          <div className="flex items-center justify-between text-neutral-300 font-semibold mb-1">
            <span className="text-emerald-400">Line Mechanics: {formatAsianHandicapLine(selectedExplainer.handicap)}</span>
            <button
              onClick={() => setSelectedExplainer(null)}
              className="text-neutral-500 hover:text-neutral-200 text-base leading-none"
            >
              &times;
            </button>
          </div>
          <p className="text-neutral-400 leading-relaxed">{selectedExplainer.description}</p>
        </div>
      )}
    </div>
  );
}
