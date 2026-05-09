import { readFile } from "fs/promises";
import { join } from "path";
import Link from "next/link";
import { getTeamById } from "@/data/teams";

interface EnhancedGame {
  game_id: string;
  pk: number;
  an: string;
  hn: string;
  ai: number;
  hi: number;
  ap: string;
  hp: string;
  hW: number;
  aW: number;
  hML: string;
  aML: string;
  tot: number;
  hE: number;
  aE: number;
  margin: number;
  edge: number;
  hL10: string;
  aL10: string;
  pf: number;
  hRec: string;
  aRec: string;
  hERA: number;
  aERA: number;
  hFIP: number;
  aFIP: number;
  enhanced?: {
    hW: number;
    aW: number;
    delta: number;
    confidence: string;
  };
  pybaseball?: {
    home_pitcher: {
      xFIP: number | null;
      SIERA: number | null;
      swstr_pct: number | null;
    };
    away_pitcher: {
      xFIP: number | null;
      SIERA: number | null;
      swstr_pct: number | null;
    };
  };
}

interface EnhancedPicksFile {
  date: string;
  pybaseball_available: boolean;
  games: EnhancedGame[];
}

export const revalidate = 600;

export default async function EnhancedPage() {
  let data: EnhancedPicksFile | null = null;

  try {
    const filePath = join(process.cwd(), "public/data/enhanced-picks.json");
    const raw = await readFile(filePath, "utf-8");
    data = JSON.parse(raw) as EnhancedPicksFile;
  } catch (error) {
    console.error("Failed to load enhanced picks:", error);
  }

  if (!data || !data.games || data.games.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 px-4 py-12">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <Link
              href="/"
              className="text-blue-600 dark:text-blue-400 hover:underline text-sm font-semibold mb-4 inline-block"
            >
              ← Back
            </Link>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
              Enhanced Model Analysis
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              v2.3 with FanGraphs & Statcast data integration
            </p>
          </div>

          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-6">
            <p className="text-amber-800 dark:text-amber-200">
              No enhanced model data available yet. Check back later or run the model manually.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 px-4 py-12">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <Link
            href="/"
            className="text-blue-600 dark:text-blue-400 hover:underline text-sm font-semibold mb-4 inline-block"
          >
            ← Back
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <span className="inline-block w-1 h-8 bg-blue-500 rounded-full" />
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              Enhanced Model Analysis
            </h1>
          </div>
          <p className="text-slate-600 dark:text-slate-400 ml-4">
            <strong>{data.date}</strong> • v2.3 with FanGraphs (xFIP, SIERA, SwStr%) & Statcast data
          </p>
          {data.pybaseball_available && (
            <p className="text-green-600 dark:text-green-400 ml-4 text-sm mt-2 flex items-center gap-1">
              <span>✓</span> Advanced stats available
            </p>
          )}
        </div>

        {/* Data availability notice */}
        {!data.pybaseball_available && (
          <div className="mb-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4">
            <p className="text-blue-800 dark:text-blue-200 text-sm">
              ℹ️ FanGraphs & Statcast data unavailable — showing base model with fallback calculations
            </p>
          </div>
        )}

        {/* Games grid */}
        <div className="space-y-6">
          {data.games.map((game, idx) => {
            const homeTeam = getTeamById(game.hi);
            const awayTeam = getTeamById(game.ai);
            const hasDelta = game.enhanced && game.enhanced.delta !== 0;

            return (
              <div
                key={idx}
                className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden"
              >
                {/* Game header */}
                <div className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-lg font-bold text-slate-900 dark:text-white">
                      {game.an} @ {game.hn}
                    </div>
                    {hasDelta && game.enhanced && (
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${game.enhanced.delta > 0 ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300" : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"}`}>
                        <span>✨</span>
                        {game.enhanced.delta > 0 ? "+" : ""}{game.enhanced.delta.toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    Records: {game.aRec} vs {game.hRec} • Last 10: {game.aL10} vs {game.hL10}
                  </div>
                </div>

                {/* Content grid */}
                <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Left: Base vs Enhanced */}
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
                      Win Probability
                    </h3>

                    {/* Base model */}
                    <div className="mb-6 p-4 rounded-lg bg-slate-50 dark:bg-slate-700/50">
                      <p className="text-xs text-slate-600 dark:text-slate-400 font-medium mb-2">
                        Base Model (v2.2)
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-slate-600 dark:text-slate-400">{game.an}</p>
                          <p className="text-2xl font-bold text-slate-900 dark:text-white">
                            {game.aW.toFixed(1)}%
                          </p>
                          <p className="text-xs text-slate-500 mt-1">{game.aML}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-600 dark:text-slate-400">{game.hn}</p>
                          <p className="text-2xl font-bold text-slate-900 dark:text-white">
                            {game.hW.toFixed(1)}%
                          </p>
                          <p className="text-xs text-slate-500 mt-1">{game.hML}</p>
                        </div>
                      </div>
                    </div>

                    {/* Enhanced model */}
                    {game.enhanced && (
                      <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                        <p className="text-xs text-blue-700 dark:text-blue-300 font-medium mb-2">
                          Enhanced Model (v2.3)
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs text-slate-600 dark:text-slate-400">{game.an}</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">
                              {game.enhanced.aW.toFixed(1)}%
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-slate-600 dark:text-slate-400">{game.hn}</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">
                              {game.enhanced.hW.toFixed(1)}%
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-blue-700 dark:text-blue-300 mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
                          Confidence: <strong>{game.enhanced.confidence}</strong>
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Right: Pitcher metrics */}
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
                      Starting Pitchers
                    </h3>

                    {/* Home pitcher */}
                    <div className="mb-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-700/50">
                      <p className="text-xs font-semibold text-slate-900 dark:text-white mb-2">
                        {game.hn}
                      </p>
                      <p className="text-sm text-slate-700 dark:text-slate-300 mb-3">{game.hp}</p>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <p className="text-slate-600 dark:text-slate-400">ERA</p>
                          <p className="font-bold text-slate-900 dark:text-white">
                            {game.hERA.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-600 dark:text-slate-400">FIP</p>
                          <p className="font-bold text-slate-900 dark:text-white">
                            {game.hFIP.toFixed(2)}
                          </p>
                        </div>
                        {game.pybaseball?.home_pitcher && (
                          <>
                            {game.pybaseball.home_pitcher.xFIP && (
                              <div>
                                <p className="text-slate-600 dark:text-slate-400">xFIP</p>
                                <p className="font-bold text-slate-900 dark:text-white">
                                  {game.pybaseball.home_pitcher.xFIP.toFixed(2)}
                                </p>
                              </div>
                            )}
                            {game.pybaseball.home_pitcher.swstr_pct && (
                              <div>
                                <p className="text-slate-600 dark:text-slate-400">SwStr%</p>
                                <p className="font-bold text-slate-900 dark:text-white">
                                  {game.pybaseball.home_pitcher.swstr_pct.toFixed(1)}%
                                </p>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Away pitcher */}
                    <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-700/50">
                      <p className="text-xs font-semibold text-slate-900 dark:text-white mb-2">
                        {game.an}
                      </p>
                      <p className="text-sm text-slate-700 dark:text-slate-300 mb-3">{game.ap}</p>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <p className="text-slate-600 dark:text-slate-400">ERA</p>
                          <p className="font-bold text-slate-900 dark:text-white">
                            {game.aERA.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-600 dark:text-slate-400">FIP</p>
                          <p className="font-bold text-slate-900 dark:text-white">
                            {game.aFIP.toFixed(2)}
                          </p>
                        </div>
                        {game.pybaseball?.away_pitcher && (
                          <>
                            {game.pybaseball.away_pitcher.xFIP && (
                              <div>
                                <p className="text-slate-600 dark:text-slate-400">xFIP</p>
                                <p className="font-bold text-slate-900 dark:text-white">
                                  {game.pybaseball.away_pitcher.xFIP.toFixed(2)}
                                </p>
                              </div>
                            )}
                            {game.pybaseball.away_pitcher.swstr_pct && (
                              <div>
                                <p className="text-slate-600 dark:text-slate-400">SwStr%</p>
                                <p className="font-bold text-slate-900 dark:text-white">
                                  {game.pybaseball.away_pitcher.swstr_pct.toFixed(1)}%
                                </p>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="bg-slate-50 dark:bg-slate-700/50 px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                  <span>O/U: {game.tot} ({game.hE.toFixed(1)} + {game.aE.toFixed(1)}) • Margin: {game.margin > 0 ? "+" : ""}{game.margin.toFixed(1)} • Edge: {(game.edge * 100).toFixed(1)}%</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-12 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6">
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
            <strong>About the Enhanced Model:</strong> StatScope v2.3 combines the base 9-factor model (starting pitcher quality, team form, lineup strength, park factors) with FanGraphs advanced metrics (Expected FIP, SIERA, SwStr%) and Statcast pitch-level data to refine pitcher evaluations and predict game outcomes. Enhancement deltas indicate how much pybaseball data adjusts base probabilities.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-500">
            These predictions are for informational and entertainment purposes only and do not constitute betting advice.
          </p>
        </div>
      </div>
    </div>
  );
}
