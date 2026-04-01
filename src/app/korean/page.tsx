import type { Metadata } from "next";
import Link from "next/link";
import { fetchPlayerStats, type MLBPlayer } from "@/lib/sports/mlb/api";
import { playerNamesKo, displayNameFull } from "@/data/players";
import { getTeamById } from "@/data/teams";
import { calcHittingForm, calcPitchingForm, type FormIndex } from "@/lib/sports/mlb/form";
import FormBadge from "@/components/player/FormBadge";
import TeamBadge from "@/components/ui/TeamBadge";

export const metadata: Metadata = {
  title: "코리안 메이저리거 | StatScope",
  description:
    "MLB에서 뛰고 있는 한국인 선수들의 실시간 성적과 폼 지수를 확인하세요.",
};

const CURRENT_SEASON = new Date().getFullYear();

// Korean players currently in MLB (update as needed)
const KOREAN_PLAYERS: { id: number; type: "hitting" | "pitching" }[] = [
  { id: 808982, type: "hitting" },   // 이정후 (SF Giants)
  { id: 673490, type: "hitting" },   // 김하성 (SD Padres)
];

interface KoreanPlayerData {
  player: MLBPlayer;
  nameKo: string;
  stats: Record<string, any> | null;
  form: FormIndex;
  teamColor: string;
  type: "hitting" | "pitching";
}

async function getKoreanPlayers(): Promise<KoreanPlayerData[]> {
  const results = await Promise.allSettled(
    KOREAN_PLAYERS.map(async ({ id, type }) => {
      const data = await fetchPlayerStats(id, CURRENT_SEASON, type);
      const player = data.people?.[0];
      if (!player) return null;

      const stat = player.stats?.[0]?.splits?.[0]?.stat;
      const team = player.currentTeam ? getTeamById(player.currentTeam.id) : undefined;
      const form = stat
        ? type === "hitting"
          ? calcHittingForm(stat as any)
          : calcPitchingForm(stat as any)
        : { score: 100, trend: "neutral" as const, label: "시즌 전", color: "#94a3b8" };

      return {
        player,
        nameKo: playerNamesKo[player.id] ?? player.fullName,
        stats: stat ?? null,
        form,
        teamColor: team?.colorPrimary ?? "#6366f1",
        type,
      } satisfies KoreanPlayerData;
    })
  );

  return results
    .filter((r) => r.status === "fulfilled")
    .map((r) => (r as PromiseFulfilledResult<KoreanPlayerData | null>).value)
    .filter((v): v is KoreanPlayerData => v !== null);
}

function num(val: unknown): number {
  if (typeof val === "number") return val;
  if (typeof val === "string") return parseFloat(val) || 0;
  return 0;
}

export default async function KoreanPlayersPage() {
  const players = await getKoreanPlayers();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Hero */}
      <div className="mb-10 text-center">
        <h1 className="text-3xl md:text-4xl font-extrabold text-slate-800 mb-3">
          코리안 메이저리거
        </h1>
        <p className="text-slate-500 max-w-2xl mx-auto">
          MLB에서 활약 중인 한국인 선수들의 시즌 성적과 실시간 폼 지수를
          확인하세요.
        </p>
      </div>

      {/* Player Cards */}
      {players.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-200 p-16 text-center">
          <p className="text-slate-400 text-lg">시즌 데이터를 불러올 수 없습니다.</p>
          <p className="text-slate-500 text-sm mt-2">시즌이 시작되면 선수 성적이 표시됩니다.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {players.map((p) => {
            const isHitting = p.type === "hitting";
            const stat = p.stats;

            return (
              <Link
                key={p.player.id}
                href={`/players/${p.player.id}`}
                className="block group"
              >
                <div
                  className="rounded-2xl p-[2px] transition-transform duration-200 group-hover:scale-[1.005]"
                  style={{
                    background: `linear-gradient(135deg, ${p.teamColor}, ${p.teamColor}44, transparent)`,
                  }}
                >
                  <div className="rounded-2xl bg-white p-6">
                    <div className="flex flex-col md:flex-row md:items-center gap-6">
                      {/* Avatar + Info */}
                      <div className="flex items-center gap-4 flex-1">
                        <div
                          className="w-20 h-20 rounded-full flex items-center justify-center shrink-0 relative"
                          style={{
                            background: `linear-gradient(135deg, ${p.teamColor}50, ${p.teamColor}20)`,
                            border: `3px solid ${p.teamColor}`,
                          }}
                        >
                          <svg
                            viewBox="0 0 100 100"
                            className="w-12 h-12"
                            style={{ color: `${p.teamColor}88` }}
                            fill="currentColor"
                          >
                            <circle cx="50" cy="35" r="18" />
                            <ellipse cx="50" cy="80" rx="28" ry="22" />
                          </svg>
                          {p.player.primaryNumber && (
                            <span
                              className="absolute -bottom-2 text-xs font-bold px-2 py-0.5 rounded-full bg-white border"
                              style={{ color: p.teamColor, borderColor: `${p.teamColor}60` }}
                            >
                              #{p.player.primaryNumber}
                            </span>
                          )}
                        </div>
                        <div>
                          <h2 className="text-xl font-extrabold text-slate-800">
                            {p.nameKo}
                          </h2>
                          <p className="text-sm text-slate-400">{p.player.fullName}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <span
                              className="text-xs font-semibold px-2 py-0.5 rounded-full"
                              style={{
                                backgroundColor: `${p.teamColor}15`,
                                color: p.teamColor,
                                border: `1px solid ${p.teamColor}30`,
                              }}
                            >
                              {p.player.primaryPosition.name}
                            </span>
                            <FormBadge form={p.form} size="md" />
                          </div>
                        </div>
                      </div>

                      {/* Stats Grid */}
                      {stat && (
                        <div className={`grid ${isHitting ? "grid-cols-5" : "grid-cols-4"} gap-3`}>
                          {isHitting ? (
                            <>
                              <StatCell label="타율" value={stat.avg ?? "-"} color={p.teamColor} />
                              <StatCell label="OPS" value={stat.ops ?? "-"} color={p.teamColor} />
                              <StatCell label="홈런" value={stat.homeRuns ?? 0} color={p.teamColor} />
                              <StatCell label="타점" value={stat.rbi ?? 0} color={p.teamColor} />
                              <StatCell label="안타" value={stat.hits ?? 0} color={p.teamColor} />
                            </>
                          ) : (
                            <>
                              <StatCell label="ERA" value={stat.era ?? "-"} color={p.teamColor} />
                              <StatCell label="승-패" value={`${stat.wins ?? 0}-${stat.losses ?? 0}`} color={p.teamColor} />
                              <StatCell label="이닝" value={stat.inningsPitched ?? "-"} color={p.teamColor} />
                              <StatCell label="삼진" value={stat.strikeOuts ?? 0} color={p.teamColor} />
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

    </div>
  );
}

function StatCell({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="text-center rounded-xl bg-slate-50 border border-slate-200 px-3 py-3">
      <p className="text-[10px] text-slate-500 mb-0.5">{label}</p>
      <p className="text-lg font-bold font-mono" style={{ color }}>
        {value}
      </p>
    </div>
  );
}
