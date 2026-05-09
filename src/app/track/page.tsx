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
import { isKR } from "@/lib/config";

const T = (en: string, ko: string) => isKR ? ko : en;

export const metadata: Metadata = {
  title: T("Prediction Track Record | StatScope", "예측 성적 | StatScope"),
  description: T(
    "Every pick our MLB win-probability model has publicly posted, plus a walk-forward simulation that rescored every recent game using only pre-game stats — full record, ROI, Brier, and calibration curves.",
    "우리의 MLB 승리 확률 모델이 공개적으로 게시한 모든 픽과 시즌 전 통계만 사용하여 최근의 모든 경기를 다시 채점한 워크포워드 시뮬레이션 — 전체 기록, ROI, Brier 및 캘리브레이션 곡선."
  ),
  openGraph: {
    title: T("StatScope Prediction Track Record", "StatScope 예측 성적"),
    description: T(
      "Transparent model accountability — live public picks + walk-forward simulation with calibration curves.",
      "투명한 모델 책임성 — 실시간 공개 픽 + 캘리브레이션 곡선을 포함한 워크포워드 시뮬레이션."
    ),
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
          {T("Prediction Track Record", "예측 성적")}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {T(
            `Two independent measures of how well our v2.2 win-probability
            model is actually doing. Every pick the model has publicly posted
            is logged below, and every recent completed game is re-scored
            using only stats that would have been available the prior day —
            the closest honest simulation of realtime performance we can
            produce.`,
            `우리의 v2.2 승리 확률 모델이 실제로 얼마나 잘 작동하는지에 대한 두 가지 독립적인 측정 방식입니다.
            모델이 공개적으로 게시한 모든 픽은 아래에 기록되며,
            최근에 완료된 모든 경기는 이전 날에 이용 가능했을 통계만 사용하여 다시 채점됩니다 —
            우리가 제공할 수 있는 실시간 성능의 가장 정직한 시뮬레이션입니다.`
          )}
        </p>
      </div>

      {/* Why we publish this */}
      <section className="mb-10 rounded-2xl bg-white px-6 py-6 shadow-sm ring-1 ring-slate-200/60">
        <h2 className="text-lg font-semibold text-slate-800">
          {T("Why We Publish This", "투명성을 중시하는 이유")}
        </h2>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          {T(
            `Most analytics sites show you picks but never show you whether
            those picks actually won. We think that's a credibility
            problem. The two sections below solve it from different angles:`,
            `대부분의 분석 사이트는 픽을 보여주지만 그 픽이 실제로 맞았는지는 보여주지 않습니다.
            우리는 이것이 신뢰성 문제라고 생각합니다. 아래의 두 섹션은 이를 다양한 각도에서 해결합니다:`
          )}
        </p>
        <ul className="mt-3 list-disc pl-5 space-y-2 text-sm text-slate-600 leading-relaxed">
          <li>
            <strong>{T("Live Posted Picks", "실시간 공개 픽")}</strong> — {T(
              `a growing log of every daily pick the model has publicly posted to Bluesky and Reddit before first pitch, along with the actual outcome. Small sample, but independently timestamp-verifiable.`,
              `첫 경기 시작 전 Bluesky와 Reddit에 공개적으로 게시한 매일의 모든 픽의 증가하는 기록과 실제 결과. 샘플이 작지만 독립적으로 타임스탬프로 검증 가능합니다.`
            )}
          </li>
          <li>
            <strong>{T("Walk-Forward Simulation", "워크포워드 시뮬레이션")}</strong> — {T(
              `for every recent completed MLB game, we re-run the model using only season-to-date stats ending the prior day, with probable pitchers as they were listed. No look-ahead. Much larger sample, closest thing to a realtime backtest.`,
              `최근 완료된 모든 MLB 경기에 대해 이전 날까지의 시즌 통계만 사용하여 모델을 다시 실행하고, 예정된 투수들을 그대로 사용합니다. 미리보기 없음. 훨씬 더 큰 샘플이며 실시간 백테스트에 가장 가까운 것입니다.`
            )}
          </li>
        </ul>
        <p className="mt-3 text-sm text-slate-600 leading-relaxed">
          {T(
            `For the model internals (9 factors, Pythagorean + FIP + wOBA + park-adjusted recency, 22% regression to mean) see the `,
            `모델 내부 사항(9가지 요소, Pythagorean + FIP + wOBA + 공원 조정 최근성, 22% 평균 회귀)은 `
          )}
          <Link href="/methodology" className="text-blue-600 hover:underline">
            {T("methodology page", "방법론 페이지")}
          </Link>
          {T(
            `. Everything is reproducible from the scripts committed in our public repository.`,
            `를 참조하세요. 모든 것은 우리의 공개 저장소에 커밋된 스크립트에서 재현 가능합니다.`
          )}
        </p>
      </section>

      {/* Section 1: Live Posted Picks */}
      <TrackSection
        id="live"
        rank="primary"
        title={T("Live Posted Picks", "실시간 공개 픽")}
        subtitle={T(
          `Every pick the bot has posted since ${formatDate(live.start_date)}. Independent timestamp on Bluesky and Reddit, so these records are not cherry-picked after the fact.`,
          `${formatDate(live.start_date)} 이후 봇이 게시한 모든 픽. Bluesky와 Reddit의 독립적인 타임스탬프이므로 이 기록은 사후 선택적으로 수집되지 않습니다.`
        )}
        badge={T("Real picks", "실제 픽")}
        badgeTone="emerald"
        body={
          <>
            <p>
              {T(
                `Each pick is posted before game time and the result is stamped once the final score is available. Payouts are computed at the moneyline we published, not closing line. This is the strictest, most honest accountability metric — but the sample builds slowly (about three picks per slate).`,
                `각 픽은 경기 시작 전에 게시되며 최종 스코어가 나온 후 결과가 기록됩니다.
                배당금은 우리가 게시한 머니라인으로 계산되며, 마감선이 아닙니다.
                이것은 가장 엄격하고 정직한 책임성 지표이지만, 샘플이 천천히 축적됩니다(슬레이트당 약 3개의 픽).`
              )}
            </p>
          </>
        }
        metrics={liveMetrics}
        bins={liveBins}
        hasData={settled.length > 0}
        caveat={
          settled.length < 30 ? (
            <>
              {T(
                `Small-sample warning. With only ${settled.length} settled pick${settled.length === 1 ? "" : "s"}, any record or ROI you see here is dominated by variance. The walk-forward section below gives a much larger sample to judge the model by while the live log grows.`,
                `소표본 경고입니다. 결제된 픽이 ${settled.length}개뿐이므로, 여기서 보는 모든 기록이나 ROI는 분산에 의해 지배됩니다. 아래의 워크포워드 섹션은 실시간 로그가 증가하는 동안 모델을 판단할 수 있는 훨씬 더 큰 샘플을 제공합니다.`
              )}
            </>
          ) : undefined
        }
        footer={
          allDays.length > 0 ? (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">
                {T("Full Posted-Pick Log", "전체 공개 픽 로그")}
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
                              {T("Matchup", "대전")}
                            </th>
                            <th className="px-3 py-2 text-left font-semibold">
                              {T("Pick", "픽")}
                            </th>
                            <th className="px-3 py-2 text-center font-semibold">
                              {T("WP", "WP")}
                            </th>
                            <th className="px-3 py-2 text-center font-semibold">
                              {T("ML", "ML")}
                            </th>
                            <th className="px-3 py-2 text-center font-semibold">
                              {T("Final", "최종")}
                            </th>
                            <th className="px-3 py-2 text-center font-semibold">
                              {T("Result", "결과")}
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
          title={T("Walk-Forward Simulation", "워크포워드 시뮬레이션")}
          subtitle={T(
            `For every completed MLB game in the last ${wf.days} days (${formatDate(wf.range.start)} → ${formatDate(wf.range.end)}) we re-ran the model using only stats available through the day before first pitch. Generated ${new Date(wf.generated_at).toLocaleDateString("en-US")}.`,
            `지난 ${wf.days}일 동안의 모든 완료된 MLB 경기(${formatDate(wf.range.start)} → ${formatDate(wf.range.end)})에 대해 첫 경기 하루 전까지 사용 가능한 통계만 사용하여 모델을 다시 실행했습니다. 생성 일시: ${new Date(wf.generated_at).toLocaleDateString("ko-KR")}.`
          )}
          badge={T("Simulated", "시뮬레이션")}
          badgeTone="amber"
          body={
            <>
              <p>
                {T(
                  `This section answers: "If the bot had been live since the start of the season and posted the favorite in every game using stats available that morning, how would it have done?" The numbers below are the honest answer. No look-ahead data from future games is used; probable pitchers come from the MLB schedule hydrate snapshot at post time.`,
                  `이 섹션은 다음 질문에 답합니다: "봇이 시즌 시작부터 실시간으로 운영되었고 매일 아침 사용 가능한 통계를 사용하여 모든 경기에서 선호팀을 게시했다면 어떻게 했을까?" 아래의 숫자는 정직한 답변입니다. 미래 경기의 미리보기 데이터는 사용되지 않습니다. 예정된 투수는 게시 시간에 MLB 일정 스냅샷에서 가져옵니다.`
                )}
              </p>
              <p className="mt-2">
                {T(
                  `Expect walk-forward numbers to be notably worse than retrospective backtests early in the season, because stats like team wOBA, bullpen ERA, and starter FIP are still very noisy with only a handful of games played. As the season matures and samples accumulate, the gap should narrow and calibration should tighten.`,
                  `시즌 초반에 워크포워드 수치가 소급 백테스트보다 훨씬 나쁠 것으로 예상됩니다. 팀 wOBA, 불펜 ERA, 선발 투수 FIP 같은 통계가 아직 소수의 경기만 진행되어 매우 변동성이 높기 때문입니다. 시즌이 진행되고 표본이 누적되면 이 차이가 좁혀지고 캘리브레이션이 더 정확해져야 합니다.`
                )}
              </p>
            </>
          }
          metrics={walkForwardMetrics(wf)}
          bins={wf.calibration_bins}
          hasData={wf.rows.length > 0}
          caveat={
            <>
              {T(
                `Picks here are always on the model's favorite (probability ≥ 50%). This is intentionally a broader net than the top-3-per-slate filter we use for live posts, which explains why the per-game ROI can look rougher than the live section would under the same small-sample conditions. Totals and run-line markets are not included in this simulation.`,
                `여기의 픽은 항상 모델의 선호팀(확률 ≥ 50%)입니다. 이것은 의도적으로 실시간 게시물에 사용하는 슬레이트당 상위 3개 필터보다 넓은 범위이며, 이것이 게임당 ROI가 동일한 소표본 조건에서 실시간 섹션보다 더 거칠어 보이는 이유를 설명합니다. 총점 및 런라인 시장은 이 시뮬레이션에 포함되지 않습니다.`
              )}
            </>
          }
          footer={
            wf.rows.length > 0 ? (
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">
                  {T("Sample of Recent Simulated Picks (newest first)", "최근 시뮬레이션 픽 샘플 (최신순)")}
                </h3>
                <div className="overflow-x-auto rounded-lg ring-1 ring-slate-200/60">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                        <th className="px-3 py-2 text-left font-semibold">
                          {T("Date", "날짜")}
                        </th>
                        <th className="px-3 py-2 text-left font-semibold">
                          {T("Matchup", "대전")}
                        </th>
                        <th className="px-3 py-2 text-left font-semibold">
                          {T("Model Pick", "모델 픽")}
                        </th>
                        <th className="px-3 py-2 text-center font-semibold">
                          {T("WP", "WP")}
                        </th>
                        <th className="px-3 py-2 text-center font-semibold">
                          {T("ML", "ML")}
                        </th>
                        <th className="px-3 py-2 text-center font-semibold">
                          {T("Final", "최종")}
                        </th>
                        <th className="px-3 py-2 text-center font-semibold">
                          {T("Result", "결과")}
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
                  {T(
                    `Showing the 20 most recent of ${wf.total_games} simulated picks. Full data is checked into the repository at `,
                    `${wf.total_games}개의 시뮬레이션 픽 중 가장 최근의 20개를 표시합니다. 전체 데이터는 저장소에 저장되어 있습니다: `
                  )}
                  <code className="text-xs bg-slate-100 rounded px-1 py-0.5">
                    public/data/walk-forward.json
                  </code>
                  {T(".", ".")}
                </p>
              </div>
            ) : undefined
          }
        />
      ) : (
        <section className="mb-10 rounded-2xl bg-white px-6 py-10 text-center text-sm text-slate-500 shadow-sm ring-1 ring-slate-200/60">
          {T(
            "Walk-forward simulation is regenerating — check back in a few minutes.",
            "워크포워드 시뮬레이션이 재생성 중입니다 — 몇 분 후 다시 확인하세요."
          )}
        </section>
      )}

      <p className="mt-6 text-xs text-slate-500 leading-relaxed">
        <strong>{T("Disclaimer.", "면책조항.")}</strong> {T(
          `Records and ROI shown above are computed from the public model's posted picks and from an automated walk-forward simulation. Past performance does not guarantee future results. Nothing on this page is financial advice — please wager responsibly and within your limits. Problem gambling? Call 1-800-GAMBLER (US) or visit `,
          `위에 표시된 기록 및 ROI는 공개 모델의 게시된 픽과 자동화된 워크포워드 시뮬레이션에서 계산됩니다. 과거 성과가 미래 결과를 보장하지 않습니다. 이 페이지의 어떤 것도 재정 조언이 아닙니다 — 책임감 있게 한계 내에서 베팅하세요. 도박 중독? 1-800-GAMBLER (US)에 전화하거나 `
        )}
        <a
          href="https://www.ncpgambling.org/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          ncpgambling.org
        </a>
        {T("를 방문하세요.", " visit.")}
      </p>
    </div>
  );
}
