interface StatBarProps {
  label: string;
  value: number | string;
  max?: number;
  color?: string;
  barColor?: string;
}

export default function StatBar({
  label,
  value,
  max = 100,
  color = "bg-blue-500",
  barColor,
}: StatBarProps) {
  const numericValue = typeof value === "number" ? value : parseFloat(value);
  const percentage = max > 0 ? Math.min((numericValue / max) * 100, 100) : 0;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-500 font-medium">{label}</span>
        <span className="text-xs text-slate-800 font-mono font-semibold">
          {value}
        </span>
      </div>
      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${barColor ? "" : color}`}
          style={{ width: `${percentage}%`, ...(barColor ? { backgroundColor: barColor } : {}) }}
        />
      </div>
    </div>
  );
}
