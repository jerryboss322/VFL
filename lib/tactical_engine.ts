/**
 * Tactical Engine & Spatial Simulation Math
 *
 * Provides coordinate generation, formation structures, ball trajectory physics,
 * Voronoi-inspired spatial pitch control, and Expected Threat (xT) calculations
 * for the 2D Pitch Radar and In-Play Match Center.
 */

export type PitchCoordinate = {
  x: number; // 0 (home goal line) to 100 (away goal line)
  y: number; // 0 (top touchline) to 100 (bottom touchline)
};

export type PlayerRole =
  | "GK"
  | "CB"
  | "LB"
  | "RB"
  | "LWB"
  | "RWB"
  | "CDM"
  | "CM"
  | "CAM"
  | "LM"
  | "RM"
  | "LW"
  | "RW"
  | "ST"
  | "CF";

export interface TacticalPlayerPosition {
  number: number;
  name: string;
  role: PlayerRole;
  baseX: number; // normalized 0-100 on home attacking left-to-right
  baseY: number; // normalized 0-100
  currentX: number;
  currentY: number;
  rating: number; // 0.0 - 10.0 scale
}

export type FormationKey =
  | "4-3-3"
  | "4-2-3-1"
  | "3-5-2"
  | "4-4-2"
  | "5-3-2"
  | "3-4-3"
  | "4-1-4-1"
  | "4-5-1";

export interface FormationPreset {
  key: FormationKey;
  label: string;
  description: string;
  players: Omit<TacticalPlayerPosition, "currentX" | "currentY">[];
}

export type BallPhase =
  | "goalkeeper_buildup"
  | "defensive_possession"
  | "midfield_pivot"
  | "flank_progression"
  | "dangerous_attack"
  | "box_penetration"
  | "shot_on_goal"
  | "corner_kick"
  | "free_kick"
  | "penalty";

export interface BallTrajectoryPoint {
  x: number;
  y: number;
  height: number; // 0 (ground) to 10 (crossbar height / high ball)
  speed: number; // m/s
  curve: number; // deviation factor
}

export interface PitchControlCell {
  col: number;
  row: number;
  centerX: number;
  centerY: number;
  controlScore: number; // -1.0 (full away control) to +1.0 (full home control)
  expectedThreat: number; // 0.0 to 1.0 danger value
}

// ---------------------------------------------------------------------------
// 1. STANDARD FORMATION PRESETS (Normalized coordinates 0..100)
// ---------------------------------------------------------------------------

