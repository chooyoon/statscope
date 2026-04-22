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
            Data-Driven MLB Analysis, Made for Fans
          </h2>
          <p className="mt-3 text-slate-600 leading-relaxed">
            StatScope is a free, independent baseball analytics platform built
            for Major League Baseball fans, fantasy players, and anyone who
            wants to understand the game beyond the box score. Every matchup on
            this page is paired with a transparent win-probability estimate,
            moneyline and over/under projections, park-adjusted run expectancy,
            and lineup-level sabermetrics (wOBA, wRC+, FIP, BABIP) drawn
            directly from the official MLB Stats API.
          </p>
          <p className="mt-3 text-slate-600 leading-relaxed">
            Unlike most scoreboards, we show our work. Our win-probability
            model (v2.2) blends Pythagorean expectation, starter FIP, bullpen
            ERA, lineup wOBA, recent 30-day form, Log5 matchup logic, a 6.6%
            home-field adjustment, the park factor of the venue, and a 22%
            regression term toward league average. The weights were
            grid-searched against 246 real games (Brier score 0.2336), and
            every pick we post publicly is logged in our{" "}
            <Link href="/track" className="text-blue-600 hover:underline">
              Track Record
            </Link>{" "}
            so you can see the live hit rate, ROI, and calibration curve —
            you can also re-run the backtest yourself from the GitHub
            repository linked on our{" "}
            <Link href="/about" className="text-blue-600 hover:underline">
              About
            </Link>{" "}
            page.
          </p>
          <p className="mt-3 text-slate-600 leading-relaxed">
            New to sabermetrics? The{" "}
            <Link href="/learn" className="text-blue-600 hover:underline font-medium">
              Learn
            </Link>{" "}
            section explains every advanced stat we use — what it measures,
            why it matters, and how to read it in context. For the full
            methodology, assumptions, and known limitations of our models,
            head to{" "}
            <Link href="/methodology" className="text-blue-600 hover:underline font-medium">
              Methodology
            </Link>
            . You can also browse{" "}
            <Link href="/standings" className="text-blue-600 hover:underline font-medium">
              standings
            </Link>
            , jump into a{" "}
            <Link href="/matchup" className="text-blue-600 hover:underline font-medium">
              player matchup
            </Link>
            , or catch the latest{" "}
            <Link href="/news" className="text-blue-600 hover:underline font-medium">
              MLB news
            </Link>{" "}
            curated by team.
          </p>
        </section>

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
            What You&apos;ll Find on StatScope
          </h2>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <article>
              <h3 className="text-lg font-semibold text-slate-800">
                Win Probability for Every Game
              </h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Click any matchup above to see our full nine-step win
                probability breakdown. We start with each team&apos;s
                Pythagorean expectation, layer in the starting pitchers&apos;
                FIP (Fielding Independent Pitching — a park-neutral measure of
                true pitching performance), weight the bullpens by season
                ERA, and compare lineups using park-adjusted wOBA. We then
                apply Log5 to the two team strengths, add a 6.6% home-field
                advantage calibrated from the last three MLB seasons, apply
                the park factor of the host venue (Coors Field 1.35 on the
                high end, Oracle Park 0.93 on the low end), blend in a 30%
                recency factor so the last 30 days actually count, and finish
                with a 22% regression toward league average to avoid
                overfitting small samples.
              </p>
            </article>

            <article>
              <h3 className="text-lg font-semibold text-slate-800">
                Betting Odds, Translated
              </h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Every game page shows our moneyline projection in American
                odds (e.g. -150 favorite, +130 underdog), an over/under total
                calculated from each team&apos;s runs-per-game, the opposing
                starter&apos;s FIP, the combined bullpen ERA, and the park
                factor, plus a run-line (-1.5) breakdown derived from the
                predicted margin. These are model estimates based on public
                data — not picks, not guarantees. Always compare against the
                sportsbook line to find real edge, and bet responsibly.
              </p>
            </article>

            <article>
              <h3 className="text-lg font-semibold text-slate-800">
                Player-Level Sabermetrics
              </h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Open a player page to see season stats re-expressed in modern
                sabermetric terms: wOBA and wRC+ for hitters (how much
                offensive value they actually produced, park- and
                league-adjusted), FIP and xFIP for pitchers (what their
                strikeouts, walks, and home runs predict their ERA should
                be), ISO for raw power, BABIP to flag luck-driven slumps or
                hot streaks, and K%/BB% to gauge plate discipline. Each stat
                comes with a short explanation so you can read it in
                context.
              </p>
            </article>

            <article>
              <h3 className="text-lg font-semibold text-slate-800">
                Team Pages, Standings, and News
              </h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Each of the 30 MLB franchises has its own page with current
                record, run differential, active roster split by position
                players and pitchers, recent 10-game results with scores, and
                a team-specific news feed pulled from the official club
                sources. The{" "}
                <Link href="/standings" className="text-blue-600 hover:underline">
                  standings
                </Link>{" "}
                page shows all six divisions with win percentage and games
                back, and the{" "}
                <Link href="/news" className="text-blue-600 hover:underline">
                  news
                </Link>{" "}
                hub lets you filter headlines by any team so you&apos;re not
                drowning in irrelevant updates.
              </p>
            </article>
          </div>

          <div className="mt-8 border-t border-slate-100 pt-6">
            <h3 className="text-lg font-semibold text-slate-800">
              Who StatScope Is For
            </h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              We built StatScope for three kinds of baseball fans. The{" "}
              <strong>casual viewer</strong> who wants a cleaner scoreboard
              with actual context — not just a final score, but why a 6-2
              game unfolded the way it did. The{" "}
              <strong>fantasy / DFS player</strong> who needs park-adjusted
              hitter projections, bullpen usage signals, and recent-form
              indicators before setting a lineup. And the{" "}
              <strong>analytics-curious fan</strong> who wants to see the
              math behind the predictions — every constant in our model is
              documented on the{" "}
              <Link href="/methodology" className="text-blue-600 hover:underline">
                methodology
              </Link>{" "}
              page and every backtest result is reproducible from the public
              repository.
            </p>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed">
              Everything on StatScope is free to read. We&apos;re supported
              by display ads so we can keep the data open. No paywalls, no
              signup required to view any analysis, and no affiliate
              sportsbook promotions. If you spot a mistake in a calculation
              or want a feature added, the feedback link is on the{" "}
              <Link href="/about" className="text-blue-600 hover:underline">
                About
              </Link>{" "}
              page — we read everything.
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
