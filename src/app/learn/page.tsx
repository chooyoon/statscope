import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Learn Sabermetrics | Baseball Analytics Guide | StatScope",
  description:
    "A comprehensive guide to sabermetrics and advanced baseball analytics. Learn about wOBA, wRC+, FIP, WAR, BABIP, and more with real-world examples and explanations.",
  openGraph: {
    title: "Learn Sabermetrics - The Complete Baseball Analytics Guide",
    description:
      "Master advanced baseball statistics. Understand wOBA, wRC+, FIP, WAR, and more with clear explanations.",
  },
};

const HITTING_METRICS = [
  {
    name: "wOBA (Weighted On-Base Average)",
    range: "Scale: ~.290 (avg), .340 (good), .370+ (excellent)",
    what: "wOBA assigns different weights to each way a batter reaches base. Unlike traditional batting average, which treats all hits equally, wOBA recognizes that a home run is far more valuable than a single. It uses linear weights derived from run expectancy to measure a hitter's overall offensive contribution per plate appearance.",
    why: "Traditional stats like batting average ignore walks and treat all hits the same. A player who hits .280 with 40 home runs is far more valuable than one who hits .310 with only singles. wOBA captures this difference by weighting each outcome proportionally to its run value.",
    formula: "wOBA = (0.69 x BB + 0.72 x HBP + 0.87 x 1B + 1.22 x 2B + 1.56 x 3B + 2.01 x HR) / (AB + BB - IBB + SF + HBP)",
    example: "In the 2024 season, Aaron Judge posted a .441 wOBA, ranking among the best in baseball. This reflects not just his batting average but his elite walk rate and power numbers. Meanwhile, a contact-oriented hitter with a higher batting average might have a lower wOBA because their hits are predominantly singles.",
  },
  {
    name: "wRC+ (Weighted Runs Created Plus)",
    range: "Scale: 100 = league average, 120+ (great), 150+ (elite)",
    what: "wRC+ takes wOBA and adjusts it for park factors and league environment, then scales it so that 100 always equals league average. A wRC+ of 130 means the player created 30% more runs than the average hitter. This makes it one of the best single-number stats for comparing hitters across different eras and ballparks.",
    why: "Raw stats are heavily influenced by where a player plays. A hitter in Coors Field (Colorado) naturally gets inflated numbers due to the thin air, while a hitter in a pitcher-friendly park like Oracle Park (San Francisco) might look worse than he actually is. wRC+ levels the playing field.",
    formula: "wRC+ = ((wRAA/PA + League Runs/PA) + (League Runs/PA - Park Factor x League Runs/PA)) / (League wRC/PA) x 100",
    example: "If Player A has a wRC+ of 140 at Coors Field and Player B has a wRC+ of 140 at Petco Park, they are equally valuable hitters despite likely having very different raw numbers. The park adjustment ensures a fair comparison.",
  },
  {
    name: "OPS+ (On-Base Plus Slugging Plus)",
    range: "Scale: 100 = league average, 120+ (great), 150+ (elite)",
    what: "OPS+ adjusts a player's OPS (On-Base Percentage + Slugging Percentage) for the league and park they play in, normalizing to 100 as league average. While simpler than wRC+, it provides a quick and reasonably accurate measure of a batter's overall offensive ability.",
    why: "Raw OPS varies significantly between eras and ballparks. An OPS of .800 meant something very different in the steroid era compared to the current low-offense environment. OPS+ allows meaningful comparisons across all contexts.",
    formula: "OPS+ = 100 x (OBP/lgOBP + SLG/lgSLG - 1), adjusted for park factor",
    example: "Ted Williams' career OPS+ of 190 can be directly compared to Mike Trout's career OPS+ of 176 despite playing in completely different eras. Both numbers tell us exactly how much better than average each player was in their respective context.",
  },
  {
    name: "ISO (Isolated Power)",
    range: "Scale: .120 (below avg), .160 (avg), .200+ (great), .250+ (elite)",
    what: "ISO measures a batter's raw power by subtracting batting average from slugging percentage. This isolates the extra bases a hitter generates beyond singles. A high ISO indicates a true power hitter, regardless of their overall batting average.",
    why: "Slugging percentage includes singles, which can inflate the number for high-average, low-power hitters. ISO strips away singles to show pure extra-base hit ability. Two players with identical slugging percentages can have very different ISO values.",
    formula: "ISO = SLG - AVG = (2B + 2 x 3B + 3 x HR) / AB",
    example: "A player hitting .250 with .500 SLG has an ISO of .250 (elite power). Another hitting .320 with .450 SLG has an ISO of only .130 (below average power). Despite the second player having better traditional stats, the first player is the far superior power hitter.",
  },
  {
    name: "BABIP (Batting Average on Balls in Play)",
    range: "Scale: League average ~.300, varies by player skill and speed",
    what: "BABIP measures how often a ball put in play (not a home run, strikeout, or walk) falls for a hit. It helps distinguish between skill and luck in a player's batting average. While there is a skill component (line-drive hitters and fast runners tend to have higher BABIPs), extreme values often indicate unsustainable performance.",
    why: "If a player has a .380 BABIP, their batting average is likely inflated by good fortune and may regress. Conversely, a .220 BABIP suggests bad luck that should improve. Analysts use BABIP to predict future performance changes and identify buy-low or sell-high candidates.",
    formula: "BABIP = (H - HR) / (AB - K - HR + SF)",
    example: "If a pitcher has a 2.50 ERA but a .220 BABIP, their ERA is likely being propped up by luck on balls in play. Over time, more of those batted balls will find holes, and the ERA will likely rise. BABIP helps analysts see through surface-level results.",
  },
  {
    name: "K% and BB% (Strikeout and Walk Rate)",
    range: "K%: ~22% avg (lower is better for hitters). BB%: ~8% avg (higher is better)",
    what: "Strikeout rate and walk rate express how often a batter strikes out or walks as a percentage of their plate appearances. These are 'three true outcomes' stats that are entirely within the control of the batter and pitcher, unaffected by defense or luck.",
    why: "These rates are among the most stable and predictive stats in baseball. A hitter with a low K% and high BB% demonstrates excellent plate discipline and bat control. These numbers stabilize quickly (around 60 plate appearances for K%, 120 for BB%) making them useful for early-season evaluation.",
    formula: "K% = Strikeouts / Plate Appearances, BB% = Walks / Plate Appearances",
    example: "Juan Soto consistently maintains a BB% above 15%, nearly double the league average. This elite plate discipline means he gets on base at an extraordinary rate even when he is not getting hits, making him one of the most valuable offensive players in baseball.",
  },
];

