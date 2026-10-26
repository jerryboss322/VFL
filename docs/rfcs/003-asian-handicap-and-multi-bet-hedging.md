# RFC 003: Asian Handicap Mathematics & Permutation Hedging Engine

- **Status**: Standard / Authoritative
- **Authors**: Sportsbook Quantitative Modeling Working Group
- **Applies to**: `backend/app/services/asian_handicap.py`, `backend/app/services/accumulators.py`, `lib/asian_handicap.ts`
- **Related Documents**: `docs/api-contract.md`, `docs/financial-ledger.md`

---

## 1. Abstract & Scope

Asian Handicap (AH) lines eliminate the draw outcome from conventional 1X2 association football betting, providing bettors with continuous risk gradients and bookmakers with balanced liability distributions. When combined with permutation system betting (Trixie, Yankee, Goliath) and Same-Game Multis (SGM), the mathematical settlement framework must handle fractional payouts, pushes, and inter-leg correlation deflation.

RFC 003 establishes the formal mathematical specification for:
1. Full lines, half lines, and quarter split lines.
2. Fractional settlement payouts in integer minor units.
3. Permutation bet combinatorics from 3-fold to 8-fold selections.
4. Same-Game-Multi (SGM) intra-match correlation copulas.

---

## 2. Asian Handicap Mathematical Formulation

```
                                  GOAL DIFFERENCE: $\Delta = G_{home} - G_{away}$
                                                         |
                           +-----------------------------+-----------------------------+
                           |                                                           |
                      HOME HANDICAP: $H$                                         AWAY HANDICAP: $-H$
                           |                                                           |
                    NET OUTCOME: $D = \Delta + H$                               NET OUTCOME: $D = -\Delta - H$
                           |                                                           |
            +--------------+--------------+                             +--------------+--------------+
            |              |              |                             |              |              |
          $D > 0$        $D = 0$        $D < 0$                       $D > 0$        $D = 0$        $D < 0$
          FULL WIN        PUSH         FULL LOSS                      FULL WIN        PUSH         FULL LOSS
```

### 2.1 Quarter-Line Split Decomposition
Quarter lines ($\pm 0.25, \pm 0.75, \pm 1.25, \dots$) represent two distinct equal-stake wagers placed on the adjacent half-line and full-line:
$$\text{Line}(L) = \frac{1}{2}\text{Wager}(L - 0.25) + \frac{1}{2}\text{Wager}(L + 0.25)$$

Let $S$ be the total stake in minor units, and $O$ be the recorded decimal odds.

| Line Type | Net Margin $D = \Delta + H$ | Outcome Classification | Payout Calculation (Minor Units) |
| :--- | :--- | :--- | :--- |
| **Full / Half** | $D > 0$ | `WIN` | $\lfloor S \cdot O \rfloor$ |
| **Full / Half** | $D = 0$ | `PUSH` | $S$ (Full stake refund) |
| **Full / Half** | $D < 0$ | `LOSS` | $0$ |
| **Quarter** | $D = +0.25$ | `HALF_WIN` | $\lfloor \frac{S}{2} \cdot O \rfloor + \lfloor \frac{S}{2} \rfloor$ |
| **Quarter** | $D = -0.25$ | `HALF_LOSS` | $\lfloor \frac{S}{2} \rfloor$ (Half stake refund) |
| **Quarter** | $D \ge +0.50$ | `WIN` | $\lfloor S \cdot O \rfloor$ |
| **Quarter** | $D \le -0.50$ | `LOSS` | $0$ |

---

## 3. System Bet Permutation Combinatorics

System wagers distribute a user's stake across all non-redundant $k$-combinations of $n$ selections ($k \in [1, n]$).

$$\binom{n}{k} = \frac{n!}{k!(n-k)!}$$

### 3.1 Standard System Matrix

| Bet Name | Selections ($n$) | Total Bets ($B$) | Singles ($k=1$) | Doubles ($k=2$) | Trebles ($k=3$) | 4-Folds ($k=4$) | 5-Folds ($k=5$) | 6-Folds ($k=6$) | 7-Folds ($k=7$) | 8-Folds ($k=8$) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Trixie** | 3 | 4 | 0 | 3 | 1 | 0 | 0 | 0 | 0 | 0 |
| **Patent** | 3 | 7 | 3 | 3 | 1 | 0 | 0 | 0 | 0 | 0 |
| **Yankee** | 4 | 11 | 0 | 6 | 4 | 1 | 0 | 0 | 0 | 0 |
| **Lucky 15** | 4 | 15 | 4 | 6 | 4 | 1 | 0 | 0 | 0 | 0 |
| **Canadian** | 5 | 26 | 0 | 10 | 10 | 5 | 1 | 0 | 0 | 0 |
| **Heinz** | 6 | 57 | 0 | 15 | 20 | 15 | 6 | 1 | 0 | 0 |
| **Super Heinz** | 7 | 120 | 0 | 21 | 35 | 35 | 21 | 7 | 1 | 0 |
| **Goliath** | 8 | 247 | 0 | 28 | 56 | 70 | 56 | 28 | 8 | 1 |

### 3.2 Total Stake & Return Formulation
Given unit stake $u$ in minor units:
$$\text{TotalStake} = u \times B$$

For any winning subset $W \subseteq \{1, \dots, n\}$:
$$\text{TotalReturn} = \sum_{C \in \mathcal{P}(W), |C| \ge k_{min}} \left\lfloor u \times \prod_{i \in C} O_i \right\rfloor$$

---

## 4. Same-Game-Multi (SGM) Correlation Deflation

When multiple selections originate from the same fixture (e.g., *Manchester Blue Win* $\land$ *Over 2.5 Goals* $\land$ *Haaland to Score*), outcomes are positively correlated. Unadjusted multiplication produces excessive payouts that destroy bookmaker margins.

The platform applies a bivariate Gaussian copula deflation coefficient $\rho \in [-1, 1]$:
$$O_{joint} = \max\left(1.01, \left(\prod_{j=1}^m O_j\right) \times (1 - \rho_{penalty})\right)$$

where $\rho_{penalty}$ reflects historical empirical joint probability tables stored in `backend/app/services/accumulators.py`.
