import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTeamBySlug, getTeamById, type Team } from "@/data/teams";
import { displayName } from "@/data/players";
import { fetchStandings, type TeamRecord, type ScheduleGame } from "@/lib/sports/mlb/api";
import TeamBadge from "@/components/ui/TeamBadge";
import StatsGrid from "@/components/ui/StatsGrid";

const CURRENT_SEASON = new Date().getFullYear();
const FALLBACK_SEASON = CURRENT_SEASON - 1;
const MLB_API_BASE = "https://statsapi.mlb.com/api/v1";

// --- RSS slug mapping ---

const TEAM_RSS_SLUGS: Record<number, string> = {
  108: 'angels', 109: 'dbacks', 110: 'orioles', 111: 'redsox',
  112: 'cubs', 113: 'reds', 114: 'guardians', 115: 'rockies',
  116: 'tigers', 117: 'astros', 118: 'royals', 119: 'dodgers',
  120: 'nationals', 121: 'mets', 133: 'athletics', 134: 'pirates',
  135: 'padres', 136: 'mariners', 137: 'giants', 138: 'cardinals',
  139: 'rays', 140: 'rangers', 141: 'bluejays', 142: 'twins',
  143: 'phillies', 144: 'braves', 145: 'whitesox', 146: 'marlins',
  147: 'yankees', 158: 'brewers',
};

// --- Roster types ---

interface RosterEntry {
  person: {
    id: number;
    fullName: string;
  };
  jerseyNumber: string;
  position: {
    abbreviation: string;
    name: string;
    type: string;
  };
  status: {
    code: string;
    description: string;
  };
}

interface RosterResponse {
  roster: RosterEntry[];
}

// --- News types ---

interface NewsArticle {
  title: string;
  link: string;
  pubDate: string;
  author: string;
  imageUrl: string | null;
}

// --- Fetch helpers ---

async function fetchRoster(teamId: number, season: number): Promise<RosterResponse> {
  const res = await fetch(
    `${MLB_API_BASE}/teams/${teamId}/roster?rosterType=active&season=${season}`,
    { next: { revalidate: 3600 } }
  );
  if (!res.ok) return { roster: [] };
  return res.json() as Promise<RosterResponse>;
}

async function fetchTeamSchedule(teamId: number, season: number): Promise<ScheduleGame[]> {
  // For fallback season, fetch the last 30 days of that season (Sept-Oct)
  let endDate: string;
  let startDate: string;

  if (season < CURRENT_SEASON) {
    // For previous season, get the last month of the season
    endDate = `${season}-11-15`;
    startDate = `${season}-09-15`;
  } else {
    const today = new Date();
    endDate = today.toISOString().split("T")[0];
    startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
  }

  const res = await fetch(
    `${MLB_API_BASE}/schedule?sportId=1&teamId=${teamId}&startDate=${startDate}&endDate=${endDate}&hydrate=team,linescore&gameType=R,S,E,F,D,L,W`,
    { next: { revalidate: 900 } }
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { dates: { date: string; games: ScheduleGame[] }[] };
  const allGames: ScheduleGame[] = [];
  for (const d of data.dates ?? []) {
    for (const g of d.games ?? []) {
      if (g.status.abstractGameState === "Final") {
        allGames.push(g);
      }
    }
  }
  // Sort by date descending, take last 10
  allGames.sort(
    (a, b) => new Date(b.gameDate).getTime() - new Date(a.gameDate).getTime()
  );
  return allGames.slice(0, 10);
}

async function fetchTeamNews(teamId: number): Promise<NewsArticle[]> {
  const rssSlug = TEAM_RSS_SLUGS[teamId];
  if (!rssSlug) return [];

  const rssUrl = `https://www.mlb.com/${rssSlug}/feeds/news/rss.xml`;
  try {
    const res = await fetch(rssUrl, { next: { revalidate: 1800 } });
    if (!res.ok) return [];
    const xml = await res.text();

    // Parse RSS XML with regex (no DOMParser in Node.js server components)
    const items: NewsArticle[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match: RegExpExecArray | null;

    while ((match = itemRegex.exec(xml)) !== null && items.length < 5) {
      const itemXml = match[1];

      const titleMatch = itemXml.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ||
        itemXml.match(/<title>([\s\S]*?)<\/title>/);
      const linkMatch = itemXml.match(/<link><!\[CDATA\[([\s\S]*?)\]\]><\/link>/) ||
        itemXml.match(/<link>([\s\S]*?)<\/link>/);
      const pubDateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
      const authorMatch = itemXml.match(/<dc:creator><!\[CDATA\[([\s\S]*?)\]\]><\/dc:creator>/) ||
        itemXml.match(/<dc:creator>([\s\S]*?)<\/dc:creator>/) ||
        itemXml.match(/<author>([\s\S]*?)<\/author>/);
      const imageMatch = itemXml.match(/<media:content[^>]+url="([^"]+)"/) ||
        itemXml.match(/<enclosure[^>]+url="([^"]+)"/) ||
        itemXml.match(/<image[^>]*>\s*<url>([\s\S]*?)<\/url>/);

      if (titleMatch && linkMatch) {
        items.push({
          title: decodeXmlEntities(titleMatch[1].trim()),
          link: linkMatch[1].trim(),
          pubDate: pubDateMatch ? pubDateMatch[1].trim() : "",
          author: authorMatch ? decodeXmlEntities(authorMatch[1].trim()) : "",
          imageUrl: imageMatch ? imageMatch[1].trim() : null,
        });
      }
    }

    return items;
  } catch {
    return [];
  }
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function findTeamRecord(
  standings: { records: { teamRecords: TeamRecord[] }[] },
  teamId: number
): TeamRecord | null {
  for (const rec of standings.records) {
    for (const tr of rec.teamRecords) {
      if (tr.team.id === teamId) return tr;
    }
  }
  return null;
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 30) return `${diffDay}일 전`;
  return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

// --- Position helpers ---

const PITCHER_POSITIONS = new Set(["P", "SP", "RP", "CP"]);

function isPitcherPosition(abbr: string, type: string): boolean {
  return PITCHER_POSITIONS.has(abbr) || type === "Pitcher";
}

// --- Division label ---

function getDivisionLabel(league: "AL" | "NL", division: string): string {
  const leagueName = league === "AL" ? "아메리칸 리그" : "내셔널 리그";
  const divMap: Record<string, string> = {
    East: "동부",
    Central: "중부",
    West: "서부",
  };
  return `${leagueName} ${divMap[division] ?? division}`;
}

// --- Metadata ---

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const team = getTeamBySlug(decodeURIComponent(slug));
  if (!team) {
    return { title: "팀을 찾을 수 없습니다 | StatScope" };
  }
  return {
    title: `${team.nameKo} - 팀 분석 | StatScope`,
    description: `${team.nameKo}(${team.name})의 로스터, 최근 경기 결과, 시즌 성적을 StatScope에서 확인하세요.`,
  };
}

