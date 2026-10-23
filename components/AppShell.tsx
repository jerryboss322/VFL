"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AppProvider, useApp } from "@/components/AppContext";
import { AuthModal } from "@/components/AuthModal";
import { BetslipDrawer } from "@/components/BetslipDrawer";
import { formatMinor } from "@/lib/betslip";
import { LEAGUE_LOGOS } from "@/lib/clubLogos";


const NAV: { href: string; label: string }[] = [
  { href: "/", label: "Match Center" },
  { href: "/table", label: "Standings" },
  { href: "/bets", label: "My Bets" },
  { href: "/wallet", label: "Wallet & Ledger" },
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
    <div className="flex min-h-screen flex-col bg-[#121212] text-bone">
      {/* Top Telemetry Strip */}
      <div className="border-b border-[#005A42] bg-[#014D38] px-4 py-1.5 text-[11px] text-white/90">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 font-mono text-[11px] font-bold tracking-wider text-white">
              <span className="live-dot h-2 w-2 rounded-full bg-[#00E701]" />
              EUROPEAN VIRTUAL FOOTBALL NETWORK
            </span>
            <span className="hidden sm:inline-block h-3 w-px bg-white/20" />
            <span className="hidden sm:inline-block font-mono text-[11px] text-white/80">
              6 Leagues • 116 Clubs
            </span>
          </div>
          <div className="flex items-center gap-3 font-mono text-[11px]">
            <span className="text-white/80">4m Pre-Match • 8m Live</span>
            <span className="rounded bg-[#005A42] border border-white/20 px-2 py-0.5 text-[10px] font-bold tracking-wider text-[#F9DC1C] uppercase">
              Simulated Ledger (XTS)
            </span>
          </div>
        </div>
      </div>

      {/* Main Bet365 Signature Green Navigation Header */}
      <header className="sticky top-0 z-30 b365-header shadow-md">
        <div className="mx-auto flex min-h-[58px] max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-2">
          <div className="flex items-center gap-6 lg:gap-8">
            <Link href="/" className="group flex items-center gap-2.5">
              <div className="flex items-center">
                <span className="text-xl font-black italic tracking-tighter text-white">
                  bet<span className="text-[#F9DC1C]">365</span>
                </span>
                <span className="ml-2 rounded bg-[#014D38] px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#F9DC1C] border border-[#F9DC1C]/30">
                  VFL
                </span>
              </div>
            </Link>

            <nav aria-label="Primary" className="hidden md:flex items-center gap-1">
              {NAV.filter((n) => !user?.isAdmin || (n.href !== "/bets" && n.href !== "/wallet")).map(
                (n) => {
                  const active =
                    pathname === n.href || (n.href !== "/" && pathname?.startsWith(n.href));
                  return (
                    <Link
                      key={n.href}
                      href={n.href}
                      className={`min-h-[34px] inline-flex items-center gap-2 rounded px-3 py-1 text-xs font-semibold tracking-wide transition-colors ${
                        active
                          ? "bg-[#014D38] text-white border-b-2 border-[#F9DC1C] font-bold"
                          : "text-white/80 hover:text-white hover:bg-[#005A42]/60"
                      }`}
                    >
                      <span>{n.label}</span>
                      {n.href === "/bets" && openBets.length > 0 && (
                        <span className="tnum rounded bg-[#F9DC1C] text-[#121212] px-1.5 py-0.2 font-mono text-[10px] font-black">
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
                  className={`min-h-[34px] inline-flex items-center gap-1.5 rounded border px-3 py-1 text-xs font-bold transition-colors ${
                    pathname?.startsWith("/admin")
                      ? "border-[#F9DC1C] bg-[#014D38] text-[#F9DC1C]"
                      : "border-white/20 text-white hover:bg-[#005A42]"
                  }`}
                >
                  <span className="live-dot h-1.5 w-1.5 rounded-full bg-[#F9DC1C]" />
                  <span>Admin Operations</span>
                </Link>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {user && wallet ? (
              <>
                {user.isAdmin ? (
                  <Link
                    href="/admin"
                    className="flex items-center gap-2 rounded border border-[#F9DC1C]/50 bg-[#014D38] px-3 py-1.5 font-mono text-xs font-bold text-[#F9DC1C] transition-colors hover:bg-[#005A42]"
                  >
                    <span className="live-dot h-2 w-2 rounded-full bg-[#F9DC1C]" />
                    <span>MONITORING ONLY</span>
                  </Link>
                ) : (
                  <Link
                    href="/wallet"
                    className="flex items-center gap-3 rounded border border-white/20 bg-[#014D38] px-3.5 py-1.5 text-xs transition-colors hover:bg-[#005A42]"
                  >
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-mono tracking-wider text-white/70">Balance</span>
                      <span className="tnum font-mono text-xs font-bold text-[#F9DC1C]">
                        {formatMinor(wallet.availableMinor, wallet.currency)}
                      </span>
                    </div>
                    {wallet.reservedMinor > 0 && (
                      <div className="flex flex-col border-l border-white/20 pl-3">
                        <span className="text-[10px] uppercase font-mono tracking-wider text-white/70">In Play</span>
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
                    className="text-xs font-semibold text-white hover:text-[#F9DC1C] transition-colors"
                  >
                    {user.displayName}
                  </Link>
                  {user.isAdmin ? (
                    <Link
                      href="/admin"
                      className="font-mono text-[10px] font-bold text-[#F9DC1C] hover:underline"
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
                  className="rounded border border-white/20 bg-[#014D38] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#005A42] transition-colors"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="flex items-center gap-2 rounded bg-[#F9DC1C] px-4 py-2 text-xs font-bold text-[#121212] transition-colors hover:bg-[#FFDF00] shadow-sm"
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
              <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-wider text-[#F9DC1C] mr-2 hidden sm:inline">
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
                    className={`shrink-0 inline-flex items-center gap-2 rounded px-3 py-1 text-xs font-medium transition-colors ${
                      isSelected
                        ? "bg-[#027B5B] text-white border-b-2 border-[#F9DC1C] font-bold"
                        : "text-white/80 hover:text-white hover:bg-white/10 border-b-2 border-transparent"
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
      </header>

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

      <AuthModal />
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
