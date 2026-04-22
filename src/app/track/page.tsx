import type { Metadata } from "next";
import Link from "next/link";
import fs from "node:fs/promises";
import path from "node:path";
import { getTeamById } from "@/data/teams";
import TeamBadge from "@/components/ui/TeamBadge";
import TrackSection, {
  type CalibrationBin,
  type TrackMetrics,
} from "./TrackSection";

export const metadata: Metadata = {
  title: "Prediction Track Record | StatScope",
  description:
    "Every pick our MLB win-probability model has publicly posted, plus a walk-forward simulation that rescored every recent game using only pre-game stats — full record, ROI, Brier, and calibration curves.",
  openGraph: {
    title: "StatScope Prediction Track Record",
    description:
      "Transparent model accountability — live public picks + walk-forward simulation with calibration curves.",
  },
  alternates: {
    canonical: "https://statscope-eta.vercel.app/track",
  },
};

export const revalidate = 300;

// ─── Types ──────────────────────────────────────────────────

interface LivePick {
  fav: string;
  fav_id: number;
  home_id: number;
  away_id: number;
  home: string;
  away: string;
  prob: number;
  ml: string;
  ou_line: number;
  ou_lean: "over" | "under" | "push";
  result: "W" | "L" | "no_result" | null;
  final_score?: string;
}
interface LiveDayEntry {
  date: string;
  checked: boolean;
  picks: LivePick[];
}
interface LiveHistory {
  schema_version: number;
  start_date: string;
  record: { w: number; l: number };
  picks: LiveDayEntry[];
}

interface WalkForwardRow {
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
}
interface WalkForwardFile {
  kind: "walk_forward";
  generated_at: string;
  range: { start: string; end: string };
  days: number;
  model_version: string;
  total_games: number;
  record: { w: number; l: number };
  win_rate_pct: number;
  brier: number;
  roi_pct: number;
  calibration_bins: CalibrationBin[];
  rows: WalkForwardRow[];
}

// ─── Data loaders ───────────────────────────────────────────

async function loadLive(): Promise<LiveHistory> {
  const p = path.join(process.cwd(), "public", "data", "picks-history.json");
  try {
    const raw = await fs.readFile(p, "utf-8");
    return JSON.parse(raw) as LiveHistory;
  } catch {
    return {
      schema_version: 1,
      start_date: new Date().toISOString().slice(0, 10),
      record: { w: 0, l: 0 },
      picks: [],
    };
  }
}

async function loadWalkForward(): Promise<WalkForwardFile | null> {
  const p = path.join(process.cwd(), "public", "data", "walk-forward.json");
  try {
    const raw = await fs.readFile(p, "utf-8");
    return JSON.parse(raw) as WalkForwardFile;
  } catch {
    return null;
  }
}

// ─── Metric helpers (live picks) ───────────────────────────

function mlProfit(ml: string, stake: number): number {
  const n = parseInt(ml, 10);
  if (isNaN(n)) return 0;
  if (n < 0) return (stake * 100) / Math.abs(n);
  return (stake * n) / 100;
}

function liveSettled(history: LiveHistory): LivePick[] {
  return history.picks
    .flatMap((d) => d.picks)
    .filter((p) => p.result === "W" || p.result === "L");
}

function computeLiveMetrics(settled: LivePick[]): TrackMetrics | null {
  if (settled.length === 0) return null;
  const stake = 100;
  let wins = 0;
  let losses = 0;
  let profit = 0;
  let brierSum = 0;
  for (const p of settled) {
    if (p.result === "W") {
      wins += 1;
      profit += mlProfit(p.ml, stake);
    } else if (p.result === "L") {
      losses += 1;
      profit -= stake;
    }
    const actual = p.result === "W" ? 1 : 0;
    brierSum += (actual - p.prob / 100) ** 2;
  }
  const total = wins + losses;
  return {
    wins,
    losses,
    winRatePct: total > 0 ? (wins / total) * 100 : 0,
    roiPct: total > 0 ? (profit / (total * stake)) * 100 : 0,
    brier: total > 0 ? brierSum / total : 0,
  };
}