export const FORMATION_PRESETS: Record<FormationKey, FormationPreset> = {
  "4-3-3": {
    key: "4-3-3",
    label: "4-3-3 Attacking",
    description: "High offensive pressing with dynamic wingers and an anchor midfielder.",
    players: [
      { number: 1, name: "Goalkeeper", role: "GK", baseX: 5, baseY: 50, rating: 7.2 },
      { number: 2, name: "Right Back", role: "RB", baseX: 24, baseY: 85, rating: 7.0 },
      { number: 4, name: "Right Center Back", role: "CB", baseX: 20, baseY: 62, rating: 7.4 },
      { number: 5, name: "Left Center Back", role: "CB", baseX: 20, baseY: 38, rating: 7.5 },
      { number: 3, name: "Left Back", role: "LB", baseX: 24, baseY: 15, rating: 7.1 },
      { number: 6, name: "Defensive Midfielder", role: "CDM", baseX: 38, baseY: 50, rating: 7.6 },
      { number: 8, name: "Right Central Mid", role: "CM", baseX: 52, baseY: 68, rating: 7.3 },
      { number: 10, name: "Left Central Mid", role: "CM", baseX: 52, baseY: 32, rating: 7.8 },
      { number: 7, name: "Right Winger", role: "RW", baseX: 74, baseY: 84, rating: 7.9 },
      { number: 9, name: "Center Forward", role: "ST", baseX: 78, baseY: 50, rating: 8.2 },
      { number: 11, name: "Left Winger", role: "LW", baseX: 74, baseY: 16, rating: 7.7 },
    ],
  },
  "4-2-3-1": {
    key: "4-2-3-1",
    label: "4-2-3-1 Fluid",
    description: "Double pivot stability with a dedicated attacking playmaker in the hole.",
    players: [
      { number: 1, name: "Goalkeeper", role: "GK", baseX: 5, baseY: 50, rating: 7.3 },
      { number: 2, name: "Right Back", role: "RB", baseX: 25, baseY: 84, rating: 7.0 },
      { number: 4, name: "Right Center Back", role: "CB", baseX: 20, baseY: 62, rating: 7.3 },
      { number: 5, name: "Left Center Back", role: "CB", baseX: 20, baseY: 38, rating: 7.5 },
      { number: 3, name: "Left Back", role: "LB", baseX: 25, baseY: 16, rating: 7.2 },
      { number: 6, name: "Deep Pivot Right", role: "CDM", baseX: 40, baseY: 64, rating: 7.4 },
      { number: 8, name: "Deep Pivot Left", role: "CDM", baseX: 40, baseY: 36, rating: 7.5 },
      { number: 7, name: "Right Attacking Mid", role: "RM", baseX: 64, baseY: 82, rating: 7.6 },
      { number: 10, name: "Central Playmaker", role: "CAM", baseX: 62, baseY: 50, rating: 8.4 },
      { number: 11, name: "Left Attacking Mid", role: "LM", baseX: 64, baseY: 18, rating: 7.6 },
      { number: 9, name: "Striker", role: "ST", baseX: 80, baseY: 50, rating: 8.0 },
    ],
  },
  "3-5-2": {
    key: "3-5-2",
    label: "3-5-2 Wingback",
    description: "Three central defenders flanked by relentless wingbacks and twin strikers.",
    players: [
      { number: 1, name: "Goalkeeper", role: "GK", baseX: 5, baseY: 50, rating: 7.1 },
      { number: 3, name: "Left Center Back", role: "CB", baseX: 20, baseY: 28, rating: 7.2 },
      { number: 4, name: "Central Sweeper", role: "CB", baseX: 18, baseY: 50, rating: 7.6 },
      { number: 5, name: "Right Center Back", role: "CB", baseX: 20, baseY: 72, rating: 7.3 },
      { number: 11, name: "Left Wingback", role: "LWB", baseX: 46, baseY: 12, rating: 7.7 },
      { number: 6, name: "Holding Midfielder", role: "CDM", baseX: 40, baseY: 50, rating: 7.4 },
      { number: 8, name: "Box-to-Box Mid Left", role: "CM", baseX: 54, baseY: 34, rating: 7.5 },
      { number: 10, name: "Box-to-Box Mid Right", role: "CM", baseX: 54, baseY: 66, rating: 7.6 },
      { number: 2, name: "Right Wingback", role: "RWB", baseX: 46, baseY: 88, rating: 7.8 },
      { number: 9, name: "Left Target Man", role: "ST", baseX: 76, baseY: 38, rating: 8.1 },
      { number: 7, name: "Right Poacher", role: "ST", baseX: 76, baseY: 62, rating: 8.0 },
    ],
  },
  "4-4-2": {
    key: "4-4-2",
    label: "4-4-2 Classic",
    description: "Balanced bank of four with wide support and complementary striker pair.",
    players: [
      { number: 1, name: "Goalkeeper", role: "GK", baseX: 5, baseY: 50, rating: 7.0 },
      { number: 2, name: "Right Back", role: "RB", baseX: 24, baseY: 84, rating: 6.9 },
      { number: 4, name: "Right Center Back", role: "CB", baseX: 20, baseY: 62, rating: 7.2 },
      { number: 5, name: "Left Center Back", role: "CB", baseX: 20, baseY: 38, rating: 7.3 },
      { number: 3, name: "Left Back", role: "LB", baseX: 24, baseY: 16, rating: 7.1 },
      { number: 7, name: "Right Wide Mid", role: "RM", baseX: 50, baseY: 84, rating: 7.3 },
      { number: 8, name: "Central Mid Right", role: "CM", baseX: 48, baseY: 60, rating: 7.4 },
      { number: 6, name: "Central Mid Left", role: "CM", baseX: 48, baseY: 40, rating: 7.4 },
      { number: 11, name: "Left Wide Mid", role: "LM", baseX: 50, baseY: 16, rating: 7.3 },
      { number: 10, name: "Second Striker", role: "CF", baseX: 72, baseY: 42, rating: 7.9 },
      { number: 9, name: "Center Forward", role: "ST", baseX: 78, baseY: 58, rating: 8.0 },
    ],
  },
  "5-3-2": {
    key: "5-3-2",
    label: "5-3-2 Low Block",
    description: "Ultra-compact back five designed to deny space and strike on rapid transitions.",
    players: [
      { number: 1, name: "Goalkeeper", role: "GK", baseX: 5, baseY: 50, rating: 7.4 },
      { number: 3, name: "Left Wingback", role: "LWB", baseX: 22, baseY: 14, rating: 7.1 },
      { number: 5, name: "Left Center Back", role: "CB", baseX: 18, baseY: 32, rating: 7.3 },
      { number: 4, name: "Central Stopper", role: "CB", baseX: 16, baseY: 50, rating: 7.7 },
      { number: 6, name: "Right Center Back", role: "CB", baseX: 18, baseY: 68, rating: 7.3 },
      { number: 2, name: "Right Wingback", role: "RWB", baseX: 22, baseY: 86, rating: 7.1 },
      { number: 8, name: "Left Midfielder", role: "CM", baseX: 42, baseY: 30, rating: 7.3 },
      { number: 10, name: "Anchor Midfielder", role: "CDM", baseX: 38, baseY: 50, rating: 7.5 },
      { number: 7, name: "Right Midfielder", role: "CM", baseX: 42, baseY: 70, rating: 7.2 },
      { number: 11, name: "Pacey Forward", role: "ST", baseX: 70, baseY: 36, rating: 7.9 },
      { number: 9, name: "Target Man", role: "ST", baseX: 72, baseY: 64, rating: 8.1 },
    ],
  },
  "3-4-3": {
    key: "3-4-3",
    label: "3-4-3 High Press",
    description: "Total football geometry with aggressive wide overloads and front-three pressing.",
    players: [
      { number: 1, name: "Goalkeeper", role: "GK", baseX: 6, baseY: 50, rating: 7.2 },
      { number: 3, name: "Left Stopper", role: "CB", baseX: 22, baseY: 28, rating: 7.3 },
      { number: 4, name: "Ball-Playing Libero", role: "CB", baseX: 20, baseY: 50, rating: 7.8 },
      { number: 5, name: "Right Stopper", role: "CB", baseX: 22, baseY: 72, rating: 7.4 },
      { number: 11, name: "Left Midfield Wing", role: "LM", baseX: 50, baseY: 12, rating: 7.5 },
      { number: 8, name: "Central Engine Left", role: "CM", baseX: 48, baseY: 38, rating: 7.6 },
      { number: 6, name: "Central Engine Right", role: "CM", baseX: 48, baseY: 62, rating: 7.5 },
      { number: 2, name: "Right Midfield Wing", role: "RM", baseX: 50, baseY: 88, rating: 7.5 },
      { number: 10, name: "Left Inverted Winger", role: "LW", baseX: 74, baseY: 22, rating: 8.2 },
      { number: 9, name: "Complete Forward", role: "ST", baseX: 78, baseY: 50, rating: 8.4 },
      { number: 7, name: "Right Inverted Winger", role: "RW", baseX: 74, baseY: 78, rating: 8.1 },
    ],
  },
  "4-1-4-1": {
    key: "4-1-4-1",
    label: "4-1-4-1 Deep Playmaker",
    description: "Single deep anchor with four advanced midfielders protecting the center line.",
    players: [
      { number: 1, name: "Goalkeeper", role: "GK", baseX: 5, baseY: 50, rating: 7.1 },
      { number: 2, name: "Right Fullback", role: "RB", baseX: 24, baseY: 84, rating: 7.0 },
      { number: 4, name: "Right Center Back", role: "CB", baseX: 20, baseY: 62, rating: 7.3 },
      { number: 5, name: "Left Center Back", role: "CB", baseX: 20, baseY: 38, rating: 7.4 },
      { number: 3, name: "Left Fullback", role: "LB", baseX: 24, baseY: 16, rating: 7.2 },
      { number: 6, name: "Regista Anchor", role: "CDM", baseX: 36, baseY: 50, rating: 8.0 },
      { number: 7, name: "Right Midfielder", role: "RM", baseX: 56, baseY: 82, rating: 7.4 },
      { number: 8, name: "Right Interior Mid", role: "CM", baseX: 54, baseY: 62, rating: 7.6 },
      { number: 10, name: "Left Interior Mid", role: "CM", baseX: 54, baseY: 38, rating: 7.7 },
      { number: 11, name: "Left Midfielder", role: "LM", baseX: 56, baseY: 18, rating: 7.5 },
      { number: 9, name: "Lone Striker", role: "ST", baseX: 78, baseY: 50, rating: 8.1 },
    ],
  },
  "4-5-1": {
    key: "4-5-1",
    label: "4-5-1 Solid Wall",
    description: "Five across midfield to choke passing lanes against possession-heavy opponents.",
    players: [
      { number: 1, name: "Goalkeeper", role: "GK", baseX: 5, baseY: 50, rating: 7.2 },
      { number: 2, name: "Right Back", role: "RB", baseX: 22, baseY: 84, rating: 7.0 },
      { number: 4, name: "Right Center Back", role: "CB", baseX: 18, baseY: 62, rating: 7.4 },
      { number: 5, name: "Left Center Back", role: "CB", baseX: 18, baseY: 38, rating: 7.4 },
      { number: 3, name: "Left Back", role: "LB", baseX: 22, baseY: 16, rating: 7.1 },
      { number: 7, name: "Right Defensive Wing", role: "RM", baseX: 44, baseY: 84, rating: 7.1 },
      { number: 8, name: "Midfield Shuttler Right", role: "CM", baseX: 42, baseY: 64, rating: 7.3 },
      { number: 6, name: "Central Destroyer", role: "CDM", baseX: 38, baseY: 50, rating: 7.6 },
      { number: 10, name: "Midfield Shuttler Left", role: "CM", baseX: 42, baseY: 36, rating: 7.3 },
      { number: 11, name: "Left Defensive Wing", role: "LM", baseX: 44, baseY: 16, rating: 7.1 },
      { number: 9, name: "Target Man Outlet", role: "ST", baseX: 74, baseY: 50, rating: 7.9 },
    ],
  },
};

