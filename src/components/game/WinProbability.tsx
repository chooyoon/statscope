import type { PredictionResult } from "@/lib/sports/mlb/predict";

interface WinProbabilityProps {
  prediction: PredictionResult;
  homeTeamName: string;
  awayTeamName: string;
  homeColor: string;
  awayColor: string;
}

const confidenceLabel = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
};

const confidenceStyle = {
  high: "text-green-600 bg-green-50 border-green-200",
  medium: "text-amber-600 bg-amber-50 border-amber-200",
  low: "text-slate-500 bg-slate-50 border-slate-200",
};

export default function WinProbability({
  prediction,
  homeTeamName,
  awayTeamName,
  homeColor,
  awayColor,
}: WinProbabilityProps) {
  const { homeWinPct, awayWinPct, confidence, factors, model } = prediction;

  return (
    <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <span className="inline-block w-1 h-5 bg-indigo-500 rounded-full" />
          Win Probability
        </h3>
        <span
          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${confidenceStyle[confidence]}`}
        >
          {confidenceLabel[confidence]}
        </span>
      </div>

      <div className="p-5">
        {/* Win probability bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-center">
              <p className="text-xs text-slate-500">{awayTeamName}</p>
              <p className="text-2xl font-extrabold font-mono" style={{ color: awayColor }}>
                {awayWinPct}%
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500">{homeTeamName}</p>
              <p className="text-2xl font-extrabold font-mono" style={{ color: homeColor }}>
                {homeWinPct}%
              </p>
            </div>
          </div>
          <div className="flex h-3 rounded-full overflow-hidden">
            <div
              className="transition-all duration-700 rounded-l-full"
              style={{ width: `${awayWinPct}%`, backgroundColor: awayColor }}
            />
            <div
              className="transition-all duration-700 rounded-r-full"
              style={{ width: `${homeWinPct}%`, backgroundColor: homeColor }}
            />
          </div>
        </div>

        {/* Factors */}
        <div className="space-y-1">
          {factors.map((factor) => (
            <div
              key={factor.label}
              className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 last:border-0"
            >
              <span
                className={`font-mono font-semibold w-20 text-right ${
                  factor.advantage === "away" ? "text-slate-800" : "text-slate-400"
                }`}
                style={factor.advantage === "away" ? { color: awayColor } : undefined}
              >
                {factor.awayValue}
              </span>
              <span className="text-slate-500 flex-1 text-center text-[11px]">
                {factor.label}
              </span>
              <span
                className={`font-mono font-semibold w-20 text-left ${
                  factor.advantage === "home" ? "text-slate-800" : "text-slate-400"
                }`}
                style={factor.advantage === "home" ? { color: homeColor } : undefined}
              >
                {factor.homeValue}
              </span>
            </div>
          ))}
        </div>

        <p className="mt-3 text-[10px] text-slate-400 text-center">
          {model ?? "StatScope Model"} &mdash; Pythagorean expectation, starter quality, recent form, home advantage
        </p>
      </div>
    </div>
  );
}
