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
    <div className="flex min-h-screen flex-col bg-ink">
      {/* Top Broadcast Telemetry Strip */}
      <div className="border-b border-line bg-ink px-4 py-1.5 text-[11px]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 text-fog">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 font-mono font-semibold uppercase tracking-wider text-bone">
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-win" />
              EUROPEAN VIRTUAL FOOTBALL NETWORK • 6 LEAGUES • 116 CLUBS
            </span>
          </div>
          <div className="flex items-center gap-3 font-mono">
            <span>4m Pre-Match Window • 8m Live Match</span>
            <span className="rounded-control border border-line bg-coal px-2 py-0.5 text-[10px] uppercase tracking-wider text-peach">
              SIMULATED LEDGER (XTS)
            </span>
          </div>
        </div>
      </div>

      {/* Main Navigation Header */}
      <header className="sticky top-0 z-30 border-b border-line bg-coal">
        <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-2.5">
          <div className="flex items-center gap-8">
            <Link href="/" className="group flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-control border border-peach/40 bg-peach-dim font-mono text-xs font-bold text-peach">
                VFN
              </span>
              <div className="flex flex-col">
                <span className="text-sm font-bold tracking-tight text-bone">
                  VIRTUAL <span className="text-peach">FOOTBALL</span>
                </span>
                <span className="font-mono text-[10px] uppercase tracking-widest text-fog">
                  EUROPEAN EXCHANGE
                </span>
              </div>
            </Link>

            <nav aria-label="Primary" className="flex items-center gap-1">
              {NAV.filter((n) => !user?.isAdmin || (n.href !== "/bets" && n.href !== "/wallet")).map(
                (n) => {
                  const active =
                    pathname === n.href || (n.href !== "/" && pathname?.startsWith(n.href));
                  return (
                    <Link
                      key={n.href}
                      href={n.href}
                      className={`min-h-[40px] inline-flex items-center gap-1.5 rounded-control border px-3.5 py-1.5 text-xs font-medium tracking-wide transition-colors ${
                        active
                          ? "border-peach/50 bg-peach-dim text-peach"
                          : "border-transparent text-fog hover:border-line hover:bg-graphite hover:text-bone"
                      }`}
                    >
                      <span>{n.label}</span>
                      {n.href === "/bets" && openBets.length > 0 && (
                        <span className="tnum rounded-control bg-ink px-1.5 py-0.5 font-mono text-[10px] font-bold text-peach">
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
                  className={`min-h-[40px] inline-flex items-center gap-1.5 rounded-control border px-3.5 py-1.5 font-mono text-xs font-bold tracking-wide transition-colors ${
                    pathname?.startsWith("/admin")
                      ? "border-peach bg-peach-dim text-peach"
                      : "border-peach/40 bg-coal text-peach hover:bg-peach-dim"
                  }`}
                >
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
                    className="flex items-center gap-2 rounded-control border border-peach/50 bg-peach-dim px-3.5 py-2 font-mono text-xs font-bold text-peach transition-opacity hover:opacity-90"
                  >
                    <span className="live-dot h-2 w-2 rounded-full bg-peach" />
                    <span>MONITORING ONLY (NO BETTING)</span>
                  </Link>
                ) : (
                  <Link
                    href="/wallet"
                    className="flex items-center gap-3 rounded-control border border-line bg-graphite px-3.5 py-2 text-xs transition-colors hover:border-peach/60"
                  >
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-wider text-fog">Available</span>
                      <span className="tnum font-mono text-xs font-bold text-bone">
                        {formatMinor(wallet.availableMinor, wallet.currency)}
                      </span>
                    </div>
                    {wallet.reservedMinor > 0 && (
                      <div className="flex flex-col border-l border-line pl-3">
                        <span className="text-[10px] uppercase tracking-wider text-fog">In Play</span>
                        <span className="tnum font-mono text-xs font-semibold text-peach">
                          {formatMinor(wallet.reservedMinor, wallet.currency)}
                        </span>
                      </div>
                    )}
                  </Link>
                )}
                <div className="hidden flex-col text-right sm:flex">
                  <Link
                    href="/profile"
                    className="text-xs font-medium text-bone transition-colors hover:text-peach"
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
                      className="font-mono text-[10px] text-fog hover:text-bone"
                    >
                      TRADER PROFILE →
                    </Link>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="min-h-[40px] rounded-control border border-line bg-graphite px-3 py-1.5 text-xs font-medium text-fog transition-colors hover:border-fog hover:text-bone"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="min-h-[40px] rounded-control bg-peach px-4 py-2 text-xs font-bold tracking-wide text-ink transition-opacity hover:opacity-90"
              >
                Sign In • Claim 10,000 XTS
              </button>
            )}
          </div>
        </div>

        {/* Dedicated 6-League Selector Bar */}
        {leagues.length > 0 && (
          <div className="border-t border-line bg-ink/70">
            <div
              className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto px-4 py-2"
              role="tablist"
              aria-label="European Leagues"
            >
              <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-widest text-fog">
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
                    className={`min-h-[36px] shrink-0 inline-flex items-center gap-2 rounded-control border px-3 py-1 text-xs font-medium transition-colors ${
                      isSelected
                        ? "border-peach bg-peach-dim text-peach"
                        : "border-line bg-coal text-fog hover:border-fog/60 hover:text-bone"
                    }`}
                  >
                    <span
                      className={`rounded-control px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                        isSelected ? "bg-ink text-peach" : "bg-graphite text-fog"
                      }`}
                    >
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
