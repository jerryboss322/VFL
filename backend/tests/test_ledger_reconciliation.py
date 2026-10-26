"""Unit tests for Financial Ledger Audit & Double-Entry Balance Reconciliation Engine."""

from datetime import datetime, timezone, timedelta
import unittest

from backend.app.services.ledger_reconciliation import (
    AuditReport,
    DiscrepancyDetail,
    LedgerReconciliationStatus,
    RawLedgerEntry,
    WalletState,
    compute_ledger_sha256_hash,
    conduct_full_ledger_audit,
    verify_wallet_ledger_chain,
)


class TestLedgerReconciliation(unittest.TestCase):
    def setUp(self):
        self.t0 = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
        self.t1 = self.t0 + timedelta(minutes=5)
        self.t2 = self.t0 + timedelta(minutes=15)
        self.t3 = self.t0 + timedelta(minutes=30)

    def test_clean_wallet_chain_passes(self):
        # Initial grant 1,000,000 minor units
        # Stake 100,000 (-100,000 from available)
        # Win return 250,000 (+250,000 to available)
        # Final available: 1,150,000
        wallet = WalletState(
            wallet_id="w-alice",
            user_id="u-alice",
            available_minor=1_150_000,
            reserved_minor=0,
        )

        entries = [
            RawLedgerEntry("e1", "w-alice", "initial_grant", 1_000_000, 1_000_000, self.t0),
            RawLedgerEntry("e2", "w-alice", "stake_reserve", -100_000, 900_000, self.t1),
            RawLedgerEntry("e3", "w-alice", "settlement_win", 250_000, 1_150_000, self.t2),
        ]

        discrepancies = verify_wallet_ledger_chain(wallet, entries)
        self.assertEqual(len(discrepancies), 0)

    def test_broken_chain_step_detected(self):
        wallet = WalletState(
            wallet_id="w-bob",
            user_id="u-bob",
            available_minor=1_000_000,
            reserved_minor=0,
        )

        # e2 balance_after_minor says 950_000 instead of 800_000
        entries = [
            RawLedgerEntry("e1", "w-bob", "initial_grant", 1_000_000, 1_000_000, self.t0),
            RawLedgerEntry("e2", "w-bob", "stake_reserve", -200_000, 950_000, self.t1),
            RawLedgerEntry("e3", "w-bob", "settlement_loss", 0, 800_000, self.t2),
        ]

        discrepancies = verify_wallet_ledger_chain(wallet, entries)
        self.assertTrue(any(d.code == "BROKEN_CHAIN_STEP" for d in discrepancies))
        self.assertTrue(any(d.code == "BALANCE_CONSERVATION_MISMATCH" for d in discrepancies))

    def test_full_platform_audit_balanced_and_solvent(self):
        w1 = WalletState("w-1", "u-1", 1_000_000, 50_000)
        w2 = WalletState("w-2", "u-2", 500_000, 100_000)

        # Total liabilities = (1000k + 50k) + (500k + 100k) = 1,650,000
        # Treasury has 2,500,000 -> solvency ratio = 2500000 / 1650000 = ~1.515 (> 1.10)
        entries_by_wallet = {
            "w-1": [RawLedgerEntry("e1", "w-1", "initial_grant", 1_000_000, 1_000_000, self.t0)],
            "w-2": [RawLedgerEntry("e2", "w-2", "initial_grant", 500_000, 500_000, self.t0)],
        }

        report = conduct_full_ledger_audit(
            wallets=[w1, w2],
            entries_by_wallet=entries_by_wallet,
            platform_treasury_minor=2_500_000,
            required_solvency_ratio=1.10,
        )

        self.assertEqual(report.status, LedgerReconciliationStatus.BALANCED)
        self.assertTrue(report.is_solvent)
        self.assertGreaterEqual(report.solvency_ratio, 1.10)
        self.assertTrue(len(report.audit_hash) == 64)

    def test_solvency_deficit_detected(self):
        w1 = WalletState("w-1", "u-1", 2_000_000, 0)
        entries_by_wallet = {
            "w-1": [RawLedgerEntry("e1", "w-1", "initial_grant", 2_000_000, 2_000_000, self.t0)]
        }

        # Platform treasury only has 1,500,000 (ratio = 0.75 < 1.10 required)
        report = conduct_full_ledger_audit(
            wallets=[w1],
            entries_by_wallet=entries_by_wallet,
            platform_treasury_minor=1_500_000,
            required_solvency_ratio=1.10,
        )

        self.assertEqual(report.status, LedgerReconciliationStatus.RESERVE_DEFICIT)
        self.assertFalse(report.is_solvent)
        self.assertTrue(any(d.code == "SOLVENCY_BELOW_RESERVE_REQUIREMENT" for d in report.discrepancies))


if __name__ == "__main__":
    unittest.main()
