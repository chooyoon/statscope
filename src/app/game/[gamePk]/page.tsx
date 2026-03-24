import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  fetchGameBoxscore,
  fetchGameLinescore,
  fetchPlayerStats,
  type BoxscoreResponse,
  type BoxscorePlayer,
  type LinescoreResponse,
} from "@/lib/sports/mlb/api";
import {
  calcFIP,
  calcBABIP,
  calcKPercent,
  calcBBPercent,
} from "@/lib/sports/mlb/metrics";
import { getTeamById } from "@/data/teams";
import { displayName, displayNameFull } from "@/data/players";
import { getStatLabel } from "@/data/stats";
import TeamBadge from "@/components/ui/TeamBadge";
import StatBar from "@/components/ui/StatBar";
import AdBanner from "@/components/ads/AdBanner";
import WinProbability from "@/components/game/WinProbability";
import { predictWinProbability } from "@/lib/sports/mlb/predict";
import AnalysisNotes from "./AnalysisNotes";
import AICommentary from "./AICommentary";
import {
  InteractiveLineupTable,
  InteractivePitchingTable,
} from "./GameClient";
import PitchingStaffClient from "./PitchingStaffClient";
import Collapsible from "@/components/ui/Collapsible";
import FielderStaffClient from "./FielderStaffClient";
import RosterAnalysis from "./RosterAnalysis";
import { getActiveSeason } from "@/lib/sports/mlb/season";


function num(val: unknown): number {
  if (typeof val === "number") return val;
  if (typeof val === "string") return parseFloat(val) || 0;
  return 0;
}

function parseIP(ip: string | number): number {
  const val = typeof ip === "string" ? parseFloat(ip) : ip;
  const whole = Math.floor(val);
  const frac = Math.round((val - whole) * 10);
  return whole + frac / 3;
}

function buildPitchingStats(stat: Record<string, unknown>) {
  const ip = stat.inningsPitched;
  return {
    homeRuns: num(stat.homeRuns),
    baseOnBalls: num(stat.baseOnBalls),
    hitByPitch: num(stat.hitByPitch),
    strikeOuts: num(stat.strikeOuts),
    inningsPitched: typeof ip === "string" || typeof ip === "number" ? ip : "0",
    hits: num(stat.hits),
    sacFlies: num(stat.sacFlies),
    battersFaced: num(stat.battersFaced),
  };
}

// --- Metadata ---

export async function generateMetadata({
  params,
}: {
  params: Promise<{ gamePk: string }>;
}): Promise<Metadata> {
  const { gamePk } = await params;
  const pk = parseInt(gamePk, 10);
  if (isNaN(pk)) {
    return { title: "경기를 찾을 수 없습니다 | StatScope" };
  }

  try {
    const boxscore = await fetchGameBoxscore(pk);
    const homeTeam = getTeamById(boxscore.teams.home.team.id);
    const awayTeam = getTeamById(boxscore.teams.away.team.id);
    const homeName = homeTeam?.nameKo ?? boxscore.teams.home.team.name;
    const awayName = awayTeam?.nameKo ?? boxscore.teams.away.team.name;
    return {
      title: `${awayName} vs ${homeName} - 경기 분석 | StatScope`,
      description: `${awayName} vs ${homeName} 경기의 심층 분석, 라인스코어, 투수 비교, 타선 분석을 StatScope에서 확인하세요.`,
    };
  } catch {
    return { title: "경기 분석 | StatScope" };
  }
}

// --- Page ---

