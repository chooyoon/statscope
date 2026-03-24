"use client";

import Link from "next/link";
import StatBar from "./StatBar";

interface PlayerCardProps {
  playerId: number;
  name: string;
  nameKo?: string;
  position: string;
  jerseyNumber?: number;
  teamColor: string;
  stats?: Record<string, any>;
  isPitcher?: boolean;
}

const PITCHER_STATS = [
  { key: "era", label: "ERA", max: 6 },
  { key: "whip", label: "WHIP", max: 2 },
  { key: "k", label: "K", max: 300 },
];

const HITTER_STATS = [
  { key: "avg", label: "AVG", max: 0.4 },
  { key: "ops", label: "OPS", max: 1.2 },
  { key: "hr", label: "HR", max: 60 },
];

export default function PlayerCard({
  playerId,
  name,
  nameKo,
  position,
  jerseyNumber,
  teamColor,
  stats,
  isPitcher = false,
}: PlayerCardProps) {
  const statConfig = isPitcher ? PITCHER_STATS : HITTER_STATS;

  return (
    <Link href={`/players/${playerId}`} className="block group">
      <div
        className="relative rounded-xl p-[2px] transition-transform duration-200 group-hover:scale-[1.02]"
        style={{
          background: `linear-gradient(135deg, ${teamColor}, ${teamColor}66, transparent)`,
        }}
      >
        <div className="rounded-xl bg-white p-5">
          {/* Silhouette + Info */}
          <div className="flex items-center gap-4 mb-4">
            {/* Silhouette circle */}
            <div
              className="relative w-16 h-16 rounded-full flex items-center justify-center shrink-0"
              style={{
                background: `linear-gradient(135deg, ${teamColor}40, ${teamColor}20)`,
                border: `2px solid ${teamColor}80`,
              }}
            >
              {jerseyNumber !== undefined && (
                <span
                  className="text-xl font-bold"
                  style={{ color: teamColor }}
                >
                  {jerseyNumber}
                </span>
              )}
              <span
                className="absolute -bottom-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-white"
                style={{ color: teamColor }}
              >
                {position}
              </span>
            </div>

            {/* Name */}
            <div className="min-w-0">
              {nameKo && (
                <p className="text-lg font-bold text-slate-800 truncate">
                  {nameKo}
                </p>
              )}
              <p
                className={`${nameKo ? "text-sm text-slate-400" : "text-lg font-bold text-slate-800"} truncate`}
              >
                {name}
              </p>
            </div>
          </div>

          {/* Stats */}
          {stats && (
            <div className="space-y-2">
              {statConfig.map(({ key, label, max }) => {
                const val = stats[key];
                if (val === undefined) return null;
                return (
                  <StatBar
                    key={key}
                    label={label}
                    value={val}
                    max={max}
                    barColor={teamColor}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
