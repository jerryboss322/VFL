"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface CommandItem {
  id: string;
  title: string;
  category: "PAGES" | "CLUBS" | "STANDARDS" | "ACTIONS";
  shortcut?: string;
  href?: string;
  action?: () => void;
}

const COMMAND_ITEMS: CommandItem[] = [
  // Core Navigation
  { id: "nav-matches", title: "Match Center (Live Fixtures)", category: "PAGES", href: "/" },
  { id: "nav-table", title: "League Standings", category: "PAGES", href: "/table" },
  { id: "nav-tournaments", title: "European Champions Cup Bracket", category: "PAGES", href: "/tournaments" },
  { id: "nav-fantasy", title: "Virtual Fantasy Football Hub", category: "PAGES", href: "/fantasy" },
  { id: "nav-player-exchange", title: "Player Stock Exchange Floor", category: "PAGES", href: "/player-exchange" },
  { id: "nav-copy-trading", title: "Social Trader Copy-Betting", category: "PAGES", href: "/copy-trading" },
  { id: "nav-bot-studio", title: "Algorithmic Bot Studio & Backtester", category: "PAGES", href: "/bot-studio" },
  { id: "nav-developer-api", title: "Developer API & Webhooks", category: "PAGES", href: "/developer-api" },
  { id: "nav-docs", title: "Architecture RFC Specifications", category: "PAGES", href: "/docs" },
  { id: "nav-var", title: "VAR Central Match Operations & SAOT", category: "PAGES", href: "/var-center" },
  { id: "nav-rewards", title: "VIP Loyalty Tiers & Daily Quests", category: "PAGES", href: "/rewards" },
  { id: "nav-safer-play", title: "Responsible Gaming & Safer Play", category: "PAGES", href: "/responsible-gaming" },
  { id: "nav-wallet", title: "Wallet & Ledger Balances", category: "PAGES", href: "/wallet" },
  { id: "nav-audit-ledger", title: "Double-Entry Ledger Audit & Solvency", category: "PAGES", href: "/audit-ledger" },
  { id: "nav-leaderboard", title: "Traders Leaderboard", category: "PAGES", href: "/leaderboard" },

  // European Clubs
  { id: "club-mci", title: "Manchester Blue (Premier League)", category: "CLUBS", href: "/table" },
  { id: "club-liv", title: "Liverpool Red (Premier League)", category: "CLUBS", href: "/table" },
  { id: "club-mad", title: "Madrid Chamartín (La Liga)", category: "CLUBS", href: "/table" },
  { id: "club-bar", title: "Barcelona Blau (La Liga)", category: "CLUBS", href: "/table" },
  { id: "club-bay", title: "Munich Red (Bundesliga)", category: "CLUBS", href: "/table" },
  { id: "club-psg", title: "Paris Red-Blue (Ligue 1)", category: "CLUBS", href: "/table" },
  { id: "club-int", title: "Milan Nerazzurri (Serie A)", category: "CLUBS", href: "/table" },

  // Technical Standards
  { id: "rfc-001", title: "RFC 001: Virtual Sports Distributed Simulation", category: "STANDARDS", href: "/docs" },
  { id: "rfc-002", title: "RFC 002: Financial Ledger Immutability & Solvency", category: "STANDARDS", href: "/docs" },
  { id: "rfc-003", title: "RFC 003: Asian Handicap Mathematics", category: "STANDARDS", href: "/docs" },
  { id: "rfc-004", title: "RFC 004: Fantasy Scoring & Valuation", category: "STANDARDS", href: "/docs" },
  { id: "rfc-007", title: "RFC 007: VAR & SAOT Offside Telemetry", category: "STANDARDS", href: "/docs" },
];

export function CommandPalette() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Keyboard shortcut listener for Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const filteredItems = COMMAND_ITEMS.filter((item) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return item.title.toLowerCase().includes(q) || item.category.toLowerCase().includes(q);
  });

  const handleSelect = (item: CommandItem) => {
    setIsOpen(false);
    setSearch("");
    if (item.action) {
      item.action();
    } else if (item.href) {
      router.push(item.href);
    }
  };

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/80 backdrop-blur-sm p-4 animate-fadeIn"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-xl rounded-xl border border-line bg-graphite shadow-2xl overflow-hidden flex flex-col">
        {/* Search Bar Input */}
        <div className="flex items-center gap-3 border-b border-line px-4 py-3 bg-charcoal">
          <svg className="h-5 w-5 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Type a command, club, standard, or page..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            className="w-full bg-transparent text-sm text-white placeholder-fog focus-visible:outline-none"
          />
          <kbd className="rounded bg-line px-1.5 py-0.5 text-[10px] font-mono text-fog border border-line/80">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-line/40">
          {filteredItems.length === 0 ? (
            <div className="p-4 text-center text-xs text-fog">No matching results found.</div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-lg text-left text-xs transition ${
                    isSelected ? "bg-accent/15 text-white" : "text-bone hover:bg-line/20"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        item.category === "PAGES"
                          ? "bg-blue-500/20 text-blue-300"
                          : item.category === "CLUBS"
                          ? "bg-purple-500/20 text-purple-300"
                          : item.category === "STANDARDS"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-amber-500/20 text-amber-300"
                      }`}
                    >
                      {item.category}
                    </span>
                    <span className="font-medium">{item.title}</span>
                  </div>

                  <span className="text-[10px] font-mono text-fog">↵ Jump</span>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-line bg-charcoal/50 px-4 py-2 flex items-center justify-between text-[11px] font-mono text-fog">
          <span>Virtual Football Command Palette</span>
          <span>Press ↑ ↓ to navigate</span>
        </div>
      </div>
    </div>
  );
}
