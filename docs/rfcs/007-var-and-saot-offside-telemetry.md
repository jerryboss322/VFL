# RFC 007: Video Assistant Referee (VAR) & Semi-Automated Offside Technology (SAOT) Telemetry

- **Status**: Standard / Authoritative
- **Authors**: Match Officiating Technology & Computer Vision Working Group
- **Applies to**: `backend/app/services/var_engine.py`, `components/VarReviewModal.tsx`, `app/var-center/page.tsx`
- **Related Documents**: `docs/product-spec.md`, `docs/simulation-rules.md`

---

## 1. Abstract & Scope

Video Assistant Referee (VAR) integration transforms virtual sports broadcasts into hyper-realistic, emotionally charged spectator experiences. Modern football officiating utilizes high-resolution computer vision and millimeter-precision Semi-Automated Offside Technology (SAOT). 

RFC 007 specifies the decision protocols, optical tracking geometry, ball-release frame calibration, and subjective On-Field Review (OFR) probability engines powering the VFL officiating system.

---

## 2. Reviewable Incidents Under IFAB Protocol

VAR interventions are strictly restricted to four match-changing categories:

```
+-----------------------------------------------------------------------------------+
|                           POTENTIAL MATCH INCIDENT OCCURS                         |
+-----------------------------------------------------------------------------------+
                                         |
         +-------------------------------+-------------------------------+
         |                               |                               |
         v                               v                               v
[GOAL / NO GOAL]                [PENALTY / NO PENALTY]          [DIRECT RED CARD]
- Offside in buildup             - Foul inside penalty box       - Violent conduct
- Foul committed by attacker     - Simulation / diving           - Serious foul play
- Ball out of play               - Outside / inside box check    - Denial of goal (DOGSO)
```

---

## 3. Semi-Automated Offside Technology (SAOT)

```
                            OPTICAL TRACKING SENSORS (120 FPS)
                                            |
                                            v
                      29 ANATOMICAL SKELETAL LANDMARKS PER PLAYER
     (Head, Shoulders, Elbows, Wrists, Pelvis, Kneecaps, Ankles, Big Toes, Heels)
                                            |
                                            v
+-----------------------------------------------------------------------------------+
|                        1. BALL RELEASE MOMENT DETERMINATION                       |
|         Inertial Measurement Unit (IMU) sensor inside ball @ 500 Hz               |
|         Frame locked at millisecond of passing contact $t_{kick}$                 |
+-----------------------------------------------------------------------------------+
                                            |
                                            v
+-----------------------------------------------------------------------------------+
|                        2. 3D PITCH RE-PROJECTION & LINING                         |
|   Attacker Leading Limb: $X_{att}$ (excluding hands/arms per legal scoring rules) |
|   Last Defender Limb:    $X_{def}$                                                |
|   $\Delta X = X_{att} - X_{def}$                                                  |
+-----------------------------------------------------------------------------------+
                                            |
                                            v
+-----------------------------------------------------------------------------------+
|                       3. FACTUAL MILLIMETER DECISION RENDER                       |
|   If $\Delta X > 0$: OFFSIDE (Disallow goal)                                      |
|   If $\Delta X \le 0$: ONSIDE (Goal confirmed)                                    |
+-----------------------------------------------------------------------------------+
```

### 3.1 Anatomical Point Filtering
In accordance with IFAB Law 11, the hands and arms of all players (including goalkeepers) are excluded from offside evaluation. The boundary of the arm aligns with the bottom of the armpit.

The engine measures:
$$X_{att}^{max} = \max_{p \in \text{LegalPoints}} X_{att}(p)$$
$$X_{def}^{max} = \max_{p \in \text{LegalPoints}} X_{def}(p)$$

$$\text{Margin}_{\Delta} = X_{att}^{max} - X_{def}^{max}$$

If $\text{Margin}_{\Delta} > 0$, the player is offside.

---

## 4. Subjective On-Field Review (OFR) Decision Tree

For non-factual decisions (e.g., penalty fouls, reckless tackles, handball unnatural body silhouette):
1. **VAR Recommendation**:
   The video booth detects a "clear and obvious error" with confidence $C_{var} \in [0.70, 1.00]$.
2. **Pitchside Monitor Consultation**:
   The center referee halts play and jogs to the pitchside monitor (OFR review duration $T_{ofr} \in [45, 120]$ seconds).
3. **Overturn Probability**:
   Empirically, European referees overturn their initial on-field call upon attending the pitchside monitor in $82\%$ of instances:
   $$P(Overturn \mid OFR) = 0.82$$
4. **Broadcast Delay & Animation**:
   The client UI renders the monitor review sequence, displaying frame offsets, camera angles (CAM 01 Broadcast, CAM 04 SAOT 3D, CAM 07 Close-up High-Speed), and final official verdict.
