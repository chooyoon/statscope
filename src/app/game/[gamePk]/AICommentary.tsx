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
  gameState: string; // "Preview" | "Live" | "Final"
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
  return team?.name ?? boxscore.teams[side].team.name;
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
      const extra = m.homeRuns > 0 ? `, including ${m.homeRuns} HR` : "";
      paragraphs.push(
        `${pitcherDisplayName} has struggled against ${opposingTeamName}'s No. ${m.orderPosition} hitter ${m.batterDisplayName}, allowing a ${formatAvg(m.avg)} career average (${m.hits}-for-${m.atBats})${extra}.`
      );
    } else {
      const names = top.map(
        (m) => `${m.batterDisplayName} (${m.hits}-for-${m.atBats}, ${formatAvg(m.avg)})`
      );
      paragraphs.push(
        `${pitcherDisplayName} has allowed high batting averages to several ${opposingTeamName} hitters: ${names.join(", ")}. These matchups bear watching.`
      );
    }
  }

  // Batters the pitcher dominates
  if (dominates.length > 0) {
    const top = dominates.slice(0, 3);
    if (top.length === 1) {
      const m = top[0];
      paragraphs.push(
        `On the flip side, ${m.batterDisplayName} has been overmatched by ${pitcherDisplayName}, going just ${m.hits}-for-${m.atBats} (${formatAvg(m.avg)}) in their career matchup.`
      );
    } else {
      const names = top.map(
        (m) => `${m.batterDisplayName} (${m.hits}-for-${m.atBats})`
      );
      paragraphs.push(
        `On the flip side, ${names.join(", ")} have all been largely shut down by ${pitcherDisplayName} in their careers.`
      );
    }
  }

  // Power threat
  const hrDangerous = withAB.filter((m) => m.homeRuns >= 2);
  if (hrDangerous.length > 0) {
    const hrNames = hrDangerous.map(
      (m) => `${m.batterDisplayName} (${m.homeRuns} HR in ${m.atBats} AB)`
    );
    paragraphs.push(
      `Power threat alert: ${hrNames.join(", ")}. ${pitcherDisplayName} must be careful with these hitters' extra-base pop.`
    );
  }

  // Overall assessment
  if (totalAtBats >= 15) {
    if (overallAvg <= 0.220) {
      paragraphs.push(
        `${pitcherDisplayName} owns a ${formatAvg(overallAvg)} career batting average against (${totalHits}-for-${totalAtBats}) vs. ${opposingTeamName}'s top of the order — a strong sign for a quality outing.`
      );
    } else if (overallAvg >= 0.300) {
      paragraphs.push(
        `${pitcherDisplayName} has a concerning ${formatAvg(overallAvg)} career BAA (${totalHits}-for-${totalAtBats}) vs. ${opposingTeamName}'s top of the order — early damage is a real possibility.`
      );
    } else {
      paragraphs.push(
        `${pitcherDisplayName} carries a ${formatAvg(overallAvg)} career BAA (${totalHits}-for-${totalAtBats}) vs. ${opposingTeamName}'s top of the order — a neutral track record.`
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
      if (era <= 2.5) return "elite";
      if (era <= 3.5) return "solid";
      if (era <= 4.5) return "league-average";
      if (era <= 5.5) return "shaky";
      return "struggling";
    };

    paragraphs.push(
      `Today's starting pitching matchup features ${awayName}'s ${awayDisplayName} (${awayW}-${awayL}, ${awayERA.toFixed(2)} ERA) against ${homeName}'s ${homeDisplayName} (${homeW}-${homeL}, ${homeERA.toFixed(2)} ERA).`
    );

    if (Math.abs(homeERA - awayERA) >= 1.0) {
      const better = homeERA < awayERA ? homeDisplayName : awayDisplayName;
      const betterTeam = homeERA < awayERA ? homeName : awayName;
      const betterERA = Math.min(homeERA, awayERA);
      const worse = homeERA < awayERA ? awayDisplayName : homeDisplayName;
      const worseERA = Math.max(homeERA, awayERA);
      paragraphs.push(
        `${betterTeam}'s ${better} posts an ${eraDesc(betterERA)} ${betterERA.toFixed(2)} ERA this season, while ${worse} has been ${eraDesc(worseERA)} at ${worseERA.toFixed(2)}. There is a clear gap in starting pitching quality.`
      );
    } else {
      paragraphs.push(
        `Both starters carry similar ERAs, setting the stage for a potential pitchers' duel. WHIP: ${awayDisplayName} ${awayWHIP.toFixed(2)}, ${homeDisplayName} ${homeWHIP.toFixed(2)}.`
      );
    }

    paragraphs.push(
      `Advanced metrics: ${awayDisplayName} — FIP ${awayFIP.toFixed(2)}, K% ${awayKPct}%, ${awayIP.toFixed(1)} IP / ${homeDisplayName} — FIP ${homeFIP.toFixed(2)}, K% ${homeKPct}%, ${homeIP.toFixed(1)} IP`
    );

    sections.push({ title: "Today's Starting Matchup", paragraphs });
  } else if (homeStarter || awayStarter) {
    const paragraphs: string[] = [];
    const knownStarter = homeStarter ?? awayStarter;
    const knownSeason = homeStarter ? homeStarterSeason : awayStarterSeason;
    const knownTeam = homeStarter ? homeName : awayName;
    if (knownStarter && knownSeason) {
      const dn = displayName(knownStarter.id, knownStarter.name);
      paragraphs.push(
        `${knownTeam} starter ${dn} carries a ${num(knownSeason.era).toFixed(2)} ERA with a ${num(knownSeason.wins)}-${num(knownSeason.losses)} record this season. The opposing starter has not yet been announced.`
      );
    }
    if (paragraphs.length > 0) {
      sections.push({ title: "Today's Starting Matchup", paragraphs });
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
      sections.push({ title: "Career H2H Analysis", paragraphs: matchupParagraphs });
    }
  }

  // 3. Team Strength & Season Record (always available, doesn't need starters)
  {
    const paragraphs: string[] = [];

    // Fetch team standings for season record
    try {
      const season = homeStarterSeason ? new Date().getFullYear() : new Date().getFullYear() - 1;
      const standingsRes = await fetch(
        `https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=${season}&standingsTypes=regularSeason`,
        { next: { revalidate: 3600 } }
      );
      if (standingsRes.ok) {
        const standingsData = await standingsRes.json();
        const homeTeamId = boxscore.teams.home.team.id;
        const awayTeamId = boxscore.teams.away.team.id;

        let homeRecord: any = null;
        let awayRecord: any = null;
        for (const rec of standingsData.records ?? []) {
          for (const tr of rec.teamRecords ?? []) {
            if (tr.team.id === homeTeamId) homeRecord = tr;
            if (tr.team.id === awayTeamId) awayRecord = tr;
          }
        }

        if (homeRecord && awayRecord) {
          const hPct = parseFloat(homeRecord.winningPercentage);
          const aPct = parseFloat(awayRecord.winningPercentage);
          const hRS = num(homeRecord.runsScored);
          const hRA = num(homeRecord.runsAllowed);
          const aRS = num(awayRecord.runsScored);
          const aRA = num(awayRecord.runsAllowed);
          const hRD = hRS - hRA;
          const aRD = aRS - aRA;

          paragraphs.push(
            `${season} season record: ${awayName} ${awayRecord.wins}-${awayRecord.losses} (${awayRecord.winningPercentage}), ${homeName} ${homeRecord.wins}-${homeRecord.losses} (${homeRecord.winningPercentage}).`
          );

          if (Math.abs(hPct - aPct) >= 0.05) {
            const better = hPct > aPct ? homeName : awayName;
            const worse = hPct > aPct ? awayName : homeName;
            paragraphs.push(`${better} holds the edge in the season standings, though ${worse} can't be counted out based on head-to-head matchups.`);
          }

          // Run differential analysis
          if (hRD > 50 || aRD > 50 || hRD < -50 || aRD < -50) {
            const hRDStr = hRD > 0 ? `+${hRD}` : `${hRD}`;
            const aRDStr = aRD > 0 ? `+${aRD}` : `${aRD}`;
            paragraphs.push(`Run differential: ${awayName} ${aRDStr}, ${homeName} ${hRDStr}. ${
              Math.abs(hRD) > Math.abs(aRD) && hRD > 0
                ? `${homeName} boasts superior run production.`
                : Math.abs(aRD) > Math.abs(hRD) && aRD > 0
                ? `${awayName} boasts superior run production.`
                : "Both clubs are evenly matched in run production."
            }`);
          }

          // Streak info
          const hStreak = homeRecord.streak?.streakCode ?? "";
          const aStreak = awayRecord.streak?.streakCode ?? "";
          if (hStreak || aStreak) {
            const parts: string[] = [];
            if (aStreak) parts.push(`${awayName} on a ${aStreak.startsWith("W") ? aStreak.replace("W","") + "-game win streak" : aStreak.replace("L","") + "-game losing streak"}`);
            if (hStreak) parts.push(`${homeName} on a ${hStreak.startsWith("W") ? hStreak.replace("W","") + "-game win streak" : hStreak.replace("L","") + "-game losing streak"}`);
            paragraphs.push(`Recent form: ${parts.join(", ")}.`);
          }
        }
      }
    } catch {}

    if (homeStarterSeason && awayStarterSeason) {
      const homeERA = num(homeStarterSeason.era);
      const awayERA = num(awayStarterSeason.era);
      const pitchAdvantage = homeERA < awayERA ? homeName : awayName;
      paragraphs.push(`Based on starting pitching, ${pitchAdvantage} holds the edge.`);
    }

    if (venueName) {
      const venLower = venueName.toLowerCase();
      if (venLower.includes("coors")) {
        paragraphs.push(`Coors Field (5,280 ft elevation) is the most hitter-friendly park in MLB. Expect elevated scoring.`);
      } else if (venLower.includes("yankee")) {
        paragraphs.push(`Yankee Stadium's short right-field porch gives left-handed hitters a built-in advantage.`);
      } else if (venLower.includes("oracle")) {
        paragraphs.push(`Oracle Park is widely considered one of the most pitcher-friendly venues in baseball.`);
      }
    }

    if (paragraphs.length > 0) {
      sections.push({ title: "Team Season Comparison", paragraphs });
    }
  }

  // 3.5 Bullpen Analysis (always available)
  {
    const paragraphs: string[] = [];
    const season = homeStarterSeason ? new Date().getFullYear() : new Date().getFullYear() - 1;
    const rosterYear = new Date().getFullYear();

    try {
      const [homeRosterRes, awayRosterRes] = await Promise.all([
        fetch(`https://statsapi.mlb.com/api/v1/teams/${boxscore.teams.home.team.id}/roster?rosterType=active&season=${rosterYear}`, { next: { revalidate: 3600 } }),
        fetch(`https://statsapi.mlb.com/api/v1/teams/${boxscore.teams.away.team.id}/roster?rosterType=active&season=${rosterYear}`, { next: { revalidate: 3600 } }),
      ]);

      const homeRoster = homeRosterRes.ok ? (await homeRosterRes.json()).roster ?? [] : [];
      const awayRoster = awayRosterRes.ok ? (await awayRosterRes.json()).roster ?? [] : [];

      const getRelievers = (roster: any[]) => roster.filter((r: any) =>
        (r.position?.type === "Pitcher" || r.position?.code === "1") &&
        r.position?.abbreviation !== "SP"
      );

      const homeRelievers = getRelievers(homeRoster);
      const awayRelievers = getRelievers(awayRoster);

      // Fetch a couple key relievers' stats
      async function getRelieverSummary(relievers: any[], teamName: string): Promise<string | null> {
        if (relievers.length === 0) return null;
        const top3 = relievers.slice(0, 3);
        const stats = await Promise.all(top3.map(async (r: any) => {
          try {
            const res = await fetch(
              `https://statsapi.mlb.com/api/v1/people/${r.person.id}?hydrate=stats(group=[pitching],type=[season],season=${season})`,
              { next: { revalidate: 3600 } }
            );
            if (!res.ok) return null;
            const data = await res.json();
            const stat = data.people?.[0]?.stats?.[0]?.splits?.[0]?.stat;
            if (!stat || num(stat.inningsPitched) < 5) return null;
            return {
              name: displayName(r.person.id, r.person.fullName),
              era: stat.era,
              k: num(stat.strikeOuts),
              sv: num(stat.saves),
              hld: num(stat.holds),
              ip: stat.inningsPitched,
            };
          } catch { return null; }
        }));

        const valid = stats.filter((s: any) => s !== null);
        if (valid.length === 0) return null;

        const parts = valid.map((s: any) => {
          let role = "";
          if (s.sv >= 5) role = " (Closer)";
          else if (s.hld >= 5) role = " (Setup)";
          return `${s.name}${role} ${s.era} ERA, ${s.k} K in ${s.ip} IP`;
        });

        return `${teamName} bullpen: ${relievers.length} relievers on the active roster. Key arms: ${parts.join(", ")}.`;
      }

      const [homeBullpen, awayBullpen] = await Promise.all([
        getRelieverSummary(homeRelievers, homeName),
        getRelieverSummary(awayRelievers, awayName),
      ]);

      if (awayBullpen) paragraphs.push(awayBullpen);
      if (homeBullpen) paragraphs.push(homeBullpen);
    } catch {}

    if (paragraphs.length > 0) {
      sections.push({ title: "Bullpen Analysis", paragraphs });
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
      `Projected win probability: ${awayName} ${awayWinPct}% vs ${homeName} ${homeWinPct}%`
    );

    const reasons: string[] = [];
    if (homeERA < awayERA) {
      reasons.push(`${homeName}'s starter owns the lower ERA`);
    } else if (awayERA < homeERA) {
      reasons.push(`${awayName}'s starter owns the lower ERA`);
    }
    reasons.push(`${homeName}'s home-field advantage`);

    paragraphs.push(
      `Factors: ${reasons.join(", ")}. Of course, baseball's inherent randomness means actual results may differ.`
    );

    sections.push({ title: "Win Probability", paragraphs });
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
        `Workload comparison: ${awayDisplayName} averages ${awayAvgIP} IP per start vs. ${homeDisplayName} at ${homeAvgIP} IP. Getting six-plus innings from the starter significantly eases the bullpen burden.`
      );

      const homeHR = num(homeStarterSeason.homeRuns);
      const awayHR = num(awayStarterSeason.homeRuns);
      if (homeHR >= 10 || awayHR >= 10) {
        const vulnerable = homeHR > awayHR ? homeDisplayName : awayDisplayName;
        const hrCount = Math.max(homeHR, awayHR);
        paragraphs.push(
          `${vulnerable} has allowed ${hrCount} HR this season — a concern against a lineup with extra-base power.`
        );
      }
    }

    if (venueName) {
      const venLower = venueName.toLowerCase();
      if (venLower.includes("coors")) {
        paragraphs.push(
          `Coors Field (5,280 ft elevation) is the premier hitter's park in MLB. Scoring runs 30%+ above league average, late-inning comebacks are common here.`
        );
      } else if (venLower.includes("oracle") || venLower.includes("petco") || venLower.includes("kauffman")) {
        paragraphs.push(
          `${venueName} is classified as a pitcher-friendly park. Starter endurance becomes even more critical.`
        );
      }
    }

    if (paragraphs.length > 0) {
      sections.push({ title: "Key Tactical Points", paragraphs });
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
  const half = linescore.inningHalf === "Top" ? "Top" : "Bot";

  const paragraphs: string[] = [];

  if (homeRuns === awayRuns) {
    paragraphs.push(
      `${half} ${currentInning}: ${awayName} and ${homeName} are locked in a tight battle, knotted at ${homeRuns}-${awayRuns}.`
    );
  } else {
    const leader = homeRuns > awayRuns ? homeName : awayName;
    const trailer = homeRuns > awayRuns ? awayName : homeName;
    const leadScore = Math.max(homeRuns, awayRuns);
    const trailScore = Math.min(homeRuns, awayRuns);
    paragraphs.push(
      `${half} ${currentInning}: ${leader} leads ${leadScore}-${trailScore}. ${trailer} needs to mount a rally.`
    );
  }

  return [{ title: "Live Game", paragraphs }];
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
        `${awayName} and ${homeName} finished deadlocked at ${homeRuns}-${awayRuns}. Neither side could land the decisive blow in a tightly contested affair.`
      );
    } else if (diff >= 7) {
      paragraphs.push(
        `${winnerName} cruised to a blowout victory over ${loserName}, ${winScore}-${loseScore}. The game tilted early and never looked back.`
      );
    } else if (diff >= 4) {
      paragraphs.push(
        `${winnerName} topped ${loserName} ${winScore}-${loseScore}. A comfortable ${diff}-run margin reflected ${winnerName}'s steady command of the game.`
      );
    } else if (diff === 1) {
      paragraphs.push(
        `${winnerName} squeaked out a narrow win over ${loserName}, ${winScore}-${loseScore}. Tension ran high from start to finish in this one-run thriller.`
      );
    } else {
      paragraphs.push(
        `${winnerName} defeated ${loserName} ${winScore}-${loseScore}.`
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
        const half = biggestInning.side === "home" ? "bottom" : "top";
        paragraphs.push(
          `The turning point came in the ${half} of the ${biggestInning.num}${biggestInning.num === 1 ? "st" : biggestInning.num === 2 ? "nd" : biggestInning.num === 3 ? "rd" : "th"}. ${bigTeam} pushed across ${biggestInning.runs} runs to seize control of the game.`
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
        `A classic pitchers' duel: ${totalK} combined strikeouts between the two staffs.`
      );
    } else if (totalRuns >= 15) {
      paragraphs.push(
        `A full-blown slugfest: ${totalRuns} combined runs and ${totalHits} hits on the day.`
      );
    }

    sections.push({ title: "Game Summary", paragraphs });
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
        let hitDetail = `${bestHitter.hits}-for-${bestHitter.ab}`;
        if (bestHitter.hr > 0) hitDetail += `, ${bestHitter.hr} HR`;
        if (bestHitter.rbi > 0) hitDetail += `, ${bestHitter.rbi} RBI`;
        lines.push(`${bestHitter.name} led ${teamName}'s offense, going ${hitDetail}.`);
      }

      if (bestPitcher) {
        const pitcherDesc = bestPitcher.isStarter ? "starter" : "reliever";
        let pitchDetail = `${bestPitcher.ipDisplay} IP, ${bestPitcher.er} ER, ${bestPitcher.k} K`;
        let resultTag = "";
        if (bestPitcher.wins > 0) resultTag = " and earned the win.";
        else if (bestPitcher.saves > 0) resultTag = " and recorded the save.";
        else if (bestPitcher.holds > 0) resultTag = " and picked up a hold.";
        else resultTag = " and anchored the pitching staff.";
        lines.push(`${teamName} ${pitcherDesc} ${bestPitcher.name} threw ${pitchDetail}${resultTag}`);
      }

      if (lines.length > 0) paragraphs.push(lines.join(" "));
    }
    if (paragraphs.length > 0) sections.push({ title: "Key Players", paragraphs });
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

        let starterLine = `${teamName} starter ${starter.name}: ${starter.ipDisplay} IP, ${starter.hits} H, ${starter.er} ER, ${starter.k} K, ${starter.bb} BB (${starter.pitchCount} pitches).`;

        if (isQS) {
          starterLine += ` Quality start. K/IP of ${kPerIP} reflects ${parseFloat(kPerIP) >= 1.0 ? "dominant strikeout stuff" : "efficient pitching"}.`;
        } else if (starter.ip >= 7 && starter.er <= 2) {
          starterLine += ` Seven-plus innings minimized bullpen usage. Pitches per inning: ${pitchesPerIP} — ${parseFloat(pitchesPerIP) <= 15 ? "a model of efficiency" : "on the high side"}.`;
        } else if (starter.ip < 4 && starter.er >= 4) {
          starterLine += ` An early exit before recording ${starter.ip.toFixed(0)} full innings. K/BB ratio of ${kbbRatio} points to command issues.`;
        } else if (starter.ip < 5) {
          starterLine += ` Failed to complete five innings, leaving extra burden on the bullpen.`;
        }

        if (starter.hr >= 2) {
          starterLine += ` ${starter.hr} HR allowed is a troubling rate of long-ball damage.`;
        }

        lines.push(starterLine);
      }

      if (relievers.length > 0) {
        const bullpenIP = relievers.reduce((s, p) => s + p.ip, 0);
        const bullpenER = relievers.reduce((s, p) => s + p.er, 0);
        const bullpenK = relievers.reduce((s, p) => s + p.k, 0);
        const bullpenERA = bullpenIP > 0 ? ((bullpenER / bullpenIP) * 9).toFixed(2) : "-";

        if (bullpenER === 0 && bullpenIP >= 2) {
          lines.push(`The bullpen (${relievers.length} pitchers) was scoreless over ${bullpenIP.toFixed(1)} IP with ${bullpenK} K — a flawless relief effort.`);
        } else if (bullpenER >= 4) {
          lines.push(`Bullpen ERA ${bullpenERA} (${bullpenIP.toFixed(1)} IP, ${bullpenER} ER). Relief failures directly impacted the outcome.`);
        } else if (bullpenIP > 0) {
          lines.push(`Bullpen: ${bullpenIP.toFixed(1)} IP, ${bullpenER} ER, ${bullpenK} K (ERA ${bullpenERA}).`);
        }
      }

      if (lines.length > 0) paragraphs.push(lines.join(" "));
    }
    if (paragraphs.length > 0) sections.push({ title: "Pitching Report", paragraphs });
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

      let overview = `${teamName}: ${totalHits} H, ${totalRBI} RBI (team AVG ${teamAVG}).`;
      if (totalXBH >= 3) overview += ` ${totalXBH} extra-base hits (${totalHR} HR) — impressive power display.`;
      else if (totalHR > 0) overview += ` Includes ${totalHR} HR.`;
      if (totalBB >= 4) overview += ` Drew ${totalBB} walks, boosting on-base production.`;
      paragraphs.push(overview);

      // Multi-hit players with detail
      const multiHitters = batters.filter(b => b.hits >= 2);
      if (multiHitters.length > 0) {
        const names = multiHitters.map(b => {
          let detail = `${b.hits}-for-${b.ab}`;
          if (b.hr > 0) detail += `, ${b.hr} HR`;
          if (b.rbi >= 2) detail += `, ${b.rbi} RBI`;
          return `${b.name} (${detail})`;
        });
        paragraphs.push(`Multi-hit games: ${names.join(", ")}.`);
      }

      // Hitless cleanup hitters (3-5 spot)
      const cleanupHitters = batters.slice(2, 5).filter(b => b.ab >= 3 && b.hits === 0);
      if (cleanupHitters.length >= 2) {
        const names = cleanupHitters.map(b => `${b.name} (0-for-${b.ab})`);
        paragraphs.push(`Cleanup cold: ${names.join(", ")}. The silence from the heart of the order proved costly.`);
      }
    }
    if (paragraphs.length > 0) sections.push({ title: "Hitting Analysis", paragraphs });
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
          `This game featured ${leadChanges} lead changes — a true back-and-forth contest.`
        );
      }

      // Shutout
      if ((homeRuns === 0 || awayRuns === 0) && homeRuns !== awayRuns) {
        const shutoutTeam = homeRuns === 0 ? awayName : homeName;
        const shutTeam = homeRuns === 0 ? homeName : awayName;
        paragraphs.push(
          `${shutoutTeam}'s pitching staff threw a shutout, blanking ${shutTeam}'s lineup.`
        );
      }
    }
    if (paragraphs.length > 0) sections.push({ title: "Turning Points", paragraphs });
  }

  return sections;
}

