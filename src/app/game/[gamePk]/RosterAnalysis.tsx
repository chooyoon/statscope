import { fetchPlayerStats, type MLBPlayer } from "@/lib/sports/mlb/api";
import { displayName } from "@/data/players";
import { getTeamById } from "@/data/teams";

const CURRENT_SEASON = new Date().getFullYear();

function num(val: unknown): number {
  if (typeof val === "number") return val;
  if (typeof val === "string") return parseFloat(val) || 0;
  return 0;
}

interface RosterEntry {
  person: { id: number; fullName: string };
  jerseyNumber?: string;
  position: { type?: string; code?: string; abbreviation?: string };
}

interface BatterAnalysis {
  id: number;
  name: string;
  pos: string;
  avg: string;
  obp: string;
  slg: string;
  ops: string;
  hr: number;
  rbi: number;
  wOBA: number;
  kPct: number;
  bbPct: number;
}

interface PitcherAnalysis {
  id: number;
  name: string;
  pos: string;
  era: string;
  whip: string;
  ip: string;
  k: number;
  bb: number;
  fip: number;
  kPct: number;
  bbPct: number;
  record: string;
}

async function fetchRoster(teamId: number): Promise<RosterEntry[]> {
  try {
    const res = await fetch(
      `https://statsapi.mlb.com/api/v1/teams/${teamId}/roster?rosterType=active&season=${CURRENT_SEASON}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.roster ?? [];
  } catch {
    return [];
  }
}

async function analyzeBatter(id: number, name: string, pos: string): Promise<BatterAnalysis | null> {
  try {
    const data = await fetchPlayerStats(id, CURRENT_SEASON, "hitting");
    const stat = data.people?.[0]?.stats?.[0]?.splits?.[0]?.stat;
    if (!stat) return null;

    const pa = num(stat.plateAppearances);
    const ab = num(stat.atBats);
    if (pa < 5) return null;

    // wOBA calculation
    const singles = num(stat.hits) - num(stat.doubles) - num(stat.triples) - num(stat.homeRuns);
    const wOBADenom = ab + num(stat.baseOnBalls) - num(stat.intentionalWalks) + num(stat.sacFlies) + num(stat.hitByPitch);
    const wOBA = wOBADenom > 0 ? (
      0.69 * (num(stat.baseOnBalls) - num(stat.intentionalWalks)) +
      0.72 * num(stat.hitByPitch) +
      0.88 * singles +
      1.27 * num(stat.doubles) +
      1.62 * num(stat.triples) +
      2.1 * num(stat.homeRuns)
    ) / wOBADenom : 0;

    return {
      id,
      name: displayName(id, name),
      pos,
      avg: String(stat.avg ?? ".000"),
      obp: String(stat.obp ?? ".000"),
      slg: String(stat.slg ?? ".000"),
      ops: String(stat.ops ?? ".000"),
      hr: num(stat.homeRuns),
      rbi: num(stat.rbi),
      wOBA: Math.round(wOBA * 1000) / 1000,
      kPct: pa > 0 ? Math.round((num(stat.strikeOuts) / pa) * 1000) / 10 : 0,
      bbPct: pa > 0 ? Math.round((num(stat.baseOnBalls) / pa) * 1000) / 10 : 0,
    };
  } catch {
    return null;
  }
}

async function analyzePitcher(id: number, name: string, pos: string): Promise<PitcherAnalysis | null> {
  try {
    const data = await fetchPlayerStats(id, CURRENT_SEASON, "pitching");
    const stat = data.people?.[0]?.stats?.[0]?.splits?.[0]?.stat;
    if (!stat) return null;

    const ipRaw = stat.inningsPitched ?? "0";
    const ipVal = typeof ipRaw === "string" ? parseFloat(ipRaw) : ipRaw;
    const whole = Math.floor(ipVal);
    const frac = Math.round((ipVal - whole) * 10);
    const ip = whole + frac / 3;
    if (ip < 1) return null;

    const bf = num(stat.battersFaced);
    const fip = ip > 0
      ? (13 * num(stat.homeRuns) + 3 * (num(stat.baseOnBalls) + num(stat.hitByPitch)) - 2 * num(stat.strikeOuts)) / ip + 3.1
      : 0;

    return {
      id,
      name: displayName(id, name),
      pos,
      era: String(stat.era ?? "0.00"),
      whip: String(stat.whip ?? "0.00"),
      ip: String(ipRaw),
      k: num(stat.strikeOuts),
      bb: num(stat.baseOnBalls),
      fip: Math.round(fip * 100) / 100,
      kPct: bf > 0 ? Math.round((num(stat.strikeOuts) / bf) * 1000) / 10 : 0,
      bbPct: bf > 0 ? Math.round((num(stat.baseOnBalls) / bf) * 1000) / 10 : 0,
      record: `${num(stat.wins)}승 ${num(stat.losses)}패`,
    };
  } catch {
    return null;
  }
}

interface RosterAnalysisProps {
  homeTeamId: number;
  awayTeamId: number;
  homeColor: string;
  awayColor: string;
}

export default async function RosterAnalysis({ homeTeamId, awayTeamId, homeColor, awayColor }: RosterAnalysisProps) {
  const [homeRoster, awayRoster] = await Promise.all([
    fetchRoster(homeTeamId),
    fetchRoster(awayTeamId),
  ]);

  if (homeRoster.length === 0 && awayRoster.length === 0) return null;

  const homeTeam = getTeamById(homeTeamId);
  const awayTeam = getTeamById(awayTeamId);
  const homeName = homeTeam?.nameKo ?? "홈";
  const awayName = awayTeam?.nameKo ?? "원정";

  // Split rosters
  const isPitcher = (r: RosterEntry) => r.position?.type === "Pitcher" || r.position?.code === "1";
  const homeBatterEntries = homeRoster.filter(r => !isPitcher(r)).slice(0, 10);
  const awayBatterEntries = awayRoster.filter(r => !isPitcher(r)).slice(0, 10);
  const homePitcherEntries = homeRoster.filter(r => isPitcher(r)).slice(0, 8);
  const awayPitcherEntries = awayRoster.filter(r => isPitcher(r)).slice(0, 8);

  // Fetch stats in parallel (limit concurrency)
  const [homeBatters, awayBatters, homePitchers, awayPitchers] = await Promise.all([
    Promise.all(homeBatterEntries.map(r => analyzeBatter(r.person.id, r.person.fullName, r.position?.abbreviation ?? ""))),
    Promise.all(awayBatterEntries.map(r => analyzeBatter(r.person.id, r.person.fullName, r.position?.abbreviation ?? ""))),
    Promise.all(homePitcherEntries.map(r => analyzePitcher(r.person.id, r.person.fullName, r.position?.abbreviation ?? "P"))),
    Promise.all(awayPitcherEntries.map(r => analyzePitcher(r.person.id, r.person.fullName, r.position?.abbreviation ?? "P"))),
  ]);

  const hb = homeBatters.filter((b): b is BatterAnalysis => b !== null).sort((a, b) => b.wOBA - a.wOBA);
  const ab = awayBatters.filter((b): b is BatterAnalysis => b !== null).sort((a, b) => b.wOBA - a.wOBA);
  const hp = homePitchers.filter((p): p is PitcherAnalysis => p !== null).sort((a, b) => a.fip - b.fip);
  const ap = awayPitchers.filter((p): p is PitcherAnalysis => p !== null).sort((a, b) => a.fip - b.fip);

  // Team-level aggregates
  const avgWOBA = (batters: BatterAnalysis[]) => batters.length > 0 ? (batters.reduce((s, b) => s + b.wOBA, 0) / batters.length).toFixed(3) : "-";
  const avgOPS = (batters: BatterAnalysis[]) => {
    if (batters.length === 0) return "-";
    const sum = batters.reduce((s, b) => s + parseFloat(b.ops), 0);
    return (sum / batters.length).toFixed(3);
  };
  const avgFIP = (pitchers: PitcherAnalysis[]) => pitchers.length > 0 ? (pitchers.reduce((s, p) => s + p.fip, 0) / pitchers.length).toFixed(2) : "-";
  const avgKPct = (pitchers: PitcherAnalysis[]) => pitchers.length > 0 ? (pitchers.reduce((s, p) => s + p.kPct, 0) / pitchers.length).toFixed(1) : "-";

  // Identify strengths/weaknesses
  function getStrengths(batters: BatterAnalysis[]): string[] {
    const insights: string[] = [];
    const hotBatters = batters.filter(b => b.wOBA >= 0.350);
    if (hotBatters.length >= 3) insights.push(`wOBA .350+ 타자 ${hotBatters.length}명 — 리그 상위권 공격력`);
    const powerBatters = batters.filter(b => b.hr >= 8);
    if (powerBatters.length >= 2) insights.push(`장타력: ${powerBatters.map(b => `${b.name} ${b.hr}HR`).join(", ")}`);
    const disciplined = batters.filter(b => b.bbPct >= 10);
    if (disciplined.length >= 3) insights.push(`선구안 우수(BB% 10%+) 타자 ${disciplined.length}명 — 투수 소모전 가능`);
    const kHeavy = batters.filter(b => b.kPct >= 28);
    if (kHeavy.length >= 3) insights.push(`삼진 취약(K% 28%+) 타자 ${kHeavy.length}명 — 탈삼진 투수에게 취약`);
    return insights;
  }

  function getPitchingStrengths(pitchers: PitcherAnalysis[]): string[] {
    const insights: string[] = [];
    const elite = pitchers.filter(p => p.fip <= 3.50);
    if (elite.length >= 2) insights.push(`FIP 3.50 이하 투수 ${elite.length}명 — 안정적 투수진`);
    const strikeoutArms = pitchers.filter(p => p.kPct >= 25);
    if (strikeoutArms.length >= 2) insights.push(`탈삼진 능력(K% 25%+): ${strikeoutArms.map(p => `${p.name} ${p.kPct}%`).join(", ")}`);
    const wildPitchers = pitchers.filter(p => p.bbPct >= 10);
    if (wildPitchers.length >= 2) insights.push(`제구 불안(BB% 10%+) 투수 ${wildPitchers.length}명 — 볼넷 허용 주의`);
    return insights;
  }

  const homeHittingInsights = getStrengths(hb);
  const awayHittingInsights = getStrengths(ab);
  const homePitchingInsights = getPitchingStrengths(hp);
  const awayPitchingInsights = getPitchingStrengths(ap);

  return (
    <section className="mb-8">
      <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
        <span className="inline-block w-1 h-6 bg-amber-500 rounded-full" />
        로스터 세이버메트릭스 비교
      </h2>

      {/* Team Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {[
          { name: awayName, color: awayColor, batters: ab, pitchers: ap, hInsights: awayHittingInsights, pInsights: awayPitchingInsights, side: "원정" },
          { name: homeName, color: homeColor, batters: hb, pitchers: hp, hInsights: homeHittingInsights, pInsights: homePitchingInsights, side: "홈" },
        ].map((team) => (
          <div key={team.side} className="rounded-xl bg-white border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100" style={{ borderLeftWidth: "4px", borderLeftColor: team.color }}>
              <h3 className="text-sm font-bold" style={{ color: team.color }}>{team.name} ({team.side})</h3>
            </div>

            {/* Aggregate stats */}
            <div className="px-4 py-3 grid grid-cols-4 gap-2 border-b border-slate-100">
              <MiniStat label="평균 wOBA" value={avgWOBA(team.batters)} />
              <MiniStat label="평균 OPS" value={avgOPS(team.batters)} />
              <MiniStat label="투수 FIP" value={avgFIP(team.pitchers)} />
              <MiniStat label="투수 K%" value={`${avgKPct(team.pitchers)}%`} />
            </div>

            {/* Insights */}
            {(team.hInsights.length > 0 || team.pInsights.length > 0) && (
              <div className="px-4 py-3 space-y-1.5">
                {team.hInsights.map((insight, i) => (
                  <p key={`h${i}`} className="text-xs text-slate-600 flex items-start gap-1.5">
                    <span className="text-amber-500 mt-0.5 shrink-0">▸</span>
                    {insight}
                  </p>
                ))}
                {team.pInsights.map((insight, i) => (
                  <p key={`p${i}`} className="text-xs text-slate-600 flex items-start gap-1.5">
                    <span className="text-blue-500 mt-0.5 shrink-0">▸</span>
                    {insight}
                  </p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Detailed Batter Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {[
          { name: awayName, color: awayColor, batters: ab },
          { name: homeName, color: homeColor, batters: hb },
        ].map((team) => (
          <div key={team.name} className="rounded-xl bg-white border border-slate-200 overflow-hidden">
            <div className="px-4 py-2.5 text-xs font-bold border-b border-slate-100" style={{ color: team.color }}>
              {team.name} 타선 (wOBA순)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[480px]">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400">
                    <th className="px-3 py-2 text-left">선수</th>
                    <th className="px-2 py-2 text-center">타율</th>
                    <th className="px-2 py-2 text-center">OPS</th>
                    <th className="px-2 py-2 text-center font-bold text-slate-500">wOBA</th>
                    <th className="px-2 py-2 text-center">HR</th>
                    <th className="px-2 py-2 text-center">K%</th>
                    <th className="px-2 py-2 text-center">BB%</th>
                  </tr>
                </thead>
                <tbody>
                  {team.batters.slice(0, 9).map((b) => (
                    <tr key={b.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium text-slate-700">
                        <span className="text-slate-400 text-[10px] mr-1">{b.pos}</span>
                        {b.name}
                      </td>
                      <td className="px-2 py-2 text-center font-mono text-slate-600">{b.avg}</td>
                      <td className="px-2 py-2 text-center font-mono text-slate-600">{b.ops}</td>
                      <td className={`px-2 py-2 text-center font-mono font-bold ${b.wOBA >= 0.370 ? "text-red-600" : b.wOBA >= 0.320 ? "text-slate-800" : "text-slate-400"}`}>
                        {b.wOBA.toFixed(3)}
                      </td>
                      <td className={`px-2 py-2 text-center font-mono ${b.hr >= 10 ? "text-red-600 font-bold" : "text-slate-600"}`}>{b.hr}</td>
                      <td className={`px-2 py-2 text-center font-mono ${b.kPct >= 28 ? "text-red-500" : "text-slate-500"}`}>{b.kPct}%</td>
                      <td className={`px-2 py-2 text-center font-mono ${b.bbPct >= 10 ? "text-green-600" : "text-slate-500"}`}>{b.bbPct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* Detailed Pitcher Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[
          { name: awayName, color: awayColor, pitchers: ap },
          { name: homeName, color: homeColor, pitchers: hp },
        ].map((team) => (
          <div key={team.name} className="rounded-xl bg-white border border-slate-200 overflow-hidden">
            <div className="px-4 py-2.5 text-xs font-bold border-b border-slate-100" style={{ color: team.color }}>
              {team.name} 투수진 (FIP순)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[480px]">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400">
                    <th className="px-3 py-2 text-left">투수</th>
                    <th className="px-2 py-2 text-center">ERA</th>
                    <th className="px-2 py-2 text-center font-bold text-slate-500">FIP</th>
                    <th className="px-2 py-2 text-center">WHIP</th>
                    <th className="px-2 py-2 text-center">K%</th>
                    <th className="px-2 py-2 text-center">BB%</th>
                    <th className="px-2 py-2 text-center">성적</th>
                  </tr>
                </thead>
                <tbody>
                  {team.pitchers.slice(0, 8).map((p) => (
                    <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium text-slate-700">
                        <span className="text-slate-400 text-[10px] mr-1">{p.pos}</span>
                        {p.name}
                      </td>
                      <td className={`px-2 py-2 text-center font-mono ${parseFloat(p.era) <= 3.0 ? "text-green-600 font-bold" : parseFloat(p.era) >= 5.0 ? "text-red-500" : "text-slate-600"}`}>
                        {p.era}
                      </td>
                      <td className={`px-2 py-2 text-center font-mono font-bold ${p.fip <= 3.5 ? "text-green-600" : p.fip >= 5.0 ? "text-red-500" : "text-slate-800"}`}>
                        {p.fip.toFixed(2)}
                      </td>
                      <td className="px-2 py-2 text-center font-mono text-slate-600">{p.whip}</td>
                      <td className={`px-2 py-2 text-center font-mono ${p.kPct >= 25 ? "text-green-600" : "text-slate-500"}`}>{p.kPct}%</td>
                      <td className={`px-2 py-2 text-center font-mono ${p.bbPct >= 10 ? "text-red-500" : "text-slate-500"}`}>{p.bbPct}%</td>
                      <td className="px-2 py-2 text-center font-mono text-slate-500">{p.record}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[10px] text-slate-400 text-center">
        1군 액티브 로스터 기준 · {CURRENT_SEASON} 시즌 누적 성적 · wOBA/FIP = 세이버메트릭스 핵심 지표
      </p>
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-[10px] text-slate-400">{label}</p>
      <p className="text-sm font-bold font-mono text-slate-700">{value}</p>
    </div>
  );
}