// --- Page ---

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const team = getTeamBySlug(decodeURIComponent(slug));
  if (!team) notFound();

  // First, try current season standings
  const currentStandings = await fetchStandings(CURRENT_SEASON).catch(() => null);
  const currentRecord = currentStandings ? findTeamRecord(currentStandings, team.id) : null;

  // Check if current season has data (wins > 0 means season has started)
  const seasonHasData = currentRecord !== null && currentRecord.wins > 0;
  const useFallback = !seasonHasData;
  const activeSeason = useFallback ? FALLBACK_SEASON : CURRENT_SEASON;

  // If we need fallback, fetch previous season standings
  let teamRecord = currentRecord;
  if (useFallback) {
    const fallbackStandings = await fetchStandings(FALLBACK_SEASON).catch(() => null);
    teamRecord = fallbackStandings ? findTeamRecord(fallbackStandings, team.id) : null;
  }

  // Fetch roster, schedule, and news in parallel
  const [rosterData, recentGames, newsArticles] = await Promise.all([
    fetchRoster(team.id, activeSeason),
    fetchTeamSchedule(team.id, activeSeason),
    fetchTeamNews(team.id),
  ]);

  // Split roster
  const pitchers = (rosterData.roster ?? []).filter((r) =>
    isPitcherPosition(r.position.abbreviation, r.position.type)
  );
  const positionPlayers = (rosterData.roster ?? []).filter(
    (r) => !isPitcherPosition(r.position.abbreviation, r.position.type)
  );

  const tc = team.colorPrimary;
  const tcAccent = team.colorAccent;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* ===== Team Header ===== */}
      <div
        className="rounded-2xl p-[2px] mb-8"
        style={{
          background: `linear-gradient(135deg, ${tc}, ${tcAccent}88, transparent)`,
        }}
      >
        <div
          className="rounded-2xl p-6 md:p-10"
          style={{
            background: `linear-gradient(135deg, ${team.colorBg}, #0f0f23 60%)`,
          }}
        >
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            <TeamBadge
              name={team.name}
              nameKo={team.nameKo}
              colorPrimary={tc}
              colorAccent={tcAccent}
              teamId={team.id}
              size="lg"
              dark
            />
            <div className="text-center md:text-left flex-1">
              <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-1">
                {team.nameKo}
              </h1>
              <p className="text-lg text-slate-300 mb-3">{team.name}</p>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-sm">
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-semibold"
                  style={{
                    backgroundColor: `${tc}30`,
                    color: "#fff",
                    border: `1px solid ${tc}60`,
                  }}
                >
                  {team.cityKo}
                </span>
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-semibold"
                  style={{
                    backgroundColor: `${tcAccent}30`,
                    color: "#fff",
                    border: `1px solid ${tcAccent}60`,
                  }}
                >
                  {team.league}
                </span>
                <span className="text-slate-300">
                  {getDivisionLabel(team.league, team.division)}
                </span>
              </div>
              {teamRecord && (
                <div className="mt-4 flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm text-slate-300">
                  <span className="font-mono font-bold text-lg" style={{ color: `${tc}cc` }}>
                    {teamRecord.wins}W - {teamRecord.losses}L
                  </span>
                  <span className="text-slate-400">|</span>
                  <span>
                    승률 <span className="font-mono font-semibold text-white">{teamRecord.winningPercentage}</span>
                  </span>
                  <span className="text-slate-400">|</span>
                  <span>
                    순위 <span className="font-mono font-semibold text-white">{teamRecord.divisionRank}위</span>
                  </span>
                  {teamRecord.streak && (
                    <>
                      <span className="text-slate-400">|</span>
                      <span className="font-mono text-slate-200">{teamRecord.streak.streakCode}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ===== Fallback Season Notice ===== */}
      {useFallback && teamRecord && (
        <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-600 flex items-center gap-2">
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          <span>{FALLBACK_SEASON} 시즌 기준 ({CURRENT_SEASON} 시즌 개막 전)</span>
        </div>
      )}

      {/* ===== Team Season Stats ===== */}
      {teamRecord && (
        <section className="mb-8">
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span
              className="inline-block w-1 h-6 rounded-full"
              style={{ backgroundColor: tc }}
            />
            {activeSeason} 시즌 성적
          </h2>
          <div className="rounded-xl bg-white border border-slate-200 p-6">
            <StatsGrid
              stats={{
                wins: teamRecord.wins,
                losses: teamRecord.losses,
                winPct: teamRecord.winningPercentage,
                runsScored: teamRecord.runsScored,
                runsAllowed: teamRecord.runsAllowed,
                runDiff: teamRecord.runDifferential,
                gamesBack: teamRecord.gamesBack,
                divisionRank: `${teamRecord.divisionRank}위`,
              }}
              keys={[
                "wins",
                "losses",
                "winPct",
                "runsScored",
                "runsAllowed",
                "runDiff",
                "gamesBack",
                "divisionRank",
              ]}
              labels={{
                wins: "승",
                losses: "패",
                winPct: "승률",
                runsScored: "득점",
                runsAllowed: "실점",
                runDiff: "득실차",
                gamesBack: "게임차",
                divisionRank: "지구 순위",
              }}
              columns={4}
              highlightKeys={["wins", "winPct", "runDiff"]}
            />
          </div>
        </section>
      )}

      {/* ===== Team News ===== */}
      {newsArticles.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span
              className="inline-block w-1 h-6 rounded-full"
              style={{ backgroundColor: tc }}
            />
            팀 뉴스
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {newsArticles.map((article, idx) => (
              <a
                key={idx}
                href={article.link}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-xl bg-white border border-slate-200 overflow-hidden hover:border-slate-300 transition-colors"
              >
                {article.imageUrl && (
                  <div className="relative w-full h-40 overflow-hidden bg-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={article.imageUrl}
                      alt={article.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                )}
                <div className="p-4">
                  <h3 className="text-sm font-semibold text-slate-800 line-clamp-2 group-hover:text-slate-900 transition-colors mb-2">
                    {article.title}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    {article.author && (
                      <>
                        <span className="truncate max-w-[120px]">{article.author}</span>
                        <span>·</span>
                      </>
                    )}
                    {article.pubDate && (
                      <span>{timeAgo(article.pubDate)}</span>
                    )}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* ===== Current Roster ===== */}
      {(pitchers.length > 0 || positionPlayers.length > 0) && (
        <section className="mb-8">
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span
              className="inline-block w-1 h-6 rounded-full"
              style={{ backgroundColor: tc }}
            />
            {useFallback ? `${activeSeason} 시즌 ` : ""}현재 로스터
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Position Players */}
            {positionPlayers.length > 0 && (
              <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
                <div
                  className="px-4 py-3 border-b border-slate-200 font-semibold text-sm"
                  style={{ color: tc }}
                >
                  야수 ({positionPlayers.length})
                </div>
                <div className="divide-y divide-slate-100">
                  {positionPlayers.map((p) => (
                    <Link
                      key={p.person.id}
                      href={`/players/${p.person.id}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
                    >
                      <span
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{
                          backgroundColor: `${tc}20`,
                          color: tc,
                          border: `1px solid ${tc}30`,
                        }}
                      >
                        {p.jerseyNumber || "-"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {displayName(p.person.id, p.person.fullName)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {p.person.fullName}
                        </p>
                      </div>
                      <span
                        className="text-xs font-mono px-2 py-0.5 rounded-full shrink-0"
                        style={{
                          backgroundColor: `${tcAccent}15`,
                          color: tcAccent,
                          border: `1px solid ${tcAccent}30`,
                        }}
                      >
                        {p.position.abbreviation}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Pitchers */}
            {pitchers.length > 0 && (
              <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
                <div
                  className="px-4 py-3 border-b border-slate-200 font-semibold text-sm"
                  style={{ color: tc }}
                >
                  투수 ({pitchers.length})
                </div>
                <div className="divide-y divide-slate-100">
                  {pitchers.map((p) => (
                    <Link
                      key={p.person.id}
                      href={`/players/${p.person.id}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
                    >
                      <span
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{
                          backgroundColor: `${tc}20`,
                          color: tc,
                          border: `1px solid ${tc}30`,
                        }}
                      >
                        {p.jerseyNumber || "-"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {displayName(p.person.id, p.person.fullName)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {p.person.fullName}
                        </p>
                      </div>
                      <span
                        className="text-xs font-mono px-2 py-0.5 rounded-full shrink-0"
                        style={{
                          backgroundColor: `${tcAccent}15`,
                          color: tcAccent,
                          border: `1px solid ${tcAccent}30`,
                        }}
                      >
                        {p.position.abbreviation}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ===== Recent Games ===== */}
      {recentGames.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span
              className="inline-block w-1 h-6 rounded-full"
              style={{ backgroundColor: tc }}
            />
            {useFallback ? `${activeSeason} 시즌 ` : ""}최근 경기 결과
          </h2>
          <div className="rounded-xl bg-white border border-slate-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400">
                    날짜
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400">
                    상대
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400">
                    스코어
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400">
                    결과
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentGames.map((game) => {
                  const isHome = game.teams.home.team.id === team.id;
                  const ourScore = isHome
                    ? game.teams.home.score
                    : game.teams.away.score;
                  const theirScore = isHome
                    ? game.teams.away.score
                    : game.teams.home.score;
                  const opponentTeamId = isHome
                    ? game.teams.away.team.id
                    : game.teams.home.team.id;
                  const opponentTeam = getTeamById(opponentTeamId);
                  const opponentName = opponentTeam
                    ? opponentTeam.nameKo
                    : isHome
                      ? game.teams.away.team.name
                      : game.teams.home.team.name;

                  const isWin =
                    ourScore != null &&
                    theirScore != null &&
                    ourScore > theirScore;
                  const isLoss =
                    ourScore != null &&
                    theirScore != null &&
                    ourScore < theirScore;

                  const dateStr = new Date(game.gameDate).toLocaleDateString(
                    "ko-KR",
                    { month: "short", day: "numeric" }
                  );

                  return (
                    <tr
                      key={game.gamePk}
                      className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                        {dateStr}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">
                            {isHome ? "vs" : "@"}
                          </span>
                          {opponentTeam ? (
                            <Link
                              href={`/team/${opponentTeam.slug}`}
                              className="text-slate-700 hover:text-slate-900 transition-colors font-medium"
                            >
                              {opponentName}
                            </Link>
                          ) : (
                            <span className="text-slate-700 font-medium">
                              {opponentName}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Link
                          href={`/game/${game.gamePk}`}
                          className="font-mono font-bold text-slate-800 hover:text-slate-900 transition-colors"
                        >
                          {ourScore ?? "-"} - {theirScore ?? "-"}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isWin && (
                          <span
                            className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold"
                            style={{
                              backgroundColor: `${tc}25`,
                              color: tc,
                            }}
                          >
                            W
                          </span>
                        )}
                        {isLoss && (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold bg-red-500/15 text-red-600">
                            L
                          </span>
                        )}
                        {!isWin && !isLoss && (
                          <span className="text-xs text-slate-500">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ===== Empty state ===== */}
      {recentGames.length === 0 &&
        pitchers.length === 0 &&
        positionPlayers.length === 0 &&
        !teamRecord && (
          <div className="rounded-xl bg-white border border-slate-200 p-12 text-center">
            <p className="text-slate-400 text-lg mb-2">
              시즌 데이터를 불러올 수 없습니다.
            </p>
            <p className="text-slate-500 text-sm">
              시즌이 시작되면 로스터, 경기 결과, 시즌 성적이 표시됩니다.
            </p>
          </div>
        )}
    </div>
  );
}