// ============================================================
// MAIN COMPONENT (async server component)
// ============================================================

export default async function AICommentary({
  boxscore,
  linescore,
  gameState,
  homeStarterSeason,
  awayStarterSeason,
  homeStarter,
  awayStarter,
  venueName,
}: AICommentaryProps) {
  const homeName = getTeamName(boxscore, "home");
  const awayName = getTeamName(boxscore, "away");
  // Use gameState (abstractGameState) as single source of truth
  const isFinished = gameState === "Final";
  const isLive = gameState === "Live";

  let sections: { title: string; paragraphs: string[] }[] = [];
  let headline = "";
  let headerLabel = "";
  let headerColor = "border-blue-500";

  if (isFinished) {
    // POST-GAME
    headerLabel = "Post-Game Analysis";
    headerColor = "border-slate-500";
    sections = generatePostGameAnalysis(boxscore, linescore);

    const homeRuns = num(linescore.teams?.home?.runs);
    const awayRuns = num(linescore.teams?.away?.runs);
    const diff = Math.abs(homeRuns - awayRuns);
    const winner = homeRuns >= awayRuns ? homeName : awayName;
    const loser = homeRuns >= awayRuns ? awayName : homeName;

    if (homeRuns !== awayRuns) {
      if (diff >= 5) headline = `${winner} routs ${loser} ${Math.max(homeRuns, awayRuns)}-${Math.min(homeRuns, awayRuns)}`;
      else if (diff === 1) headline = `${winner} edges ${loser} ${Math.max(homeRuns, awayRuns)}-${Math.min(homeRuns, awayRuns)}`;
      else headline = `${winner} tops ${loser} ${Math.max(homeRuns, awayRuns)}-${Math.min(homeRuns, awayRuns)}`;
    } else {
      headline = `${awayName} ${awayRuns} - ${homeRuns} ${homeName}`;
    }
  } else if (isLive) {
    // LIVE
    headerLabel = "Live Game";
    headerColor = "border-green-500";
    sections = generateLiveStatus(boxscore, linescore);

    const homeRuns = num(linescore.teams?.home?.runs);
    const awayRuns = num(linescore.teams?.away?.runs);
    const inning = linescore.currentInningOrdinal ?? "";
    const half = linescore.inningHalf === "Top" ? "Top" : "Bot";
    headline = `${awayName} ${awayRuns} - ${homeRuns} ${homeName} (${half} ${inning})`;
  } else {
    // PRE-GAME (async - fetches matchup data)
    headerLabel = "Pre-Game Analysis";
    headerColor = "border-blue-500";
    sections = await generatePreGameAnalysis(
      boxscore,
      homeStarterSeason,
      awayStarterSeason,
      homeStarter,
      awayStarter,
      venueName,
    );
    headline = `${awayName} vs ${homeName} Preview`;
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
            ? "This article was auto-generated from box score data."
            : isLive
            ? "Game in progress — data updates in real time."
            : "This analysis was auto-generated from season stats and career head-to-head data."}
        </span>
        <span className="text-[10px] text-slate-500 font-mono">
          StatScope AI Engine
        </span>
      </div>
    </article>
  );
}
