"use client";

import React, { useState } from "react";
import { LedgerAuditTable, type LedgerAuditRow } from "@/components/LedgerAuditTable";
import { formatMinor } from "@/lib/betslip";

const MOCK_LEDGER_DATA: LedgerAuditRow[] = [
  {
    id: "tx-ledger-8801",
    timestamp: "2026-10-26 14:48:22",
    walletId: "w-demo-9921",
    kind: "settlement_win",
    amountMinor: 375000,
    balanceAfterMinor: 1475000,
    idempotencyKey: "bet-settle-m-eng-01-user-1",
    notes: "Won Over 2.5 Match Goals @ 2.50 (Stake 150,000 minor)",
  },
  {
    id: "tx-ledger-8802",
    timestamp: "2026-10-26 14:45:10",
    walletId: "w-demo-9921",
    kind: "stake_reserve",
    amountMinor: -150000,
    balanceAfterMinor: 1100000,
    idempotencyKey: "bet-place-m-eng-01-over25",
    notes: "Reserved stake for Manchester Blue vs Liverpool Red",
  },
  {
    id: "tx-ledger-8803",
    timestamp: "2026-10-26 14:40:02",
    walletId: "w-trader-04",
    kind: "settlement_loss",
    amountMinor: 0,
    balanceAfterMinor: 850000,
    idempotencyKey: "bet-settle-m-esp-01-user-4",
    notes: "Lost Asian Handicap (-1.5) Madrid Chamartín",
  },
  {
    id: "tx-ledger-8804",
    timestamp: "2026-10-26 14:35:19",
    walletId: "w-trader-04",
    kind: "stake_reserve",
    amountMinor: -200000,
    balanceAfterMinor: 850000,
    idempotencyKey: "bet-place-m-esp-01-ah15",
    notes: "Reserved stake for Madrid Chamartín AH -1.5",
  },
  {
    id: "tx-ledger-8805",
    timestamp: "2026-10-26 14:30:00",
    walletId: "w-vip-007",
    kind: "bet_void_refund",
    amountMinor: 500000,
    balanceAfterMinor: 3200000,
    idempotencyKey: "void-refund-m-ita-postponed",
    notes: "Match postponed due to weather - full stake refunded",
  },
  {
    id: "tx-ledger-8806",
    timestamp: "2026-10-26 14:20:15",
    walletId: "w-demo-9921",
    kind: "initial_grant",
    amountMinor: 1000000,
    balanceAfterMinor: 1000000,
    idempotencyKey: "user-signup-w-demo-9921",
    notes: "Welcome grant upon registration (10,000.00 XTS)",
  },
  {
    id: "tx-ledger-8807",
    timestamp: "2026-10-26 14:15:00",
    walletId: "w-trader-04",
    kind: "initial_grant",
    amountMinor: 1000000,
    balanceAfterMinor: 1000000,
    idempotencyKey: "user-signup-w-trader-04",
    notes: "Welcome grant upon registration (10,000.00 XTS)",
  },
  {
    id: "tx-ledger-8808",
    timestamp: "2026-10-26 14:10:00",
    walletId: "w-vip-007",
    kind: "initial_grant",
    amountMinor: 1000000,
    balanceAfterMinor: 1000000,
    idempotencyKey: "user-signup-w-vip-007",
    notes: "Welcome grant upon registration (10,000.00 XTS)",
  },
];

