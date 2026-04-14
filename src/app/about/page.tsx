import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About StatScope | MLB Deep Analytics Platform",
  description:
    "StatScope is a free, independent MLB analytics platform providing sabermetrics-based game analysis, win probability models, and player matchup tools for baseball fans.",
  openGraph: {
    title: "About StatScope - Data-Driven Baseball Analytics",
    description:
      "Learn about StatScope's mission to make advanced baseball analytics accessible to every fan.",
  },
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-extrabold mb-3">
          <span className="text-blue-600">Stat</span>
          <span className="text-slate-800 dark:text-white">Scope</span>
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-400">
          Data-driven baseball analytics for every fan
        </p>
      </div>

      <div className="space-y-10 text-sm text-slate-600 dark:text-slate-400 leading-7">
        {/* Mission */}
        <section className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-8">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">
            Our Mission
          </h2>
          <p className="mb-3">
            StatScope exists to bridge the gap between professional-grade
            baseball analytics and everyday fandom. Advanced statistics like
            wRC+, FIP, and WAR have transformed how MLB front offices evaluate
            players and make decisions, but these powerful tools remain
            inaccessible to most fans. We believe every baseball fan deserves
            to understand the game at a deeper level.
          </p>
          <p className="mb-3">
            Our platform takes complex sabermetric data and presents it in a
            clean, intuitive interface that does not require a statistics degree
            to understand. Whether you are a lifelong baseball enthusiast who
            wants to go beyond batting average, or a new fan trying to
            understand why your team just traded for a pitcher with a high ERA
            but low FIP, StatScope is built for you.
          </p>
          <p>
            We are an independent, fan-built project. We are not affiliated
            with MLB, any team, or any sports betting company. Our analysis is
            objective, transparent, and focused solely on enhancing your
            understanding and enjoyment of baseball.
          </p>
        </section>

        {/* What We Offer */}
        <section className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-8">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">
            What We Offer
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {
                title: "Live Game Tracking",
                desc: "Real-time MLB scores, starting pitcher info, and game status updates refreshed every 30 seconds. Never miss a pitch.",
              },
              {
                title: "Deep Game Analysis",
                desc: "Roster sabermetrics comparison, starter matchup evaluation, bullpen analysis, and AI-assisted game commentary for every matchup.",
              },
              {
                title: "Win Probability Model",
                desc: "Pre-game predictions based on starter quality, team form, home advantage, and bullpen availability. Transparent methodology.",
              },
              {
                title: "Player Matchup Tool",
                desc: "Historical batter vs. pitcher records with context-aware analysis and sample size warnings for informed evaluation.",
              },
              {
                title: "Division Standings",
                desc: "AL and NL division standings with real-time updates, including win-loss records, winning percentage, and games back.",
              },
              {
                title: "Sabermetrics Education",
                desc: "Comprehensive guides explaining wOBA, wRC+, FIP, WAR, and other advanced metrics with real-world examples.",
              },
            ].map(({ title, desc }) => (
              <div
                key={title}
                className="rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600 p-4"
              >
                <h3 className="text-sm font-bold text-blue-600 mb-1">
                  {title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How It Works */}
        <section className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-8">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">
            How It Works
          </h2>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-sm font-bold text-blue-600">
                1
              </div>
              <div>
                <h3 className="font-bold text-slate-700 dark:text-slate-300">Data Collection</h3>
                <p className="text-xs mt-1">
                  We pull game schedules, live scores, player stats, and roster
                  data from MLB&apos;s official Stats API in real time. Our servers
                  refresh data at optimized intervals ranging from 30 seconds
                  for live games to 1 hour for season statistics.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-sm font-bold text-blue-600">
                2
              </div>
              <div>
                <h3 className="font-bold text-slate-700 dark:text-slate-300">Sabermetric Processing</h3>
                <p className="text-xs mt-1">
                  Raw data is processed through our analytics engine, which
                  calculates advanced metrics (wOBA, FIP, ISO, form indices),
                  generates team comparisons, and builds win probability
                  estimates using weighted multi-factor models.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-sm font-bold text-blue-600">
                3
              </div>
              <div>
                <h3 className="font-bold text-slate-700 dark:text-slate-300">Presentation</h3>
                <p className="text-xs mt-1">
                  Analysis is presented in a clean, accessible interface with
                  visual comparisons, contextual explanations, and AI-assisted
                  commentary that translates raw numbers into actionable
                  insights any fan can understand.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Analytics Metrics */}
        <section className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-8">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">
            Key Metrics We Use
          </h2>
          <p className="mb-4">
            StatScope utilizes the most respected and predictive sabermetric
            measurements in modern baseball analytics:
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { key: "wOBA", desc: "Weighted On-Base Average" },
              { key: "wRC+", desc: "Weighted Runs Created Plus" },
              { key: "FIP", desc: "Fielding Independent Pitching" },
              { key: "BABIP", desc: "Batting Avg on Balls in Play" },
              { key: "ISO", desc: "Isolated Power" },
              { key: "K% / BB%", desc: "Strikeout / Walk Rate" },
            ].map(({ key, desc }) => (
              <div
                key={key}
                className="text-center rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 px-3 py-3"
              >
                <p className="text-sm font-bold text-blue-700 dark:text-blue-400">{key}</p>
                <p className="text-[11px] text-blue-500 dark:text-blue-500">{desc}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs">
            Want to learn what each metric means and how to use them?{" "}
            <Link href="/learn" className="text-blue-600 hover:underline font-medium">
              Read our complete sabermetrics guide &rarr;
            </Link>
          </p>
        </section>

        {/* Data Refresh Rates */}
        <section className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-8">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">
            Data Refresh Rates
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-600">
                  <th className="text-left py-2 text-slate-500">Data Type</th>
                  <th className="text-center py-2 text-slate-500">
                    Refresh Interval
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {[
                  ["Schedule / Live Scores", "30 seconds"],
                  ["Standings", "15 minutes"],
                  ["Player Season Stats", "1 hour"],
                  ["Active Roster", "1 hour"],
                  ["News", "30 minutes"],
                ].map(([item, cycle]) => (
                  <tr key={item}>
                    <td className="py-2 text-slate-700 dark:text-slate-300 font-medium">{item}</td>
                    <td className="py-2 text-center text-slate-500">{cycle}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Technology */}
        <section className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-8">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">
            Built with Modern Technology
          </h2>
          <p className="mb-4">
            StatScope is built on a modern web stack designed for performance,
            accessibility, and reliability:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-xs">
            <li>
              <strong>Next.js</strong> with server-side rendering for fast
              initial loads and excellent SEO
            </li>
            <li>
              <strong>React</strong> for a responsive, interactive user
              interface that works seamlessly on desktop and mobile
            </li>
            <li>
              <strong>TypeScript</strong> for type-safe code that minimizes
              bugs and ensures data integrity throughout the pipeline
            </li>
            <li>
              <strong>Progressive Web App (PWA)</strong> capabilities for
              native app-like experience on mobile devices
            </li>
            <li>
              <strong>Firebase</strong> for secure user authentication and
              personalized features like favorite teams and players
            </li>
          </ul>
        </section>

        {/* Contact & Links */}
        <section className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-8 text-center">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">
            Contact & Resources
          </h2>
          <p className="mb-2">
            For inquiries, feedback, or partnership proposals:
          </p>
          <p className="font-medium text-blue-600 mb-6">
            statscope.help@gmail.com
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/learn"
              className="text-xs text-blue-600 hover:underline font-medium"
            >
              Sabermetrics Guide
            </Link>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <Link
              href="/methodology"
              className="text-xs text-blue-600 hover:underline font-medium"
            >
              Our Methodology
            </Link>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <Link
              href="/privacy"
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              Privacy Policy
            </Link>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <Link
              href="/terms"
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              Terms of Service
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
