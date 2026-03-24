import { fetchPlayerStats } from "@/lib/sports/mlb/api";
import { displayName } from "@/data/players";
import { getTeamById } from "@/data/teams";
import { getActiveSeason } from "@/lib/sports/mlb/season";
import Collapsible from "@/components/ui/Collapsible";

function num(val: unknown): number {
  if (typeof val === "number") return val;
  if (typeof val === "string") return parseFloat(val) || 0;
  return 0;
}

interface RosterEntry {
  person: { id: number; fullName: string };
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

async function fetchRoster(teamId: number, season: number): Promise<RosterEntry[]> {
  try {
    const res = await fetch(
      `https://statsapi.mlb.com/api/v1/teams/${teamId}/roster?rosterType=active&season=${season}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.roster ?? []) as RosterEntry[];
  } catch { return []; }
}

async function fetchBatter(id: number, name: string, pos: string, season: number): Promise<BatterRow | null> {
  try {
    const data = await fetchPlayerStats(id, season, "hitting");
    const stat = data.people?.[0]?.stats?.[0]?.splits?.[0]?.stat;
    if (!stat) return null;
    const pa = num(stat.plateAppearances);
    if (pa < 10) return null;

    const ab = num(stat.atBats);
    const singles = num(stat.hits) - num(stat.doubles) - num(stat.triples) - num(stat.homeRuns);
    const wDen = ab + num(stat.baseOnBalls) - num(stat.intentionalWalks) + num(stat.sacFlies) + num(stat.hitByPitch);
    const wOBA = wDen > 0 ? (0.69*(num(stat.baseOnBalls)-num(stat.intentionalWalks)) + 0.72*num(stat.hitByPitch) + 0.88*singles + 1.27*num(stat.doubles) + 1.62*num(stat.triples) + 2.1*num(stat.homeRuns)) / wDen : 0;

    return {
      id, name: displayName(id, name), pos,
      avg: String(stat.avg ?? ".000"), obp: String(stat.obp ?? ".000"),
      slg: String(stat.slg ?? ".000"), ops: String(stat.ops ?? ".000"),
      hr: num(stat.homeRuns), rbi: num(stat.rbi),
      wOBA: Math.round(wOBA * 1000) / 1000,
      kPct: pa > 0 ? Math.round((num(stat.strikeOuts) / pa) * 1000) / 10 : 0,
      bbPct: pa > 0 ? Math.round((num(stat.baseOnBalls) / pa) * 1000) / 10 : 0,
    };
  } catch { return null; }
}

async function fetchPitcher(id: number, name: string, pos: string, season: number): Promise<PitcherRow | null> {
  try {
    const data = await fetchPlayerStats(id, season, "pitching");
    const stat = data.people?.[0]?.stats?.[0]?.splits?.[0]?.stat;
    if (!stat) return null;
    const ipRaw = stat.inningsPitched ?? "0";
    const ipVal = typeof ipRaw === "string" ? parseFloat(ipRaw) : ipRaw;
    const whole = Math.floor(ipVal); const frac = Math.round((ipVal - whole) * 10);
    const ip = whole + frac / 3;
    if (ip < 3) return null;

    const bf = num(stat.battersFaced);
    const fip = ip > 0 ? (13*num(stat.homeRuns) + 3*(num(stat.baseOnBalls)+num(stat.hitByPitch)) - 2*num(stat.strikeOuts)) / ip + 3.1 : 0;

    return {
      id, name: displayName(id, name), pos,
      era: String(stat.era ?? "0.00"), whip: String(stat.whip ?? "0.00"),
      ip: String(ipRaw), k: num(stat.strikeOuts), bb: num(stat.baseOnBalls),
      fip: Math.round(fip * 100) / 100,
      kPct: bf > 0 ? Math.round((num(stat.strikeOuts) / bf) * 1000) / 10 : 0,
      bbPct: bf > 0 ? Math.round((num(stat.baseOnBalls) / bf) * 1000) / 10 : 0,
      record: `${num(stat.wins)}W ${num(stat.losses)}L`,
    };
  } catch { return null; }
}

function getInsights(batters: BatterRow[]): string[] {
  const r: string[] = [];
  const hot = batters.filter(b => b.wOBA >= 0.350);
  if (hot.length >= 2) r.push(`wOBA .350+: ${hot.length} players — elite offense`);
  const power = batters.filter(b => b.hr >= 15);
  if (power.length >= 1) r.push(`Power: ${power.map(b=>`${b.name} ${b.hr}HR`).join(", ")}`);
  const kHeavy = batters.filter(b => b.kPct >= 28);
  if (kHeavy.length >= 2) r.push(`High K% (28%+): ${kHeavy.length} players`);
  return r;
}

function getPInsights(pitchers: PitcherRow[]): string[] {
  const r: string[] = [];
  const elite = pitchers.filter(p => p.fip <= 3.50);
  if (elite.length >= 1) r.push(`FIP 3.50 or below: ${elite.map(p=>`${p.name} ${p.fip}`).join(", ")}`);
  const kArms = pitchers.filter(p => p.kPct >= 25);
  if (kArms.length >= 1) r.push(`Strikeout (K% 25%+): ${kArms.map(p=>`${p.name} ${p.kPct}%`).join(", ")}`);
  return r;
}

interface Props {
  homeTeamId: number; awayTeamId: number;
  homeColor: string; awayColor: string;
}

export default async function RosterAnalysis({ homeTeamId, awayTeamId, homeColor, awayColor }: Props) {
  const season = await getActiveSeason();
  const rosterYear = new Date().getFullYear(); // roster always uses current year

  const [homeRoster, awayRoster] = await Promise.all([
    fetchRoster(homeTeamId, rosterYear),
    fetchRoster(awayTeamId, rosterYear),
  ]);

  if (homeRoster.length === 0 && awayRoster.length === 0) return null;

  const homeTeam = getTeamById(homeTeamId);
  const awayTeam = getTeamById(awayTeamId);
  const homeName = homeTeam?.nameKo ?? "Home";
  const awayName = awayTeam?.nameKo ?? "Away";

  const isPitcherPos = (r: RosterEntry) => r.position?.type === "Pitcher" || r.position?.code === "1";

  // Fetch top 6 batters + top 4 pitchers per team = 20 calls max (parallel, cached 1hr)
  const homeBatterEntries = homeRoster.filter(r => !isPitcherPos(r)).slice(0, 6);
  const awayBatterEntries = awayRoster.filter(r => !isPitcherPos(r)).slice(0, 6);
  const homePitcherEntries = homeRoster.filter(r => isPitcherPos(r)).slice(0, 4);
  const awayPitcherEntries = awayRoster.filter(r => isPitcherPos(r)).slice(0, 4);

  const [hbResults, abResults, hpResults, apResults] = await Promise.all([
    Promise.all(homeBatterEntries.map(r => fetchBatter(r.person.id, r.person.fullName, r.position?.abbreviation ?? "", season))),
    Promise.all(awayBatterEntries.map(r => fetchBatter(r.person.id, r.person.fullName, r.position?.abbreviation ?? "", season))),
    Promise.all(homePitcherEntries.map(r => fetchPitcher(r.person.id, r.person.fullName, r.position?.abbreviation ?? "P", season))),
    Promise.all(awayPitcherEntries.map(r => fetchPitcher(r.person.id, r.person.fullName, r.position?.abbreviation ?? "P", season))),
  ]);

  const hb = hbResults.filter((b): b is BatterRow => b !== null).sort((a, b) => b.wOBA - a.wOBA);
  const ab = abResults.filter((b): b is BatterRow => b !== null).sort((a, b) => b.wOBA - a.wOBA);
  const hp = hpResults.filter((p): p is PitcherRow => p !== null).sort((a, b) => a.fip - b.fip);
  const ap = apResults.filter((p): p is PitcherRow => p !== null).sort((a, b) => a.fip - b.fip);

  if (hb.length === 0 && ab.length === 0 && hp.length === 0 && ap.length === 0) return null;

  const avg = (arr: number[]) => arr.length > 0 ? (arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(3) : "-";
  const avgF = (arr: number[]) => arr.length > 0 ? (arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(2) : "-";

  return (
    <section className="mb-8">
      <h2 className="text-xl font-bold text-slate-800 mb-1 flex items-center gap-2">
        <span className="inline-block w-1 h-6 bg-amber-500 rounded-full" />
        Roster Sabermetrics Comparison
      </h2>
      <p className="text-xs text-slate-400 mb-4 ml-3">{season} season{season < new Date().getFullYear() ? " (Pre-season)" : ""}</p>

      {/* Team Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {[
          { name: awayName, abbr: awayTeam?.abbreviation ?? "", color: awayColor, batters: ab, pitchers: ap, side: "Away" },
          { name: homeName, abbr: homeTeam?.abbreviation ?? "", color: homeColor, batters: hb, pitchers: hp, side: "Home" },
        ].map((t) => (
          <div key={t.side} className="rounded-xl bg-white border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3" style={{ borderLeftWidth: "4px", borderLeftColor: t.color }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: `linear-gradient(135deg, ${t.color}, ${t.color}cc)` }}>
                {t.abbr.slice(0, 3)}
              </div>
              <h3 className="text-sm font-bold" style={{ color: t.color }}>{t.name} ({t.side})</h3>
            </div>
            <div className="px-4 py-3 grid grid-cols-4 gap-2 border-b border-slate-100">
              <Mini label="Avg wOBA" value={avg(t.batters.map(b => b.wOBA))} />
              <Mini label="Avg OPS" value={avg(t.batters.map(b => parseFloat(b.ops)))} />
              <Mini label="Pitching FIP" value={avgF(t.pitchers.map(p => p.fip))} />
              <Mini label="Pitching K%" value={`${avgF(t.pitchers.map(p => p.kPct))}%`} />
            </div>
            <div className="px-4 py-3 space-y-1.5">
              {getInsights(t.batters).map((s, i) => (
                <p key={`h${i}`} className="text-xs text-slate-600 flex items-start gap-1.5">
                  <span className="text-amber-500 mt-0.5 shrink-0">▸</span>{s}
                </p>
              ))}
              {getPInsights(t.pitchers).map((s, i) => (
                <p key={`p${i}`} className="text-xs text-slate-600 flex items-start gap-1.5">
                  <span className="text-blue-500 mt-0.5 shrink-0">▸</span>{s}
                </p>
              ))}
              {getInsights(t.batters).length === 0 && getPInsights(t.pitchers).length === 0 && (
                <p className="text-xs text-slate-400">Collecting data...</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Batter Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {[{ name: awayName, color: awayColor, batters: ab }, { name: homeName, color: homeColor, batters: hb }].map((t) => (
          <Collapsible key={t.name} title={`${t.name} Batting (by wOBA) — ${t.batters.length} players`} titleColor={t.color}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[440px]">
                <thead><tr className="border-b border-slate-200 text-slate-400">
                  <th className="px-3 py-2 text-left">Player</th>
                  <th className="px-2 py-2 text-center">AVG</th>
                  <th className="px-2 py-2 text-center">OPS</th>
                  <th className="px-2 py-2 text-center font-bold text-slate-500">wOBA</th>
                  <th className="px-2 py-2 text-center">HR</th>
                  <th className="px-2 py-2 text-center">K%</th>
                  <th className="px-2 py-2 text-center">BB%</th>
                </tr></thead>
                <tbody>
                  {t.batters.map((b) => (
                    <tr key={b.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium text-slate-700"><span className="text-slate-400 text-[10px] mr-1">{b.pos}</span>{b.name}</td>
                      <td className="px-2 py-2 text-center font-mono text-slate-600">{b.avg}</td>
                      <td className="px-2 py-2 text-center font-mono text-slate-600">{b.ops}</td>
                      <td className={`px-2 py-2 text-center font-mono font-bold ${b.wOBA>=0.370?"text-red-600":b.wOBA>=0.320?"text-slate-800":"text-slate-400"}`}>{b.wOBA.toFixed(3)}</td>
                      <td className={`px-2 py-2 text-center font-mono ${b.hr>=15?"text-red-600 font-bold":"text-slate-600"}`}>{b.hr}</td>
                      <td className={`px-2 py-2 text-center font-mono ${b.kPct>=28?"text-red-500":"text-slate-500"}`}>{b.kPct}%</td>
                      <td className={`px-2 py-2 text-center font-mono ${b.bbPct>=10?"text-green-600":"text-slate-500"}`}>{b.bbPct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Collapsible>
        ))}
      </div>

      {/* Pitcher Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[{ name: awayName, color: awayColor, pitchers: ap }, { name: homeName, color: homeColor, pitchers: hp }].map((t) => (
          <Collapsible key={t.name} title={`${t.name} Pitching (by FIP) — ${t.pitchers.length} players`} titleColor={t.color}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[440px]">
                <thead><tr className="border-b border-slate-200 text-slate-400">
                  <th className="px-3 py-2 text-left">Pitcher</th>
                  <th className="px-2 py-2 text-center">ERA</th>
                  <th className="px-2 py-2 text-center font-bold text-slate-500">FIP</th>
                  <th className="px-2 py-2 text-center">WHIP</th>
                  <th className="px-2 py-2 text-center">K%</th>
                  <th className="px-2 py-2 text-center">BB%</th>
                  <th className="px-2 py-2 text-center">Record</th>
                </tr></thead>
                <tbody>
                  {t.pitchers.map((p) => (
                    <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium text-slate-700"><span className="text-slate-400 text-[10px] mr-1">{p.pos}</span>{p.name}</td>
                      <td className={`px-2 py-2 text-center font-mono ${parseFloat(p.era)<=3.0?"text-green-600 font-bold":parseFloat(p.era)>=5.0?"text-red-500":"text-slate-600"}`}>{p.era}</td>
                      <td className={`px-2 py-2 text-center font-mono font-bold ${p.fip<=3.5?"text-green-600":p.fip>=5.0?"text-red-500":"text-slate-800"}`}>{p.fip.toFixed(2)}</td>
                      <td className="px-2 py-2 text-center font-mono text-slate-600">{p.whip}</td>
                      <td className={`px-2 py-2 text-center font-mono ${p.kPct>=25?"text-green-600":"text-slate-500"}`}>{p.kPct}%</td>
                      <td className={`px-2 py-2 text-center font-mono ${p.bbPct>=10?"text-red-500":"text-slate-500"}`}>{p.bbPct}%</td>
                      <td className="px-2 py-2 text-center font-mono text-slate-500">{p.record}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Collapsible>
        ))}
      </div>
    </section>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className="text-center"><p className="text-[10px] text-slate-400">{label}</p><p className="text-sm font-bold font-mono text-slate-700">{value}</p></div>;
}
