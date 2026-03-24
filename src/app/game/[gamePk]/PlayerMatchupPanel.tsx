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
    if (avg >= 0.3) return { label: "Strength", color: "text-green-600 bg-green-500/10" };
    if (avg < 0.2) return { label: "Weakness", color: "text-red-600 bg-red-500/10" };
    return null;
  }

  return (
    <>
      {/* Trigger button - inline clickable name */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="text-left hover:underline cursor-pointer transition-colors inline-flex items-center gap-1 group"
        title="View H2H stats"
      >
        {playerName}
        <svg className="w-3 h-3 text-slate-400 group-hover:text-blue-500 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
        </svg>
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
              {isPitcher ? "Pitcher" : "Batter"} - Career H2H Stats
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
            {isPitcher ? "Career Stats vs Opposing Batters" : "Career Stats vs Opposing Pitchers"}
          </h3>

          {/* Table */}
          <div className="rounded-xl bg-slate-50 border border-slate-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-3 py-2 text-left text-xs text-slate-500">
                    {isPitcher ? "Batter" : "Pitcher"}
                  </th>
                  <th className="px-2 py-2 text-center text-xs text-slate-500 w-10">
                    AB
                  </th>
                  <th className="px-2 py-2 text-center text-xs text-slate-500 w-12">
                    AVG
                  </th>
                  <th className="px-2 py-2 text-center text-xs text-slate-500 w-10">
                    H
                  </th>
                  <th className="px-2 py-2 text-center text-xs text-slate-500 w-10">
                    HR
                  </th>
                  <th className="px-2 py-2 text-center text-xs text-slate-500 w-10">
                    K
                  </th>
                  <th className="px-2 py-2 text-center text-xs text-slate-500 w-10">
                    BB
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
                          No record
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
              {/* Average summary */}
              {matchups.filter(m => !m.loading && m.stat && (m.stat.atBats ?? 0) > 0).length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-100">
                    <td className="px-3 py-2.5 text-xs font-bold text-slate-700">Total/AVG</td>
                    {(() => {
                      const valid = matchups.filter(m => !m.loading && m.stat && (m.stat.atBats ?? 0) > 0);
                      const totalAB = valid.reduce((s, m) => s + (m.stat!.atBats ?? 0), 0);
                      const totalH = valid.reduce((s, m) => s + (m.stat!.hits ?? 0), 0);
                      const totalHR = valid.reduce((s, m) => s + (m.stat!.homeRuns ?? 0), 0);
                      const totalK = valid.reduce((s, m) => s + (m.stat!.strikeOuts ?? 0), 0);
                      const totalBB = valid.reduce((s, m) => s + (m.stat!.baseOnBalls ?? 0), 0);
                      const avg = totalAB > 0 ? (totalH / totalAB).toFixed(3) : "-";
                      return (
                        <>
                          <td className="px-2 py-2.5 text-center text-xs font-mono font-bold text-slate-700">{totalAB}</td>
                          <td className={`px-2 py-2.5 text-center text-xs font-mono font-bold ${getAvgColor(avg)}`}>{avg}</td>
                          <td className="px-2 py-2.5 text-center text-xs font-mono font-bold text-slate-700">{totalH}</td>
                          <td className="px-2 py-2.5 text-center text-xs font-mono font-bold text-slate-700">{totalHR}</td>
                          <td className="px-2 py-2.5 text-center text-xs font-mono font-bold text-slate-700">{totalK}</td>
                          <td className="px-2 py-2.5 text-center text-xs font-mono font-bold text-slate-700">{totalBB}</td>
                        </>
                      );
                    })()}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Matchup analysis summary */}
          {matchups.some((m) => !m.loading && m.stat) && (
            <div className="mt-5">
              <h4 className="text-xs font-semibold text-slate-500 mb-3">
                Matchup Analysis
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
                          {isStrength ? "Strength" : "Weakness"}
                        </span>
                        <span className="text-slate-500 ml-2">
                          vs {m.opposingName}: {ab} AB, {m.stat!.hits ?? 0} H (
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
                    No significant H2H patterns found (11+ AB required).
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
