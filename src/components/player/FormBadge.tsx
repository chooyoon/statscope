import type { FormIndex } from "@/lib/sports/mlb/form";

interface FormBadgeProps {
  form: FormIndex;
  size?: "sm" | "md";
}

const trendEmoji: Record<string, string> = {
  hot: "🔥",
  warm: "☀️",
  neutral: "➖",
  cold: "❄️",
  freezing: "🥶",
};

export default function FormBadge({ form, size = "sm" }: FormBadgeProps) {
  const isSm = size === "sm";

  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold rounded-full border ${
        isSm ? "text-[11px] px-2 py-0.5" : "text-xs px-2.5 py-1"
      }`}
      style={{
        color: form.color,
        backgroundColor: `${form.color}15`,
        borderColor: `${form.color}30`,
      }}
    >
      <span>{trendEmoji[form.trend] ?? ""}</span>
      <span>{form.label}</span>
      <span className="font-mono">{form.score}</span>
    </span>
  );
}
