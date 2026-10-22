# Simulation Rules & Mathematical Model

## Time Mapping
- **Standard Match Duration**: $480\text{ wall-clock seconds}$ ($8\text{ minutes}$) mapped linearly to $90\text{ football minutes}$ ($1\text{ football minute} \approx 5.33\text{ wall-clock seconds}$).
- **Match Clock**:
  - `clock_seconds` ranges from `0` to `480`.
  - Displayed match minute is $\min(90, \lfloor \text{clock\_seconds} \times 90 / 480 \rfloor + 1)$.

## Club Ratings & Expected Goals ($\lambda$)
- Each club has:
  - `attack_rating` $\in [0.75, 1.35]$
  - `defense_rating` $\in [0.75, 1.35]$ (higher defense rating reduces opponent expected goals)
- Baseline league goals per team: $\mu_0 = 1.35$, with home advantage factor $\gamma_{\text{home}} = 1.12$:
  $$\lambda_{\text{home}} = \mu_0 \cdot \gamma_{\text{home}} \cdot \frac{\text{Attack}_{\text{home}}}{\text{Defense}_{\text{away}}}, \quad \lambda_{\text{away}} = \mu_0 \cdot \frac{\text{Attack}_{\text{away}}}{\text{Defense}_{\text{home}}}$$

## Event Generation & Determinism
- Matches are seeded deterministically from `(fixture_id, seed)` so event timelines are reproducible and crash-recoverable.
- Events are ordered strictly by `event_seq` (`1..N`), with `minute` ($0 \dots 90$) and `clock_seconds` ($0 \dots 480$):
  - `kickoff` at `clock_seconds = 0` (`minute = 0`)
  - `chance`, `card`, `goal` distributed across minutes $1 \dots 90$ (`clock_seconds` $1 \dots 479$)
  - `full_time` at `clock_seconds = 480` (`minute = 90`)
- Bookmaker exposure never influences match outcomes.
