"use client";

import PlayerMatchupPanel from "./PlayerMatchupPanel";
import { displayName } from "@/data/players";

interface RosterFielder {
  id: number;
  fullName: string;
  jerseyNumber: string;
  position: string;
}

interface OpposingPlayer {
  id: number;
  name: string;
}

interface FielderStaffClientProps {
  rosterFielders: RosterFielder[];
  teamColor: string;
  teamName: string;
  abbreviation: string;
  opposingPitchers: OpposingPlayer[];
}

export default function FielderStaffClient({
  rosterFielders,
  teamColor,
  teamName,
  abbreviation,
  opposingPitchers,
}: FielderStaffClientProps) {
  if (rosterFielders.length === 0) {
    return (
      <div className="p-4">
        <p className="text-xs text-slate-500">No fielder information available.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-1.5">
      {rosterFielders.map((fielder) => {
        const nameText = displayName(fielder.id, fielder.fullName);
        return (
          <div
            key={fielder.id}
            className="flex items-center gap-2 hover:bg-slate-50 rounded-md px-1 py-1 transition-colors"
          >
            <span
              className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold text-white shrink-0"
              style={{ backgroundColor: teamColor }}
            >
              {fielder.jerseyNumber || "-"}
            </span>
            <span className="text-xs font-medium text-slate-600 flex-1">
              <PlayerMatchupPanel
                playerId={fielder.id}
                playerName={nameText}
                isPitcher={false}
                opposingPlayers={opposingPitchers}
                teamColor={teamColor}
              />
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {fielder.position}
            </span>
          </div>
        );
      })}
    </div>
  );
}
