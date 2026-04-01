import type { Metadata } from "next";
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
    </div>
  );
}
