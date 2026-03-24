/**
 * Sabermetrics calculation functions for MLB player statistics.
 * All functions accept a stats object from the MLB API and return a number.
 */

interface HittingStats {
  atBats: number;
  hits: number;
  doubles: number;
  triples: number;
  homeRuns: number;
  baseOnBalls: number;
  hitByPitch: number;
  sacFlies: number;
  strikeOuts: number;
  plateAppearances: number;
  avg: string | number;
  slg: string | number;
  intentionalWalks?: number;
}

interface PitchingStats {
  homeRuns: number;
  baseOnBalls: number;
  hitByPitch: number;
  strikeOuts: number;
  inningsPitched: string | number;
  hits: number;
  sacFlies?: number;
  battersFaced?: number;
}

interface LeagueStats {
  wOBA: number;
  wOBAScale: number;
  leagueRunsPerPA: number;
  leagueRunsPerOut: number;
}

// wOBA linear weights (approximate 2023 values, updated annually)
const WOBA_WEIGHTS = {
  uBB: 0.69,
  HBP: 0.72,
  single: 0.88,
  double: 1.27,
  triple: 1.62,
  HR: 2.1,
};

const FIP_CONSTANT = 3.1;

/**
 * Weighted On-Base Average (wOBA)
 * Measures a hitter's overall offensive value, weighting each outcome
 * by its average run value.
 */
export function calcWOBA(stats: HittingStats): number {
  const singles =
    stats.hits - stats.doubles - stats.triples - stats.homeRuns;
  const denominator =
    stats.atBats +
    stats.baseOnBalls -
    (stats.intentionalWalks ?? 0) +
    stats.sacFlies +
    stats.hitByPitch;

  if (denominator === 0) return 0;

  const numerator =
    WOBA_WEIGHTS.uBB *
      (stats.baseOnBalls - (stats.intentionalWalks ?? 0)) +
    WOBA_WEIGHTS.HBP * stats.hitByPitch +
    WOBA_WEIGHTS.single * singles +
    WOBA_WEIGHTS.double * stats.doubles +
    WOBA_WEIGHTS.triple * stats.triples +
    WOBA_WEIGHTS.HR * stats.homeRuns;

  return round(numerator / denominator, 3);
}

/**
 * Weighted Runs Created Plus (wRC+)
 * Compares a hitter's wRC to league average, adjusted.
 * 100 = league average, 150 = 50% above average.
 */
export function calcWRCPlus(
  stats: HittingStats,
  leagueStats?: LeagueStats
): number {
  const league: LeagueStats = leagueStats ?? {
    wOBA: 0.318,
    wOBAScale: 1.21,
    leagueRunsPerPA: 0.11,
    leagueRunsPerOut: 0.27,
  };

  const wOBA = calcWOBA(stats);
  const wRAA =
    ((wOBA - league.wOBA) / league.wOBAScale) * stats.plateAppearances;

  if (stats.plateAppearances === 0) return 0;

  const wRC =
    wRAA + league.leagueRunsPerPA * stats.plateAppearances;
  const leagueWRC = league.leagueRunsPerPA * stats.plateAppearances;

  if (leagueWRC === 0) return 0;

  return round((wRC / leagueWRC) * 100, 0);
}

/**
 * Fielding Independent Pitching (FIP)
 * Evaluates a pitcher based only on outcomes they control:
 * strikeouts, walks, HBP, and home runs.
 * FIP = (13*HR + 3*(BB+HBP) - 2*K) / IP + constant
 */
export function calcFIP(stats: PitchingStats): number {
  const ip = parseInningsPitched(stats.inningsPitched);

  if (ip === 0) return 0;

  const fip =
    (13 * stats.homeRuns +
      3 * (stats.baseOnBalls + stats.hitByPitch) -
      2 * stats.strikeOuts) /
      ip +
    FIP_CONSTANT;

  return round(fip, 2);
}

/**
 * Batting Average on Balls In Play (BABIP)
 * Measures the rate at which batted balls (excluding HR) fall for hits.
 * Useful for detecting luck or defensive quality.
 * BABIP = (H - HR) / (AB - K - HR + SF)
 */
export function calcBABIP(stats: HittingStats | PitchingStats): number {
  const sf = "sacFlies" in stats ? (stats.sacFlies ?? 0) : 0;
  const ab =
    "atBats" in stats
      ? (stats as HittingStats).atBats
      : estimateABFromPitching(stats as PitchingStats);

  const denominator =
    ab - stats.strikeOuts - stats.homeRuns + sf;

  if (denominator <= 0) return 0;

  return round(
    (stats.hits - stats.homeRuns) / denominator,
    3
  );
}

/**
 * Isolated Power (ISO)
 * Measures a batter's raw power by subtracting AVG from SLG.
 * ISO = SLG - AVG
 */
export function calcISO(stats: HittingStats): number {
  const slg =
    typeof stats.slg === "string" ? parseFloat(stats.slg) : stats.slg;
  const avg =
    typeof stats.avg === "string" ? parseFloat(stats.avg) : stats.avg;

  if (isNaN(slg) || isNaN(avg)) return 0;

  return round(slg - avg, 3);
}

/**
 * Strikeout Percentage (K%)
 * K% = K / PA
 */
export function calcKPercent(
  stats: HittingStats | PitchingStats
): number {
  const pa =
    "plateAppearances" in stats
      ? (stats as HittingStats).plateAppearances
      : (stats as PitchingStats).battersFaced ?? 0;

  if (pa === 0) return 0;

  return round((stats.strikeOuts / pa) * 100, 1);
}

/**
 * Walk Percentage (BB%)
 * BB% = BB / PA
 */
export function calcBBPercent(
  stats: HittingStats | PitchingStats
): number {
  const pa =
    "plateAppearances" in stats
      ? (stats as HittingStats).plateAppearances
      : (stats as PitchingStats).battersFaced ?? 0;

  if (pa === 0) return 0;

  return round((stats.baseOnBalls / pa) * 100, 1);
}

// --- Helpers ---

/**
 * Parse MLB API innings pitched format (e.g., "6.2" means 6 and 2/3).
 */
function parseInningsPitched(ip: string | number): number {
  const val = typeof ip === "string" ? parseFloat(ip) : ip;
  const whole = Math.floor(val);
  const fraction = Math.round((val - whole) * 10);
  return whole + fraction / 3;
}

/**
 * Estimate at-bats from pitching stats when atBats is not directly available.
 */
function estimateABFromPitching(stats: PitchingStats): number {
  const bf = stats.battersFaced ?? 0;
  return bf - stats.baseOnBalls - stats.hitByPitch - (stats.sacFlies ?? 0);
}

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
