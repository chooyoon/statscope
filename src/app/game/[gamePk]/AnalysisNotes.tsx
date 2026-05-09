import type { BoxscoreResponse, LinescoreResponse } from "@/lib/sports/mlb/api";
import { getTeamById } from "@/data/teams";
import { displayName } from "@/data/players";
import { isKR } from "@/lib/config";

const T = (en: string, ko: string) => isKR ? ko : en;

interface AnalysisNotesProps {
  boxscore: BoxscoreResponse;
  linescore: LinescoreResponse;
}

interface Insight {
  icon: string;
  title: string;
  body: string;
  type: "positive" | "negative" | "neutral" | "warning";
}

function num(val: unknown): number {
  if (typeof val === "number") return val;
  if (typeof val === "string") return parseFloat(val) || 0;
  return 0;
}

function parseIP(ip: string | number): number {
  const val = typeof ip === "string" ? parseFloat(ip) : ip;
  const whole = Math.floor(val);
  const frac = Math.round((val - whole) * 10);
  return whole + frac / 3;
}

interface BullpenPitcherInfo {
  name: string;
  id: number;
  ip: number;
  ipDisplay: string;
  er: number;
  runs: number;
  k: number;
  pitchCount: number;
  inheritedRunners: number;
  inheritedRunnersScored: number;
  saves: number;
  holds: number;
}

function getBullpenData(
  boxscore: BoxscoreResponse,
  side: "home" | "away"
): BullpenPitcherInfo[] {
  const teamSide = boxscore.teams[side];
  const pitcherIds = teamSide.pitchers;
  if (!pitcherIds || pitcherIds.length <= 1) return [];

  // First pitcher is the starter, rest are bullpen
  const bullpenIds = pitcherIds.slice(1);
  const result: BullpenPitcherInfo[] = [];

  for (const pid of bullpenIds) {
    const player = teamSide.players[`ID${pid}`];
    if (!player) continue;
    const pitching = player.stats?.pitching;
    if (!pitching) continue;

    const ipDisplay = String(pitching.inningsPitched ?? "0.0");
    result.push({
      name: displayName(player.person.id, player.person.fullName),
      id: player.person.id,
      ip: parseIP(pitching.inningsPitched ?? 0),
      ipDisplay,
      er: num(pitching.earnedRuns),
      runs: num(pitching.runs),
      k: num(pitching.strikeOuts),
      pitchCount: num(pitching.numberOfPitches),
      inheritedRunners: num(pitching.inheritedRunners),
      inheritedRunnersScored: num(pitching.inheritedRunnersScored),
      saves: num(pitching.saves),
      holds: num(pitching.holds),
    });
  }

  return result;
}

