"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AppProvider, useApp } from "@/components/AppContext";
import { AuthModal } from "@/components/AuthModal";
import { BetslipDrawer } from "@/components/BetslipDrawer";
import { formatMinor } from "@/lib/betslip";

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
    <div className="flex min-h-screen flex-col bg-[#080B11]">
      {/* Top Broadcast Telemetry Strip */}
      <div className="border-b border-white/[0.06] bg-ink/90 px-4 py-2 text-[11px] backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 text-fog">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 font-mono text-[11px] font-semibold tracking-wider text-bone/90">
              <span className="live-dot h-2 w-2 rounded-full bg-win" />
              EUROPEAN VIRTUAL FOOTBALL NETWORK
            </span>
            <span className="hidden sm:inline-block h-3 w-px bg-white/10" />
            <span className="hidden sm:inline-block font-mono text-[11px] text-fog/70">
              6 Leagues • 116 Clubs
            </span>
          </div>
          <div className="flex items-center gap-3 font-mono text-[11px]">
            <span className="text-fog/80">4m Pre-Match • 8m Live</span>
            <span className="rounded-full border border-peach/30 bg-peach/10 px-2.5 py-0.5 text-[10px] font-bold tracking-widest text-peach uppercase shadow-xs">
              Simulated Ledger (XTS)
            </span>
          </div>
        </div>
      </div>

      {/* Main Navigation Header */}
      <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#0c121d]/90 backdrop-blur-xl shadow-lg shadow-black/20">
        <div className="mx-auto flex min-h-[68px] max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-2">
          <div className="flex items-center gap-6 lg:gap-8">
            <Link href="/" className="group flex items-center gap-3 transition-transform hover:scale-[1.02]">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-peach to-sky-600 p-[1px] shadow-md shadow-peach/20">
                <div className="flex h-full w-full items-center justify-center rounded-[11px] bg-coal">
                  <span className="font-mono text-xs font-black tracking-tighter text-peach">
                    VFN
                  </span>
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-extrabold tracking-tight text-bone group-hover:text-white transition-colors">
                  VIRTUAL <span className="bg-gradient-to-r from-peach to-sky-300 bg-clip-text text-transparent">FOOTBALL</span>
                </span>
                <span className="font-mono text-[9px] uppercase tracking-widest text-fog/70">
                  European Exchange
                </span>
              </div>
            </Link>

            <nav aria-label="Primary" className="hidden md:flex items-center gap-1.5">
              {NAV.filter((n) => !user?.isAdmin || (n.href !== "/bets" && n.href !== "/wallet")).map(
                (n) => {
                  const active =
                    pathname === n.href || (n.href !== "/" && pathname?.startsWith(n.href));
                  return (
                    <Link
                      key={n.href}
                      href={n.href}
                      className={`min-h-[38px] inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-semibold tracking-wide transition-all ${
                        active
                          ? "bg-peach/15 text-peach border border-peach/30 shadow-xs shadow-peach/20 font-bold"
                          : "text-fog hover:text-bone hover:bg-white/[0.04]"
                      }`}
                    >
                      <span>{n.label}</span>
                      {n.href === "/bets" && openBets.length > 0 && (
                        <span className="tnum rounded-full bg-peach text-ink px-1.5 py-0.2 font-mono text-[10px] font-extrabold">
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
                  className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-xs font-bold tracking-wide transition-all ${
                    pathname?.startsWith("/admin")
                      ? "border-peach bg-peach-dim text-peach shadow-md shadow-peach/20"
                      : "border-peach/30 bg-peach/10 text-peach hover:bg-peach/20"
                  }`}
                >
                  <span className="live-dot h-1.5 w-1.5 rounded-full bg-peach" />
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
                    className="text-xs font-medium text-bone hover:text-peach transition-colors"
                  >
                    {user.displayName}
                  </Link>
                  {user.isAdmin ? (
                    <Link
                      href="/admin"
                      className="font-mono text-[10px] font-bold text-peach hover:underline"
                    >
                      ADMIN CONSOLE →
                    </Link>
                  ) : (
                    <Link
                      href="/profile"
                      className="font-mono text-[10px] text-fog/80 hover:text-bone"
                    >
                      TRADER PROFILE →
                    </Link>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="rounded-xl border border-white/10 bg-graphite/70 px-3.5 py-1.5 text-xs font-medium text-fog hover:border-loss/40 hover:text-loss transition-colors"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="group relative flex items-center gap-2 rounded-xl bg-gradient-to-r from-peach to-sky-400 px-4 py-2.5 text-xs font-bold text-ink shadow-md shadow-peach/25 transition-all hover:brightness-110 active:scale-[0.98]"
              >
                <span>Sign In • Claim 10,000 XTS</span>
                <span className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
              </button>
            )}
          </div>
        </div>

        {/* Dedicated 6-League Selector Bar */}
        {leagues.length > 0 && (
          <div className="border-t border-white/[0.06] bg-coal/70 px-4 py-2 backdrop-blur-md">
            <div
              className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto no-scrollbar py-0.5"
              role="tablist"
              aria-label="European Leagues"
            >
              <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-widest text-fog/60 mr-1 hidden sm:inline">
                COMPETITION:
              </span>
              {leagues.map((lg) => {
                const isSelected = lg.id === selectedLeagueId;
                const countryTag = COUNTRY_CODE[lg.country] ?? lg.shortName;
                return (
                  <button
                    key={lg.id}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => setSelectedLeagueId(lg.id)}
                    className={`shrink-0 inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-medium transition-all ${
                      isSelected
                        ? "bg-peach/20 text-peach border border-peach/40 shadow-xs font-bold"
                        : "text-fog hover:text-bone hover:bg-white/[0.04] border border-transparent"
                    }`}
                  >
                    <span className="font-mono text-[10px] font-black uppercase px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-bone/90">
                      {countryTag}
                    </span>
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
