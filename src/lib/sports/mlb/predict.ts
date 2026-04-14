/**
 * StatScope Advanced Win Probability Model v2.1
 *
 * Multi-factor prediction model for MLB game outcomes.
 *
 * Factors:
 * 1. Pythagorean Win Expectation — team true talent from season RS/RA
 * 2. Starting Pitcher Quality — FIP/ERA-based adjustment vs league average
 * 3. Bullpen Quality — team pitching depth beyond the starter
 * 4. Lineup Strength — team offensive quality via wOBA
 * 5. Log5 Method (Bill James) — head-to-head probability conversion
 * 6. Recent Form — last 10 games momentum
 * 7. Home Field Advantage — ~54 % historical MLB home win rate
 * 8. Park Factor — venue-specific run environment adjustment
 * 9. Regression to the Mean — avoid overconfident predictions
 */

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface TeamData {
  wins: number;
  losses: number;
  runsScored: number;
  runsAllowed: number;
  last10Wins: number;
  last10Losses: number;
  /** Team pitching ERA (starters + bullpen combined). */
  teamERA?: number;
  /** Team wOBA (weighted on-base average). */
  teamWOBA?: number;
}

export interface StarterData {
  era: number;
  fip: number;
  whip: number;
  inningsPitched: number;
  strikeOuts: number;
  baseOnBalls: number;
}

export interface AdvancedPredictionInput {
  home: TeamData;
  away: TeamData;
  homeStarter: StarterData | null;
  awayStarter: StarterData | null;
  /**
   * Park factor for the game venue (1.0 = neutral).
   * > 1.0 hitter-friendly, < 1.0 pitcher-friendly.
   */
  parkFactor?: number;
}

export interface PredictionResult {
  homeWinPct: number; // 0-100
  awayWinPct: number; // 0-100
  confidence: "high" | "medium" | "low";
  factors: PredictionFactor[];
  model: string;
}

