import { describe, expect, it } from "vitest";
import {
  FORMATION_PRESETS,
  calculateDynamicTeamPositions,
  computePitchControlGrid,
  generateBallPathForAction,
  getExpectedThreat,
  interpolateBezierCurve,
} from "./tactical_engine";

describe("tactical_engine", () => {
  it("provides 8 valid formation presets each with 11 players and a goalkeeper", () => {
    const keys = Object.keys(FORMATION_PRESETS);
    expect(keys.length).toBe(8);

    for (const key of keys) {
      const preset = FORMATION_PRESETS[key as keyof typeof FORMATION_PRESETS];
      expect(preset.players.length).toBe(11);
      const gks = preset.players.filter((p) => p.role === "GK");
      expect(gks.length).toBe(1);
    }
  });

  it("calculates Expected Threat (xT) highest near opponent goal center", () => {
    const goalCenter = getExpectedThreat(98, 50, true);
    const ownGoal = getExpectedThreat(2, 50, true);
    expect(goalCenter).toBeGreaterThan(0.9);
    expect(ownGoal).toBeLessThan(0.01);
  });

  it("computes mirrored positions for away team", () => {
    const formation = FORMATION_PRESETS["4-3-3"];
    const ballPos = { x: 50, y: 50 };
    const homeTeam = calculateDynamicTeamPositions(formation, ballPos, true);
    const awayTeam = calculateDynamicTeamPositions(formation, ballPos, false);

    const homeGk = homeTeam.find((p) => p.role === "GK")!;
    const awayGk = awayTeam.find((p) => p.role === "GK")!;

    expect(homeGk.currentX).toBeLessThan(20);
    expect(awayGk.currentX).toBeGreaterThan(80);
  });

  it("generates natural curved trajectory points for crosses and shots", () => {
    const start = { x: 80, y: 15 };
    const end = { x: 92, y: 50 };
    const trajectory = generateBallPathForAction(start, end, "cross");

    expect(trajectory.length).toBe(17); // 16 steps + 1
    // Peak height should be mid-trajectory
    const midPoint = trajectory[8]!;
    expect(midPoint.height).toBeGreaterThan(4.0);
    expect(trajectory[0]!.height).toBe(0);
  });

  it("computes pitch control grid cells with expected threat values", () => {
    const formation = FORMATION_PRESETS["4-3-3"];
    const ballPos = { x: 50, y: 50 };
    const homeTeam = calculateDynamicTeamPositions(formation, ballPos, true);
    const awayTeam = calculateDynamicTeamPositions(formation, ballPos, false);

    const grid = computePitchControlGrid(homeTeam, awayTeam, 8, 6);
    expect(grid.length).toBe(48);

    for (const cell of grid) {
      expect(cell.controlScore).toBeGreaterThanOrEqual(-1.0);
      expect(cell.controlScore).toBeLessThanOrEqual(1.0);
      expect(cell.expectedThreat).toBeGreaterThanOrEqual(0.0);
    }
  });

  it("interpolates smooth bezier points between start and end", () => {
    const p0 = { x: 0, y: 0 };
    const p1 = { x: 10, y: 50 };
    const p2 = { x: 90, y: 50 };
    const p3 = { x: 100, y: 100 };

    const start = interpolateBezierCurve(p0, p1, p2, p3, 0);
    const mid = interpolateBezierCurve(p0, p1, p2, p3, 0.5);
    const end = interpolateBezierCurve(p0, p1, p2, p3, 1);

    expect(start.x).toBe(0);
    expect(mid.x).toBe(50);
    expect(end.x).toBe(100);
  });
});