const PITCHING_METRICS = [
  {
    name: "FIP (Fielding Independent Pitching)",
    range: "Scale: 3.20 (good), 3.00 (great), sub-2.50 (elite)",
    what: "FIP estimates what a pitcher's ERA should be based solely on outcomes the pitcher controls: strikeouts, walks, hit-by-pitches, and home runs. It removes the influence of defense and luck on balls in play, providing a more accurate picture of a pitcher's true skill level.",
    why: "ERA is heavily influenced by factors outside a pitcher's control. A pitcher with a great defense behind him will have a lower ERA than his skills warrant, while a pitcher with a poor defense will look worse. FIP strips away these external factors to reveal the pitcher's actual ability.",
    formula: "FIP = ((13 x HR) + (3 x (BB + HBP)) - (2 x K)) / IP + FIP Constant",
    example: "If a pitcher has a 4.50 ERA but a 3.20 FIP, the large gap suggests they have been unlucky with balls in play or have a below-average defense. Their future performance is more likely to align with the 3.20 FIP than the 4.50 ERA.",
  },
  {
    name: "xFIP (Expected Fielding Independent Pitching)",
    range: "Scale: similar to FIP, but more stable year-to-year",
    what: "xFIP is a variation of FIP that replaces a pitcher's actual home run total with an expected number based on their fly ball rate and the league-average HR/FB ratio. Since home run rates on fly balls fluctuate significantly from year to year, xFIP provides a more stable estimate of true talent.",
    why: "Even FIP can be skewed by a pitcher getting lucky or unlucky with home runs. A pitcher who has an unusually low HR/FB rate one year will likely see it rise the next year. xFIP smooths out this volatility for a more predictive measure.",
    formula: "xFIP = ((13 x (Fly Balls x League HR/FB rate)) + (3 x (BB + HBP)) - (2 x K)) / IP + FIP Constant",
    example: "A pitcher with a 2.80 FIP but a 3.40 xFIP is likely benefiting from an unsustainably low home run rate. The xFIP suggests that some of those fly balls that stayed in the park will eventually go over the fence.",
  },
  {
    name: "WHIP (Walks + Hits per Inning Pitched)",
    range: "Scale: 1.30 (avg), 1.15 (good), sub-1.00 (elite)",
    what: "WHIP measures how many baserunners a pitcher allows per inning. While simpler than FIP, it provides a quick and intuitive measure of how effectively a pitcher keeps runners off base. It is one of the most commonly used pitching stats for a good reason: fewer baserunners mean fewer runs.",
    why: "WHIP is easy to understand and correlates well with run prevention. A pitcher with a low WHIP is consistently putting up clean innings, which is the foundation of pitching success. It is more granular than ERA and less abstract than FIP.",
    formula: "WHIP = (Walks + Hits) / Innings Pitched",
    example: "Historically, dominant pitchers like Pedro Martinez (career 1.054 WHIP) and Mariano Rivera (career 1.000 WHIP) were elite at keeping runners off base. Modern aces typically post WHIPs around 1.00-1.10.",
  },
  {
    name: "ERA+ (Adjusted ERA)",
    range: "Scale: 100 = league average, 130+ (great), 150+ (elite)",
    what: "ERA+ adjusts a pitcher's ERA for the league average and their home ballpark, then inverts the scale so that higher numbers are better. An ERA+ of 130 means the pitcher's ERA is 30% better than league average after adjustments. This allows direct comparisons across eras and ballparks.",
    why: "A 3.50 ERA in the dead-ball era meant something entirely different than a 3.50 ERA in the steroid era. ERA+ contextualizes performance so that Christy Mathewson can be compared to Greg Maddux to Jacob deGrom on equal footing.",
    formula: "ERA+ = 100 x (League ERA / (Park Factor x ERA))",
    example: "Pedro Martinez's 2000 season had an ERA+ of 291, widely considered one of the greatest pitching seasons ever. This means his ERA was nearly three times better than the league average after adjusting for Fenway Park's hitter-friendly environment.",
  },
  {
    name: "K/9 and BB/9 (Strikeouts and Walks per 9 Innings)",
    range: "K/9: 8.0 (avg), 10.0+ (elite). BB/9: 3.0 (avg), sub-2.0 (elite)",
    what: "K/9 measures how many batters a pitcher strikes out per nine innings, while BB/9 measures walks allowed. Together, they paint a picture of a pitcher's stuff and command. High strikeout rates with low walk rates indicate dominant, efficient pitching.",
    why: "Strikeouts are the most reliable way to get outs since they bypass the defense entirely. Walk rate reflects command and control. The K/BB ratio (K/9 divided by BB/9) is one of the best quick indicators of pitching quality.",
    formula: "K/9 = (Strikeouts x 9) / IP, BB/9 = (Walks x 9) / IP",
    example: "A pitcher with 12.0 K/9 and 1.8 BB/9 has a K/BB ratio of 6.67, indicating elite stuff and pinpoint command. Contrast this with a pitcher striking out 10.0 per nine but walking 4.5, whose K/BB of 2.22 suggests wildness that undermines his strikeout ability.",
  },
];

