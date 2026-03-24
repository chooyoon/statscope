import { displayName } from "@/data/players";
import { getTeamById } from "@/data/teams";

const CURRENT_SEASON = new Date().getFullYear();

function num(val: unknown): number {
  if (typeof val === "number") return val;
  if (typeof val === "string") return parseFloat(val) || 0;
  return 0;
}

// Bulk fetch: 1 API call per team (roster + season stats for all players)
async function fetchRosterWithStats(teamId: number): Promise<RosterPlayer[]> {
  try {
    const res = await fetch(
      `https://statsapi.mlb.com/api/v1/teams/${teamId}/roster?rosterType=active&season=${CURRENT_SEASON}&hydrate=person(stats(type=[season],group=[hitting,pitching],season=${CURRENT_SEASON}))`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.roster ?? []) as RosterPlayer[];
  } catch {
    return [];
  }
}

interface RosterPlayer {
  person: {
    id: number;
    fullName: string;
    stats?: { group: { displayName: string }; splits: { stat: Record<string, any> }[] }[];
  };
  jerseyNumber?: string;
  position: { type?: string; code?: string; abbreviation?: string };
}

interface BatterRow {
  id: number; name: string; pos: string;
  avg: string; obp: string; slg: string; ops: string;
  hr: number; rbi: number; wOBA: number; kPct: number; bbPct: number;
}

interface PitcherRow {
  id: number; name: string; pos: string;
  era: string; whip: string; ip: string;
  k: number; bb: number; fip: number;
  kPct: number; bbPct: number; record: string;
}

function extractBatter(p: RosterPlayer): BatterRow | null {
  const hittingGroup = p.person.stats?.find(s => s.group.displayName === "hitting");
  const stat = hittingGroup?.splits?.[0]?.stat;
  if (!stat) return null;
  const pa = num(stat.plateAppearances);
  if (pa < 5) return null;

  const ab = num(stat.atBats);
  const singles = num(stat.hits) - num(stat.doubles) - num(stat.triples) - num(stat.homeRuns);
  const wDenom = ab + num(stat.baseOnBalls) - num(stat.intentionalWalks) + num(stat.sacFlies) + num(stat.hitByPitch);
  const wOBA = wDenom > 0 ? (
    0.69 * (num(stat.baseOnBalls) - num(stat.intentionalWalks)) +
    0.72 * num(stat.hitByPitch) + 0.88 * singles +
    1.27 * num(stat.doubles) + 1.62 * num(stat.triples) + 2.1 * num(stat.homeRuns)
  ) / wDenom : 0;

  return {
    id: p.person.id,
    name: displayName(p.person.id, p.person.fullName),
    pos: p.position?.abbreviation ?? "",
    avg: String(stat.avg ?? ".000"), obp: String(stat.obp ?? ".000"),
    slg: String(stat.slg ?? ".000"), ops: String(stat.ops ?? ".000"),
    hr: num(stat.homeRuns), rbi: num(stat.rbi),
    wOBA: Math.round(wOBA * 1000) / 1000,
    kPct: pa > 0 ? Math.round((num(stat.strikeOuts) / pa) * 1000) / 10 : 0,
    bbPct: pa > 0 ? Math.round((num(stat.baseOnBalls) / pa) * 1000) / 10 : 0,
  };
}

function extractPitcher(p: RosterPlayer): PitcherRow | null {
  const pitchingGroup = p.person.stats?.find(s => s.group.displayName === "pitching");
  const stat = pitchingGroup?.splits?.[0]?.stat;
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
    id: p.person.id,
    name: displayName(p.person.id, p.person.fullName),
    pos: p.position?.abbreviation ?? "P",
    era: String(stat.era ?? "0.00"), whip: String(stat.whip ?? "0.00"),
    ip: String(ipRaw), k: num(stat.strikeOuts), bb: num(stat.baseOnBalls),
    fip: Math.round(fip * 100) / 100,
    kPct: bf > 0 ? Math.round((num(stat.strikeOuts) / bf) * 1000) / 10 : 0,
    bbPct: bf > 0 ? Math.round((num(stat.baseOnBalls) / bf) * 1000) / 10 : 0,
    record: `${num(stat.wins)}승 ${num(stat.losses)}패`,
  };
}

