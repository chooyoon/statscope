import type { Metadata } from "next";
import Link from "next/link";
import {
  fetchSchedule,
  type ScheduleGame,
} from "@/lib/sports/mlb/api";
import { getTeamById } from "@/data/teams";
import { displayName } from "@/data/players";
import TeamBadge from "@/components/ui/TeamBadge";
import LocalTime from "@/components/game/LocalTime";
import DateNavigator from "./page.client";
import DateRedirect from "./DateRedirect";
import HomeClient from "./HomeClient";
import LiveScoreUpdater from "@/components/game/LiveScoreUpdater";
import { HeroText, NoGamesText, PitcherLabel, UpcomingTitle } from "./HeroClient";
import TodayPicksSection from "@/components/picks/TodayPicksSection";
import { isKR } from "@/lib/config";

const T = (en: string, ko: string) => isKR ? ko : en;

export const metadata: Metadata = {
  title: "StatScope - MLB Deep Analytics Platform",
  description:
    "Today's MLB schedule, scores, and starting pitcher info. Data-driven baseball analytics at StatScope.",
  openGraph: {
    title: "StatScope - Today's MLB Games",
    description: "Live MLB scores, starting pitchers, and data-driven game previews.",
  },
};

function todayStringUTC(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = (now.getMonth() + 1).toString().padStart(2, "0");
  const d = now.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getGameSortOrder(game: ScheduleGame): number {
  const state = game.status.abstractGameState;
  if (state === "Live") return 0;
  if (state === "Final") return 2;
  return 1; // Preview
}

function getGameTypeLabel(game: ScheduleGame): { label: string; className: string } | null {
  // gameType: S=Spring Training, E=Exhibition, R=Regular, F=Wild Card, D=Division, L=League, W=World Series
  const gt = (game as any).gameType;
  if (gt === "S" || gt === "E") return { label: "Spring Training", className: "bg-amber-50 text-amber-600 ring-1 ring-amber-200" };
  if (gt === "F") return { label: "Wild Card", className: "bg-purple-50 text-purple-600 ring-1 ring-purple-200" };
  if (gt === "D") return { label: "Division Series", className: "bg-purple-50 text-purple-600 ring-1 ring-purple-200" };
  if (gt === "L") return { label: "Championship", className: "bg-purple-50 text-purple-600 ring-1 ring-purple-200" };
  if (gt === "W") return { label: "World Series", className: "bg-red-50 text-red-600 ring-1 ring-red-200" };
  return null; // Regular season - no badge
}

function getGameStatusLabel(game: ScheduleGame): {
  text: string;
  className: string;
  isTime?: boolean;
} {
  // abstractGameState is the single source of truth from MLB API
  const state = game.status.abstractGameState;
  const detailed = game.status.detailedState;

  if (state === "Final") {
    return {
      text: detailed === "Completed Early" ? "Early End" : "Final",
      className: "text-slate-500 bg-slate-100 ring-1 ring-slate-200",
    };
  }

  if (state === "Live") {
    const inning = game.linescore?.currentInning ?? "";
    const half = game.linescore?.inningHalf === "Top" ? "T" : "B";
    return {
      text: inning ? `${half}${inning}` : "LIVE",
      className: "text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200",
    };
  }

  // Preview / Scheduled — time will be rendered by LocalTime component
  return {
    text: game.gameDate, // pass raw ISO date, LocalTime will format it
    className: "text-blue-600 bg-blue-50 ring-1 ring-blue-200",
    isTime: true,
  };
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const rawDate = params.date;
  const hasDateParam = typeof rawDate === "string";
  const dateParam = hasDateParam ? rawDate : todayStringUTC();

  // If no date param, show loading shell — client will redirect to local date
  if (!hasDateParam) {
    return (
      <div>
        <section className="relative overflow-hidden">
          <div className="absolute inset-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://images.unsplash.com/photo-1471295253337-3ceaaedca402?w=1920&q=80&auto=format&fit=crop"
              alt="Baseball stadium aerial view"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-slate-900/70 via-slate-900/50 to-slate-900/80" />
          </div>
          <div className="mx-auto max-w-7xl px-4 py-16 sm:py-24 text-center relative z-10">
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl drop-shadow-lg">
              <span className="text-blue-400">Stat</span><span className="text-white">Scope</span>
            </h1>
            <p className="mt-4 text-lg sm:text-xl text-white font-semibold drop-shadow-md">MLB Deep Analytics Platform</p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 z-10">
            <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full" preserveAspectRatio="none">
              <path d="M0 60V30C240 0 480 0 720 30C960 60 1200 60 1440 30V60H0Z" fill="#f8fafc" />
            </svg>
          </div>
        </section>
        <div className="mx-auto max-w-7xl px-4 py-16 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-blue-500" />
          <p className="text-slate-400 mt-4">Loading schedule...</p>
        </div>
        <DateRedirect />
      </div>
    );
  }

  const schedule = await fetchSchedule(dateParam);

  const games: ScheduleGame[] =
    schedule.dates.length > 0 ? schedule.dates[0].games : [];

  // Sort: live first, then scheduled, then finished
  const sortedGames = [...games].sort(
    (a, b) => getGameSortOrder(a) - getGameSortOrder(b)
  );

  const hasLiveGames = games.some(
    (g) => g.status.abstractGameState === "Live"
  );

  return (
    <div>
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background image */}
        <div className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://images.unsplash.com/photo-1471295253337-3ceaaedca402?w=1920&q=80&auto=format&fit=crop"
            alt="Baseball stadium aerial view"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/70 via-slate-900/50 to-slate-900/80" />
        </div>
        <div className="mx-auto max-w-7xl px-4 py-16 sm:py-24 text-center relative z-10">
          <HeroText />
        </div>
        {/* Bottom wave decoration */}
        <div className="absolute bottom-0 left-0 right-0 z-10">
          <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full" preserveAspectRatio="none">
            <path d="M0 60V30C240 0 480 0 720 30C960 60 1200 60 1440 30V60H0Z" fill="#f8fafc" />
          </svg>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Personalized Dashboard (logged-in users) */}
        <HomeClient />

        {/* Live Score Auto-updater */}
        <LiveScoreUpdater hasLiveGames={hasLiveGames} />

        {/* Intro Section — plain-text overview for first-time visitors */}
        <section className="mb-10 rounded-2xl bg-white px-6 py-8 shadow-sm ring-1 ring-slate-200/60">
          <h2 className="text-2xl font-bold text-slate-800">
            {T("Data-Driven MLB Analysis, Made for Fans", "팬을 위한 데이터 기반 MLB 분석")}
          </h2>
          <p className="mt-3 text-slate-600 leading-relaxed">
            {T(
              `StatScope is a free, independent baseball analytics platform built for Major League Baseball fans, fantasy players, and anyone who wants to understand the game beyond the box score. Every matchup on this page is paired with a transparent win-probability estimate, moneyline and over/under projections, park-adjusted run expectancy, and lineup-level sabermetrics (wOBA, wRC+, FIP, BABIP) drawn directly from the official MLB Stats API.`,
              `StatScope는 메이저리그 팬, 판타지 선수, 그리고 박스 스코어를 넘어 게임을 이해하고자 하는 누구든지를 위해 구축된 무료의 독립적인 야구 분석 플랫폼입니다. 이 페이지의 모든 경기는 투명한 승리 확률 추정치, 머니라인 및 오버/언더 예측, 공원 조정 득점 기대값, 그리고 공식 MLB Stats API에서 직접 가져온 라인업 수준의 세이버메트릭스(wOBA, wRC+, FIP, BABIP)와 함께 제공됩니다.`
            )}
          </p>
          <p className="mt-3 text-slate-600 leading-relaxed">
            {T(
              `Unlike most scoreboards, we show our work. Our win-probability model (v2.2) blends Pythagorean expectation, starter FIP, bullpen ERA, lineup wOBA, recent 30-day form, Log5 matchup logic, a 6.6% home-field adjustment, the park factor of the venue, and a 22% regression term toward league average. The weights were grid-searched against 246 real games (Brier score 0.2336), and every pick we post publicly is logged in our `,
              `대부분의 스코어보드와 달리 우리는 작업을 보여줍니다. 우리의 승리 확률 모델(v2.2)은 Pythagorean 기대값, 선발 투수 FIP, 불펜 ERA, 라인업 wOBA, 최근 30일 폼, Log5 경기 로직, 6.6% 홈 필드 조정, 경기장의 공원 계수, 그리고 리그 평균으로의 22% 회귀항을 혼합합니다. 가중치는 246개의 실제 경기를 그리드 검색하여 결정되었으며(Brier 점수 0.2336), 우리가 공개적으로 게시한 모든 픽은 우리의 `
            )}
            <Link href="/track" className="text-blue-600 hover:underline">
              {T("Track Record", "예측 성적")}
            </Link>
            {T(
              ` so you can see the live hit rate, ROI, and calibration curve — you can also re-run the backtest yourself from the GitHub repository linked on our `,
              `에 기록되어 있으므로 실시간 적중률, ROI 및 캘리브레이션 곡선을 볼 수 있습니다 — 우리의 `
            )}
            <Link href="/about" className="text-blue-600 hover:underline">
              {T("About", "정보")}
            </Link>
            {T(
              ` page.`,
              ` 페이지에 연결된 GitHub 저장소에서 백테스트를 직접 다시 실행할 수도 있습니다.`
            )}
          </p>
          <p className="mt-3 text-slate-600 leading-relaxed">
            {T(
              `New to sabermetrics? The `,
              `세이버메트릭스가 처음이신가요? `
            )}
            <Link href="/learn" className="text-blue-600 hover:underline font-medium">
              {T("Learn", "학습")}
            </Link>
            {T(
              ` section explains every advanced stat we use — what it measures, why it matters, and how to read it in context. For the full methodology, assumptions, and known limitations of our models, head to `,
              ` 섹션에서는 우리가 사용하는 모든 고급 통계를 설명합니다 — 무엇을 측정하는지, 왜 중요한지, 그리고 맥락에서 읽는 방법. 우리 모델의 전체 방법론, 가정 및 알려진 제한 사항을 보려면 `
            )}
            <Link href="/methodology" className="text-blue-600 hover:underline font-medium">
              {T("Methodology", "방법론")}
            </Link>
            {T(
              `. You can also browse `,
              `로 이동하세요. `
            )}
            <Link href="/standings" className="text-blue-600 hover:underline font-medium">
              {T("standings", "팀 순위")}
            </Link>
            {T(
              `, jump into a `,
              `, `
            )}
            <Link href="/matchup" className="text-blue-600 hover:underline font-medium">
              {T("player matchup", "선수 대전")}
            </Link>
            {T(
              `, or catch the latest `,
              `, 또는 최신 `
            )}
            <Link href="/news" className="text-blue-600 hover:underline font-medium">
              {T("MLB news", "MLB 뉴스")}
            </Link>
            {T(
              ` curated by team.`,
              `를 팀별로 큐레이션한 것을 봅니다.`
            )}
          </p>
        </section>

        {/* Today's Picks & Analysis */}
        <TodayPicksSection date={dateParam} />

        {/* Date Navigator */}
        <div className="mb-8 flex justify-center">
          <DateNavigator date={dateParam} />
        </div>

        {/* Games Grid */}
        {sortedGames.length === 0 ? (
          <div className="rounded-2xl bg-white px-6 py-12 text-center shadow-sm ring-1 ring-slate-200/60 overflow-hidden relative">
            <div className="relative z-10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://images.unsplash.com/photo-1682384157322-32ab3932da07?w=400&q=80&auto=format&fit=crop"
                alt="Empty baseball field"
                className="w-24 h-24 object-cover rounded-full mx-auto mb-4 opacity-60"
              />
              <NoGamesText />
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sortedGames.map((game) => {
              const awayTeam = getTeamById(game.teams.away.team.id);
              const homeTeam = getTeamById(game.teams.home.team.id);
              const status = getGameStatusLabel(game);
              const isFinished = game.status.abstractGameState === "Final";
              const isLive = game.status.abstractGameState === "Live";
              const gameTypeBadge = getGameTypeLabel(game);

              const teamColor = homeTeam?.colorPrimary ?? "#6366f1";

              return (
                <Link
                  key={game.gamePk}
                  href={`/game/${game.gamePk}`}
                  className={`card-hover group relative rounded-2xl bg-white p-5 shadow-sm ring-1 transition-all ${
                    isLive
                      ? "ring-emerald-300 shadow-emerald-100"
                      : "ring-slate-200/60 hover:ring-slate-300"
                  }`}
                  style={{
                    borderLeft: `4px solid ${teamColor}`,
                  }}
                >
                  {/* Status badge row */}
                  <div className="mb-4 flex items-center justify-between">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.className}`}
                    >
                      {status.isTime ? (
                        <LocalTime utcDate={status.text} />
                      ) : (
                        status.text
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      {gameTypeBadge && (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${gameTypeBadge.className}`}>
                          {gameTypeBadge.label}
                        </span>
                      )}
                      {isLive && (
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Teams */}
                  <div className="flex items-center justify-between gap-3">
                    {/* Away */}
                    <div className="flex flex-col items-center gap-1 flex-1">
                      <TeamBadge
                        name={awayTeam?.name ?? game.teams.away.team.name}
                        nameKo={awayTeam?.nameKo ?? game.teams.away.team.name}
                        colorPrimary={awayTeam?.colorPrimary ?? "#6366f1"}
                        colorAccent={awayTeam?.colorAccent ?? "#818cf8"}
                        teamId={game.teams.away.team.id}
                        size="sm"
                      />
                      {(isFinished || isLive) &&
                        game.teams.away.score !== undefined && (
                          <span className="mt-1 text-3xl font-extrabold tabular-nums text-slate-800">
                            {game.teams.away.score}
                          </span>
                        )}
                    </div>

                    {/* VS divider */}
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      VS
                    </span>

                    {/* Home */}
                    <div className="flex flex-col items-center gap-1 flex-1">
                      <TeamBadge
                        name={homeTeam?.name ?? game.teams.home.team.name}
                        nameKo={homeTeam?.nameKo ?? game.teams.home.team.name}
                        colorPrimary={homeTeam?.colorPrimary ?? "#6366f1"}
                        colorAccent={homeTeam?.colorAccent ?? "#818cf8"}
                        teamId={game.teams.home.team.id}
                        size="sm"
                      />
                      {(isFinished || isLive) &&
                        game.teams.home.score !== undefined && (
                          <span className="mt-1 text-3xl font-extrabold tabular-nums text-slate-800">
                            {game.teams.home.score}
                          </span>
                        )}
                    </div>
                  </div>

                  {/* Probable Pitchers */}
                  {(game.teams.away.probablePitcher ||
                    game.teams.home.probablePitcher) && (
                    <div className="mt-4 border-t border-slate-100 pt-3">
                      <PitcherLabel />
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 font-medium">
                          {game.teams.away.probablePitcher
                            ? displayName(
                                game.teams.away.probablePitcher.id,
                                game.teams.away.probablePitcher.fullName
                              )
                            : "TBD"}
                        </span>
                        <span className="text-slate-500">vs</span>
                        <span className="text-slate-600 font-medium">
                          {game.teams.home.probablePitcher
                            ? displayName(
                                game.teams.home.probablePitcher.id,
                                game.teams.home.probablePitcher.fullName
                              )
                            : "TBD"}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Venue */}
                  <p className="mt-3 text-center text-xs text-slate-400">
                    {game.venue.name}
                  </p>
                </Link>
              );
            })}
          </div>
        )}

        {/* Upcoming Schedule Preview */}
        <UpcomingGames currentDate={dateParam} />

        {/* Long-form SEO / AdSense content section */}
        <section className="mt-16 rounded-2xl bg-white px-6 py-10 shadow-sm ring-1 ring-slate-200/60">
          <h2 className="text-2xl font-bold text-slate-800">
            {T("What You'll Find on StatScope", "StatScope에서 찾을 수 있는 것")}
          </h2>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <article>
              <h3 className="text-lg font-semibold text-slate-800">
                {T("Win Probability for Every Game", "모든 경기의 승리 확률")}
              </h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                {T(
                  `Click any matchup above to see our full nine-step win probability breakdown. We start with each team's Pythagorean expectation, layer in the starting pitchers' FIP (Fielding Independent Pitching — a park-neutral measure of true pitching performance), weight the bullpens by season ERA, and compare lineups using park-adjusted wOBA. We then apply Log5 to the two team strengths, add a 6.6% home-field advantage calibrated from the last three MLB seasons, apply the park factor of the host venue (Coors Field 1.35 on the high end, Oracle Park 0.93 on the low end), blend in a 30% recency factor so the last 30 days actually count, and finish with a 22% regression toward league average to avoid overfitting small samples.`,
                  `위의 경기를 클릭하여 전체 9단계 승리 확률 분석을 봅니다. 각 팀의 Pythagorean 기대값으로 시작하여 선발 투수의 FIP(공원 중립 투수 성과 측정)를 추가하고, 시즌 ERA별로 불펜에 가중치를 부여한 후 공원 조정 wOBA를 사용하여 라인업을 비교합니다. 그런 다음 Log5를 두 팀의 강점에 적용하고, 지난 3시즌의 MLB에서 보정된 6.6% 홈 필드 이점을 추가하며, 경기장의 공원 계수를 적용합니다(쿠어스 필드 1.35(상단), 오라클 공원 0.93(하단)), 30% 최근성 계수를 혼합하여 지난 30일을 실제로 반영하고, 작은 표본의 과적합을 피하기 위해 리그 평균으로의 22% 회귀로 마무리합니다.`
                )}
              </p>
            </article>

            <article>
              <h3 className="text-lg font-semibold text-slate-800">
                {T("Betting Odds, Translated", "배팅 오즈, 해석")}
              </h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                {T(
                  `Every game page shows our moneyline projection in American odds (e.g. -150 favorite, +130 underdog), an over/under total calculated from each team's runs-per-game, the opposing starter's FIP, the combined bullpen ERA, and the park factor, plus a run-line (-1.5) breakdown derived from the predicted margin. These are model estimates based on public data — not picks, not guarantees. Always compare against the sportsbook line to find real edge, and bet responsibly.`,
                  `모든 경기 페이지는 미국식 배당률(예: -150 선호팀, +130 언더도그)로 우리의 머니라인 예측을 보여주며, 각 팀의 경기당 득점, 상대 선발 투수의 FIP, 결합 불펜 ERA 및 공원 계수에서 계산된 오버/언더 합계, 예측 차이에서 파생된 런라인(-1.5) 분석을 제공합니다. 이는 공개 데이터를 기반으로 한 모델 추정치이며 픽이나 보장이 아닙니다. 항상 스포츠북 라인과 비교하여 실제 가치를 찾고 책임감 있게 베팅하세요.`
                )}
              </p>
            </article>

            <article>
              <h3 className="text-lg font-semibold text-slate-800">
                {T("Player-Level Sabermetrics", "선수별 세이버메트릭스")}
              </h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                {T(
                  `Open a player page to see season stats re-expressed in modern sabermetric terms: wOBA and wRC+ for hitters (how much offensive value they actually produced, park- and league-adjusted), FIP and xFIP for pitchers (what their strikeouts, walks, and home runs predict their ERA should be), ISO for raw power, BABIP to flag luck-driven slumps or hot streaks, and K%/BB% to gauge plate discipline. Each stat comes with a short explanation so you can read it in context.`,
                  `선수 페이지를 열어 시즌 통계를 현대 세이버메트릭 용어로 다시 표현된 것을 봅니다: 타자의 wOBA 및 wRC+(실제로 생산한 공격 가치, 공원 및 리그 조정), 투수의 FIP 및 xFIP(삼진, 볼넷, 홈런으로 예측하는 ERA), 순파워의 ISO, 운에 좌우되는 부진 또는 핫 스트릭을 표시하는 BABIP, 그리고 타석 규율을 측정하는 K%/BB%. 각 통계에는 맥락에서 읽을 수 있도록 간단한 설명이 함께 제공됩니다.`
                )}
              </p>
            </article>

            <article>
              <h3 className="text-lg font-semibold text-slate-800">
                {T("Team Pages, Standings, and News", "팀 페이지, 순위 및 뉴스")}
              </h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                {T(
                  `Each of the 30 MLB franchises has its own page with current record, run differential, active roster split by position players and pitchers, recent 10-game results with scores, and a team-specific news feed pulled from the official club sources. The `,
                  `30개의 MLB 프랜차이즈 각각은 현재 기록, 득점 차이, 포지션 선수와 투수별로 나뉜 활성 명단, 최근 10경기 결과 및 스코어, 공식 클럽 출처에서 가져온 팀별 뉴스 피드가 있는 자신의 페이지를 가지고 있습니다. `
                )}
                <Link href="/standings" className="text-blue-600 hover:underline">
                  {T("standings", "팀 순위")}
                </Link>
                {T(
                  ` page shows all six divisions with win percentage and games back, and the `,
                  ` 페이지는 승률과 게임 차이를 가진 6개 디비전 모두를 보여주며, `
                )}
                <Link href="/news" className="text-blue-600 hover:underline">
                  {T("news", "뉴스")}
                </Link>
                {T(
                  ` hub lets you filter headlines by any team so you're not drowning in irrelevant updates.`,
                  ` 허브는 팀별로 헤드라인을 필터링할 수 있게 해주므로 관련 없는 업데이트에 빠지지 않습니다.`
                )}
              </p>
            </article>
          </div>

          <div className="mt-8 border-t border-slate-100 pt-6">
            <h3 className="text-lg font-semibold text-slate-800">
              {T("Who StatScope Is For", "StatScope는 누구를 위한가")}
            </h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              {T(
                `We built StatScope for three kinds of baseball fans. The `,
                `StatScope를 3가지 유형의 야구 팬을 위해 만들었습니다. `
              )}
              <strong>{T("casual viewer", "캐주얼 시청자")}</strong>
              {T(
                ` who wants a cleaner scoreboard with actual context — not just a final score, but why a 6-2 game unfolded the way it did. The `,
                `는 실제 맥락과 함께 더 깨끗한 스코어보드를 원하는 사람 — 최종 스코어뿐만 아니라 6-2 경기가 왜 그런 식으로 진행되었는지를 원합니다. `
              )}
              <strong>{T("fantasy / DFS player", "판타지 / DFS 선수")}</strong>
              {T(
                ` who needs park-adjusted hitter projections, bullpen usage signals, and recent-form indicators before setting a lineup. And the `,
                `는 라인업을 설정하기 전에 공원 조정 타자 예측, 불펜 사용 신호 및 최근 폼 지표가 필요합니다. 그리고 `
              )}
              <strong>{T("analytics-curious fan", "분석에 관심 있는 팬")}</strong>
              {T(
                ` who wants to see the math behind the predictions — every constant in our model is documented on the `,
                `는 예측 뒤의 수학을 보고 싶은 사람 — 우리 모델의 모든 상수는 `
              )}
              <Link href="/methodology" className="text-blue-600 hover:underline">
                {T("methodology", "방법론")}
              </Link>
              {T(
                ` page and every backtest result is reproducible from the public repository.`,
                ` 페이지에 문서화되어 있으며 모든 백테스트 결과는 공개 저장소에서 재현 가능합니다.`
              )}
            </p>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed">
              {T(
                `Everything on StatScope is free to read. We're supported by display ads so we can keep the data open. No paywalls, no signup required to view any analysis, and no affiliate sportsbook promotions. If you spot a mistake in a calculation or want a feature added, the feedback link is on the `,
                `StatScope의 모든 것은 무료로 읽을 수 있습니다. 우리는 디스플레이 광고로 지원되므로 데이터를 공개할 수 있습니다. 어떤 분석을 보기 위해 페이월, 가입이 필요하지 않으며, 어떤 제휴 스포츠북 프로모션도 없습니다. 계산 오류를 발견하거나 기능을 추가하고 싶으면, 피드백 링크는 `
              )}
              <Link href="/about" className="text-blue-600 hover:underline">
                {T("About", "정보")}
              </Link>
              {T(
                ` page — we read everything.`,
                ` 페이지에 있습니다 — 우리는 모든 것을 읽습니다.`
              )}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

