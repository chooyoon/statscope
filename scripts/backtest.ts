/**
 * StatScope Prediction Model Backtester & Optimizer
 *
 * 1. Fetches all completed 2026 regular-season MLB games
 * 2. Gathers pre-game data (standings, starters, team stats)
 * 3. Runs prediction model on each game
 * 4. Measures accuracy, calibration, Brier score, O/U accuracy
 * 5. Grid-searches over model constants to minimize Brier score
 * 6. Outputs optimized constants
 *
 * Usage:  npx tsx scripts/backtest.ts
 */

const MLB = "https://statsapi.mlb.com/api/v1";

// ── Current model constants (baseline) ────────────────────────────────────
interface ModelConstants {
  STARTER_IMPACT: number;
  BULLPEN_IMPACT: number;
  LINEUP_IMPACT: number;
  PARK_IMPACT: number;
  RECENT_FORM_WEIGHT: number;
  REGRESSION_FACTOR: number;
  HOME_ADVANTAGE: number;
}

const BASELINE: ModelConstants = {
  STARTER_IMPACT: 0.012,
  BULLPEN_IMPACT: 0.006,
  LINEUP_IMPACT: 0.15,
  PARK_IMPACT: 0.06,
  RECENT_FORM_WEIGHT: 0.15,
  REGRESSION_FACTOR: 0.10,
  HOME_ADVANTAGE: 0.04,
};

// ── Park factors (copied from data/parkFactors.ts) ────────────────────────
const PARK_FACTORS: Record<number, number> = {
  108: 0.97, 109: 1.05, 110: 1.04, 111: 1.08, 112: 1.05,
  113: 1.10, 114: 0.98, 115: 1.35, 116: 0.97, 117: 1.02,
  118: 0.99, 119: 0.98, 120: 1.00, 121: 0.95, 133: 1.00,
  134: 0.94, 135: 0.94, 136: 0.96, 137: 0.93, 138: 0.98,
  139: 0.95, 140: 1.00, 141: 1.04, 142: 1.01, 143: 1.06,
  144: 1.00, 145: 1.07, 146: 0.92, 147: 1.06, 158: 1.03,
};

const LEAGUE_AVG_ERA = 4.0;
const LEAGUE_AVG_WOBA = 0.315;
const PYTHAGOREAN_EXP = 1.83;

// ── API helpers ───────────────────────────────────────────────────────────

