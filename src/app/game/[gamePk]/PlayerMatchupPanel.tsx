"use client";

import { useState, useEffect, useCallback } from "react";

interface OpposingPlayer {
  id: number;
  name: string;
}

interface MatchupStat {
  atBats?: number;
  avg?: string;
  hits?: number;
  homeRuns?: number;
  strikeOuts?: number;
  baseOnBalls?: number;
  [key: string]: unknown;
}

interface MatchupResult {
  opposingId: number;
  opposingName: string;
  stat: MatchupStat | null;
  loading: boolean;
  error: boolean;
}

interface PlayerMatchupPanelProps {
  playerId: number;
  playerName: string;
  isPitcher: boolean;
  opposingPlayers: OpposingPlayer[];
  teamColor: string;
}

export default function PlayerMatchupPanel({
  playerId,
  playerName,
  isPitcher,
  opposingPlayers,
  teamColor,
}: PlayerMatchupPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [matchups, setMatchups] = useState<MatchupResult[]>([]);

  const fetchMatchups = useCallback(async () => {
    const group = isPitcher ? "pitching" : "hitting";
    const initial: MatchupResult[] = opposingPlayers.map((op) => ({
      opposingId: op.id,
      opposingName: op.name,
      stat: null,
      loading: true,
      error: false,
    }));
    setMatchups(initial);

    const results = await Promise.allSettled(
      opposingPlayers.map(async (op) => {
        const res = await fetch(
          `/api/matchup?playerId=${playerId}&opposingId=${op.id}&group=${group}`
        );
        if (!res.ok) throw new Error("fetch failed");
        const data = await res.json();
        return { opposingId: op.id, stat: data.stat as MatchupStat | null };
      })
    );

    setMatchups((prev) =>
      prev.map((m, i) => {
        const result = results[i];
        if (result.status === "fulfilled") {
          return {
            ...m,
            stat: result.value.stat,
            loading: false,
            error: false,
          };
        }
        return { ...m, loading: false, error: true };
      })
    );
  }, [playerId, opposingPlayers, isPitcher]);

  useEffect(() => {
    if (isOpen) {
      fetchMatchups();
    }
  }, [isOpen, fetchMatchups]);

  function getAvgColor(avg: string | undefined): string {
    if (!avg) return "text-slate-500";
    const val = parseFloat(avg);
    if (isNaN(val)) return "text-slate-500";
    if (val >= 0.3) return "text-green-600";
    if (val >= 0.25) return "text-slate-700";
    if (val < 0.2) return "text-red-600";
    return "text-slate-600";
  }

  function getVerdict(
    stat: MatchupStat | null
  ): { label: string; color: string } | null {
    if (!stat) return null;
    const ab = stat.atBats ?? 0;
    if (ab <= 10) return null;
    const avg = parseFloat(stat.avg ?? "0");
    if (isNaN(avg)) return null;
    if (avg >= 0.3) return { label: "강점", color: "text-green-600 bg-green-500/10" };
    if (avg < 0.2) return { label: "약점", color: "text-red-600 bg-red-500/10" };
    return null;
  }

  return (
    <>
      {/* Trigger button - inline clickable name */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="text-left hover:underline cursor-pointer transition-colors"
        title="상대 전적 보기"
      >
        {playerName}
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Slide-out panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-[400px] bg-white border-l border-slate-200 z-50 transform transition-transform duration-300 ease-in-out overflow-y-auto ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Team color accent top border */}
        <div className="h-1" style={{ backgroundColor: teamColor }} />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-bold text-slate-800">{playerName}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isPitcher ? "투수" : "타자"} - 통산 상대 전적
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M1 1l12 12M13 1L1 13" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          <h3 className="text-sm font-semibold text-slate-500 mb-4 flex items-center gap-2">
            <span
              className="inline-block w-1 h-4 rounded-full"
              style={{ backgroundColor: teamColor }}
            />
            {isPitcher ? "상대 타자별 통산 기록" : "상대 투수별 통산 기록"}
          </h3>

          {/* Table */}
          <div className="rounded-xl bg-slate-50 border border-slate-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-3 py-2 text-left text-xs text-slate-500">
                    {isPitcher ? "타자" : "투수"}
                  </th>
                  <th className="px-2 py-2 text-center text-xs text-slate-500 w-10">
                    타수
                  </th>
                  <th className="px-2 py-2 text-center text-xs text-slate-500 w-12">
                    타율
                  </th>
                  <th className="px-2 py-2 text-center text-xs text-slate-500 w-10">
                    안타
                  </th>
                  <th className="px-2 py-2 text-center text-xs text-slate-500 w-10">
                    홈런
                  </th>
                  <th className="px-2 py-2 text-center text-xs text-slate-500 w-10">
                    삼진
                  </th>
                  <th className="px-2 py-2 text-center text-xs text-slate-500 w-10">
                    볼넷
                  </th>
                </tr>
              </thead>
              <tbody>
                {matchups.map((m) => {
                  const verdict = getVerdict(m.stat);
                  return (
                    <tr
                      key={m.opposingId}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-slate-600 truncate max-w-[120px]">
                            {m.opposingName}
                          </span>
                          {verdict && (
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${verdict.color}`}
                            >
                              {verdict.label}
                            </span>
                          )}
                        </div>
                      </td>
                      {m.loading ? (
                        <td colSpan={6} className="px-2 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <div
                              className="w-1 h-1 rounded-full bg-slate-500 animate-pulse"
                              style={{ animationDelay: "0ms" }}
                            />
                            <div
                              className="w-1 h-1 rounded-full bg-slate-500 animate-pulse"
                              style={{ animationDelay: "150ms" }}
                            />
                            <div
                              className="w-1 h-1 rounded-full bg-slate-500 animate-pulse"
                              style={{ animationDelay: "300ms" }}
                            />
                          </div>
                        </td>
                      ) : m.error ? (
                        <td
                          colSpan={6}
                          className="px-2 py-2.5 text-center text-xs text-slate-600"
                        >
                          -
                        </td>
                      ) : !m.stat ? (
                        <td
                          colSpan={6}
                          className="px-2 py-2.5 text-center text-xs text-slate-600"
                        >
                          기록 없음
                        </td>
                      ) : (
                        <>
                          <td className="px-2 py-2.5 text-center text-xs font-mono text-slate-500">
                            {m.stat.atBats ?? "-"}
                          </td>
                          <td
                            className={`px-2 py-2.5 text-center text-xs font-mono font-bold ${getAvgColor(
                              m.stat.avg
                            )}`}
                          >
                            {m.stat.avg ?? "-"}
                          </td>
                          <td className="px-2 py-2.5 text-center text-xs font-mono text-slate-500">
                            {m.stat.hits ?? "-"}
                          </td>
                          <td
                            className={`px-2 py-2.5 text-center text-xs font-mono ${
                              (m.stat.homeRuns ?? 0) > 0
                                ? "text-red-600 font-bold"
                                : "text-slate-500"
                            }`}
                          >
                            {m.stat.homeRuns ?? "-"}
                          </td>
                          <td className="px-2 py-2.5 text-center text-xs font-mono text-slate-500">
                            {m.stat.strikeOuts ?? "-"}
                          </td>
                          <td className="px-2 py-2.5 text-center text-xs font-mono text-slate-500">
                            {m.stat.baseOnBalls ?? "-"}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Matchup analysis summary */}
          {matchups.some((m) => !m.loading && m.stat) && (
            <div className="mt-5">
              <h4 className="text-xs font-semibold text-slate-500 mb-3">
                상성 분석
              </h4>
              <div className="space-y-2">
                {matchups
                  .filter((m) => {
                    if (!m.stat || m.loading) return false;
                    const ab = m.stat.atBats ?? 0;
                    return ab > 10;
                  })
                  .map((m) => {
                    const avg = parseFloat(m.stat!.avg ?? "0");
                    const ab = m.stat!.atBats ?? 0;
                    const isStrength = avg >= 0.3;
                    const isWeakness = avg < 0.2;
                    if (!isStrength && !isWeakness) return null;

                    return (
                      <div
                        key={`verdict-${m.opposingId}`}
                        className={`rounded-lg px-3 py-2.5 text-xs ${
                          isStrength
                            ? "bg-green-500/10 border border-green-500/20"
                            : "bg-red-500/10 border border-red-500/20"
                        }`}
                      >
                        <span
                          className={`font-bold ${
                            isStrength ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {isStrength ? "강점" : "약점"}
                        </span>
                        <span className="text-slate-500 ml-2">
                          vs {m.opposingName}: {ab}타수 {m.stat!.hits ?? 0}안타 (
                          {m.stat!.avg})
                        </span>
                      </div>
                    );
                  })
                  .filter(Boolean)}
                {matchups.filter((m) => {
                  if (!m.stat || m.loading) return false;
                  const ab = m.stat.atBats ?? 0;
                  if (ab <= 10) return false;
                  const avg = parseFloat(m.stat.avg ?? "0");
                  return avg >= 0.3 || avg < 0.2;
                }).length === 0 && (
                  <p className="text-xs text-slate-600">
                    충분한 상대 기록(11타수 이상)이 있는 뚜렷한 강점/약점이
                    없습니다.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
