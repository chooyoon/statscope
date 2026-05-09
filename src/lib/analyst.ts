import { type PortfolioPick } from "@/lib/portfolio";

export interface AnalystBadge {
  level: "bronze" | "silver" | "gold" | "platinum";
  name: string;
  color: string;
  bgColor: string;
  emoji: string;
  minPicks: number;
  minWinRate: number;
}

const ANALYST_BADGES: Record<string, AnalystBadge> = {
  bronze: {
    level: "bronze",
    name: "Rising Analyst",
    color: "text-amber-700 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-900/20",
    emoji: "📈",
    minPicks: 10,
    minWinRate: 52,
  },
  silver: {
    level: "silver",
    name: "Solid Analyst",
    color: "text-slate-600 dark:text-slate-300",
    bgColor: "bg-slate-100 dark:bg-slate-700/30",
    emoji: "⭐",
    minPicks: 25,
    minWinRate: 55,
  },
  gold: {
    level: "gold",
    name: "Expert Analyst",
    color: "text-yellow-700 dark:text-yellow-400",
    bgColor: "bg-yellow-50 dark:bg-yellow-900/20",
    emoji: "🏆",
    minPicks: 50,
    minWinRate: 58,
  },
  platinum: {
    level: "platinum",
    name: "Master Analyst",
    color: "text-purple-700 dark:text-purple-400",
    bgColor: "bg-purple-50 dark:bg-purple-900/20",
    emoji: "👑",
    minPicks: 100,
    minWinRate: 60,
  },
};

export function calculateAnalystBadge(
  picks: PortfolioPick[]
): AnalystBadge | null {
  if (picks.length === 0) return null;

  const wins = picks.filter((p) => p.result === "W").length;
  const losses = picks.filter((p) => p.result === "L").length;
  const completed = wins + losses;

  if (completed === 0) return null;

  const winRate = (wins / completed) * 100;

  // Check badges in descending order of difficulty
  for (const badge of [
    ANALYST_BADGES.platinum,
    ANALYST_BADGES.gold,
    ANALYST_BADGES.silver,
    ANALYST_BADGES.bronze,
  ]) {
    if (picks.length >= badge.minPicks && winRate >= badge.minWinRate) {
      return badge;
    }
  }

  return null;
}

export function getAnalystBadgeClass(badge: AnalystBadge | null): string {
  if (!badge) return "";
  return `${badge.color} ${badge.bgColor}`;
}
