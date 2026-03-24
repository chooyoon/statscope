/**
 * 선수 폼 지수 (Hot/Cold Index)
 *
 * 최근 경기 성적 기반으로 선수의 현재 컨디션을 점수화.
 * 100 = 리그 평균, 150+ = 극호조, 50- = 극부진
 */

interface GameLogStat {
  gamesPlayed?: number;
  atBats?: number;
  hits?: number;
  homeRuns?: number;
  rbi?: number;
  baseOnBalls?: number;
  strikeOuts?: number;
  avg?: string;
  ops?: string;
  // Pitching
  era?: string;
  inningsPitched?: string;
  wins?: number;
  losses?: number;
  earnedRuns?: number;
}

export interface FormIndex {
  score: number; // 0-200 scale, 100 = average
  trend: "hot" | "warm" | "neutral" | "cold" | "freezing";
  label: string;
  color: string;
}

export function calcHittingForm(stat: GameLogStat): FormIndex {
  const ops = parseFloat(stat.ops ?? "0") || 0;
  const avg = parseFloat(stat.avg ?? "0") || 0;
  const ab = stat.atBats ?? 0;

  if (ab < 5) {
    return { score: 100, trend: "neutral", label: "데이터 부족", color: "#94a3b8" };
  }

  // OPS-based scoring (league avg OPS ~.720)
  const opsScore = (ops / 0.720) * 100;
  // AVG bonus
  const avgBonus = avg >= 0.300 ? 15 : avg >= 0.250 ? 5 : avg < 0.150 ? -15 : 0;
  // HR/RBI bonus per AB
  const hrRate = ab > 0 ? ((stat.homeRuns ?? 0) / ab) * 100 : 0;
  const powerBonus = hrRate >= 5 ? 15 : hrRate >= 3 ? 8 : 0;

  const score = Math.round(Math.max(0, Math.min(200, opsScore + avgBonus + powerBonus)));

  return {
    score,
    ...getFormMeta(score),
  };
}

export function calcPitchingForm(stat: GameLogStat): FormIndex {
  const era = parseFloat(stat.era ?? "0") || 0;
  const ip = parseFloat(stat.inningsPitched ?? "0") || 0;

  if (ip < 3) {
    return { score: 100, trend: "neutral", label: "데이터 부족", color: "#94a3b8" };
  }

  // ERA-based scoring (league avg ERA ~4.00, inverted)
  const eraScore = era > 0 ? (4.0 / era) * 100 : 100;
  // Workload bonus (deeper into games = better)
  const ipBonus = ip >= 6 ? 10 : ip >= 5 ? 5 : 0;

  const score = Math.round(Math.max(0, Math.min(200, eraScore + ipBonus)));

  return {
    score,
    ...getFormMeta(score),
  };
}

function getFormMeta(score: number): { trend: FormIndex["trend"]; label: string; color: string } {
  if (score >= 140) return { trend: "hot", label: "극호조", color: "#dc2626" };
  if (score >= 115) return { trend: "warm", label: "호조", color: "#f97316" };
  if (score >= 85) return { trend: "neutral", label: "보통", color: "#6b7280" };
  if (score >= 60) return { trend: "cold", label: "부진", color: "#3b82f6" };
  return { trend: "freezing", label: "극부진", color: "#1e40af" };
}
