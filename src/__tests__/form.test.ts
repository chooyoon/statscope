import { describe, it, expect } from "vitest";
import { calcHittingForm, calcPitchingForm } from "@/lib/sports/mlb/form";

describe("calcHittingForm", () => {
  it("returns neutral for insufficient data", () => {
    const result = calcHittingForm({ atBats: 3, ops: ".800", avg: ".300" });
    expect(result.trend).toBe("neutral");
    expect(result.label).toBe("Not enough data");
  });

  it("returns hot for elite OPS", () => {
    const result = calcHittingForm({
      atBats: 50,
      ops: "1.100",
      avg: ".350",
      homeRuns: 5,
    });
    expect(result.score).toBeGreaterThanOrEqual(140);
    expect(result.trend).toBe("hot");
  });

  it("returns cold for poor OPS", () => {
    const result = calcHittingForm({
      atBats: 50,
      ops: ".400",
      avg: ".140",
      homeRuns: 0,
    });
    expect(result.score).toBeLessThan(85);
    expect(["cold", "freezing"]).toContain(result.trend);
  });

  it("returns average for league-average stats", () => {
    const result = calcHittingForm({
      atBats: 50,
      ops: ".720",
      avg: ".250",
      homeRuns: 1,
    });
    expect(result.score).toBeGreaterThanOrEqual(85);
    expect(result.score).toBeLessThan(140);
  });

  it("score is clamped between 0 and 200", () => {
    const extreme = calcHittingForm({
      atBats: 10,
      ops: "2.000",
      avg: ".500",
      homeRuns: 5,
    });
    expect(extreme.score).toBeLessThanOrEqual(200);
    expect(extreme.score).toBeGreaterThanOrEqual(0);
  });
});

describe("calcPitchingForm", () => {
  it("returns neutral for insufficient innings", () => {
    const result = calcPitchingForm({ inningsPitched: "2.0", era: "3.00" });
    expect(result.trend).toBe("neutral");
  });

  it("returns hot for elite ERA", () => {
    const result = calcPitchingForm({ inningsPitched: "7.0", era: "1.50" });
    expect(result.score).toBeGreaterThanOrEqual(140);
    expect(result.trend).toBe("hot");
  });

  it("returns cold for high ERA", () => {
    const result = calcPitchingForm({ inningsPitched: "5.0", era: "8.00" });
    expect(result.score).toBeLessThan(85);
  });

  it("gives workload bonus for deep outings", () => {
    const short = calcPitchingForm({ inningsPitched: "4.0", era: "3.50" });
    const deep = calcPitchingForm({ inningsPitched: "7.0", era: "3.50" });
    expect(deep.score).toBeGreaterThan(short.score);
  });
});
