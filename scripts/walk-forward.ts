/**
 * Walk-Forward Simulated Track Record
 *
 * For every completed game in the last N days, re-run the production
 * v2.2 model using ONLY stats that would have been available before
 * that game started (season-to-date aggregates ending the prior day).
 * Compare the "as-if-posted" prediction to the actual outcome.
 *
 * Unlike backtest-save.ts, this avoids look-ahead bias. The ROI, Brier,
 * and calibration numbers this produces are the most honest simulation
 * we can run without literally time-traveling and pinning probable
 * pitchers to the slate we saw that morning.
 *
 * Usage: npx tsx scripts/walk-forward.ts [--days=14]
 */
import fs from "node:fs/promises";
import path from "node:path";

const MLB = "https://statsapi.mlb.com/api/v1";
const SEASON_START = "2026-03-25";

// Production v2.2 constants
const V22 = {
  STARTER_IMPACT: 0.0264,
  BULLPEN_IMPACT: 0.0024,
  LINEUP_IMPACT: 0.064,
  PARK_IMPACT: 0.024,
  RECENT_FORM_WEIGHT: 0.30,
  REGRESSION_FACTOR: 0.22,
  HOME_ADVANTAGE: 0.066,
} as const;

const PARK_FACTORS: Record<number, number> = {
  108: 0.97, 109: 1.05, 110: 1.04, 111: 1.08, 112: 1.05,
  113: 1.10, 114: 0.98, 115: 1.35, 116: 0.97, 117: 1.02,
  118: 0.99, 119: 0.98, 120: 1.00, 121: 0.95, 133: 1.00,
  134: 0.94, 135: 0.94, 136: 0.96, 137: 0.93, 138: 0.98,
  139: 0.95, 140: 1.00, 141: 1.04, 142: 1.01, 143: 1.06,
  144: 1.00, 145: 1.07, 146: 0.92, 147: 1.06, 158: 1.03,
};

const LEAGUE_ERA = 4.0;
const LEAGUE_WOBA = 0.315;
const PYTH_EXP = 1.83;

type Team = {
  wins: number;
  losses: number;
  runsScored: number;
  runsAllowed: number;
  last10W: number;
  last10L: number;
  era: number;
  woba: number;
};
type Starter = { era: number; fip: number; ip: number };
type Game = {
  gamePk: number;
  date: string;
  homeTeamId: number;
  awayTeamId: number;
  homeTeamName: string;
  awayTeamName: string;
  homeWon: boolean;
  homeScore: number;
  awayScore: number;
  homeStarterId: number | null;
  awayStarterId: number | null;
};

