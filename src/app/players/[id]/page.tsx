import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  fetchPlayerStats,
  fetchPlayerYearByYear,
  type MLBPlayer,
  type MLBStatSplit,
} from "@/lib/sports/mlb/api";
import {
  calcWOBA,
  calcWRCPlus,
  calcFIP,
  calcBABIP,
  calcISO,
  calcKPercent,
  calcBBPercent,
} from "@/lib/sports/mlb/metrics";
import { playerNamesKo, displayNameFull } from "@/data/players";
import { getTeamById } from "@/data/teams";
import { statLabels, getStatLabel } from "@/data/stats";
import StatsGrid from "@/components/ui/StatsGrid";
import RadarChart from "@/components/charts/RadarChart";
import TeamBadge from "@/components/ui/TeamBadge";
import FormBadge from "@/components/player/FormBadge";
import AdBanner from "@/components/ads/AdBanner";
import { calcHittingForm, calcPitchingForm } from "@/lib/sports/mlb/form";

const CURRENT_SEASON = new Date().getFullYear();

function isPitcher(pos: string): boolean {
  return pos === "P" || pos === "TWP";
}

function getSafeNumber(val: unknown): number {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const n = parseFloat(val);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

function buildHittingStats(stat: Record<string, any>) {
  return {
    atBats: getSafeNumber(stat.atBats),
    hits: getSafeNumber(stat.hits),
    doubles: getSafeNumber(stat.doubles),
    triples: getSafeNumber(stat.triples),
    homeRuns: getSafeNumber(stat.homeRuns),
    baseOnBalls: getSafeNumber(stat.baseOnBalls),
    hitByPitch: getSafeNumber(stat.hitByPitch),
    sacFlies: getSafeNumber(stat.sacFlies),
    strikeOuts: getSafeNumber(stat.strikeOuts),
    plateAppearances: getSafeNumber(stat.plateAppearances),
    avg: stat.avg ?? "0",
    slg: stat.slg ?? "0",
    intentionalWalks: getSafeNumber(stat.intentionalWalks),
  };
}

function buildPitchingStats(stat: Record<string, any>) {
  return {
    homeRuns: getSafeNumber(stat.homeRuns),
    baseOnBalls: getSafeNumber(stat.baseOnBalls),
    hitByPitch: getSafeNumber(stat.hitByPitch),
    strikeOuts: getSafeNumber(stat.strikeOuts),
    inningsPitched: stat.inningsPitched ?? "0",
    hits: getSafeNumber(stat.hits),
    sacFlies: getSafeNumber(stat.sacFlies),
    battersFaced: getSafeNumber(stat.battersFaced),
  };
}

// League average references for radar chart normalization
const LEAGUE_AVG_HITTING = {
  wOBA: 0.318,
  wRCPlus: 100,
  BABIP: 0.3,
  ISO: 0.15,
  kPercent: 22.0,
  bbPercent: 8.5,
};

const LEAGUE_AVG_PITCHING = {
  FIP: 4.0,
  BABIP: 0.3,
  kPercent: 22.0,
  bbPercent: 8.0,
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const playerId = parseInt(id, 10);
  if (isNaN(playerId)) {
    return { title: "Player Not Found | StatScope" };
  }

  try {
    const data = await fetchPlayerStats(playerId, CURRENT_SEASON, "hitting");
    const player = data.people?.[0];
    if (!player) {
      return { title: "Player Not Found | StatScope" };
    }
    const name = displayNameFull(player.id, player.fullName);
    return {
      title: `${name} - Player Analysis | StatScope`,
      description: `${name} season stats and sabermetrics analysis on StatScope.`,
      openGraph: {
        title: `${name} - Player Analysis | StatScope`,
        description: `${name} MLB stats, wOBA, wRC+, FIP and more advanced analytics.`,
      },
    };
  } catch {
    return { title: "Player Analysis | StatScope" };
  }
}

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const playerId = parseInt(id, 10);
  if (isNaN(playerId)) notFound();

  // Try fetching as hitter first, then as pitcher
  let player: MLBPlayer | null = null;
  let seasonStat: Record<string, any> | null = null;
  let yearByYearSplits: MLBStatSplit[] = [];
  let playerType: "hitting" | "pitching" = "hitting";

  try {
    const [hittingData, hittingYBY] = await Promise.all([
      fetchPlayerStats(playerId, CURRENT_SEASON, "hitting"),
      fetchPlayerYearByYear(playerId, "hitting"),
    ]);

    player = hittingData.people?.[0] ?? null;
    const hittingSeason = player?.stats?.[0]?.splits?.[0]?.stat;
    const hittingYears = hittingYBY.people?.[0]?.stats?.[0]?.splits ?? [];

    // Check if this is primarily a pitcher
    if (player && isPitcher(player.primaryPosition.abbreviation)) {
      playerType = "pitching";
      const [pitchingData, pitchingYBY] = await Promise.all([
        fetchPlayerStats(playerId, CURRENT_SEASON, "pitching"),
        fetchPlayerYearByYear(playerId, "pitching"),
      ]);
      seasonStat = pitchingData.people?.[0]?.stats?.[0]?.splits?.[0]?.stat ?? null;
      yearByYearSplits = pitchingYBY.people?.[0]?.stats?.[0]?.splits ?? [];
    } else {
      seasonStat = hittingSeason ?? null;
      yearByYearSplits = hittingYears;
    }
  } catch {
    notFound();
  }

  if (!player) notFound();

  const team = player.currentTeam
    ? getTeamById(player.currentTeam.id)
    : undefined;

  const nameKo = playerNamesKo[player.id];
  const teamColor = team?.colorPrimary ?? "#6366f1";

  // Calculate form index
  const formIndex = seasonStat
    ? playerType === "hitting"
      ? calcHittingForm(seasonStat as any)
      : calcPitchingForm(seasonStat as any)
    : null;

  // Calculate sabermetrics
  let sabermetrics: Record<string, number> = {};
  let radarData: { label: string; value: number; fullMark: number }[] = [];

  if (seasonStat) {
    if (playerType === "hitting") {
      const hs = buildHittingStats(seasonStat);
      const wOBA = calcWOBA(hs);
      const wRCPlus = calcWRCPlus(hs);
      const babip = calcBABIP(hs);
      const iso = calcISO(hs);
      const kPct = calcKPercent(hs);
      const bbPct = calcBBPercent(hs);

      sabermetrics = { wOBA, "wRC+": wRCPlus, BABIP: babip, ISO: iso, "K%": kPct, "BB%": bbPct };

      // Radar: normalize each metric to 0-100 scale relative to league average
      radarData = [
        {
          label: "wOBA",
          value: Math.round((wOBA / LEAGUE_AVG_HITTING.wOBA) * 100),
          fullMark: 200,
        },
        {
          label: "wRC+",
          value: wRCPlus,
          fullMark: 200,
        },
        {
          label: "BABIP",
          value: Math.round((babip / LEAGUE_AVG_HITTING.BABIP) * 100),
          fullMark: 200,
        },
        {
          label: "ISO",
          value: Math.round((iso / LEAGUE_AVG_HITTING.ISO) * 100),
          fullMark: 200,
        },
        {
          label: "K% (inv)",
          value: Math.round(
            (LEAGUE_AVG_HITTING.kPercent / Math.max(kPct, 1)) * 100
          ),
          fullMark: 200,
        },
        {
          label: "BB%",
          value: Math.round((bbPct / LEAGUE_AVG_HITTING.bbPercent) * 100),
          fullMark: 200,
        },
      ];
    } else {
      const ps = buildPitchingStats(seasonStat);
      const fip = calcFIP(ps);
      const babip = calcBABIP(ps);
      const kPct = calcKPercent(ps);
      const bbPct = calcBBPercent(ps);

      sabermetrics = { FIP: fip, BABIP: babip, "K%": kPct, "BB%": bbPct };

      radarData = [
        {
          label: "FIP (inv)",
          value: Math.round((LEAGUE_AVG_PITCHING.FIP / Math.max(fip, 0.5)) * 100),
          fullMark: 200,
        },
        {
          label: "BABIP (inv)",
          value: Math.round(
            (LEAGUE_AVG_PITCHING.BABIP / Math.max(babip, 0.1)) * 100
          ),
          fullMark: 200,
        },
        {
          label: "K%",
          value: Math.round((kPct / LEAGUE_AVG_PITCHING.kPercent) * 100),
          fullMark: 200,
        },
        {
          label: "BB% (inv)",
          value: Math.round(
            (LEAGUE_AVG_PITCHING.bbPercent / Math.max(bbPct, 1)) * 100
          ),
          fullMark: 200,
        },
      ];
    }
  }

  // Year-by-year table columns
  const ybyColumns =
    playerType === "hitting"
      ? [
          "season",
          "gamesPlayed",
          "atBats",
          "hits",
          "homeRuns",
          "rbi",
          "runs",
          "stolenBases",
          "avg",
          "obp",
          "slg",
          "ops",
        ]
      : [
          "season",
          "gamesPlayed",
          "wins",
          "losses",
          "era",
          "inningsPitched",
          "strikeOuts",
          "baseOnBalls",
          "whip",
          "homeRuns",
        ];

  const ybyLabels: Record<string, string> = {
    season: "Season",
    gamesPlayed: "G",
    atBats: "AB",
    hits: "H",
    homeRuns: "HR",
    rbi: "RBI",
    runs: "R",
    stolenBases: "SB",
    avg: "AVG",
    obp: "OBP",
    slg: "SLG",
    ops: "OPS",
    wins: "W",
    losses: "L",
    era: "ERA",
    inningsPitched: "IP",
    strikeOuts: "SO",
    baseOnBalls: "BB",
    whip: "WHIP",
  };

  // Advanced stats grid keys
  const advancedKeys = Object.keys(sabermetrics);
  const advancedLabels: Record<string, string> = {};
  for (const key of advancedKeys) {
    advancedLabels[key] = statLabels[key.toLowerCase()] ?? key;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Player Header */}
      <div
        className="rounded-2xl p-[2px] mb-8"
        style={{
          background: `linear-gradient(135deg, ${teamColor}, ${teamColor}44, transparent)`,
        }}
      >
        <div className="rounded-2xl bg-white p-6 md:p-8">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            {/* Silhouette Avatar */}
            <div
              className="relative w-28 h-28 md:w-32 md:h-32 rounded-full flex items-center justify-center shrink-0"
              style={{
                background: `linear-gradient(135deg, ${teamColor}50, ${teamColor}20)`,
                border: `3px solid ${teamColor}`,
              }}
            >
              {/* Silhouette SVG */}
              <svg
                viewBox="0 0 100 100"
                className="w-16 h-16 md:w-20 md:h-20"
                style={{ color: `${teamColor}88` }}
                fill="currentColor"
              >
                <circle cx="50" cy="35" r="18" />
                <ellipse cx="50" cy="80" rx="28" ry="22" />
              </svg>
              {player.primaryNumber && (
                <span
                  className="absolute -bottom-2 text-sm font-bold px-2 py-0.5 rounded-full bg-white border"
                  style={{ color: teamColor, borderColor: `${teamColor}60` }}
                >
                  #{player.primaryNumber}
                </span>
              )}
            </div>

            {/* Player Info */}
            <div className="text-center md:text-left flex-1">
              {nameKo && (
                <h1 className="text-3xl md:text-4xl font-extrabold text-slate-800 mb-1">
                  {nameKo}
                </h1>
              )}
              <p
                className={`${
                  nameKo
                    ? "text-lg text-slate-400"
                    : "text-3xl md:text-4xl font-extrabold text-slate-800"
                } mb-3`}
              >
                {player.fullName}
              </p>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm">
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-semibold"
                  style={{
                    backgroundColor: `${teamColor}20`,
                    color: teamColor,
                    border: `1px solid ${teamColor}40`,
                  }}
                >
                  {player.primaryPosition.name}
                </span>
                {formIndex && <FormBadge form={formIndex} size="md" />}
                {player.batSide && (
                  <span className="text-slate-400">
                    Bats: {player.batSide.code === "R" ? "Right" : player.batSide.code === "L" ? "Left" : "Switch"}
                  </span>
                )}
                {player.pitchHand && (
                  <span className="text-slate-400">
                    Throws: {player.pitchHand.code === "R" ? "Right" : "Left"}
                  </span>
                )}
                {player.currentAge && (
                  <span className="text-slate-400">
                    Age {player.currentAge}
                  </span>
                )}
              </div>
              {/* Team Badge */}
              {team && (
                <div className="mt-4">
                  <TeamBadge
                    name={team.name}
                    nameKo={team.nameKo}
                    colorPrimary={team.colorPrimary}
                    colorAccent={team.colorAccent}
                    teamId={team.id}
                    size="sm"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sabermetrics Radar */}
      {radarData.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span className="inline-block w-1 h-6 bg-blue-500 rounded-full" />
            Sabermetrics Analysis
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl bg-white border border-slate-200 p-4">
              <RadarChart
                data={radarData}
                color={teamColor}
                title="Performance vs League Average (100 = Avg)"
              />
            </div>
            <div className="rounded-xl bg-white border border-slate-200 p-6">
              <h3 className="text-sm font-semibold text-slate-600 mb-4">
                Key Metrics
              </h3>
              <StatsGrid
                stats={sabermetrics as Record<string, number | string>}
                keys={advancedKeys}
                labels={advancedLabels}
                columns={3}
                highlightKeys={advancedKeys}
              />
              <div className="mt-6 space-y-2 text-xs text-slate-500">
                {playerType === "hitting" ? (
                  <>
                    <p>wOBA: Weighted On-Base Average — overall offensive value per plate appearance</p>
                    <p>wRC+: Weighted Runs Created Plus — run production vs league avg (100)</p>
                    <p>ISO: Isolated Power — raw power (SLG minus AVG)</p>
                  </>
                ) : (
                  <>
                    <p>FIP: Fielding Independent Pitching — evaluates only pitcher-controlled outcomes</p>
                    <p>K%: Strikeout rate against opposing batters</p>
                    <p>BB%: Walk rate against opposing batters</p>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Year-by-Year Stats */}
      {yearByYearSplits.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span className="inline-block w-1 h-6 bg-blue-500 rounded-full" />
            Career Stats
          </h2>
          <div className="rounded-xl bg-white border border-slate-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  {ybyColumns.map((col) => (
                    <th
                      key={col}
                      className="px-3 py-3 text-left text-xs font-semibold text-slate-400 whitespace-nowrap"
                    >
                      {ybyLabels[col] ?? getStatLabel(col)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {yearByYearSplits.map((split, idx) => (
                  <tr
                    key={`${split.season}-${idx}`}
                    className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                  >
                    {ybyColumns.map((col) => (
                      <td
                        key={col}
                        className="px-3 py-2.5 text-slate-700 font-mono text-xs whitespace-nowrap"
                      >
                        {col === "season"
                          ? split.season ?? "-"
                          : split.stat[col] ?? "-"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Current Season Full Stats */}
      {seasonStat && (
        <section className="mb-8">
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span className="inline-block w-1 h-6 bg-blue-500 rounded-full" />
            {CURRENT_SEASON} Season Stats
          </h2>
          <div className="rounded-xl bg-white border border-slate-200 p-6">
            <StatsGrid
              stats={seasonStat as Record<string, number | string>}
              keys={
                playerType === "hitting"
                  ? [
                      "gamesPlayed",
                      "plateAppearances",
                      "atBats",
                      "hits",
                      "doubles",
                      "triples",
                      "homeRuns",
                      "rbi",
                      "runs",
                      "stolenBases",
                      "baseOnBalls",
                      "strikeOuts",
                      "avg",
                      "obp",
                      "slg",
                      "ops",
                    ]
                  : [
                      "gamesPlayed",
                      "gamesStarted",
                      "wins",
                      "losses",
                      "era",
                      "inningsPitched",
                      "strikeOuts",
                      "baseOnBalls",
                      "hits",
                      "homeRuns",
                      "whip",
                      "saves",
                    ]
              }
              labels={statLabels}
              columns={4}
            />
          </div>
        </section>
      )}

      {/* Ad */}
      <div className="mb-8">
        <AdBanner slot="inline" />
      </div>
    </div>
  );
}
