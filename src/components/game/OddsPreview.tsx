import type { OddsResult } from "@/lib/sports/mlb/predict";

interface OddsPreviewProps {
  odds: OddsResult;
  homeTeamName: string;
  awayTeamName: string;
  homeColor: string;
  awayColor: string;
}

export default function OddsPreview({
  odds,
  homeTeamName,
  awayTeamName,
  homeColor,
  awayColor,
}: OddsPreviewProps) {
  const {
    totalLine,
    homeExpectedRuns,
    awayExpectedRuns,
    homeMoneyline,
    awayMoneyline,
    runLine,
    overUnder,
  } = odds;

  const favoriteLabel =
    runLine.favorite === "home"
      ? homeTeamName
      : runLine.favorite === "away"
      ? awayTeamName
      : "Even";
  const favoriteColor =
    runLine.favorite === "home"
      ? homeColor
      : runLine.favorite === "away"
      ? awayColor
      : undefined;

  return (
    <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <span className="inline-block w-1 h-5 bg-emerald-500 rounded-full" />
          Odds &amp; Totals Prediction
        </h3>
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border text-emerald-600 bg-emerald-50 border-emerald-200">
          StatScope Model
        </span>
      </div>

      <div className="p-5 space-y-5">
        {/* Moneyline */}
        <div>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Moneyline
          </p>
          <div className="flex gap-3">
            <MoneylineCard
              team={awayTeamName}
              odds={awayMoneyline}
              color={awayColor}
            />
            <MoneylineCard
              team={homeTeamName}
              odds={homeMoneyline}
              color={homeColor}
            />
          </div>
        </div>

        {/* Over/Under */}
        <div>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Over / Under
          </p>
          <div className="flex items-center gap-4 rounded-lg bg-slate-50 px-4 py-3">
            <div className="flex-1">
              <p className="text-2xl font-extrabold font-mono text-slate-800">
                {totalLine}
              </p>
              <p className="text-[11px] text-slate-400">Total Runs Line</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-mono text-slate-600">
                {awayExpectedRuns} + {homeExpectedRuns} ={" "}
                <span className="font-bold text-slate-800">
                  {overUnder.expectedTotal}
                </span>
              </p>
              <p className="text-[11px] text-slate-400">
                Expected: {awayTeamName} + {homeTeamName}
              </p>
            </div>
            <OUBadge lean={overUnder.lean} />
          </div>
        </div>

        {/* Run Line */}
        <div>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Run Line (-1.5)
          </p>
          <div className="flex items-center gap-3 rounded-lg bg-slate-50 px-4 py-3">
            <div className="flex-1">
              <p className="text-sm text-slate-700">
                <span className="font-bold" style={favoriteColor ? { color: favoriteColor } : undefined}>
                  {favoriteLabel}
                </span>{" "}
                -1.5
              </p>
              <p className="text-[11px] text-slate-400">
                Expected margin:{" "}
                <span className="font-mono font-semibold text-slate-600">
                  {runLine.expectedMargin > 0 ? "+" : ""}
                  {runLine.expectedMargin} runs
                </span>
              </p>
            </div>
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                runLine.coversSpread
                  ? "text-green-600 bg-green-50 border-green-200"
                  : "text-amber-600 bg-amber-50 border-amber-200"
              }`}
            >
              {runLine.coversSpread ? "Likely covers" : "Tight"}
            </span>
          </div>
        </div>

        <p className="text-[10px] text-slate-400 text-center">
          Projected odds based on team stats, pitching matchup, and park factor.
          Not affiliated with any sportsbook.
        </p>
      </div>
    </div>
  );
}

// --- Sub-components ---

function MoneylineCard({
  team,
  odds,
  color,
}: {
  team: string;
  odds: string;
  color: string;
}) {
  const isFavorite = odds.startsWith("-");
  return (
    <div
      className="flex-1 rounded-lg border px-4 py-3 text-center"
      style={{ borderColor: `${color}30` }}
    >
      <p className="text-xs text-slate-500 truncate">{team}</p>
      <p
        className="text-xl font-extrabold font-mono mt-1"
        style={{ color }}
      >
        {odds}
      </p>
      <p className="text-[10px] text-slate-400 mt-0.5">
        {isFavorite ? "Favorite" : "Underdog"}
      </p>
    </div>
  );
}

function OUBadge({ lean }: { lean: "over" | "under" | "push" }) {
  const style = {
    over: "text-red-600 bg-red-50 border-red-200",
    under: "text-blue-600 bg-blue-50 border-blue-200",
    push: "text-slate-500 bg-slate-100 border-slate-200",
  };
  const label = {
    over: "OVER",
    under: "UNDER",
    push: "PUSH",
  };
  return (
    <span
      className={`text-xs font-bold px-2.5 py-1 rounded-full border ${style[lean]}`}
    >
      {label[lean]}
    </span>
  );
}
