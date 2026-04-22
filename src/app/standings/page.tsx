import type { Metadata } from "next";
import Link from "next/link";
import { fetchStandings, type TeamRecord } from "@/lib/sports/mlb/api";
import { getTeamById } from "@/data/teams";
import TeamBadge from "@/components/ui/TeamBadge";

const CURRENT_YEAR = new Date().getFullYear();

export const metadata: Metadata = {
  title: "MLB Standings | StatScope",
  description: `MLB Standings. Check division standings for the American League and National League.`,
};

// Division ID -> name mapping (MLB API returns ID, not name)
const DIVISION_KO: Record<number, string> = {
  201: "AL East",
  202: "AL Central",
  200: "AL West",
  204: "NL East",
  205: "NL Central",
  203: "NL West",
};

const DIVISION_ORDER = [201, 202, 200, 204, 205, 203];

export default async function StandingsPage() {
  // Try current season first, fall back to previous if no games played
  let season = CURRENT_YEAR;
  let standings = await fetchStandings(season);

  // Check if season has started (any team with wins > 0)
  const hasGames = standings.records?.some((r: any) =>
    r.teamRecords?.some((tr: any) => tr.wins > 0)
  );

  if (!hasGames) {
    season = CURRENT_YEAR - 1;
    standings = await fetchStandings(season);
  }

  // Build map by division ID
  const divisionMap = new Map<number, TeamRecord[]>();
  for (const record of standings.records ?? []) {
    const divId = record.division?.id;
    if (!divId) continue;
    const sorted = [...(record.teamRecords ?? [])].sort(
      (a, b) => parseInt(a.divisionRank) - parseInt(b.divisionRank)
    );
    divisionMap.set(divId, sorted);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-800">
          MLB Standings
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {season} {season < CURRENT_YEAR ? "(Previous Season) " : ""}Regular Season Standings
        </p>
      </div>

      {/* Intro guide — how to read the standings */}
      <section className="mb-8 rounded-2xl bg-white px-6 py-6 shadow-sm ring-1 ring-slate-200/60">
        <h2 className="text-lg font-semibold text-slate-800">
          How to Read the {season} MLB Standings
        </h2>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          Major League Baseball groups its 30 teams into two leagues —
          American League (AL) and National League (NL) — and each league is
          split into three divisions of five teams: East, Central, and West.
          The table below shows every division ranked by win percentage. The
          team at the top of each division at season&apos;s end clinches a
          playoff berth; the three best remaining records per league earn
          Wild Card spots.
        </p>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 text-sm">
          <div>
            <dt className="font-semibold text-slate-700">W / L</dt>
            <dd className="text-slate-600 mt-1">
              Wins and losses on the regular season. Each team plays 162
              games from late March through early October.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-700">PCT</dt>
            <dd className="text-slate-600 mt-1">
              Winning percentage — wins divided by games played. A .600 team
              (e.g. 97-65) is a strong contender; below .500 means more
              losses than wins.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-700">GB (Games Back)</dt>
            <dd className="text-slate-600 mt-1">
              How many games behind the division leader a team is. A GB of
              3.0 means the team would need to win three more games while
              the leader loses three to tie. &quot;--&quot; marks the
              division leader.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-700">Wild Card</dt>
            <dd className="text-slate-600 mt-1">
              Six additional playoff spots (three per league) go to the
              non-division-winners with the best records. This keeps second-
              and third-place teams in strong divisions relevant deep into
              September.
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-sm text-slate-600 leading-relaxed">
          Click any team row to open that club&apos;s full page — roster by
          position, recent results, run differential, and the latest team
          news. For predicted win probability on today&apos;s games, visit
          the <Link href="/" className="text-blue-600 hover:underline">home page</Link>.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {DIVISION_ORDER.map((divId) => {
          const teams = divisionMap.get(divId);
          if (!teams || teams.length === 0) return null;

          const divKo = DIVISION_KO[divId] ?? `Division ${divId}`;
          const firstTeam = getTeamById(teams[0]?.team?.id);

          return (
            <div
              key={divId}
              className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60"
            >
              <div
                className="px-5 py-3.5 border-b border-slate-100"
                style={{
                  borderLeftWidth: "4px",
                  borderLeftColor: firstTeam?.colorPrimary ?? "#6366f1",
                }}
              >
                <h2 className="text-base font-bold text-slate-800">{divKo}</h2>
              </div>

              {/* Header */}
              <div className="grid grid-cols-[1fr_48px_48px_64px_56px] items-center gap-2 border-b border-slate-100 px-5 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <span>Team</span>
                <span className="text-center">W</span>
                <span className="text-center">L</span>
                <span className="text-center">PCT</span>
                <span className="text-center">GB</span>
              </div>

              {/* Rows */}
              {teams.map((record) => {
                const team = getTeamById(record.team.id);
                const isFirst = record.divisionRank === "1";
                const slug = team?.slug;

                const row = (
                  <div
                    className={`grid grid-cols-[1fr_48px_48px_64px_56px] items-center gap-2 px-5 py-3 transition-colors hover:bg-slate-50 ${
                      isFirst ? "bg-blue-50/40" : ""
                    }`}
                    style={
                      isFirst
                        ? { borderLeftWidth: "3px", borderLeftColor: team?.colorPrimary ?? "#6366f1" }
                        : undefined
                    }
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-5 shrink-0 text-center text-xs font-bold text-slate-400">
                        {record.divisionRank}
                      </span>
                      <TeamBadge
                        name={team?.name ?? record.team.name}
                        nameKo={team?.nameKo ?? record.team.name}
                        colorPrimary={team?.colorPrimary ?? "#6366f1"}
                        colorAccent={team?.colorAccent ?? "#818cf8"}
                        teamId={record.team.id}
                        size="sm"
                      />
                    </div>
                    <span className="text-center text-sm font-bold tabular-nums text-slate-700">{record.wins}</span>
                    <span className="text-center text-sm font-bold tabular-nums text-slate-700">{record.losses}</span>
                    <span className="text-center text-sm font-mono tabular-nums text-slate-500">{record.winningPercentage}</span>
                    <span className="text-center text-sm tabular-nums text-slate-400">
                      {record.gamesBack === "-" ? "--" : record.gamesBack}
                    </span>
                  </div>
                );

                return slug ? (
                  <Link key={record.team.id} href={`/team/${slug}`} className="block">
                    {row}
                  </Link>
                ) : (
                  <div key={record.team.id}>{row}</div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
