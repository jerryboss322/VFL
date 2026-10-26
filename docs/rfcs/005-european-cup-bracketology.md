# RFC 005: Virtual European Champions Cup & Knockout Bracketology

- **Status**: Standard / Authoritative
- **Authors**: Tournament Architecture & Sports Modeling Working Group
- **Applies to**: `backend/app/models/cup.py`, `backend/app/services/cup_bracket_engine.py`, `backend/app/api/tournaments.py`, `components/TournamentBracketView.tsx`
- **Related Documents**: `docs/product-spec.md`, `docs/api-contract.md`

---

## 1. Abstract & Scope

The Virtual European Champions Cup (VECC) represents the premier continental knockout tournament in the Virtual Football Universe. Sixteen top-tier clubs from England, Spain, Italy, Germany, France, and the Netherlands compete across four escalating knockout stages:
1. **Round of 16 (R16)**: Two-legged home-and-away ties (8 ties, 16 matches).
2. **Quarter-Finals (QF)**: Two-legged home-and-away ties (4 ties, 8 matches).
3. **Semi-Finals (SF)**: Two-legged home-and-away ties (2 ties, 4 matches).
4. **Grand Final**: Single-match showdown at a neutral European arena.

RFC 005 specifies the tournament progression state machine, modern UEFA aggregate rules, extra time, penalty shootouts, and Monte Carlo outright winner odds re-pricing.

---

## 2. Tournament Bracket Progression Architecture

```
ROUND OF 16 (2 Legs)         QUARTER-FINALS (2 Legs)       SEMI-FINALS (2 Legs)         GRAND FINAL (Neutral)
=====================        =======================       ====================         ====================
[Club A vs Club B] ---\
                       +---> [Winner 1 vs Winner 2] ---\
[Club C vs Club D] ---/                                 \
                                                         +---> [Semi 1 vs Semi 2] ---\
[Club E vs Club F] ---\                                 /                             \
                       +---> [Winner 3 vs Winner 4] ---/                               \
[Club G vs Club H] ---/                                                                 +---> [CHAMPION]
                                                                                       /
[Club I vs Club J] ---\                                                               /
                       +---> [Winner 5 vs Winner 6] ---\                             /
[Club K vs Club L] ---/                                 \                           /
                                                         +---> [Semi 3 vs Semi 4] ---/
[Club M vs Club N] ---\                                 /
                       +---> [Winner 7 vs Winner 8] ---/
[Club O vs Club P] ---/
```

---

## 3. Two-Legged Aggregate Rules & Modern UEFA Conformance

In compliance with UEFA Executive Committee decisions (effective since the 2021/22 season):
- **Abolition of Away Goals**: Away goals are no longer weighted higher in tied matches.
- Aggregate score is strictly:
  $$\text{Agg}(A, B) = \text{Goals}_{Leg 1}(A) + \text{Goals}_{Leg 2}(A) \quad\text{vs}\quad \text{Goals}_{Leg 1}(B) + \text{Goals}_{Leg 2}(B)$$

### 3.1 Tie-Breaking Decision Tree
If $\text{Agg}(A) == \text{Agg}(B)$ at the conclusion of 90 minutes in Leg 2:
1. **Extra Time (AET)**: Two distinct simulation halves of 15 virtual minutes (30 simulation seconds total).
2. **Penalty Shootout (PEN)**: If still tied after Extra Time:
   - Initial 5 rounds of alternating penalties ($A \leftrightarrow B$).
   - If tied after 5 rounds: Sudden Death rounds until one club scores and the other misses.

---

## 4. Penalty Shootout Markov Formulation

The probability of converting a penalty $P_{score}$ is governed by the shooter's finishing skill $F \in [60, 99]$ versus the goalkeeper's reflex skill $G \in [60, 99]$:

$$P_{score} = \text{clamp}\left(0.76 + \frac{F - G}{250}, 0.55, 0.92\right)$$

- Default baseline penalty conversion in European football is $76\%$.
- An elite shooter ($F=95$) against an average goalkeeper ($G=75$) increases conversion probability to $84\%$.
- An elite goalkeeper ($G=95$) against an average shooter ($F=75$) suppresses conversion probability to $68\%$.

---

## 5. Monte Carlo Outright Winner Odds Re-pricing

Following each completed leg or round, the tournament engine runs a $10,000$-iteration Monte Carlo simulation of all remaining bracket matchups to dynamically price the **Outright Tournament Winner** market.

Let $W_c$ be the number of tournament victories simulated for club $c$ out of $N = 10,000$ runs:
$$P_c = \frac{W_c}{N}$$

The published decimal odds $O_c$ incorporating bookmaker margin $M = 0.08$ ($8\%$ overround) is:
$$O_c = \text{round}\left( \frac{1}{P_c \times (1 + M)}, 2 \right)$$

If $P_c < 0.001$, odds are capped at $999.00$ or suspended.
