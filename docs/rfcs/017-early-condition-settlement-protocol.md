# RFC 017: Early In-Play Condition-Met Settlement Protocol & Over/Under Lifecycle Engine

**Status:** Approved & Implemented  
**Date:** 2026-10-26  
**Authors:** VFN Quantitative Settlement & Financial Ledger Working Group  
**Scope:** `backend/app/services/betting.py`, `backend/app/services/odds_engine.py`, `backend/engine/simulator.py`, `components/BetslipDrawer.tsx`

---

## 1. Executive Summary

Traditional virtual sports engines delay all wager payouts until full-time (match completion). In modern high-frequency sports wagering, delaying settlement on outcomes that have already definitively concluded creates capital friction and a poor bettor experience.

RFC 017 establishes the **Early In-Play Condition-Met Settlement Protocol**:
1. **Instant Win Realization for Exceeded Thresholds:** Any bet on an **Over** line (e.g. Over 0.5, Over 1.5, Over 2.5) or **Both Teams to Score (BTTS Yes)** is settled immediately as **WON** upon the occurrence of the qualifying goal event, instantly crediting the bettor's wallet.
2. **Instant Loss Recognition for Breached Thresholds:** Any bet on an **Under** line (e.g. Under 0.5, Under 1.5, Under 2.5) or **BTTS No** is settled immediately as **LOST** once total goals exceed the line threshold, as goals cannot be un-scored.
3. **Multi-Leg Accumulator (Parlay) Fast-Path:** In multi-leg accumulators, early-won legs are irrevocably marked won; if all legs achieve early condition satisfaction, the parlay settles and pays out in-play. Conversely, if any single leg definitively loses, the accumulator is immediately settled as lost.

---

## 2. Mathematical Formalism

### 2.1 Monotonicity of Goal Arrivals
Let $G(t) = H(t) + A(t)$ denote the total goals scored in fixture $F$ up to clock elapsed time $t$.  
Because goal events are strictly non-decreasing point processes:
$$\forall t_2 \ge t_1, \quad G(t_2) \ge G(t_1)$$

### 2.2 Settlement Invariant for Over Lines
For an Over threshold $T \in \{0.5, 1.5, 2.5, 3.5, 4.5\}$:
$$\text{If } G(t) > \lfloor T \rfloor \implies \forall t_{FT} \ge t, \quad G(t_{FT}) > T$$
$$\therefore \text{Outcome}(\text{Over } T) = \text{WON at } t_{goal}$$

### 2.3 Settlement Invariant for Under Lines
$$\text{If } G(t) > \lfloor T \rfloor \implies \forall t_{FT} \ge t, \quad G(t_{FT}) > T$$
$$\therefore \text{Outcome}(\text{Under } T) = \text{LOST at } t_{goal}$$

### 2.4 Both Teams to Score (BTTS) Invariant
$$\text{If } H(t) \ge 1 \land A(t) \ge 1 \implies \text{BTTS Yes} = \text{WON}, \quad \text{BTTS No} = \text{LOST}$$

---

## 3. Financial Ledger Accounting & Invariants

```
                ┌──────────────────────────────────────┐
                │          PENDING BET PLACED          │
                │  wallet.available_minor -= stake     │
                │  wallet.reserved_minor  += stake     │
                └──────────────────┬───────────────────┘
                                   │
              Goal event scored: G(t) > Threshold
                                   │
         ┌─────────────────────────┴─────────────────────────┐
         ▼                                                   ▼
┌─────────────────────────────────┐         ┌─────────────────────────────────┐
│        CONDITION MET (WON)      │         │      CONDITION BREACHED (LOST)  │
│  return = stake * odds          │         │  return = 0                     │
│  wallet.reserved  -= stake      │         │  wallet.reserved  -= stake      │
│  wallet.available += return     │         │  wallet.available unchanged     │
│  status = "won"                 │         │  status = "lost"                │
│  Ledger: kind = "settlement_win"│         │  Ledger: kind = "settlement_loss│
└─────────────────────────────────┘         └─────────────────────────────────┘
```

All wallet operations enforce row-level database locking via `select(Wallet).where(...).with_for_update()` to guarantee that concurrency races or rapid consecutive goal events maintain zero balance divergence.

---

## 4. Verification & Testing Standards

The test suite in [`backend/tests/test_inplay_handicap_and_lock_rules.py`](file:///home/jboss/Projects/virtual-football/backend/tests/test_inplay_handicap_and_lock_rules.py) validates:
1. At score 2-0:
   - Over 1.5 settles `(True, True)` (WON early).
   - Under 1.5 settles `(True, False)` (LOST early).
   - Over 2.5 remains `(False, False)` (Pending).
2. At score 2-1:
   - BTTS Yes settles `(True, True)` (WON early).
   - BTTS No settles `(True, False)` (LOST early).
   - Over 2.5 settles `(True, True)` (WON early).