const COMPREHENSIVE_METRICS = [
  {
    name: "WAR (Wins Above Replacement)",
    range: "Scale: 0-1 (backup), 2 (starter), 4+ (All-Star), 6+ (MVP), 8+ (historic)",
    what: "WAR is the single most comprehensive stat in baseball analytics. It estimates how many wins a player contributes to their team above what a replacement-level player (a freely available minor-leaguer or AAAA player) would contribute. It accounts for hitting, baserunning, fielding, and positional value for position players, and pitching performance for pitchers.",
    why: "WAR allows you to compare a Gold Glove shortstop who hits .270 to a slugging first baseman who hits .290. It provides a common currency for all types of value. While not perfect, WAR is the best single-number summary of a player's total contribution to their team.",
    versions: "There are two major versions: fWAR (FanGraphs, uses FIP for pitchers) and bWAR (Baseball-Reference, uses RA/9). Differences are usually small but can matter for specific players.",
    example: "Shohei Ohtani's unique two-way value is best captured by WAR. In 2021, he accumulated approximately 9.0 WAR, with contributions from both his pitching and hitting. No other stat can capture the full scope of his dual-threat ability like WAR does.",
  },
  {
    name: "WPA (Win Probability Added)",
    range: "Cumulative stat, context-dependent. 3.0+ is excellent for a season.",
    what: "WPA measures how much each plate appearance changes the team's probability of winning. A go-ahead home run in the 9th inning adds far more WPA than a solo shot in a blowout. It captures the 'clutch' value of a player's contributions by weighting each play by its impact on the game outcome.",
    why: "While most advanced stats are context-neutral (treating a hit in a blowout the same as one in a close game), WPA captures the narrative of baseball. It tells us who came through when it mattered most and who had the biggest impact on actual wins and losses.",
    example: "A walk-off home run in a tied game might add 0.40 to 0.50 WPA in a single plate appearance, as it shifts the team's win probability from roughly 50% to 100%. In contrast, a solo homer making the score 10-1 might add only 0.01 WPA.",
  },
  {
    name: "RE24 (Run Expectancy Based on 24 Base-Out States)",
    range: "Cumulative stat, context-dependent but situationally aware",
    what: "RE24 measures how each plate appearance changes the expected number of runs scored in an inning based on the 24 possible base-out states (8 base states x 3 out states). It is more nuanced than basic counting stats because it accounts for the game situation.",
    why: "A single with the bases loaded and no outs is far more valuable than a single with nobody on and two outs. RE24 quantifies this difference by measuring how much each event changes the expected run scoring for the remainder of the inning.",
    example: "With runners on second and third with one out, the run expectancy is about 1.4 runs. If a batter hits a two-RBI double, the new state (runner on second, one out) has a run expectancy of about 0.7. The RE24 for that at-bat would be approximately 2.0 + 0.7 - 1.4 = 1.3.",
  },
];

