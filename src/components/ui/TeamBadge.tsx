"use client";

import { useState } from "react";
import { getTeamById } from "@/data/teams";

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
  sm: { circle: "w-10 h-10", text: "text-[11px]", label: "text-xs" },
  md: { circle: "w-14 h-14", text: "text-sm", label: "text-sm" },
  lg: { circle: "w-20 h-20", text: "text-lg", label: "text-base" },
};

function getInitials(name: string): string {
  // Use team city abbreviation-style: "New York Yankees" → "NYY"
  const words = name.split(/\s+/);
  if (words.length >= 3) return (words[0][0] + words[1][0] + words[2][0]).toUpperCase();
  if (words.length === 2) return (words[0][0] + words[1].slice(0, 2)).toUpperCase();
  return words[0].slice(0, 3).toUpperCase();
}

export default function TeamBadge({
  name,
  nameKo,
  colorPrimary,
  colorAccent,
  teamId,
  size = "md",
  dark = false,
}: TeamBadgeProps) {
  const [logoError, setLogoError] = useState(false);
  const s = sizeMap[size];
  const team = teamId ? getTeamById(teamId) : null;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={`${s.circle} rounded-full flex items-center justify-center font-extrabold text-white shadow-lg overflow-hidden`}
        style={{
          background: team?.logo && !logoError
            ? "transparent"
            : `linear-gradient(135deg, ${colorPrimary}, ${colorAccent})`,
        }}
      >
        {team?.logo && !logoError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={team.logo}
            alt={name}
            className="w-full h-full object-contain p-1"
            onError={() => setLogoError(true)}
          />
        ) : (
          <span className={s.text}>{getInitials(name)}</span>
        )}
      </div>
      <span className={`${s.label} ${dark ? "text-slate-200" : "text-slate-700"} font-semibold whitespace-nowrap`}>
        {name}
      </span>
    </div>
  );
}
