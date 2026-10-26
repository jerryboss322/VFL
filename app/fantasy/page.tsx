"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { FantasySquadBuilder, type FantasyPlayer } from "@/components/FantasySquadBuilder";
import { formatMinor } from "@/lib/betslip";

interface FantasyStanding {
  rank: number;
  rosterId: string;
  teamName: string;
  managerName: string;
  totalPoints: number;
  matchdayPoints: number;
  formation: string;
  transfersMade: number;
}

interface FantasyLeagueInfo {
  id: string;
  name: string;
  inviteCode: string;
  managerCount: number;
  entryFeeMinor: number;
}

export default function FantasyFootballPage() {
  const [activeTab, setActiveTab] = useState<"builder" | "standings" | "market" | "rules">("builder");
  const [players, setPlayers] = useState<FantasyPlayer[]>([]);
  const [leagues, setLeagues] = useState<FantasyLeagueInfo[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>("");
  const [standings, setStandings] = useState<FantasyStanding[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveNotification, setSaveNotification] = useState<string | null>(null);

  // Load available players and leagues
  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoading(true);
        const [playersRes, leaguesRes] = await Promise.all([
          fetch("/api/fantasy/players"),
          fetch("/api/fantasy/leagues"),
        ]);

        if (playersRes.ok) {
          const pData = await playersRes.json();
          setPlayers(pData);
        }
        if (leaguesRes.ok) {
          const lData = await leaguesRes.json();
          setLeagues(lData);
          if (lData.length > 0) {
            setSelectedLeagueId(lData[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to load fantasy data", err);
      } finally {
        setLoading(false);
      }
    }
    void loadInitialData();
  }, []);

  // Load standings when selected league changes
  useEffect(() => {
    if (!selectedLeagueId) return;
    async function loadStandings() {
      try {
        const res = await fetch(`/api/fantasy/leagues/${selectedLeagueId}/standings`);
        if (res.ok) {
          const sData = await res.json();
          setStandings(sData);
        }
      } catch (err) {
        console.error("Failed to load standings", err);
      }
    }
    void loadStandings();
  }, [selectedLeagueId]);

  const handleSaveSquad = async (data: {
    teamName: string;
    formation: string;
    captainId: string;
    viceCaptainId: string;
    startingXi: FantasyPlayer[];
    bench: FantasyPlayer[];
  }) => {
    try {
      setSaving(true);
      setSaveNotification(null);
      const res = await fetch("/api/fantasy/roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId: selectedLeagueId || "00000000-0000-0000-0000-000000000000",
          teamName: data.teamName,
          formation: data.formation,
          captainId: data.captainId,
          viceCaptainId: data.viceCaptainId,
          startingXi: data.startingXi,
          bench: data.bench,
        }),
      });

      if (res.ok) {
        setSaveNotification("Squad successfully locked in for Matchday! Captain points doubled.");
      } else {
        const err = await res.json();
        setSaveNotification(`Squad error: ${err.detail || "Failed to save"}`);
      }
    } catch (err) {
      setSaveNotification("Network error saving squad.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Fantasy Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-950 via-neutral-900 to-neutral-950 border border-emerald-800/40 p-6 shadow-xl">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono uppercase font-bold tracking-wider">
                  Virtual Fantasy Football
                </span>
                <span className="text-xs font-mono text-neutral-400">Gameweek Active</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-neutral-100 tracking-tight">
                Trader League & Fantasy Arena
              </h1>
              <p className="text-xs text-neutral-400 max-w-xl mt-1">
                Draft your 15-man virtual European dream squad under a 100.0M budget cap. Score points for live goals, assists, clean sheets, and saves.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl px-4 py-2 text-right">
                <span className="text-[10px] font-mono uppercase text-neutral-500 block">Transfer Deadline</span>
                <span className="text-sm font-mono font-bold text-amber-400">Kickoff in 02:45</span>
              </div>
            </div>
          </div>
        </div>

        {/* Save Notification Alert */}
        {saveNotification && (
          <div className="p-3 bg-emerald-950/80 border border-emerald-700/80 rounded-xl text-xs text-emerald-300 font-mono flex items-center justify-between">
            <span>{saveNotification}</span>
            <button
              onClick={() => setSaveNotification(null)}
              className="text-emerald-400 hover:text-emerald-100 text-base leading-none"
            >
              &times;
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-neutral-800 gap-2">
          {[
            { id: "builder", label: "Pitch & Squad Builder" },
            { id: "standings", label: "Manager Standings" },
            { id: "market", label: "Transfer Market" },
            { id: "rules", label: "Scoring Matrix" },
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

        {/* TAB 1: SQUAD BUILDER */}
        {activeTab === "builder" && (
          <div>
            {loading ? (
              <div className="p-12 text-center text-xs font-mono text-neutral-400">Loading virtual players...</div>
            ) : (
              <FantasySquadBuilder
                availablePlayers={players}
                onSaveSquad={handleSaveSquad}
                saving={saving}
              />
            )}
          </div>
        )}

        {/* TAB 2: STANDINGS */}
        {activeTab === "standings" && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-neutral-100 text-sm">Fantasy Leaderboards</h3>
              {leagues.length > 0 && (
                <select
                  value={selectedLeagueId}
                  onChange={(e) => setSelectedLeagueId(e.target.value)}
                  className="bg-neutral-950 border border-neutral-700 rounded px-2.5 py-1 text-xs text-neutral-200 font-mono focus:outline-none"
                >
                  {leagues.map((lg) => (
                    <option key={lg.id} value={lg.id}>
                      {lg.name} ({lg.managerCount} Managers)
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-neutral-800 text-[11px] font-mono text-neutral-500 uppercase">
                    <th className="py-2.5 px-3">Rank</th>
                    <th className="py-2.5 px-3">Team & Manager</th>
                    <th className="py-2.5 px-3">Formation</th>
                    <th className="py-2.5 px-3 text-right">GW Pts</th>
                    <th className="py-2.5 px-3 text-right">Total Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 font-mono">
                  {standings.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-neutral-500">
                        No manager rosters submitted yet for this gameweek.
                      </td>
                    </tr>
                  ) : (
                    standings.map((st) => (
                      <tr key={st.rosterId} className="hover:bg-neutral-800/40 transition-colors">
                        <td className="py-3 px-3 font-bold text-amber-400">#{st.rank}</td>
                        <td className="py-3 px-3">
                          <p className="font-semibold text-neutral-200">{st.teamName}</p>
                          <p className="text-[10px] text-neutral-500">{st.managerName}</p>
                        </td>
                        <td className="py-3 px-3 text-neutral-400">{st.formation}</td>
                        <td className="py-3 px-3 text-right text-emerald-400 font-bold">+{st.matchdayPoints}</td>
                        <td className="py-3 px-3 text-right font-black text-neutral-100 text-sm">
                          {st.totalPoints}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: TRANSFER MARKET */}
        {activeTab === "market" && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-lg space-y-4">
            <h3 className="font-bold text-neutral-100 text-sm">All Virtual Footballers</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-neutral-800 text-[11px] font-mono text-neutral-500 uppercase">
                    <th className="py-2.5 px-3">Player</th>
                    <th className="py-2.5 px-3">Club</th>
                    <th className="py-2.5 px-3">Position</th>
                    <th className="py-2.5 px-3 text-right">Form</th>
                    <th className="py-2.5 px-3 text-right">Total Pts</th>
                    <th className="py-2.5 px-3 text-right">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 font-mono">
                  {players.map((p) => (
                    <tr key={p.playerId} className="hover:bg-neutral-800/40 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-neutral-200">{p.name}</td>
                      <td className="py-2.5 px-3 text-neutral-400">{p.clubShort || p.clubId}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-1.5 py-0.5 rounded bg-neutral-800 text-[10px] font-bold text-amber-400">
                          {p.position}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right text-neutral-300">{p.formRating?.toFixed(1) ?? "6.0"}</td>
                      <td className="py-2.5 px-3 text-right text-emerald-400 font-bold">{p.totalSeasonPoints ?? 0}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-neutral-100">
                        {formatMinor(p.priceMinor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: SCORING RULES */}
        {activeTab === "rules" && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-lg space-y-4 text-xs text-neutral-300 leading-relaxed">
            <h3 className="font-bold text-neutral-100 text-sm">Official Fantasy Scoring Matrix</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-neutral-950/60 border border-neutral-800 rounded-lg p-3 space-y-1.5">
                <h4 className="font-bold text-amber-400 uppercase font-mono text-[11px]">Goal Scoring</h4>
                <p>• Forward Goal: +4 pts</p>
                <p>• Midfielder Goal: +5 pts</p>
                <p>• Defender or Goalkeeper Goal: +6 pts</p>
                <p>• Goal Assist (All positions): +3 pts</p>
              </div>

              <div className="bg-neutral-950/60 border border-neutral-800 rounded-lg p-3 space-y-1.5">
                <h4 className="font-bold text-emerald-400 uppercase font-mono text-[11px]">Defending & Clean Sheets</h4>
                <p>• Goalkeeper/Defender Clean Sheet (60+ mins): +4 pts</p>
                <p>• Midfielder Clean Sheet (60+ mins): +1 pt</p>
                <p>• Every 2 Goals Conceded (GK/DEF): -1 pt</p>
                <p>• Every 3 Saves by Goalkeeper: +1 pt</p>
                <p>• Penalty Saved: +5 pts</p>
              </div>

              <div className="bg-neutral-950/60 border border-neutral-800 rounded-lg p-3 space-y-1.5">
                <h4 className="font-bold text-rose-400 uppercase font-mono text-[11px]">Discipline & Penalties</h4>
                <p>• Yellow Card: -1 pt</p>
                <p>• Red Card: -3 pts</p>
                <p>• Own Goal: -2 pts</p>
                <p>• Penalty Miss: -2 pts</p>
              </div>

              <div className="bg-neutral-950/60 border border-neutral-800 rounded-lg p-3 space-y-1.5">
                <h4 className="font-bold text-amber-400 uppercase font-mono text-[11px]">Captaincy & Transfers</h4>
                <p>• Nominated Captain scores 2x points automatically</p>
                <p>• If Captain does not play, Vice-Captain earns 2x points</p>
                <p>• 1 Free Transfer per Gameweek; additional transfers cost -4 pts</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
