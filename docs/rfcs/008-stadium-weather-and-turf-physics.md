# RFC 008: Stadium Microclimate Weather & Ball Physics Engine

- **Status**: Standard / Authoritative
- **Authors**: Match Simulation Physics & Environmental Modeling Working Group
- **Applies to**: `backend/app/services/weather_engine.py`, `backend/app/services/player_fitness_engine.py`, `components/PitchWeatherGauge.tsx`
- **Related Documents**: `docs/product-spec.md`, `docs/simulation-rules.md`

---

## 1. Abstract & Scope

Atmospheric conditions and pitch turf quality exert physical influence on the trajectory of passes, the velocity of shots, goalkeeper handling reliability, and player stamina degradation. In elite professional leagues, rain accelerates the surface skid of ground passes while extreme heat exacerbates cardiovascular fatigue.

RFC 008 defines the mathematical formulation for:
1. Dynamic European stadium microclimate generation.
2. Aerodynamic wind drift and ball drag calculations.
3. Turf friction coefficients under differing precipitation states.
4. Player thermal exhaustion and stamina burn multipliers.

---

## 2. Atmospheric Parameter Modeling

Every matchday associates each host stadium with an authoritative microclimate profile:

```
+-----------------------------------------------------------------------------------+
|                            STADIUM METEOROLOGICAL PROFILE                        |
+-----------------------------------------------------------------------------------+
       |                                   |                                  |
       v                                   v                                  v
 PRECIPITATION STATE             TEMPERATURE & HUMIDITY                  WIND VECTOR
 - CLEAR (0 mm/h)                - Temperature: $T \in [-5, +35]^\circ\text{C}$ - Velocity: $V_w \in [0, 60]\text{ km/h}$
 - DRIZZLE (1-3 mm/h)            - Relative Humidity: $H \in [30, 98]\%$         - Bearing: $\theta_w \in [0, 360]^\circ$
 - HEAVY RAIN (8-15 mm/h)        - Air Density: $\rho_{air}(T, H)$               - Gust Factor: $G \in [1.0, 1.4]$
 - SNOW (Frozen pitch)
```

---

## 3. Ball Aerodynamics & Wind Drift

The aerodynamic drag and wind-relative acceleration acting on the ball in flight is modeled via the Rayleigh drag equation:

$$\vec{F}_{drag} = -\frac{1}{2} \rho_{air} C_d A \|\vec{v}_{rel}\| \vec{v}_{rel}$$

where:
- $\rho_{air}$ is ambient air density ($\sim 1.225\text{ kg/m}^3$ at sea level).
- $C_d$ is the football drag coefficient ($C_d \approx 0.25$ for subcritical laminar flow).
- $A = \pi r^2 \approx 0.038\text{ m}^2$ (standard FIFA Size 5 ball).
- $\vec{v}_{rel} = \vec{v}_{ball} - \vec{v}_{wind}$ is the relative velocity vector.

Long passes against a strong headwind ($V_w > 30\text{ km/h}$) suffer range attenuation up to $18\%$, while tailwind assists long-range shot velocity.

---

## 4. Pitch Turf Friction & Ball Skid Dynamics

Ground ball deceleration is governed by the kinetic friction coefficient $\mu_k$:

$$a_{roll} = -\mu_k \cdot g$$

where $g = 9.81\text{ m/s}^2$ and $\mu_k$ varies by pitch drainage and moisture:

| Pitch Condition | Moisture Level | Kinetic Friction $\mu_k$ | Ball Behavior |
| :--- | :---: | :---: | :--- |
| **Pristine Firm Ground** | Low | $0.45$ | Standard bounce and predictable roll |
| **Wet Slick Surface** | Medium (Light Rain) | $0.32$ | Accelerated skid; fast transition passing favored |
| **Waterlogged Pitch** | High (Heavy Downpour) | $0.68$ | High resistance; ball stops in standing puddles |
| **Snow / Frozen Surface** | Frozen | $0.25$ | Extreme slippery sliding; handling errors $+40\%$ |

---

## 5. Thermal Strain & Player Fatigue Multiplication

Player stamina depletion during high-intensity pressing is scaled by the **Thermal Discomfort Index** (Humidex / Wind Chill):

$$M_{fatigue} = 1.0 + \Delta_{thermal}$$

where:
$$\Delta_{thermal} = \begin{cases} 
      \frac{T - 26}{30} \times 0.35 & \text{if } T > 26^\circ\text{C} \text{ (Heat exhaustion)} \\
      \frac{2 - T}{20} \times 0.20 & \text{if } T < 2^\circ\text{C} \text{ (Cold muscle stiffness)} \\
      0.0 & \text{otherwise (Temperate ideal)}
   \end{cases}$$

Under extreme heat ($34^\circ\text{C}$), stamina depletes $10.5\%$ faster, increasing late-match goal concession probabilities between the 75th and 90th simulation minutes.