function getHittingInsights(batters: BatterRow[]): string[] {
  const insights: string[] = [];
  const hot = batters.filter(b => b.wOBA >= 0.350);
  if (hot.length >= 3) insights.push(`wOBA .350+ 타자 ${hot.length}명 — 리그 상위권 공격력`);
  else if (hot.length === 0 && batters.length >= 5) insights.push(`wOBA .350+ 타자 없음 — 타선 전체적으로 부진`);
  const power = batters.filter(b => b.hr >= 8);
  if (power.length >= 2) insights.push(`장타력: ${power.map(b => `${b.name} ${b.hr}HR`).join(", ")}`);
  const kHeavy = batters.filter(b => b.kPct >= 28);
  if (kHeavy.length >= 3) insights.push(`삼진 취약(K% 28%+) ${kHeavy.length}명 — 탈삼진 투수에게 약할 수 있음`);
  const disciplined = batters.filter(b => b.bbPct >= 10);
  if (disciplined.length >= 3) insights.push(`선구안 우수(BB% 10%+) ${disciplined.length}명 — 투수 소모전 가능`);
  return insights;
}

function getPitchingInsights(pitchers: PitcherRow[]): string[] {
  const insights: string[] = [];
  const elite = pitchers.filter(p => p.fip <= 3.50);
  if (elite.length >= 2) insights.push(`FIP 3.50↓ 투수 ${elite.length}명 — 안정적 투수진`);
  const kArms = pitchers.filter(p => p.kPct >= 25);
  if (kArms.length >= 2) insights.push(`탈삼진(K% 25%+): ${kArms.map(p => `${p.name} ${p.kPct}%`).join(", ")}`);
  const wild = pitchers.filter(p => p.bbPct >= 10);
  if (wild.length >= 2) insights.push(`제구 불안(BB% 10%+) ${wild.length}명 — 볼넷 난조 주의`);
  return insights;
}

interface Props {
  homeTeamId: number;
  awayTeamId: number;
  homeColor: string;
  awayColor: string;
}