export interface PredictionFactor {
  label: string;
  homeValue: string;
  awayValue: string;
  advantage: "home" | "away" | "even";
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PYTHAGOREAN_EXP = 1.83;
const LEAGUE_AVG_ERA = 4.0;
const LEAGUE_AVG_WOBA = 0.315;
const MIN_IP_FULL_WEIGHT = 50; // innings for full starter confidence

// Backtested & optimized on 246 completed 2026 games (Brier 0.2336)
const HOME_ADVANTAGE = 0.066; // +6.6 pp (2026 observed: ~55 % home win rate)
const STARTER_IMPACT = 0.0264; // starter FIP/ERA dominates — 2.2× baseline
const BULLPEN_IMPACT = 0.0024; // small after Pythagorean already captures RA
const LINEUP_IMPACT = 0.064; // small after Pythagorean already captures RS
const PARK_IMPACT = 0.024; // modest venue adjustment
const RECENT_FORM_WEIGHT = 0.30; // 30 % recent form, 70 % season — streaks matter
const REGRESSION_FACTOR = 0.22; // pull 22 % toward 50 % — reduces overconfidence

// ---------------------------------------------------------------------------
// Core math helpers
// ---------------------------------------------------------------------------

/**
 * Pythagorean Win Expectation.
 * Estimates a team's "true talent" win % from runs scored / allowed.
 */
export function pythagoreanWinPct(
  runsScored: number,
  runsAllowed: number,
): number {
  if (runsScored <= 0 && runsAllowed <= 0) return 0.5;
  const rsExp = Math.pow(Math.max(runsScored, 0), PYTHAGOREAN_EXP);
  const raExp = Math.pow(Math.max(runsAllowed, 0), PYTHAGOREAN_EXP);
  if (rsExp + raExp === 0) return 0.5;
  return rsExp / (rsExp + raExp);
}

/**
 * Log5 Method (Bill James).
 * Converts two teams' individual win percentages into a head-to-head
 * probability for team A.
 *
 *   P(A beats B) = (pA − pA·pB) / (pA + pB − 2·pA·pB)
 */
export function log5(pA: number, pB: number): number {
  const denom = pA + pB - 2 * pA * pB;
  if (denom === 0) return 0.5;
  return (pA - pA * pB) / denom;
}

/**
 * Starting pitcher quality adjustment.
 */
function starterAdjustment(starter: StarterData | null): number {
  if (!starter) return 0;
  const metric = starter.fip > 0 ? starter.fip : starter.era;
  if (metric === 0) return 0;
  const ipWeight = Math.min(1, starter.inningsPitched / MIN_IP_FULL_WEIGHT);
  return (LEAGUE_AVG_ERA - metric) * STARTER_IMPACT * ipWeight;
}

/**
 * Bullpen / team pitching quality adjustment.
 * Compares team-wide pitching ERA to league average.
 */
function bullpenAdjustment(teamERA: number | undefined): number {
  if (teamERA == null || teamERA <= 0) return 0;
  return (LEAGUE_AVG_ERA - teamERA) * BULLPEN_IMPACT;
}

/**
 * Lineup strength adjustment.
 * Compares team wOBA to league average.
 */
function lineupAdjustment(teamWOBA: number | undefined): number {
  if (teamWOBA == null || teamWOBA <= 0) return 0;
  return ((teamWOBA - LEAGUE_AVG_WOBA) / LEAGUE_AVG_WOBA) * LINEUP_IMPACT;
}

/**
 * Park factor adjustment.
 * Hitter-friendly parks slightly favor the better offensive team;
 * pitcher-friendly parks slightly favor the better pitching team.
 */
function parkAdjustment(
  parkFactor: number | undefined,
  homeWOBA: number | undefined,
  awayWOBA: number | undefined,
): number {
  if (parkFactor == null) return 0;
  const pf = parkFactor - 1.0; // deviation from neutral
  if (Math.abs(pf) < 0.01) return 0; // effectively neutral

  // Positive pf = hitter-friendly → favors the better offense
  const hW = homeWOBA ?? LEAGUE_AVG_WOBA;
  const aW = awayWOBA ?? LEAGUE_AVG_WOBA;
  const offenseDiff = (hW - aW) / LEAGUE_AVG_WOBA; // positive = home offense stronger
  return pf * offenseDiff * PARK_IMPACT;
}

/**
 * Recent-form win percentage from last-10 record.
 */
function recentFormPct(wins: number, losses: number): number {
  const total = wins + losses;
  if (total === 0) return 0.5;
  return wins / total;
}

// ---------------------------------------------------------------------------
// Main prediction
// ---------------------------------------------------------------------------

export function predictWinProbability(
  input: AdvancedPredictionInput,
): PredictionResult {
  const { home, away, homeStarter, awayStarter, parkFactor } = input;

  // 1 ── Pythagorean base (team true talent)
  const homePythag = pythagoreanWinPct(home.runsScored, home.runsAllowed);
  const awayPythag = pythagoreanWinPct(away.runsScored, away.runsAllowed);

  // 2 ── Starter quality adjustment
  const homeStarterAdj = starterAdjustment(homeStarter);
  const awayStarterAdj = starterAdjustment(awayStarter);

  // 3 ── Bullpen quality adjustment
  const homeBullpenAdj = bullpenAdjustment(home.teamERA);
  const awayBullpenAdj = bullpenAdjustment(away.teamERA);

  // 4 ── Lineup strength adjustment
  const homeLineupAdj = lineupAdjustment(home.teamWOBA);
  const awayLineupAdj = lineupAdjustment(away.teamWOBA);

  // Combine adjustments into team strength
  let homeAdj = clamp(
    homePythag
      + (homeStarterAdj - awayStarterAdj)
      + (homeBullpenAdj - awayBullpenAdj)
      + (homeLineupAdj - awayLineupAdj),
    0.25,
    0.75,
  );
  let awayAdj = clamp(
    awayPythag
      + (awayStarterAdj - homeStarterAdj)
      + (awayBullpenAdj - homeBullpenAdj)
      + (awayLineupAdj - homeLineupAdj),
    0.25,
    0.75,
  );

  // 5 ── Blend with recent form
  const homeRecentPct = recentFormPct(home.last10Wins, home.last10Losses);
  const awayRecentPct = recentFormPct(away.last10Wins, away.last10Losses);

  const homeBlended =
    homeAdj * (1 - RECENT_FORM_WEIGHT) + homeRecentPct * RECENT_FORM_WEIGHT;
  const awayBlended =
    awayAdj * (1 - RECENT_FORM_WEIGHT) + awayRecentPct * RECENT_FORM_WEIGHT;

  // 6 ── Log5 head-to-head
  let homeWinProb = log5(homeBlended, awayBlended);

  // 7 ── Home field advantage
  homeWinProb += HOME_ADVANTAGE;

  // 8 ── Park factor
  homeWinProb += parkAdjustment(parkFactor, home.teamWOBA, away.teamWOBA);

  // 9 ── Regression to the mean
  homeWinProb = homeWinProb * (1 - REGRESSION_FACTOR) + 0.5 * REGRESSION_FACTOR;

  // Final clamp
  homeWinProb = clamp(homeWinProb, 0.2, 0.8);

  const homeWinPct = round1(homeWinProb * 100);
  const awayWinPct = round1((1 - homeWinProb) * 100);

  return {
    homeWinPct,
    awayWinPct,
    confidence: assessConfidence(input, Math.abs(homeWinPct - awayWinPct)),
    factors: buildFactors(
      input,
      homePythag,
      awayPythag,
      homeRecentPct,
      awayRecentPct,
    ),
    model: "StatScope Model v2.2",
  };
}

// ---------------------------------------------------------------------------
// Confidence heuristic
// ---------------------------------------------------------------------------

function assessConfidence(
  input: AdvancedPredictionInput,
  diffPct: number,
): "high" | "medium" | "low" {
  const totalGames =
    input.home.wins + input.home.losses + input.away.wins + input.away.losses;

  if (totalGames < 20) return "low";
  if (!input.homeStarter && !input.awayStarter) return "low";

  const homeIP = input.homeStarter?.inningsPitched ?? 0;
  const awayIP = input.awayStarter?.inningsPitched ?? 0;
  if (homeIP < 10 && awayIP < 10) return "low";

  // Richer data available → can be high confidence
  const hasTeamStats =
    (input.home.teamERA ?? 0) > 0 && (input.home.teamWOBA ?? 0) > 0;

  if (
    diffPct >= 10 &&
    homeIP >= 30 &&
    awayIP >= 30 &&
    totalGames >= 40 &&
    hasTeamStats
  ) {
    return "high";
  }

  return "medium";
}

// ---------------------------------------------------------------------------
// Factor breakdown (shown in UI)
// ---------------------------------------------------------------------------

function buildFactors(
  input: AdvancedPredictionInput,
  homePythag: number,
  awayPythag: number,
  homeRecentPct: number,
  awayRecentPct: number,
): PredictionFactor[] {
  const { home, away, homeStarter, awayStarter, parkFactor } = input;
  const factors: PredictionFactor[] = [];

  // Record
  factors.push({
    label: "Record",
    homeValue: `${home.wins}-${home.losses}`,
    awayValue: `${away.wins}-${away.losses}`,
    advantage: cmp(homePythag, awayPythag),
  });

  // Pythagorean expected win %
  factors.push({
    label: "Expected Win%",
    homeValue: `${(homePythag * 100).toFixed(1)}%`,
    awayValue: `${(awayPythag * 100).toFixed(1)}%`,
    advantage: cmp(homePythag, awayPythag),
  });

  // Run differential
  const homeRD = home.runsScored - home.runsAllowed;
  const awayRD = away.runsScored - away.runsAllowed;
  factors.push({
    label: "Run Diff",
    homeValue: homeRD >= 0 ? `+${homeRD}` : `${homeRD}`,
    awayValue: awayRD >= 0 ? `+${awayRD}` : `${awayRD}`,
    advantage: cmp(homeRD, awayRD),
  });

  // Starter ERA
  const hERA = homeStarter?.era ?? 0;
  const aERA = awayStarter?.era ?? 0;
  factors.push({
    label: "Starter ERA",
    homeValue: hERA > 0 ? hERA.toFixed(2) : "-",
    awayValue: aERA > 0 ? aERA.toFixed(2) : "-",
    advantage: hERA === 0 || aERA === 0 ? "even" : cmp(aERA, hERA),
  });

  // Starter FIP
  const hFIP = homeStarter?.fip ?? 0;
  const aFIP = awayStarter?.fip ?? 0;
  if (hFIP > 0 || aFIP > 0) {
    factors.push({
      label: "Starter FIP",
      homeValue: hFIP > 0 ? hFIP.toFixed(2) : "-",
      awayValue: aFIP > 0 ? aFIP.toFixed(2) : "-",
      advantage: hFIP === 0 || aFIP === 0 ? "even" : cmp(aFIP, hFIP),
    });
  }

  // Starter WHIP
  const hWHIP = homeStarter?.whip ?? 0;
  const aWHIP = awayStarter?.whip ?? 0;
  factors.push({
    label: "Starter WHIP",
    homeValue: hWHIP > 0 ? hWHIP.toFixed(2) : "-",
    awayValue: aWHIP > 0 ? aWHIP.toFixed(2) : "-",
    advantage: hWHIP === 0 || aWHIP === 0 ? "even" : cmp(aWHIP, hWHIP),
  });

  // Bullpen (team ERA)
  const hTeamERA = home.teamERA;
  const aTeamERA = away.teamERA;
  if ((hTeamERA ?? 0) > 0 || (aTeamERA ?? 0) > 0) {
    factors.push({
      label: "Team ERA",
      homeValue: hTeamERA ? hTeamERA.toFixed(2) : "-",
      awayValue: aTeamERA ? aTeamERA.toFixed(2) : "-",
      advantage:
        !hTeamERA || !aTeamERA
          ? "even"
          : cmp(aTeamERA, hTeamERA), // lower = better
    });
  }

  // Lineup wOBA
  const hWOBA = home.teamWOBA;
  const aWOBA = away.teamWOBA;
  if ((hWOBA ?? 0) > 0 || (aWOBA ?? 0) > 0) {
    factors.push({
      label: "Lineup wOBA",
      homeValue: hWOBA ? `.${Math.round(hWOBA * 1000)}` : "-",
      awayValue: aWOBA ? `.${Math.round(aWOBA * 1000)}` : "-",
      advantage: !hWOBA || !aWOBA ? "even" : cmp(hWOBA, aWOBA),
    });
  }

  // Last 10 games
  factors.push({
    label: "Last 10",
    homeValue: `${home.last10Wins}-${home.last10Losses}`,
    awayValue: `${away.last10Wins}-${away.last10Losses}`,
    advantage: cmp(homeRecentPct, awayRecentPct),
  });

  // Park Factor
  if (parkFactor != null && parkFactor !== 1.0) {
    const pfLabel =
      parkFactor > 1.02 ? "Hitter-friendly" : parkFactor < 0.98 ? "Pitcher-friendly" : "Neutral";
    factors.push({
      label: "Park Factor",
      homeValue: parkFactor.toFixed(2),
      awayValue: pfLabel,
      advantage: "even",
    });
  }

  // Home field
  factors.push({
    label: "Home Field",
    homeValue: "+4.0%",
    awayValue: "-",
    advantage: "home",
  });

  return factors;
}

// ===========================================================================
// Odds Prediction — Over/Under, Moneyline, Run Line
// ===========================================================================

export interface OddsResult {
  /** Predicted Over/Under total runs line (nearest 0.5). */
  totalLine: number;
  homeExpectedRuns: number;
  awayExpectedRuns: number;
  /** American-format moneyline (e.g. "-150", "+130"). */
  homeMoneyline: string;
  awayMoneyline: string;
  /** Standard -1.5/+1.5 run line analysis. */
  runLine: {
    favorite: "home" | "away" | "even";
    spread: number;
    expectedMargin: number;
    /** Can the favorite reasonably cover -1.5? */
    coversSpread: boolean;
  };
  /** Over/Under recommendation based on expected total vs line. */
  overUnder: {
    expectedTotal: number;
    lean: "over" | "under" | "push";
  };
}

const MLB_AVG_RPG = 4.5; // league-average runs per game per team
const RUNS_REGRESSION = 0.15; // 15 % regression toward mean

/**
 * Predict game odds: total runs (O/U), moneyline, and run line.
 *
 * Uses the same input as `predictWinProbability`.
 * Call *after* win-probability so you can also pass its result.
 */
export function predictOdds(
  input: AdvancedPredictionInput,
  winProb: PredictionResult,
): OddsResult {
  const { home, away, homeStarter, awayStarter, parkFactor } = input;

  // ---- Expected runs per team ----
  const homeGames = home.wins + home.losses;
  const awayGames = away.wins + away.losses;

  const homeRPG = homeGames > 0 ? home.runsScored / homeGames : MLB_AVG_RPG;
  const awayRPG = awayGames > 0 ? away.runsScored / awayGames : MLB_AVG_RPG;

  // Opposing-starter adjustment
  //   Home lineup faces away starter → lower away-starter ERA = fewer home runs
  const awayStarterQ = awayStarter
    ? (awayStarter.fip > 0 ? awayStarter.fip : awayStarter.era) || LEAGUE_AVG_ERA
    : LEAGUE_AVG_ERA;
  const homeStarterQ = homeStarter
    ? (homeStarter.fip > 0 ? homeStarter.fip : homeStarter.era) || LEAGUE_AVG_ERA
    : LEAGUE_AVG_ERA;

  // Pitcher quality ratio: lower starter ERA → fewer opponent runs
  const homeOffAdj = awayStarterQ / LEAGUE_AVG_ERA; // <1 if away starter is good
  const awayOffAdj = homeStarterQ / LEAGUE_AVG_ERA; // <1 if home starter is good

  // Park factor
  const pf = parkFactor ?? 1.0;

  // Bullpen quality of opposing team (worse bullpen → more opponent runs)
  const homeBullpenAdj = away.teamERA
    ? away.teamERA / LEAGUE_AVG_ERA
    : 1.0;
  const awayBullpenAdj = home.teamERA
    ? home.teamERA / LEAGUE_AVG_ERA
    : 1.0;

  // Combine adjustments: starter covers ~60 % of game, bullpen ~40 %
  const homeRunsRaw = homeRPG * (homeOffAdj * 0.6 + homeBullpenAdj * 0.4) * pf;
  const awayRunsRaw = awayRPG * (awayOffAdj * 0.6 + awayBullpenAdj * 0.4) * pf;

  // Regression toward league mean
  const homeExpected = round1(homeRunsRaw * (1 - RUNS_REGRESSION) + MLB_AVG_RPG * RUNS_REGRESSION);
  const awayExpected = round1(awayRunsRaw * (1 - RUNS_REGRESSION) + MLB_AVG_RPG * RUNS_REGRESSION);

  const expectedTotal = round1(homeExpected + awayExpected);
  // O/U line rounded to nearest 0.5
  const totalLine = Math.round(expectedTotal * 2) / 2;

  // ---- Moneyline from win probability ----
  const homeProb = winProb.homeWinPct / 100;
  const awayProb = winProb.awayWinPct / 100;
  const homeMoneyline = toAmericanOdds(homeProb);
  const awayMoneyline = toAmericanOdds(awayProb);

  // ---- Run line ----
  const expectedMargin = round1(homeExpected - awayExpected);
  const favorite: "home" | "away" | "even" =
    expectedMargin > 0.1 ? "home" : expectedMargin < -0.1 ? "away" : "even";
  const coversSpread = Math.abs(expectedMargin) >= 1.5;

  return {
    totalLine,
    homeExpectedRuns: homeExpected,
    awayExpectedRuns: awayExpected,
    homeMoneyline,
    awayMoneyline,
    runLine: {
      favorite,
      spread: 1.5,
      expectedMargin,
      coversSpread,
    },
    overUnder: {
      expectedTotal,
      lean:
        expectedTotal > totalLine + 0.25
          ? "over"
          : expectedTotal < totalLine - 0.25
          ? "under"
          : "push",
    },
  };
}

/**
 * Convert a 0-1 probability to American odds format.
 *   ≥ 50 % → negative (favorite):  -(p/(1-p))*100
 *   < 50 % → positive (underdog):  +((1-p)/p)*100
 */
export function toAmericanOdds(probability: number): string {
  if (probability <= 0) return "+10000";
  if (probability >= 1) return "-10000";
  if (probability >= 0.5) {
    return `${Math.round(-(probability / (1 - probability)) * 100)}`;
  }
  return `+${Math.round(((1 - probability) / probability) * 100)}`;
}

// ---------------------------------------------------------------------------
// Tiny helpers
// ---------------------------------------------------------------------------

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function cmp(a: number, b: number): "home" | "away" | "even" {
  if (a > b) return "home";
  if (a < b) return "away";
  return "even";
}
