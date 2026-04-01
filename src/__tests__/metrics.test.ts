import { describe, it, expect } from "vitest";
import {
  calcWOBA,
  calcWRCPlus,
  calcFIP,
  calcBABIP,
  calcISO,
  calcKPercent,
  calcBBPercent,
} from "@/lib/sports/mlb/metrics";

const sampleHitting = {
  atBats: 500,
  hits: 150,
  doubles: 30,
  triples: 5,
  homeRuns: 25,
  baseOnBalls: 60,
  hitByPitch: 5,
  sacFlies: 4,
  strikeOuts: 120,
  plateAppearances: 569,
  avg: ".300",
  slg: ".500",
  intentionalWalks: 3,
};

const samplePitching = {
  homeRuns: 15,
  baseOnBalls: 40,
  hitByPitch: 5,
  strikeOuts: 180,
  inningsPitched: "190.0",
  hits: 160,
  sacFlies: 3,
  battersFaced: 780,
};

describe("calcWOBA", () => {
  it("calculates wOBA for valid hitting stats", () => {
    const result = calcWOBA(sampleHitting);
    expect(result).toBeGreaterThan(0.3);
    expect(result).toBeLessThan(0.5);
  });

  it("returns 0 for zero denominator", () => {
    const empty = { ...sampleHitting, atBats: 0, baseOnBalls: 0, sacFlies: 0, hitByPitch: 0, intentionalWalks: 0 };
    expect(calcWOBA(empty)).toBe(0);
  });
});

describe("calcWRCPlus", () => {
  it("returns a positive number for valid stats", () => {
    const result = calcWRCPlus(sampleHitting);
    expect(result).toBeGreaterThan(0);
  });

  it("above-average hitter gets >100", () => {
    const result = calcWRCPlus(sampleHitting);
    expect(result).toBeGreaterThan(100);
  });

  it("returns 0 for zero plate appearances", () => {
    const empty = { ...sampleHitting, plateAppearances: 0 };
    expect(calcWRCPlus(empty)).toBe(0);
  });
});

describe("calcFIP", () => {
  it("calculates FIP for valid pitching stats", () => {
    const result = calcFIP(samplePitching);
    expect(result).toBeGreaterThan(1);
    expect(result).toBeLessThan(7);
  });

  it("returns 0 for zero innings pitched", () => {
    const empty = { ...samplePitching, inningsPitched: "0.0" };
    expect(calcFIP(empty)).toBe(0);
  });

  it("handles string innings with fractional thirds (6.2 = 6 2/3)", () => {
    const stats = { ...samplePitching, inningsPitched: "6.2", homeRuns: 1, baseOnBalls: 2, hitByPitch: 0, strikeOuts: 8 };
    const result = calcFIP(stats);
    expect(result).toBeGreaterThan(0);
  });
});

describe("calcBABIP", () => {
  it("calculates BABIP for hitting stats", () => {
    const result = calcBABIP(sampleHitting);
    expect(result).toBeGreaterThan(0.2);
    expect(result).toBeLessThan(0.5);
  });

  it("calculates BABIP for pitching stats", () => {
    const result = calcBABIP(samplePitching);
    expect(result).toBeGreaterThan(0.1);
    expect(result).toBeLessThan(0.5);
  });
});

describe("calcISO", () => {
  it("calculates ISO = SLG - AVG", () => {
    const result = calcISO(sampleHitting);
    expect(result).toBe(0.2); // .500 - .300
  });

  it("handles NaN strings", () => {
    const bad = { ...sampleHitting, avg: "abc", slg: "xyz" };
    expect(calcISO(bad)).toBe(0);
  });
});

describe("calcKPercent", () => {
  it("calculates K% for hitters", () => {
    const result = calcKPercent(sampleHitting);
    expect(result).toBeCloseTo((120 / 569) * 100, 1);
  });

  it("calculates K% for pitchers", () => {
    const result = calcKPercent(samplePitching);
    expect(result).toBeCloseTo((180 / 780) * 100, 1);
  });
});

describe("calcBBPercent", () => {
  it("calculates BB% for hitters", () => {
    const result = calcBBPercent(sampleHitting);
    expect(result).toBeCloseTo((60 / 569) * 100, 1);
  });
});