// ── Helpers ────────────────────────────────────────────────
async function get(endpoint: string, params: Record<string, string | number> = {}) {
  const url = new URL(`${MLB}${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`MLB ${res.status}: ${endpoint}`);
  return res.json();
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const pyth = (rs: number, ra: number) => {
  if (rs <= 0 && ra <= 0) return 0.5;
  const a = Math.pow(Math.max(rs, 0), PYTH_EXP);
  const b = Math.pow(Math.max(ra, 0), PYTH_EXP);
  return a + b === 0 ? 0.5 : a / (a + b);
};
const log5 = (pA: number, pB: number) => {
  const d = pA + pB - 2 * pA * pB;
  return d === 0 ? 0.5 : (pA - pA * pB) / d;
};
function mline(p: number): string {
  if (p >= 0.5) return String(Math.round(-(p / (1 - p)) * 100));
  return "+" + String(Math.round(((1 - p) / p) * 100));
}
function priorDay(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// ── Model ──────────────────────────────────────────────────
function runModel(h: Team, a: Team, hs: Starter | null, as_: Starter | null, pf: number) {
  const hPy = pyth(h.runsScored, h.runsAllowed);
  const aPy = pyth(a.runsScored, a.runsAllowed);
  const hm = hs && hs.fip > 0 ? hs.fip : LEAGUE_ERA;
  const am = as_ && as_.fip > 0 ? as_.fip : LEAGUE_ERA;
  const hIP = hs?.ip ?? 0;
  const aIP = as_?.ip ?? 0;
  const hSA = (LEAGUE_ERA - hm) * V22.STARTER_IMPACT * Math.min(1, hIP / 50);
  const aSA = (LEAGUE_ERA - am) * V22.STARTER_IMPACT * Math.min(1, aIP / 50);
  const hB = h.era > 0 ? (LEAGUE_ERA - h.era) * V22.BULLPEN_IMPACT : 0;
  const aB = a.era > 0 ? (LEAGUE_ERA - a.era) * V22.BULLPEN_IMPACT : 0;
  const hL = h.woba > 0 ? ((h.woba - LEAGUE_WOBA) / LEAGUE_WOBA) * V22.LINEUP_IMPACT : 0;
  const aL = a.woba > 0 ? ((a.woba - LEAGUE_WOBA) / LEAGUE_WOBA) * V22.LINEUP_IMPACT : 0;
  const hAdj = clamp(hPy + (hSA - aSA) + (hB - aB) + (hL - aL), 0.25, 0.75);
  const aAdj = clamp(aPy + (aSA - hSA) + (aB - hB) + (aL - hL), 0.25, 0.75);
  const hR = h.last10W + h.last10L > 0 ? h.last10W / (h.last10W + h.last10L) : 0.5;
  const aR = a.last10W + a.last10L > 0 ? a.last10W / (a.last10W + a.last10L) : 0.5;
  const hBl = hAdj * (1 - V22.RECENT_FORM_WEIGHT) + hR * V22.RECENT_FORM_WEIGHT;
  const aBl = aAdj * (1 - V22.RECENT_FORM_WEIGHT) + aR * V22.RECENT_FORM_WEIGHT;
  let prob = log5(hBl, aBl) + V22.HOME_ADVANTAGE;
  const hW = h.woba || LEAGUE_WOBA;
  const aW = a.woba || LEAGUE_WOBA;
  prob += (pf - 1.0) * ((hW - aW) / LEAGUE_WOBA) * V22.PARK_IMPACT;
  prob = prob * (1 - V22.REGRESSION_FACTOR) + 0.5 * V22.REGRESSION_FACTOR;
  return clamp(prob, 0.2, 0.8);
}

// ── Data fetch (as-of-date) ───────────────────────────────
async function fetchGamesInWindow(startDate: string, endDate: string): Promise<Game[]> {
  const data = await get("/schedule", {
    sportId: 1,
    season: 2026,
    gameType: "R",
    startDate,
    endDate,
    hydrate: "linescore,probablePitcher",
  });
  const games: Game[] = [];
  for (const d of data.dates ?? []) {
    for (const g of d.games ?? []) {
      if (g.status?.abstractGameState !== "Final") continue;
      const hs = g.teams.home.score ?? 0;
      const as_ = g.teams.away.score ?? 0;
      games.push({
        gamePk: g.gamePk,
        date: d.date,
        homeTeamId: g.teams.home.team.id,
        awayTeamId: g.teams.away.team.id,
        homeTeamName: g.teams.home.team.name,
        awayTeamName: g.teams.away.team.name,
        homeWon: hs > as_,
        homeScore: hs,
        awayScore: as_,
        homeStarterId: g.teams.home.probablePitcher?.id ?? null,
        awayStarterId: g.teams.away.probablePitcher?.id ?? null,
      });
    }
  }
  return games;
}

async function fetchTeamsAsOf(date: string): Promise<Map<number, Team>> {
  // 1) Standings snapshot as of date → W/L/RS/RA/L10
  const teams = new Map<number, Team>();
  const sd = await get("/standings", {
    leagueId: "103,104",
    season: 2026,
    standingsTypes: "regularSeason",
    hydrate: "team",
    date,
  });
  for (const rec of sd.records ?? []) {
    for (const tr of rec.teamRecords ?? []) {
      const l10 = tr.records?.splitRecords?.find(
        (r: { type: string }) => r.type === "lastTen",
      );
      teams.set(tr.team.id, {
        wins: tr.wins,
        losses: tr.losses,
        runsScored: tr.runsScored,
        runsAllowed: tr.runsAllowed,
        last10W: l10?.wins ?? 5,
        last10L: l10?.losses ?? 5,
        era: 0,
        woba: 0,
      });
    }
  }

  // 2) Team hitting + pitching via byDateRange (season_start → date)
  const [hit, pit] = await Promise.all([
    get("/teams/stats", {
      stats: "byDateRange",
      group: "hitting",
      sportId: 1,
      season: 2026,
      startDate: SEASON_START,
      endDate: date,
    }),
    get("/teams/stats", {
      stats: "byDateRange",
      group: "pitching",
      sportId: 1,
      season: 2026,
      startDate: SEASON_START,
      endDate: date,
    }),
  ]);
  for (const sp of pit.stats?.[0]?.splits ?? []) {
    const t = teams.get(sp.team.id);
    if (t) t.era = parseFloat(sp.stat.era) || 0;
  }
  for (const sp of hit.stats?.[0]?.splits ?? []) {
    const t = teams.get(sp.team.id);
    if (!t) continue;
    const s = sp.stat;
    const singles = (s.hits || 0) - (s.doubles || 0) - (s.triples || 0) - (s.homeRuns || 0);
    const denom =
      (s.atBats || 0) +
      (s.baseOnBalls || 0) -
      (s.intentionalWalks || 0) +
      (s.sacFlies || 0) +
      (s.hitByPitch || 0);
    if (denom > 0) {
      t.woba =
        (0.69 * ((s.baseOnBalls || 0) - (s.intentionalWalks || 0)) +
          0.72 * (s.hitByPitch || 0) +
          0.88 * singles +
          1.27 * (s.doubles || 0) +
          1.62 * (s.triples || 0) +
          2.1 * (s.homeRuns || 0)) /
        denom;
    }
  }
  return teams;
}

async function fetchStarterAsOf(pid: number, date: string): Promise<Starter | null> {
  try {
    const data = await get(`/people/${pid}/stats`, {
      stats: "byDateRange",
      group: "pitching",
      sportId: 1,
      season: 2026,
      startDate: SEASON_START,
      endDate: date,
    });
    const stat = data.stats?.[0]?.splits?.[0]?.stat;
    if (!stat) return null;
    const ipRaw = parseFloat(stat.inningsPitched || "0");
    const ip = Math.floor(ipRaw) + Math.round((ipRaw - Math.floor(ipRaw)) * 10) / 3;
    const fipIP = ip || 1;
    const fip =
      (13 * (stat.homeRuns || 0) +
        3 * ((stat.baseOnBalls || 0) + (stat.hitByPitch || 0)) -
        2 * (stat.strikeOuts || 0)) /
        fipIP +
      3.1;
    return {
      era: parseFloat(stat.era) || 0,
      fip: Math.max(0, fip),
      ip,
    };
  } catch {
    return null;
  }
}

// ── Main ───────────────────────────────────────────────────
async function main() {
  const daysArg = process.argv.find((a) => a.startsWith("--days="));
  const days = daysArg ? parseInt(daysArg.split("=")[1], 10) : 14;

  const today = new Date();
  const end = new Date(today);
  end.setDate(today.getDate() - 1); // yesterday
  const start = new Date(end);
  start.setDate(end.getDate() - (days - 1));
  const startDate = start.toISOString().slice(0, 10);
  const endDate = end.toISOString().slice(0, 10);

  console.log(`Walk-forward window: ${startDate} → ${endDate} (${days} days)`);
  console.log("Fetching completed games...");
  const games = await fetchGamesInWindow(startDate, endDate);
  console.log(`  ${games.length} completed games`);
  if (games.length === 0) {
    console.log("No games in window. Exiting.");
    return;
  }

  // Unique prior-day dates we need team snapshots for
  const priorDates = [...new Set(games.map((g) => priorDay(g.date)))].sort();
  console.log(`Unique prior-day dates: ${priorDates.length}`);

  // Fetch team snapshots sequentially (3 API calls per date)
  const teamsByDate = new Map<string, Map<number, Team>>();
  for (let i = 0; i < priorDates.length; i++) {
    const d = priorDates[i];
    process.stdout.write(`  team snapshot ${i + 1}/${priorDates.length} (${d})\r`);
    teamsByDate.set(d, await fetchTeamsAsOf(d));
    if (i + 1 < priorDates.length) await sleep(150);
  }
  process.stdout.write("\n");

  // Unique (starterId, priorDate) pairs
  const starterKeys = new Set<string>();
  for (const g of games) {
    const pd = priorDay(g.date);
    if (g.homeStarterId) starterKeys.add(`${g.homeStarterId}|${pd}`);
    if (g.awayStarterId) starterKeys.add(`${g.awayStarterId}|${pd}`);
  }
  console.log(`Unique (starter, date) pairs: ${starterKeys.size}`);

  const starterByKey = new Map<string, Starter | null>();
  const keys = [...starterKeys];
  for (let i = 0; i < keys.length; i += 10) {
    const batch = keys.slice(i, i + 10);
    const results = await Promise.all(
      batch.map(async (k) => {
        const [pidStr, date] = k.split("|");
        const s = await fetchStarterAsOf(parseInt(pidStr, 10), date);
        return { k, s };
      }),
    );
    for (const { k, s } of results) starterByKey.set(k, s);
    process.stdout.write(`  starters ${Math.min(i + 10, keys.length)}/${keys.length}\r`);
    if (i + 10 < keys.length) await sleep(200);
  }
  process.stdout.write("\n");

  // Score each game using the as-of-prior-day snapshot
  type Row = {
    gamePk: number;
    date: string;
    homeTeamId: number;
    awayTeamId: number;
    homeTeamName: string;
    awayTeamName: string;
    predictedHomeWin: number;
    actualHomeWin: number;
    predictedFavoritePick: "home" | "away";
    ml: string;
    result: "W" | "L";
    final_score: string;
  };
  const rows: Row[] = [];
  for (const g of games) {
    const pd = priorDay(g.date);
    const tmap = teamsByDate.get(pd);
    if (!tmap) continue;
    const h = tmap.get(g.homeTeamId);
    const a = tmap.get(g.awayTeamId);
    if (!h || !a) continue;
    const hs = g.homeStarterId ? starterByKey.get(`${g.homeStarterId}|${pd}`) ?? null : null;
    const as_ = g.awayStarterId ? starterByKey.get(`${g.awayStarterId}|${pd}`) ?? null : null;
    const pf = PARK_FACTORS[g.homeTeamId] ?? 1.0;
    const p = runModel(h, a, hs, as_, pf);
    const fav: "home" | "away" = p >= 0.5 ? "home" : "away";
    const favProb = fav === "home" ? p : 1 - p;
    const favWon = (fav === "home" && g.homeWon) || (fav === "away" && !g.homeWon);
    rows.push({
      gamePk: g.gamePk,
      date: g.date,
      homeTeamId: g.homeTeamId,
      awayTeamId: g.awayTeamId,
      homeTeamName: g.homeTeamName,
      awayTeamName: g.awayTeamName,
      predictedHomeWin: Math.round(p * 10000) / 10000,
      actualHomeWin: g.homeWon ? 1 : 0,
      predictedFavoritePick: fav,
      ml: mline(favProb),
      result: favWon ? "W" : "L",
      final_score: `${g.awayScore}-${g.homeScore}`,
    });
  }

  if (rows.length === 0) {
    console.log("No scored rows. Exiting.");
    return;
  }

  // Metrics
  const brier =
    rows.reduce((s, r) => s + (r.predictedHomeWin - r.actualHomeWin) ** 2, 0) / rows.length;
  const wins = rows.filter((r) => r.result === "W").length;
  const losses = rows.length - wins;
  const winRate = wins / rows.length;
  const STAKE = 100;
  let profit = 0;
  for (const r of rows) {
    const n = parseInt(r.ml, 10);
    if (r.result === "W") {
      if (n < 0) profit += (STAKE * 100) / Math.abs(n);
      else profit += (STAKE * n) / 100;
    } else profit -= STAKE;
  }
  const roi = (profit / (rows.length * STAKE)) * 100;

  const edges = [50, 55, 60, 65, 70, 75, 80, 85];
  const bins = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const lo = edges[i];
    const hi = edges[i + 1];
    const inBin = rows.filter((r) => {
      const fav =
        r.predictedFavoritePick === "home" ? r.predictedHomeWin : 1 - r.predictedHomeWin;
      return fav * 100 >= lo && fav * 100 < hi;
    });
    const bWins = inBin.filter((r) => r.result === "W").length;
    bins.push({
      binLabel: `${lo}–${hi}%`,
      binCenter: (lo + hi) / 2,
      predicted: (lo + hi) / 2,
      actual: inBin.length > 0 ? (bWins / inBin.length) * 100 : null,
      samples: inBin.length,
    });
  }

  const output = {
    schema_version: 1,
    kind: "walk_forward",
    disclaimer:
      "Walk-forward simulation. For each game, the model was re-run using only season-to-date stats ending the prior day — no look-ahead. Probable starters are taken from the MLB schedule hydrate at post time, which may occasionally differ from who actually took the mound. Closest simulation of realtime performance without a full archive of prior-morning slates.",
    generated_at: new Date().toISOString(),
    range: { start: startDate, end: endDate },
    days,
    model_version: "v2.2",
    total_games: rows.length,
    record: { w: wins, l: losses },
    win_rate_pct: Math.round(winRate * 10000) / 100,
    brier,
    roi_pct: Math.round(roi * 100) / 100,
    calibration_bins: bins,
    rows: rows.slice(-60).reverse(),
  };
  const outPath = path.join(process.cwd(), "public", "data", "walk-forward.json");
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(output, null, 2) + "\n", "utf-8");

  console.log("");
  console.log(`Games:      ${rows.length}`);
  console.log(`Record:     ${wins}-${losses} (${(winRate * 100).toFixed(1)}%)`);
  console.log(`Brier:      ${brier.toFixed(4)}`);
  console.log(`ROI:        ${roi.toFixed(1)}%`);
  console.log(`Wrote →     ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
