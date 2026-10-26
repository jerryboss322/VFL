"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useState, type ReactNode } from "react";
import { AppProvider, useApp } from "@/components/AppContext";
import { AudioToggle } from "@/components/AudioToggle";
import { LanguageSelector } from "@/components/LanguageSelector";
import { AuthModal } from "@/components/AuthModal";
import { CommandPalette } from "@/components/CommandPalette";
import { BetslipDrawer } from "@/components/BetslipDrawer";
import { LiveTicker } from "@/components/LiveTicker";
import { combinedOdds, formatMinor } from "@/lib/betslip";
import { LEAGUE_LOGOS } from "@/lib/clubLogos";

const NAV: { href: string; label: string }[] = [
  { href: "/", label: "Match Center" },
  { href: "/table", label: "Standings" },
  { href: "/calendar", label: "Calendar" },
  { href: "/tournaments", label: "Cup Bracket" },
  { href: "/penalty-shootout", label: "Shootout" },
  { href: "/p2p-exchange", label: "P2P Exchange" },
  { href: "/copy-trading", label: "Copy Trading" },
  { href: "/bot-studio", label: "Bot Studio" },
  { href: "/developer-api", label: "Developer API" },
  { href: "/docs", label: "RFC Docs" },
  { href: "/var-center", label: "VAR Center" },
  { href: "/rewards", label: "VIP Rewards" },
  { href: "/responsible-gaming", label: "Safer Play" },
  { href: "/bets", label: "My Bets" },
  { href: "/wallet", label: "Wallet & Ledger" },
  { href: "/audit-ledger", label: "Ledger Audit" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/profile", label: "Profile" },
];

const COUNTRY_CODE: Record<string, string> = {
  England: "ENG",
  Spain: "ESP",
  Italy: "ITA",
  Germany: "GER",
  France: "FRA",
  Netherlands: "NED",
};

function ShellInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const {
    leagues,
    selectedLeagueId,
    setSelectedLeagueId,
    user,
    wallet,
    openBets,
    slip,
    setAuthModalOpen,
    logout,
  } = useApp();

  return (
    <div className="flex min-h-screen flex-col bg-ink pb-14 md:pb-0 text-bone">
      {/* Main Navigation Header */}
      <header role="banner" className="sticky top-0 z-30 b365-header shadow-md backdrop-blur-md">
        <div className="mx-auto flex min-h-[58px] max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-2">
          <div className="flex items-center gap-4 lg:gap-8">
            {/* Mobile Hamburger Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle navigation menu"
              className="md:hidden flex h-9 w-9 items-center justify-center rounded border border-line bg-graphite text-white hover:border-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {mobileMenuOpen ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>

            <Link href="/" className="group flex items-center gap-2.5">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center rounded-lg bg-gradient-to-br from-accent to-[#00D8F6] px-2.5 py-1 shadow-md shadow-accent/20">
                  <span className="font-mono text-base font-black tracking-tight text-ink">
                    VFL
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-black uppercase tracking-wider text-white leading-none">
                    Virtual Football
                  </span>
                  <span className="text-[10px] font-medium tracking-tight text-fog leading-none mt-0.5">
                    Sportsbook & Exchange
                  </span>
                </div>
              </div>
            </Link>

            <nav aria-label="Primary" role="navigation" className="hidden md:flex items-center gap-1">
              {NAV.filter((n) => !user?.isAdmin || (n.href !== "/bets" && n.href !== "/wallet")).map(
                (n) => {
                  const active =
                    pathname === n.href || (n.href !== "/" && pathname?.startsWith(n.href));
                  return (
                    <Link
                      key={n.href}
                      href={n.href}
                      aria-current={active ? "page" : undefined}
                      className={`min-h-[34px] inline-flex items-center gap-2 rounded px-3 py-1 text-xs font-semibold tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                        active
                          ? "bg-graphite text-accent border-b-2 border-accent font-bold"
                          : "text-fog hover:text-white hover:bg-graphite/40"
                      }`}
                    >
                      <span>{n.label}</span>
                      {n.href === "/bets" && openBets.length > 0 && (
                        <span className="tnum rounded bg-accent text-ink px-1.5 py-0.2 font-mono text-[10px] font-black">
                          {openBets.length}
                        </span>
                      )}
                    </Link>
                  );
                },
              )}
              {user?.isAdmin && (
                <Link
                  href="/admin"
                  aria-current={pathname?.startsWith("/admin") ? "page" : undefined}
                  className={`min-h-[34px] inline-flex items-center gap-1.5 rounded border px-3 py-1 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    pathname?.startsWith("/admin")
                      ? "border-accent bg-graphite text-accent"
                      : "border-line text-white hover:bg-graphite/50"
                  }`}
                >
                  <span className="live-dot h-1.5 w-1.5 rounded-full bg-accent" />
                  <span>Admin Operations</span>
                </Link>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={() => {
                const event = new KeyboardEvent("keydown", { key: "k", metaKey: true });
                window.dispatchEvent(event);
              }}
              className="hidden lg:flex items-center gap-1.5 rounded border border-line bg-graphite/60 px-2 py-1 text-xs text-fog hover:text-white hover:border-accent/40"
              title="Search commands, clubs, docs (Cmd+K)"
            >
              <svg className="h-3.5 w-3.5 text-fog" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="text-[11px] font-mono">Search</span>
              <kbd className="rounded bg-line px-1 text-[9px] font-mono text-zinc-400">⌘K</kbd>
            </button>
            <AudioToggle />
            <LanguageSelector />
            {user && wallet ? (
              <>
                {user.isAdmin ? (
                  <Link
                    href="/admin"
                    className="flex items-center gap-2 rounded border border-accent/50 bg-graphite px-3 py-1.5 font-mono text-xs font-bold text-accent transition-colors hover:bg-graphite/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <span className="live-dot h-2 w-2 rounded-full bg-accent" />
                    <span>MONITORING ONLY</span>
                  </Link>
                ) : (
                  <Link
                    href="/wallet"
                    className="flex items-center gap-3 rounded border border-line bg-graphite/60 px-3.5 py-1.5 text-xs transition-colors hover:border-accent/40 hover:bg-graphite focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-mono tracking-wider text-fog">Balance</span>
                      <span className="tnum font-mono text-xs font-bold text-accent">
                        {formatMinor(wallet.availableMinor, wallet.currency)}
                      </span>
                    </div>
                    {wallet.reservedMinor > 0 && (
                      <div className="flex flex-col border-l border-line pl-3">
                        <span className="text-[10px] uppercase font-mono tracking-wider text-fog">In Play</span>
                        <span className="tnum font-mono text-xs font-bold text-white">
                          {formatMinor(wallet.reservedMinor, wallet.currency)}
                        </span>
                      </div>
                    )}
                  </Link>
                )}
                <div className="hidden flex-col text-right sm:flex">
                  <Link
                    href="/profile"
                    className="text-xs font-semibold text-white hover:text-accent transition-colors"
                  >
                    {user.displayName}
                  </Link>
                  {user.isAdmin ? (
                    <Link
                      href="/admin"
                      className="font-mono text-[10px] font-bold text-accent hover:underline"
                    >
                      ADMIN CONSOLE →
                    </Link>
                  ) : (
                    <Link
                      href="/profile"
                      className="font-mono text-[10px] text-white/70 hover:text-white"
                    >
                      MY ACCOUNT →
                    </Link>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="rounded border border-line bg-coal px-3 py-1.5 text-xs font-semibold text-fog hover:text-white hover:bg-graphite transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="flex items-center gap-2 rounded bg-accent px-4 py-2 text-xs font-bold text-ink transition-all hover:bg-accent/90 shadow-md shadow-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <span>Join / Log In • 10,000 XTS</span>
                <span>→</span>
              </button>
            )}
          </div>
        </div>

        {/* Dedicated 6-League Selector Bar */}
        {leagues.length > 0 && (
          <div className="b365-subnav px-4 py-1.5">
            <div
              className="mx-auto flex max-w-7xl items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5"
              role="tablist"
              aria-label="European Leagues"
            >
              <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-wider text-accent mr-2 hidden sm:inline">
                SOCCER:
              </span>
              {leagues.map((lg) => {
                const isSelected = lg.id === selectedLeagueId;
                const countryTag = COUNTRY_CODE[lg.country] ?? lg.shortName;
                const leagueLogo = LEAGUE_LOGOS[lg.shortName] || LEAGUE_LOGOS[lg.name];
                return (
                  <button
                    key={lg.id}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => setSelectedLeagueId(lg.id)}
                    className={`shrink-0 inline-flex items-center gap-2 rounded px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                      isSelected
                        ? "bg-graphite text-accent border-b-2 border-accent font-bold shadow-sm"
                        : "text-fog hover:text-white hover:bg-graphite/40 border-b-2 border-transparent"
                    }`}
                  >
                    {leagueLogo ? (
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-white/10 p-0.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={leagueLogo}
                          alt={lg.name}
                          className="h-4 w-4 object-contain"
                          loading="lazy"
                        />
                      </span>
                    ) : (
                      <span className="font-mono text-[10px] font-bold uppercase px-1 py-0.5 rounded bg-black/30 text-white">
                        {countryTag}
                      </span>
                    )}
                    <span>{lg.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <nav
            aria-label="Mobile Navigation Drawer"
            className="md:hidden border-t border-line bg-coal px-4 py-3 shadow-lg"
          >
            <div className="flex flex-col gap-1">
              {NAV.filter((n) => !user?.isAdmin || (n.href !== "/bets" && n.href !== "/wallet")).map(
                (n) => {
                  const active =
                    pathname === n.href || (n.href !== "/" && pathname?.startsWith(n.href));
                  return (
                    <Link
                      key={n.href}
                      href={n.href}
                      onClick={() => setMobileMenuOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center justify-between rounded px-3 py-2 text-xs font-semibold ${
                        active ? "bg-graphite text-accent font-bold" : "text-bone/90 hover:bg-graphite/50"
                      }`}
                    >
                      <span>{n.label}</span>
                      {n.href === "/bets" && openBets.length > 0 && (
                        <span className="rounded bg-accent text-ink px-1.5 py-0.5 font-mono text-[10px] font-bold">
                          {openBets.length}
                        </span>
                      )}
                    </Link>
                  );
                },
              )}
              {user?.isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between rounded px-3 py-2 text-xs font-bold text-accent hover:bg-graphite/50"
                >
                  <span>Admin Operations Console</span>
                  <span className="live-dot h-2 w-2 rounded-full bg-accent" />
                </Link>
              )}
            </div>
          </nav>
        )}
      </header>

      {/* Live Match In-Play Ticker Strip */}
      <LiveTicker />

      {/* Main Content + Persistent Sportsbook Ticket & Open Bets Sidebar */}
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 lg:flex-row lg:items-start">
        <main className="min-w-0 flex-1">{children}</main>
        <div className="w-full lg:sticky lg:top-28 lg:w-[360px] lg:shrink-0">
          <BetslipDrawer />
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-auto border-t border-line bg-coal py-5">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 text-xs text-fog sm:flex-row">
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="text-bone">EUROPEAN VIRTUAL FOOTBALL NETWORK</span>
            <span>•</span>
            <span>EPL • LA LIGA • SERIE A • BUNDESLIGA • LIGUE 1 • EREDIVISIE</span>
          </div>
          <span className="text-[11px]">
            Simulated environment. Test funds only ({slip.length} in slip, {openBets.length} open).
          </span>
        </div>
      </footer>

      {/* Floating Quick Betslip Pill on Mobile */}
      {slip.length > 0 && (
        <aside
          aria-label="Active Bet Slip Quick Bar"
          className="lg:hidden fixed bottom-14 left-0 right-0 z-40 p-3 pointer-events-none"
        >
          <div className="pointer-events-auto mx-auto max-w-md flex items-center justify-between rounded-lg bg-accent px-4 py-2 text-ink shadow-2xl border border-white/20">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ink font-mono text-[11px] font-black text-accent">
                {slip.length}
              </span>
              <span className="font-mono text-xs font-bold uppercase tracking-wide">
                {slip.length === 1 ? "1 Selection" : `${slip.length} Selections`}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs font-black">
                @ {combinedOdds(slip).toFixed(2)}
              </span>
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById("betslip-container");
                  if (el) {
                    el.scrollIntoView({ behavior: "smooth" });
                  }
                }}
                className="rounded bg-ink px-3 py-1 font-mono text-xs font-bold text-accent transition-transform active:scale-95 shadow-sm"
              >
                View Slip ↓
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Betfair-Style Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Mobile Quick Bar"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-line bg-coal/95 py-2 px-2 backdrop-blur-md"
      >
        <Link
          href="/"
          className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold transition-colors ${
            pathname === "/" ? "text-accent" : "text-fog hover:text-bone"
          }`}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span>Matches</span>
        </Link>

        <Link
          href="/table"
          className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold transition-colors ${
            pathname === "/table" ? "text-accent" : "text-fog hover:text-bone"
          }`}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span>Table</span>
        </Link>

        <Link
          href="/bets"
          className={`relative flex flex-col items-center gap-0.5 text-[10px] font-semibold transition-colors ${
            pathname === "/bets" ? "text-accent" : "text-fog hover:text-bone"
          }`}
        >
          {openBets.length > 0 && (
            <span className="absolute -top-1 -right-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-1 font-mono text-[9px] font-black text-ink">
              {openBets.length}
            </span>
          )}
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          <span>My Bets</span>
        </Link>

        <Link
          href="/wallet"
          className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold transition-colors ${
            pathname === "/wallet" ? "text-accent" : "text-fog hover:text-bone"
          }`}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          <span>Wallet</span>
        </Link>

        <Link
          href="/profile"
          className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold transition-colors ${
            pathname === "/profile" ? "text-accent" : "text-fog hover:text-bone"
          }`}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span>Account</span>
        </Link>
      </nav>

      <AuthModal />
      <CommandPalette />
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <AppProvider>
      <ShellInner>{children}</ShellInner>
    </AppProvider>
  );
}
