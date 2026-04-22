import type { Metadata } from "next";
import Link from "next/link";
import fs from "node:fs/promises";
import path from "node:path";
import { getTeamById } from "@/data/teams";
import TeamBadge from "@/components/ui/TeamBadge";
import CalibrationChart from "./CalibrationChart";

export const metadata: Metadata = {
  title: "Prediction Track Record | StatScope",
  description:
    "Every pick our MLB win-probability model has made, with actual results, cumulative record, ROI at closing moneyline, and a live calibration curve.",
  openGraph: {
    title: "StatScope Prediction Track Record",
    description:
      "Transparent pick accountability: full history of model picks, live record, ROI, and calibration curve.",
  },
  alternates: {
    canonical: "https://statscope-eta.vercel.app/track",
  },
};

export const revalidate = 300; // Re-read file every 5 minutes

// ─── Data shapes ────────────────────────────────────────────

interface Pick {
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

interface DayEntry {
  date: string;
  checked: boolean;
  picks: Pick[];
}

interface PicksHistory {
  schema_version: number;
  start_date: string;
  record: { w: number; l: number };
  picks: DayEntry[];
}

// ─── Load picks history from the filesystem ────────────────

async function loadHistory(): Promise<PicksHistory> {
  const filePath = path.join(
    process.cwd(),
    "public",
    "data",
    "picks-history.json"
  );
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as PicksHistory;
  } catch {
    return {
      schema_version: 1,
      start_date: new Date().toISOString().slice(0, 10),
      record: { w: 0, l: 0 },
      picks: [],
    };
  }
}

// ─── Metric helpers ─────────────────────────────────────────

function mlProfit(ml: string, stake: number): number {
  const n = parseInt(ml, 10);
  if (isNaN(n)) return 0;
  if (n < 0) return (stake * 100) / Math.abs(n);
  return (stake * n) / 100;
}

function flattenSettled(history: PicksHistory): Pick[] {
  return history.picks
    .flatMap((d) => d.picks)
    .filter((p) => p.result === "W" || p.result === "L");
}

function computeMetrics(settled: Pick[]) {
  let wins = 0;
  let losses = 0;
  let profit = 0;
  let stakeTotal = 0;
  let brierSum = 0;

  const stake = 100; // assume $100 flat units

  for (const p of settled) {
    if (p.result === "W") {
      wins += 1;
      profit += mlProfit(p.ml, stake);
    } else if (p.result === "L") {
      losses += 1;
      profit -= stake;
    }
    stakeTotal += stake;
    const pProb = p.prob / 100;
    const actual = p.result === "W" ? 1 : 0;
    brierSum += (actual - pProb) ** 2;
  }

  const total = wins + losses;
  const winRate = total > 0 ? (wins / total) * 100 : 0;
  const roi = stakeTotal > 0 ? (profit / stakeTotal) * 100 : 0;
  const brier = total > 0 ? brierSum / total : 0;

  return { wins, losses, total, winRate, profit, roi, brier };
}

function computeCalibrationBins(settled: Pick[]) {
  const edges = [50, 55, 60, 65, 70, 75, 80, 85];
  const bins = [] as {
    binLabel: string;
    binCenter: number;
    predicted: number;
    actual: number | null;
    samples: number;
  }[];

  for (let i = 0; i < edges.length - 1; i++) {
    const lo = edges[i];
    const hi = edges[i + 1];
    const inBin = settled.filter((p) => p.prob >= lo && p.prob < hi);
    const center = (lo + hi) / 2;
    const wins = inBin.filter((p) => p.result === "W").length;
    bins.push({
      binLabel: `${lo}–${hi}%`,
      binCenter: center,
      predicted: center,
      actual: inBin.length > 0 ? (wins / inBin.length) * 100 : null,
      samples: inBin.length,
    });
  }
  return bins;
}

