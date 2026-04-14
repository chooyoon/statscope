import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Our Methodology | How StatScope Analyzes MLB Games",
  description:
    "Learn how StatScope builds win probability models, calculates player form indices, and delivers data-driven MLB game analysis using sabermetrics.",
  openGraph: {
    title: "StatScope Methodology - How We Analyze MLB Games",
    description:
      "Behind the scenes of StatScope's analytics: win probability, pitcher matchups, roster analysis, and more.",
  },
};

export default function MethodologyPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="mx-auto max-w-4xl px-4 py-12">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white mb-4">
            Our <span className="text-blue-600">Methodology</span>
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Transparency is a core principle at StatScope. Here is exactly how
            we collect, process, and analyze MLB data to deliver insights you
            can trust.
          </p>
        </div>

        {/* Data Sources */}
        <section className="mb-10">
          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-8">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-4">
              Data Sources
            </h2>
            <div className="space-y-4 text-sm text-slate-600 dark:text-slate-400 leading-7">
              <p>
                StatScope sources all game data, player statistics, and roster
                information from MLB&apos;s publicly available Stats API. This is
                the same data feed that powers the official MLB.com
                application, ensuring accuracy and timeliness. We do not scrape
                websites or use unofficial data sources.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                {[
                  {
                    title: "Live Game Data",
                    desc: "Real-time scores, pitch-by-pitch data, and game state updates refreshed every 30 seconds during live games.",
                    interval: "30 seconds",
                  },
                  {
                    title: "Player Statistics",
                    desc: "Season batting, pitching, and fielding stats including advanced metrics. Updated hourly to balance freshness with API efficiency.",
                    interval: "1 hour",
                  },
                  {
                    title: "Team Rosters",
                    desc: "Active roster information including recent call-ups, injuries, and lineup changes. Updated hourly.",
                    interval: "1 hour",
                  },
                  {
                    title: "Standings",
                    desc: "Division standings with win-loss records, winning percentages, and games back calculations. Updated every 15 minutes.",
                    interval: "15 minutes",
                  },
                ].map((s) => (
                  <div
                    key={s.title}
                    className="rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600 p-4"
                  >
                    <h3 className="text-sm font-bold text-blue-600 mb-1">
                      {s.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{s.desc}</p>
                    <p className="text-xs text-slate-400 mt-2">
                      Refresh: <span className="font-semibold">{s.interval}</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Win Probability Model */}
        <section className="mb-10">
          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-8">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-4">
              Win Probability Model
            </h2>
            <div className="space-y-4 text-sm text-slate-600 dark:text-slate-400 leading-7">
              <p>
                StatScope&apos;s pre-game win probability model estimates each
                team&apos;s chance of winning before first pitch. Unlike simple
                prediction systems that rely solely on team records, our model
                incorporates multiple factors that directly influence game
                outcomes.
              </p>
              <h3 className="text-base font-bold text-slate-700 dark:text-slate-300 mt-4">
                Model Inputs
              </h3>
              <ol className="list-decimal pl-6 space-y-3">
                <li>
                  <strong>Starting Pitcher Quality:</strong> We evaluate the
                  probable starters using a weighted combination of ERA, FIP,
                  WHIP, and K/BB ratio. FIP receives the highest weight because
                  it is the most predictive of future performance. Recent starts
                  (last 5 games) are weighted more heavily than season-long
                  averages to capture current form.
                </li>
                <li>
                  <strong>Team Offensive Strength:</strong> Measured by team
                  wRC+ and OPS over the last 15 games. We use a rolling window
                  rather than season-long numbers to better reflect current
                  offensive performance, which can fluctuate significantly due
                  to injuries and slumps.
                </li>
                <li>
                  <strong>Home Field Advantage:</strong> Historical data shows
                  that home teams win approximately 54% of MLB games. Our model
                  accounts for this baseline advantage and adjusts for
                  park-specific factors that may amplify or reduce the effect.
                </li>
                <li>
                  <strong>Recent Team Form:</strong> We calculate a form index
                  based on the team&apos;s last 10 games, factoring in run
                  differential, win percentage, and quality of opponents faced.
                  Hot and cold streaks are real phenomena that historical
                  models have shown to have mild predictive value.
                </li>
                <li>
                  <strong>Bullpen Status:</strong> Aggregated relief pitcher
                  ERA, recent usage patterns, and closer availability. A team
                  whose top relievers pitched the previous two days faces a
                  measurable disadvantage in close games.
                </li>
              </ol>
              <h3 className="text-base font-bold text-slate-700 dark:text-slate-300 mt-6">
                Model Limitations
              </h3>
              <p>
                We believe in transparency about what our model cannot do. It
                does not account for weather conditions, specific lineup
                construction beyond aggregate team stats, or day-of-game
                scratches. No pre-game model can predict outcomes with
                certainty. Our probabilities represent the most likely outcome
                given available data, not guarantees. Baseball is inherently
                unpredictable, and that is part of what makes it great.
              </p>
            </div>
          </div>
        </section>

        {/* Roster Analysis */}
        <section className="mb-10">
          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-8">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-4">
              Roster Sabermetrics Analysis
            </h2>
            <div className="space-y-4 text-sm text-slate-600 dark:text-slate-400 leading-7">
              <p>
                For each game, StatScope provides a side-by-side sabermetric
                comparison of both teams&apos; active rosters. This goes beyond
                simple stat comparisons to provide actionable analytical
                insights.
              </p>
              <h3 className="text-base font-bold text-slate-700 dark:text-slate-300 mt-4">
                Hitting Analysis
              </h3>
              <p>
                We aggregate individual hitter stats across the active lineup
                to produce team-level offensive profiles. Key metrics compared
                include team batting average, on-base percentage, slugging,
                wOBA, and ISO. We also calculate platoon splits (performance
                vs. left-handed and right-handed pitching) to identify
                potential lineup advantages against specific starters.
              </p>
              <h3 className="text-base font-bold text-slate-700 dark:text-slate-300 mt-4">
                Pitching Staff Breakdown
              </h3>
              <p>
                Beyond the starting pitcher comparison, we analyze each
                team&apos;s bullpen depth. This includes individual reliever ERA,
                FIP, K%, and recent workload. We flag relievers who may be
                unavailable due to consecutive-day usage and identify the
                highest-leverage arms available for late-inning situations.
              </p>
              <h3 className="text-base font-bold text-slate-700 dark:text-slate-300 mt-4">
                Player Form Index
              </h3>
              <p>
                StatScope calculates a proprietary form index for each player
                based on their performance over the last 7 and 15 games
                compared to their season average. This helps identify players
                who are currently hot or cold, which can influence in-game
                matchup decisions and pinch-hitting opportunities.
              </p>
            </div>
          </div>
        </section>

        {/* Player Matchup Analysis */}
        <section className="mb-10">
          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-8">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-4">
              Player vs. Player Matchup Analysis
            </h2>
            <div className="space-y-4 text-sm text-slate-600 dark:text-slate-400 leading-7">
              <p>
                Our head-to-head matchup tool pulls historical batter vs.
                pitcher records and presents them alongside contextual
                analysis. When a batter has faced a specific pitcher multiple
                times, we display the full statistical record including at-bats,
                hits, home runs, strikeouts, and batting average.
              </p>
              <p>
                However, we also caution against over-relying on small sample
                sizes. A batter going 1-for-10 against a pitcher does not
                necessarily mean they struggle against them. With proper
                context, we note when sample sizes are too small to draw
                reliable conclusions and suggest looking at performance against
                similar pitcher types (fastball-dominant, breaking-ball heavy,
                etc.) for a more meaningful analysis.
              </p>
              <p>
                The matchup tool is most valuable when combined with other
                factors: the pitcher&apos;s current form, the batter&apos;s platoon
                splits, and the game situation. We aim to present data that
                enhances understanding rather than providing false certainty
                from limited information.
              </p>
            </div>
          </div>
        </section>

        {/* AI Commentary */}
        <section className="mb-10">
          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-8">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-4">
              AI-Assisted Game Commentary
            </h2>
            <div className="space-y-4 text-sm text-slate-600 dark:text-slate-400 leading-7">
              <p>
                StatScope uses AI to generate pre-game analysis notes and
                in-game commentary that synthesize raw data into readable
                narratives. These AI-generated insights are clearly labeled and
                should be understood as data-driven observations, not expert
                predictions.
              </p>
              <p>
                The AI commentary considers starting pitcher matchups, recent
                team performance, head-to-head records, and park factors to
                produce analysis that highlights the most interesting
                statistical angles for each game. This feature is designed to
                save fans time by surfacing the most relevant analytical talking
                points rather than requiring them to dig through raw data
                themselves.
              </p>
              <p>
                We continuously refine our AI commentary system based on user
                feedback and analytical accuracy. If you notice any factual
                errors or have suggestions for improvement, please contact us
                at statscope.help@gmail.com.
              </p>
            </div>
          </div>
        </section>

        {/* Editorial Standards */}
        <section className="mb-10">
          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-8">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-4">
              Editorial Standards
            </h2>
            <div className="space-y-4 text-sm text-slate-600 dark:text-slate-400 leading-7">
              <p>
                StatScope is committed to providing accurate, unbiased,
                data-driven baseball analysis. Our editorial principles include:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>Data accuracy:</strong> All statistics are sourced
                  from official MLB data and verified through automated
                  consistency checks. When discrepancies are found, we flag
                  them and default to the official source.
                </li>
                <li>
                  <strong>Transparency:</strong> We clearly label the sources,
                  methodologies, and limitations of our analysis. When our
                  models have known blind spots, we say so.
                </li>
                <li>
                  <strong>No gambling promotion:</strong> StatScope does not
                  provide betting odds, gambling advice, or promote sports
                  betting in any form. Our analysis is for educational and
                  entertainment purposes only.
                </li>
                <li>
                  <strong>Independence:</strong> We are not affiliated with MLB,
                  any team, or any sports betting company. Our analysis is
                  independent and unbiased.
                </li>
                <li>
                  <strong>Corrections:</strong> If we make an error in our
                  analysis or data presentation, we correct it promptly and
                  transparently. Users can report issues to
                  statscope.help@gmail.com.
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-10">
          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-8">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-4">
              Frequently Asked Questions
            </h2>
            <div className="space-y-6 text-sm text-slate-600 dark:text-slate-400 leading-7">
              <div>
                <h3 className="font-bold text-slate-700 dark:text-slate-300 mb-1">
                  How often is the data updated?
                </h3>
                <p>
                  Live scores update every 30 seconds during games. Player stats
                  and rosters refresh hourly. Standings update every 15 minutes.
                  News feeds refresh every 30 minutes.
                </p>
              </div>
              <div>
                <h3 className="font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Is StatScope affiliated with MLB?
                </h3>
                <p>
                  No. StatScope is an independent, fan-built analytics platform.
                  We are not affiliated with, endorsed by, or sponsored by Major
                  League Baseball or any MLB team. We use publicly available
                  data to provide independent analysis.
                </p>
              </div>
              <div>
                <h3 className="font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Can I use StatScope for sports betting?
                </h3>
                <p>
                  StatScope does not provide betting advice or odds. Our win
                  probability models and analysis are for educational and
                  entertainment purposes only. We strongly advise against using
                  any single analytical tool as the basis for gambling decisions.
                </p>
              </div>
              <div>
                <h3 className="font-bold text-slate-700 dark:text-slate-300 mb-1">
                  How accurate is the win probability model?
                </h3>
                <p>
                  Our model is designed to provide reasonable estimates based on
                  available data. Like all prediction models, it has a margin of
                  error. We aim for calibration, meaning that when we say a team
                  has a 70% chance of winning, teams in similar situations should
                  win approximately 70% of the time over a large sample.
                </p>
              </div>
              <div>
                <h3 className="font-bold text-slate-700 dark:text-slate-300 mb-1">
                  What makes StatScope different from other baseball sites?
                </h3>
                <p>
                  StatScope focuses on making advanced analytics accessible and
                  actionable for everyday fans. We combine real-time game data
                  with sabermetric analysis, AI-assisted commentary, and
                  interactive matchup tools in a clean, modern interface. Our
                  goal is not to replace comprehensive reference sites like
                  FanGraphs or Baseball-Reference, but to make their insights
                  accessible to a broader audience.
                </p>
              </div>
              <div>
                <h3 className="font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Is StatScope free?
                </h3>
                <p>
                  Yes. StatScope is completely free to use. We are supported by
                  advertising through Google AdSense. We may introduce optional
                  premium features in the future, but core analytics will always
                  remain free.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <div className="text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Have questions about our methodology or suggestions for improvement?
          </p>
          <a
            href="mailto:statscope.help@gmail.com"
            className="inline-block rounded-xl bg-blue-600 text-white px-6 py-2.5 text-sm font-bold hover:bg-blue-700 transition-colors"
          >
            Contact Us
          </a>
          <div className="mt-4">
            <Link
              href="/learn"
              className="text-sm text-blue-600 hover:underline"
            >
              Learn about sabermetrics &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
