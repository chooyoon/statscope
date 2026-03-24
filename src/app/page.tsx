import type { Metadata } from "next";
import Link from "next/link";
import {
  fetchSchedule,
  type ScheduleGame,
} from "@/lib/sports/mlb/api";
import { getTeamById } from "@/data/teams";
import { displayName } from "@/data/players";
import TeamBadge from "@/components/ui/TeamBadge";
import AdBanner from "@/components/ads/AdBanner";
import DateNavigator from "./page.client";
import HomeClient from "./HomeClient";

export const metadata: Metadata = {
  title: "StatScope - MLB 심층 분석 플랫폼",
  description:
    "오늘의 MLB 경기 일정, 스코어, 선발 투수 정보를 확인하세요. StatScope에서 데이터로 야구를 읽으세요.",
};

function todayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = (now.getMonth() + 1).toString().padStart(2, "0");
  const d = now.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getGameSortOrder(game: ScheduleGame): number {
  const state = game.status.abstractGameState;
  if (state === "Live") return 0;
  if (state === "Preview") return 1;
  return 2; // Final
}

function getGameTypeLabel(game: ScheduleGame): { label: string; className: string } | null {
  // gameType: S=Spring Training, E=Exhibition, R=Regular, F=Wild Card, D=Division, L=League, W=World Series
  const gt = (game as any).gameType;
  if (gt === "S" || gt === "E") return { label: "시범경기", className: "bg-amber-50 text-amber-600 ring-1 ring-amber-200" };
  if (gt === "F") return { label: "와일드카드", className: "bg-purple-50 text-purple-600 ring-1 ring-purple-200" };
  if (gt === "D") return { label: "디비전시리즈", className: "bg-purple-50 text-purple-600 ring-1 ring-purple-200" };
  if (gt === "L") return { label: "챔피언십", className: "bg-purple-50 text-purple-600 ring-1 ring-purple-200" };
  if (gt === "W") return { label: "월드시리즈", className: "bg-red-50 text-red-600 ring-1 ring-red-200" };
  return null; // Regular season - no badge
}

function getGameStatusLabel(game: ScheduleGame): {
  text: string;
  className: string;
} {
  const state = game.status.abstractGameState;
  const detailed = game.status.detailedState;

  if (state === "Live") {
    const inning = game.linescore?.currentInning ?? "";
    const half = game.linescore?.inningHalf === "Top" ? "^" : "v";
    return {
      text: inning ? `${half}${inning}` : "LIVE",
      className: "text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200",
    };
  }

  if (state === "Final") {
    return {
      text: detailed === "Completed Early" ? "조기종료" : "종료",
      className: "text-slate-500 bg-slate-100 ring-1 ring-slate-200",
    };
  }

  // Preview / Scheduled
  const gameDate = new Date(game.gameDate);
  const hours = gameDate.getHours().toString().padStart(2, "0");
  const minutes = gameDate.getMinutes().toString().padStart(2, "0");
  return {
    text: `${hours}:${minutes}`,
    className: "text-blue-600 bg-blue-50 ring-1 ring-blue-200",
  };
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const dateParam =
    typeof params.date === "string" ? params.date : todayString();
  const schedule = await fetchSchedule(dateParam);

  const games: ScheduleGame[] =
    schedule.dates.length > 0 ? schedule.dates[0].games : [];

  // Sort: live first, then scheduled, then finished
  const sortedGames = [...games].sort(
    (a, b) => getGameSortOrder(a) - getGameSortOrder(b)
  );

  return (
    <div>
      {/* Hero Section */}
      <section className="hero-gradient baseball-pattern relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:py-20 text-center relative z-10">
          {/* Decorative baseballs */}
          <div className="absolute top-6 left-[10%] text-4xl opacity-20 select-none" aria-hidden="true">&#9918;</div>
          <div className="absolute bottom-8 right-[12%] text-5xl opacity-15 select-none" aria-hidden="true">&#9918;</div>
          <div className="absolute top-1/2 right-[5%] text-3xl opacity-10 select-none hidden sm:block" aria-hidden="true">&#9918;</div>

          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl text-white">
            Stat<span className="text-blue-200">Scope</span>
          </h1>
          <p className="mt-4 text-lg sm:text-xl text-blue-100 font-medium">
            MLB 심층 분석 플랫폼
          </p>
          <p className="mt-2 text-sm text-blue-200/70">
            경기 일정 &middot; 실시간 스코어 &middot; 선수 스탯 &middot; 팀 순위
          </p>
        </div>
        {/* Bottom wave decoration */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full" preserveAspectRatio="none">
            <path d="M0 60V30C240 0 480 0 720 30C960 60 1200 60 1440 30V60H0Z" fill="#f8fafc" />
          </svg>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Personalized Dashboard (logged-in users) */}
        <HomeClient />

        {/* Date Navigator */}
        <div className="mb-8 flex justify-center">
          <DateNavigator date={dateParam} />
        </div>

        {/* Games Grid */}
        {sortedGames.length === 0 ? (
          <div className="rounded-2xl bg-white px-6 py-16 text-center shadow-sm ring-1 ring-slate-200/60">
            <p className="text-lg text-slate-400">
              이 날짜에 예정된 경기가 없습니다.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sortedGames.map((game) => {
              const awayTeam = getTeamById(game.teams.away.team.id);
              const homeTeam = getTeamById(game.teams.home.team.id);
              const status = getGameStatusLabel(game);
              const isFinished =
                game.status.abstractGameState === "Final";
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
                      {status.text}
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
                      <p className="mb-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        선발 투수
                      </p>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 font-medium">
                          {game.teams.away.probablePitcher
                            ? displayName(
                                game.teams.away.probablePitcher.id,
                                game.teams.away.probablePitcher.fullName
                              )
                            : "미정"}
                        </span>
                        <span className="text-slate-500">vs</span>
                        <span className="text-slate-600 font-medium">
                          {game.teams.home.probablePitcher
                            ? displayName(
                                game.teams.home.probablePitcher.id,
                                game.teams.home.probablePitcher.fullName
                              )
                            : "미정"}
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

        {/* Ad */}
        <div className="mt-8 mb-4">
          <AdBanner slot="inline" />
        </div>

        {/* Upcoming Schedule Preview */}
        <UpcomingGames currentDate={dateParam} />
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
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    const label = `${month}/${day} (${weekdays[d.getDay()]})`;

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
      <h2 className="mb-6 text-xl font-bold text-slate-800">향후 일정</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {days.map(({ date, label, games }) => (
          <Link
            key={date}
            href={`/?date=${date}`}
            className="card-hover rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60 transition-all hover:ring-slate-300"
          >
            <h3 className="mb-3 text-sm font-bold text-blue-600">{label}</h3>
            {games.length === 0 ? (
              <p className="text-xs text-slate-400">경기 없음</p>
            ) : (
              <div className="space-y-2">
                {games.slice(0, 6).map((game) => {
                  const away = getTeamById(game.teams.away.team.id);
                  const home = getTeamById(game.teams.home.team.id);
                  return (
                    <div key={game.gamePk} className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 font-medium">
                        {away?.nameKo ?? game.teams.away.team.name}
                      </span>
                      <span className="text-slate-500">@</span>
                      <span className="text-slate-600 font-medium">
                        {home?.nameKo ?? game.teams.home.team.name}
                      </span>
                    </div>
                  );
                })}
                {games.length > 6 && (
                  <p className="text-xs text-slate-400">+{games.length - 6}경기 더</p>
                )}
              </div>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
