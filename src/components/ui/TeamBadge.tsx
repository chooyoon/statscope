interface TeamBadgeProps {
  name: string;
  nameKo: string;
  colorPrimary: string;
  colorAccent: string;
  size?: "sm" | "md" | "lg";
  dark?: boolean;
}

const sizeMap = {
  sm: { circle: "w-10 h-10", text: "text-sm", label: "text-xs" },
  md: { circle: "w-14 h-14", text: "text-lg", label: "text-sm" },
  lg: { circle: "w-20 h-20", text: "text-2xl", label: "text-base" },
};

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 3);
}

export default function TeamBadge({
  name,
  nameKo,
  colorPrimary,
  colorAccent,
  size = "md",
  dark = false,
}: TeamBadgeProps) {
  const s = sizeMap[size];
  const initials = getInitials(name);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={`${s.circle} rounded-full flex items-center justify-center font-bold text-white shadow-lg`}
        style={{
          background: `linear-gradient(135deg, ${colorPrimary}, ${colorAccent})`,
        }}
      >
        <span className={s.text}>{initials}</span>
      </div>
      <span className={`${s.label} ${dark ? "text-slate-200" : "text-slate-700"} font-semibold`}>{nameKo}</span>
    </div>
  );
}
