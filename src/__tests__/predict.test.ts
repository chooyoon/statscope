import { describe, it, expect } from "vitest";
import {
  predictWinProbability,
  predictOdds,
  pythagoreanWinPct,
  log5,
  toAmericanOdds,
  type AdvancedPredictionInput,
} from "@/lib/sports/mlb/predict";

// Helper to build a default input that can be selectively overridden
function makeInput(
  overrides: Partial<{
    home: Partial<AdvancedPredictionInput["home"]>;
    away: Partial<AdvancedPredictionInput["away"]>;
    homeStarter: AdvancedPredictionInput["homeStarter"];
    awayStarter: AdvancedPredictionInput["awayStarter"];
    parkFactor: number;
  }> = {},
): AdvancedPredictionInput {
  return {
    home: {
      wins: 50, losses: 40,
      runsScored: 400, runsAllowed: 350,
      last10Wins: 6, last10Losses: 4,
      teamERA: 3.80, teamWOBA: 0.325,
      ...overrides.home,
    },
    away: {
      wins: 45, losses: 45,
      runsScored: 370, runsAllowed: 370,
      last10Wins: 5, last10Losses: 5,
      teamERA: 4.10, teamWOBA: 0.310,
      ...overrides.away,
    },
    homeStarter: overrides.homeStarter !== undefined
      ? overrides.homeStarter
      : { era: 3.5, fip: 3.2, whip: 1.15, inningsPitched: 100, strikeOuts: 120, baseOnBalls: 30 },
    awayStarter: overrides.awayStarter !== undefined
      ? overrides.awayStarter
      : { era: 4.2, fip: 4.0, whip: 1.30, inningsPitched: 90, strikeOuts: 95, baseOnBalls: 40 },
    parkFactor: overrides.parkFactor ?? 1.0,
  };
}

// ---------------------------------------------------------------------------
// Core math helpers
// ---------------------------------------------------------------------------

describe("pythagoreanWinPct", () => {
  it("returns 0.5 when RS === RA", () => {
    expect(pythagoreanWinPct(400, 400)).toBeCloseTo(0.5, 5);
  });

  it("returns > 0.5 when RS > RA", () => {
    expect(pythagoreanWinPct(500, 400)).toBeGreaterThan(0.5);
  });

  it("returns < 0.5 when RS < RA", () => {
    expect(pythagoreanWinPct(350, 450)).toBeLessThan(0.5);
  });

  it("returns 0.5 when both are zero", () => {
    expect(pythagoreanWinPct(0, 0)).toBe(0.5);
  });
});

describe("log5", () => {
  it("returns 0.5 when both teams are .500", () => {
    expect(log5(0.5, 0.5)).toBeCloseTo(0.5, 5);
  });

  it("returns > 0.5 when team A is stronger", () => {
    expect(log5(0.6, 0.45)).toBeGreaterThan(0.5);
  });

  it("returns < 0.5 when team A is weaker", () => {
    expect(log5(0.4, 0.6)).toBeLessThan(0.5);
  });
});

// ---------------------------------------------------------------------------
// Full prediction
// ---------------------------------------------------------------------------