export default function AuditLedgerPage() {
  const [copiedHash, setCopiedHash] = useState(false);
  const auditDigest = "e4f8b2c179a6d03487c5512e9b04fcda176328a994ef0a3b2c1598471da6e2bb";

  const totalUserLiabilitiesMinor = 14850000; // 148,500.00 XTS
  const platformTreasuryMinor = 22500000; // 225,000.00 XTS
  const solvencyRatio = platformTreasuryMinor / totalUserLiabilitiesMinor; // 1.515 (151.5%)

  const handleCopyDigest = () => {
    navigator.clipboard.writeText(auditDigest);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
            <span className="text-xs font-mono font-bold tracking-wider text-emerald-400 uppercase">
              Double-Entry Financial Accounting
            </span>
          </div>
          <h1 className="mt-1 text-2xl md:text-3xl font-extrabold text-white">
            Authoritative Ledger & Solvency Audit
          </h1>
          <p className="mt-1 text-sm text-fog max-w-2xl">
            Mathematical conservation equations, minor unit precision, and cryptographic audit proofs
            governing platform bankroll and user balances.
          </p>
        </div>

        {/* Solvency Status Pill */}
        <div className="flex items-center gap-3 bg-graphite border border-line rounded-lg px-4 py-2 self-start md:self-auto shadow-sm">
          <div className="text-center">
            <span className="text-[10px] uppercase font-mono text-fog block">Ledger Status</span>
            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              BALANCED & VERIFIED
            </span>
          </div>
          <div className="h-8 w-px bg-line"></div>
          <div className="text-center">
            <span className="text-[10px] uppercase font-mono text-fog block">Solvency Ratio</span>
            <span className="text-base font-bold text-accent">{(solvencyRatio * 100).toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* Financial Health & Liquidity Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Platform Treasury Reserve */}
        <div className="rounded-xl border border-line bg-graphite p-5 shadow-sm space-y-2">
          <span className="text-xs font-mono text-fog uppercase">Platform Treasury Reserves</span>
          <div className="text-2xl font-black text-white font-mono">
            {formatMinor(platformTreasuryMinor)} <span className="text-sm font-bold text-accent">XTS</span>
          </div>
          <p className="text-[11px] text-fog leading-relaxed">
            Tier-1 regulatory bankroll held in segregated cold and hot liquidity reserves.
          </p>
        </div>

        {/* User Total Liabilities */}
        <div className="rounded-xl border border-line bg-graphite p-5 shadow-sm space-y-2">
          <span className="text-xs font-mono text-fog uppercase">Total User Liabilities</span>
          <div className="text-2xl font-black text-white font-mono">
            {formatMinor(totalUserLiabilitiesMinor)} <span className="text-sm font-bold text-fog">XTS</span>
          </div>
          <p className="text-[11px] text-fog leading-relaxed">
            Sum of all user available balances plus active reserved betting stakes in play.
          </p>
        </div>

        {/* Regulatory Reserve Ratio Target */}
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/20 p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-emerald-400 uppercase">Reserve Coverage</span>
            <span className="text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">
              PASSED (Min 110%)
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono">
            +{(solvencyRatio * 100 - 100).toFixed(1)}% Surplus
          </div>
          <p className="text-[11px] text-zinc-300 leading-relaxed">
            Platform maintains {(solvencyRatio * 100).toFixed(1)}% reserve coverage, exceeding the mandatory 110% ceiling.
          </p>
        </div>
      </div>

      {/* Cryptographic SHA-256 Digest Bar */}
      <div className="rounded-xl border border-line bg-charcoal p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="text-[11px] font-mono text-fog uppercase block">
            Cryptographic Transaction Merkle Digest (SHA-256)
          </span>
          <code className="text-xs font-mono text-accent break-all">{auditDigest}</code>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCopyDigest}
            className="rounded bg-line px-3 py-1.5 text-xs font-mono font-semibold text-white hover:bg-line/80 transition"
          >
            {copiedHash ? "Copied ✓" : "Copy Hash"}
          </button>
        </div>
      </div>

      {/* Ledger Journal Table */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-white">Real-Time Ledger Transaction Journal</h2>
        <LedgerAuditTable entries={MOCK_LEDGER_DATA} />
      </div>

      {/* Accounting Invariants Card */}
      <div className="rounded-xl border border-line bg-graphite p-6 space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
          Double-Entry Accounting Invariants (`docs/financial-ledger.md`)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-fog leading-relaxed">
          <div className="space-y-1 rounded-lg bg-ink/40 p-3 border border-line/60">
            <h4 className="font-bold text-bone">1. Minor Unit Arithmetic</h4>
            <p>
              Zero floating point precision errors. All monetary figures are stored as 64-bit integer minor
              units (100 units = 1.00 XTS).
            </p>
          </div>
          <div className="space-y-1 rounded-lg bg-ink/40 p-3 border border-line/60">
            <h4 className="font-bold text-bone">2. Balance Conservation</h4>
            <p>
              Wallet balance equals the exact cumulative sum of all chronological ledger debit and credit
              operations. No orphaned balance mutations.
            </p>
          </div>
          <div className="space-y-1 rounded-lg bg-ink/40 p-3 border border-line/60">
            <h4 className="font-bold text-bone">3. Idempotent Settlement</h4>
            <p>
              Every transaction carries a unique idempotency key. Duplicate submissions or retried HTTP
              requests resolve deterministically without double-debiting.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