function computeLiveBins(settled: LivePick[]): CalibrationBin[] {
  const edges = [50, 55, 60, 65, 70, 75, 80, 85];
  const bins: CalibrationBin[] = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const lo = edges[i];
    const hi = edges[i + 1];
    const inBin = settled.filter((p) => p.prob >= lo && p.prob < hi);
    const wins = inBin.filter((p) => p.result === "W").length;
    bins.push({
      binLabel: `${lo}–${hi}%`,
      binCenter: (lo + hi) / 2,
      predicted: (lo + hi) / 2,
      actual: inBin.length > 0 ? (wins / inBin.length) * 100 : null,
      samples: inBin.length,
    });
  }
  return bins;
}

function walkForwardMetrics(wf: WalkForwardFile): TrackMetrics {
  return {
    wins: wf.record.w,
    losses: wf.record.l,
    winRatePct: wf.win_rate_pct,
    roiPct: wf.roi_pct,
    brier: wf.brier,
  };
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ─── Page ───────────────────────────────────────────────────

export default async function TrackPage() {
  const [live, wf] = await Promise.all([loadLive(), loadWalkForward()]);
  const settled = liveSettled(live);
  const liveMetrics = computeLiveMetrics(settled);
  const liveBins = computeLiveBins(settled);
  const allDays = live.picks.slice().sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-800">
          Prediction Track Record
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Two independent measures of how well our v2.2 win-probability
          model is actually doing. Every pick the model has publicly posted
          is logged below, and every recent completed game is re-scored
          using only stats that would have been available the prior day —
          the closest honest simulation of realtime performance we can
          produce.
        </p>
      </div>

      {/* Why we publish this */}
      <section className="mb-10 rounded-2xl bg-white px-6 py-6 shadow-sm ring-1 ring-slate-200/60">
        <h2 className="text-lg font-semibold text-slate-800">
          Why We Publish This
        </h2>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          Most analytics sites show you picks but never show you whether
          those picks actually won. We think that&apos;s a credibility
          problem. The two sections below solve it from different angles:
        </p>
        <ul className="mt-3 list-disc pl-5 space-y-2 text-sm text-slate-600 leading-relaxed">
          <li>
            <strong>Live Posted Picks</strong> — a growing log of every
            daily pick the model has publicly posted to Bluesky and Reddit
            before first pitch, along with the actual outcome. Small
            sample, but independently timestamp-verifiable.
          </li>
          <li>
            <strong>Walk-Forward Simulation</strong> — for every recent
            completed MLB game, we re-run the model using only
            season-to-date stats ending the <em>prior day</em>, with
            probable pitchers as they were listed. No look-ahead. Much
            larger sample, closest thing to a realtime backtest.
          </li>
        </ul>
        <p className="mt-3 text-sm text-slate-600 leading-relaxed">
          For the model internals (9 factors, Pythagorean + FIP + wOBA +
          park-adjusted recency, 22% regression to mean) see the{" "}
          <Link href="/methodology" className="text-blue-600 hover:underline">
            methodology page
          </Link>
          . Everything is reproducible from the scripts committed in our
          public repository.
        </p>
      </section>

      {/* Section 1: Live Posted Picks */}
      <TrackSection
        id="live"
        rank="primary"
        title="Live Posted Picks"
        subtitle={`Every pick the bot has posted since ${formatDate(live.start_date)}. Independent timestamp on Bluesky and Reddit, so these records are not cherry-picked after the fact.`}
        badge="Real picks"
        badgeTone="emerald"
        body={
          <>
            <p>
              Each pick is posted before game time and the result is
              stamped once the final score is available. Payouts are
              computed at the moneyline we published, not closing line.
              This is the strictest, most honest accountability metric —
              but the sample builds slowly (about three picks per slate).
            </p>
          </>
        }
        metrics={liveMetrics}
        bins={liveBins}
        hasData={settled.length > 0}
        caveat={
          settled.length < 30 ? (
            <>
              Small-sample warning. With only {settled.length} settled
              pick{settled.length === 1 ? "" : "s"}, any record or ROI you
              see here is dominated by variance. The walk-forward section
              below gives a much larger sample to judge the model by while
              the live log grows.
            </>
          ) : undefined
        }
        footer={
          allDays.length > 0 ? (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">
                Full Posted-Pick Log
              </h3>
              <div className="space-y-5">
                {allDays.map((day) => (
                  <div key={day.date}>
                    <div className="mb-2 text-xs font-bold text-slate-600">
                      {formatDate(day.date)}
                    </div>
                    <div className="overflow-x-auto rounded-lg ring-1 ring-slate-200/60">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                            <th className="px-3 py-2 text-left font-semibold">
                              Matchup
                            </th>
                            <th className="px-3 py-2 text-left font-semibold">
                              Pick
                            </th>
                            <th className="px-3 py-2 text-center font-semibold">
                              WP
                            </th>
                            <th className="px-3 py-2 text-center font-semibold">
                              ML
                            </th>
                            <th className="px-3 py-2 text-center font-semibold">
                              Final
                            </th>
                            <th className="px-3 py-2 text-center font-semibold">
                              Result
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {day.picks.map((p, idx) => {
                            const team = getTeamById(p.fav_id);
                            return (
                              <tr
                                key={idx}
                                className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                              >
                                <td className="px-3 py-3 text-slate-600">
                                  <span className="text-slate-500">
                                    {p.away}
                                  </span>
                                  <span className="mx-2 text-slate-400">
                                    @
                                  </span>
                                  <span className="font-medium text-slate-700">
                                    {p.home}
                                  </span>
                                </td>
                                <td className="px-3 py-3">
                                  <div className="flex items-center gap-2">
                                    {team && (
                                      <TeamBadge
                                        name={team.name}
                                        nameKo={team.nameKo}
                                        colorPrimary={team.colorPrimary}
                                        colorAccent={team.colorAccent}
                                        teamId={team.id}
                                        size="sm"
                                      />
                                    )}
                                    <span className="text-slate-700 font-medium">
                                      {p.fav}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-3 py-3 text-center tabular-nums font-semibold text-slate-700">
                                  {p.prob.toFixed(1)}%
                                </td>
                                <td className="px-3 py-3 text-center tabular-nums font-mono text-slate-600">
                                  {p.ml}
                                </td>
                                <td className="px-3 py-3 text-center tabular-nums font-mono text-slate-500">
                                  {p.final_score ?? "—"}
                                </td>
                                <td className="px-3 py-3 text-center">
                                  {p.result === "W" ? (
                                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                                      W
                                    </span>
                                  ) : p.result === "L" ? (
                                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-100 text-red-700 text-xs font-bold">
                                      L
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 text-xs">
                                      —
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : undefined
        }
      />

      {/* Section 2: Walk-Forward Simulation */}
      {wf ? (
        <TrackSection
          id="walk-forward"
          rank="secondary"
          title="Walk-Forward Simulation"
          subtitle={`For every completed MLB game in the last ${wf.days} days (${formatDate(wf.range.start)} → ${formatDate(wf.range.end)}) we re-ran the model using only stats available through the day before first pitch. Generated ${new Date(wf.generated_at).toLocaleDateString("en-US")}.`}
          badge="Simulated"
          badgeTone="amber"
          body={
            <>
              <p>
                This section answers: <em>&quot;If the bot had been live
                since the start of the season and posted the favorite in
                every game using stats available that morning, how would
                it have done?&quot;</em> The numbers below are the honest
                answer. No look-ahead data from future games is used;
                probable pitchers come from the MLB schedule hydrate
                snapshot at post time.
              </p>
              <p className="mt-2">
                Expect walk-forward numbers to be{" "}
                <strong>notably worse than retrospective backtests</strong>{" "}
                early in the season, because stats like team wOBA,
                bullpen ERA, and starter FIP are still very noisy with
                only a handful of games played. As the season matures and
                samples accumulate, the gap should narrow and calibration
                should tighten.
              </p>
            </>
          }
          metrics={walkForwardMetrics(wf)}
          bins={wf.calibration_bins}
          hasData={wf.rows.length > 0}
          caveat={
            <>
              Picks here are always on the model&apos;s favorite
              (probability ≥ 50%). This is intentionally a broader net
              than the top-3-per-slate filter we use for live posts,
              which explains why the per-game ROI can look rougher than
              the live section would under the same small-sample
              conditions. Totals and run-line markets are not included
              in this simulation.
            </>
          }
          footer={
            wf.rows.length > 0 ? (
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">
                  Sample of Recent Simulated Picks (newest first)
                </h3>
                <div className="overflow-x-auto rounded-lg ring-1 ring-slate-200/60">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                        <th className="px-3 py-2 text-left font-semibold">
                          Date
                        </th>
                        <th className="px-3 py-2 text-left font-semibold">
                          Matchup
                        </th>
                        <th className="px-3 py-2 text-left font-semibold">
                          Model Pick
                        </th>
                        <th className="px-3 py-2 text-center font-semibold">
                          WP
                        </th>
                        <th className="px-3 py-2 text-center font-semibold">
                          ML
                        </th>
                        <th className="px-3 py-2 text-center font-semibold">
                          Final
                        </th>
                        <th className="px-3 py-2 text-center font-semibold">
                          Result
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {wf.rows.slice(0, 20).map((r) => {
                        const favId =
                          r.predictedFavoritePick === "home"
                            ? r.homeTeamId
                            : r.awayTeamId;
                        const favName =
                          r.predictedFavoritePick === "home"
                            ? r.homeTeamName
                            : r.awayTeamName;
                        const favProb =
                          r.predictedFavoritePick === "home"
                            ? r.predictedHomeWin * 100
                            : (1 - r.predictedHomeWin) * 100;
                        const team = getTeamById(favId);
                        return (
                          <tr
                            key={r.gamePk}
                            className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                          >
                            <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">
                              {formatDate(r.date)}
                            </td>
                            <td className="px-3 py-3 text-slate-600">
                              <span className="text-slate-500">
                                {r.awayTeamName}
                              </span>
                              <span className="mx-2 text-slate-400">@</span>
                              <span className="font-medium text-slate-700">
                                {r.homeTeamName}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-2">
                                {team && (
                                  <TeamBadge
                                    name={team.name}
                                    nameKo={team.nameKo}
                                    colorPrimary={team.colorPrimary}
                                    colorAccent={team.colorAccent}
                                    teamId={team.id}
                                    size="sm"
                                  />
                                )}
                                <span className="text-slate-700 font-medium">
                                  {favName}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-center tabular-nums font-semibold text-slate-700">
                              {favProb.toFixed(1)}%
                            </td>
                            <td className="px-3 py-3 text-center tabular-nums font-mono text-slate-600">
                              {r.ml}
                            </td>
                            <td className="px-3 py-3 text-center tabular-nums font-mono text-slate-500">
                              {r.final_score}
                            </td>
                            <td className="px-3 py-3 text-center">
                              {r.result === "W" ? (
                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                                  W
                                </span>
                              ) : (
                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-100 text-red-700 text-xs font-bold">
                                  L
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  Showing the 20 most recent of {wf.total_games}{" "}
                  simulated picks. Full data is checked into the
                  repository at{" "}
                  <code className="text-xs bg-slate-100 rounded px-1 py-0.5">
                    public/data/walk-forward.json
                  </code>
                  .
                </p>
              </div>
            ) : undefined
          }
        />
      ) : (
        <section className="mb-10 rounded-2xl bg-white px-6 py-10 text-center text-sm text-slate-500 shadow-sm ring-1 ring-slate-200/60">
          Walk-forward simulation is regenerating — check back in a few
          minutes.
        </section>
      )}

      <p className="mt-6 text-xs text-slate-500 leading-relaxed">
        <strong>Disclaimer.</strong> Records and ROI shown above are
        computed from the public model&apos;s posted picks and from an
        automated walk-forward simulation. Past performance does not
        guarantee future results. Nothing on this page is financial
        advice — please wager responsibly and within your limits. Problem
        gambling? Call 1-800-GAMBLER (US) or visit{" "}
        <a
          href="https://www.ncpgambling.org/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          ncpgambling.org
        </a>
        .
      </p>
    </div>
  );
}