// ---------------------------------------------------------------------------
// 2. EXPECTED THREAT (xT) MATRIX (16 Columns x 12 Rows)
// Values reflect probability of possession ending in a goal within 5 actions.
// ---------------------------------------------------------------------------

const XT_BASE_GRID: number[][] = [
  // Rows 0-11, each containing 16 column values from left goal to right goal
  [0.001, 0.001, 0.002, 0.003, 0.004, 0.006, 0.008, 0.012, 0.018, 0.026, 0.038, 0.054, 0.078, 0.112, 0.165, 0.220],
  [0.001, 0.002, 0.003, 0.004, 0.006, 0.009, 0.014, 0.021, 0.030, 0.044, 0.065, 0.095, 0.140, 0.198, 0.280, 0.360],
  [0.002, 0.003, 0.004, 0.006, 0.009, 0.014, 0.022, 0.032, 0.048, 0.070, 0.104, 0.155, 0.230, 0.330, 0.460, 0.580],
  [0.002, 0.003, 0.005, 0.008, 0.012, 0.018, 0.028, 0.042, 0.064, 0.096, 0.145, 0.220, 0.330, 0.480, 0.680, 0.820],
  [0.003, 0.004, 0.006, 0.010, 0.015, 0.024, 0.036, 0.056, 0.084, 0.128, 0.195, 0.295, 0.440, 0.640, 0.860, 0.980],
  [0.003, 0.004, 0.007, 0.011, 0.017, 0.026, 0.040, 0.062, 0.094, 0.142, 0.215, 0.325, 0.480, 0.700, 0.920, 1.000],
  [0.003, 0.004, 0.007, 0.011, 0.017, 0.026, 0.040, 0.062, 0.094, 0.142, 0.215, 0.325, 0.480, 0.700, 0.920, 1.000],
  [0.003, 0.004, 0.006, 0.010, 0.015, 0.024, 0.036, 0.056, 0.084, 0.128, 0.195, 0.295, 0.440, 0.640, 0.860, 0.980],
  [0.002, 0.003, 0.005, 0.008, 0.012, 0.018, 0.028, 0.042, 0.064, 0.096, 0.145, 0.220, 0.330, 0.480, 0.680, 0.820],
  [0.002, 0.003, 0.004, 0.006, 0.009, 0.014, 0.022, 0.032, 0.048, 0.070, 0.104, 0.155, 0.230, 0.330, 0.460, 0.580],
  [0.001, 0.002, 0.003, 0.004, 0.006, 0.009, 0.014, 0.021, 0.030, 0.044, 0.065, 0.095, 0.140, 0.198, 0.280, 0.360],
  [0.001, 0.001, 0.002, 0.003, 0.004, 0.006, 0.008, 0.012, 0.018, 0.026, 0.038, 0.054, 0.078, 0.112, 0.165, 0.220],
];

