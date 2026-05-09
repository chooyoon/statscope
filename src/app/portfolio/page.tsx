"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { getUserPicks, calcPortfolioStats, type PortfolioPick, type PortfolioStats } from "@/lib/portfolio";
import { getTeamById } from "@/data/teams";

export default function PortfolioPage() {
  const { user, loading } = useAuth();
  const [picks, setPicks] = useState<PortfolioPick[]>([]);
  const [stats, setStats] = useState<PortfolioStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      setIsLoading(false);
      return;
    }

    loadPicks();
  }, [user, loading]);

  const loadPicks = async () => {
    if (!user) return;

    try {
      const userPicks = await getUserPicks(user.uid);
      setPicks(userPicks);
      const calculatedStats = calcPortfolioStats(userPicks);
      setStats(calculatedStats);
    } catch (error) {
      console.error("Failed to load picks:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 px-4 py-12">
        <div className="max-w-7xl mx-auto">
          <p className="text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 px-4 py-12">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
              My Portfolio
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              Sign in to track your picks and monitor your performance against StatScope's model.
            </p>
            <Link
              href="/"
              className="inline-block px-6 py-2 rounded-lg bg-blue-500 text-white font-semibold hover:bg-blue-600"
            >
              Sign in with Google
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 px-4 py-12">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            My Portfolio
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Track your picks and measure performance vs. the model
          </p>
        </div>

        {/* Stats Summary */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Record
              </p>
              <p className="text-3xl font-extrabold text-slate-900 dark:text-white">
                {stats.wins}-{stats.losses}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                {stats.pending} pending
              </p>
            </div>

            <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Win Rate
              </p>
              <p className="text-3xl font-extrabold text-slate-900 dark:text-white">
                {stats.totalPicks > 0 ? stats.winRate.toFixed(1) : "—"}%
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                of {stats.wins + stats.losses} picks
              </p>
            </div>

            <div className={`rounded-xl border border-slate-200 dark:border-slate-700 p-6 ${
              stats.roi >= 0
                ? "bg-emerald-50 dark:bg-emerald-950/20"
                : "bg-red-50 dark:bg-red-950/20"
            }`}>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                ROI
              </p>
              <p className={`text-3xl font-extrabold ${
                stats.roi >= 0
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-red-700 dark:text-red-400"
              }`}>
                {stats.roi.toFixed(2)}%
              </p>
              <p className={`text-xs mt-2 ${
                stats.roi >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              }`}>
                {stats.roi >= 0 ? "+" : ""}{stats.unitsProfit.toFixed(2)} units
              </p>
            </div>

            <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Total Picks
              </p>
              <p className="text-3xl font-extrabold text-slate-900 dark:text-white">
                {stats.totalPicks}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                tracked
              </p>
            </div>
          </div>
        )}

        {/* Picks Log */}
        {picks.length === 0 ? (
          <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-12 text-center">
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              No picks tracked yet. Start by tracking today's picks!
            </p>
            <Link
              href="/"
              className="inline-block text-sm text-blue-600 dark:text-blue-400 hover:underline font-semibold"
            >
              Go to Today's Picks →
            </Link>
          </div>
        ) : (
          <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">
                      Matchup
                    </th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-700 dark:text-slate-300">
                      Model %
                    </th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-700 dark:text-slate-300">
                      Side
                    </th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-700 dark:text-slate-300">
                      Result
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">
                      P&L
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {picks.map((pick, idx) => {
                    const mlNum = parseInt(pick.ml, 10);
                    let pnl = 0;

                    if (pick.result === "W") {
                      if (mlNum < 0) {
                        pnl = (100 / Math.abs(mlNum)) * pick.stakeUnits;
                      } else {
                        pnl = (mlNum / 100) * pick.stakeUnits;
                      }
                    } else if (pick.result === "L") {
                      pnl = -pick.stakeUnits;
                    }

                    const resultBadge =
                      pick.result === "W" ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                          W
                        </span>
                      ) : pick.result === "L" ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-bold">
                          L
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 text-xs font-bold">
                          —
                        </span>
                      );

                    return (
                      <tr key={idx} className="border-t border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                          {pick.date}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-slate-900 dark:text-white font-medium">
                            {pick.fav}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            vs {pick.away === pick.fav ? pick.home : pick.away}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-slate-700 dark:text-slate-300">
                          {pick.prob.toFixed(1)}%
                        </td>
                        <td className="px-4 py-3 text-center text-slate-700 dark:text-slate-300">
                          {pick.ml}
                        </td>
                        <td className="px-4 py-3 text-center">{resultBadge}</td>
                        <td className={`px-4 py-3 text-right font-semibold ${
                          pnl > 0
                            ? "text-emerald-700 dark:text-emerald-400"
                            : pnl < 0
                            ? "text-red-700 dark:text-red-400"
                            : "text-slate-700 dark:text-slate-300"
                        }`}>
                          {pnl > 0 ? "+" : ""}{pnl.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
