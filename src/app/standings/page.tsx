import type { Metadata } from "next";
import Link from "next/link";
import { fetchStandings, type TeamRecord } from "@/lib/sports/mlb/api";
import { getTeamById } from "@/data/teams";
import TeamBadge from "@/components/ui/TeamBadge";
import { isKR } from "@/lib/config";

const CURRENT_YEAR = new Date().getFullYear();
const T = (en: string, ko: string) => isKR ? ko : en;

export const metadata: Metadata = {
  title: T("MLB Standings | StatScope", "MLB 팀 순위 | StatScope"),
  description: T(
    `MLB Standings. Check division standings for the American League and National League.`,
    `MLB 팀 순위. 미국 리그와 내셔널 리그의 디비전별 순위를 확인하세요.`
  ),
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
          {T("MLB Standings", "MLB 팀 순위")}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {season} {season < CURRENT_YEAR ? T("(Previous Season) ", "(지난 시즌) ") : ""}
          {T("Regular Season Standings", "정규 시즌 팀 순위")}
        </p>
      </div>

      {/* Intro guide — how to read the standings */}
      <section className="mb-8 rounded-2xl bg-white px-6 py-6 shadow-sm ring-1 ring-slate-200/60">
        <h2 className="text-lg font-semibold text-slate-800">
          {T(`How to Read the ${season} MLB Standings`, `${season}년 MLB 팀 순위 읽기`)}
        </h2>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          {T(
            `Major League Baseball groups its 30 teams into two leagues —
            American League (AL) and National League (NL) — and each league is
            split into three divisions of five teams: East, Central, and West.
            The table below shows every division ranked by win percentage. The
            team at the top of each division at season's end clinches a
            playoff berth; the three best remaining records per league earn
            Wild Card spots.`,
            `MLB는 30개 팀을 미국 리그(AL)와 내셔널 리그(NL) 두 개 리그로 나누며,
            각 리그는 5개 팀씩 3개 디비전으로 나뉩니다: 동부, 중부, 서부.
            아래 표는 모든 디비전을 승률로 순위를 매긴 것입니다.
            정규 시즌 끝에 각 디비전 1위 팀은 플레이오프 진출이 확정되고,
            리그별 남은 기록 중 3위까지 와일드카드 스팟을 얻습니다.`
          )}
        </p>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 text-sm">
          <div>
            <dt className="font-semibold text-slate-700">{T("W / L", "W / L")}</dt>
            <dd className="text-slate-600 mt-1">
              {T(
                "Wins and losses on the regular season. Each team plays 162 games from late March through early October.",
                "정규 시즌의 승리와 패배. 각 팀은 3월 말부터 10월 초까지 162경기를 합니다."
              )}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-700">{T("PCT", "PCT")}</dt>
            <dd className="text-slate-600 mt-1">
              {T(
                "Winning percentage — wins divided by games played. A .600 team (e.g. 97-65) is a strong contender; below .500 means more losses than wins.",
                "승률 — 승리를 경기 수로 나눈 값. .600 팀(예: 97-65)은 강력한 경쟁팀이며, .500 이하는 패배가 승리보다 많음을 의미합니다."
              )}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-700">{T("GB (Games Back)", "GB (게임 뒤)}")}</dt>
            <dd className="text-slate-600 mt-1">
              {T(
                "How many games behind the division leader a team is. A GB of 3.0 means the team would need to win three more games while the leader loses three to tie. \"--\" marks the division leader.",
                "팀이 디비전 리더보다 몇 경기 뒤처져 있는지를 나타냅니다. GB 3.0은 팀이 3경기를 더 이기고 리더가 3경기를 져야 동점이 됨을 의미합니다. \"--\"는 디비전 리더를 나타냅니다."
              )}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-700">{T("Wild Card", "와일드카드")}</dt>
            <dd className="text-slate-600 mt-1">
              {T(
                "Six additional playoff spots (three per league) go to the non-division-winners with the best records. This keeps second- and third-place teams in strong divisions relevant deep into September.",
                "6개의 추가 플레이오프 스팟(리그당 3개)은 최고의 기록을 가진 디비전 우승이 아닌 팀에게 주어집니다. 이를 통해 강력한 디비전의 2위, 3위 팀들도 9월 깊숙이 관련성을 유지할 수 있습니다."
              )}
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-sm text-slate-600 leading-relaxed">
          {T(
            `Click any team row to open that club's full page — roster by position, recent results, run differential, and the latest team news. For predicted win probability on today's games, visit the `,
            `팀 행을 클릭하면 그 팀의 전체 페이지가 열립니다 — 포지션별 명단, 최근 결과, 득점 차이, 최신 팀 뉴스. 오늘 경기의 예측 승리 확률을 보려면 `
          )}
          <Link href="/" className="text-blue-600 hover:underline">
            {T("home page", "홈페이지")}
          </Link>
          {T(".", "를 방문하세요.")}
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
                <span>{T("Team", "팀")}</span>
                <span className="text-center">{T("W", "W")}</span>
                <span className="text-center">{T("L", "L")}</span>
                <span className="text-center">{T("PCT", "PCT")}</span>
                <span className="text-center">{T("GB", "GB")}</span>
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