async function UpcomingGames({ currentDate }: { currentDate: string }) {
  const days: { date: string; label: string; games: ScheduleGame[] }[] = [];

  for (let i = 1; i <= 3; i++) {
    const d = new Date(currentDate + "T00:00:00");
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const label = `${month}/${day}`;

    try {
      const schedule = await fetchSchedule(dateStr);
      const games = schedule.dates.length > 0 ? schedule.dates[0].games : [];
      days.push({ date: dateStr, label, games });
    } catch {
      days.push({ date: dateStr, label, games: [] });
    }
  }

  if (days.every((d) => d.games.length === 0)) return null;

  return (
    <section className="mt-12">
      <UpcomingTitle />
      <div className="grid gap-4 md:grid-cols-3">
        {days.map(({ date, label, games }) => (
          <Link
            key={date}
            href={`/?date=${date}`}
            className="card-hover rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60 transition-all hover:ring-slate-300"
          >
            <h3 className="mb-3 text-sm font-bold text-blue-600">{label}</h3>
            {games.length === 0 ? (
              <p className="text-xs text-slate-400">{T("No games", "경기 없음")}</p>
            ) : (
              <div className="space-y-2">
                {games.slice(0, 6).map((game) => {
                  const away = getTeamById(game.teams.away.team.id);
                  const home = getTeamById(game.teams.home.team.id);
                  return (
                    <div key={game.gamePk} className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 font-medium">
                        {away?.name ?? game.teams.away.team.name}
                      </span>
                      <span className="text-slate-500">@</span>
                      <span className="text-slate-600 font-medium">
                        {home?.name ?? game.teams.home.team.name}
                      </span>
                    </div>
                  );
                })}
                {games.length > 6 && (
                  <p className="text-xs text-slate-400">+{games.length - 6}{T("more games", "추가 경기")}</p>
                )}
              </div>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
