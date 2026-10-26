# RFC 002: Double-Entry Financial Ledger Immutability & Solvency Architecture

- **Status**: Standard / Authoritative
- **Authors**: Financial Engineering & Risk Compliance Working Group
- **Applies to**: `backend/app/models/wallet.py`, `backend/app/models/ledger.py`, `backend/app/services/ledger_reconciliation.py`
- **Related Documents**: `docs/financial-ledger.md`, `docs/api-contract.md`

---

## 1. Abstract & Legal Invariants

In high-velocity virtual sports wagering platforms, financial integrity is the singular non-negotiable operational invariant. Any floating-point drift, race condition during bet placement, or phantom credit during concurrent settlement can cause irreversible balance leakage or regulatory revocation under gambling commissions (UKGC, MGA, Curacao eGaming).

RFC 002 specifies the **Immutable Double-Entry Financial Ledger Specification**, governing:
1. Strict 64-bit Integer Minor Unit arithmetic.
2. Row-level transaction isolation and anti-race locks (`SELECT ... FOR UPDATE`).
3. Mathematical wallet balance conservation equations.
4. Cryptographic SHA-256 audit Merkle proofs.
5. Tier-1 Liquidity Reserve Ratio audits ($\ge 110\%$).

---

## 2. Mathematical Formalization

```
+-----------------------------------------------------------------------------------+
|                        AUTHORITATIVE WALLET STATE (Row Locked)                   |
|   $\text{AvailableMinor} \ge 0 \quad\land\quad \text{ReservedMinor} \ge 0$        |
+-----------------------------------------------------------------------------------+
                 |                                                |
          (Debit / Stake)                                  (Credit / Win)
                 v                                                v
+---------------------------------+              +----------------------------------+
|      DEBIT: STAKE RESERVE       |              |      CREDIT: WIN SETTLEMENT      |
|  $A_{new} = A_{old} - S$        |              |  $A_{new} = A_{old} + P$         |
|  $R_{new} = R_{old} + S$        |              |  $R_{new} = R_{old} - S$         |
|  $\text{BalanceAfter} = A_{new}$|              |  $\text{BalanceAfter} = A_{new}$ |
+---------------------------------+              +----------------------------------+
                 \                                                /
                  \                                              /
                   v                                            v
+-----------------------------------------------------------------------------------+
|                     IMMUTABLE APPEND-ONLY LEDGER JOURNAL                          |
|   $E_i = (\text{UUID}, \text{WalletID}, \text{Kind}, \Delta M, \text{BalanceAfter}, t_i, K_{idem})$  |
|   $\sum_{k=1}^N \Delta M_k \equiv \text{Wallet.AvailableMinor}$                   |
+-----------------------------------------------------------------------------------+
```

### 2.1 Integer Minor Unit Constraint
All monetary values in the database, API schemas, and client state representations are stored as 64-bit signed integers representing minor currency units:
$$\text{Minor Unit} = 100 \times \text{Major Unit (XTS)}$$
$$\text{e.g., } 10,000.00\text{ XTS} = 1,000,000\text{ minor units}$$

Floating-point data types (`float`, `double`, `real`) are strictly prohibited in database columns and internal calculation routines to eliminate IEEE 754 rounding anomalies.

### 2.2 Wallet Conservation Equation
For every user wallet $W$ at any historical sequence step $N$:
$$\text{AvailableBalance}_N = \sum_{k=1}^N \Delta M_k$$
where $\Delta M_k$ is the signed monetary transfer of ledger entry $E_k$.

Furthermore:
$$\text{BalanceAfter}_k = \text{BalanceAfter}_{k-1} + \Delta M_k$$
Any ledger event where $\text{BalanceAfter}_k \neq \text{BalanceAfter}_{k-1} + \Delta M_k$ triggers an immediate system halt (`INTEGRITY_BREACH`).

---

## 3. Transaction Types & Life Cycle

The ledger recognizes five authoritative transaction kinds:

| Kind | Trigger Event | $\Delta\text{Available}$ | $\Delta\text{Reserved}$ | Notes |
| :--- | :--- | :---: | :---: | :--- |
| `initial_grant` | User registration | $+1,000,000$ | $0$ | Welcome credit ($10,000.00\text{ XTS}$) |
| `stake_reserve` | Bet placement | $-\text{Stake}$ | $+\text{Stake}$ | Move funds to escrow reserve |
| `settlement_win` | Winning fixture | $+\text{Payout}$ | $-\text{Stake}$ | Credit calculated payout; release escrow |
| `settlement_loss`| Losing fixture | $0$ | $-\text{Stake}$ | Release escrow to platform treasury |
| `bet_void_refund`| Match cancelled | $+\text{Stake}$ | $-\text{Stake}$ | Return 100% of reserved stake to player |

---

## 4. Idempotency & Deduplication Engine

Every financial mutation endpoint requires an `Idempotency-Key` HTTP header. 

### 4.1 Bet Placement Deduplication
1. Client generates UUIDv4 `idempotency_key`.
2. Database executes atomic insertion into `bets` table with unique constraint on `(user_id, idempotency_key)`.
3. If an identical key is submitted:
   - The transaction catches `UniqueViolation`.
   - The existing settled or pending ticket is returned immediately with HTTP 200.
   - The wallet is **never debited twice**.

### 4.2 Idempotent Settlement Execution
Settlement operations verify the status transition:
$$\text{pending} \longrightarrow \text{won} \mid \text{lost} \mid \text{void}$$
Attempting to settle an already settled ticket (`status != 'pending'`) returns early as a safe no-op.

---

## 5. Tier-1 Liquidity Reserve Ratio

To ensure 100% solvency and user protection against catastrophic liquidity crunches, the platform monitors the **Solvency Ratio** $R_{solv}$:

$$R_{solv} = \frac{\text{Platform Treasury Assets}}{\text{Total User Liabilities}} = \frac{A_{treasury}}{\sum W_{avail} + \sum W_{res}} \ge 1.10$$

- If $R_{solv} < 1.10$, an automated alert is dispatched to treasury operations.
- If $R_{solv} < 1.00$, wagering operations automatically pause to protect user equity.

---

## 6. SHA-256 Cryptographic Audit Chain

To prevent database tampering by malicious insiders or SQL injections:
$$\text{Digest}_N = \text{SHA256}\left(\sum_{k=1}^N E_k.\text{id} \parallel E_k.\text{wallet} \parallel E_k.\text{kind} \parallel E_k.\Delta M \parallel E_k.t \right)$$

This digest is exposed publicly on the `/audit-ledger` interface, enabling external auditors to mathematically prove that no ledger entries have been altered, reordered, or deleted.
