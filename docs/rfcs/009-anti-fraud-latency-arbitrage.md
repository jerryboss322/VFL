# RFC 009: Anti-Fraud, Bot Velocity & Latency Arbitrage Detection Engine

- **Status**: Standard / Authoritative
- **Authors**: Information Security & Trading Risk Architecture
- **Applies to**: `backend/app/services/anti_fraud_engine.py`, `backend/tests/test_anti_fraud_engine.py`, `backend/app/api/admin.py`
- **Related Documents**: `docs/financial-ledger.md`, `docs/api-contract.md`

---

## 1. Abstract & Threat Taxonomy

Modern sportsbooks face adversarial automated agents attempting to extract risk-free value through:
1. **Latency Arbitrage (Courtsiding)**: Exploiting millisecond propagation delays between match event triggers (e.g. goal scored, penalty awarded) and market suspension locks to submit bets at stale odds.
2. **High-Frequency Bot Velocity**: Flooding the trading engine with dozens of automated wagers per second to overwhelm rate limits or execute micro-arbitrage.
3. **Syndicated Stake Concentration**: Coordinating multiple colluding user accounts from identical IP subnets or device fingerprints to bypass individual maximum stake limits.

RFC 009 specifies the detection pipelines, velocity filters, and automated mitigation countermeasures enforced by the VFL trading infrastructure.

---

## 2. Detection Pipeline Architecture

```
                                  INCOMING BET PLACEMENT REQUEST
                                                |
                                                v
+-----------------------------------------------------------------------------------+
|                        1. TIMESTAMP DELTA ARBITRAGE AUDIT                         |
|   $\Delta t = t_{submission} - t_{last\_significant\_event}$                      |
|   If $\Delta t < 500\text{ ms}$: SUSPECT LATENCY ARBITRAGE (Rejection / Hold)     |
+-----------------------------------------------------------------------------------+
                                                |
                                                v
+-----------------------------------------------------------------------------------+
|                        2. VELOCITY & FREQUENCY INSPECTION                         |
|   $V_{window} = \text{Count}(UserTickets \text{ in last 10s})$                    |
|   If $V_{window} > 6$: FLAGGED (Algorithmic Trading Bot Detected)                 |
+-----------------------------------------------------------------------------------+
                                                |
                                                v
+-----------------------------------------------------------------------------------+
|                        3. SHARP STAKE CONCENTRATION AUDIT                         |
|   $S_{ratio} = \frac{\text{RequestedStake}}{\text{UserHistoricalAvgStake}}$       |
|   If $S_{ratio} > 15.0 \land \text{RiskProfile} = \text{Sharp}$: ESCALATED        |
+-----------------------------------------------------------------------------------+
                                                |
                                                v
+-----------------------------------------------------------------------------------+
|                        4. RISK SCORING & MITIGATION GATE                          |
|   Score $\in [0, 100]$: PASS $\rightarrow$ ACCEPT; SUSPICIOUS $\rightarrow$ DELAY; CRITICAL $\rightarrow$ REJECT  |
+-----------------------------------------------------------------------------------+
```

---

## 3. Mathematical Risk Scoring Matrix

A composite Risk Index $R \in [0, 100]$ is computed dynamically for every ticket:

$$R = \min\left(100, W_{lat} \cdot S_{lat} + W_{vel} \cdot S_{vel} + W_{stake} \cdot S_{stake} + W_{ip} \cdot S_{ip}\right)$$

where weights $W = [0.40, 0.25, 0.20, 0.15]$ and sub-scores $S \in [0, 100]$:

### 3.1 Sub-Score Formulations
1. **Latency Proximity Score ($S_{lat}$)**:
   $$S_{lat} = \begin{cases} 
         100 & \text{if } \Delta t < 200\text{ ms} \\
         80 & \text{if } 200\text{ ms} \le \Delta t < 500\text{ ms} \\
         40 & \text{if } 500\text{ ms} \le \Delta t < 1200\text{ ms} \\
         0 & \text{otherwise}
      \end{cases}$$

2. **Velocity Score ($S_{vel}$)**:
   $$S_{vel} = \min(100, \max(0, (V_{10s} - 3) \times 25))$$

3. **Stake Anomaly Score ($S_{stake}$)**:
   $$S_{stake} = \min(100, \max(0, (S_{ratio} - 5) \times 10))$$

---

## 4. Mitigation Actions & State Transitions

Based on the computed Risk Index $R$:

| Risk Tier | Index Range | Immediate Action | Trader Experience |
| :--- | :---: | :--- | :--- |
| **NORMAL** | $0 \le R < 40$ | Instant Placement | Sub-50ms execution confirmation |
| **ELEVATED** | $40 \le R < 70$ | Artificial Delay ($1.5\text{s}$) | Countdown spinner; odds re-check at $t + 1.5\text{s}$ |
| **HIGH** | $70 \le R < 85$ | Artificial Delay ($3.5\text{s}$) + Stake Cap | Max stake constrained to $50,000$ minor units |
| **CRITICAL** | $R \ge 85$ | Deterministic Rejection | Return HTTP 403 `SUSPICIOUS_ARBITRAGE_REJECTED` |

---

## 5. Audit Logging & Compliance Ledger

All flagged violations record an immutable security event in `backend/app/services/anti_fraud_engine.py`:
- Actor User ID & Session IP.
- Microsecond timestamp delta to target event.
- Odds snapshot version identifier.
- Automated defense action triggered.
