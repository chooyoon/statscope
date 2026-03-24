/**
 * StatScope 독자 승률 예측 모델
 *
 * 팩터:
 * 1. 선발 투수 ERA (낮을수록 유리)
 * 2. 선발 투수 WHIP (낮을수록 유리)
 * 3. 팀 최근 10경기 승률
 * 4. 홈/원정 보정 (홈팀 +3.5% 보정)
 * 5. 선발 투수 시즌 K/BB ratio
 */

interface PredictionInput {
  homePitcherERA: number;
  homePitcherWHIP: number;
  homePitcherK: number;
  homePitcherBB: number;
  awayPitcherERA: number;
  awayPitcherWHIP: number;
  awayPitcherK: number;
  awayPitcherBB: number;
  homeRecentWinPct: number; // 0-1 scale
  awayRecentWinPct: number; // 0-1 scale
}

export interface PredictionResult {
  homeWinPct: number; // 0-100
  awayWinPct: number; // 0-100
  confidence: "high" | "medium" | "low";
  factors: PredictionFactor[];
}

export interface PredictionFactor {
  label: string;
  homeValue: string;
  awayValue: string;
  advantage: "home" | "away" | "even";
}

const HOME_ADVANTAGE = 0.035; // 3.5% home field advantage

function pitcherScore(era: number, whip: number, k: number, bb: number): number {
  // Lower ERA/WHIP = better, higher K/BB = better
  // Normalize each factor to roughly 0-1 scale
  const eraScore = Math.max(0, 1 - (era - 2.0) / 6.0); // ERA 2.0 = 1.0, ERA 8.0 = 0.0
  const whipScore = Math.max(0, 1 - (whip - 0.8) / 1.4); // WHIP 0.8 = 1.0, WHIP 2.2 = 0.0
  const kbbRatio = bb > 0 ? k / bb : k > 0 ? 5 : 1;
  const kbbScore = Math.min(1, kbbRatio / 5); // K/BB 5+ = 1.0

  return eraScore * 0.4 + whipScore * 0.3 + kbbScore * 0.3;
}

export function predictWinProbability(input: PredictionInput): PredictionResult {
  const homePitScore = pitcherScore(
    input.homePitcherERA,
    input.homePitcherWHIP,
    input.homePitcherK,
    input.homePitcherBB
  );
  const awayPitScore = pitcherScore(
    input.awayPitcherERA,
    input.awayPitcherWHIP,
    input.awayPitcherK,
    input.awayPitcherBB
  );

  // Weighted composite
  const pitcherWeight = 0.45;
  const recentFormWeight = 0.20;
  const baseWeight = 0.35; // baseline 50/50 + home advantage

  const homeRaw =
    homePitScore * pitcherWeight +
    input.homeRecentWinPct * recentFormWeight +
    (0.5 + HOME_ADVANTAGE) * baseWeight;

  const awayRaw =
    awayPitScore * pitcherWeight +
    input.awayRecentWinPct * recentFormWeight +
    0.5 * baseWeight;

  // Normalize to percentages
  const total = homeRaw + awayRaw;
  let homeWinPct = total > 0 ? (homeRaw / total) * 100 : 50;
  let awayWinPct = total > 0 ? (awayRaw / total) * 100 : 50;

  // Clamp to 25-75 range (avoid extreme predictions)
  homeWinPct = Math.max(25, Math.min(75, homeWinPct));
  awayWinPct = 100 - homeWinPct;

  // Confidence based on data quality and difference
  const diff = Math.abs(homeWinPct - awayWinPct);
  let confidence: "high" | "medium" | "low" = "medium";
  if (diff >= 15 && input.homePitcherERA > 0 && input.awayPitcherERA > 0) {
    confidence = "high";
  } else if (diff < 5 || input.homePitcherERA === 0 || input.awayPitcherERA === 0) {
    confidence = "low";
  }

  // Build factors
  const factors: PredictionFactor[] = [
    {
      label: "선발 ERA",
      homeValue: input.homePitcherERA > 0 ? input.homePitcherERA.toFixed(2) : "-",
      awayValue: input.awayPitcherERA > 0 ? input.awayPitcherERA.toFixed(2) : "-",
      advantage:
        input.homePitcherERA === 0 || input.awayPitcherERA === 0
          ? "even"
          : input.homePitcherERA < input.awayPitcherERA
          ? "home"
          : input.homePitcherERA > input.awayPitcherERA
          ? "away"
          : "even",
    },
    {
      label: "선발 WHIP",
      homeValue: input.homePitcherWHIP > 0 ? input.homePitcherWHIP.toFixed(2) : "-",
      awayValue: input.awayPitcherWHIP > 0 ? input.awayPitcherWHIP.toFixed(2) : "-",
      advantage:
        input.homePitcherWHIP === 0 || input.awayPitcherWHIP === 0
          ? "even"
          : input.homePitcherWHIP < input.awayPitcherWHIP
          ? "home"
          : input.homePitcherWHIP > input.awayPitcherWHIP
          ? "away"
          : "even",
    },
    {
      label: "최근 승률",
      homeValue: `${(input.homeRecentWinPct * 100).toFixed(0)}%`,
      awayValue: `${(input.awayRecentWinPct * 100).toFixed(0)}%`,
      advantage:
        input.homeRecentWinPct > input.awayRecentWinPct
          ? "home"
          : input.homeRecentWinPct < input.awayRecentWinPct
          ? "away"
          : "even",
    },
    {
      label: "홈 어드밴티지",
      homeValue: "+3.5%",
      awayValue: "-",
      advantage: "home",
    },
  ];

  return {
    homeWinPct: Math.round(homeWinPct * 10) / 10,
    awayWinPct: Math.round(awayWinPct * 10) / 10,
    confidence,
    factors,
  };
}
