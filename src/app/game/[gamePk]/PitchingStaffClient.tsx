"use client";

import PlayerMatchupPanel from "./PlayerMatchupPanel";
import { displayName } from "@/data/players";

interface RosterPitcher {
  id: number;
  fullName: string;
  jerseyNumber: string;
  position: string;
}

interface OpposingPlayer {
  id: number;
  name: string;
}

interface PitchingStaffClientProps {
  rosterPitchers: RosterPitcher[];
  teamColor: string;
  teamName: string;
  abbreviation: string;
  opposingBatters: OpposingPlayer[];
}

export default function PitchingStaffClient({
  rosterPitchers,
  teamColor,
  teamName,
  abbreviation,
  opposingBatters,
}: PitchingStaffClientProps) {
  if (rosterPitchers.length === 0) {
    return (
      <div
        className="rounded-xl bg-white border overflow-hidden"
        style={{ borderColor: `${teamColor}30` }}
      >
        <div
          className="px-4 py-2.5 text-sm font-bold"
          style={{ color: teamColor, backgroundColor: `${teamColor}10` }}
        >
          {teamName} ({abbreviation}) 투수진
        </div>
        <div className="p-4">
          <p className="text-xs text-slate-600">투수 정보가 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl bg-white border overflow-hidden"
      style={{ borderColor: `${teamColor}30` }}
    >
      <div
        className="px-4 py-2.5 text-sm font-bold flex items-center justify-between"
        style={{ color: teamColor, backgroundColor: `${teamColor}10` }}
      >
        <span>{teamName} ({abbreviation}) 액티브 로스터 투수진</span>
        <span className="text-[10px] font-normal text-slate-500">
          {rosterPitchers.length}명
        </span>
      </div>

      <div className="p-4 space-y-1.5">
        {rosterPitchers.map((pitcher) => {
          const nameText = displayName(pitcher.id, pitcher.fullName);
          return (
            <div
              key={pitcher.id}
              className="flex items-center gap-2 hover:bg-slate-50 rounded-md px-1 py-1 transition-colors"
            >
              <span
                className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold text-white shrink-0"
                style={{ backgroundColor: teamColor }}
              >
                {pitcher.jerseyNumber || "P"}
              </span>
              <span className="text-xs font-medium text-slate-600">
                <PlayerMatchupPanel
                  playerId={pitcher.id}
                  playerName={nameText}
                  isPitcher={true}
                  opposingPlayers={opposingBatters}
                  teamColor={teamColor}
                />
              </span>
              <span className="text-[10px] text-slate-600">
                {pitcher.position}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
