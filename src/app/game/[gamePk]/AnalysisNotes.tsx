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
        title: "Dominant Victory",
        body: `${winner} crushed ${loser} ${Math.max(homeRuns, awayRuns)}-${Math.min(homeRuns, awayRuns)}. A ${diff}-run blowout.`,
        type: "positive",
      });
    } else if (diff === 1) {
      insights.push({
        icon: "close",
        title: "Close Game",
        body: `${winner} edged out a ${Math.max(homeRuns, awayRuns)}-${Math.min(homeRuns, awayRuns)} victory. A nail-biting 1-run game.`,
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
        ? ` (incl. ${bestBatter.hr} HR)`
        : "";
    insights.push({
      icon: "bat",
      title: "Game MVP Batter",
      body: `${bestBatter.name} (${bestBatter.team}) went ${bestBatter.hits}-for-${bestBatter.ab}${hrNote} with ${bestBatter.rbi} RBI.`,
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
          title: `${teamName} Starter Dominance`,
          body: `${starterName} pitched ${pitching.inningsPitched} IP on ${pitchCount} pitches, ${k} K, ${er} ER — a quality start.`,
          type: "positive",
        });
      } else if (ip < 4 && er >= 4) {
        insights.push({
          icon: "pitcher_bad",
          title: `${teamName} Starter Early Exit`,
          body: `${starterName} was pulled after just ${pitching.inningsPitched} IP with ${er} ER, putting pressure on the bullpen.`,
          type: "negative",
        });
      }

      if (pitchesPerInning <= 12 && ip >= 5) {
        insights.push({
          icon: "efficiency",
          title: "Efficient Pitching",
          body: `${starterName} averaged ${pitchesPerInning.toFixed(1)} pitches per inning — highly efficient.`,
          type: "positive",
        });
      } else if (pitchesPerInning >= 20 && ip >= 3) {
        insights.push({
          icon: "inefficiency",
          title: "Inefficient Pitching",
          body: `${starterName} averaged ${pitchesPerInning.toFixed(1)} pitches per inning — high workload.`,
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
            title: "Big Inning",
            body: `${teamName} scored ${runs} runs in the ${side === "home" ? "bottom" : "top"} of the ${inning.num}${inning.num === 1 ? "st" : inning.num === 2 ? "nd" : inning.num === 3 ? "rd" : "th"}, seizing momentum.`,
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
        title: "Hit Disparity",
        body: `${moreHits} (${Math.max(homeHits, awayHits)} H) significantly out-hit ${fewerHits} (${Math.min(homeHits, awayHits)} H).`,
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
      title: "Strikeout Parade",
      body: `Both pitching staffs combined for ${totalK} strikeouts — a pitcher's duel. (${awayName} ${awayK}K, ${homeName} ${homeK}K)`,
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
        title: `${teamName} Bullpen Overload`,
        body: `${teamName} used ${pitcherCount} pitchers. A heavy-workload game for the bullpen.`,
        type: "negative",
      });
    }
  }

  if (insights.length === 0) {
    insights.push({
      icon: "game",
      title: "Game Summary",
      body: `${awayName} ${awayRuns} - ${homeRuns} ${homeName}. A standard game between both teams.`,
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
      title: `${teamName} Bullpen Usage`,
      body: `${bullpen.length} relievers used, ${ipDisplay} IP total, ${totalRuns} runs allowed.`,
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
        title: "Bullpen ERA Comparison",
        body: `${better.teamName} bullpen ERA ${better.era.toFixed(2)} vs ${worse.teamName} bullpen ERA ${worse.era.toFixed(2)}. ${better.teamName} bullpen was more efficient.`,
        type: "neutral",
      });
    } else {
      bullpenInsights.push({
        icon: "bullpen_era",
        title: "Bullpen ERA Comparison",
        body: `Both teams' bullpen ERA was identical at ${better.era.toFixed(2)}.`,
        type: "neutral",
      });
    }
  } else if (bullpenEras.length === 1) {
    const bp = bullpenEras[0];
    bullpenInsights.push({
      icon: "bullpen_era",
      title: `${bp.teamName} Bullpen ERA`,
      body: `${bp.teamName} bullpen ERA: ${bp.era.toFixed(2)} (${bp.ip.toFixed(1)} IP)`,
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
        title: "Best Reliever",
        body: `${best.name} (${best.team}) — ${best.ipDisplay} IP, 0 runs, ${best.k} K. The most reliable arm out of the bullpen.`,
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
          title: "Struggling Reliever",
          body: `${worst.name} (${worst.team}) — ${worst.ipDisplay} IP, ${worst.runs} runs allowed. Gave up the most runs out of the bullpen.`,
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
        if (p.runs === 0) tags.push("scoreless");
        else tags.push(`${p.runs} R`);
        if (p.saves > 0) tags.push("SV");
        if (p.holds > 0) tags.push("HLD");
        chainParts.push(`${p.name}(${p.ipDisplay} IP, ${tags.join(", ")})`);
      }
      if (chainParts.length > 0) {
        bullpenInsights.push({
          icon: "bullpen_chain",
          title: `${winnerName} Bullpen Relay`,
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
          title: "High-Leverage Entry",
          body: `${p.name} (${teamName}) entered with ${total} runner${total > 1 ? "s" : ""} on base, allowed ${scored} to score.${isClean ? " Successfully navigated the jam." : ` Let ${scored} inherited runner${scored > 1 ? "s" : ""} come around to score.`}`,
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
        Analysis Notes
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
            Bullpen Analysis
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
