"use client";

import React, { useMemo, useState } from "react";
import type { Selection } from "@/lib/betslip";
import type { Fixture, FixtureOdds, OddsOption } from "@/types/api";

interface Props {
  fixture: Fixture;
  odds: FixtureOdds | null;
  slip: Selection[];
  onToggleSlip: (sel: Selection) => void;
}

export function BetBuilderStudio({ fixture, odds, slip, onToggleSlip }: Props) {
  const [selectedResult, setSelectedResult] = useState<"home" | "draw" | "away" | null>("home");
  const [selectedGoals, setSelectedGoals] = useState<"over" | "under" | null>("over");
  const [selectedBtts, setSelectedBtts] = useState<"yes" | "no" | null>(null);

  // Find the best correlated combination market option from the odds snapshot
  const matchedOption = useMemo<OddsOption | null>(() => {
    if (!odds || !odds.markets) return null;

    // 1. Result + Goals (e.g. Home & Over 2.5)
    if (selectedResult && selectedGoals && !selectedBtts) {
      const targetOutcome = `${selectedResult}_and_${selectedGoals}_2_5`;
      const resOuMarket = odds.markets.find((m) => m.key === "result_and_ou_2_5");
      return resOuMarket?.options.find((o) => o.outcome === targetOutcome) ?? null;
    }

    // 2. Result + BTTS (e.g. Home & BTTS Yes)
    if (selectedResult && selectedBtts && !selectedGoals) {
      const targetOutcome = `${selectedResult}_and_btts_${selectedBtts}`;
      const resBttsMarket = odds.markets.find((m) => m.key === "result_and_btts");
      return resBttsMarket?.options.find((o) => o.outcome === targetOutcome) ?? null;
    }

    // 3. BTTS + Goals (e.g. BTTS Yes & Over 2.5)
    if (selectedBtts && selectedGoals && !selectedResult) {
      const targetOutcome = `btts_${selectedBtts}_${selectedGoals}_2_5`;
      const bttsOuMarket = odds.markets.find((m) => m.key === "btts_and_ou_2_5");
      return bttsOuMarket?.options.find((o) => o.outcome === targetOutcome) ?? null;
    }

    // Default fallback to Result + Goals
    if (selectedResult && selectedGoals) {
      const targetOutcome = `${selectedResult}_and_${selectedGoals}_2_5`;
      const resOuMarket = odds.markets.find((m) => m.key === "result_and_ou_2_5");
      return resOuMarket?.options.find((o) => o.outcome === targetOutcome) ?? null;
    }

    return null;
  }, [odds, selectedResult, selectedGoals, selectedBtts]);

  const isAlreadyInSlip = useMemo(() => {
    if (!matchedOption) return false;
    return slip.some((s) => s.fixtureId === fixture.id && s.oddsId === matchedOption.oddsId);
  }, [slip, fixture.id, matchedOption]);

  const isUpcoming = fixture.status === "upcoming";
  const isLive = fixture.status === "live";
  const isBettingOpen = isUpcoming || isLive;

  return (
    <div className="rounded-card border border-accent/40 bg-coal p-4 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded bg-accent text-ink font-mono text-xs font-black">
            ⚡
          </span>
          <div>
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-bone">
              BETFAIR SAME-GAME MULTI (BET BUILDER)
            </h3>
            <p className="text-[11px] text-fog">
              Correlated Poisson joints for {fixture.home.shortName} vs {fixture.away.shortName}
            </p>
          </div>
        </div>
        <span className="rounded bg-[#014D38] px-2 py-0.5 font-mono text-[10px] font-bold text-accent uppercase border border-accent/30">
          JOINT PROBABILITY ENGINE
        </span>
      </div>

      <div className="my-4 space-y-3.5">
        {/* Leg 1: Match Winner */}
        <div>
          <span className="block font-mono text-[10px] font-bold uppercase tracking-wider text-fog mb-1.5">
            LEG 1: MATCH RESULT (1X2)
          </span>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "home", label: `${fixture.home.shortName} Win` },
              { id: "draw", label: "Draw" },
              { id: "away", label: `${fixture.away.shortName} Win` },
            ].map((btn) => {
              const active = selectedResult === btn.id;
              return (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => setSelectedResult(active ? null : (btn.id as "home" | "draw" | "away"))}
                  className={`min-h-[34px] rounded px-2.5 py-1 text-xs font-semibold transition-all ${
                    active
                      ? "bg-accent text-ink font-bold shadow-md shadow-accent/10"
                      : "bg-graphite text-fog hover:text-bone hover:bg-line"
                  }`}
                >
                  {btn.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Leg 2: Total Goals */}
        <div>
          <span className="block font-mono text-[10px] font-bold uppercase tracking-wider text-fog mb-1.5">
            LEG 2: TOTAL GOALS (2.5 LINE)
          </span>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: "over", label: "Over 2.5 Goals" },
              { id: "under", label: "Under 2.5 Goals" },
            ].map((btn) => {
              const active = selectedGoals === btn.id;
              return (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => setSelectedGoals(active ? null : (btn.id as "over" | "under"))}
                  className={`min-h-[34px] rounded px-2.5 py-1 text-xs font-semibold transition-all ${
                    active
                      ? "bg-accent text-ink font-bold shadow-md shadow-accent/10"
                      : "bg-graphite text-fog hover:text-bone hover:bg-line"
                  }`}
                >
                  {btn.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Leg 3: Both Teams to Score */}
        <div>
          <span className="block font-mono text-[10px] font-bold uppercase tracking-wider text-fog mb-1.5">
            LEG 3: BOTH TEAMS TO SCORE (OPTIONAL)
          </span>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: "yes", label: "BTTS — Yes" },
              { id: "no", label: "BTTS — No" },
            ].map((btn) => {
              const active = selectedBtts === btn.id;
              return (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => setSelectedBtts(active ? null : (btn.id as "yes" | "no"))}
                  className={`min-h-[34px] rounded px-2.5 py-1 text-xs font-semibold transition-all ${
                    active
                      ? "bg-accent text-ink font-bold shadow-md shadow-accent/10"
                      : "bg-graphite text-fog hover:text-bone hover:bg-line"
                  }`}
                >
                  {btn.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Pricing and Submission Summary */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3.5">
        <div>
          <span className="block font-mono text-[10px] uppercase text-fog">
            CORRELATED MULTI PRICE
          </span>
          {matchedOption ? (
            <div className="flex items-center gap-2">
              <span className="font-mono text-xl font-black text-accent">
                @ {matchedOption.decimal.toFixed(2)}
              </span>
              <span className="rounded bg-win/15 px-2 py-0.5 font-mono text-[10px] font-bold text-win">
                {matchedOption.label}
              </span>
            </div>
          ) : (
            <span className="font-mono text-xs text-fog">
              Select at least 2 legs to generate price
            </span>
          )}
        </div>

        <button
          type="button"
          disabled={!matchedOption || !isBettingOpen}
          onClick={() => {
            if (!matchedOption) return;
            onToggleSlip({
              fixtureId: fixture.id,
              fixtureLabel: `⚡ SGM • ${fixture.home.shortName} v ${fixture.away.shortName}`,
              market: "result_and_ou_2_5",
              oddsId: matchedOption.oddsId,
              version: matchedOption.version,
              label: `⚡ SGM: ${matchedOption.label}`,
              decimal: matchedOption.decimal,
            });
          }}
          className={`min-h-[40px] rounded px-4 py-2 font-mono text-xs font-bold uppercase transition-all shadow-md ${
            isAlreadyInSlip
              ? "bg-[#ED4245] text-white hover:bg-[#c93235]"
              : !matchedOption || !isUpcoming
                ? "cursor-not-allowed bg-graphite text-fog/40"
                : "bg-accent text-ink hover:bg-accent-gold active:scale-95"
          }`}
        >
          {isAlreadyInSlip
            ? "Remove Bet Builder"
            : !isUpcoming
              ? "Betting Closed"
              : matchedOption
                ? `Add SGM Ticket @ ${matchedOption.decimal.toFixed(2)}`
                : "Choose Legs"}
        </button>
      </div>
    </div>
  );
}
