# Financial Ledger Specification

## Core Invariants
1. **Integer Minor Units Only**:
   - All monetary values (`available_minor`, `reserved_minor`, `stake_minor`, `return_minor`, `amount_minor`, `balance_after_minor`) are 64-bit safe integers representing minor units ($100\text{ minor units} = 1.00\text{ XTS}$).
2. **Wallet Conservation Equation**:
   - At all times, for every user wallet:
     - `available_minor >= 0`
     - `reserved_minor >= 0`
     - The latest `ledger_entries.balance_after_minor` equals `wallet.available_minor`.
     - The sum of all `ledger_entries.amount_minor` for a wallet equals `wallet.available_minor`.
3. **Row-Level Locking**:
   - Every bet placement or settlement acquires a `SELECT ... FOR UPDATE` lock on the `wallets` row before inspecting or mutating balances.
4. **Ledger Entry Types (`kind`)**:
   - `initial_grant`: Credit `+1000000` upon registration (`balance_after_minor = 1000000`).
   - `stake_reserve`: Debit `-stake_minor` from `available_minor` and add `+stake_minor` to `reserved_minor` upon bet placement.
   - `settlement_win`: Release `-stake_minor` from `reserved_minor` and credit `+return_minor` (`floor(Decimal(stake_minor) * Decimal(recorded_odds))`) to `available_minor`.
   - `settlement_loss`: Release `-stake_minor` from `reserved_minor` (`amount_minor = 0`, `balance_after_minor` unchanged).
   - `bet_void_refund`: Release `-stake_minor` from `reserved_minor` and credit `+stake_minor` back to `available_minor`.
5. **Idempotency**:
   - Bet placement is keyed by `idempotency_key`. Re-submitting an identical `idempotency_key` returns the existing bet or a deterministic `DUPLICATE_BET` code without double-debiting the wallet.
   - Bet settlement is idempotent: calling settlement on an already-settled bet is a safe no-op returning the settled state.