export default function AnalysisNotes({
  boxscore,
  linescore,
}: AnalysisNotesProps) {
  const insights: Insight[] = [];

  const homeTeamData = getTeamById(boxscore.teams.home.team.id);
  const awayTeamData = getTeamById(boxscore.teams.away.team.id);
  const homeName = homeTeamData?.slug ?? boxscore.teams.home.team.name;
  const awayName = awayTeamData?.slug ?? boxscore.teams.away.team.name;

  const homeRuns = num(linescore.teams?.home?.runs);
  const awayRuns = num(linescore.teams?.away?.runs);
  const homeHits = num(linescore.teams?.home?.hits);
  const awayHits = num(linescore.teams?.away?.hits);

  // 1. Scoring summary
  if (homeRuns !== awayRuns) {
    const winner = homeRuns > awayRuns ? homeName : awayName;
    const loser = homeRuns > awayRuns ? awayName : homeName;
    const diff = Math.abs(homeRuns - awayRuns);
    if (diff >= 5) {
      insights.push({
        icon: "dominance",
        title: T("Dominant Victory", "압도적 승리"),
        body: isKR
          ? `${winner}이(가) ${loser}를(을) ${Math.max(homeRuns, awayRuns)}-${Math.min(homeRuns, awayRuns)}로 대승했다. ${diff}점의 압승이었다.`
          : `${winner} crushed ${loser} ${Math.max(homeRuns, awayRuns)}-${Math.min(homeRuns, awayRuns)}. A ${diff}-run blowout.`,
        type: "positive",
      });
    } else if (diff === 1) {
      insights.push({
        icon: "close",
        title: T("Close Game", "팽팽한 경기"),
        body: isKR
          ? `${winner}이(가) ${Math.max(homeRuns, awayRuns)}-${Math.min(homeRuns, awayRuns)}로 겨우 승리했다. 숨이 막힐 정도의 1점 경기였다.`
          : `${winner} edged out a ${Math.max(homeRuns, awayRuns)}-${Math.min(homeRuns, awayRuns)} victory. A nail-biting 1-run game.`,
        type: "neutral",
      });
    }
  }

  // 2. Find the best batter of the game (most hits, then HR as tiebreaker)
  let bestBatter: {
    name: string;
    id: number;
    team: string;
    hits: number;
    hr: number;
    rbi: number;
    ab: number;
  } | null = null;

  for (const side of ["home", "away"] as const) {
    const teamSide = boxscore.teams[side];
    const teamName =
      side === "home" ? homeName : awayName;
    for (const batterId of teamSide.battingOrder) {
      const player = teamSide.players[`ID${batterId}`];
      if (!player) continue;
      const batting = player.stats?.batting;
      if (!batting) continue;
      const h = num(batting.hits);
      const hr = num(batting.homeRuns);
      const rbi = num(batting.rbi);
      const ab = num(batting.atBats);
      if (
        !bestBatter ||
        h > bestBatter.hits ||
        (h === bestBatter.hits && hr > bestBatter.hr)
      ) {
        bestBatter = {
          name: displayName(player.person.id, player.person.fullName),
          id: player.person.id,
          team: teamName,
          hits: h,
          hr,
          rbi,
          ab,
        };
      }
    }
  }

  if (bestBatter && bestBatter.hits >= 2) {
    const hrNote =
      bestBatter.hr > 0
        ? isKR ? ` (${bestBatter.hr}개 홈런 포함)` : ` (incl. ${bestBatter.hr} HR)`
        : "";
    insights.push({
      icon: "bat",
      title: T("Game MVP Batter", "경기 MVP 타자"),
      body: isKR
        ? `${bestBatter.name} (${bestBatter.team}) ${bestBatter.hits}-${bestBatter.ab}${hrNote}로 ${bestBatter.rbi}타점을 기록했다.`
        : `${bestBatter.name} (${bestBatter.team}) went ${bestBatter.hits}-for-${bestBatter.ab}${hrNote} with ${bestBatter.rbi} RBI.`,
      type: "positive",
    });
  }

  // 3. Pitching efficiency analysis
  for (const side of ["home", "away"] as const) {
    const teamSide = boxscore.teams[side];
    const teamName = side === "home" ? homeName : awayName;
    const pitcherIds = teamSide.pitchers;
    if (!pitcherIds || pitcherIds.length === 0) continue;

    // Find first pitcher (starter) and analyze
    const starterId = pitcherIds[0];
    const starter = teamSide.players[`ID${starterId}`];
    if (!starter) continue;
    const pitching = starter.stats?.pitching;
    if (!pitching) continue;

    const ip = parseIP(pitching.inningsPitched ?? 0);
    const pitchCount = num(pitching.numberOfPitches);
    const k = num(pitching.strikeOuts);
    const er = num(pitching.earnedRuns);

    if (ip > 0 && pitchCount > 0) {
      const pitchesPerInning = pitchCount / ip;
      const starterName = displayName(
        starter.person.id,
        starter.person.fullName
      );

      if (ip >= 6 && er <= 2) {
        insights.push({
          icon: "pitcher_good",
          title: `${teamName} ${T("Starter Dominance", "선발 압도")}`,
          body: isKR
            ? `${starterName}이(가) ${pitching.inningsPitched} 이닝을 ${pitchCount} 구로 완주, ${k} 삼진, ${er} 실점 — 퀄리티 스타트.`
            : `${starterName} pitched ${pitching.inningsPitched} IP on ${pitchCount} pitches, ${k} K, ${er} ER — a quality start.`,
          type: "positive",
        });
      } else if (ip < 4 && er >= 4) {
        insights.push({
          icon: "pitcher_bad",
          title: `${teamName} ${T("Starter Early Exit", "선발 조기 교체")}`,
          body: isKR
            ? `${starterName}이(가) 단 ${pitching.inningsPitched} 이닝만 던지고 ${er} 실점을 하며 강판당해, 불펜에 부담을 주었다.`
            : `${starterName} was pulled after just ${pitching.inningsPitched} IP with ${er} ER, putting pressure on the bullpen.`,
          type: "negative",
        });
      }

      if (pitchesPerInning <= 12 && ip >= 5) {
        insights.push({
          icon: "efficiency",
          title: T("Efficient Pitching", "효율적 투구"),
          body: isKR
            ? `${starterName}이(가) 이닝당 평균 ${pitchesPerInning.toFixed(1)} 구를 던졌다 — 높은 효율성.`
            : `${starterName} averaged ${pitchesPerInning.toFixed(1)} pitches per inning — highly efficient.`,
          type: "positive",
        });
      } else if (pitchesPerInning >= 20 && ip >= 3) {
        insights.push({
          icon: "inefficiency",
          title: T("Inefficient Pitching", "비효율적 투구"),
          body: isKR
            ? `${starterName}이(가) 이닝당 평균 ${pitchesPerInning.toFixed(1)} 구를 던졌다 — 높은 부담량.`
            : `${starterName} averaged ${pitchesPerInning.toFixed(1)} pitches per inning — high workload.`,
          type: "negative",
        });
      }
    }
  }

  // 4. Big inning detection
  if (linescore.innings && linescore.innings.length > 0) {
    for (const inning of linescore.innings) {
      for (const side of ["home", "away"] as const) {
        const runs = num(inning[side]?.runs);
        if (runs >= 4) {
          const teamName = side === "home" ? homeName : awayName;
          const half = side === "home" ? (isKR ? "하반" : "bottom") : (isKR ? "상반" : "top");
          const ordinal = inning.num === 1 ? (isKR ? "첫" : "1st") : inning.num === 2 ? (isKR ? "2" : "2nd") : inning.num === 3 ? (isKR ? "3" : "3rd") : inning.num;
          const ordinalSuffix = isKR ? "이닝" : (inning.num === 1 ? "st" : inning.num === 2 ? "nd" : inning.num === 3 ? "rd" : "th");
          insights.push({
            icon: "explosion",
            title: T("Big Inning", "대량 득점 이닝"),
            body: isKR
              ? `${teamName}이(가) ${ordinal}${ordinalSuffix} ${half}에 ${runs}점을 터트려 기세를 장악했다.`
              : `${teamName} scored ${runs} runs in the ${side === "home" ? "bottom" : "top"} of the ${inning.num}${inning.num === 1 ? "st" : inning.num === 2 ? "nd" : inning.num === 3 ? "rd" : "th"}, seizing momentum.`,
            type: "positive",
          });
        }
      }
    }
  }

  // 5. Team hitting comparison
  if (homeHits > 0 && awayHits > 0) {
    const hitDiff = Math.abs(homeHits - awayHits);
    if (hitDiff >= 5) {
      const moreHits = homeHits > awayHits ? homeName : awayName;
      const fewerHits = homeHits > awayHits ? awayName : homeName;
      insights.push({
        icon: "hits",
        title: T("Hit Disparity", "안타 불균형"),
        body: isKR
          ? `${moreHits} (${Math.max(homeHits, awayHits)} 안타)가 ${fewerHits} (${Math.min(homeHits, awayHits)} 안타)를 크게 능가했다.`
          : `${moreHits} (${Math.max(homeHits, awayHits)} H) significantly out-hit ${fewerHits} (${Math.min(homeHits, awayHits)} H).`,
        type: "neutral",
      });
    }
  }

  // 6. Strikeout-heavy game
  const homeK = num(boxscore.teams.home.teamStats?.pitching?.strikeOuts);
  const awayK = num(boxscore.teams.away.teamStats?.pitching?.strikeOuts);
  const totalK = homeK + awayK;
  if (totalK >= 20) {
    insights.push({
      icon: "strikeout",
      title: T("Strikeout Parade", "삼진 난발"),
      body: isKR
        ? `양 팀 투수진이 총 ${totalK}삼진을 기록했다 — 투수전의 전형. (${awayName} ${awayK}K, ${homeName} ${homeK}K)`
        : `Both pitching staffs combined for ${totalK} strikeouts — a pitcher's duel. (${awayName} ${awayK}K, ${homeName} ${homeK}K)`,
      type: "neutral",
    });
  }

  // 7. Bullpen usage
  for (const side of ["home", "away"] as const) {
    const pitcherCount = boxscore.teams[side].pitchers.length;
    const teamName = side === "home" ? homeName : awayName;
    if (pitcherCount >= 6) {
      insights.push({
        icon: "bullpen",
        title: `${teamName} ${T("Bullpen Overload", "불펜 과다 사용")}`,
        body: isKR
          ? `${teamName}이(가) ${pitcherCount}명의 투수를 기용했다. 불펜에 심한 부담을 준 경기였다.`
          : `${teamName} used ${pitcherCount} pitchers. A heavy-workload game for the bullpen.`,
        type: "negative",
      });
    }
  }

  if (insights.length === 0) {
    insights.push({
      icon: "game",
      title: T("Game Summary", "경기 요약"),
      body: isKR
        ? `${awayName} ${awayRuns} - ${homeRuns} ${homeName}. 두 팀 간의 평범한 경기였다.`
        : `${awayName} ${awayRuns} - ${homeRuns} ${homeName}. A standard game between both teams.`,
      type: "neutral",
    });
  }

  // ===== Bullpen Analysis Section =====
  const bullpenInsights: Insight[] = [];
  const homeBullpen = getBullpenData(boxscore, "home");
  const awayBullpen = getBullpenData(boxscore, "away");

  // 1. Bullpen Usage Summary
  for (const { side, teamName, bullpen } of [
    { side: "home" as const, teamName: homeName, bullpen: homeBullpen },
    { side: "away" as const, teamName: awayName, bullpen: awayBullpen },
  ]) {
    if (bullpen.length === 0) continue;
    const totalIP = bullpen.reduce((sum, p) => sum + p.ip, 0);
    const totalRuns = bullpen.reduce((sum, p) => sum + p.runs, 0);

    const ipWhole = Math.floor(totalIP);
    const ipFrac = Math.round((totalIP - ipWhole) * 3);
    const ipDisplay = `${ipWhole}.${ipFrac}`;

    bullpenInsights.push({
      icon: "bullpen_summary",
      title: `${teamName} ${T("Bullpen Usage", "불펜 사용")}`,
      body: isKR
        ? `${bullpen.length}명의 중원투수 기용, 총 ${ipDisplay} 이닝, ${totalRuns}점 허용.`
        : `${bullpen.length} relievers used, ${ipDisplay} IP total, ${totalRuns} runs allowed.`,
      type: totalRuns === 0 ? "positive" : totalRuns >= 4 ? "negative" : "neutral",
    });
  }

  // 2. Bullpen Efficiency (ERA comparison)
  const bullpenEras: { teamName: string; era: number; ip: number }[] = [];
  for (const { teamName, bullpen } of [
    { teamName: homeName, bullpen: homeBullpen },
    { teamName: awayName, bullpen: awayBullpen },
  ]) {
    if (bullpen.length === 0) continue;
    const totalIP = bullpen.reduce((sum, p) => sum + p.ip, 0);
    const totalER = bullpen.reduce((sum, p) => sum + p.er, 0);
    if (totalIP > 0) {
      const era = (totalER / totalIP) * 9;
      bullpenEras.push({ teamName, era, ip: totalIP });
    }
  }

  if (bullpenEras.length === 2) {
    const [a, b] = bullpenEras;
    const better = a.era <= b.era ? a : b;
    const worse = a.era <= b.era ? b : a;
    if (better.era !== worse.era) {
      bullpenInsights.push({
        icon: "bullpen_era",
        title: T("Bullpen ERA Comparison", "불펜 ERA 비교"),
        body: isKR
          ? `${better.teamName} 불펜 ERA ${better.era.toFixed(2)} vs ${worse.teamName} 불펜 ERA ${worse.era.toFixed(2)}. ${better.teamName} 불펜이 더 효율적이었다.`
          : `${better.teamName} bullpen ERA ${better.era.toFixed(2)} vs ${worse.teamName} bullpen ERA ${worse.era.toFixed(2)}. ${better.teamName} bullpen was more efficient.`,
        type: "neutral",
      });
    } else {
      bullpenInsights.push({
        icon: "bullpen_era",
        title: T("Bullpen ERA Comparison", "불펜 ERA 비교"),
        body: isKR
          ? `양 팀의 불펜 ERA가 ${better.era.toFixed(2)}로 동일했다.`
          : `Both teams' bullpen ERA was identical at ${better.era.toFixed(2)}.`,
        type: "neutral",
      });
    }
  } else if (bullpenEras.length === 1) {
    const bp = bullpenEras[0];
    bullpenInsights.push({
      icon: "bullpen_era",
      title: `${bp.teamName} ${T("Bullpen ERA", "불펜 ERA")}`,
      body: isKR
        ? `${bp.teamName} 불펜 ERA: ${bp.era.toFixed(2)} (${bp.ip.toFixed(1)} 이닝)`
        : `${bp.teamName} bullpen ERA: ${bp.era.toFixed(2)} (${bp.ip.toFixed(1)} IP)`,
      type: bp.era <= 3.0 ? "positive" : bp.era >= 6.0 ? "negative" : "neutral",
    });
  }

  // 3. Key Reliever: Best (most IP with 0 runs) and Worst (most runs allowed)
  const allBullpen = [
    ...homeBullpen.map((p) => ({ ...p, team: homeName })),
    ...awayBullpen.map((p) => ({ ...p, team: awayName })),
  ];

  if (allBullpen.length > 0) {
    // Best reliever: 0 runs, most innings
    const cleanRelievers = allBullpen.filter((p) => p.runs === 0 && p.ip > 0);
    if (cleanRelievers.length > 0) {
      cleanRelievers.sort((a, b) => b.ip - a.ip);
      const best = cleanRelievers[0];
      bullpenInsights.push({
        icon: "bullpen_best",
        title: T("Best Reliever", "최고 중원투수"),
        body: isKR
          ? `${best.name} (${best.team}) — ${best.ipDisplay} 이닝, 무실점, ${best.k} 삼진. 불펜에서 가장 신뢰할 수 있는 팔.`
          : `${best.name} (${best.team}) — ${best.ipDisplay} IP, 0 runs, ${best.k} K. The most reliable arm out of the bullpen.`,
        type: "positive",
      });
    }

    // Worst reliever: most runs allowed
    const runAllowers = allBullpen.filter((p) => p.runs > 0);
    if (runAllowers.length > 0) {
      runAllowers.sort((a, b) => b.runs - a.runs);
      const worst = runAllowers[0];
      if (worst.runs >= 2) {
        bullpenInsights.push({
          icon: "bullpen_worst",
          title: T("Struggling Reliever", "부진 중원투수"),
          body: isKR
            ? `${worst.name} (${worst.team}) — ${worst.ipDisplay} 이닝, ${worst.runs}점 허용. 불펜에서 가장 많은 점수를 주었다.`
            : `${worst.name} (${worst.team}) — ${worst.ipDisplay} IP, ${worst.runs} runs allowed. Gave up the most runs out of the bullpen.`,
          type: "negative",
        });
      }
    }
  }

  // 4. Hold/Save chain for the winning team
  if (homeRuns !== awayRuns) {
    const winningSide = homeRuns > awayRuns ? "home" : "away";
    const winnerName = homeRuns > awayRuns ? homeName : awayName;
    const winBullpen =
      winningSide === "home" ? homeBullpen : awayBullpen;

    if (winBullpen.length > 0) {
      const chainParts: string[] = [];
      for (const p of winBullpen) {
        const tags: string[] = [];
        if (p.runs === 0) tags.push(isKR ? "무실점" : "scoreless");
        else tags.push(isKR ? `${p.runs}점` : `${p.runs} R`);
        if (p.saves > 0) tags.push(isKR ? "세이브" : "SV");
        if (p.holds > 0) tags.push(isKR ? "홀드" : "HLD");
        chainParts.push(isKR
          ? `${p.name}(${p.ipDisplay} 이닝, ${tags.join(", ")})`
          : `${p.name}(${p.ipDisplay} IP, ${tags.join(", ")})`);
      }
      if (chainParts.length > 0) {
        bullpenInsights.push({
          icon: "bullpen_chain",
          title: `${winnerName} ${T("Bullpen Relay", "불펜 릴레이")}`,
          body: chainParts.join(" → "),
          type: "positive",
        });
      }
    }
  }

  // 5. Leverage insight: inherited runners
  for (const { teamName, bullpen } of [
    { teamName: homeName, bullpen: homeBullpen },
    { teamName: awayName, bullpen: awayBullpen },
  ]) {
    for (const p of bullpen) {
      if (p.inheritedRunners > 0) {
        const scored = p.inheritedRunnersScored;
        const total = p.inheritedRunners;
        const isClean = scored === 0;
        bullpenInsights.push({
          icon: "bullpen_leverage",
          title: T("High-Leverage Entry", "고위험 상황 등판"),
          body: isKR
            ? `${p.name} (${teamName})이(가) 주자 ${total}명이 나간 상황에서 등판, ${scored}명이 득점했다.${isClean ? " 기세를 효과적으로 끊었다." : ` 상속주자 ${scored}명이 모두 득점했다.`}`
            : `${p.name} (${teamName}) entered with ${total} runner${total > 1 ? "s" : ""} on base, allowed ${scored} to score.${isClean ? " Successfully navigated the jam." : ` Let ${scored} inherited runner${scored > 1 ? "s" : ""} come around to score.`}`,
          type: isClean ? "positive" : scored >= 2 ? "negative" : "warning",
        });
      }
    }
  }

  const iconMap: Record<string, string> = {
    dominance: "\u{1F525}",
    close: "\u{26A1}",
    bat: "\u{1F3AF}",
    pitcher_good: "\u{1F4AA}",
    pitcher_bad: "\u{1F4A5}",
    efficiency: "\u{2699}",
    inefficiency: "\u{23F3}",
    explosion: "\u{1F4A3}",
    hits: "\u{1F4CA}",
    strikeout: "\u{1F329}",
    bullpen: "\u{1F3CB}",
    game: "\u{26BE}",
    bullpen_summary: "\u{1F4CB}",
    bullpen_era: "\u{1F4C9}",
    bullpen_best: "\u{1F31F}",
    bullpen_worst: "\u{1F6A8}",
    bullpen_chain: "\u{1F517}",
    bullpen_leverage: "\u{26A0}",
  };

  const typeColors: Record<string, string> = {
    positive: "border-green-500/30 bg-green-500/5",
    negative: "border-red-500/30 bg-red-500/5",
    neutral: "border-blue-500/30 bg-blue-500/5",
    warning: "border-amber-500/30 bg-amber-500/5",
  };

  const titleColors: Record<string, string> = {
    positive: "text-green-600",
    negative: "text-red-600",
    neutral: "text-blue-600",
    warning: "text-amber-600",
  };

  return (
    <section>
      <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
        <span className="inline-block w-1 h-6 bg-amber-500 rounded-full" />
        {T("Analysis Notes", "분석 노트")}
      </h2>
      <div className="space-y-3">
        {insights.map((insight, idx) => (
          <div
            key={idx}
            className={`rounded-xl border p-4 ${typeColors[insight.type]}`}
          >
            <div className="flex items-start gap-3">
              <span className="text-xl shrink-0 mt-0.5">
                {iconMap[insight.icon] ?? "\u{26BE}"}
              </span>
              <div>
                <h3
                  className={`text-sm font-bold mb-1 ${titleColors[insight.type]}`}
                >
                  {insight.title}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {insight.body}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ===== Bullpen Analysis Section ===== */}
      {bullpenInsights.length > 0 && (
        <>
          <h2 className="text-xl font-bold text-slate-800 mt-8 mb-4 flex items-center gap-2">
            <span className="inline-block w-1 h-6 bg-indigo-500 rounded-full" />
            {T("Bullpen Analysis", "불펜 분석")}
          </h2>
          <div className="space-y-3">
            {bullpenInsights.map((insight, idx) => (
              <div
                key={`bp-${idx}`}
                className={`rounded-xl border p-4 ${typeColors[insight.type]}`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl shrink-0 mt-0.5">
                    {iconMap[insight.icon] ?? "\u{26BE}"}
                  </span>
                  <div>
                    <h3
                      className={`text-sm font-bold mb-1 ${titleColors[insight.type]}`}
                    >
                      {insight.title}
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {insight.body}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
