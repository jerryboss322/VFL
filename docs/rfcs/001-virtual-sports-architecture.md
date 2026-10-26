# RFC 001: Virtual Sports Distributed Simulation Architecture

- **Status**: Standard / Authoritative
- **Authors**: Virtual Football Platform Architecture Working Group
- **Applies to**: `backend/engine/simulator.py`, `backend/app/services/simulation_tick.py`, `backend/app/main.py`
- **Related Documents**: `docs/product-spec.md`, `docs/simulation-rules.md`, `docs/api-contract.md`

---

## 1. Executive Summary & Problem Formulation

Virtual sports gaming platforms present a unique engineering contradiction:
1. **Perceived Continuous Real-Time Streaming**: Users demand live pitch telemetry, real-time clock tickers, in-play fluctuating odds, and audio commentary that updates seamlessly without client-side stalls.
2. **Serverless Infrastructure Realities**: Cloud environments such as Vercel Lambda, AWS Fargate, and Google Cloud Run execute in ephemeral, frozen, or autoscaled serverless containers without permanent daemon threads running in local RAM.
3. **Provable Fairness & Determinism**: Regulatory bodies (e.g., UKGC, MGA, GLI-19) strictly require that match outcomes are reproducible, mathematically deterministic, and unalterable by server downtime or network retransmissions.

RFC 001 specifies the **Stateless Tick Simulation and Wall-Clock Catch-Up Architecture** powering the Virtual Football Universe (VFL).

---

## 2. Core Architectural Principles

```
+-----------------------------------------------------------------------------------+
|                              WALL-CLOCK TIME ($t_{now}$)                         |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                        1. DETERMINISTIC PRNG SEED GENERATION                     |
|         $S = \text{HMAC-SHA256}(K_{secret}, \text{FixtureID} \parallel \text{SeasonID})$     |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                        2. PRE-COMPUTED DISCRETE EVENT TIMELINE                    |
|   Kickoff (0s) -> Chance (48s) -> Yellow (120s) -> HT (240s) -> Goal (380s) -> FT|
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                      3. STATELESS TICK CATCH-UP EVALUATION                       |
|   $\Delta t = (t_{now} - t_{kickoff}) \times M_{speed}$                           |
|   $Clock_{target} = \min(480, \max(0, \Delta t - \text{HalftimeBreak}))$          |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                     4. TRANSACTIONAL PERSISTENCE & BROADCAST                     |
|   Single Batch Flush -> WebSocket / SSE / Polling -> Cache-Control: no-store     |
+-----------------------------------------------------------------------------------+
```

### 2.1 Wall-Clock Convergence Invariant
Let $T_{start}$ be the scheduled kickoff timestamp in UTC. For any query executed at wall-clock time $t$:
$$\Delta t_{raw} = \max(0, (t - T_{start}) \cdot M_{speed})$$
where $M_{speed}$ is the simulation speed multiplier (default $1.0$).

The effective simulation match clock $C_{sim}(t) \in [0, 480]$ seconds (corresponding to 90 minutes of football) is defined piece-wise:

$$C_{sim}(t) = \begin{cases} 
      0 & \text{if } \Delta t_{raw} \le 0 \\
      \Delta t_{raw} & \text{if } 0 < \Delta t_{raw} \le 240 \text{ (First Half)} \\
      240 & \text{if } 240 < \Delta t_{raw} \le 240 + T_{HT} \text{ (Half-Time Interval)} \\
      \min(480, \Delta t_{raw} - T_{HT}) & \text{if } \Delta t_{raw} > 240 + T_{HT} \text{ (Second Half)}
   \end{cases}$$

where $T_{HT} = 10\text{ seconds}$ represents the tactical half-time break.

Regardless of whether the backend simulation tick is called every 1,000 milliseconds or after a 10-minute server pause, $C_{sim}(t)$ evaluates to the identical mathematical state.

---

## 3. Deterministic Seed & Event Generation

### 3.1 Cryptographic Entropy Derivation
Match event sequencing is isolated from runtime system entropy. Seeding follows:
$$\text{Seed} = \text{SHA256}(\text{FixtureUUID} \parallel \text{SeasonUUID} \parallel \text{HomeClubID} \parallel \text{AwayClubID})$$

This guarantees that:
- Every match replay produces byte-for-byte identical pass trajectories, shots, bookings, and VAR interventions.
- Neither platform operators nor end-users can predict match outcomes without access to the pre-hashed seed pipeline.
- Audit authorities can independently verify any settled ticket against the historical timeline.

### 3.2 Discrete Event Distribution
A virtual football match produces an expected event density of $\lambda = 0.08$ events per simulation second. Events are categorized as:
- `KICKOFF`: First half commencement ($t = 0\text{s}$) and second half recommencement ($t = 240\text{s}$).
- `PASS_SEQUENCE`: Positional possession buildup evaluated over a $16 \times 12$ pitch zone grid.
- `CHANCE`: Shot on target or off target governed by attacking club $xG$ and defensive resistance.
- `GOAL`: Official scoreline progression updating `home_goals` and `away_goals`.
- `FOUL` & `CARD`: Yellow/Red card disciplinary sanctions.
- `VAR_INTERVENTION`: Factual or subjective video assistant referee review.
- `FULL_TIME`: Final whistle triggering authoritative bet settlement.

---

## 4. Serverless Catch-Up Mechanics

On platforms like Vercel:
1. **Incoming Request Interception**:
   Every incoming HTTP request matching `/api/fixtures`, `/api/matches`, or `/api/odds` passes through the `lazy_simulation_catchup` middleware.
2. **Re-Entrancy & Lock Throttling**:
   To prevent stampedes during viral traffic spikes, execution is guarded by an asynchronous mutex lock with a minimum delta threshold:
   ```python
   if now - _last_lazy_tick >= 2.5 and not _lazy_tick_lock.locked():
       async with _lazy_tick_lock:
           if now - _last_lazy_tick >= 2.5:
               _last_lazy_tick = now
               await run_simulation_tick()
   ```
3. **Atomic Batch Persistence**:
   All mutated match states, scores, clock increments, and generated events commit in a single database transaction. This minimizes connection pool pressure on Neon / PostgreSQL and ensures clients never observe partial states.

---

## 5. Cache Invalidation & Edge Telemetry

To ensure real-time auto-updating across distributed Content Delivery Networks:
- **Client Cache Busting**: All dynamic GET calls append a high-resolution millisecond timestamp: `?_t={Date.now()}`.
- **Authoritative Headers**:
  ```http
  Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0
  Pragma: no-cache
  Expires: 0
  Surrogate-Control: no-store
  ```
- **Live Polling Frequency**: Client Match Center polls at 2,500ms intervals during active matchdays, falling back to 10,000ms during off-hours.

---

## 6. Security & Audit Verification

1. **No External Mutability**: The client cannot submit match clock adjustments, scores, or event overrides outside of signed Admin JWT tokens with `scope: superadmin`.
2. **Idempotent Settle Hooks**: Transitioning to `completed` fires the double-entry settlement engine exactly once per ticket using unique database transaction savepoints.
