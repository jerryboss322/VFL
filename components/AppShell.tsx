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
    <div className="flex min-h-screen flex-col bg-[#0F212E] text-bone">
      {/* Top Broadcast Telemetry Strip */}
      <div className="border-b border-[#213743] bg-[#0A161E] px-4 py-2 text-[11px]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 text-fog">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 font-mono text-[11px] font-semibold tracking-wider text-bone/90">
              <span className="live-dot h-2 w-2 rounded-full bg-win" />
              EUROPEAN VIRTUAL FOOTBALL NETWORK
            </span>
            <span className="hidden sm:inline-block h-3 w-px bg-[#213743]" />
            <span className="hidden sm:inline-block font-mono text-[11px] text-fog">
              6 Leagues • 116 Clubs
            </span>
          </div>
          <div className="flex items-center gap-3 font-mono text-[11px]">
            <span className="text-fog">4m Pre-Match • 8m Live</span>
            <span className="rounded bg-[#1A2C38] border border-[#2F4553] px-2.5 py-0.5 text-[10px] font-bold tracking-widest text-fog uppercase">
              Simulated Ledger (XTS)
            </span>
          </div>
        </div>
      </div>

      {/* Main Navigation Header */}
      <header className="sticky top-0 z-30 border-b border-[#213743] bg-[#1A2C38]">
        <div className="mx-auto flex min-h-[68px] max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-2">
          <div className="flex items-center gap-6 lg:gap-8">
            <Link href="/" className="group flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded bg-[#1475E1]">
                <span className="font-mono text-xs font-black tracking-tighter text-white">
                  VFN
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold tracking-tight text-white">
                  VIRTUAL FOOTBALL
                </span>
                <span className="font-mono text-[9px] uppercase tracking-wider text-fog">
                  European Exchange
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
                      className={`min-h-[34px] inline-flex items-center gap-2 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                        active
                          ? "bg-[#213743] text-white font-bold"
                          : "text-fog hover:text-white hover:bg-[#213743]/50"
                      }`}
                    >
                      <span>{n.label}</span>
                      {n.href === "/bets" && openBets.length > 0 && (
                        <span className="tnum rounded bg-[#1475E1] text-white px-1.5 py-0.2 font-mono text-[10px] font-bold">
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
                  className={`min-h-[34px] inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-bold transition-colors ${
                    pathname?.startsWith("/admin")
                      ? "border-[#1475E1] bg-[#10355A] text-[#1475E1]"
                      : "border-[#2F4553] text-[#1475E1] hover:bg-[#213743]"
                  }`}
                >
                  <span className="live-dot h-1.5 w-1.5 rounded-full bg-[#1475E1]" />
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
                    className="flex items-center gap-2 rounded-xl border border-peach/40 bg-peach/10 px-3.5 py-2 font-mono text-xs font-bold text-peach transition-all hover:bg-peach/20"
                  >
                    <span className="live-dot h-2 w-2 rounded-full bg-peach" />
                    <span>MONITORING ONLY (NO BETTING)</span>
                  </Link>
                ) : (
                  <Link
                    href="/wallet"
                    className="flex items-center gap-3.5 rounded-xl border border-white/10 bg-coal/70 px-4 py-2 text-xs transition-all hover:border-peach/40 hover:bg-coal shadow-sm"
                  >
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-mono tracking-wider text-fog/70">Available</span>
                      <span className="tnum font-mono text-xs font-bold text-bone">
                        {formatMinor(wallet.availableMinor, wallet.currency)}
                      </span>
                    </div>
                    {wallet.reservedMinor > 0 && (
                      <div className="flex flex-col border-l border-white/10 pl-3.5">
                        <span className="text-[10px] uppercase font-mono tracking-wider text-fog/70">In Play</span>
                        <span className="tnum font-mono text-xs font-bold text-peach">
                          {formatMinor(wallet.reservedMinor, wallet.currency)}
                        </span>
                      </div>
                    )}
                  </Link>
                )}
                <div className="hidden flex-col text-right sm:flex">
                  <Link
                    href="/profile"
                    className="text-xs font-medium text-white hover:text-[#1475E1] transition-colors"
                  >
                    {user.displayName}
                  </Link>
                  {user.isAdmin ? (
                    <Link
                      href="/admin"
                      className="font-mono text-[10px] font-bold text-[#1475E1] hover:underline"
                    >
                      ADMIN CONSOLE →
                    </Link>
                  ) : (
                    <Link
                      href="/profile"
                      className="font-mono text-[10px] text-fog hover:text-white"
                    >
                      TRADER PROFILE →
                    </Link>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="rounded border border-[#2F4553] bg-[#0F212E] px-3.5 py-1.5 text-xs font-medium text-fog hover:text-white hover:bg-[#213743] transition-colors"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="flex items-center gap-2 rounded bg-[#1475E1] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#0E5BB8]"
              >
                <span>Sign In • Claim 10,000 XTS</span>
                <span>→</span>
              </button>
            )}
          </div>
        </div>

        {/* Dedicated 6-League Selector Bar */}
        {leagues.length > 0 && (
          <div className="border-t border-[#213743] bg-[#0F212E] px-4 py-1.5">
            <div
              className="mx-auto flex max-w-7xl items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5"
              role="tablist"
              aria-label="European Leagues"
            >
              <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-wider text-fog mr-1 hidden sm:inline">
                COMPETITION:
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
                    className={`shrink-0 inline-flex items-center gap-2 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                      isSelected
                        ? "bg-[#1A2C38] text-white border border-[#2F4553] font-bold"
                        : "text-fog hover:text-white hover:bg-[#1A2C38]/50 border border-transparent"
                    }`}
                  >
                    {leagueLogo ? (
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[#0F212E] p-0.5 border border-[#213743]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={leagueLogo}
                          alt={lg.name}
                          className="h-4 w-4 object-contain"
                          loading="lazy"
                        />
                      </span>
                    ) : (
                      <span className="font-mono text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-[#1A2C38] border border-[#213743] text-white">
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
