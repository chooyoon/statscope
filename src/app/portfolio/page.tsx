"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LangContext";
import { getUserPicks, calcPortfolioStats, type PortfolioPick, type PortfolioStats } from "@/lib/portfolio";
import { getTeamById } from "@/data/teams";

export default function PortfolioPage() {
  const { user, loading } = useAuth();
  const { t } = useLang();
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
          <p className="text-slate-500">{t("Loading...", "로딩 중...")}</p>
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
              {t("My Portfolio", "내 포트폴리오")}
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              {t("Sign in to track your picks and monitor your performance against StatScope's model.", "로그인하여 픽을 추적하고 StatScope의 모델에 대한 성능을 모니터링하세요.")}
            </p>
            <Link
              href="/"
              className="inline-block px-6 py-2 rounded-lg bg-blue-500 text-white font-semibold hover:bg-blue-600"
            >
              {t("Sign in with Google", "Google로 로그인")}
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
            {t("My Portfolio", "내 포트폴리오")}
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            {t("Track your picks and measure performance vs. the model", "픽을 추적하고 모델 대비 성능을 측정하세요")}
          </p>
        </div>

        {/* Stats Summary */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                {t("Record", "기록")}
              </p>
              <p className="text-3xl font-extrabold text-slate-900 dark:text-white">
                {stats.wins}-{stats.losses}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                {stats.pending} {t("pending", "대기 중")}
              </p>
            </div>

            <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                {t("Win Rate", "승률")}
              </p>
              <p className="text-3xl font-extrabold text-slate-900 dark:text-white">
                {stats.totalPicks > 0 ? stats.winRate.toFixed(1) : "—"}%
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                {t(`of ${stats.wins + stats.losses} picks`, `${stats.wins + stats.losses}개 픽 중`)}
              </p>
            </div>

            <div className={`rounded-xl border border-slate-200 dark:border-slate-700 p-6 ${
              stats.roi >= 0
                ? "bg-emerald-50 dark:bg-emerald-950/20"
                : "bg-red-50 dark:bg-red-950/20"
            }`}>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                {t("ROI", "ROI")}
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
                {stats.roi >= 0 ? "+" : ""}{stats.unitsProfit.toFixed(2)} {t("units", "단위")}
              </p>
            </div>

            <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                {t("Total Picks", "전체 픽")}
              </p>
              <p className="text-3xl font-extrabold text-slate-900 dark:text-white">
                {stats.totalPicks}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                {t("tracked", "추적 중")}
              </p>
            </div>
          </div>
        )}

        {/* Picks Log */}
        {picks.length === 0 ? (
          <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-12 text-center">
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              {t("No picks tracked yet. Start by tracking today's picks!", "아직 추적된 픽이 없습니다. 오늘의 픽을 추적하여 시작하세요!")}
            </p>
            <Link
              href="/"
              className="inline-block text-sm text-blue-600 dark:text-blue-400 hover:underline font-semibold"
            >
              {t("Go to Today's Picks →", "오늘의 픽으로 가기 →")}
            </Link>
          </div>
        ) : (
          <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">
                      {t("Date", "날짜")}
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">
                      {t("Matchup", "대전")}
                    </th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-700 dark:text-slate-300">
                      {t("Model %", "모델 %")}
                    </th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-700 dark:text-slate-300">
                      {t("Side", "선택")}
                    </th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-700 dark:text-slate-300">
                      {t("Result", "결과")}
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">
                      {t("P&L", "손익")}
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
                            {t("vs", "vs")} {pick.away === pick.fav ? pick.home : pick.away}
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