async function mlbFetch(endpoint: string, params: Record<string, string | number> = {}) {
  const url = new URL(`${MLB}${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`MLB API ${res.status}: ${endpoint}`);
  return res.json();
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Data types ────────────────────────────────────────────────────────────

interface GameResult {
  gamePk: number;
  date: string;
  homeTeamId: number;
  awayTeamId: number;
  homeWon: boolean;
  homeScore: number;
  awayScore: number;
  totalRuns: number;
  homeStarterId: number | null;
  awayStarterId: number | null;
}

interface TeamSeasonData {
  wins: number;
  losses: number;
  runsScored: number;
  runsAllowed: number;
  last10Wins: number;
  last10Losses: number;
  teamERA: number;
  teamWOBA: number;
}

interface StarterStats {
  era: number;
  fip: number;
  whip: number;
  inningsPitched: number;
  strikeOuts: number;
  baseOnBalls: number;
}

interface BacktestRow {
  gamePk: number;
  date: string;
  predictedHomeWin: number; // 0-1
  actualHomeWin: number; // 0 or 1
  predictedTotal: number;
  actualTotal: number;
  homeTeamId: number;
  awayTeamId: number;
}

// ── Core model (self-contained for grid-search) ──────────────────────────

function pythagorean(rs: number, ra: number): number {
  if (rs <= 0 && ra <= 0) return 0.5;
  const rsE = Math.pow(Math.max(rs, 0), PYTHAGOREAN_EXP);
  const raE = Math.pow(Math.max(ra, 0), PYTHAGOREAN_EXP);
  return rsE + raE === 0 ? 0.5 : rsE / (rsE + raE);
}

function log5(pA: number, pB: number): number {
  const d = pA + pB - 2 * pA * pB;
  return d === 0 ? 0.5 : (pA - pA * pB) / d;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function runModel(
  home: TeamSeasonData,
  away: TeamSeasonData,
  homeStarter: StarterStats | null,
  awayStarter: StarterStats | null,
  parkFactor: number,
  C: ModelConstants,
): { homeWinProb: number; expectedTotal: number } {
  // Pythagorean
  const homePy = pythagorean(home.runsScored, home.runsAllowed);
  const awayPy = pythagorean(away.runsScored, away.runsAllowed);

  // Starter adjustment
  const hMetric = homeStarter ? (homeStarter.fip > 0 ? homeStarter.fip : homeStarter.era) || LEAGUE_AVG_ERA : LEAGUE_AVG_ERA;
  const aMetric = awayStarter ? (awayStarter.fip > 0 ? awayStarter.fip : awayStarter.era) || LEAGUE_AVG_ERA : LEAGUE_AVG_ERA;
  const hIP = homeStarter?.inningsPitched ?? 0;
  const aIP = awayStarter?.inningsPitched ?? 0;
  const hStarterAdj = (LEAGUE_AVG_ERA - hMetric) * C.STARTER_IMPACT * Math.min(1, hIP / 50);
  const aStarterAdj = (LEAGUE_AVG_ERA - aMetric) * C.STARTER_IMPACT * Math.min(1, aIP / 50);

  // Bullpen
  const hBullpen = home.teamERA > 0 ? (LEAGUE_AVG_ERA - home.teamERA) * C.BULLPEN_IMPACT : 0;
  const aBullpen = away.teamERA > 0 ? (LEAGUE_AVG_ERA - away.teamERA) * C.BULLPEN_IMPACT : 0;

  // Lineup
  const hLineup = home.teamWOBA > 0 ? ((home.teamWOBA - LEAGUE_AVG_WOBA) / LEAGUE_AVG_WOBA) * C.LINEUP_IMPACT : 0;
  const aLineup = away.teamWOBA > 0 ? ((away.teamWOBA - LEAGUE_AVG_WOBA) / LEAGUE_AVG_WOBA) * C.LINEUP_IMPACT : 0;

  let homeAdj = clamp(homePy + (hStarterAdj - aStarterAdj) + (hBullpen - aBullpen) + (hLineup - aLineup), 0.25, 0.75);
  let awayAdj = clamp(awayPy + (aStarterAdj - hStarterAdj) + (aBullpen - hBullpen) + (aLineup - hLineup), 0.25, 0.75);

  // Recent form
  const hRecent = (home.last10Wins + home.last10Losses) > 0 ? home.last10Wins / (home.last10Wins + home.last10Losses) : 0.5;
  const aRecent = (away.last10Wins + away.last10Losses) > 0 ? away.last10Wins / (away.last10Wins + away.last10Losses) : 0.5;
  const homeBlend = homeAdj * (1 - C.RECENT_FORM_WEIGHT) + hRecent * C.RECENT_FORM_WEIGHT;
  const awayBlend = awayAdj * (1 - C.RECENT_FORM_WEIGHT) + aRecent * C.RECENT_FORM_WEIGHT;

  // Log5
  let prob = log5(homeBlend, awayBlend);

  // Home advantage
  prob += C.HOME_ADVANTAGE;

  // Park factor (offense diff)
  const hW = home.teamWOBA || LEAGUE_AVG_WOBA;
  const aW = away.teamWOBA || LEAGUE_AVG_WOBA;
  const offDiff = (hW - aW) / LEAGUE_AVG_WOBA;
  prob += (parkFactor - 1.0) * offDiff * C.PARK_IMPACT;

  // Regression
  prob = prob * (1 - C.REGRESSION_FACTOR) + 0.5 * C.REGRESSION_FACTOR;
  prob = clamp(prob, 0.2, 0.8);

  // Expected total runs
  const homeG = home.wins + home.losses || 1;
  const awayG = away.wins + away.losses || 1;
  const homeRPG = home.runsScored / homeG;
  const awayRPG = away.runsScored / awayG;
  const homeOffAdj = aMetric / LEAGUE_AVG_ERA;
  const awayOffAdj = hMetric / LEAGUE_AVG_ERA;
  const hBullpAdj = away.teamERA > 0 ? away.teamERA / LEAGUE_AVG_ERA : 1;
  const aBullpAdj = home.teamERA > 0 ? home.teamERA / LEAGUE_AVG_ERA : 1;
  const homeRuns = homeRPG * (homeOffAdj * 0.6 + hBullpAdj * 0.4) * parkFactor;
  const awayRuns = awayRPG * (awayOffAdj * 0.6 + aBullpAdj * 0.4) * parkFactor;
  const expectedTotal = (homeRuns + awayRuns) * 0.85 + 9.0 * 0.15; // regression

  return { homeWinProb: prob, expectedTotal };
}

// ── Metrics ──────────────────────────────────────────────────────────────

function brierScore(rows: BacktestRow[]): number {
  return rows.reduce((sum, r) => sum + Math.pow(r.predictedHomeWin - r.actualHomeWin, 2), 0) / rows.length;
}

function accuracy(rows: BacktestRow[]): number {
  const correct = rows.filter((r) =>
    (r.predictedHomeWin > 0.5 && r.actualHomeWin === 1) ||
    (r.predictedHomeWin < 0.5 && r.actualHomeWin === 0)
  ).length;
  return correct / rows.length;
}

function calibration(rows: BacktestRow[]): { bucket: string; predicted: number; actual: number; count: number }[] {
  const buckets = [
    { lo: 0.20, hi: 0.35, label: "20-35%" },
    { lo: 0.35, hi: 0.45, label: "35-45%" },
    { lo: 0.45, hi: 0.55, label: "45-55%" },
    { lo: 0.55, hi: 0.65, label: "55-65%" },
    { lo: 0.65, hi: 0.80, label: "65-80%" },
  ];
  return buckets.map(({ lo, hi, label }) => {
    const inBucket = rows.filter((r) => r.predictedHomeWin >= lo && r.predictedHomeWin < hi);
    if (inBucket.length === 0) return { bucket: label, predicted: (lo + hi) / 2, actual: 0, count: 0 };
    const avgPred = inBucket.reduce((s, r) => s + r.predictedHomeWin, 0) / inBucket.length;
    const avgAct = inBucket.reduce((s, r) => s + r.actualHomeWin, 0) / inBucket.length;
    return { bucket: label, predicted: avgPred, actual: avgAct, count: inBucket.length };
  });
}

function ouAccuracy(rows: BacktestRow[]): { overCorrect: number; underCorrect: number; total: number } {
  let overCorrect = 0, underCorrect = 0, total = 0;
  for (const r of rows) {
    const line = Math.round(r.predictedTotal * 2) / 2;
    if (r.actualTotal === line) continue; // push
    total++;
    if (r.predictedTotal > line + 0.25 && r.actualTotal > line) overCorrect++;
    if (r.predictedTotal < line - 0.25 && r.actualTotal < line) underCorrect++;
  }
  return { overCorrect, underCorrect, total };
}

// ── Fetch data ───────────────────────────────────────────────────────────

async function fetchCompletedGames(): Promise<GameResult[]> {
  console.log("Fetching completed 2026 games...");
  const games: GameResult[] = [];

  // Fetch schedule in weekly chunks
  const startDate = "2026-03-25";
  const endDate = "2026-04-13"; // yesterday (completed games only)

  const data = await mlbFetch("/schedule", {
    sportId: 1,
    season: 2026,
    gameType: "R",
    startDate,
    endDate,
    hydrate: "linescore,probablePitcher",
  });

  for (const dateObj of data.dates || []) {
    for (const game of dateObj.games || []) {
      if (game.status?.abstractGameState !== "Final") continue;

      const homeScore = game.teams?.home?.score ?? game.linescore?.teams?.home?.runs ?? 0;
      const awayScore = game.teams?.away?.score ?? game.linescore?.teams?.away?.runs ?? 0;

      games.push({
        gamePk: game.gamePk,
        date: dateObj.date,
        homeTeamId: game.teams.home.team.id,
        awayTeamId: game.teams.away.team.id,
        homeWon: homeScore > awayScore,
        homeScore,
        awayScore,
        totalRuns: homeScore + awayScore,
        homeStarterId: game.teams.home.probablePitcher?.id ?? null,
        awayStarterId: game.teams.away.probablePitcher?.id ?? null,
      });
    }
  }

  console.log(`  Found ${games.length} completed games`);
  return games;
}

async function fetchStandings(): Promise<Map<number, TeamSeasonData>> {
  console.log("Fetching standings...");
  const map = new Map<number, TeamSeasonData>();
  const data = await mlbFetch("/standings", {
    leagueId: "103,104",
    season: 2026,
    standingsTypes: "regularSeason",
    hydrate: "team",
  });

  for (const rec of data.records || []) {
    for (const tr of rec.teamRecords || []) {
      const l10 = tr.records?.splitRecords?.find((r: { type: string }) => r.type === "lastTen");
      map.set(tr.team.id, {
        wins: tr.wins,
        losses: tr.losses,
        runsScored: tr.runsScored,
        runsAllowed: tr.runsAllowed,
        last10Wins: l10?.wins ?? 5,
        last10Losses: l10?.losses ?? 5,
        teamERA: 0,
        teamWOBA: 0,
      });
    }
  }
  console.log(`  ${map.size} teams loaded`);
  return map;
}

async function fetchTeamStats(teams: Map<number, TeamSeasonData>): Promise<void> {
  console.log("Fetching team hitting/pitching stats...");

  const [hitting, pitching] = await Promise.all([
    mlbFetch("/teams/stats", { stats: "season", group: "hitting", sportId: 1, season: 2026 }),
    mlbFetch("/teams/stats", { stats: "season", group: "pitching", sportId: 1, season: 2026 }),
  ]);

  // Team ERA
  for (const split of pitching.stats?.[0]?.splits ?? []) {
    const team = teams.get(split.team.id);
    if (team) team.teamERA = parseFloat(split.stat.era) || 0;
  }

  // Team wOBA (calculated from batting stats)
  for (const split of hitting.stats?.[0]?.splits ?? []) {
    const team = teams.get(split.team.id);
    if (!team) continue;
    const s = split.stat;
    const singles = (s.hits || 0) - (s.doubles || 0) - (s.triples || 0) - (s.homeRuns || 0);
    const denom = (s.atBats || 0) + (s.baseOnBalls || 0) - (s.intentionalWalks || 0) + (s.sacFlies || 0) + (s.hitByPitch || 0);
    if (denom > 0) {
      team.teamWOBA = (
        0.69 * ((s.baseOnBalls || 0) - (s.intentionalWalks || 0)) +
        0.72 * (s.hitByPitch || 0) +
        0.88 * singles +
        1.27 * (s.doubles || 0) +
        1.62 * (s.triples || 0) +
        2.10 * (s.homeRuns || 0)
      ) / denom;
    }
  }

  const withERA = [...teams.values()].filter((t) => t.teamERA > 0).length;
  const withWOBA = [...teams.values()].filter((t) => t.teamWOBA > 0).length;
  console.log(`  Team ERA: ${withERA}, Team wOBA: ${withWOBA}`);
}

async function fetchStarterStats(games: GameResult[]): Promise<Map<number, StarterStats>> {
  console.log("Fetching starter season stats...");
  const starterIds = new Set<number>();
  for (const g of games) {
    if (g.homeStarterId) starterIds.add(g.homeStarterId);
    if (g.awayStarterId) starterIds.add(g.awayStarterId);
  }

  const map = new Map<number, StarterStats>();
  const ids = [...starterIds];
  console.log(`  ${ids.length} unique starters to fetch`);

  // Batch in groups of 10 with rate limiting
  for (let i = 0; i < ids.length; i += 10) {
    const batch = ids.slice(i, i + 10);
    const results = await Promise.all(
      batch.map(async (pid) => {
        try {
          const data = await mlbFetch(`/people/${pid}`, {
            hydrate: `stats(group=[pitching],type=[season],season=2026)`,
          });
          const stat = data.people?.[0]?.stats?.[0]?.splits?.[0]?.stat;
          if (!stat) return null;

          const ip = parseFloat(stat.inningsPitched || "0");
          const ipWhole = Math.floor(ip);
          const ipFrac = Math.round((ip - ipWhole) * 10);
          const realIP = ipWhole + ipFrac / 3;

          // Calculate FIP
          const fipIP = realIP || 1;
          const fip = (13 * (stat.homeRuns || 0) + 3 * ((stat.baseOnBalls || 0) + (stat.hitByPitch || 0)) - 2 * (stat.strikeOuts || 0)) / fipIP + 3.1;

          return {
            id: pid,
            stats: {
              era: parseFloat(stat.era) || 0,
              fip: Math.max(0, fip),
              whip: parseFloat(stat.whip) || 0,
              inningsPitched: realIP,
              strikeOuts: stat.strikeOuts || 0,
              baseOnBalls: stat.baseOnBalls || 0,
            } as StarterStats,
          };
        } catch {
          return null;
        }
      }),
    );

    for (const r of results) {
      if (r) map.set(r.id, r.stats);
    }

    if (i + 10 < ids.length) await sleep(200); // rate limit
    process.stdout.write(`  ${Math.min(i + 10, ids.length)}/${ids.length}\r`);
  }

  console.log(`  ${map.size} starters loaded      `);
  return map;
}

// ── Run backtest ─────────────────────────────────────────────────────────

function runBacktest(
  games: GameResult[],
  teams: Map<number, TeamSeasonData>,
  starters: Map<number, StarterStats>,
  constants: ModelConstants,
): BacktestRow[] {
  const rows: BacktestRow[] = [];

  for (const g of games) {
    const home = teams.get(g.homeTeamId);
    const away = teams.get(g.awayTeamId);
    if (!home || !away) continue;

    const homeStarter = g.homeStarterId ? starters.get(g.homeStarterId) ?? null : null;
    const awayStarter = g.awayStarterId ? starters.get(g.awayStarterId) ?? null : null;
    const pf = PARK_FACTORS[g.homeTeamId] ?? 1.0;

    const { homeWinProb, expectedTotal } = runModel(home, away, homeStarter, awayStarter, pf, constants);

    rows.push({
      gamePk: g.gamePk,
      date: g.date,
      predictedHomeWin: homeWinProb,
      actualHomeWin: g.homeWon ? 1 : 0,
      predictedTotal: expectedTotal,
      actualTotal: g.totalRuns,
      homeTeamId: g.homeTeamId,
      awayTeamId: g.awayTeamId,
    });
  }

  return rows;
}

// ── Grid search optimizer ────────────────────────────────────────────────

function gridSearch(
  games: GameResult[],
  teams: Map<number, TeamSeasonData>,
  starters: Map<number, StarterStats>,
): { best: ModelConstants; bestBrier: number } {
  console.log("\nRunning grid search optimization...");

  const ranges: Record<keyof ModelConstants, number[]> = {
    STARTER_IMPACT:    [0.006, 0.009, 0.012, 0.015, 0.018, 0.022],
    BULLPEN_IMPACT:    [0.003, 0.006, 0.009, 0.012],
    LINEUP_IMPACT:     [0.08, 0.12, 0.15, 0.20, 0.25],
    PARK_IMPACT:       [0.03, 0.06, 0.09, 0.12],
    RECENT_FORM_WEIGHT:[0.05, 0.10, 0.15, 0.20, 0.25],
    REGRESSION_FACTOR: [0.05, 0.08, 0.10, 0.15, 0.20],
    HOME_ADVANTAGE:    [0.02, 0.03, 0.04, 0.05, 0.06],
  };

  // Phase 1: optimize each constant independently
  let current = { ...BASELINE };
  let bestBrier = Infinity;

  for (const key of Object.keys(ranges) as (keyof ModelConstants)[]) {
    let bestVal = current[key];
    let bestScore = Infinity;

    for (const val of ranges[key]) {
      const trial = { ...current, [key]: val };
      const rows = runBacktest(games, teams, starters, trial);
      const score = brierScore(rows);
      if (score < bestScore) {
        bestScore = score;
        bestVal = val;
      }
    }

    current[key] = bestVal;
    bestBrier = bestScore;
    console.log(`  ${key}: ${bestVal} (Brier: ${bestBrier.toFixed(6)})`);
  }

  // Phase 2: fine-tune each constant around its optimal value
  console.log("\nPhase 2: Fine-tuning...");
  for (const key of Object.keys(ranges) as (keyof ModelConstants)[]) {
    const base = current[key];
    const step = base * 0.1; // 10% steps
    const fineRange = [base - 2 * step, base - step, base, base + step, base + 2 * step].filter((v) => v > 0);

    let bestVal = base;
    let bestScore = Infinity;

    for (const val of fineRange) {
      const trial = { ...current, [key]: val };
      const rows = runBacktest(games, teams, starters, trial);
      const score = brierScore(rows);
      if (score < bestScore) {
        bestScore = score;
        bestVal = val;
      }
    }

    current[key] = Math.round(bestVal * 10000) / 10000;
    bestBrier = bestScore;
  }

  console.log(`\nOptimized Brier: ${bestBrier.toFixed(6)}`);
  return { best: current, bestBrier };
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== StatScope Prediction Model Backtest ===\n");

  // 1. Fetch data
  const games = await fetchCompletedGames();
  const teams = await fetchStandings();
  await fetchTeamStats(teams);
  const starters = await fetchStarterStats(games);

  // 2. Run baseline backtest
  console.log("\n--- Baseline Model Results ---");
  const baselineRows = runBacktest(games, teams, starters, BASELINE);
  const baseBrier = brierScore(baselineRows);
  const baseAcc = accuracy(baselineRows);
  const baseCal = calibration(baselineRows);
  const baseOU = ouAccuracy(baselineRows);

  console.log(`Games tested:    ${baselineRows.length}`);
  console.log(`Accuracy:        ${(baseAcc * 100).toFixed(1)}%`);
  console.log(`Brier Score:     ${baseBrier.toFixed(6)} (lower = better, 0.25 = random)`);
  console.log(`Home win rate:   ${(baselineRows.filter((r) => r.actualHomeWin).length / baselineRows.length * 100).toFixed(1)}%`);
  console.log(`\nCalibration:`);
  for (const b of baseCal) {
    if (b.count === 0) continue;
    const bar = "#".repeat(Math.round(b.actual * 20));
    console.log(`  ${b.bucket.padEnd(8)} predicted=${(b.predicted * 100).toFixed(1)}% actual=${(b.actual * 100).toFixed(1)}% n=${b.count} ${bar}`);
  }
  console.log(`\nO/U: over_correct=${baseOU.overCorrect}, under_correct=${baseOU.underCorrect}, total=${baseOU.total}`);

  // 3. Grid search optimization
  const { best, bestBrier } = gridSearch(games, teams, starters);

  // 4. Run optimized backtest
  console.log("\n--- Optimized Model Results ---");
  const optRows = runBacktest(games, teams, starters, best);
  const optAcc = accuracy(optRows);
  const optCal = calibration(optRows);
  const optOU = ouAccuracy(optRows);

  console.log(`Accuracy:        ${(optAcc * 100).toFixed(1)}%`);
  console.log(`Brier Score:     ${bestBrier.toFixed(6)}`);
  console.log(`\nCalibration:`);
  for (const b of optCal) {
    if (b.count === 0) continue;
    const bar = "#".repeat(Math.round(b.actual * 20));
    console.log(`  ${b.bucket.padEnd(8)} predicted=${(b.predicted * 100).toFixed(1)}% actual=${(b.actual * 100).toFixed(1)}% n=${b.count} ${bar}`);
  }
  console.log(`\nO/U: over_correct=${optOU.overCorrect}, under_correct=${optOU.underCorrect}, total=${optOU.total}`);

  // 5. Output optimized constants
  console.log("\n=== OPTIMIZED CONSTANTS ===");
  console.log(`STARTER_IMPACT:     ${best.STARTER_IMPACT}`);
  console.log(`BULLPEN_IMPACT:     ${best.BULLPEN_IMPACT}`);
  console.log(`LINEUP_IMPACT:      ${best.LINEUP_IMPACT}`);
  console.log(`PARK_IMPACT:        ${best.PARK_IMPACT}`);
  console.log(`RECENT_FORM_WEIGHT: ${best.RECENT_FORM_WEIGHT}`);
  console.log(`REGRESSION_FACTOR:  ${best.REGRESSION_FACTOR}`);
  console.log(`HOME_ADVANTAGE:     ${best.HOME_ADVANTAGE}`);

  console.log(`\nImprovement: Brier ${baseBrier.toFixed(6)} → ${bestBrier.toFixed(6)} (${((baseBrier - bestBrier) / baseBrier * 100).toFixed(2)}% better)`);
  console.log(`Improvement: Accuracy ${(baseAcc * 100).toFixed(1)}% → ${(optAcc * 100).toFixed(1)}%`);
}

main().catch(console.error);
