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
import LocalTime from "@/components/game/LocalTime";
import DateNavigator from "./page.client";
import DateRedirect from "./DateRedirect";
import HomeClient from "./HomeClient";
import { HeroText, NoGamesText, PitcherLabel, UpcomingTitle } from "./HeroClient";

export const metadata: Metadata = {
  title: "StatScope - MLB 심층 분석 플랫폼",
  description:
    "오늘의 MLB 경기 일정, 스코어, 선발 투수 정보를 확인하세요. StatScope에서 데이터로 야구를 읽으세요.",
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
              src="https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=1920&q=80&auto=format&fit=crop"
              alt=""
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-slate-900/70 via-slate-900/50 to-slate-900/80" />
          </div>
          <div className="mx-auto max-w-7xl px-4 py-16 sm:py-24 text-center relative z-10">
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl drop-shadow-lg">
              <span className="text-blue-400">Stat</span><span className="text-white">Scope</span>
            </h1>
            <p className="mt-4 text-lg sm:text-xl text-white font-semibold drop-shadow-md">MLB 심층 분석 플랫폼</p>
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

  return (
    <div>
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background image */}
        <div className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=1920&q=80&auto=format&fit=crop"
            alt=""
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
                src="https://images.unsplash.com/photo-1527247043589-f0dde57a5d5d?w=400&q=80&auto=format&fit=crop"
                alt=""
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
              <p className="text-xs text-slate-400">No games</p>
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
                  <p className="text-xs text-slate-400">+{games.length - 6}more games</p>
                )}
              </div>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
