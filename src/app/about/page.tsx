import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About StatScope | MLB Deep Analytics Platform",
  description: "StatScope is a sabermetrics-based MLB deep analytics platform offering free advanced baseball analysis.",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-extrabold mb-3">
          <span className="text-blue-600">Stat</span>
          <span className="text-slate-800">Scope</span>
        </h1>
        <p className="text-lg text-slate-600">Data-driven baseball analytics</p>
      </div>

      <div className="space-y-10 text-sm text-slate-600 leading-7">
        <section className="rounded-2xl bg-white border border-slate-200 p-8">
          <h2 className="text-xl font-bold text-slate-800 mb-4">What is StatScope?</h2>
          <p className="mb-3">
            StatScope is a <strong>sabermetrics-based MLB deep analytics platform</strong>.
            Beyond simple scoreboards, we provide data-driven professional baseball analysis
            including starting pitcher matchup analysis, team strength comparisons,
            win probability models, and player form indices.
          </p>
          <p>
            Our goal is to make advanced baseball analytics accessible and intuitive
            for every fan.
          </p>
        </section>

        <section className="rounded-2xl bg-white border border-slate-200 p-8">
          <h2 className="text-xl font-bold text-slate-800 mb-4">Key Features</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { title: "Live Game Info", desc: "Today's MLB schedule, live scores, and starting pitcher information" },
              { title: "Game Deep Analysis", desc: "Roster sabermetrics comparison, starter matchup, AI analysis" },
              { title: "Win Probability Model", desc: "Proprietary prediction based on starter ERA/WHIP, recent form, home advantage" },
              { title: "Player Head-to-Head", desc: "Career batter vs pitcher matchup records with automatic analysis" },
              { title: "Standings", desc: "AL and NL division standings updated in real-time" },
              { title: "Bullpen Analysis", desc: "Relief pitcher ERA, K%, closer/setup role breakdown" },
            ].map(({ title, desc }) => (
              <div key={title} className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                <h3 className="text-sm font-bold text-blue-600 mb-1">{title}</h3>
                <p className="text-xs text-slate-500">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-white border border-slate-200 p-8">
          <h2 className="text-xl font-bold text-slate-800 mb-4">Analytics Metrics</h2>
          <p className="mb-4">Key sabermetrics used on StatScope:</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { key: "wOBA", desc: "Weighted On-Base Average" },
              { key: "wRC+", desc: "Weighted Runs Created Plus" },
              { key: "FIP", desc: "Fielding Independent Pitching" },
              { key: "BABIP", desc: "Batting Avg on Balls in Play" },
              { key: "ISO", desc: "Isolated Power" },
              { key: "K% / BB%", desc: "Strikeout / Walk Rate" },
            ].map(({ key, desc }) => (
              <div key={key} className="text-center rounded-lg bg-blue-50 border border-blue-100 px-3 py-3">
                <p className="text-sm font-bold text-blue-700">{key}</p>
                <p className="text-[11px] text-blue-500">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-white border border-slate-200 p-8">
          <h2 className="text-xl font-bold text-slate-800 mb-4">Data Refresh Rates</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 text-slate-500">Data Type</th>
                  <th className="text-center py-2 text-slate-500">Refresh Interval</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  ["Schedule / Live Scores", "30 seconds"],
                  ["Standings", "15 minutes"],
                  ["Player Season Stats", "1 hour"],
                  ["Active Roster", "1 hour"],
                  ["News", "30 minutes"],
                ].map(([item, cycle]) => (
                  <tr key={item}>
                    <td className="py-2 text-slate-700 font-medium">{item}</td>
                    <td className="py-2 text-center text-slate-500">{cycle}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl bg-white border border-slate-200 p-8 text-center">
          <h2 className="text-xl font-bold text-slate-800 mb-4">Contact</h2>
          <p className="mb-2">For inquiries, feedback, or partnership proposals:</p>
          <p className="font-medium text-blue-600">statscope.help@gmail.com</p>
          <div className="mt-6 flex items-center justify-center gap-4">
            <Link href="/privacy" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
              Privacy Policy
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
