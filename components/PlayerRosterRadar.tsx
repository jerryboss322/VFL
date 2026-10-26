"use client";

import React, { useMemo, useState } from "react";
import type { Fixture, MatchEvent } from "@/types/api";
import { FORMATION_PRESETS, type FormationKey, type PlayerRole } from "@/lib/tactical_engine";

export interface PlayerRosterRadarProps {
  fixture: Fixture;
  events?: MatchEvent[];
}

interface SimulatedSquadPlayer {
  number: number;
  name: string;
  role: PlayerRole;
  rating: number; // 6.0 - 9.8
  stamina: number; // 0 - 100
  goals: number;
  assists: number;
  yellowCard: boolean;
  redCard: boolean;
  isSub: boolean;
}

const PLAYER_NAME_POOL = {
  gk: ["Alisson", "Courtois", "Ederson", "Oblak", "Ter Stegen", "Donnarumma", "Maignan", "Raya"],
  def: ["Van Dijk", "Dias", "Saliba", "Rüdiger", "Militão", "Bastoni", "Gabriel", "Gvardiol", "Alexander-Arnold", "Robertson", "Hakimi", "Theo Hernández", "Carvajal", "Walker", "Davies", "Koundé"],
  mid: ["De Bruyne", "Rodri", "Bellingham", "Kroos", "Modrić", "Pedri", "Valverde", "Rice", "Ødegaard", "Barella", "Camavinga", "Bernardo Silva", "Fernandes", "Gündogan", "Mac Allister", "Wirtz"],
  att: ["Haaland", "Mbappé", "Vinícius Jr", "Salah", "Kane", "Saka", "Foden", "Rodrygo", "Griezmann", "Lautaro Martínez", "Musiala", "Leão", "Son", "Osimhen", "Palmer", "Alvarez"],
};

function generateSquadForClub(clubName: string, clubShort: string, attackRating: number, defenseRating: number): SimulatedSquadPlayer[] {
  const seed = clubShort.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const players: SimulatedSquadPlayer[] = [];

  // 1 Goalkeeper
  players.push({
    number: 1,
    name: PLAYER_NAME_POOL.gk[seed % PLAYER_NAME_POOL.gk.length] || `${clubShort} Keeper`,
    role: "GK",
    rating: Number((7.0 + (defenseRating - 1.0) * 2.5).toFixed(1)),
    stamina: 96,
    goals: 0,
    assists: 0,
    yellowCard: false,
    redCard: false,
    isSub: false,
  });

  // 4 Defenders
  const defRoles: PlayerRole[] = ["RB", "CB", "CB", "LB"];
  const defNumbers = [2, 4, 5, 3];
  for (let i = 0; i < 4; i++) {
    const pName = PLAYER_NAME_POOL.def[(seed * (i + 1) * 3) % PLAYER_NAME_POOL.def.length] || `Def ${i + 1}`;
    players.push({
      number: defNumbers[i] || (i + 2),
      name: pName,
      role: defRoles[i] || "CB",
      rating: Number((6.8 + (defenseRating - 1.0) * 2.8 + (i % 3) * 0.2).toFixed(1)),
      stamina: 88 - i * 3,
      goals: 0,
      assists: i === 0 || i === 3 ? 1 : 0,
      yellowCard: false,
      redCard: false,
      isSub: false,
    });
  }

  // 3 Midfielders
  const midRoles: PlayerRole[] = ["CDM", "CM", "CAM"];
  const midNumbers = [6, 8, 10];
  for (let i = 0; i < 3; i++) {
    const pName = PLAYER_NAME_POOL.mid[(seed * (i + 5) * 7) % PLAYER_NAME_POOL.mid.length] || `Mid ${i + 1}`;
    players.push({
      number: midNumbers[i] || (i + 6),
      name: pName,
      role: midRoles[i] || "CM",
      rating: Number((7.1 + ((attackRating + defenseRating) / 2 - 1.0) * 2.8 + (i % 2) * 0.3).toFixed(1)),
      stamina: 82 - i * 4,
      goals: i === 2 ? 1 : 0,
      assists: i === 1 ? 2 : 0,
      yellowCard: false,
      redCard: false,
      isSub: false,
    });
  }

  // 3 Attackers
  const attRoles: PlayerRole[] = ["RW", "ST", "LW"];
  const attNumbers = [7, 9, 11];
  for (let i = 0; i < 3; i++) {
    const pName = PLAYER_NAME_POOL.att[(seed * (i + 9) * 11) % PLAYER_NAME_POOL.att.length] || `Att ${i + 1}`;
    players.push({
      number: attNumbers[i] || (i + 9),
      name: pName,
      role: attRoles[i] || "ST",
      rating: Number((7.3 + (attackRating - 1.0) * 3.2 + (i % 2) * 0.4).toFixed(1)),
      stamina: 78 - i * 5,
      goals: i === 1 ? 2 : 1,
      assists: i === 0 ? 1 : 0,
      yellowCard: false,
      redCard: false,
      isSub: false,
    });
  }

  // 7 Substitutes Bench
  const subNumbers = [12, 14, 17, 18, 20, 21, 23];
  const subRoles: PlayerRole[] = ["GK", "CB", "LB", "CM", "CAM", "RW", "ST"];
  for (let i = 0; i < 7; i++) {
    players.push({
      number: subNumbers[i] || (i + 15),
      name: `Sub ${clubShort} #${subNumbers[i]}`,
      role: subRoles[i] || "CM",
      rating: Number((6.5 + (attackRating - 1.0) * 2.0).toFixed(1)),
      stamina: 100,
      goals: 0,
      assists: 0,
      yellowCard: false,
      redCard: false,
      isSub: true,
    });
  }

  return players;
}

