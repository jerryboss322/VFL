"use client";

import React, { useState } from "react";
import { formatMinor } from "@/lib/betslip";

export interface LedgerAuditRow {
  id: string;
  timestamp: string;
  walletId: string;
  kind: "initial_grant" | "stake_reserve" | "settlement_win" | "settlement_loss" | "bet_void_refund";
  amountMinor: number;
  balanceAfterMinor: number;
  idempotencyKey?: string;
  notes?: string;
}

interface LedgerAuditTableProps {
  entries: LedgerAuditRow[];
}

export function LedgerAuditTable({ entries }: LedgerAuditTableProps) {
  const [filterKind, setFilterKind] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");

  const filteredEntries = entries.filter((row) => {
    if (filterKind !== "ALL" && row.kind !== filterKind) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        row.id.toLowerCase().includes(q) ||
        row.walletId.toLowerCase().includes(q) ||
        (row.idempotencyKey && row.idempotencyKey.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="rounded-xl border border-line bg-graphite overflow-hidden shadow-sm">
      <div className="p-4 border-b border-line flex flex-wrap items-center justify-between gap-4 bg-charcoal/50">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold uppercase text-fog">Transaction Filter:</span>
          <select
            value={filterKind}
            onChange={(e) => setFilterKind(e.target.value)}
            className="rounded bg-line px-2.5 py-1 text-xs text-white border border-line/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          >
            <option value="ALL">All Event Kinds</option>
            <option value="initial_grant">Initial Grants</option>
            <option value="stake_reserve">Stake Reserves</option>
            <option value="settlement_win">Settlement Wins</option>
            <option value="settlement_loss">Settlement Losses</option>
            <option value="bet_void_refund">Void Refunds</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search wallet ID / hash / key..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="rounded bg-line px-3 py-1 text-xs text-white placeholder-fog border border-line/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent w-56 sm:w-64"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-line bg-charcoal text-[11px] font-mono uppercase text-fog">
            <tr>
              <th className="px-4 py-3">Timestamp (UTC)</th>
              <th className="px-4 py-3">Ledger Event ID</th>
              <th className="px-4 py-3">Wallet ID</th>
              <th className="px-4 py-3">Event Kind</th>
              <th className="px-4 py-3 text-right">Debit / Credit</th>
              <th className="px-4 py-3 text-right">Balance After</th>
              <th className="px-4 py-3">Idempotency Key</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60 font-mono">
            {filteredEntries.map((row) => {
              const isCredit = row.amountMinor > 0;
              const isZero = row.amountMinor === 0;

              return (
                <tr key={row.id} className="hover:bg-line/20 transition">
                  <td className="px-4 py-3 text-fog whitespace-nowrap">{row.timestamp}</td>
                  <td className="px-4 py-3 text-bone font-medium">{row.id}</td>
                  <td className="px-4 py-3 text-fog">{row.walletId}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold ${
                        row.kind === "initial_grant"
                          ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                          : row.kind === "settlement_win"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : row.kind === "stake_reserve"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : row.kind === "bet_void_refund"
                          ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                          : "bg-zinc-500/20 text-zinc-300 border border-zinc-500/30"
                      }`}
                    >
                      {row.kind.toUpperCase()}
                    </span>
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-bold whitespace-nowrap ${
                      isZero
                        ? "text-fog"
                        : isCredit
                        ? "text-emerald-400"
                        : "text-amber-400"
                    }`}
                  >
                    {isZero
                      ? "0.00 XTS"
                      : isCredit
                      ? `+${formatMinor(row.amountMinor)} XTS`
                      : `${formatMinor(row.amountMinor)} XTS`}
                  </td>
                  <td className="px-4 py-3 text-right text-bone font-semibold whitespace-nowrap">
                    {formatMinor(row.balanceAfterMinor)} XTS
                  </td>
                  <td className="px-4 py-3 text-fog truncate max-w-[140px]" title={row.idempotencyKey}>
                    {row.idempotencyKey ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="p-3 border-t border-line bg-charcoal/30 flex items-center justify-between text-xs text-fog">
        <span>Showing {filteredEntries.length} of {entries.length} audited ledger transactions</span>
        <span className="font-mono">Invariants: Σ(Amounts) = Wallet Balance • Non-negative Balances</span>
      </div>
    </div>
  );
}