describe("predictWinProbability", () => {
  it("returns probabilities that sum to 100", () => {
    const result = predictWinProbability(makeInput());
    expect(result.homeWinPct + result.awayWinPct).toBeCloseTo(100, 0);
  });

  it("gives home team advantage when teams are identical", () => {
    const neutral = {
      wins: 45, losses: 45,
      runsScored: 370, runsAllowed: 370,
      last10Wins: 5, last10Losses: 5,
      teamERA: 4.0, teamWOBA: 0.315,
    };
    const starter = {
      era: 4.0, fip: 4.0, whip: 1.3,
      inningsPitched: 80, strikeOuts: 100, baseOnBalls: 40,
    };
    const result = predictWinProbability({
      home: neutral, away: neutral,
      homeStarter: starter, awayStarter: starter,
      parkFactor: 1.0,
    });
    expect(result.homeWinPct).toBeGreaterThan(result.awayWinPct);
  });

  it("clamps predictions between 20-80", () => {
    const result = predictWinProbability(
      makeInput({
        home: { wins: 90, losses: 10, runsScored: 800, runsAllowed: 300, last10Wins: 10, last10Losses: 0, teamERA: 2.5, teamWOBA: 0.370 },
        away: { wins: 10, losses: 90, runsScored: 250, runsAllowed: 700, last10Wins: 0, last10Losses: 10, teamERA: 6.0, teamWOBA: 0.260 },
        homeStarter: { era: 1.5, fip: 1.8, whip: 0.8, inningsPitched: 150, strikeOuts: 250, baseOnBalls: 20 },
        awayStarter: { era: 8.0, fip: 7.5, whip: 2.2, inningsPitched: 60, strikeOuts: 30, baseOnBalls: 80 },
      }),
    );
    expect(result.homeWinPct).toBeLessThanOrEqual(80);
    expect(result.awayWinPct).toBeGreaterThanOrEqual(20);
  });

  it("returns low confidence when both starters are null", () => {
    const result = predictWinProbability(
      makeInput({ homeStarter: null, awayStarter: null }),
    );
    expect(result.confidence).toBe("low");
  });

  it("returns low confidence early in season", () => {
    const result = predictWinProbability(
      makeInput({
        home: { wins: 3, losses: 2, runsScored: 25, runsAllowed: 20, last10Wins: 3, last10Losses: 2 },
        away: { wins: 2, losses: 3, runsScored: 20, runsAllowed: 25, last10Wins: 2, last10Losses: 3 },
      }),
    );
    expect(result.confidence).toBe("low");
  });

  it("returns all required fields including model version", () => {
    const result = predictWinProbability(makeInput());
    expect(result).toHaveProperty("homeWinPct");
    expect(result).toHaveProperty("awayWinPct");
    expect(result).toHaveProperty("confidence");
    expect(result).toHaveProperty("factors");
    expect(result).toHaveProperty("model");
    expect(result.factors.length).toBeGreaterThan(0);
    expect(result.model).toBe("StatScope Model v2.1");
  });

  it("factors include all key analysis categories", () => {
    const result = predictWinProbability(makeInput());
    const labels = result.factors.map((f) => f.label);
    expect(labels).toContain("Record");
    expect(labels).toContain("Expected Win%");
    expect(labels).toContain("Starter ERA");
    expect(labels).toContain("Last 10");
    expect(labels).toContain("Home Field");
    expect(labels).toContain("Run Diff");
    expect(labels).toContain("Team ERA");
    expect(labels).toContain("Lineup wOBA");
  });

  it("better recent form tilts probability", () => {
    const hotStreak = predictWinProbability(
      makeInput({ home: { last10Wins: 9, last10Losses: 1 } }),
    );
    const coldStreak = predictWinProbability(
      makeInput({ home: { last10Wins: 2, last10Losses: 8 } }),
    );
    expect(hotStreak.homeWinPct).toBeGreaterThan(coldStreak.homeWinPct);
  });

  it("better starting pitcher tilts probability", () => {
    const ace = predictWinProbability(
      makeInput({
        homeStarter: { era: 2.0, fip: 2.2, whip: 0.9, inningsPitched: 120, strikeOuts: 180, baseOnBalls: 25 },
      }),
    );
    const fiveStarter = predictWinProbability(
      makeInput({
        homeStarter: { era: 5.5, fip: 5.2, whip: 1.6, inningsPitched: 80, strikeOuts: 60, baseOnBalls: 50 },
      }),
    );
    expect(ace.homeWinPct).toBeGreaterThan(fiveStarter.homeWinPct);
  });

  it("stronger run differential team gets higher probability", () => {
    const strong = predictWinProbability(
      makeInput({ home: { runsScored: 500, runsAllowed: 300 } }),
    );
    const weak = predictWinProbability(
      makeInput({ home: { runsScored: 300, runsAllowed: 500 } }),
    );
    expect(strong.homeWinPct).toBeGreaterThan(weak.homeWinPct);
  });

  // --- New factor tests ---

  it("better bullpen (lower team ERA) tilts probability", () => {
    const goodBullpen = predictWinProbability(
      makeInput({ home: { teamERA: 3.0 }, away: { teamERA: 5.0 } }),
    );
    const badBullpen = predictWinProbability(
      makeInput({ home: { teamERA: 5.0 }, away: { teamERA: 3.0 } }),
    );
    expect(goodBullpen.homeWinPct).toBeGreaterThan(badBullpen.homeWinPct);
  });

  it("stronger lineup wOBA tilts probability", () => {
    const strongLineup = predictWinProbability(
      makeInput({ home: { teamWOBA: 0.350 }, away: { teamWOBA: 0.280 } }),
    );
    const weakLineup = predictWinProbability(
      makeInput({ home: { teamWOBA: 0.280 }, away: { teamWOBA: 0.350 } }),
    );
    expect(strongLineup.homeWinPct).toBeGreaterThan(weakLineup.homeWinPct);
  });

  it("hitter-friendly park benefits team with better offense", () => {
    // Home has better offense
    const hitPark = predictWinProbability(
      makeInput({
        home: { teamWOBA: 0.340 },
        away: { teamWOBA: 0.290 },
        parkFactor: 1.35, // Coors Field
      }),
    );
    const pitchPark = predictWinProbability(
      makeInput({
        home: { teamWOBA: 0.340 },
        away: { teamWOBA: 0.290 },
        parkFactor: 0.92, // Marlins Park
      }),
    );
    expect(hitPark.homeWinPct).toBeGreaterThan(pitchPark.homeWinPct);
  });

  it("park factor shows in factors when non-neutral", () => {
    const result = predictWinProbability(makeInput({ parkFactor: 1.35 }));
    const labels = result.factors.map((f) => f.label);
    expect(labels).toContain("Park Factor");
  });

  it("park factor does not show when neutral (1.0)", () => {
    const result = predictWinProbability(makeInput({ parkFactor: 1.0 }));
    const labels = result.factors.map((f) => f.label);
    expect(labels).not.toContain("Park Factor");
  });

  it("works gracefully when optional fields are undefined", () => {
    const result = predictWinProbability(
      makeInput({
        home: { teamERA: undefined, teamWOBA: undefined },
        away: { teamERA: undefined, teamWOBA: undefined },
        parkFactor: undefined,
      }),
    );
    expect(result.homeWinPct + result.awayWinPct).toBeCloseTo(100, 0);
    expect(result.homeWinPct).toBeGreaterThan(20);
    expect(result.homeWinPct).toBeLessThan(80);
  });
});

