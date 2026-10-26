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
  odds?: any;
}

export function AsianHandicapTable({ fixture, odds }: AsianHandicapTableProps) {
  const { slip, toggleSlipSelection } = useApp();
  const [activeTab, setActiveTab] = useState<"asian" | "3way">("asian");
  const [selectedExplainer, setSelectedExplainer] = useState<AsianHandicapOption | null>(null);

  const homeName = fixture.home.shortName || fixture.home.name;
  const awayName = fixture.away.shortName || fixture.away.name;
  const isLive = fixture.status === "live";

  // Check if authoritative backend asian_handicap market is present
  const backendAhMarket = odds?.markets?.find((m: any) => m.key === "asian_handicap");
  const backend3WayMarket = odds?.markets?.find((m: any) => m.key === "handicap_3way");

  // Fallback client-generated lines responsive to in-play score
  const dynamicLines = generateAsianHandicapOptions(
    homeName,
    awayName,
    0.35,
    fixture.homeGoals ?? 0,
    fixture.awayGoals ?? 0,
    isLive
  );

  // Group backend 3-way handicap options by line
  const threeWayLinesMap = React.useMemo(() => {
    if (!backend3WayMarket?.options) return [];
    const map = new Map<number, { line: number; home?: any; draw?: any; away?: any }>();
    for (const opt of backend3WayMarket.options) {
      // outcome: hcap_<line>_<home|draw|away>
      const parts = opt.outcome.split("_");
      if (parts.length === 3) {
        const line = Number(parts[1]);
        const side = parts[2];
        if (!map.has(line)) {
          map.set(line, { line });
        }
        const entry = map.get(line)!;
        if (side === "home") entry.home = opt;
        else if (side === "draw") entry.draw = opt;
        else if (side === "away") entry.away = opt;
      }
    }
    return Array.from(map.values()).sort((a, b) => a.line - b.line);
  }, [backend3WayMarket]);

  const handleSelectAsian = (
    opt: AsianHandicapOption,
    side: "home" | "away",
    handicapVal: number,
    oddsVal: number
  ) => {
    const isHome = side === "home";
    const team = isHome ? homeName : awayName;
    const effectiveH = isHome ? handicapVal : -handicapVal;
    const formattedLine = formatAsianHandicapLine(effectiveH);

    // If backend option exists, use authoritative oddsId and version
    const backendOpt = backendAhMarket?.options?.find(
      (o: any) => o.outcome === `ah_${effectiveH > 0 ? `+${effectiveH.toFixed(2)}` : effectiveH.toFixed(2)}_${side}`
    );

    toggleSlipSelection({
      fixtureId: fixture.id,
      fixtureLabel: `${homeName} vs ${awayName}`,
      market: "asian_handicap",
      oddsId: backendOpt?.oddsId || `ah_${fixture.id}_${side}_${effectiveH}`,
      version: backendOpt?.version || 1,
      label: `${team} (${formattedLine})`,
      decimal: backendOpt?.decimal || oddsVal,
    });
  };

  const handleSelect3Way = (opt: any) => {
    toggleSlipSelection({
      fixtureId: fixture.id,
      fixtureLabel: `${homeName} vs ${awayName}`,
      market: "handicap_3way",
      oddsId: opt.oddsId,
      version: opt.version,
      label: `${homeName} v ${awayName} — ${opt.label}`,
      decimal: opt.decimal,
    });
  };

  const isAsianSelected = (side: "home" | "away", handicapVal: number) => {
    const effectiveH = side === "home" ? handicapVal : -handicapVal;
    const fallbackId = `ah_${fixture.id}_${side}_${effectiveH}`;
    return slip.some((s) => s.oddsId === fallbackId || s.oddsId?.includes(`:ah:${effectiveH.toFixed(2)}:${side}`));
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 shadow-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-neutral-800 mb-4 gap-2">
        <div>
          <h3 className="font-semibold text-neutral-100 flex items-center gap-2">
            <span>Dynamic Handicap Center</span>
            <span className="text-[10px] font-mono uppercase bg-emerald-950 text-emerald-400 border border-emerald-800 px-1.5 py-0.5 rounded">
              Live In-Play Realignment
            </span>
          </h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            Odds adjust dynamically with goal scoring and elapsed match time. Selections below 1.07 are locked.
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab("asian")}
            className={`px-2.5 py-1 text-xs font-mono font-bold rounded transition-colors ${
              activeTab === "asian"
                ? "bg-amber-500 text-neutral-950 shadow-sm"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            Asian Handicap (2-Way)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("3way")}
            className={`px-2.5 py-1 text-xs font-mono font-bold rounded transition-colors ${
              activeTab === "3way"
                ? "bg-amber-500 text-neutral-950 shadow-sm"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            European (3-Way)
          </button>
        </div>
      </div>

      {activeTab === "asian" ? (
        <>
          <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-neutral-400 uppercase tracking-wider px-2 py-1 bg-neutral-950/60 rounded mb-2 font-mono">
            <div className="col-span-5 text-left">{homeName} (1)</div>
            <div className="col-span-2 text-center">Handicap</div>
            <div className="col-span-5 text-right">{awayName} (2)</div>
          </div>

          <div className="space-y-1.5">
            {dynamicLines.map((opt) => {
              const homeSelected = isAsianSelected("home", opt.handicap);
              const awaySelected = isAsianSelected("away", opt.handicap);
              const formattedLine = formatAsianHandicapLine(opt.handicap);
              const inverseLine = formatAsianHandicapLine(-opt.handicap);

              const homeLocked = opt.homeOdds < 1.07;
              const awayLocked = opt.awayOdds < 1.07;

              return (
                <div
                  key={opt.key}
                  className="grid grid-cols-12 gap-2 items-center p-1.5 rounded-lg bg-neutral-800/40 hover:bg-neutral-800/70 transition-colors"
                >
                  {/* Home Selection Button */}
                  <div className="col-span-5">
                    <button
                      type="button"
                      disabled={homeLocked}
                      onClick={() => handleSelectAsian(opt, "home", opt.handicap, opt.homeOdds)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs font-mono font-bold transition-all border ${
                        homeSelected
                          ? "bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm"
                          : homeLocked
                            ? "bg-neutral-950/80 border-neutral-800 text-neutral-500 cursor-not-allowed opacity-60"
                            : "bg-neutral-900 border-neutral-700/60 text-neutral-200 hover:border-neutral-500"
                      }`}
                    >
                      <span className="truncate">{homeName} ({formattedLine})</span>
                      <span className="text-amber-400 ml-2 flex items-center gap-1">
                        {opt.homeOdds.toFixed(2)}
                        {homeLocked && <span title="Locked below 1.07">🔒</span>}
                      </span>
                    </button>
                  </div>

                  {/* Line center badge */}
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
                      disabled={awayLocked}
                      onClick={() => handleSelectAsian(opt, "away", opt.handicap, opt.awayOdds)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs font-mono font-bold transition-all border ${
                        awaySelected
                          ? "bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm"
                          : awayLocked
                            ? "bg-neutral-950/80 border-neutral-800 text-neutral-500 cursor-not-allowed opacity-60"
                            : "bg-neutral-900 border-neutral-700/60 text-neutral-200 hover:border-neutral-500"
                      }`}
                    >
                      <span className="truncate">{awayName} ({inverseLine})</span>
                      <span className="text-amber-400 ml-2 flex items-center gap-1">
                        {opt.awayOdds.toFixed(2)}
                        {awayLocked && <span title="Locked below 1.07">🔒</span>}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        /* 3-Way European Handicap Table */
        <>
          <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-neutral-400 uppercase tracking-wider px-2 py-1 bg-neutral-950/60 rounded mb-2 font-mono">
            <div className="col-span-3 text-center">Handicap</div>
            <div className="col-span-3 text-center">1 ({homeName})</div>
            <div className="col-span-3 text-center">X (Tie)</div>
            <div className="col-span-3 text-center">2 ({awayName})</div>
          </div>

          <div className="space-y-1.5">
            {threeWayLinesMap.map((row) => {
              const hSign = row.line > 0 ? `+${row.line}` : `${row.line}`;
              const hLocked = !row.home || row.home.suspended || row.home.decimal < 1.07;
              const dLocked = !row.draw || row.draw.suspended || row.draw.decimal < 1.07;
              const aLocked = !row.away || row.away.suspended || row.away.decimal < 1.07;

              const hSelected = row.home && slip.some((s) => s.oddsId === row.home.oddsId);
              const dSelected = row.draw && slip.some((s) => s.oddsId === row.draw.oddsId);
              const aSelected = row.away && slip.some((s) => s.oddsId === row.away.oddsId);

              return (
                <div
                  key={`3way_${row.line}`}
                  className="grid grid-cols-12 gap-2 items-center p-1.5 rounded-lg bg-neutral-800/40 hover:bg-neutral-800/70 transition-colors"
                >
                  <div className="col-span-3 flex items-center justify-center font-mono text-xs font-bold text-neutral-300">
                    <span className="px-2 py-1 bg-neutral-950 rounded border border-neutral-700/80">
                      Home ({hSign})
                    </span>
                  </div>

                  {/* Home */}
                  <div className="col-span-3">
                    <button
                      type="button"
                      disabled={hLocked}
                      onClick={() => row.home && handleSelect3Way(row.home)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs font-mono font-bold transition-all border ${
                        hSelected
                          ? "bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm"
                          : hLocked
                            ? "bg-neutral-950/80 border-neutral-800 text-neutral-500 cursor-not-allowed opacity-60"
                            : "bg-neutral-900 border-neutral-700/60 text-neutral-200 hover:border-neutral-500"
                      }`}
                    >
                      <span className="truncate">1</span>
                      <span className="text-amber-400 ml-1">
                        {row.home ? row.home.decimal.toFixed(2) : "—"}
                        {hLocked && <span className="ml-0.5">🔒</span>}
                      </span>
                    </button>
                  </div>

                  {/* Draw */}
                  <div className="col-span-3">
                    <button
                      type="button"
                      disabled={dLocked}
                      onClick={() => row.draw && handleSelect3Way(row.draw)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs font-mono font-bold transition-all border ${
                        dSelected
                          ? "bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm"
                          : dLocked
                            ? "bg-neutral-950/80 border-neutral-800 text-neutral-500 cursor-not-allowed opacity-60"
                            : "bg-neutral-900 border-neutral-700/60 text-neutral-200 hover:border-neutral-500"
                      }`}
                    >
                      <span className="truncate">X</span>
                      <span className="text-amber-400 ml-1">
                        {row.draw ? row.draw.decimal.toFixed(2) : "—"}
                        {dLocked && <span className="ml-0.5">🔒</span>}
                      </span>
                    </button>
                  </div>

                  {/* Away */}
                  <div className="col-span-3">
                    <button
                      type="button"
                      disabled={aLocked}
                      onClick={() => row.away && handleSelect3Way(row.away)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs font-mono font-bold transition-all border ${
                        aSelected
                          ? "bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm"
                          : aLocked
                            ? "bg-neutral-950/80 border-neutral-800 text-neutral-500 cursor-not-allowed opacity-60"
                            : "bg-neutral-900 border-neutral-700/60 text-neutral-200 hover:border-neutral-500"
                      }`}
                    >
                      <span className="truncate">2</span>
                      <span className="text-amber-400 ml-1">
                        {row.away ? row.away.decimal.toFixed(2) : "—"}
                        {aLocked && <span className="ml-0.5">🔒</span>}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Explainer Drawer */}
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
