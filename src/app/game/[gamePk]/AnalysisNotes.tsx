import type { BoxscoreResponse, LinescoreResponse } from "@/lib/sports/mlb/api";
import { getTeamById } from "@/data/teams";
import { displayName } from "@/data/players";

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
        title: "압도적 승리",
        body: `${winner}이(가) ${loser}을(를) ${Math.max(homeRuns, awayRuns)}-${Math.min(homeRuns, awayRuns)}로 대파했습니다. ${diff}점 차 대승입니다.`,
        type: "positive",
      });
    } else if (diff === 1) {
      insights.push({
        icon: "close",
        title: "접전 승부",
        body: `${winner}이(가) ${Math.max(homeRuns, awayRuns)}-${Math.min(homeRuns, awayRuns)}로 아슬아슬하게 승리했습니다. 1점 차 긴장감 넘치는 경기였습니다.`,
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
        ? ` (홈런 ${bestBatter.hr}개 포함)`
        : "";
    insights.push({
      icon: "bat",
      title: "경기 MVP 타자",
      body: `${bestBatter.team}의 ${bestBatter.name}이(가) ${bestBatter.ab}타수 ${bestBatter.hits}안타${hrNote}, ${bestBatter.rbi}타점으로 맹활약했습니다.`,
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
          title: `${teamName} 선발 호투`,
          body: `${starterName}이(가) ${pitching.inningsPitched}이닝 ${pitchCount}구, ${k}탈삼진 ${er}자책으로 퀄리티 스타트를 기록했습니다.`,
          type: "positive",
        });
      } else if (ip < 4 && er >= 4) {
        insights.push({
          icon: "pitcher_bad",
          title: `${teamName} 선발 조기 강판`,
          body: `${starterName}이(가) ${pitching.inningsPitched}이닝 만에 ${er}자책으로 조기 강판당했습니다. 불펜에 부담을 안겼습니다.`,
          type: "negative",
        });
      }

      if (pitchesPerInning <= 12 && ip >= 5) {
        insights.push({
          icon: "efficiency",
          title: "효율적 투구",
          body: `${starterName}의 이닝당 투구수는 ${pitchesPerInning.toFixed(1)}개로, 매우 효율적인 투구를 보여주었습니다.`,
          type: "positive",
        });
      } else if (pitchesPerInning >= 20 && ip >= 3) {
        insights.push({
          icon: "inefficiency",
          title: "비효율적 투구",
          body: `${starterName}은(는) 이닝당 ${pitchesPerInning.toFixed(1)}개로 체력 소모가 많았습니다.`,
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
          insights.push({
            icon: "explosion",
            title: "빅이닝",
            body: `${teamName}이(가) ${inning.num}회${side === "home" ? "말" : "초"}에 ${runs}점을 쏟아내며 분위기를 가져갔습니다.`,
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
        title: "안타 격차",
        body: `${moreHits}(${Math.max(homeHits, awayHits)}안타)이(가) ${fewerHits}(${Math.min(homeHits, awayHits)}안타) 대비 안타를 크게 앞섰습니다.`,
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
      title: "삼진 퍼레이드",
      body: `양 팀 투수진이 합계 ${totalK}개의 삼진을 기록한 투수전이었습니다. (${awayName} ${awayK}K, ${homeName} ${homeK}K)`,
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
        title: `${teamName} 불펜 풀가동`,
        body: `${teamName}은(는) 총 ${pitcherCount}명의 투수를 투입했습니다. 불펜 부담이 큰 경기였습니다.`,
        type: "negative",
      });
    }
  }

  if (insights.length === 0) {
    insights.push({
      icon: "game",
      title: "경기 요약",
      body: `${awayName} ${awayRuns} - ${homeRuns} ${homeName}. 양 팀이 정상적으로 경기를 치렀습니다.`,
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
      title: `${teamName} 불펜 운용`,
      body: `구원투수 ${bullpen.length}명 투입, 총 ${ipDisplay}이닝 소화, ${totalRuns}실점.`,
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
        title: "불펜 ERA 비교",
        body: `${better.teamName} 불펜 ERA ${better.era.toFixed(2)} vs ${worse.teamName} 불펜 ERA ${worse.era.toFixed(2)}. ${better.teamName} 불펜이 더 효율적이었습니다.`,
        type: "neutral",
      });
    } else {
      bullpenInsights.push({
        icon: "bullpen_era",
        title: "불펜 ERA 비교",
        body: `양 팀 불펜 ERA가 ${better.era.toFixed(2)}로 동일합니다.`,
        type: "neutral",
      });
    }
  } else if (bullpenEras.length === 1) {
    const bp = bullpenEras[0];
    bullpenInsights.push({
      icon: "bullpen_era",
      title: `${bp.teamName} 불펜 ERA`,
      body: `${bp.teamName} 불펜 ERA: ${bp.era.toFixed(2)} (${bp.ip.toFixed(1)}이닝 기준)`,
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
        title: "최고 구원투수",
        body: `${best.team}의 ${best.name} - ${best.ipDisplay}이닝 무실점, ${best.k}탈삼진. 불펜에서 가장 안정적인 투구를 보여주었습니다.`,
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
          title: "부진한 구원투수",
          body: `${worst.team}의 ${worst.name} - ${worst.ipDisplay}이닝 ${worst.runs}실점. 불펜에서 가장 많은 점수를 내주었습니다.`,
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
        if (p.runs === 0) tags.push("무실점");
        else tags.push(`${p.runs}실점`);
        if (p.saves > 0) tags.push("세이브");
        if (p.holds > 0) tags.push("홀드");
        chainParts.push(`${p.name}(${p.ipDisplay}이닝 ${tags.join(", ")})`);
      }
      if (chainParts.length > 0) {
        bullpenInsights.push({
          icon: "bullpen_chain",
          title: `${winnerName} 불펜 릴레이`,
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
          title: "주자 상황 투입",
          body: `${teamName}의 ${p.name}이(가) 주자 ${total}명이 있는 상황에서 등판, ${scored}명 득점 허용.${isClean ? " 위기를 잘 넘겼습니다." : ` ${scored}명의 주자를 홈으로 불러들였습니다.`}`,
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
        분석 노트
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
            불펜 분석
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
