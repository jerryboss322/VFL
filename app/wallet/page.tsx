"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/AppContext";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { StatePanel } from "@/components/StatePanel";
import { api } from "@/lib/api/client";
import { formatMinor } from "@/lib/betslip";
import type { Transaction } from "@/types/api";

export default function WalletPage() {
  const { user, wallet, setAuthModalOpen, refreshAccount, betPlacedCounter } = useApp();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userId = user?.id ?? null;

  const fetchTransactionsOnly = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    const res = await api.wallet.transactions();
    if (!res.ok) {
      const f = res.failure;
      setError(f.kind === "network" ? f.message : `${f.error.code}: ${f.error.message}`);
    } else {
      setTransactions(res.data);
      setError(null);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void fetchTransactionsOnly();
  }, [fetchTransactionsOnly, betPlacedCounter]);

  async function handleManualRefresh() {
    setRefreshing(true);
    await refreshAccount();
    await fetchTransactionsOnly();
    setRefreshing(false);
  }

  if (!user) {
    return (
      <div className="rounded-card border border-line bg-coal p-6">
        <p className="text-sm font-medium text-bone">Sign in to view your wallet &amp; ledger</p>
        <p className="mt-1 text-xs text-fog">
          New accounts automatically receive 10,000.00 XTS in simulated test funds.
        </p>
        <button
          type="button"
          onClick={() => setAuthModalOpen(true)}
          className="mt-4 min-h-[44px] rounded-control bg-peach px-4 py-2 text-xs font-semibold text-ink"
        >
          Sign In / Claim 10,000 XTS
        </button>
      </div>
    );
  }

  if (user.isAdmin) {
    return (
      <div className="rounded-card border border-peach/40 bg-coal p-6">
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-peach">
          OPERATOR MONITORING ACCOUNT
        </span>
        <h1 className="mt-1 text-base font-bold text-bone">
          Personal Betting Wallet Disabled for Administrators
        </h1>
        <p className="mt-1 text-xs text-fog">
          Signed in as <strong className="text-bone">{user.email}</strong>. Administrators only monitor global trader wallets and the platform double-entry ledger from the Admin Operations Console.
        </p>
        <a
          href="/admin"
          className="mt-4 inline-flex min-h-[40px] items-center rounded-control bg-peach px-4 py-2 font-mono text-xs font-bold uppercase text-ink"
        >
          Open Global Ledger in Admin Console →
        </a>
      </div>
    );
  }

  const available = wallet?.availableMinor ?? 0;
  const reserved = wallet?.reservedMinor ?? 0;
  const totalEquity = available + reserved;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Wallet & Ledger" }]} />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-card border border-line bg-coal p-4">
          <p className="font-mono text-[11px] uppercase tracking-wider text-fog">
            Available Balance
          </p>
          <p className="tnum mt-1.5 font-mono text-xl font-bold text-bone">
            {formatMinor(available)}
          </p>
          <p className="mt-1 text-[11px] text-fog">Ready for new wagers</p>
        </div>

        <div className="rounded-card border border-line bg-coal p-4">
          <p className="font-mono text-[11px] uppercase tracking-wider text-fog">
            Reserved in Active Bets
          </p>
          <p className="tnum mt-1.5 font-mono text-xl font-bold text-peach">
            {formatMinor(reserved)}
          </p>
          <p className="mt-1 text-[11px] text-fog">Locked until match completion</p>
        </div>

        <div className="rounded-card border border-line bg-coal p-4">
          <p className="font-mono text-[11px] uppercase tracking-wider text-fog">
            Total Simulated Equity
          </p>
          <p className="tnum mt-1.5 font-mono text-xl font-bold text-bone">
            {formatMinor(totalEquity)}
          </p>
          <p className="mt-1 text-[11px] text-fog">Simulated currency (XTS)</p>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-bone">
            Immutable Financial Ledger
          </h2>
          <button
            type="button"
            disabled={refreshing}
            onClick={() => void handleManualRefresh()}
            className="min-h-[34px] rounded-control border border-line bg-coal px-3 py-1 font-mono text-xs text-peach transition-colors hover:border-peach disabled:opacity-50"
          >
            {refreshing ? "Refreshing..." : "Refresh Ledger"}
          </button>
        </div>

        {loading ? (
          <StatePanel tone="loading" title="Loading ledger entries..." />
        ) : error ? (
          <StatePanel tone="error" title="Could not load ledger" detail={error} />
        ) : transactions.length === 0 ? (
          <StatePanel tone="empty" title="No ledger entries recorded." />
        ) : (
          <div className="overflow-x-auto rounded-card border border-line bg-coal">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-line bg-graphite/60 font-mono text-[11px] uppercase text-fog">
                  <th className="px-4 py-3 font-medium">Timestamp</th>
                  <th className="px-4 py-3 font-medium">Entry Type</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 text-right font-medium">Delta</th>
                  <th className="px-4 py-3 text-right font-medium">Balance After</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {transactions.map((tx) => {
                  const isPositive = tx.amountMinor > 0;
                  const isNegative = tx.amountMinor < 0;
                  return (
                    <tr key={tx.id} className="hover:bg-graphite/30">
                      <td className="tnum whitespace-nowrap px-4 py-3 font-mono text-fog">
                        {new Date(tx.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-control bg-graphite px-2 py-0.5 font-mono text-[11px] text-bone">
                          {tx.kind}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-bone">{tx.description}</td>
                      <td
                        className={`tnum whitespace-nowrap px-4 py-3 text-right font-mono font-semibold ${
                          isPositive
                            ? "text-win"
                            : isNegative
                              ? "text-peach"
                              : "text-fog"
                        }`}
                      >
                        {isPositive ? "+" : ""}
                        {formatMinor(tx.amountMinor)}
                      </td>
                      <td className="tnum whitespace-nowrap px-4 py-3 text-right font-mono text-bone">
                        {tx.balanceAfterMinor !== undefined && tx.balanceAfterMinor !== null
                          ? formatMinor(tx.balanceAfterMinor)
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
