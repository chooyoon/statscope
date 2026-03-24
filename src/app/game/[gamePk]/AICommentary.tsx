import type { BoxscoreResponse, LinescoreResponse } from "@/lib/sports/mlb/api";
import { fetchPlayerVsPlayerTotal } from "@/lib/sports/mlb/api";
import { getTeamById } from "@/data/teams";
import { displayName } from "@/data/players";

interface StarterInfo {
  id: number;
  name: string;
}

interface AICommentaryProps {
  boxscore: BoxscoreResponse;
  linescore: LinescoreResponse;
  gameStarted: boolean;
  homeStarterSeason: Record<string, unknown> | null;
  awayStarterSeason: Record<string, unknown> | null;
  homeStarter: StarterInfo | null;
  awayStarter: StarterInfo | null;
  venueName: string;
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

function getTeamName(boxscore: BoxscoreResponse, side: "home" | "away"): string {
  const team = getTeamById(boxscore.teams[side].team.id);
  return team?.nameKo ?? boxscore.teams[side].team.name;
}

// ============================================================
// MATCHUP DATA TYPES & FETCHING
// ============================================================

interface BatterVsPitcherMatchup {
  batterId: number;
  batterName: string;
  batterDisplayName: string;
  orderPosition: number;
  atBats: number;
  hits: number;
  homeRuns: number;
  strikeOuts: number;
  baseOnBalls: number;
  avg: number;
  rbi: number;
  doubles: number;
  triples: number;
}

interface MatchupAnalysis {
  pitcherName: string;
  pitcherDisplayName: string;
  opposingTeamName: string;
  matchups: BatterVsPitcherMatchup[];
  totalAtBats: number;
  totalHits: number;
  overallAvg: number;
}

async function fetchMatchupData(
  pitcherId: number,
  pitcherName: string,
  battingOrder: number[],
  players: Record<string, { person: { id: number; fullName: string }; position: { abbreviation: string } }>,
  opposingTeamName: string,
  maxBatters: number = 7,
): Promise<MatchupAnalysis | null> {
  const pitcherDisplayName = displayName(pitcherId, pitcherName);
  const batterIds = battingOrder.slice(0, maxBatters);

  const fetchPromises = batterIds.map(async (batterId, idx) => {
    try {
      const data = await fetchPlayerVsPlayerTotal(pitcherId, batterId, "pitching");
      const splits = data.people?.[0]?.stats?.[0]?.splits;
      if (!splits || splits.length === 0) return null;
      const stat = splits[0].stat;
      const ab = num(stat.atBats);
      const h = num(stat.hits);
      const player = players[`ID${batterId}`];
      const batterFullName = player?.person?.fullName ?? `Player ${batterId}`;
      return {
        batterId,
        batterName: batterFullName,
        batterDisplayName: displayName(batterId, batterFullName),
        orderPosition: idx + 1,
        atBats: ab,
        hits: h,
        homeRuns: num(stat.homeRuns),
        strikeOuts: num(stat.strikeOuts),
        baseOnBalls: num(stat.baseOnBalls),
        avg: ab > 0 ? h / ab : 0,
        rbi: num(stat.rbi),
        doubles: num(stat.doubles),
        triples: num(stat.triples),
      } as BatterVsPitcherMatchup;
    } catch {
      return null;
    }
  });

  const results = await Promise.allSettled(fetchPromises);
  const matchups: BatterVsPitcherMatchup[] = [];

  for (const result of results) {
    if (result.status === "fulfilled" && result.value) {
      matchups.push(result.value);
    }
  }

  if (matchups.length === 0) return null;

  const meaningful = matchups.filter((m) => m.atBats >= 1);
  const totalAB = meaningful.reduce((s, m) => s + m.atBats, 0);
  const totalH = meaningful.reduce((s, m) => s + m.hits, 0);

  return {
    pitcherName,
    pitcherDisplayName,
    opposingTeamName,
    matchups: meaningful,
    totalAtBats: totalAB,
    totalHits: totalH,
    overallAvg: totalAB > 0 ? totalH / totalAB : 0,
  };
}

function formatAvg(avg: number): string {
  return avg.toFixed(3).replace(/^0/, "");
}

function generateMatchupInsights(analysis: MatchupAnalysis): string[] {
  const paragraphs: string[] = [];
  const { pitcherDisplayName, opposingTeamName, matchups, totalAtBats, totalHits, overallAvg } = analysis;

  if (totalAtBats < 5) return paragraphs;

  const withAB = matchups.filter((m) => m.atBats >= 3);
  if (withAB.length === 0) return paragraphs;

  const sortedByAvg = [...withAB].sort((a, b) => b.avg - a.avg);
  const struggles = sortedByAvg.filter((m) => m.avg >= 0.300 && m.atBats >= 5);
  const dominates = sortedByAvg.filter((m) => m.avg <= 0.150 && m.atBats >= 5);

  // Batters who hit the pitcher well
  if (struggles.length > 0) {
    const top = struggles.slice(0, 3);
    if (top.length === 1) {
      const m = top[0];
      const extra = m.homeRuns > 0 ? ` ${m.homeRuns}홈런 포함` : "";
      paragraphs.push(
        `${pitcherDisplayName}는 ${opposingTeamName} ${m.orderPosition}번 타자 ${m.batterDisplayName}에게 통산 ${m.atBats}타수 ${m.hits}안타(${formatAvg(m.avg)})를 허용하며 약점을 보이고 있다.${extra}`
      );
    } else {
      const names = top.map(
        (m) => `${m.batterDisplayName}(${m.atBats}타수 ${m.hits}안타, ${formatAvg(m.avg)})`
      );
      paragraphs.push(
        `${pitcherDisplayName}는 ${opposingTeamName} 타선에서 ${names.join(", ")}에게 높은 피안타율을 허용해왔다. 이들에 대한 대비가 필요하다.`
      );
    }
  }

  // Batters the pitcher dominates
  if (dominates.length > 0) {
    const top = dominates.slice(0, 3);
    if (top.length === 1) {
      const m = top[0];
      paragraphs.push(
        `반면 ${m.batterDisplayName}는 ${pitcherDisplayName}를 상대로 ${m.atBats}타수 ${m.hits}안타(${formatAvg(m.avg)})로 크게 고전 중이다.`
      );
    } else {
      const names = top.map(
        (m) => `${m.batterDisplayName}(${m.atBats}타수 ${m.hits}안타)`
      );
      paragraphs.push(
        `반면 ${names.join(", ")} 등은 ${pitcherDisplayName}를 상대로 크게 고전해왔다.`
      );
    }
  }

  // Power threat
  const hrDangerous = withAB.filter((m) => m.homeRuns >= 2);
  if (hrDangerous.length > 0) {
    const hrNames = hrDangerous.map(
      (m) => `${m.batterDisplayName}(${m.homeRuns}홈런/${m.atBats}타수)`
    );
    paragraphs.push(
      `장타력 경계 대상: ${hrNames.join(", ")}. ${pitcherDisplayName}는 이들의 장타에 특히 주의해야 한다.`
    );
  }

  // Overall assessment
  if (totalAtBats >= 15) {
    if (overallAvg <= 0.220) {
      paragraphs.push(
        `${pitcherDisplayName}의 ${opposingTeamName} 상위 타선 통산 피안타율 ${formatAvg(overallAvg)}(${totalAtBats}타수 ${totalHits}안타)를 감안하면 안정적인 호투가 기대된다.`
      );
    } else if (overallAvg >= 0.300) {
      paragraphs.push(
        `${pitcherDisplayName}의 ${opposingTeamName} 상위 타선 통산 피안타율이 ${formatAvg(overallAvg)}(${totalAtBats}타수 ${totalHits}안타)로 높아 초반 실점 가능성에 주의해야 한다.`
      );
    } else {
      paragraphs.push(
        `${pitcherDisplayName}의 ${opposingTeamName} 상위 타선 통산 피안타율은 ${formatAvg(overallAvg)}(${totalAtBats}타수 ${totalHits}안타)로 무난한 수준이다.`
      );
    }
  }

  return paragraphs;
}

// ============================================================
// PRE-GAME ANALYSIS
// ============================================================

async function generatePreGameAnalysis(
  boxscore: BoxscoreResponse,
  homeStarterSeason: Record<string, unknown> | null,
  awayStarterSeason: Record<string, unknown> | null,
  homeStarter: StarterInfo | null,
  awayStarter: StarterInfo | null,
  venueName: string,
): Promise<{ title: string; paragraphs: string[] }[]> {
  const homeName = getTeamName(boxscore, "home");
  const awayName = getTeamName(boxscore, "away");
  const sections: { title: string; paragraphs: string[] }[] = [];

  // 1. Starting Pitcher Matchup
  if (homeStarter && awayStarter && homeStarterSeason && awayStarterSeason) {
    const paragraphs: string[] = [];

    const homeDisplayName = displayName(homeStarter.id, homeStarter.name);
    const awayDisplayName = displayName(awayStarter.id, awayStarter.name);

    const homeERA = num(homeStarterSeason.era);
    const awayERA = num(awayStarterSeason.era);
    const homeWHIP = num(homeStarterSeason.whip);
    const awayWHIP = num(awayStarterSeason.whip);
    const homeW = num(homeStarterSeason.wins);
    const homeL = num(homeStarterSeason.losses);
    const awayW = num(awayStarterSeason.wins);
    const awayL = num(awayStarterSeason.losses);
    const homeK = num(homeStarterSeason.strikeOuts);
    const awayK = num(awayStarterSeason.strikeOuts);
    const homeIP = parseIP((homeStarterSeason.inningsPitched as string | number) ?? 0);
    const awayIP = parseIP((awayStarterSeason.inningsPitched as string | number) ?? 0);
    const homeBF = num(homeStarterSeason.battersFaced);
    const awayBF = num(awayStarterSeason.battersFaced);
    const homeKPct = homeBF > 0 ? ((homeK / homeBF) * 100).toFixed(1) : "0.0";
    const awayKPct = awayBF > 0 ? ((awayK / awayBF) * 100).toFixed(1) : "0.0";

    const calcFIPSimple = (s: Record<string, unknown>) => {
      const hr = num(s.homeRuns);
      const bb = num(s.baseOnBalls);
      const hbp = num(s.hitByPitch);
      const k = num(s.strikeOuts);
      const ip = parseIP((s.inningsPitched as string | number) ?? 0);
      if (ip === 0) return 0;
      return ((13 * hr + 3 * (bb + hbp) - 2 * k) / ip) + 3.1;
    };
    const homeFIP = calcFIPSimple(homeStarterSeason);
    const awayFIP = calcFIPSimple(awayStarterSeason);

    const eraDesc = (era: number) => {
      if (era <= 2.5) return "엘리트급";
      if (era <= 3.5) return "안정적인";
      if (era <= 4.5) return "평균적인";
      if (era <= 5.5) return "불안한";
      return "부진한";
    };

    paragraphs.push(
      `${awayName} ${awayDisplayName}(${awayW}승 ${awayL}패, ERA ${awayERA.toFixed(2)})과 ${homeName} ${homeDisplayName}(${homeW}승 ${homeL}패, ERA ${homeERA.toFixed(2)})의 선발 맞대결이다.`
    );

    if (Math.abs(homeERA - awayERA) >= 1.0) {
      const better = homeERA < awayERA ? homeDisplayName : awayDisplayName;
      const betterTeam = homeERA < awayERA ? homeName : awayName;
      const betterERA = Math.min(homeERA, awayERA);
      const worse = homeERA < awayERA ? awayDisplayName : homeDisplayName;
      const worseERA = Math.max(homeERA, awayERA);
      paragraphs.push(
        `${betterTeam} ${better}는 시즌 ERA ${betterERA.toFixed(2)}로 ${eraDesc(betterERA)} 모습을 보이는 반면, ${worse}는 ERA ${worseERA.toFixed(2)}로 ${eraDesc(worseERA)} 모습을 보이고 있다. 선발 투수 역량에서 뚜렷한 차이가 나타난다.`
      );
    } else {
      paragraphs.push(
        `양 선발 모두 비슷한 수준의 ERA를 기록하고 있어 치열한 투수전이 예상된다. WHIP는 ${awayDisplayName} ${awayWHIP.toFixed(2)}, ${homeDisplayName} ${homeWHIP.toFixed(2)}이다.`
      );
    }

    paragraphs.push(
      `세부 지표: ${awayDisplayName} - FIP ${awayFIP.toFixed(2)}, K% ${awayKPct}%, ${awayIP.toFixed(1)}이닝 / ${homeDisplayName} - FIP ${homeFIP.toFixed(2)}, K% ${homeKPct}%, ${homeIP.toFixed(1)}이닝`
    );

    sections.push({ title: "오늘의 선발 매치업", paragraphs });
  } else if (homeStarter || awayStarter) {
    const paragraphs: string[] = [];
    const knownStarter = homeStarter ?? awayStarter;
    const knownSeason = homeStarter ? homeStarterSeason : awayStarterSeason;
    const knownTeam = homeStarter ? homeName : awayName;
    if (knownStarter && knownSeason) {
      const dn = displayName(knownStarter.id, knownStarter.name);
      paragraphs.push(
        `${knownTeam} 선발 ${dn}은 시즌 ERA ${num(knownSeason.era).toFixed(2)}, ${num(knownSeason.wins)}승 ${num(knownSeason.losses)}패를 기록 중이다. 상대팀 선발 투수는 아직 확정되지 않았다.`
      );
    }
    if (paragraphs.length > 0) {
      sections.push({ title: "오늘의 선발 매치업", paragraphs });
    }
  }

  // 2. Pitcher vs Batter Matchup Analysis
  if (homeStarter && awayStarter) {
    const matchupParagraphs: string[] = [];

    const homeBattingOrder = boxscore.teams.home.battingOrder ?? [];
    const awayBattingOrder = boxscore.teams.away.battingOrder ?? [];

    const [awayPitcherAnalysis, homePitcherAnalysis] = await Promise.all([
      homeBattingOrder.length > 0
        ? fetchMatchupData(
            awayStarter.id,
            awayStarter.name,
            homeBattingOrder,
            boxscore.teams.home.players as Record<string, { person: { id: number; fullName: string }; position: { abbreviation: string } }>,
            homeName,
            7,
          )
        : Promise.resolve(null),
      awayBattingOrder.length > 0
        ? fetchMatchupData(
            homeStarter.id,
            homeStarter.name,
            awayBattingOrder,
            boxscore.teams.away.players as Record<string, { person: { id: number; fullName: string }; position: { abbreviation: string } }>,
            awayName,
            7,
          )
        : Promise.resolve(null),
    ]);

    if (awayPitcherAnalysis) {
      const insights = generateMatchupInsights(awayPitcherAnalysis);
      matchupParagraphs.push(...insights);
    }

    if (homePitcherAnalysis) {
      const insights = generateMatchupInsights(homePitcherAnalysis);
      matchupParagraphs.push(...insights);
    }

    if (matchupParagraphs.length > 0) {
      sections.push({ title: "통산 상대 전적 분석", paragraphs: matchupParagraphs });
    }
  }

  // 3. Team Strength Comparison
  {
    const paragraphs: string[] = [];

    if (homeStarterSeason && awayStarterSeason) {
      const homeERA = num(homeStarterSeason.era);
      const awayERA = num(awayStarterSeason.era);
      const pitchAdvantage = homeERA < awayERA ? homeName : awayName;
      paragraphs.push(
        `선발 투수력 기준으로 ${pitchAdvantage}이 유리한 위치에 있다. 오늘 경기의 승패는 선발 투수의 이닝 소화력과 불펜 운용에 크게 좌우될 전망이다.`
      );
    }

    if (venueName) {
      const venLower = venueName.toLowerCase();
      if (venLower.includes("coors")) {
        paragraphs.push(
          `경기장은 쿠어스 필드로, 해발 1,600m의 고도에서 타구가 더 멀리 날아가는 타자 친화적 구장이다. 평소보다 높은 점수가 예상된다.`
        );
      } else if (venLower.includes("yankee")) {
        paragraphs.push(
          `양키 스타디움의 우측 담장이 짧아 좌타자에게 유리한 환경이다.`
        );
      } else if (venLower.includes("great american")) {
        paragraphs.push(
          `그레이트 아메리칸 볼파크는 홈런이 많이 나오는 타자 친화적 구장이다.`
        );
      } else {
        paragraphs.push(
          `오늘 경기는 ${venueName}에서 진행된다.`
        );
      }
    }

    if (paragraphs.length > 0) {
      sections.push({ title: "팀 전력 비교", paragraphs });
    }
  }

  // 4. Win Probability Prediction
  if (homeStarterSeason && awayStarterSeason) {
    const paragraphs: string[] = [];
    const homeERA = num(homeStarterSeason.era);
    const awayERA = num(awayStarterSeason.era);

    const homeERAScore = Math.max(0, 1 - (homeERA / 10));
    const awayERAScore = Math.max(0, 1 - (awayERA / 10));
    const homeAdvantage = 0.04;

    const homeRaw = homeERAScore + homeAdvantage;
    const awayRaw = awayERAScore;
    const total = homeRaw + awayRaw;
    const homeWinPct = total > 0 ? Math.round((homeRaw / total) * 100) : 50;
    const awayWinPct = 100 - homeWinPct;

    paragraphs.push(
      `예상 승률: ${awayName} ${awayWinPct}% vs ${homeName} ${homeWinPct}%`
    );

    const reasons: string[] = [];
    if (homeERA < awayERA) {
      reasons.push(`${homeName}의 선발 투수 ERA가 더 낮고`);
    } else if (awayERA < homeERA) {
      reasons.push(`${awayName}의 선발 투수 ERA가 더 낮고`);
    }
    reasons.push(`${homeName}의 홈 어드밴티지`);

    paragraphs.push(
      `근거: ${reasons.join(", ")}를 종합적으로 반영한 결과이다. 다만 야구는 변수가 많은 스포츠인 만큼 실제 결과는 달라질 수 있다.`
    );

    sections.push({ title: "승률 예측", paragraphs });
  }

  // 5. Key Points to Watch (data-driven)
  {
    const paragraphs: string[] = [];

    if (homeStarter && awayStarter && homeStarterSeason && awayStarterSeason) {
      const homeDisplayName = displayName(homeStarter.id, homeStarter.name);
      const awayDisplayName = displayName(awayStarter.id, awayStarter.name);
      const homeIP = parseIP((homeStarterSeason.inningsPitched as string | number) ?? 0);
      const awayIP = parseIP((awayStarterSeason.inningsPitched as string | number) ?? 0);
      const homeGS = num(homeStarterSeason.gamesStarted);
      const awayGS = num(awayStarterSeason.gamesStarted);
      const homeAvgIP = homeGS > 0 ? (homeIP / homeGS).toFixed(1) : "-";
      const awayAvgIP = awayGS > 0 ? (awayIP / awayGS).toFixed(1) : "-";

      paragraphs.push(
        `이닝 소화력 비교: ${awayDisplayName} 경기당 평균 ${awayAvgIP}이닝 vs ${homeDisplayName} ${homeAvgIP}이닝. 선발이 6이닝 이상 소화하면 팀 불펜 부담이 크게 줄어든다.`
      );

      const homeHR = num(homeStarterSeason.homeRuns);
      const awayHR = num(awayStarterSeason.homeRuns);
      if (homeHR >= 10 || awayHR >= 10) {
        const vulnerable = homeHR > awayHR ? homeDisplayName : awayDisplayName;
        const hrCount = Math.max(homeHR, awayHR);
        paragraphs.push(
          `${vulnerable}의 시즌 피홈런 ${hrCount}개는 장타력 있는 타선 앞에서 위험 요소가 될 수 있다.`
        );
      }
    }

    if (venueName) {
      const venLower = venueName.toLowerCase();
      if (venLower.includes("coors")) {
        paragraphs.push(
          `쿠어스 필드(해발 1,600m)는 MLB 최고의 타자 천국. 리그 평균 대비 득점이 30% 이상 높아 후반부 역전극이 빈번하다.`
        );
      } else if (venLower.includes("oracle") || venLower.includes("petco") || venLower.includes("kauffman")) {
        paragraphs.push(
          `${venueName}은 투수 친화적 구장으로 분류된다. 선발 투수의 이닝 소화력이 더욱 중요해진다.`
        );
      }
    }

    if (paragraphs.length > 0) {
      sections.push({ title: "전술적 주목 포인트", paragraphs });
    }
  }

  return sections;
}

// ============================================================
// LIVE GAME STATUS
// ============================================================

function generateLiveStatus(
  boxscore: BoxscoreResponse,
  linescore: LinescoreResponse,
): { title: string; paragraphs: string[] }[] {
  const homeName = getTeamName(boxscore, "home");
  const awayName = getTeamName(boxscore, "away");
  const homeRuns = num(linescore.teams?.home?.runs);
  const awayRuns = num(linescore.teams?.away?.runs);
  const currentInning = linescore.currentInning ?? 0;
  const half = linescore.inningHalf === "Top" ? "초" : "말";

  const paragraphs: string[] = [];

  if (homeRuns === awayRuns) {
    paragraphs.push(
      `${currentInning}회${half} 현재, ${awayName}과 ${homeName}이 ${homeRuns}-${awayRuns} 동점으로 팽팽한 접전을 벌이고 있다.`
    );
  } else {
    const leader = homeRuns > awayRuns ? homeName : awayName;
    const trailer = homeRuns > awayRuns ? awayName : homeName;
    const leadScore = Math.max(homeRuns, awayRuns);
    const trailScore = Math.min(homeRuns, awayRuns);
    paragraphs.push(
      `${currentInning}회${half} 현재, ${leader}이 ${leadScore}-${trailScore}으로 앞서고 있다. ${trailer}의 반격이 필요한 상황이다.`
    );
  }

  return [{ title: "경기 진행중", paragraphs }];
}

// ============================================================
// POST-GAME ANALYSIS
// ============================================================

interface PlayerPerformance {
  name: string;
  id: number;
  team: string;
  hits: number;
  hr: number;
  rbi: number;
  ab: number;
  doubles: number;
  triples: number;
  walks: number;
  sb: number;
  impact: number;
}

interface PitcherPerformance {
  name: string;
  id: number;
  team: string;
  ip: number;
  ipDisplay: string;
  er: number;
  runs: number;
  k: number;
  bb: number;
  hits: number;
  hr: number;
  pitchCount: number;
  wins: number;
  losses: number;
  saves: number;
  holds: number;
  blownSaves: number;
  isStarter: boolean;
  runsPerInning: number;
}

function getAllBatters(boxscore: BoxscoreResponse, side: "home" | "away", teamName: string): PlayerPerformance[] {
  const teamSide = boxscore.teams[side];
  const result: PlayerPerformance[] = [];
  for (const batterId of teamSide.battingOrder) {
    const player = teamSide.players[`ID${batterId}`];
    if (!player) continue;
    const batting = player.stats?.batting;
    if (!batting) continue;
    const h = num(batting.hits);
    const hr = num(batting.homeRuns);
    const rbi = num(batting.rbi);
    const ab = num(batting.atBats);
    const doubles = num(batting.doubles);
    const triples = num(batting.triples);
    const walks = num(batting.baseOnBalls);
    const sb = num(batting.stolenBases);
    result.push({
      name: displayName(player.person.id, player.person.fullName),
      id: player.person.id,
      team: teamName,
      hits: h, hr, rbi, ab, doubles, triples, walks, sb,
      impact: h * 1 + hr * 4 + rbi * 2,
    });
  }
  return result;
}

function getAllPitchers(boxscore: BoxscoreResponse, side: "home" | "away", teamName: string): PitcherPerformance[] {
  const teamSide = boxscore.teams[side];
  const result: PitcherPerformance[] = [];
  for (let i = 0; i < teamSide.pitchers.length; i++) {
    const pid = teamSide.pitchers[i];
    const player = teamSide.players[`ID${pid}`];
    if (!player) continue;
    const p = player.stats?.pitching;
    if (!p) continue;
    const ipVal = parseIP(p.inningsPitched ?? 0);
    if (ipVal === 0 && num(p.numberOfPitches) === 0) continue;
    result.push({
      name: displayName(player.person.id, player.person.fullName),
      id: player.person.id,
      team: teamName,
      ip: ipVal,
      ipDisplay: String(p.inningsPitched ?? "0.0"),
      er: num(p.earnedRuns),
      runs: num(p.runs),
      k: num(p.strikeOuts),
      bb: num(p.baseOnBalls),
      hits: num(p.hits),
      hr: num(p.homeRuns),
      pitchCount: num(p.numberOfPitches),
      wins: num(p.wins),
      losses: num(p.losses),
      saves: num(p.saves),
      holds: num(p.holds),
      blownSaves: num(p.blownSaves),
      isStarter: i === 0,
      runsPerInning: ipVal > 0 ? num(p.runs) / ipVal : 99,
    });
  }
  return result;
}

function generatePostGameAnalysis(
  boxscore: BoxscoreResponse,
  linescore: LinescoreResponse,
): { title: string; paragraphs: string[] }[] {
  const homeName = getTeamName(boxscore, "home");
  const awayName = getTeamName(boxscore, "away");
  const homeRuns = num(linescore.teams?.home?.runs);
  const awayRuns = num(linescore.teams?.away?.runs);
  const homeHits = num(linescore.teams?.home?.hits);
  const awayHits = num(linescore.teams?.away?.hits);

  const sections: { title: string; paragraphs: string[] }[] = [];

  // Game Summary
  {
    const paragraphs: string[] = [];
    const totalRuns = homeRuns + awayRuns;
    const innings = linescore.innings ?? [];
    const winnerName = homeRuns > awayRuns ? homeName : awayName;
    const loserName = homeRuns > awayRuns ? awayName : homeName;
    const winScore = Math.max(homeRuns, awayRuns);
    const loseScore = Math.min(homeRuns, awayRuns);
    const diff = winScore - loseScore;

    if (homeRuns === awayRuns) {
      paragraphs.push(
        `${awayName}과 ${homeName}의 경기는 ${homeRuns}-${awayRuns} 동점으로 마무리됐다. 양 팀 모두 결정적인 한 방을 만들어내지 못한 채 팽팽한 접전을 벌였다.`
      );
    } else if (diff >= 7) {
      paragraphs.push(
        `${winnerName}이 ${loserName}을 상대로 ${winScore}-${loseScore}으로 대승을 거뒀다. 경기는 일찌감치 한쪽으로 기울며 일방적인 전개를 보였다.`
      );
    } else if (diff >= 4) {
      paragraphs.push(
        `${winnerName}이 ${loserName}을 ${winScore}-${loseScore}으로 꺾었다. ${diff}점 차 승리로, ${winnerName}은 안정적인 경기 운영을 보여줬다.`
      );
    } else if (diff === 1) {
      paragraphs.push(
        `${winnerName}이 ${loserName}을 상대로 ${winScore}-${loseScore}, 1점 차 진땀승을 거뒀다. 경기 내내 긴장감이 이어진 접전이었다.`
      );
    } else {
      paragraphs.push(
        `${winnerName}이 ${loserName}을 ${winScore}-${loseScore}으로 물리쳤다.`
      );
    }

    // Key turning point
    if (innings.length > 0) {
      let biggestInning = { num: 0, side: "away" as "home" | "away", runs: 0 };
      for (const inn of innings) {
        const awayInnRuns = num(inn.away?.runs);
        const homeInnRuns = num(inn.home?.runs);
        if (awayInnRuns > biggestInning.runs) {
          biggestInning = { num: inn.num, side: "away", runs: awayInnRuns };
        }
        if (homeInnRuns > biggestInning.runs) {
          biggestInning = { num: inn.num, side: "home", runs: homeInnRuns };
        }
      }
      if (biggestInning.runs >= 3) {
        const bigTeam = biggestInning.side === "home" ? homeName : awayName;
        const half = biggestInning.side === "home" ? "말" : "초";
        paragraphs.push(
          `경기의 분수령은 ${biggestInning.num}회${half}이었다. ${bigTeam}은 이 이닝에서 ${biggestInning.runs}점을 올리며 경기의 흐름을 가져왔다.`
        );
      }
    }

    // Game character
    const homeK = num(boxscore.teams.home.teamStats?.pitching?.strikeOuts);
    const awayK = num(boxscore.teams.away.teamStats?.pitching?.strikeOuts);
    const totalK = homeK + awayK;
    const totalHits = homeHits + awayHits;

    if (totalRuns <= 4 && totalK >= 15) {
      paragraphs.push(
        `양 팀 합계 ${totalK}삼진이 나온 전형적인 투수전이었다.`
      );
    } else if (totalRuns >= 15) {
      paragraphs.push(
        `양 팀 합산 ${totalRuns}득점, ${totalHits}안타가 터진 화려한 타격전이었다.`
      );
    }

    sections.push({ title: "경기 요약", paragraphs });
  }

  // Key Players
  {
    const paragraphs: string[] = [];
    for (const side of ["away", "home"] as const) {
      const teamName = side === "home" ? homeName : awayName;
      const batters = getAllBatters(boxscore, side, teamName);
      const pitchers = getAllPitchers(boxscore, side, teamName);
      const lines: string[] = [];

      const bestHitter = batters.length > 0
        ? batters.reduce((best, curr) => curr.impact > best.impact ? curr : best)
        : null;
      const qualifiedPitchers = pitchers.filter(p => p.ip >= 1);
      const bestPitcher = qualifiedPitchers.length > 0
        ? qualifiedPitchers.reduce((best, curr) => curr.runsPerInning < best.runsPerInning ? curr : best)
        : null;

      if (bestHitter && bestHitter.impact > 0) {
        let hitDetail = `${bestHitter.ab}타수 ${bestHitter.hits}안타`;
        if (bestHitter.hr > 0) hitDetail += ` ${bestHitter.hr}홈런`;
        if (bestHitter.rbi > 0) hitDetail += ` ${bestHitter.rbi}타점`;
        lines.push(`${teamName} 타선에서는 ${bestHitter.name}이 ${hitDetail}으로 팀 공격을 주도했다.`);
      }

      if (bestPitcher) {
        const pitcherDesc = bestPitcher.isStarter ? "선발" : "구원";
        let pitchDetail = `${bestPitcher.ipDisplay}이닝 ${bestPitcher.er}자책 ${bestPitcher.k}탈삼진`;
        let resultTag = "";
        if (bestPitcher.wins > 0) resultTag = " 승리투수가 됐다.";
        else if (bestPitcher.saves > 0) resultTag = " 세이브를 기록했다.";
        else if (bestPitcher.holds > 0) resultTag = " 홀드를 추가했다.";
        else resultTag = " 팀 투수진을 이끌었다.";
        lines.push(`${teamName} ${pitcherDesc} ${bestPitcher.name}은 ${pitchDetail}으로${resultTag}`);
      }

      if (lines.length > 0) paragraphs.push(lines.join(" "));
    }
    if (paragraphs.length > 0) sections.push({ title: "핵심 선수", paragraphs });
  }

  // Pitching Report (enhanced)
  {
    const paragraphs: string[] = [];
    for (const side of ["away", "home"] as const) {
      const teamName = side === "home" ? homeName : awayName;
      const pitchers = getAllPitchers(boxscore, side, teamName);
      if (pitchers.length === 0) continue;
      const starter = pitchers.find(p => p.isStarter);
      const relievers = pitchers.filter(p => !p.isStarter);
      const lines: string[] = [];

      if (starter) {
        const isQS = starter.ip >= 6 && starter.er <= 3;
        const kPerIP = starter.ip > 0 ? (starter.k / starter.ip).toFixed(2) : "0";
        const pitchesPerIP = starter.ip > 0 ? (starter.pitchCount / starter.ip).toFixed(1) : "0";
        const kbbRatio = starter.bb > 0 ? (starter.k / starter.bb).toFixed(1) : starter.k > 0 ? `${starter.k}:0` : "-";

        let starterLine = `${teamName} 선발 ${starter.name}: ${starter.ipDisplay}이닝 ${starter.hits}피안타 ${starter.er}자책 ${starter.k}삼진 ${starter.bb}볼넷(${starter.pitchCount}구).`;

        if (isQS) {
          starterLine += ` QS 달성. K/IP ${kPerIP}로 ${parseFloat(kPerIP) >= 1.0 ? "지배적인 삼진 능력" : "효율적인 투구"}을 보여줬다.`;
        } else if (starter.ip >= 7 && starter.er <= 2) {
          starterLine += ` 7이닝 이상 소화하며 불펜 부담을 최소화했다. 이닝당 투구수 ${pitchesPerIP}로 ${parseFloat(pitchesPerIP) <= 15 ? "효율적" : "다소 많은"} 투구 운용을 보였다.`;
        } else if (starter.ip < 4 && starter.er >= 4) {
          starterLine += ` ${starter.ip.toFixed(0)}이닝도 채우지 못한 조기 강판. K/BB ${kbbRatio}로 제구력에 문제가 있었다.`;
        } else if (starter.ip < 5) {
          starterLine += ` 5이닝 미달로 불펜에 부담을 전가했다.`;
        }

        if (starter.hr >= 2) {
          starterLine += ` ${starter.hr}피홈런은 우려할 만한 장타 허용률이다.`;
        }

        lines.push(starterLine);
      }

      if (relievers.length > 0) {
        const bullpenIP = relievers.reduce((s, p) => s + p.ip, 0);
        const bullpenER = relievers.reduce((s, p) => s + p.er, 0);
        const bullpenK = relievers.reduce((s, p) => s + p.k, 0);
        const bullpenERA = bullpenIP > 0 ? ((bullpenER / bullpenIP) * 9).toFixed(2) : "-";

        if (bullpenER === 0 && bullpenIP >= 2) {
          lines.push(`불펜 ${relievers.length}명이 ${bullpenIP.toFixed(1)}이닝 무자책 릴레이(${bullpenK}K). 완벽한 마무리였다.`);
        } else if (bullpenER >= 4) {
          lines.push(`불펜 ERA ${bullpenERA} (${bullpenIP.toFixed(1)}이닝 ${bullpenER}자책). 구원 실패가 경기 결과에 직접적 영향을 미쳤다.`);
        } else if (bullpenIP > 0) {
          lines.push(`불펜: ${bullpenIP.toFixed(1)}이닝 ${bullpenER}자책 ${bullpenK}K (ERA ${bullpenERA}).`);
        }
      }

      if (lines.length > 0) paragraphs.push(lines.join(" "));
    }
    if (paragraphs.length > 0) sections.push({ title: "투수 세부 리포트", paragraphs });
  }

  // Hitting Analysis (enhanced)
  {
    const paragraphs: string[] = [];
    for (const side of ["away", "home"] as const) {
      const teamName = side === "home" ? homeName : awayName;
      const batters = getAllBatters(boxscore, side, teamName);
      if (batters.length === 0) continue;

      const totalHits = batters.reduce((s, b) => s + b.hits, 0);
      const totalAB = batters.reduce((s, b) => s + b.ab, 0);
      const totalHR = batters.reduce((s, b) => s + b.hr, 0);
      const totalRBI = batters.reduce((s, b) => s + b.rbi, 0);
      const totalBB = batters.reduce((s, b) => s + b.walks, 0);
      const totalXBH = batters.reduce((s, b) => s + b.doubles + b.triples + b.hr, 0);
      const teamAVG = totalAB > 0 ? (totalHits / totalAB).toFixed(3) : ".000";

      let overview = `${teamName}: ${totalHits}안타 ${totalRBI}타점 (팀 타율 ${teamAVG}).`;
      if (totalXBH >= 3) overview += ` 장타 ${totalXBH}개(홈런 ${totalHR})로 강력한 타격을 보여줬다.`;
      else if (totalHR > 0) overview += ` 홈런 ${totalHR}개 포함.`;
      if (totalBB >= 4) overview += ` ${totalBB}볼넷으로 출루율에서도 우위를 점했다.`;
      paragraphs.push(overview);

      // Multi-hit players with detail
      const multiHitters = batters.filter(b => b.hits >= 2);
      if (multiHitters.length > 0) {
        const names = multiHitters.map(b => {
          let detail = `${b.ab}타수 ${b.hits}안타`;
          if (b.hr > 0) detail += ` ${b.hr}HR`;
          if (b.rbi >= 2) detail += ` ${b.rbi}타점`;
          return `${b.name}(${detail})`;
        });
        paragraphs.push(`멀티히트: ${names.join(", ")}.`);
      }

      // Hitless cleanup hitters (3-5 spot)
      const cleanupHitters = batters.slice(2, 5).filter(b => b.ab >= 3 && b.hits === 0);
      if (cleanupHitters.length >= 2) {
        const names = cleanupHitters.map(b => `${b.name}(${b.ab}타수 무안타)`);
        paragraphs.push(`클린업 부진: ${names.join(", ")}. 중심 타선의 침묵이 뼈아팠다.`);
      }
    }
    if (paragraphs.length > 0) sections.push({ title: "타격 분석", paragraphs });
  }

  // Key Moments
  {
    const paragraphs: string[] = [];
    const innings = linescore.innings ?? [];
    if (innings.length > 0) {
      let leadChanges = 0;
      let prevLeader = "";
      let cumAway = 0;
      let cumHome = 0;

      for (const inn of innings) {
        cumAway += num(inn.away?.runs);
        cumHome += num(inn.home?.runs);
        const currentLeader = cumHome > cumAway ? "home" : cumAway > cumHome ? "away" : "tie";
        if (currentLeader !== "tie" && currentLeader !== prevLeader && prevLeader !== "" && prevLeader !== "tie") {
          leadChanges++;
        }
        if (currentLeader !== "tie") prevLeader = currentLeader;
      }

      if (leadChanges >= 2) {
        paragraphs.push(
          `이 경기에서는 ${leadChanges}차례 리드가 바뀌는 접전이 이어졌다.`
        );
      }

      // Shutout
      if ((homeRuns === 0 || awayRuns === 0) && homeRuns !== awayRuns) {
        const shutoutTeam = homeRuns === 0 ? awayName : homeName;
        const shutTeam = homeRuns === 0 ? homeName : awayName;
        paragraphs.push(
          `${shutoutTeam} 투수진이 ${shutTeam} 타선을 완봉으로 틀어막았다.`
        );
      }
    }
    if (paragraphs.length > 0) sections.push({ title: "승부 포인트", paragraphs });
  }

  return sections;
}

// ============================================================
// MAIN COMPONENT (async server component)
// ============================================================

export default async function AICommentary({
  boxscore,
  linescore,
  homeStarterSeason,
  awayStarterSeason,
  homeStarter,
  awayStarter,
  venueName,
}: AICommentaryProps) {
  const homeName = getTeamName(boxscore, "home");
  const awayName = getTeamName(boxscore, "away");
  const hasInnings = linescore.innings && linescore.innings.length > 0;
  const hasRuns = (linescore.teams?.home?.runs ?? -1) >= 0 || (linescore.teams?.away?.runs ?? -1) >= 0;
  const gameStarted = hasInnings && hasRuns;
  const isFinished = gameStarted && (!linescore.currentInning || !linescore.inningHalf);
  const isLive = gameStarted && !!linescore.currentInning && !!linescore.inningHalf && !isFinished;

  let sections: { title: string; paragraphs: string[] }[] = [];
  let headline = "";
  let headerLabel = "";
  let headerColor = "border-blue-500";

  if (isFinished) {
    // POST-GAME
    headerLabel = "경기 결과 분석";
    headerColor = "border-slate-500";
    sections = generatePostGameAnalysis(boxscore, linescore);

    const homeRuns = num(linescore.teams?.home?.runs);
    const awayRuns = num(linescore.teams?.away?.runs);
    const diff = Math.abs(homeRuns - awayRuns);
    const winner = homeRuns >= awayRuns ? homeName : awayName;
    const loser = homeRuns >= awayRuns ? awayName : homeName;

    if (homeRuns !== awayRuns) {
      if (diff >= 5) headline = `${winner}, ${loser} 상대 ${Math.max(homeRuns, awayRuns)}-${Math.min(homeRuns, awayRuns)} 대승`;
      else if (diff === 1) headline = `${winner}, ${loser}와 접전 끝에 ${Math.max(homeRuns, awayRuns)}-${Math.min(homeRuns, awayRuns)} 신승`;
      else headline = `${winner}, ${loser} 꺾고 ${Math.max(homeRuns, awayRuns)}-${Math.min(homeRuns, awayRuns)} 승리`;
    } else {
      headline = `${awayName} ${awayRuns} - ${homeRuns} ${homeName}`;
    }
  } else if (isLive) {
    // LIVE
    headerLabel = "실시간 경기";
    headerColor = "border-green-500";
    sections = generateLiveStatus(boxscore, linescore);

    const homeRuns = num(linescore.teams?.home?.runs);
    const awayRuns = num(linescore.teams?.away?.runs);
    const inning = linescore.currentInningOrdinal ?? "";
    const half = linescore.inningHalf === "Top" ? "초" : "말";
    headline = `${awayName} ${awayRuns} - ${homeRuns} ${homeName} (${inning} ${half})`;
  } else {
    // PRE-GAME (async - fetches matchup data)
    headerLabel = "경기 전 분석";
    headerColor = "border-blue-500";
    sections = await generatePreGameAnalysis(
      boxscore,
      homeStarterSeason,
      awayStarterSeason,
      homeStarter,
      awayStarter,
      venueName,
    );
    headline = `${awayName} vs ${homeName} 프리뷰`;
  }

  if (sections.length === 0) return null;

  return (
    <article className="rounded-2xl bg-white border border-slate-100 overflow-hidden">
      {/* Header */}
      <div className={`border-l-4 ${headerColor} bg-slate-50 px-6 py-5`}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-bold tracking-widest text-blue-600 uppercase">
            StatScope Analysis
          </span>
          <span className="text-[10px] text-slate-400">|</span>
          <span className="text-[10px] text-slate-500">{headerLabel}</span>
          {isLive && (
            <span className="ml-2 inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] text-green-600 font-bold">LIVE</span>
            </span>
          )}
        </div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-800 leading-tight">
          {headline}
        </h2>
      </div>

      {/* Article body */}
      <div className="px-6 py-6 space-y-8">
        {sections.map((section, sIdx) => (
          <section key={sIdx}>
            <h3 className="text-sm font-bold text-blue-600 mb-3 flex items-center gap-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-600" />
              {section.title}
            </h3>
            <div className="space-y-3">
              {section.paragraphs.map((para, pIdx) => (
                <p
                  key={pIdx}
                  className="text-sm text-slate-600 leading-7 tracking-wide"
                  style={{ textIndent: "1em" }}
                >
                  {para}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200 px-6 py-3 flex items-center justify-between">
        <span className="text-[10px] text-slate-500">
          {isFinished
            ? "본 기사는 박스스코어 데이터를 기반으로 자동 생성되었습니다."
            : isLive
            ? "경기 진행중 - 데이터가 실시간으로 업데이트됩니다."
            : "본 분석은 시즌 성적 및 통산 상대 전적 데이터를 기반으로 자동 생성되었습니다."}
        </span>
        <span className="text-[10px] text-slate-500 font-mono">
          StatScope AI Engine
        </span>
      </div>
    </article>
  );
}