// ─── UI helpers ─────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function MetricCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "positive" | "negative" | "neutral";
}) {
  const valueColor =
    tone === "positive"
      ? "text-emerald-600"
      : tone === "negative"
        ? "text-red-600"
        : "text-slate-800";
  return (
    <div className="rounded-2xl bg-white px-6 py-5 shadow-sm ring-1 ring-slate-200/60">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </div>
      <div className={`mt-2 text-3xl font-extrabold tabular-nums ${valueColor}`}>
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────

export default async function TrackPage() {
  const history = await loadHistory();
  const settled = flattenSettled(history);
  const metrics = computeMetrics(settled);
  const bins = computeCalibrationBins(settled);

  const allPicks = history.picks
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const hasAnyData = settled.length > 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-800">
          Prediction Track Record
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Every pick our v2.2 win-probability model has publicly posted, with
          actual outcomes and live-computed accuracy metrics. Tracking started{" "}
          {formatDate(history.start_date)}.
        </p>
      </div>

      {/* Intro explainer */}
      <section className="mb-8 rounded-2xl bg-white px-6 py-6 shadow-sm ring-1 ring-slate-200/60">
        <h2 className="text-lg font-semibold text-slate-800">
          Why We Publish This
        </h2>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          Most analytics sites show their picks but never show you whether
          those picks actually won. We think that&apos;s a credibility
          problem. This page is the full, append-only history of every daily
          moneyline pick our model has produced since{" "}
          {formatDate(history.start_date)} — W/L outcome, model-estimated win
          probability at post time, and American moneyline. Metrics update
          automatically as games finalize.
        </p>
        <p className="mt-3 text-sm text-slate-600 leading-relaxed">
          For the model internals (9 factors, Pythagorean + FIP + wOBA +
          park-adjusted recency, 22% regression to mean) see the{" "}
          <Link href="/methodology" className="text-blue-600 hover:underline">
            methodology page
          </Link>
          . Picks are posted before game time on our{" "}
          <a
            href="https://bsky.app/profile/statscope.bsky.social"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            Bluesky account
          </a>{" "}
          and copied into{" "}
          <a
            href="https://reddit.com/r/sportsbook"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            r/sportsbook
          </a>{" "}
          discussion threads, so the timestamp is independently verifiable.
        </p>
      </section>

      {/* Metric cards */}
      <section className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Record"
          value={`${metrics.wins}–${metrics.losses}`}
          sub={`${metrics.total} settled pick${metrics.total === 1 ? "" : "s"}`}
        />
        <MetricCard
          label="Win Rate"
          value={hasAnyData ? `${metrics.winRate.toFixed(1)}%` : "—"}
          sub={
            metrics.total > 0
              ? `Avg model probability ${(
                  settled.reduce((a, p) => a + p.prob, 0) / settled.length
                ).toFixed(1)}%`
              : "No settled picks yet"
          }
          tone={
            !hasAnyData
              ? "neutral"
              : metrics.winRate >= 55
                ? "positive"
                : metrics.winRate < 45
                  ? "negative"
                  : "neutral"
          }
        />
        <MetricCard
          label="ROI at -110 flat $100"
          value={hasAnyData ? `${metrics.roi >= 0 ? "+" : ""}${metrics.roi.toFixed(1)}%` : "—"}
          sub={
            hasAnyData
              ? `Net ${metrics.profit >= 0 ? "+" : ""}$${metrics.profit.toFixed(0)} on $${metrics.total * 100}`
              : "Calculated at posted moneyline"
          }
          tone={
            !hasAnyData ? "neutral" : metrics.roi >= 0 ? "positive" : "negative"
          }
        />
        <MetricCard
          label="Brier Score"
          value={hasAnyData ? metrics.brier.toFixed(4) : "—"}
          sub="Lower = better. 0.25 = coin flip"
          tone={
            !hasAnyData
              ? "neutral"
              : metrics.brier < 0.24
                ? "positive"
                : metrics.brier > 0.26
                  ? "negative"
                  : "neutral"
          }
        />
      </section>

      {/* Calibration chart */}
      <section className="mb-10 rounded-2xl bg-white px-6 py-6 shadow-sm ring-1 ring-slate-200/60">
        <h2 className="text-lg font-semibold text-slate-800">
          Calibration Curve
        </h2>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          When our model says a team has a 70% chance to win, do they actually
          win 70% of the time? This chart bins every pick by the model&apos;s
          predicted probability (in 5-point windows) and plots the real
          win-rate of that bin against the dashed diagonal of perfect
          calibration. Points above the line mean we were too conservative;
          points below mean we were too confident.
        </p>

        <div className="mt-4">
          {hasAnyData ? (
            <CalibrationChart bins={bins} />
          ) : (
            <div className="rounded-xl bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">
              Calibration will render once we have at least one settled pick.
            </div>
          )}
        </div>

        {/* Bin summary table */}
        {hasAnyData && (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400">
                  <th className="px-3 py-2 text-left font-semibold">
                    Probability Bin
                  </th>
                  <th className="px-3 py-2 text-center font-semibold">
                    Samples
                  </th>
                  <th className="px-3 py-2 text-center font-semibold">
                    Actual Win Rate
                  </th>
                  <th className="px-3 py-2 text-center font-semibold">
                    Calibration Error
                  </th>
                </tr>
              </thead>
              <tbody>
                {bins.map((b) => {
                  const err =
                    b.actual !== null ? b.actual - b.binCenter : null;
                  return (
                    <tr key={b.binLabel} className="border-b border-slate-100">
                      <td className="px-3 py-2 font-medium text-slate-700">
                        {b.binLabel}
                      </td>
                      <td className="px-3 py-2 text-center tabular-nums text-slate-600">
                        {b.samples}
                      </td>
                      <td className="px-3 py-2 text-center tabular-nums text-slate-700">
                        {b.actual === null ? "—" : `${b.actual.toFixed(0)}%`}
                      </td>
                      <td
                        className={`px-3 py-2 text-center tabular-nums ${
                          err === null
                            ? "text-slate-400"
                            : Math.abs(err) <= 5
                              ? "text-emerald-600"
                              : "text-amber-600"
                        }`}
                      >
                        {err === null
                          ? "—"
                          : `${err >= 0 ? "+" : ""}${err.toFixed(0)} pts`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-slate-500">
              Early days: bins with very few samples are noisy by definition.
              As the sample grows, the curve should tighten toward the
              diagonal if the model is well-calibrated.
            </p>
          </div>
        )}
      </section>

      {/* Full picks table */}
      <section className="mb-10 rounded-2xl bg-white px-6 py-6 shadow-sm ring-1 ring-slate-200/60">
        <h2 className="text-lg font-semibold text-slate-800">
          Full Picks History
        </h2>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          Newest first. Each row is one pick as posted to Bluesky and Reddit
          before first pitch. &quot;—&quot; in the result column means the
          game has not finished or the result hasn&apos;t been checked yet.
        </p>

        {allPicks.length === 0 ? (
          <div className="mt-6 rounded-xl bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">
            No picks recorded yet.
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {allPicks.map((day) => (
              <div key={day.date}>
                <h3 className="mb-2 text-sm font-bold text-slate-700">
                  {formatDate(day.date)}
                </h3>
                <div className="overflow-x-auto rounded-xl ring-1 ring-slate-200/60">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                        <th className="px-3 py-2 text-left font-semibold">
                          Matchup
                        </th>
                        <th className="px-3 py-2 text-left font-semibold">
                          Pick
                        </th>
                        <th className="px-3 py-2 text-center font-semibold">
                          Model WP
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
                        const favTeam = getTeamById(p.fav_id);
                        return (
                          <tr
                            key={idx}
                            className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                          >
                            <td className="px-3 py-3 text-slate-700">
                              <span className="text-slate-500">{p.away}</span>
                              <span className="mx-2 text-slate-400">@</span>
                              <span className="text-slate-700 font-medium">
                                {p.home}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-2">
                                {favTeam && (
                                  <TeamBadge
                                    name={favTeam.name}
                                    nameKo={favTeam.nameKo}
                                    colorPrimary={favTeam.colorPrimary}
                                    colorAccent={favTeam.colorAccent}
                                    teamId={favTeam.id}
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
                                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                                  W
                                </span>
                              ) : p.result === "L" ? (
                                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-100 text-red-700 text-xs font-bold">
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
        )}
      </section>

      <p className="mt-6 text-xs text-slate-500 leading-relaxed">
        <strong>Disclaimer.</strong> Records and ROI shown above are
        computed from the public model&apos;s posted picks only. Past
        performance does not guarantee future results. Nothing on this page
        is financial advice — please wager responsibly and within your
        limits. Problem gambling? Call 1-800-GAMBLER (US) or visit{" "}
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
