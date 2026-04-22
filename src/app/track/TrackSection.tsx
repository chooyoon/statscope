import CalibrationChart from "./CalibrationChart";

export interface CalibrationBin {
  binLabel: string;
  binCenter: number;
  predicted: number;
  actual: number | null;
  samples: number;
}

export interface TrackMetrics {
  wins: number;
  losses: number;
  winRatePct: number;
  roiPct: number;
  brier: number;
}

interface TrackSectionProps {
  id: string;
  rank: "primary" | "secondary";
  title: string;
  subtitle: string;
  badge: string;
  badgeTone: "emerald" | "amber" | "slate";
  body: React.ReactNode;
  metrics: TrackMetrics | null;
  bins: CalibrationBin[];
  hasData: boolean;
  caveat?: React.ReactNode;
  footer?: React.ReactNode;
}

function MetricCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "positive" | "negative" | "neutral";
}) {
  const color =
    tone === "positive"
      ? "text-emerald-600"
      : tone === "negative"
        ? "text-red-600"
        : "text-slate-800";
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-4 ring-1 ring-slate-200/60">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-extrabold tabular-nums ${color}`}>
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

const BADGE_CLASSES: Record<TrackSectionProps["badgeTone"], string> = {
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  slate: "bg-slate-100 text-slate-600 ring-slate-200",
};

export default function TrackSection({
  id,
  rank,
  title,
  subtitle,
  badge,
  badgeTone,
  body,
  metrics,
  bins,
  hasData,
  caveat,
  footer,
}: TrackSectionProps) {
  const brierTone: "positive" | "negative" | "neutral" | undefined =
    !metrics
      ? undefined
      : metrics.brier < 0.24
        ? "positive"
        : metrics.brier > 0.26
          ? "negative"
          : "neutral";

  return (
    <section
      id={id}
      className={`mb-10 rounded-2xl bg-white shadow-sm ring-1 ${
        rank === "primary"
          ? "ring-slate-300"
          : "ring-slate-200/60"
      } px-6 py-8`}
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ring-1 ${BADGE_CLASSES[badgeTone]}`}
        >
          {badge}
        </span>
        <h2 className="text-2xl font-bold text-slate-800">{title}</h2>
      </div>
      <p className="text-sm text-slate-600 leading-relaxed">{subtitle}</p>

      <div className="mt-4 text-sm text-slate-600 leading-relaxed">{body}</div>

      {caveat && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 leading-relaxed">
          <strong>Note:</strong> {caveat}
        </div>
      )}

      {/* Metrics */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Record"
          value={
            metrics ? `${metrics.wins}–${metrics.losses}` : "—"
          }
          sub={
            metrics
              ? `${metrics.wins + metrics.losses} pick${
                  metrics.wins + metrics.losses === 1 ? "" : "s"
                }`
              : "No data yet"
          }
        />
        <MetricCard
          label="Win Rate"
          value={metrics ? `${metrics.winRatePct.toFixed(1)}%` : "—"}
          sub={metrics ? "vs 50% baseline" : undefined}
          tone={
            !metrics
              ? "neutral"
              : metrics.winRatePct >= 55
                ? "positive"
                : metrics.winRatePct < 48
                  ? "negative"
                  : "neutral"
          }
        />
        <MetricCard
          label="ROI at posted ML"
          value={
            metrics
              ? `${metrics.roiPct >= 0 ? "+" : ""}${metrics.roiPct.toFixed(1)}%`
              : "—"
          }
          sub="Flat $100 unit"
          tone={
            !metrics
              ? "neutral"
              : metrics.roiPct >= 0
                ? "positive"
                : "negative"
          }
        />
        <MetricCard
          label="Brier Score"
          value={metrics ? metrics.brier.toFixed(4) : "—"}
          sub="Lower = better, 0.25 = random"
          tone={brierTone}
        />
      </div>

      {/* Calibration */}
      <div className="mt-8">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">
          Calibration Curve
        </h3>
        {hasData ? (
          <CalibrationChart bins={bins} />
        ) : (
          <div className="rounded-xl bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">
            Calibration renders once this section has at least one settled
            pick.
          </div>
        )}
      </div>

      {footer && <div className="mt-6">{footer}</div>}
    </section>
  );
}
