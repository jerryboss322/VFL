"""Financial Ledger Audit & Double-Entry Balance Reconciliation Engine.

Enforces strict compliance with docs/financial-ledger.md:
- Integer Minor Units conservation invariant: sum(entries.amount_minor) == wallet.available_minor
- Wallet non-negativity constraint: available_minor >= 0, reserved_minor >= 0
- Transaction chain sequential integrity (balance_after_minor continuous progression)
- Tier-1 Liquidity Reserve Ratio audit (Treasury Assets vs User Total Liabilities >= 110%)
- SHA-256 cryptographic audit digest over financial ledger events
- Automated reconciliation report and invariant violation detection
"""

from dataclasses import dataclass, field
import hashlib
from datetime import datetime, timezone
from enum import Enum
from typing import Dict, List, Optional, Tuple


class LedgerReconciliationStatus(str, Enum):
    BALANCED = "BALANCED"
    RESERVE_DEFICIT = "RESERVE_DEFICIT"
    INTEGRITY_BREACH = "INTEGRITY_BREACH"
    CORRUPTED_CHAIN = "CORRUPTED_CHAIN"


@dataclass
class RawLedgerEntry:
    id: str
    wallet_id: str
    kind: str
    amount_minor: int
    balance_after_minor: int
    created_at: datetime
    idempotency_key: Optional[str] = None
    related_bet_id: Optional[str] = None


@dataclass
class WalletState:
    wallet_id: str
    user_id: str
    available_minor: int
    reserved_minor: int


@dataclass
class DiscrepancyDetail:
    wallet_id: str
    code: str
    description: str
    delta_minor: int


@dataclass
class AuditReport:
    status: LedgerReconciliationStatus
    audit_timestamp: str
    wallets_audited: int
    total_ledger_entries: int
    total_user_available_minor: int
    total_user_reserved_minor: int
    total_user_liabilities_minor: int
    platform_treasury_minor: int
    solvency_ratio: float
    is_solvent: bool
    discrepancies: List[DiscrepancyDetail] = field(default_factory=list)
    audit_hash: str = ""


def verify_wallet_ledger_chain(
    wallet: WalletState,
    entries: List[RawLedgerEntry],
) -> List[DiscrepancyDetail]:
    """Verifies that the ledger entry history precisely yields the wallet balance."""
    discrepancies: List[DiscrepancyDetail] = []

    # Non-negative checks
    if wallet.available_minor < 0:
        discrepancies.append(
            DiscrepancyDetail(
                wallet_id=wallet.wallet_id,
                code="NEGATIVE_AVAILABLE_BALANCE",
                description=f"Wallet available balance is negative: {wallet.available_minor}",
                delta_minor=wallet.available_minor,
            )
        )

    if wallet.reserved_minor < 0:
        discrepancies.append(
            DiscrepancyDetail(
                wallet_id=wallet.wallet_id,
                code="NEGATIVE_RESERVED_BALANCE",
                description=f"Wallet reserved balance is negative: {wallet.reserved_minor}",
                delta_minor=wallet.reserved_minor,
            )
        )

    # Sort entries chronologically
    sorted_entries = sorted(entries, key=lambda e: e.created_at)

    running_balance = 0
    for idx, entry in enumerate(sorted_entries):
        running_balance += entry.amount_minor
        if running_balance != entry.balance_after_minor:
            discrepancies.append(
                DiscrepancyDetail(
                    wallet_id=wallet.wallet_id,
                    code="BROKEN_CHAIN_STEP",
                    description=(
                        f"Entry {entry.id} calculated balance ({running_balance}) "
                        f"does not match recorded balance_after_minor ({entry.balance_after_minor})"
                    ),
                    delta_minor=running_balance - entry.balance_after_minor,
                )
            )

    # Sum of all ledger entry amount_minor must equal wallet.available_minor
    if running_balance != wallet.available_minor:
        discrepancies.append(
            DiscrepancyDetail(
                wallet_id=wallet.wallet_id,
                code="BALANCE_CONSERVATION_MISMATCH",
                description=(
                    f"Sum of ledger entries ({running_balance}) does not equal "
                    f"wallet available balance ({wallet.available_minor})"
                ),
                delta_minor=running_balance - wallet.available_minor,
            )
        )

    return discrepancies


def compute_ledger_sha256_hash(entries: List[RawLedgerEntry]) -> str:
    """Computes a deterministic SHA-256 Merkle-like digest of financial transaction history."""
    hasher = hashlib.sha256()
    sorted_entries = sorted(entries, key=lambda e: (e.created_at, e.id))
    for e in sorted_entries:
        line = f"{e.id}:{e.wallet_id}:{e.kind}:{e.amount_minor}:{e.balance_after_minor}:{e.created_at.isoformat()}\n"
        hasher.update(line.encode("utf-8"))
    return hasher.hexdigest()


def conduct_full_ledger_audit(
    wallets: List[WalletState],
    entries_by_wallet: Dict[str, List[RawLedgerEntry]],
    platform_treasury_minor: int,
    required_solvency_ratio: float = 1.10,
) -> AuditReport:
    """Executes platform-wide ledger integrity audit and checks solvency against liabilities."""
    all_discrepancies: List[DiscrepancyDetail] = []
    total_available = 0
    total_reserved = 0
    all_entries: List[RawLedgerEntry] = []

    for w in wallets:
        total_available += w.available_minor
        total_reserved += w.reserved_minor
        w_entries = entries_by_wallet.get(w.wallet_id, [])
        all_entries.extend(w_entries)
        disc = verify_wallet_ledger_chain(w, w_entries)
        all_discrepancies.extend(disc)

    total_liabilities = total_available + total_reserved
    solvency_ratio = (
        round(platform_treasury_minor / total_liabilities, 4)
        if total_liabilities > 0
        else 999.0
    )

    is_solvent = solvency_ratio >= required_solvency_ratio

    if not is_solvent:
        all_discrepancies.append(
            DiscrepancyDetail(
                wallet_id="PLATFORM_TREASURY",
                code="SOLVENCY_BELOW_RESERVE_REQUIREMENT",
                description=(
                    f"Treasury ratio {solvency_ratio:.2f} is below minimum requirement "
                    f"{required_solvency_ratio:.2f}"
                ),
                delta_minor=int(total_liabilities * required_solvency_ratio) - platform_treasury_minor,
            )
        )

    # Determine overall status
    has_chain_corruption = any(
        d.code in ("BROKEN_CHAIN_STEP", "BALANCE_CONSERVATION_MISMATCH", "NEGATIVE_AVAILABLE_BALANCE")
        for d in all_discrepancies
    )

    if has_chain_corruption:
        status = LedgerReconciliationStatus.INTEGRITY_BREACH
    elif not is_solvent:
        status = LedgerReconciliationStatus.RESERVE_DEFICIT
    else:
        status = LedgerReconciliationStatus.BALANCED

    audit_digest = compute_ledger_sha256_hash(all_entries)

    return AuditReport(
        status=status,
        audit_timestamp=datetime.now(timezone.utc).isoformat(),
        wallets_audited=len(wallets),
        total_ledger_entries=len(all_entries),
        total_user_available_minor=total_available,
        total_user_reserved_minor=total_reserved,
        total_user_liabilities_minor=total_liabilities,
        platform_treasury_minor=platform_treasury_minor,
        solvency_ratio=solvency_ratio,
        is_solvent=is_solvent,
        discrepancies=all_discrepancies,
        audit_hash=audit_digest,
    )