export function getExpectedThreat(x: number, y: number, attackingLeftToRight: boolean = true): number {
  const normX = Math.max(0, Math.min(99.9, x));
  const normY = Math.max(0, Math.min(99.9, y));

  const effectiveX = attackingLeftToRight ? normX : 100 - normX;
  const col = Math.min(15, Math.floor((effectiveX / 100) * 16));
  const row = Math.min(11, Math.floor((normY / 100) * 12));

  return XT_BASE_GRID[row]?.[col] ?? 0.01;
}

// ---------------------------------------------------------------------------
// 3. TEAM POSITIONAL SHIFT & TACTICAL INTERPOLATION
// ---------------------------------------------------------------------------

export function calculateDynamicTeamPositions(
  formation: FormationPreset,
  ballPos: PitchCoordinate,
  isHomeTeam: boolean,
  teamAttackingIntensity: number = 1.0, // 0.5 (defensive) to 1.5 (all-out attack)
): TacticalPlayerPosition[] {
  return formation.players.map((base) => {
    // If away team, mirror coordinates along X axis (100 - x) and slightly reverse Y
    let rawX = isHomeTeam ? base.baseX : 100 - base.baseX;
    let rawY = isHomeTeam ? base.baseY : 100 - base.baseY;

    // Goalkeepers stay mostly tethered to their line
    if (base.role === "GK") {
      const gkX = isHomeTeam ? 5 + Math.min(10, ballPos.x * 0.08) : 95 - Math.min(10, (100 - ballPos.x) * 0.08);
      const gkY = 50 + (ballPos.y - 50) * 0.22;
      return {
        ...base,
        currentX: gkX,
        currentY: gkY,
      };
    }

    // Outfield players shift towards the ball vector with inertia
    const deltaX = (ballPos.x - rawX) * 0.22 * teamAttackingIntensity;
    const deltaY = (ballPos.y - rawY) * 0.18;

    // Role-specific constraints
    let clampMinX = 12;
    let clampMaxX = 92;
    if (base.role === "CB") {
      clampMaxX = isHomeTeam ? 65 : 88;
      clampMinX = isHomeTeam ? 12 : 35;
    } else if (base.role === "ST" || base.role === "CF") {
      clampMinX = isHomeTeam ? 40 : 12;
      clampMaxX = isHomeTeam ? 94 : 60;
    }

    const currentX = Math.max(clampMinX, Math.min(clampMaxX, rawX + deltaX));
    const currentY = Math.max(8, Math.min(92, rawY + deltaY));

    return {
      ...base,
      currentX,
      currentY,
    };
  });
}