// ---------------------------------------------------------------------------
// toAmericanOdds
// ---------------------------------------------------------------------------

describe("toAmericanOdds", () => {
  it("returns negative odds for favorites (>50%)", () => {
    const odds = toAmericanOdds(0.6);
    expect(odds.startsWith("-")).toBe(true);
    expect(parseInt(odds)).toBe(-150);
  });

  it("returns positive odds for underdogs (<50%)", () => {
    const odds = toAmericanOdds(0.4);
    expect(odds.startsWith("+")).toBe(true);
    expect(parseInt(odds)).toBe(150);
  });

  it("returns -100 for exactly 50%", () => {
    expect(toAmericanOdds(0.5)).toBe("-100");
  });

  it("handles extreme probabilities", () => {
    expect(toAmericanOdds(0.8)).toBe("-400");
    expect(toAmericanOdds(0.25)).toBe("+300");
  });
});

// ---------------------------------------------------------------------------
// predictOdds
// ---------------------------------------------------------------------------

describe("predictOdds", () => {
  it("returns a reasonable total runs line", () => {
    const input = makeInput();
    const winProb = predictWinProbability(input);
    const odds = predictOdds(input, winProb);
    // MLB games typically total 7-11 runs
    expect(odds.totalLine).toBeGreaterThanOrEqual(5);
    expect(odds.totalLine).toBeLessThanOrEqual(15);
    // Line should be in 0.5 increments
    expect(odds.totalLine % 0.5).toBe(0);
  });

  it("expected runs sum to expected total", () => {
    const input = makeInput();
    const winProb = predictWinProbability(input);
    const odds = predictOdds(input, winProb);
    expect(odds.homeExpectedRuns + odds.awayExpectedRuns).toBeCloseTo(
      odds.overUnder.expectedTotal,
      0,
    );
  });

  it("moneyline reflects win probability direction", () => {
    const input = makeInput();
    const winProb = predictWinProbability(input);
    const odds = predictOdds(input, winProb);
    // Home team is stronger in default input → should be favorite
    if (winProb.homeWinPct > 50) {
      expect(odds.homeMoneyline.startsWith("-")).toBe(true);
      expect(odds.awayMoneyline.startsWith("+")).toBe(true);
    }
  });

  it("higher park factor increases total runs", () => {
    const coorsInput = makeInput({ parkFactor: 1.35 });
    const oracleInput = makeInput({ parkFactor: 0.93 });
    const coorsProb = predictWinProbability(coorsInput);
    const oracleProb = predictWinProbability(oracleInput);
    const coorsOdds = predictOdds(coorsInput, coorsProb);
    const oracleOdds = predictOdds(oracleInput, oracleProb);
    expect(coorsOdds.totalLine).toBeGreaterThan(oracleOdds.totalLine);
  });

  it("better opposing starter reduces expected runs", () => {
    const aceInput = makeInput({
      awayStarter: { era: 1.8, fip: 2.0, whip: 0.85, inningsPitched: 120, strikeOuts: 200, baseOnBalls: 20 },
    });
    const bummInput = makeInput({
      awayStarter: { era: 6.5, fip: 6.0, whip: 1.9, inningsPitched: 60, strikeOuts: 30, baseOnBalls: 50 },
    });
    const aceProb = predictWinProbability(aceInput);
    const bummProb = predictWinProbability(bummInput);
    const aceOdds = predictOdds(aceInput, aceProb);
    const bummOdds = predictOdds(bummInput, bummProb);
    // Home team scores fewer runs against ace
    expect(aceOdds.homeExpectedRuns).toBeLessThan(bummOdds.homeExpectedRuns);
  });

  it("run line identifies correct favorite", () => {
    const input = makeInput();
    const winProb = predictWinProbability(input);
    const odds = predictOdds(input, winProb);
    // Home team is stronger → should be favorite
    expect(odds.runLine.favorite).toBe("home");
    expect(odds.runLine.expectedMargin).toBeGreaterThan(0);
  });

  it("over/under lean matches expected total vs line", () => {
    const input = makeInput();
    const winProb = predictWinProbability(input);
    const odds = predictOdds(input, winProb);
    if (odds.overUnder.expectedTotal > odds.totalLine + 0.25) {
      expect(odds.overUnder.lean).toBe("over");
    } else if (odds.overUnder.expectedTotal < odds.totalLine - 0.25) {
      expect(odds.overUnder.lean).toBe("under");
    } else {
      expect(odds.overUnder.lean).toBe("push");
    }
  });
});
