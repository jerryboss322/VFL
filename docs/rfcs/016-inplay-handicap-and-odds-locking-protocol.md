# RFC 016: Dynamic In-Play Handicap Shifts, 1.07 Odds Floor, and BTTS Event Locking Protocol

**Status:** Approved & Implemented  
**Date:** 2026-10-26  
**Authors:** VFN Core Mathematical Modeling & Risk Architecture Team  
**Scope:** `backend/app/services/odds_engine.py`, `backend/app/services/asian_handicap.py`, `backend/app/services/betting.py`, `components/BetslipDrawer.tsx`, `components/AsianHandicapTable.tsx`

---

## 1. Executive Summary

Virtual sports wagering demands rigorous mathematical consistency between live pitch events and the odds matrix. When a goal is scored in real-time, the probability space shifts instantly:
1. **Dynamic Handicap Line Realignment:** Fixed handicap spreads (+1, -1, +2, -2) become heavily unbalanced once a team leads by 2 or more goals. The system dynamically recalibrates active handicap lines around the live score differential, providing competitive two-way lines while allowing pre-match lines to drift or shorten accurately.
2. **Strict Minimum Odds Floor (1.07 Decimal):** Any selection whose decimal odds drop below `1.07` (implied probability $\ge 93.46\%$ including overround) poses prohibitive counterparty risk and negligible risk-return. The engine automatically locks/suspends these selections (`suspended = True`), rendering them unclickable on the UI and strictly rejected by the backend bet placement engine.
3. **Irreversible Both Teams To Score (BTTS) Event Termination:** Once both teams have scored ($\text{Goals}_{home} \ge 1 \land \text{Goals}_{away} \ge 1$), the BTTS event condition has been conclusively met. The market is immediately locked, preventing latency-arbitrage exploitation.

---

## 2. In-Play Dynamic 3-Way Handicap Mechanics

### 2.1 Conditioning on Elapsed Time and Live Score
Let full-time goals be modeled as $H = h_{current} + \Delta H$ and $A = a_{current} + \Delta A$, where remaining goals follow independent Poisson processes:
$$\Delta H \sim \text{Poisson}(\lambda_{H, rem}), \quad \Delta A \sim \text{Poisson}(\lambda_{A, rem})$$
where:
$$\lambda_{H, rem} = \lambda_H \cdot \left(\frac{T_{total} - t_{elapsed}}{T_{total}}\right)$$

### 2.2 Dynamic Spread Offsets
Pre-match, standard handicap lines are evaluated for $L \in \{-3, -2, -1, +1, +2, +3\}$.  
In-play, when a goal differential $\Delta G = h_{current} - a_{current} \ne 0$ develops, the sportsbook dynamically expands lines centered around $-\Delta G$:
$$\mathcal{L}_{inplay} = \mathcal{L}_{base} \cup \left\{ -\Delta G + k \mid k \in \{-2, -1, +1, +2\}, \ -6 \le -\Delta G + k \le 6 \right\}$$

This guarantees that:
- If Home leads 2-0, active lines dynamically include $-4, -3, -2, -1, +1, +2, +3$.
- Odds on Home $-1$ shorten (odds reduce) from $\sim 3.50$ down to $\sim 1.15$ as the remaining hurdle is reduced to preserving the existing lead.
- Odds on Away $+1$ drift out (odds increase) from $\sim 1.35$ up to $\sim 18.00$.

---

## 3. The 1.07 Minimum Odds Floor Rule

### 3.1 Rationale
Odds lower than `1.07` represent extreme tail probabilities where minuscule slippage or network latency can result in severe adverse selection. Bookmakers worldwide enforce automatic market suspension when a selection's decimal odds drop below statutory safety thresholds.

### 3.2 Enforcement Architecture
$$\text{OptionSuspended} = \text{MarketSuspended} \lor (Odds_{decimal} < 1.07) \lor (P \le 0.001 \land \text{is\_live})$$

- **Backend Enforcement (`betting.py`):**
  ```python
  leg_odds = Decimal(str(option.get("decimal", 1.0)))
  if option.get("suspended", False) or option.get("locked", False) or leg_odds < Decimal("1.07"):
      raise BettingError("MARKET_SUSPENDED", "This selection is locked (odds below 1.07 or suspended market)", 409)
  ```
- **Frontend Enforcement (`BetslipDrawer.tsx` & `OddsButton`):**
  - Items with decimal $< 1.07$ display a red strike-through badge `🔒 < 1.07`.
  - The "Place Bet" action button is disabled with message `"Odds Below 1.07 Locked"`.

---

## 4. BTTS Market Lifecycle State Machine

```
                   ┌─────────────────────────────────────────┐
                   │               PRE-MATCH                 │
                   │  Status: Active                         │
                   │  p_yes = sum(h>=1, a>=1)                │
                   └──────────────────┬──────────────────────┘
                                      │ Kick-Off
                                      ▼
                   ┌─────────────────────────────────────────┐
                   │           IN-PLAY: 0-0, 1-0, 0-1         │
                   │  Status: Active                         │
                   │  Probabilities updated per Poisson grid │
                   └──────────────────┬──────────────────────┘
                                      │ Both Teams Score (h>=1 and a>=1)
                                      ▼
                   ┌─────────────────────────────────────────┐
                   │           IN-PLAY: BTTS OCCURRED        │
                   │  Status: LOCKED & SUSPENDED             │
                   │  p_yes = 0.999 (locked)                 │
                   │  p_no  = 0.0001 (locked)                │
                   │  New wagers rejected (HTTP 409)         │
                   └──────────────────┬──────────────────────┘
                                      │ Final Whistle
                                      ▼
                   ┌─────────────────────────────────────────┐
                   │             SETTLED / CLOSED            │
                   │  Pre-event wagers settled via ledger    │
                   └─────────────────────────────────────────┘
```

---

## 5. Security & Verification

1. **Deterministic Test Coverage:** Unit test suite `backend/tests/test_inplay_handicap_and_lock_rules.py` validates:
   - Dynamic odds reduction for leader handicaps and increase for trailing handicaps.
   - 100% suspension rate for options with odds $< 1.07$.
   - Immediate locking of `btts_yes` and `btts_no` when $h \ge 1 \land a \ge 1$.
2. **Client-Side Safeguards:** `lib/betslip.ts` `validateSlipSelections()` executes zero-latency pre-flight verification before dispatching HTTP payloads.
