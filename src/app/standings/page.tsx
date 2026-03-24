import type { Metadata } from "next";
import Link from "next/link";
import { fetchStandings, type TeamRecord } from "@/lib/sports/mlb/api";
import { getTeamById } from "@/data/teams";
import TeamBadge from "@/components/ui/TeamBadge";

const CURRENT_YEAR = new Date().getFullYear();

export const metadata: Metadata = {
  title: "MLB 팀 순위 | StatScope",
  description: `MLB 팀 순위. 아메리칸리그, 내셔널리그 디비전별 순위를 확인하세요.`,
};

// Division ID -> Korean name mapping (MLB API returns ID, not name)
const DIVISION_KO: Record<number, string> = {
  201: "AL 동부",
  202: "AL 중부",
  200: "AL 서부",
  204: "NL 동부",
  205: "NL 중부",
  203: "NL 서부",
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
          팀 순위
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {season} 시즌 {season < CURRENT_YEAR ? "(지난 시즌)" : ""} 정규시즌 순위
        </p>
      </div>

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
                <span>팀</span>
                <span className="text-center">승</span>
                <span className="text-center">패</span>
                <span className="text-center">승률</span>
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