export default async function RosterAnalysis({ homeTeamId, awayTeamId, homeColor, awayColor }: Props) {
  const [homeRoster, awayRoster] = await Promise.all([
    fetchRosterWithStats(homeTeamId),
    fetchRosterWithStats(awayTeamId),
  ]);

  if (homeRoster.length === 0 && awayRoster.length === 0) return null;

  const homeTeam = getTeamById(homeTeamId);
  const awayTeam = getTeamById(awayTeamId);
  const homeName = homeTeam?.nameKo ?? "홈";
  const awayName = awayTeam?.nameKo ?? "원정";

  const isPitcherPos = (r: RosterPlayer) => r.position?.type === "Pitcher" || r.position?.code === "1";

  const hb = homeRoster.filter(r => !isPitcherPos(r)).map(extractBatter).filter((b): b is BatterRow => b !== null).sort((a, b) => b.wOBA - a.wOBA);
  const ab = awayRoster.filter(r => !isPitcherPos(r)).map(extractBatter).filter((b): b is BatterRow => b !== null).sort((a, b) => b.wOBA - a.wOBA);
  const hp = homeRoster.filter(r => isPitcherPos(r)).map(extractPitcher).filter((p): p is PitcherRow => p !== null).sort((a, b) => a.fip - b.fip);
  const ap = awayRoster.filter(r => isPitcherPos(r)).map(extractPitcher).filter((p): p is PitcherRow => p !== null).sort((a, b) => a.fip - b.fip);

  if (hb.length === 0 && ab.length === 0 && hp.length === 0 && ap.length === 0) return null;

  const avg = (arr: number[]) => arr.length > 0 ? (arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(3) : "-";
  const avgF = (arr: number[]) => arr.length > 0 ? (arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(2) : "-";

  return (
    <section className="mb-8">
      <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
        <span className="inline-block w-1 h-6 bg-amber-500 rounded-full" />
        로스터 세이버매트릭스 비교
      </h2>

      {/* Team Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {[
          { name: awayName, color: awayColor, batters: ab, pitchers: ap, side: "원정", logo: awayTeamId },
          { name: homeName, color: homeColor, batters: hb, pitchers: hp, side: "홈", logo: homeTeamId },
        ].map((t) => (
          <div key={t.side} className="rounded-xl bg-white border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3" style={{ borderLeftWidth: "4px", borderLeftColor: t.color }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`https://www.mlbstatic.com/team-logos/${t.logo}.svg`} alt="" className="w-8 h-8" />
              <h3 className="text-sm font-bold" style={{ color: t.color }}>{t.name} ({t.side})</h3>
            </div>
            <div className="px-4 py-3 grid grid-cols-4 gap-2 border-b border-slate-100">
              <Mini label="평균 wOBA" value={avg(t.batters.map(b => b.wOBA))} />
              <Mini label="평균 OPS" value={avg(t.batters.map(b => parseFloat(b.ops)))} />
              <Mini label="투수 FIP" value={avgF(t.pitchers.map(p => p.fip))} />
              <Mini label="투수 K%" value={`${avgF(t.pitchers.map(p => p.kPct))}%`} />
            </div>
            <div className="px-4 py-3 space-y-1.5">
              {getHittingInsights(t.batters).map((s, i) => (
                <p key={`h${i}`} className="text-xs text-slate-600 flex items-start gap-1.5">
                  <span className="text-amber-500 mt-0.5 shrink-0">▸</span>{s}
                </p>
              ))}
              {getPitchingInsights(t.pitchers).map((s, i) => (
                <p key={`p${i}`} className="text-xs text-slate-600 flex items-start gap-1.5">
                  <span className="text-blue-500 mt-0.5 shrink-0">▸</span>{s}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Batter Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {[
          { name: awayName, color: awayColor, batters: ab },
          { name: homeName, color: homeColor, batters: hb },
        ].map((t) => (
          <div key={t.name} className="rounded-xl bg-white border border-slate-200 overflow-hidden">
            <div className="px-4 py-2.5 text-xs font-bold border-b border-slate-100" style={{ color: t.color }}>
              {t.name} 타선 (wOBA순)
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
                  {t.batters.slice(0, 9).map((b) => (
                    <tr key={b.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium text-slate-700">
                        <span className="text-slate-400 text-[10px] mr-1">{b.pos}</span>{b.name}
                      </td>
                      <td className="px-2 py-2 text-center font-mono text-slate-600">{b.avg}</td>
                      <td className="px-2 py-2 text-center font-mono text-slate-600">{b.ops}</td>
                      <td className={`px-2 py-2 text-center font-mono font-bold ${b.wOBA >= 0.370 ? "text-red-600" : b.wOBA >= 0.320 ? "text-slate-800" : "text-slate-400"}`}>{b.wOBA.toFixed(3)}</td>
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

      {/* Pitcher Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[
          { name: awayName, color: awayColor, pitchers: ap },
          { name: homeName, color: homeColor, pitchers: hp },
        ].map((t) => (
          <div key={t.name} className="rounded-xl bg-white border border-slate-200 overflow-hidden">
            <div className="px-4 py-2.5 text-xs font-bold border-b border-slate-100" style={{ color: t.color }}>
              {t.name} 투수진 (FIP순)
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
                  {t.pitchers.slice(0, 8).map((p) => (
                    <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium text-slate-700">
                        <span className="text-slate-400 text-[10px] mr-1">{p.pos}</span>{p.name}
                      </td>
                      <td className={`px-2 py-2 text-center font-mono ${parseFloat(p.era) <= 3.0 ? "text-green-600 font-bold" : parseFloat(p.era) >= 5.0 ? "text-red-500" : "text-slate-600"}`}>{p.era}</td>
                      <td className={`px-2 py-2 text-center font-mono font-bold ${p.fip <= 3.5 ? "text-green-600" : p.fip >= 5.0 ? "text-red-500" : "text-slate-800"}`}>{p.fip.toFixed(2)}</td>
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
        1군 액티브 로스터 기준 · {CURRENT_SEASON} 시즌 누적 성적 · wOBA/FIP = 세이버매트릭스 핵심 지표
      </p>
    </section>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-[10px] text-slate-400">{label}</p>
      <p className="text-sm font-bold font-mono text-slate-700">{value}</p>
    </div>
  );
}
