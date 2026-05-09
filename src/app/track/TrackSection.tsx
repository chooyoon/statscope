import CalibrationChart from "./CalibrationChart";
import { isKR } from "@/lib/config";

const T = (en: string, ko: string) => isKR ? ko : en;

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
  chartsSection?: React.ReactNode;
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
  const borderColor =
    tone === "positive"
      ? "border-emerald-500"
      : tone === "negative"
        ? "border-red-500"
        : "border-slate-300";
  const color =
    tone === "positive"
      ? "text-emerald-600"
      : tone === "negative"
        ? "text-red-600"
        : "text-slate-800";
  const bgColor =
    tone === "positive"
      ? "bg-emerald-50"
      : tone === "negative"
        ? "bg-red-50"
        : "bg-white";

  return (
    <div className={`rounded-lg ${bgColor} px-4 py-3 ring-1 ring-slate-200/60 border-l-4 ${borderColor}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className={`mt-2 text-3xl font-extrabold tabular-nums ${color}`}>
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-slate-600">{sub}</div>}
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
  chartsSection,
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
          <strong>{T("Note:", "주의:")} </strong> {caveat}
        </div>
      )}

      {/* Metrics */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label={T("Record", "기록")}
          value={
            metrics ? `${metrics.wins}–${metrics.losses}` : "—"
          }
          sub={
            metrics
              ? `${metrics.wins + metrics.losses} ${T("pick", "픽")}${
                  metrics.wins + metrics.losses === 1 ? "" : "s"
                }`
              : T("No data yet", "데이터 없음")
          }
        />
        <MetricCard
          label={T("Win Rate", "승률")}
          value={metrics ? `${metrics.winRatePct.toFixed(1)}%` : "—"}
          sub={metrics ? T("vs 50% baseline", "vs 50% 기준") : undefined}
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
          label={T("ROI at posted ML", "게시된 ML의 ROI")}
          value={
            metrics
              ? `${metrics.roiPct >= 0 ? "+" : ""}${metrics.roiPct.toFixed(1)}%`
              : "—"
          }
          sub={T("Flat $100 unit", "$100 단위")}
          tone={
            !metrics
              ? "neutral"
              : metrics.roiPct >= 0
                ? "positive"
                : "negative"
          }
        />
        <MetricCard
          label={T("Brier Score", "Brier 점수")}
          value={metrics ? metrics.brier.toFixed(4) : "—"}
          sub={T("Lower = better, 0.25 = random", "낮을수록 좋음, 0.25 = 무작위")}
          tone={brierTone}
        />
      </div>

      {/* Calibration */}
      <div className="mt-8">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">
          {T("Calibration Curve", "캘리브레이션 곡선")}
        </h3>
        {hasData ? (
          <CalibrationChart bins={bins} />
        ) : (
          <div className="rounded-xl bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">
            {T(
              "Calibration renders once this section has at least one settled pick.",
              "이 섹션에 최소 1개의 결제된 픽이 있으면 캘리브레이션이 렌더링됩니다."
            )}
          </div>
        )}
      </div>

      {/* Charts Section */}
      {chartsSection && <div className="mt-8">{chartsSection}</div>}

      {footer && <div className="mt-6">{footer}</div>}
    </section>
  );
}