export default async function GameDetailPage({
  params,
}: {
  params: Promise<{ gamePk: string }>;
}) {
  const { gamePk } = await params;
  const pk = parseInt(gamePk, 10);
  if (isNaN(pk)) notFound();

  const CURRENT_SEASON = await getActiveSeason();

  let boxscore: BoxscoreResponse;
  let linescore: LinescoreResponse;
  let gameState: string = "Preview";
  let scheduleProbableHome: { id: number; fullName: string } | null = null;
  let scheduleProbableAway: { id: number; fullName: string } | null = null;

  try {
    const [boxRes, lineRes, schedRes] = await Promise.all([
      fetchGameBoxscore(pk),
      fetchGameLinescore(pk),
      fetch(
        `https://statsapi.mlb.com/api/v1/schedule?gamePk=${pk}&sportId=1&hydrate=probablePitcher`,
        { next: { revalidate: 120 } }
      ),
    ]);
    boxscore = boxRes;
    linescore = lineRes;

    if (schedRes.ok) {
      const schedData = await schedRes.json();
      const game = schedData.dates?.[0]?.games?.[0];
      if (game) {
        gameState = game.status?.abstractGameState ?? "Preview";
        if (game.teams?.away?.probablePitcher) {
          scheduleProbableAway = {
            id: game.teams.away.probablePitcher.id,
            fullName: game.teams.away.probablePitcher.fullName,
          };
        }
        if (game.teams?.home?.probablePitcher) {
          scheduleProbableHome = {
            id: game.teams.home.probablePitcher.id,
            fullName: game.teams.home.probablePitcher.fullName,
          };
        }
      }
    }
  } catch {
    notFound();
  }

  const homeTeam = getTeamById(boxscore.teams.home.team.id);
  const awayTeam = getTeamById(boxscore.teams.away.team.id);

  const homeColor = homeTeam?.colorPrimary ?? "#6366f1";
  const awayColor = awayTeam?.colorPrimary ?? "#818cf8";

  const homeRuns = num(linescore.teams?.home?.runs);
  const awayRuns = num(linescore.teams?.away?.runs);
  const homeHits = num(linescore.teams?.home?.hits);
  const awayHits = num(linescore.teams?.away?.hits);
  const homeErrors = num(linescore.teams?.home?.errors);
  const awayErrors = num(linescore.teams?.away?.errors);

  // Use abstractGameState as single source of truth
  const isFinished = gameState === "Final";
  const isLive = gameState === "Live";
  const gameStarted = isFinished || isLive;

  // Determine game status text
  let statusText = "예정";
  let statusClass = "text-blue-600 bg-blue-600/10";
  if (isLive) {
    const inning = linescore.currentInning ?? "";
    const half = linescore.inningHalf === "Top" ? "초" : "말";
    statusText = inning ? `${inning}회 ${half}` : "LIVE";
    statusClass = "text-green-600 bg-green-600/10";
  }
  if (isFinished) {
    statusText = "종료";
    statusClass = "text-slate-400 bg-slate-400/10";
  }

  // --- Starting Pitchers Season Stats ---
  // Identify starters: boxscore pitchers[0] first, fallback to schedule probablePitcher
  const homeStarterId = boxscore.teams.home.pitchers[0] ?? scheduleProbableHome?.id;
  const awayStarterId = boxscore.teams.away.pitchers[0] ?? scheduleProbableAway?.id;

  const homeStarter = homeStarterId
    ? (boxscore.teams.home.players[`ID${homeStarterId}`] ?? (scheduleProbableHome ? {
        person: { id: scheduleProbableHome.id, fullName: scheduleProbableHome.fullName },
        jerseyNumber: "",
        position: { abbreviation: "P" },
        stats: { batting: {}, pitching: {}, fielding: {} },
      } as BoxscorePlayer : undefined))
    : undefined;
  const awayStarter = awayStarterId
    ? (boxscore.teams.away.players[`ID${awayStarterId}`] ?? (scheduleProbableAway ? {
        person: { id: scheduleProbableAway.id, fullName: scheduleProbableAway.fullName },
        jerseyNumber: "",
        position: { abbreviation: "P" },
        stats: { batting: {}, pitching: {}, fielding: {} },
      } as BoxscorePlayer : undefined))
    : undefined;

  // Fetch season stats for both starters in parallel
  type SeasonPitchingStats = {
    era: string;
    whip: string;
    wins: number;
    losses: number;
    inningsPitched: string;
    strikeOuts: number;
    baseOnBalls: number;
    hits: number;
    homeRuns: number;
    hitByPitch: number;
    battersFaced: number;
    sacFlies: number;
    [key: string]: unknown;
  } | null;

  let homeStarterSeason: SeasonPitchingStats = null;
  let awayStarterSeason: SeasonPitchingStats = null;

  const starterFetches: Promise<void>[] = [];
  if (homeStarterId) {
    starterFetches.push(
      fetchPlayerStats(homeStarterId, CURRENT_SEASON, "pitching")
        .then((res) => {
          const stat = res.people?.[0]?.stats?.[0]?.splits?.[0]?.stat;
          if (stat) homeStarterSeason = stat as unknown as SeasonPitchingStats;
        })
        .catch(() => {})
    );
  }
  if (awayStarterId) {
    starterFetches.push(
      fetchPlayerStats(awayStarterId, CURRENT_SEASON, "pitching")
        .then((res) => {
          const stat = res.people?.[0]?.stats?.[0]?.splits?.[0]?.stat;
          if (stat) awayStarterSeason = stat as unknown as SeasonPitchingStats;
        })
        .catch(() => {})
    );
  }
  await Promise.all(starterFetches);

  // Calculate advanced metrics for starters
  function calcStarterAdvanced(season: SeasonPitchingStats) {
    if (!season) return null;
    const ps = buildPitchingStats(season as unknown as Record<string, unknown>);
    return {
      fip: calcFIP(ps),
      babip: calcBABIP(ps),
      kPct: calcKPercent(ps),
      bbPct: calcBBPercent(ps),
      era: parseFloat(season.era) || 0,
      whip: parseFloat(season.whip) || 0,
    };
  }

  const homeAdv = calcStarterAdvanced(homeStarterSeason);
  const awayAdv = calcStarterAdvanced(awayStarterSeason);

  // Win probability prediction
  const hss = homeStarterSeason as Record<string, unknown> | null;
  const ass = awayStarterSeason as Record<string, unknown> | null;
  const prediction = predictWinProbability({
    homePitcherERA: homeAdv?.era ?? 0,
    homePitcherWHIP: homeAdv?.whip ?? 0,
    homePitcherK: num(hss?.strikeOuts),
    homePitcherBB: num(hss?.baseOnBalls),
    awayPitcherERA: awayAdv?.era ?? 0,
    awayPitcherWHIP: awayAdv?.whip ?? 0,
    awayPitcherK: num(ass?.strikeOuts),
    awayPitcherBB: num(ass?.baseOnBalls),
    homeRecentWinPct: 0.5,
    awayRecentWinPct: 0.5,
  });

  // Build opposing player lists for matchup panels
  function extractPlayers(
    teamData: { battingOrder: number[]; pitchers: number[]; players: Record<string, BoxscorePlayer> },
    type: "batters" | "pitchers"
  ): { id: number; name: string }[] {
    const ids = type === "batters" ? teamData.battingOrder : teamData.pitchers;
    if (!ids) return [];
    return ids
      .map((pid) => {
        const p = teamData.players[`ID${pid}`];
        if (!p) return null;
        return {
          id: p.person.id,
          name: displayName(p.person.id, p.person.fullName),
        };
      })
      .filter((x): x is { id: number; name: string } => x !== null);
  }

  const homeBatters = extractPlayers(boxscore.teams.home, "batters");
  const awayBatters = extractPlayers(boxscore.teams.away, "batters");
  const homePitchers = extractPlayers(boxscore.teams.home, "pitchers");

  // Fetch active roster pitchers for both teams
  interface RosterEntry {
    person: { id: number; fullName: string };
    jerseyNumber?: string;
    position: { type?: string; code?: string; abbreviation?: string };
  }
  interface RosterResponse {
    roster: RosterEntry[];
  }

  async function fetchActiveRosterPitchers(teamId: number) {
    try {
      const res = await fetch(
        `https://statsapi.mlb.com/api/v1/teams/${teamId}/roster?rosterType=active&season=${new Date().getFullYear()}`,
        { next: { revalidate: 3600 } }
      );
      if (!res.ok) return [];
      const data: RosterResponse = await res.json();
      return (data.roster ?? [])
        .filter(
          (r) => r.position?.type === "Pitcher" || r.position?.code === "1"
        )
        .map((r) => ({
          id: r.person.id,
          fullName: r.person.fullName,
          jerseyNumber: r.jerseyNumber ?? "",
          position: r.position?.abbreviation ?? "P",
        }));
    } catch {
      return [];
    }
  }

  async function fetchActiveRosterFielders(teamId: number) {
    try {
      const res = await fetch(
        `https://statsapi.mlb.com/api/v1/teams/${teamId}/roster?rosterType=active&season=${new Date().getFullYear()}`,
        { next: { revalidate: 3600 } }
      );
      if (!res.ok) return [];
      const data: RosterResponse = await res.json();
      return (data.roster ?? [])
        .filter(
          (r) => r.position?.type !== "Pitcher" && r.position?.code !== "1"
        )
        .map((r) => ({
          id: r.person.id,
          fullName: r.person.fullName,
          jerseyNumber: r.jerseyNumber ?? "",
          position: r.position?.abbreviation ?? "",
        }));
    } catch {
      return [];
    }
  }

  const [homeRosterPitchers, awayRosterPitchers, homeRosterFielders, awayRosterFielders] = await Promise.all([
    fetchActiveRosterPitchers(boxscore.teams.home.team.id),
    fetchActiveRosterPitchers(boxscore.teams.away.team.id),
    fetchActiveRosterFielders(boxscore.teams.home.team.id),
    fetchActiveRosterFielders(boxscore.teams.away.team.id),
  ]);
  const awayPitchers = extractPlayers(boxscore.teams.away, "pitchers");

  // Full roster lists for matchup panels
  const homeRosterPitchersFull = homeRosterPitchers.map(p => ({
    id: p.id,
    name: displayName(p.id, p.fullName),
  }));
  const awayRosterPitchersFull = awayRosterPitchers.map(p => ({
    id: p.id,
    name: displayName(p.id, p.fullName),
  }));
  const homeRosterFieldersFull = homeRosterFielders.map(p => ({
    id: p.id,
    name: displayName(p.id, p.fullName),
  }));
  const awayRosterFieldersFull = awayRosterFielders.map(p => ({
    id: p.id,
    name: displayName(p.id, p.fullName),
  }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* ===== 1. GAME HEADER ===== */}
      <section className="mb-8">
        <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
          {/* Top bar with status */}
          <div className="flex items-center justify-center gap-3 py-3 border-b border-slate-200 bg-slate-50">
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass}`}
            >
              {statusText}
            </span>
          </div>

          {/* Team vs Team with scores */}
          <div className="flex items-center justify-center gap-4 sm:gap-8 py-8 px-4">
            {/* Away */}
            <div className="flex flex-col items-center gap-3 flex-1">
              <TeamBadge
                name={awayTeam?.name ?? boxscore.teams.away.team.name}
                nameKo={awayTeam?.nameKo ?? boxscore.teams.away.team.name}
                colorPrimary={awayColor}
                colorAccent={awayTeam?.colorAccent ?? "#818cf8"}
                teamId={boxscore.teams.away.team.id}
                size="lg"
              />
              {gameStarted && (
                <span
                  className="text-4xl sm:text-5xl font-extrabold tabular-nums"
                  style={{ color: awayRuns >= homeRuns ? awayColor : undefined }}
                >
                  {awayRuns}
                </span>
              )}
              <span className="text-xs text-slate-500">원정</span>
            </div>

            <div className="flex flex-col items-center gap-1">
              <span className="text-slate-600 text-lg font-bold">VS</span>
            </div>

            {/* Home */}
            <div className="flex flex-col items-center gap-3 flex-1">
              <TeamBadge
                name={homeTeam?.name ?? boxscore.teams.home.team.name}
                nameKo={homeTeam?.nameKo ?? boxscore.teams.home.team.name}
                colorPrimary={homeColor}
                colorAccent={homeTeam?.colorAccent ?? "#818cf8"}
                teamId={boxscore.teams.home.team.id}
                size="lg"
              />
              {gameStarted && (
                <span
                  className="text-4xl sm:text-5xl font-extrabold tabular-nums"
                  style={{ color: homeRuns >= awayRuns ? homeColor : undefined }}
                >
                  {homeRuns}
                </span>
              )}
              <span className="text-xs text-slate-500">홈</span>
            </div>
          </div>

          {/* Inning-by-Inning Linescore Table */}
          {gameStarted && linescore.innings && linescore.innings.length > 0 && (
            <div className="border-t border-slate-200 overflow-x-auto">
              <table className="w-full text-sm min-w-[500px]">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 w-24">
                      팀
                    </th>
                    {linescore.innings.map((inn) => (
                      <th
                        key={inn.num}
                        className="px-2 py-2 text-center text-xs font-semibold text-slate-500 w-8"
                      >
                        {inn.num}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-center text-xs font-bold text-slate-400 w-10">
                      R
                    </th>
                    <th className="px-3 py-2 text-center text-xs font-bold text-slate-400 w-10">
                      H
                    </th>
                    <th className="px-3 py-2 text-center text-xs font-bold text-slate-400 w-10">
                      E
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* Away row */}
                  <tr className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2 text-xs font-bold" style={{ color: awayColor }}>
                      {awayTeam?.abbreviation ?? "AWAY"}
                    </td>
                    {linescore.innings.map((inn) => (
                      <td
                        key={inn.num}
                        className="px-2 py-2 text-center text-xs font-mono text-slate-600"
                      >
                        {inn.away?.runs ?? "-"}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center text-sm font-bold text-slate-800">
                      {awayRuns}
                    </td>
                    <td className="px-3 py-2 text-center text-sm font-mono text-slate-600">
                      {awayHits}
                    </td>
                    <td className="px-3 py-2 text-center text-sm font-mono text-slate-600">
                      {awayErrors}
                    </td>
                  </tr>
                  {/* Home row */}
                  <tr className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-xs font-bold" style={{ color: homeColor }}>
                      {homeTeam?.abbreviation ?? "HOME"}
                    </td>
                    {linescore.innings.map((inn) => (
                      <td
                        key={inn.num}
                        className="px-2 py-2 text-center text-xs font-mono text-slate-600"
                      >
                        {inn.home?.runs ?? "-"}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center text-sm font-bold text-slate-800">
                      {homeRuns}
                    </td>
                    <td className="px-3 py-2 text-center text-sm font-mono text-slate-600">
                      {homeHits}
                    </td>
                    <td className="px-3 py-2 text-center text-sm font-mono text-slate-600">
                      {homeErrors}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ===== ROSTER SABERMETRICS COMPARISON ===== */}
      <RosterAnalysis
        homeTeamId={boxscore.teams.home.team.id}
        awayTeamId={boxscore.teams.away.team.id}
        homeColor={homeColor}
        awayColor={awayColor}
      />

      {/* ===== WIN PREDICTION ===== */}
      {(homeStarter || awayStarter) && (
        <section className="mb-8">
          <WinProbability
            prediction={prediction}
            homeTeamName={homeTeam?.nameKo ?? "홈"}
            awayTeamName={awayTeam?.nameKo ?? "원정"}
            homeColor={homeColor}
            awayColor={awayColor}
          />
        </section>
      )}

      {/* ===== AI COMMENTARY ===== */}
      <section className="mb-8">
        <AICommentary
          boxscore={boxscore}
          linescore={linescore}
          gameStarted={gameStarted}
          gameState={gameState}
          homeStarterSeason={homeStarterSeason as Record<string, unknown> | null}
          awayStarterSeason={awayStarterSeason as Record<string, unknown> | null}
          homeStarter={homeStarter ? { id: homeStarter.person.id, name: homeStarter.person.fullName } : null}
          awayStarter={awayStarter ? { id: awayStarter.person.id, name: awayStarter.person.fullName } : null}
          venueName={boxscore.teams.home.team.venue?.name ?? ""}
        />
      </section>

      {/* ===== 2. TEAM STATS SUMMARY ===== */}
      {gameStarted && (
        <section className="mb-8">
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span className="inline-block w-1 h-6 bg-blue-500 rounded-full" />
            팀 스탯 비교
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Batting comparison */}
            <div className="rounded-xl bg-white border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-400 mb-4">
                타격
              </h3>
              <TeamStatRow
                label="안타"
                away={num(boxscore.teams.away.teamStats?.batting?.hits)}
                home={num(boxscore.teams.home.teamStats?.batting?.hits)}
                awayColor={awayColor}
                homeColor={homeColor}
              />
              <TeamStatRow
                label="득점"
                away={num(boxscore.teams.away.teamStats?.batting?.runs)}
                home={num(boxscore.teams.home.teamStats?.batting?.runs)}
                awayColor={awayColor}
                homeColor={homeColor}
              />
              <TeamStatRow
                label="홈런"
                away={num(boxscore.teams.away.teamStats?.batting?.homeRuns)}
                home={num(boxscore.teams.home.teamStats?.batting?.homeRuns)}
                awayColor={awayColor}
                homeColor={homeColor}
              />
              <TeamStatRow
                label="볼넷"
                away={num(boxscore.teams.away.teamStats?.batting?.baseOnBalls)}
                home={num(boxscore.teams.home.teamStats?.batting?.baseOnBalls)}
                awayColor={awayColor}
                homeColor={homeColor}
              />
              <TeamStatRow
                label="삼진"
                away={num(boxscore.teams.away.teamStats?.batting?.strikeOuts)}
                home={num(boxscore.teams.home.teamStats?.batting?.strikeOuts)}
                awayColor={awayColor}
                homeColor={homeColor}
                lowerIsBetter
              />
            </div>

            {/* Pitching comparison */}
            <div className="rounded-xl bg-white border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-400 mb-4">
                투구
              </h3>
              <TeamStatRow
                label="탈삼진"
                away={num(boxscore.teams.away.teamStats?.pitching?.strikeOuts)}
                home={num(boxscore.teams.home.teamStats?.pitching?.strikeOuts)}
                awayColor={awayColor}
                homeColor={homeColor}
              />
              <TeamStatRow
                label="피안타"
                away={num(boxscore.teams.away.teamStats?.pitching?.hits)}
                home={num(boxscore.teams.home.teamStats?.pitching?.hits)}
                awayColor={awayColor}
                homeColor={homeColor}
                lowerIsBetter
              />
              <TeamStatRow
                label="볼넷허용"
                away={num(boxscore.teams.away.teamStats?.pitching?.baseOnBalls)}
                home={num(boxscore.teams.home.teamStats?.pitching?.baseOnBalls)}
                awayColor={awayColor}
                homeColor={homeColor}
                lowerIsBetter
              />
              <TeamStatRow
                label="자책점"
                away={num(boxscore.teams.away.teamStats?.pitching?.earnedRuns)}
                home={num(boxscore.teams.home.teamStats?.pitching?.earnedRuns)}
                awayColor={awayColor}
                homeColor={homeColor}
                lowerIsBetter
              />
              <TeamStatRow
                label="피홈런"
                away={num(boxscore.teams.away.teamStats?.pitching?.homeRuns)}
                home={num(boxscore.teams.home.teamStats?.pitching?.homeRuns)}
                awayColor={awayColor}
                homeColor={homeColor}
                lowerIsBetter
              />
            </div>
          </div>
        </section>
      )}

      {/* ===== 3. STARTING PITCHER ANALYSIS ===== */}
      {(homeStarter || awayStarter) && (
        <section className="mb-8">
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span className="inline-block w-1 h-6 bg-purple-500 rounded-full" />
            선발 투수 분석
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Away starter */}
            {awayStarter && (
              <PitcherCard
                player={awayStarter}
                seasonStats={awayStarterSeason}
                advanced={awayAdv}
                teamColor={awayColor}
                teamName={awayTeam?.nameKo ?? "원정"}
                side="원정"
                showGameStats={gameStarted}
              />
            )}
            {/* Home starter */}
            {homeStarter && (
              <PitcherCard
                player={homeStarter}
                seasonStats={homeStarterSeason}
                advanced={homeAdv}
                teamColor={homeColor}
                teamName={homeTeam?.nameKo ?? "홈"}
                side="홈"
                showGameStats={gameStarted}
              />
            )}
          </div>

          {/* Side-by-side comparison bars */}
          {(awayAdv || homeAdv) && (
            <div className="mt-4 rounded-xl bg-white border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-400 mb-4">
                시즌 성적 비교 (선발 투수)
              </h3>
              <div className="space-y-4">
                <ComparisonBar
                  label="ERA"
                  awayVal={(awayAdv?.era ?? 0)}
                  homeVal={(homeAdv?.era ?? 0)}
                  awayColor={awayColor}
                  homeColor={homeColor}
                  awayName={awayTeam?.abbreviation ?? "AWAY"}
                  homeName={homeTeam?.abbreviation ?? "HOME"}
                  max={6}
                  lowerIsBetter
                  format={(v) => v.toFixed(2)}
                />
                <ComparisonBar
                  label="FIP"
                  awayVal={(awayAdv?.fip ?? 0)}
                  homeVal={(homeAdv?.fip ?? 0)}
                  awayColor={awayColor}
                  homeColor={homeColor}
                  awayName={awayTeam?.abbreviation ?? "AWAY"}
                  homeName={homeTeam?.abbreviation ?? "HOME"}
                  max={6}
                  lowerIsBetter
                  format={(v) => v.toFixed(2)}
                />
                <ComparisonBar
                  label="WHIP"
                  awayVal={(awayAdv?.whip ?? 0)}
                  homeVal={(homeAdv?.whip ?? 0)}
                  awayColor={awayColor}
                  homeColor={homeColor}
                  awayName={awayTeam?.abbreviation ?? "AWAY"}
                  homeName={homeTeam?.abbreviation ?? "HOME"}
                  max={2}
                  lowerIsBetter
                  format={(v) => v.toFixed(2)}
                />
                <ComparisonBar
                  label="K%"
                  awayVal={(awayAdv?.kPct ?? 0)}
                  homeVal={(homeAdv?.kPct ?? 0)}
                  awayColor={awayColor}
                  homeColor={homeColor}
                  awayName={awayTeam?.abbreviation ?? "AWAY"}
                  homeName={homeTeam?.abbreviation ?? "HOME"}
                  max={40}
                  format={(v) => `${v.toFixed(1)}%`}
                />
                <ComparisonBar
                  label="BB%"
                  awayVal={(awayAdv?.bbPct ?? 0)}
                  homeVal={(homeAdv?.bbPct ?? 0)}
                  awayColor={awayColor}
                  homeColor={homeColor}
                  awayName={awayTeam?.abbreviation ?? "AWAY"}
                  homeName={homeTeam?.abbreviation ?? "HOME"}
                  max={15}
                  lowerIsBetter
                  format={(v) => `${v.toFixed(1)}%`}
                />
              </div>
            </div>
          )}
        </section>
      )}

      {/* ===== 3.5 ROSTER COMPOSITION (Collapsible) ===== */}
      <section className="mb-8">
        <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
          <span className="inline-block w-1 h-6 bg-indigo-500 rounded-full" />
          로스터 구성
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <Collapsible title={`${awayTeam?.nameKo ?? "원정"} 투수진 — ${awayRosterPitchers.length}명`} titleColor={awayColor}>
            <PitchingStaffClient
              rosterPitchers={awayRosterPitchers}
              teamColor={awayColor}
              teamName={awayTeam?.nameKo ?? "원정"}
              abbreviation={awayTeam?.abbreviation ?? "AWAY"}
              opposingBatters={homeRosterFieldersFull}
            />
          </Collapsible>
          <Collapsible title={`${homeTeam?.nameKo ?? "홈"} 투수진 — ${homeRosterPitchers.length}명`} titleColor={homeColor}>
            <PitchingStaffClient
              rosterPitchers={homeRosterPitchers}
              teamColor={homeColor}
              teamName={homeTeam?.nameKo ?? "홈"}
              abbreviation={homeTeam?.abbreviation ?? "HOME"}
              opposingBatters={awayRosterFieldersFull}
            />
          </Collapsible>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Collapsible title={`${awayTeam?.nameKo ?? "원정"} 야수진 — ${awayRosterFielders.length}명`} titleColor={awayColor}>
            <FielderStaffClient
              rosterFielders={awayRosterFielders}
              teamColor={awayColor}
              teamName={awayTeam?.nameKo ?? "원정"}
              abbreviation={awayTeam?.abbreviation ?? "AWAY"}
              opposingPitchers={homeRosterPitchersFull}
            />
          </Collapsible>
          <Collapsible title={`${homeTeam?.nameKo ?? "홈"} 야수진 — ${homeRosterFielders.length}명`} titleColor={homeColor}>
            <FielderStaffClient
              rosterFielders={homeRosterFielders}
              teamColor={homeColor}
              teamName={homeTeam?.nameKo ?? "홈"}
              abbreviation={homeTeam?.abbreviation ?? "HOME"}
              opposingPitchers={awayRosterPitchersFull}
            />
          </Collapsible>
        </div>
      </section>

      {/* ===== 4. BATTING LINEUP ===== */}
      {gameStarted && (
        <section className="mb-8">
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span className="inline-block w-1 h-6 bg-green-500 rounded-full" />
            타선
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <InteractiveLineupTable
              teamData={boxscore.teams.away}
              teamColor={awayColor}
              teamName={awayTeam?.nameKo ?? "원정"}
              abbreviation={awayTeam?.abbreviation ?? "AWAY"}
              opposingPitchers={homeRosterPitchersFull}
            />
            <InteractiveLineupTable
              teamData={boxscore.teams.home}
              teamColor={homeColor}
              teamName={homeTeam?.nameKo ?? "홈"}
              abbreviation={homeTeam?.abbreviation ?? "HOME"}
              opposingPitchers={awayRosterPitchersFull}
            />
          </div>
        </section>
      )}

      {/* ===== 5. PITCHING RESULTS ===== */}
      {gameStarted && (
        <section className="mb-8">
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span className="inline-block w-1 h-6 bg-red-500 rounded-full" />
            투수 기록
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <InteractivePitchingTable
              teamData={boxscore.teams.away}
              teamColor={awayColor}
              teamName={awayTeam?.nameKo ?? "원정"}
              abbreviation={awayTeam?.abbreviation ?? "AWAY"}
              opposingBatters={homeRosterFieldersFull}
            />
            <InteractivePitchingTable
              teamData={boxscore.teams.home}
              teamColor={homeColor}
              teamName={homeTeam?.nameKo ?? "홈"}
              abbreviation={homeTeam?.abbreviation ?? "HOME"}
              opposingBatters={awayRosterFieldersFull}
            />
          </div>
        </section>
      )}

      {/* ===== 6. ANALYSIS NOTES ===== */}
      {gameStarted && (
        <div className="mb-8">
          <AnalysisNotes boxscore={boxscore} linescore={linescore} />
        </div>
      )}

      {/* Ad */}
      <div className="mb-8">
        <AdBanner slot="inline" />
      </div>

      {/* Back link */}
      <div className="text-center mt-12">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-900 transition-colors"
        >
          <span>&larr;</span>
          전체 경기 목록으로
        </Link>
      </div>
    </div>
  );
}

// ============================================================
// SUB-COMPONENTS (inline server components)
// ============================================================

function TeamStatRow({
  label,
  away,
  home,
  awayColor,
  homeColor,
  lowerIsBetter = false,
}: {
  label: string;
  away: number;
  home: number;
  awayColor: string;
  homeColor: string;
  lowerIsBetter?: boolean;
}) {
  const awayBetter = lowerIsBetter ? away < home : away > home;
  const homeBetter = lowerIsBetter ? home < away : home > away;

  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-200/50 last:border-0">
      <span
        className={`text-sm font-mono font-bold w-10 text-right ${
          awayBetter ? "text-white" : "text-slate-500"
        }`}
        style={awayBetter ? { color: awayColor } : undefined}
      >
        {away}
      </span>
      <span className="text-xs text-slate-400 flex-1 text-center">{label}</span>
      <span
        className={`text-sm font-mono font-bold w-10 text-left ${
          homeBetter ? "text-white" : "text-slate-500"
        }`}
        style={homeBetter ? { color: homeColor } : undefined}
      >
        {home}
      </span>
    </div>
  );
}

function ComparisonBar({
  label,
  awayVal,
  homeVal,
  awayColor,
  homeColor,
  awayName,
  homeName,
  max,
  lowerIsBetter = false,
  format,
}: {
  label: string;
  awayVal: number;
  homeVal: number;
  awayColor: string;
  homeColor: string;
  awayName: string;
  homeName: string;
  max: number;
  lowerIsBetter?: boolean;
  format: (v: number) => string;
}) {
  const awayHasData = awayVal > 0;
  const homeHasData = homeVal > 0;
  const awayPct = awayHasData ? Math.max(5, Math.min((awayVal / max) * 100, 100)) : 0;
  const homePct = homeHasData ? Math.max(5, Math.min((homeVal / max) * 100, 100)) : 0;
  const awayBetter = awayHasData && homeHasData && (lowerIsBetter ? awayVal < homeVal : awayVal > homeVal);
  const homeBetter = awayHasData && homeHasData && (lowerIsBetter ? homeVal < awayVal : homeVal > awayVal);

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span
          className="text-xs font-mono font-bold"
          style={{ color: awayBetter ? awayColor : "#94a3b8" }}
        >
          {awayName} {format(awayVal)}
        </span>
        <span className="text-xs font-semibold text-slate-400">{label}</span>
        <span
          className="text-xs font-mono font-bold"
          style={{ color: homeBetter ? homeColor : "#94a3b8" }}
        >
          {format(homeVal)} {homeName}
        </span>
      </div>
      <div className="flex gap-1 h-2">
        <div className="flex-1 flex justify-end">
          <div className="w-full bg-slate-100 rounded-l-full overflow-hidden">
            <div
              className="h-full rounded-l-full transition-all duration-500 ml-auto"
              style={{
                width: `${awayPct}%`,
                backgroundColor: awayBetter ? awayColor : `${awayColor}60`,
              }}
            />
          </div>
        </div>
        <div className="flex-1">
          <div className="w-full bg-slate-100 rounded-r-full overflow-hidden">
            <div
              className="h-full rounded-r-full transition-all duration-500"
              style={{
                width: `${homePct}%`,
                backgroundColor: homeBetter ? homeColor : `${homeColor}60`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function PitcherCard({
  player,
  seasonStats,
  advanced,
  teamColor,
  teamName,
  side,
  showGameStats,
}: {
  player: BoxscorePlayer;
  seasonStats: Record<string, unknown> | null;
  advanced: { fip: number; babip: number; kPct: number; bbPct: number; era: number; whip: number } | null;
  teamColor: string;
  teamName: string;
  side: string;
  showGameStats: boolean;
}) {
  const name = displayNameFull(player.person.id, player.person.fullName);
  const gamePitching = player.stats?.pitching;
  const gameIP = gamePitching ? String(gamePitching.inningsPitched ?? "-") : "-";
  const gameK = gamePitching ? num(gamePitching.strikeOuts) : 0;
  const gameER = gamePitching ? num(gamePitching.earnedRuns) : 0;
  const gameH = gamePitching ? num(gamePitching.hits) : 0;
  const gameBB = gamePitching ? num(gamePitching.baseOnBalls) : 0;
  const gamePitchCount = gamePitching ? num(gamePitching.numberOfPitches) : 0;

  // Season summary stats
  const seasonW = seasonStats ? num(seasonStats.wins) : 0;
  const seasonL = seasonStats ? num(seasonStats.losses) : 0;
  const seasonIP = seasonStats ? String(seasonStats.inningsPitched ?? "-") : "-";
  const seasonK = seasonStats ? num(seasonStats.strikeOuts) : 0;

  return (
    <div
      className="rounded-xl bg-white border p-5"
      style={{ borderColor: `${teamColor}40` }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
          style={{ backgroundColor: teamColor }}
        >
          P
        </div>
        <div>
          <Link
            href={`/players/${player.person.id}`}
            className="text-sm font-bold text-slate-800 hover:underline"
          >
            {name}
          </Link>
          <p className="text-xs text-slate-500">
            {teamName} {side} 선발
          </p>
        </div>
      </div>

      {/* This game stats — only show when game has actually started */}
      {showGameStats && gamePitching && (gameK > 0 || gameER > 0 || num(gamePitching.inningsPitched) > 0) && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
          <MiniStat label="이닝" value={gameIP} />
          <MiniStat label="삼진" value={gameK} />
          <MiniStat label="자책" value={gameER} />
          <MiniStat label="피안타" value={gameH} />
          <MiniStat label="볼넷" value={gameBB} />
          <MiniStat label="투구수" value={gamePitchCount} />
        </div>
      )}

      {/* Season record summary — always show */}
      {seasonStats && (
        <div className="grid grid-cols-4 gap-2 mb-4 border border-slate-100 rounded-lg p-2">
          <MiniStat label="시즌 성적" value={`${seasonW}승 ${seasonL}패`} />
          <MiniStat label="시즌 이닝" value={seasonIP} />
          <MiniStat label="시즌 삼진" value={seasonK} />
          <MiniStat label="ERA" value={advanced?.era.toFixed(2) ?? "-"} />
        </div>
      )}

      {!seasonStats && (
        <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 mb-4 text-center">
          <p className="text-xs text-slate-400">시즌 기록 없음 (신인 또는 데이터 미제공)</p>
        </div>
      )}

      {/* Season advanced stats */}
      {advanced && (
        <div className="border-t border-slate-200 pt-3 mt-3">
          <p className="text-xs text-slate-500 mb-3">시즌 성적</p>
          <div className="space-y-2">
            <StatBar
              label="ERA"
              value={advanced.era.toFixed(2)}
              max={6}
              color="bg-blue-500"
            />
            <StatBar
              label="FIP"
              value={advanced.fip.toFixed(2)}
              max={6}
              color="bg-purple-500"
            />
            <StatBar
              label="WHIP"
              value={advanced.whip.toFixed(2)}
              max={2}
              color="bg-cyan-500"
            />
            <StatBar
              label={`K% ${advanced.kPct.toFixed(1)}%`}
              value={advanced.kPct}
              max={40}
              color="bg-green-500"
            />
            <StatBar
              label={`BB% ${advanced.bbPct.toFixed(1)}%`}
              value={advanced.bbPct}
              max={15}
              color="bg-amber-500"
            />
            <StatBar
              label="BABIP"
              value={advanced.babip.toFixed(3)}
              max={0.4}
              color="bg-rose-500"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-slate-100 border border-slate-100 px-2 py-2 text-center">
      <p className="text-[10px] text-slate-500 mb-0.5">{label}</p>
      <p className="text-sm font-bold font-mono text-slate-700">{value}</p>
    </div>
  );
}

// PitchingStaffCard removed - replaced by PitchingStaffClient (active roster with clickable matchup)

