"use client";

import { useEffect, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { getFirebaseDb, isFirebaseConfigured } from "@/lib/firebase";
import { type PortfolioPick } from "@/lib/portfolio";
import { getTeamById } from "@/data/teams";

interface PickSummary {
  uid: string;
  author: string;
  photoURL: string | null;
  picks: PortfolioPick[];
  totalPicks: number;
  wins: number;
  losses: number;
  pending: number;
  pnl: number;
  roi: number;
}

export default function GamePicksLeaderboard({
  homeId,
  awayId,
  date,
}: {
  homeId: number;
  awayId: number;
  date: string;
}) {
  const [leaderboard, setLeaderboard] = useState<PickSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setIsLoading(false);
      return;
    }

    const loadLeaderboard = async () => {
      try {
        const db = getFirebaseDb();
        if (!db) {
          setIsLoading(false);
          return;
        }

        // Query all users' picks for this specific matchup
        // This is a cross-collection query that needs to check all userPicks
        // For now, we'll use a simplified approach by fetching from a shared collection
        // In production, you might want to maintain a denormalized gamePickss collection

        // Placeholder: In a real implementation, you'd have an optimized query
        // For now, showing the structure without cross-collection queries
        setLeaderboard([]);
      } catch (error) {
        console.error("Failed to load picks leaderboard:", error);
        setLeaderboard([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadLeaderboard();
  }, [homeId, awayId, date]);

  if (!isFirebaseConfigured) {
    return null;
  }

  return (
    <section className="rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-4 shadow">
      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2 uppercase tracking-wide">
        <span>🏆</span> Picks on This Game
      </h2>

      {isLoading ? (
        <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-4">
          Loading picks...
        </p>
      ) : leaderboard.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-4">
          No picks tracked for this matchup yet.
        </p>
      ) : (
        <div className="space-y-2">
          {leaderboard
            .sort((a, b) => b.pnl - a.pnl)
            .slice(0, 5)
            .map((summary, idx) => (
              <div
                key={summary.uid}
                className="flex items-center gap-2 p-2 rounded-md bg-slate-50 dark:bg-slate-700/40 text-xs"
              >
                <span className="font-bold text-slate-400 w-5">{idx + 1}</span>

                {/* Avatar */}
                {summary.photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={summary.photoURL}
                    alt={summary.author}
                    className="w-5 h-5 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-blue-500 flex-shrink-0" />
                )}

                {/* Author */}
                <span className="font-medium text-slate-700 dark:text-slate-200 flex-shrink-0">
                  {summary.author}
                </span>

                {/* Record */}
                <span className="text-slate-500 dark:text-slate-400 flex-shrink-0">
                  {summary.wins}-{summary.losses}
                </span>

                {/* P&L */}
                <span
                  className={`ml-auto font-semibold flex-shrink-0 ${
                    summary.pnl > 0
                      ? "text-emerald-700 dark:text-emerald-400"
                      : summary.pnl < 0
                      ? "text-red-700 dark:text-red-400"
                      : "text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {summary.pnl > 0 ? "+" : ""}
                  {summary.pnl.toFixed(2)}
                </span>
              </div>
            ))}
        </div>
      )}
    </section>
  );
}
