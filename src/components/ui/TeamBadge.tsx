interface TeamBadgeProps {
  name: string;
  nameKo: string;
  colorPrimary: string;
  colorAccent: string;
  teamId?: number;
  size?: "sm" | "md" | "lg";
  dark?: boolean;
}

const sizeMap = {
  sm: { circle: "w-10 h-10", logo: "w-8 h-8", label: "text-xs" },
  md: { circle: "w-14 h-14", logo: "w-11 h-11", label: "text-sm" },
  lg: { circle: "w-20 h-20", logo: "w-16 h-16", label: "text-base" },
};

export default function TeamBadge({
  name,
  nameKo,
  colorPrimary,
  colorAccent,
  teamId,
  size = "md",
  dark = false,
}: TeamBadgeProps) {
  const s = sizeMap[size];

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={`${s.circle} rounded-full flex items-center justify-center shadow-lg overflow-hidden`}
        style={{
          background: `linear-gradient(135deg, ${colorPrimary}20, ${colorAccent}20)`,
          border: `2px solid ${colorPrimary}40`,
        }}
      >
        {teamId ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={`https://www.mlbstatic.com/team-logos/${teamId}.svg`}
            alt={name}
            className={s.logo}
          />
        ) : (
          <span className="text-sm font-bold" style={{ color: colorPrimary }}>
            {name.split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 3)}
          </span>
        )}
      </div>
      <span className={`${s.label} ${dark ? "text-slate-200" : "text-slate-700"} font-semibold`}>{nameKo}</span>
    </div>
  );
}