// ---------------------------------------------------------------------------
// 4. BALL TRAJECTORY & SMOOTH BÉZIER CURVES
// ---------------------------------------------------------------------------

export function interpolateBezierCurve(
  p0: PitchCoordinate,
  p1: PitchCoordinate,
  p2: PitchCoordinate,
  p3: PitchCoordinate,
  t: number,
): PitchCoordinate {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;

  const x = uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x;
  const y = uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y;

  return { x, y };
}

export function generateBallPathForAction(
  start: PitchCoordinate,
  end: PitchCoordinate,
  style: "pass" | "cross" | "shot" | "clearance",
): BallTrajectoryPoint[] {
  const points: BallTrajectoryPoint[] = [];
  const steps = 16;

  // Compute control points for natural arc
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;

  let maxHeight = 0;
  let curvature = 0;

  if (style === "cross") {
    maxHeight = 7.5;
    curvature = (start.y > 50 ? -12 : 12);
  } else if (style === "shot") {
    maxHeight = 2.4;
    curvature = (Math.random() - 0.5) * 6;
  } else if (style === "clearance") {
    maxHeight = 9.0;
    curvature = (Math.random() - 0.5) * 8;
  } else {
    maxHeight = 0.5; // low ground pass
    curvature = 0;
  }

  const cp1: PitchCoordinate = { x: start.x + (midX - start.x) * 0.5, y: start.y + curvature };
  const cp2: PitchCoordinate = { x: midX + (end.x - midX) * 0.5, y: midY + curvature };

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const pos = interpolateBezierCurve(start, cp1, cp2, end, t);
    // Parabolic arc for height: 4 * h * t * (1 - t)
    const height = 4 * maxHeight * t * (1 - t);
    const speed = 25 - t * 8; // deceleration factor
    points.push({
      x: Number(pos.x.toFixed(2)),
      y: Number(pos.y.toFixed(2)),
      height: Number(height.toFixed(2)),
      speed: Number(speed.toFixed(1)),
      curve: curvature,
    });
  }

  return points;
}

