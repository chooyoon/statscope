import type { Metadata } from "next";
import Link from "next/link";
import MatchupClient from "./MatchupClient";

export const metadata: Metadata = {
  title: "Player Matchup Comparison | StatScope",
  description:
    "Compare two MLB players side-by-side with sabermetrics and advanced stats.",
  openGraph: {
    title: "Player Matchup Comparison | StatScope",
    description: "Compare two MLB players side-by-side with advanced analytics.",
  },
};

export default function MatchupPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="text-center mb-10">
        <h1 className="text-3xl md:text-4xl font-extrabold text-slate-800 mb-3">
          Player Matchup Comparison
        </h1>
        <p className="text-slate-500 max-w-2xl mx-auto">
          Search two players to compare their stats and sabermetrics side by side.
        </p>
      </div>
      <MatchupClient />

      {/* How-to guide for first-time visitors */}
      <section className="mt-12 rounded-2xl bg-white px-6 py-8 shadow-sm ring-1 ring-slate-200/60">
        <h2 className="text-xl font-bold text-slate-800">
          How to Use Player Matchup
        </h2>
        <p className="mt-3 text-slate-600 leading-relaxed">
          Start typing any active MLB player&apos;s name in each search box
          above. We&apos;ll pull their current-season stat line from the
          official MLB Stats API and re-express it in sabermetric terms so
          you can compare apples to apples, whether you&apos;re lining up two
          hitters, two pitchers, or two versions of the same player
          across seasons.
        </p>

        <h3 className="mt-6 text-base font-semibold text-slate-800">
          What the comparison shows
        </h3>
        <ul className="mt-2 list-disc pl-5 space-y-2 text-sm text-slate-600 leading-relaxed">
          <li>
            <strong>For hitters:</strong> wOBA (weighted on-base average —
            the gold-standard one-number measure of offensive value), wRC+
            (park- and league-adjusted run creation, where 100 is league
            average and 120 is 20% above), ISO (isolated power, i.e. slugging
            minus batting average), BABIP (batting average on balls in play,
            a luck/contact quality indicator), and K%/BB% for plate
            discipline.
          </li>
          <li>
            <strong>For pitchers:</strong> FIP (Fielding Independent
            Pitching — what ERA would be if defense were league-average),
            xFIP (FIP normalized to league HR/FB rate), K% and BB%, BABIP
            against, and raw innings-pitched workload.
          </li>
        </ul>

        <h3 className="mt-6 text-base font-semibold text-slate-800">
          Sample size matters
        </h3>
        <p className="mt-2 text-slate-600 leading-relaxed text-sm">
          Be careful comparing players before they&apos;ve stabilized.
          Hitter K% stabilizes around 60 plate appearances, BB% around 120,
          and wOBA around 300. Pitcher K% takes about 70 batters faced,
          while BABIP for either side can remain noisy all year. If a
          player has fewer than ~100 PA (or ~40 IP for a pitcher), treat
          wild outliers with skepticism — the luck component is still large.
        </p>

        <p className="mt-4 text-sm text-slate-500">
          Want a deeper explanation of each metric?{" "}
          <Link href="/learn" className="text-blue-600 hover:underline">
            Visit our Learn section
          </Link>{" "}
          for definitions, formulas, and worked examples.
        </p>
      </section>
    </div>
  );
}