export default function LearnPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="mx-auto max-w-4xl px-4 py-12">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white mb-4">
            The Complete Guide to{" "}
            <span className="text-blue-600">Sabermetrics</span>
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Sabermetrics is the empirical analysis of baseball through
            statistics. This guide explains the most important advanced metrics
            used by MLB front offices, analysts, and informed fans to evaluate
            player performance beyond traditional box score stats.
          </p>
        </div>

        {/* Table of Contents */}
        <nav className="mb-12 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4">
            Table of Contents
          </h2>
          <ol className="space-y-2 text-sm">
            <li>
              <a href="#what-is-sabermetrics" className="text-blue-600 hover:underline">
                1. What is Sabermetrics?
              </a>
            </li>
            <li>
              <a href="#why-advanced-stats" className="text-blue-600 hover:underline">
                2. Why Advanced Stats Matter
              </a>
            </li>
            <li>
              <a href="#hitting-metrics" className="text-blue-600 hover:underline">
                3. Hitting Metrics
              </a>
            </li>
            <li>
              <a href="#pitching-metrics" className="text-blue-600 hover:underline">
                4. Pitching Metrics
              </a>
            </li>
            <li>
              <a href="#comprehensive-metrics" className="text-blue-600 hover:underline">
                5. Comprehensive Metrics (WAR, WPA, RE24)
              </a>
            </li>
            <li>
              <a href="#park-factors" className="text-blue-600 hover:underline">
                6. Understanding Park Factors
              </a>
            </li>
            <li>
              <a href="#sample-size" className="text-blue-600 hover:underline">
                7. Sample Size and Stabilization
              </a>
            </li>
            <li>
              <a href="#how-to-use" className="text-blue-600 hover:underline">
                8. How to Use Sabermetrics as a Fan
              </a>
            </li>
          </ol>
        </nav>

        {/* Section 1: What is Sabermetrics */}
        <section id="what-is-sabermetrics" className="mb-12">
          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-8">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-4">
              1. What is Sabermetrics?
            </h2>
            <div className="space-y-4 text-sm text-slate-600 dark:text-slate-400 leading-7">
              <p>
                The term &quot;sabermetrics&quot; was coined by Bill James in the 1980s,
                derived from SABR (Society for American Baseball Research). It
                refers to the empirical analysis of baseball through objective,
                statistical evidence rather than subjective observation or
                traditional scouting alone.
              </p>
              <p>
                While traditional stats like batting average, RBIs, and wins
                have been the foundation of baseball evaluation for over a
                century, sabermetrics revealed that these numbers often fail to
                capture a player&apos;s true value. Batting average ignores walks and
                extra-base hits. RBIs depend heavily on teammates getting on
                base. Pitcher wins are influenced more by run support than
                pitching quality.
              </p>
              <p>
                Modern sabermetrics goes far beyond simple stat replacement. It
                encompasses win probability models, pitch-tracking data
                (Statcast), defensive metrics, baserunning analysis, and
                predictive modeling. Every MLB front office now employs teams of
                analysts who use these methods to make roster decisions,
                in-game strategy calls, and long-term player development plans.
              </p>
              <p>
                The &quot;Moneyball&quot; revolution, popularized by Michael Lewis&apos;s 2003
                book about the Oakland Athletics, brought sabermetrics into the
                mainstream. Billy Beane and Paul DePodesta demonstrated that
                undervalued statistical traits, particularly on-base percentage,
                could build a competitive team on a limited budget. Today, every
                team uses analytics, but the principles remain the same:
                measure what matters, ignore what does not, and find value where
                others overlook it.
              </p>
            </div>
          </div>
        </section>

        {/* Section 2: Why Advanced Stats Matter */}
        <section id="why-advanced-stats" className="mb-12">
          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-8">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-4">
              2. Why Advanced Stats Matter
            </h2>
            <div className="space-y-4 text-sm text-slate-600 dark:text-slate-400 leading-7">
              <p>
                Traditional baseball statistics were designed in the 19th
                century for newspaper box scores. They needed to be simple
                enough to calculate by hand and fit in narrow newspaper columns.
                While serviceable for their era, they carry significant
                limitations that can mislead evaluation.
              </p>
              <h3 className="text-base font-bold text-slate-700 dark:text-slate-300 mt-6">
                The Problem with Traditional Stats
              </h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>Batting Average</strong> treats a bloop single the
                  same as a line-drive double and completely ignores walks. A
                  hitter who walks 100 times gets no credit in batting average.
                </li>
                <li>
                  <strong>RBIs</strong> depend almost entirely on whether
                  teammates are on base. The best hitter in baseball batting
                  leadoff will have fewer RBIs than an average hitter in the
                  cleanup spot on a high-scoring team.
                </li>
                <li>
                  <strong>Pitcher Wins</strong> require run support from the
                  offense. A pitcher who throws 7 shutout innings but gets no
                  run support earns a loss, while a pitcher who allows 5 runs
                  in 5 innings can get a win if his team scores 6.
                </li>
                <li>
                  <strong>Errors</strong> are subjectively scored by official
                  scorers and fail to account for range. A shortstop who cannot
                  reach a ball hit up the middle makes no error, while a
                  superior fielder who dives and barely misses it might be
                  charged with one.
                </li>
              </ul>
              <h3 className="text-base font-bold text-slate-700 dark:text-slate-300 mt-6">
                What Advanced Stats Offer
              </h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>Context neutrality:</strong> Metrics like wRC+ adjust
                  for park and league, enabling fair comparisons across
                  different environments.
                </li>
                <li>
                  <strong>Predictive power:</strong> FIP predicts future ERA
                  better than past ERA does. Advanced stats help identify which
                  performances are sustainable and which are fluky.
                </li>
                <li>
                  <strong>Comprehensive evaluation:</strong> WAR combines
                  offense, defense, and baserunning into a single number, showing
                  total player value.
                </li>
                <li>
                  <strong>Process over results:</strong> Advanced stats focus on
                  the quality of a player&apos;s process (hard contact, plate
                  discipline, pitch quality) rather than results that may be
                  influenced by luck.
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 3: Hitting Metrics */}
        <section id="hitting-metrics" className="mb-12">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-6">
            3. Hitting Metrics
          </h2>
          <div className="space-y-6">
            {HITTING_METRICS.map((m) => (
              <div
                key={m.name}
                className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-8"
              >
                <h3 className="text-lg font-bold text-blue-600 mb-1">
                  {m.name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 font-medium">
                  {m.range}
                </p>
                <div className="space-y-3 text-sm text-slate-600 dark:text-slate-400 leading-7">
                  <div>
                    <h4 className="font-semibold text-slate-700 dark:text-slate-300">
                      What it measures
                    </h4>
                    <p>{m.what}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-700 dark:text-slate-300">
                      Why it matters
                    </h4>
                    <p>{m.why}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-700/50 p-4">
                    <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Formula
                    </h4>
                    <code className="text-xs text-blue-600 dark:text-blue-400 break-all">
                      {m.formula}
                    </code>
                  </div>
                  <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-4">
                    <h4 className="font-semibold text-blue-700 dark:text-blue-300 mb-1">
                      Real-World Example
                    </h4>
                    <p className="text-blue-600 dark:text-blue-400 text-xs">
                      {m.example}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 4: Pitching Metrics */}
        <section id="pitching-metrics" className="mb-12">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-6">
            4. Pitching Metrics
          </h2>
          <div className="space-y-6">
            {PITCHING_METRICS.map((m) => (
              <div
                key={m.name}
                className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-8"
              >
                <h3 className="text-lg font-bold text-blue-600 mb-1">
                  {m.name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 font-medium">
                  {m.range}
                </p>
                <div className="space-y-3 text-sm text-slate-600 dark:text-slate-400 leading-7">
                  <div>
                    <h4 className="font-semibold text-slate-700 dark:text-slate-300">
                      What it measures
                    </h4>
                    <p>{m.what}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-700 dark:text-slate-300">
                      Why it matters
                    </h4>
                    <p>{m.why}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-700/50 p-4">
                    <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Formula
                    </h4>
                    <code className="text-xs text-blue-600 dark:text-blue-400 break-all">
                      {m.formula}
                    </code>
                  </div>
                  <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-4">
                    <h4 className="font-semibold text-blue-700 dark:text-blue-300 mb-1">
                      Real-World Example
                    </h4>
                    <p className="text-blue-600 dark:text-blue-400 text-xs">
                      {m.example}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 5: Comprehensive Metrics */}
        <section id="comprehensive-metrics" className="mb-12">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-6">
            5. Comprehensive Metrics
          </h2>
          <div className="space-y-6">
            {COMPREHENSIVE_METRICS.map((m) => (
              <div
                key={m.name}
                className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-8"
              >
                <h3 className="text-lg font-bold text-blue-600 mb-1">
                  {m.name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 font-medium">
                  {m.range}
                </p>
                <div className="space-y-3 text-sm text-slate-600 dark:text-slate-400 leading-7">
                  <div>
                    <h4 className="font-semibold text-slate-700 dark:text-slate-300">
                      What it measures
                    </h4>
                    <p>{m.what}</p>
                  </div>
                  {"versions" in m && m.versions && (
                    <div>
                      <h4 className="font-semibold text-slate-700 dark:text-slate-300">
                        Different Versions
                      </h4>
                      <p>{m.versions}</p>
                    </div>
                  )}
                  <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-4">
                    <h4 className="font-semibold text-blue-700 dark:text-blue-300 mb-1">
                      Real-World Example
                    </h4>
                    <p className="text-blue-600 dark:text-blue-400 text-xs">
                      {m.example}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 6: Park Factors */}
        <section id="park-factors" className="mb-12">
          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-8">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-4">
              6. Understanding Park Factors
            </h2>
            <div className="space-y-4 text-sm text-slate-600 dark:text-slate-400 leading-7">
              <p>
                Not all ballparks are created equal. Coors Field in Denver sits
                at 5,280 feet of elevation, where the thin air allows balls to
                travel farther and breaks on pitches to flatten. Oracle Park in
                San Francisco has dense marine air and deep outfield dimensions
                that suppress offense. These environmental differences can
                significantly inflate or deflate a player&apos;s raw statistics.
              </p>
              <p>
                Park factors quantify these differences. A park factor of 105
                for runs means that ballpark produces 5% more runs than average.
                A park factor of 95 means 5% fewer runs. When evaluating
                players, it is essential to account for where they play their
                home games.
              </p>
              <h3 className="text-base font-bold text-slate-700 dark:text-slate-300 mt-4">
                Notable Park Effects (2024)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                {[
                  { park: "Coors Field (COL)", factor: "~115", type: "Hitter-friendly", note: "Highest elevation in MLB, extreme run inflation" },
                  { park: "Globe Life Field (TEX)", factor: "~108", type: "Hitter-friendly", note: "Hot temperatures, carries well to left-center" },
                  { park: "Fenway Park (BOS)", factor: "~106", type: "Hitter-friendly", note: "Short left field wall (Green Monster), boosts doubles" },
                  { park: "Oracle Park (SF)", factor: "~92", type: "Pitcher-friendly", note: "Dense marine air, deep right-center, suppresses homers" },
                  { park: "Petco Park (SD)", factor: "~94", type: "Pitcher-friendly", note: "Marine layer, spacious outfield, pitcher's park" },
                  { park: "loanDepot Park (MIA)", factor: "~95", type: "Pitcher-friendly", note: "Retractable roof, humid air, deep gaps" },
                ].map((p) => (
                  <div key={p.park} className="rounded-lg bg-slate-50 dark:bg-slate-700/50 p-3">
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{p.park}</p>
                    <p className="text-xs text-blue-600 font-semibold">Factor: {p.factor} ({p.type})</p>
                    <p className="text-xs text-slate-500 mt-1">{p.note}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4">
                This is why adjusted stats like wRC+, OPS+, and ERA+ are so
                valuable. They account for these park differences automatically,
                allowing you to compare a Rockies hitter to a Padres hitter on
                equal terms. Always prefer adjusted stats when comparing players
                from different teams.
              </p>
            </div>
          </div>
        </section>

        {/* Section 7: Sample Size */}
        <section id="sample-size" className="mb-12">
          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-8">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-4">
              7. Sample Size and Stabilization
            </h2>
            <div className="space-y-4 text-sm text-slate-600 dark:text-slate-400 leading-7">
              <p>
                One of the most important concepts in sabermetrics is sample
                size. Not all stats become reliable at the same speed. Some
                metrics stabilize quickly (meaning they reflect true talent
                early in the season) while others require a full season or more
                to become meaningful.
              </p>
              <h3 className="text-base font-bold text-slate-700 dark:text-slate-300 mt-4">
                Approximate Stabilization Points for Hitters
              </h3>
              <div className="overflow-x-auto mt-3">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-600">
                      <th className="text-left py-2 text-slate-500">Stat</th>
                      <th className="text-center py-2 text-slate-500">Plate Appearances</th>
                      <th className="text-center py-2 text-slate-500">Approx. Games</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {[
                      ["Strikeout Rate (K%)", "60 PA", "~15 games"],
                      ["Walk Rate (BB%)", "120 PA", "~30 games"],
                      ["HBP Rate", "300 PA", "~75 games"],
                      ["HR Rate", "170 PA", "~43 games"],
                      ["BABIP", "820 PA", "~200 games (over 1 season)"],
                      ["Batting Average", "910 PA", "~230 games (over 1 season)"],
                      ["OBP", "460 PA", "~115 games"],
                      ["SLG", "320 PA", "~80 games"],
                      ["ISO", "160 PA", "~40 games"],
                    ].map(([stat, pa, games]) => (
                      <tr key={stat}>
                        <td className="py-2 text-slate-700 dark:text-slate-300 font-medium">{stat}</td>
                        <td className="py-2 text-center text-slate-500">{pa}</td>
                        <td className="py-2 text-center text-slate-500">{games}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-4">
                <strong>Key takeaway:</strong> In April, do not overreact to a
                player&apos;s batting average or BABIP. These stats need hundreds
                of plate appearances to stabilize. Instead, focus on K% and BB%,
                which stabilize much faster and are better early-season
                indicators of performance changes.
              </p>
              <p>
                For pitchers, similar principles apply. FIP stabilizes faster
                than ERA because it is based on strikeouts, walks, and home
                runs, which are less subject to random variation than hits
                on balls in play.
              </p>
            </div>
          </div>
        </section>

        {/* Section 8: How to Use */}
        <section id="how-to-use" className="mb-12">
          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-8">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-4">
              8. How to Use Sabermetrics as a Fan
            </h2>
            <div className="space-y-4 text-sm text-slate-600 dark:text-slate-400 leading-7">
              <p>
                You do not need to memorize every formula to benefit from
                sabermetrics. Here is a practical framework for using advanced
                stats as an informed baseball fan:
              </p>
              <div className="space-y-4 mt-4">
                <div className="rounded-lg bg-slate-50 dark:bg-slate-700/50 p-4">
                  <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-2">
                    For Evaluating Hitters
                  </h4>
                  <ol className="list-decimal pl-5 space-y-1 text-xs">
                    <li>Start with wRC+ for overall offensive value (100 = average, higher is better)</li>
                    <li>Check K% and BB% to understand plate discipline</li>
                    <li>Look at ISO for power and BABIP for luck indicators</li>
                    <li>Use WAR for total value including defense and baserunning</li>
                  </ol>
                </div>
                <div className="rounded-lg bg-slate-50 dark:bg-slate-700/50 p-4">
                  <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-2">
                    For Evaluating Pitchers
                  </h4>
                  <ol className="list-decimal pl-5 space-y-1 text-xs">
                    <li>Start with FIP or xFIP rather than ERA for true skill level</li>
                    <li>Check K/9 and BB/9 for stuff and command quality</li>
                    <li>Compare ERA to FIP, a large gap suggests regression is coming</li>
                    <li>Look at BABIP against to identify luck factors</li>
                  </ol>
                </div>
                <div className="rounded-lg bg-slate-50 dark:bg-slate-700/50 p-4">
                  <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-2">
                    For Game Analysis
                  </h4>
                  <ol className="list-decimal pl-5 space-y-1 text-xs">
                    <li>Use win probability charts to understand game flow and key moments</li>
                    <li>Check batter vs. pitcher matchup history for context</li>
                    <li>Consider park factors when evaluating expected run production</li>
                    <li>Watch for bullpen usage patterns and reliever splits</li>
                  </ol>
                </div>
              </div>
              <p className="mt-4">
                Remember: sabermetrics enhances your enjoyment of baseball. It
                does not replace watching the games. The best approach combines
                statistical analysis with the eye test, understanding that the
                numbers tell you what happened and provide probabilities for the
                future, but the games are played on the field, not on
                spreadsheets.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <div className="text-center rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 p-8 text-white">
          <h2 className="text-2xl font-bold mb-3">
            Ready to Analyze?
          </h2>
          <p className="text-blue-100 mb-6 max-w-lg mx-auto">
            Apply your sabermetrics knowledge with StatScope&apos;s live game
            analysis, player matchups, and win probability models.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/"
              className="rounded-xl bg-white text-blue-600 px-6 py-2.5 text-sm font-bold hover:bg-blue-50 transition-colors"
            >
              Today&apos;s Games
            </Link>
            <Link
              href="/players"
              className="rounded-xl bg-blue-500 text-white px-6 py-2.5 text-sm font-bold hover:bg-blue-400 transition-colors"
            >
              Player Search
            </Link>
            <Link
              href="/methodology"
              className="rounded-xl border border-blue-400 text-white px-6 py-2.5 text-sm font-bold hover:bg-blue-500 transition-colors"
            >
              Our Methodology
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
