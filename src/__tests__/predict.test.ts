import { describe, it, expect } from "vitest";
import { predictWinProbability, type PredictionResult } from "@/lib/sports/mlb/predict";

describe("predictWinProbability", () => {
  it("returns probabilities that sum to 100", () => {
    const result = predictWinProbability({
      homePitcherERA: 3.5,
      homePitcherWHIP: 1.2,
      homePitcherK: 150,
      homePitcherBB: 40,
      awayPitcherERA: 4.0,
      awayPitcherWHIP: 1.3,
      awayPitcherK: 130,
      awayPitcherBB: 50,
      homeRecentWinPct: 0.6,
      awayRecentWinPct: 0.5,
    });

    expect(result.homeWinPct + result.awayWinPct).toBeCloseTo(100, 0);
  });

  it("gives home team advantage with identical pitchers", () => {
    const result = predictWinProbability({
      homePitcherERA: 4.0,
      homePitcherWHIP: 1.3,
      homePitcherK: 100,
      homePitcherBB: 40,
      awayPitcherERA: 4.0,
      awayPitcherWHIP: 1.3,
      awayPitcherK: 100,
      awayPitcherBB: 40,
      homeRecentWinPct: 0.5,
      awayRecentWinPct: 0.5,
    });

    expect(result.homeWinPct).toBeGreaterThan(result.awayWinPct);
  });

  it("clamps predictions between 25-75", () => {
    const result = predictWinProbability({
      homePitcherERA: 1.0,
      homePitcherWHIP: 0.8,
      homePitcherK: 300,
      homePitcherBB: 20,
      awayPitcherERA: 9.0,
      awayPitcherWHIP: 2.5,
      awayPitcherK: 30,
      awayPitcherBB: 100,
      homeRecentWinPct: 1.0,
      awayRecentWinPct: 0.0,
    });

    expect(result.homeWinPct).toBeLessThanOrEqual(75);
    expect(result.awayWinPct).toBeGreaterThanOrEqual(25);
  });

  it("returns low confidence when ERA is 0", () => {
    const result = predictWinProbability({
      homePitcherERA: 0,
      homePitcherWHIP: 0,
      homePitcherK: 0,
      homePitcherBB: 0,
      awayPitcherERA: 4.0,
      awayPitcherWHIP: 1.3,
      awayPitcherK: 100,
      awayPitcherBB: 40,
      homeRecentWinPct: 0.5,
      awayRecentWinPct: 0.5,
    });

    expect(result.confidence).toBe("low");
  });

  it("returns all required fields", () => {
    const result = predictWinProbability({
      homePitcherERA: 3.5,
      homePitcherWHIP: 1.2,
      homePitcherK: 150,
      homePitcherBB: 40,
      awayPitcherERA: 4.0,
      awayPitcherWHIP: 1.3,
      awayPitcherK: 130,
      awayPitcherBB: 50,
      homeRecentWinPct: 0.6,
      awayRecentWinPct: 0.5,
    });

    expect(result).toHaveProperty("homeWinPct");
    expect(result).toHaveProperty("awayWinPct");
    expect(result).toHaveProperty("confidence");
    expect(result).toHaveProperty("factors");
    expect(result.factors.length).toBeGreaterThan(0);
  });
});
