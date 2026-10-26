"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { useApp } from "@/components/AppContext";
import { TournamentBracketView, type TournamentBracketData } from "@/components/TournamentBracketView";

export default function TournamentsPage() {
  const { toggleSlipSelection, slip } = useApp();
  const [activeTab, setActiveTab] = useState<"bracket" | "outright" | "rules">("bracket");
  const [bracketData, setBracketData] = useState<TournamentBracketData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadBracket() {
      try {
        setLoading(true);
        const res = await fetch("/api/tournaments/champions-cup/bracket");
        if (res.ok) {
          const data = await res.json();
          setBracketData(data);
        }
      } catch (err) {
        console.error("Failed to load tournament bracket", err);
      } finally {
        setLoading(false);
      }
    }
    void loadBracket();
  }, []);

  const handlePlaceOutrightBet = (club: { club_id: string; name: string; decimal_odds: number }) => {
    toggleSlipSelection({
      fixtureId: `outright_${club.club_id}`,
      fixtureLabel: "Champions Cup Outright Winner",
      market: "outright_winner",
      oddsId: `outright_${club.club_id}`,
      version: 1,
      label: `${club.name} to Lift the Trophy`,
      decimal: club.decimal_odds,
    });
  };

  const isSelected = (clubId: string) => {
    return slip.some((s) => s.oddsId === `outright_${clubId}`);
  };

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Champions Cup Hero Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-950/80 via-neutral-900 to-neutral-950 border border-amber-500/30 p-6 shadow-2xl">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-mono uppercase font-bold tracking-wider">
                  Knockout Stage Active
                </span>
                <span className="text-xs font-mono text-neutral-400">Road to the Final</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-neutral-100 tracking-tight flex items-center gap-2">
                <span>Virtual Champions Cup</span>
                <span>🏆</span>
              </h1>
              <p className="text-xs text-neutral-400 max-w-xl mt-1">
                16 elite European clubs compete in two-legged aggregate knockout ties through the Round of 16, Quarter-Finals, Semi-Finals, and Grand Final.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl px-4 py-2 text-right">
                <span className="text-[10px] font-mono uppercase text-neutral-500 block">Total Prize Pool</span>
                <span className="text-base font-mono font-bold text-amber-400">5,000,000 XTS</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-neutral-800 gap-2">
          {[
            { id: "bracket", label: "Interactive Tree Bracket" },
            { id: "outright", label: "Outright Winner Odds" },
            { id: "rules", label: "Tournament Format & Rules" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-3 px-3 font-mono text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${
                activeTab === tab.id
                  ? "border-amber-400 text-amber-400"
                  : "border-transparent text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB 1: BRACKET */}
        {activeTab === "bracket" && (
          <div>
            {loading || !bracketData ? (
              <div className="p-12 text-center text-xs font-mono text-neutral-400">
                Generating Champions Cup knockout bracket...
              </div>
            ) : (
              <TournamentBracketView bracket={bracketData} />
            )}
          </div>
        )}

        {/* TAB 2: OUTRIGHT ODDS */}
        {activeTab === "outright" && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-lg space-y-4">
            <div>
              <h3 className="font-bold text-neutral-100 text-sm">Outright Tournament Winner</h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Select any club to add directly to your ticket. Back your favorite to lift the Champions Cup.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {((bracketData as any)?.outrightOdds || []).map((club: any) => {
                const selected = isSelected(club.club_id);
                return (
                  <button
                    key={club.club_id}
                    type="button"
                    onClick={() => handlePlaceOutrightBet(club)}
                    className={`p-3 rounded-xl border text-left font-mono transition-all flex items-center justify-between ${
                      selected
                        ? "bg-amber-500/20 border-amber-500 text-amber-300 shadow-md"
                        : "bg-neutral-950/70 border-neutral-800 hover:border-neutral-600 text-neutral-200"
                    }`}
                  >
                    <div>
                      <p className="font-bold text-xs text-neutral-100">{club.name}</p>
                      <p className="text-[10px] text-neutral-500">{club.country} • {(club.probability * 100).toFixed(1)}% prob</p>
                    </div>
                    <span className="text-sm font-black text-amber-400 ml-2">
                      {club.decimal_odds.toFixed(2)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: FORMAT & RULES */}
        {activeTab === "rules" && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-lg space-y-4 text-xs text-neutral-300 leading-relaxed">
            <h3 className="font-bold text-neutral-100 text-sm">Champions Cup Rules & Regulations</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-neutral-950/60 border border-neutral-800 rounded-lg p-3 space-y-1.5">
                <h4 className="font-bold text-amber-400 uppercase font-mono text-[11px]">Two-Legged Aggregate Ties</h4>
                <p>• Round of 16, Quarter-Finals, and Semi-Finals are played over two legs (Home & Away).</p>
                <p>• The club with the higher aggregate goal score over 180 minutes progresses.</p>
                <p>• Away Goals Rule is abolised: tied aggregate scores proceed to Extra Time regardless of where goals were scored.</p>
              </div>

              <div className="bg-neutral-950/60 border border-neutral-800 rounded-lg p-3 space-y-1.5">
                <h4 className="font-bold text-emerald-400 uppercase font-mono text-[11px]">Extra Time & Shootouts</h4>
                <p>• If aggregate scores are tied after 180 minutes, 30 minutes of Extra Time (2 x 15 mins) is played.</p>
                <p>• If still level after Extra Time, a 5-penalty shootout decides the winner.</p>
                <p>• If level after 5 penalties each, sudden death rules apply until a team wins.</p>
              </div>

              <div className="bg-neutral-950/60 border border-neutral-800 rounded-lg p-3 space-y-1.5">
                <h4 className="font-bold text-rose-400 uppercase font-mono text-[11px]">Neutral Grand Final</h4>
                <p>• The Grand Final is a single 90-minute fixture held at a designated European neutral venue.</p>
                <p>• Extra Time and Penalty Shootout apply if level at full-time.</p>
              </div>

              <div className="bg-neutral-950/60 border border-neutral-800 rounded-lg p-3 space-y-1.5">
                <h4 className="font-bold text-amber-400 uppercase font-mono text-[11px]">Seeding & Draw Protection</h4>
                <p>• In Round of 16, 8 seeded group winners cannot play each other.</p>
                <p>• Same-country protection prevents domestic clashes in the Round of 16.</p>
                <p>• Open draw from Quarter-Finals onwards allows any club to face any opponent.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
