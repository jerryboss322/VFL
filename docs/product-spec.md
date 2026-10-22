# Product Specification — Virtual Football Universe

## Overview
Virtual Football Universe is a real-time simulated football league and test-money sportsbook platform. All balances and wagers use simulated test tokens (`XTS`) in integer minor units ($100\text{ minor units} = 1.00\text{ XTS}$). No real-money deposits or withdrawals exist in any environment.

## Core Pillars
1. **Shared Global Universe**:
   - 12 virtual clubs compete in the **Virtual Premier League (VPL)** across a 22-matchday double round-robin season (6 fixtures per matchday).
   - Every user views the exact same match states, clocks, events, and standings in real time.
2. **Probabilistic Match Simulation**:
   - Each 90-minute match runs over 480 wall-clock seconds (8 minutes) in standard mode, or can be advanced on demand via simulation controls.
   - Match events (goals, shots/chances, yellow/red cards, penalties, substitutions) are generated from club attack/defense ratings using a time-inhomogeneous Poisson process.
3. **Multi-Market Sportsbook & Accumulator Betslip**:
   - Pre-match markets: **Match Result (1X2)**, **Total Goals Over/Under 2.5**, and **Both Teams to Score (BTTS)**.
   - Users can place single bets or multi-match accumulators (up to 6 selections, maximum 1 selection per fixture).
   - Bets are automatically settled by the backend the instant all constituent fixtures reach `completed` status.
4. **Auditable Financial Ledger**:
   - Every user receives an initial grant of `1,000,000` minor units (`10,000.00 XTS`) upon registration, recorded in the immutable ledger.
   - All balance changes (`initial_grant`, `stake_reserve`, `settlement_win`, `settlement_loss`, `bet_void_refund`) are recorded atomically with row-level locking (`SELECT ... FOR UPDATE`).