// ---------------------------------------------------------------------------
// 5. PITCH CONTROL CELL MATRIX GENERATOR (Voronoi-like Grid)
// ---------------------------------------------------------------------------

export function computePitchControlGrid(
  homePlayers: TacticalPlayerPosition[],
  awayPlayers: TacticalPlayerPosition[],
  cols: number = 8,
  rows: number = 6,
): PitchControlCell[] {
  const grid: PitchControlCell[] = [];
  const cellWidth = 100 / cols;
  const cellHeight = 100 / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const centerX = c * cellWidth + cellWidth / 2;
      const centerY = r * cellHeight + cellHeight / 2;

      // Calculate inverse-distance-weighted control from home vs away
      let homeInfluence = 0;
      for (const p of homePlayers) {
        const d = Math.hypot(p.currentX - centerX, p.currentY - centerY);
        homeInfluence += (p.rating / 7.5) / Math.max(1, d * d);
      }

      let awayInfluence = 0;
      for (const p of awayPlayers) {
        const d = Math.hypot(p.currentX - centerX, p.currentY - centerY);
        awayInfluence += (p.rating / 7.5) / Math.max(1, d * d);
      }

      const total = homeInfluence + awayInfluence;
      const rawScore = total > 0 ? (homeInfluence - awayInfluence) / total : 0;
      const controlScore = Math.max(-1.0, Math.min(1.0, rawScore));
      const expectedThreat = getExpectedThreat(centerX, centerY, controlScore >= 0);

      grid.push({
        col: c,
        row: r,
        centerX: Number(centerX.toFixed(1)),
        centerY: Number(centerY.toFixed(1)),
        controlScore: Number(controlScore.toFixed(3)),
        expectedThreat: Number(expectedThreat.toFixed(3)),
      });
    }
  }

  return grid;
}