export function PlayerRosterRadar({ fixture, events = [] }: PlayerRosterRadarProps) {
  const [selectedSide, setSelectedSide] = useState<"home" | "away">("home");
  const [selectedPlayer, setSelectedPlayer] = useState<SimulatedSquadPlayer | null>(null);

  const homeSquad = useMemo(() => {
    const sq = generateSquadForClub(
      fixture.home.name,
      fixture.home.shortName,
      fixture.home.attackRating ?? 1.2,
      fixture.home.defenseRating ?? 1.1,
    );
    // Mark cards from events
    for (const ev of events) {
      if (ev.type === "card") {
        const isH = ev.payload?.side === "home" || ev.clubId === fixture.home.id;
        if (isH) {
          const target = sq.find((p) => !p.isSub && p.role !== "GK");
          if (target) {
            if (ev.payload?.is_red) target.redCard = true;
            else target.yellowCard = true;
          }
        }
      }
    }
    return sq;
  }, [fixture, events]);

  const awaySquad = useMemo(() => {
    const sq = generateSquadForClub(
      fixture.away.name,
      fixture.away.shortName,
      fixture.away.attackRating ?? 1.1,
      fixture.away.defenseRating ?? 1.2,
    );
    for (const ev of events) {
      if (ev.type === "card") {
        const isA = ev.payload?.side === "away" || ev.clubId === fixture.away.id;
        if (isA) {
          const target = sq.find((p) => !p.isSub && p.role !== "GK");
          if (target) {
            if (ev.payload?.is_red) target.redCard = true;
            else target.yellowCard = true;
          }
        }
      }
    }
    return sq;
  }, [fixture, events]);

  const activeSquad = selectedSide === "home" ? homeSquad : awaySquad;
  const startingXI = activeSquad.filter((p) => !p.isSub);
  const bench = activeSquad.filter((p) => p.isSub);

  return (
    <div className="b365-card p-4 space-y-4">
      {/* Header with Team Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-line pb-3 gap-2">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-accent" />
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-white">
            Starting XI Lineups & Tactical Player Ratings
          </h3>
        </div>

        <div className="flex items-center gap-1.5 rounded-lg bg-surface p-1 border border-line text-xs font-mono">
          <button
            type="button"
            onClick={() => setSelectedSide("home")}
            className={`rounded px-3 py-1 font-bold transition-all ${
              selectedSide === "home"
                ? "bg-[#E5B869] text-black shadow-sm"
                : "text-fog hover:text-white"
            }`}
          >
            {fixture.home.name} (4-3-3)
          </button>
          <button
            type="button"
            onClick={() => setSelectedSide("away")}
            className={`rounded px-3 py-1 font-bold transition-all ${
              selectedSide === "away"
                ? "bg-[#38BDF8] text-black shadow-sm"
                : "text-fog hover:text-white"
            }`}
          >
            {fixture.away.name} (4-2-3-1)
          </button>
        </div>
      </div>

      {/* Starting XI Table Grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-left font-mono text-xs">
          <thead>
            <tr className="border-b border-line text-[10px] text-fog uppercase">
              <th className="py-2 px-3">#</th>
              <th className="py-2 px-3">Player</th>
              <th className="py-2 px-3">Role</th>
              <th className="py-2 px-3">Rating</th>
              <th className="py-2 px-3">Stamina</th>
              <th className="py-2 px-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/40">
            {startingXI.map((player) => (
              <tr
                key={player.number}
                onClick={() => setSelectedPlayer(player)}
                className={`cursor-pointer transition-colors hover:bg-surface ${
                  selectedPlayer?.number === player.number ? "bg-surface border-l-2 border-accent" : ""
                }`}
              >
                <td className="py-2.5 px-3 text-fog font-bold">{player.number}</td>
                <td className="py-2.5 px-3">
                  <span className="font-bold text-white hover:text-accent">
                    {player.name}
                  </span>
                  {player.goals > 0 && (
                    <span className="ml-2 inline-flex items-center text-[10px] text-gold">
                      {"⚽".repeat(player.goals)}
                    </span>
                  )}
                </td>
                <td className="py-2.5 px-3">
                  <span className="rounded bg-coal px-1.5 py-0.5 text-[10px] text-fog border border-line">
                    {player.role}
                  </span>
                </td>
                <td className="py-2.5 px-3">
                  <span className={`font-bold ${
                    player.rating >= 8.0
                      ? "text-accent"
                      : player.rating >= 7.2
                        ? "text-gold"
                        : "text-fog"
                  }`}>
                    {player.rating.toFixed(1)}
                  </span>
                </td>
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 rounded bg-coal overflow-hidden">
                      <div
                        style={{ width: `${player.stamina}%` }}
                        className={`h-full rounded ${
                          player.stamina > 80
                            ? "bg-live"
                            : player.stamina > 50
                              ? "bg-gold"
                              : "bg-loss"
                        }`}
                      />
                    </div>
                    <span className="text-[10px] text-fog">{player.stamina}%</span>
                  </div>
                </td>
                <td className="py-2.5 px-3 text-right">
                  {player.redCard ? (
                    <span className="rounded bg-loss/20 px-1.5 py-0.5 text-[10px] text-loss border border-loss/40">
                      RED
                    </span>
                  ) : player.yellowCard ? (
                    <span className="rounded bg-gold/20 px-1.5 py-0.5 text-[10px] text-gold border border-gold/40">
                      YEL
                    </span>
                  ) : (
                    <span className="text-[10px] text-live">Active</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Substitutes Bench Bar */}
      <div className="rounded-lg bg-surface p-3 border border-line space-y-2">
        <h4 className="font-mono text-[11px] font-bold uppercase text-fog">
          Substitutes Bench (7 Available)
        </h4>
        <div className="flex flex-wrap gap-2 text-xs font-mono">
          {bench.map((b) => (
            <div
              key={b.number}
              className="flex items-center gap-2 rounded bg-coal px-2.5 py-1 border border-line"
            >
              <span className="text-fog font-bold">#{b.number}</span>
              <span className="text-white">{b.name}</span>
              <span className="text-[10px] text-accent">({b.role})</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
