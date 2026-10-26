# RFC 006: Dixon-Coles Predictive Bivariate Poisson Goal Distribution

- **Status**: Standard / Authoritative
- **Authors**: Quantitative Sports Modeling & Pricing Architecture
- **Applies to**: `backend/app/services/h2h_analytics.py`, `backend/app/services/odds_engine.py`, `lib/tactical_engine.ts`
- **Related Documents**: `docs/product-spec.md`, `docs/api-contract.md`

---

## 1. Abstract & Motivation

Standard independent Poisson models assume that home and away goals scored in a football match are statistically independent:
$$P(X = x, Y = y) = P(X = x) \times P(Y = y)$$
However, empirical football match analysis (Dixon & Coles, 1997) shows that low-scoring scorelines (especially `0-0`, `1-0`, `0-1`, and `1-1`) exhibit significant inter-dependence. Teams adjust tactical pressing and defensive depth dynamically based on match state, leading to a deficit of 0-0 and an excess of 1-1 and 1-0 results relative to independent Poisson predictions.

RFC 006 specifies the **Dixon-Coles Bivariate Poisson Engine** used by the Virtual Football Universe to compute pre-match and in-play exact score probabilities, 1X2 odds, Over/Under lines, and Both Teams To Score (BTTS) markets.

---

## 2. Mathematical Model

```
+-----------------------------------------------------------------------------------+
|                         CLUB ATTACK & DEFENSE RATINGS                            |
|        $\alpha_{home}$ (Attack)                 $\beta_{away}$ (Defense)          |
|        $\alpha_{away}$ (Attack)                 $\beta_{home}$ (Defense)          |
|        $\gamma$ (Home Pitch Advantage)          $\mu_{league}$ (Baseline goals)   |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                           EXPECTED GOAL INTENSITIES                               |
|        $\lambda = \alpha_{home} \cdot \beta_{away} \cdot \gamma \cdot \mu         |
|        $\mu_{goal} = \alpha_{away} \cdot \beta_{home} \cdot \mu                   |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                      DIXON-COLES LOW-SCORING ADJUSTMENT ($\tau$)                  |
|    $\tau(0,0) = 1 - \lambda \mu \rho \qquad\quad \tau(0,1) = 1 + \lambda \rho$    |
|    $\tau(1,0) = 1 + \mu \rho \qquad\quad\quad \tau(1,1) = 1 - \rho$               |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                      JOINT BIVARIATE PROBABILITY MATRIX ($P(x,y)$)                |
|    $P(X=x, Y=y) = \tau_{\lambda, \mu}(x, y) \cdot \frac{\lambda^x e^{-\lambda}}{x!} \cdot \frac{\mu^y e^{-\mu}}{y!}$ |
+-----------------------------------------------------------------------------------+
```

### 2.1 The Dixon-Coles Correction Function
For goals $x, y \in \{0, 1, 2, \dots, N\}$:

$$\tau_{\lambda, \mu}(x, y) = \begin{cases} 
      1 - \lambda \mu \rho & \text{if } x = 0, y = 0 \\
      1 + \lambda \rho & \text{if } x = 0, y = 1 \\
      1 + \mu \rho & \text{if } x = 1, y = 0 \\
      1 - \rho & \text{if } x = 1, y = 1 \\
      1 & \text{otherwise}
   \end{cases}$$

where $\rho \in [-0.15, -0.05]$ is the empirical correlation coefficient for European football (calibrated to $\rho = -0.11$ in the VFL engine).

---

## 3. In-Play Dynamic Goal Intensity Decay

During live simulation (from match clock $t = 0\text{s}$ to $480\text{s}$):
The remaining expected goals for the remainder of the fixture $\lambda_{rem}(t)$ decays linearly with elapsed match time:

$$\lambda_{rem}(t) = \lambda_0 \times \left(1 - \frac{t}{480}\right)$$
$$\mu_{rem}(t) = \mu_0 \times \left(1 - \frac{t}{480}\right)$$

If current score is $(g_h, g_a)$, the probability of finishing with final score $(x, y)$ where $x \ge g_h$ and $y \ge g_a$ is:
$$P_{final}(X = x, Y = y \mid g_h, g_a, t) = P(X' = x - g_h, Y' = y - g_a \mid \lambda_{rem}(t), \mu_{rem}(t))$$

---

## 4. Derived Betting Markets

From the joint distribution matrix $P(X = x, Y = y)$:

### 4.1 Match Outcome (1X2)
$$P(HomeWin) = \sum_{x > y} P(x, y)$$
$$P(Draw) = \sum_{x = y} P(x, y)$$
$$P(AwayWin) = \sum_{x < y} P(x, y)$$

### 4.2 Total Goals Over/Under (e.g. 2.5 Line)
$$P(Over 2.5) = \sum_{x + y \ge 3} P(x, y)$$
$$P(Under 2.5) = \sum_{x + y \le 2} P(x, y)$$

### 4.3 Both Teams to Score (BTTS)
$$P(BTTS_{Yes}) = \sum_{x \ge 1, y \ge 1} P(x, y)$$
$$P(BTTS_{No}) = 1 - P(BTTS_{Yes})$$

### 4.4 Bookmaker Overround & Margin Normalization
Decimal odds $O_k$ for any disjoint partition of outcomes with margin $M \in [0.04, 0.08]$:
$$O_k = \frac{1}{P_k \times (1 + M)}$$
Ensuring that $\sum \frac{1}{O_k} = 1 + M > 1.00$.
