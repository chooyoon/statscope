"use client";

import PlayerMatchupPanel from "./PlayerMatchupPanel";
import { displayName } from "@/data/players";

interface BoxscorePlayer {
  person: { id: number; fullName: string };
  jerseyNumber: string;
  position: { abbreviation: string };
  stats: {
    batting: Record<string, number | string>;
    pitching: Record<string, number | string>;
    fielding: Record<string, number | string>;
  };
}

interface BoxscoreTeam {
  team: { id: number; name: string };
  players: Record<string, BoxscorePlayer>;
  batters: number[];
  pitchers: number[];
  battingOrder: number[];
  teamStats: {
    batting: Record<string, number | string>;
    pitching: Record<string, number | string>;
    fielding: Record<string, number | string>;
  };
}

interface OpposingPlayer {
  id: number;
  name: string;
}

function num(val: unknown): number {
  if (typeof val === "number") return val;
  if (typeof val === "string") return parseFloat(val) || 0;
  return 0;
}

// --- Interactive Lineup Table ---

export function InteractiveLineupTable({
  teamData,
  teamColor,
  teamName,
  abbreviation,
  opposingPitchers,
}: {
  teamData: BoxscoreTeam;
  teamColor: string;
  teamName: string;
  abbreviation: string;
  opposingPitchers: OpposingPlayer[];
}) {
  const order = teamData.battingOrder;
  if (!order || order.length === 0) {
    return (
      <div className="rounded-xl bg-white border border-slate-200 p-5">
        <p className="text-sm text-slate-500">라인업 정보가 없습니다.</p>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl bg-white border overflow-hidden"
      style={{ borderColor: `${teamColor}30` }}
    >
      <div
        className="px-4 py-2.5 text-sm font-bold"
        style={{ color: teamColor, backgroundColor: `${teamColor}10` }}
      >
        {teamName} ({abbreviation})
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="px-3 py-2 text-left text-xs text-slate-500 w-8">
              #
            </th>
            <th className="px-3 py-2 text-left text-xs text-slate-500">
              선수
            </th>
            <th className="px-3 py-2 text-center text-xs text-slate-500 w-10">
              포지션
            </th>
            <th className="px-3 py-2 text-center text-xs text-slate-500 w-14">
              타수
            </th>
            <th className="px-3 py-2 text-center text-xs text-slate-500 w-14">
              안타
            </th>
            <th className="px-3 py-2 text-center text-xs text-slate-500 w-14">
              HR
            </th>
            <th className="px-3 py-2 text-center text-xs text-slate-500 w-14">
              타점
            </th>
          </tr>
        </thead>
        <tbody>
          {order.map((playerId, idx) => {
            const player = teamData.players[`ID${playerId}`];
            if (!player) return null;
            const batting = player.stats?.batting;
            const h = num(batting?.hits);
            const hr = num(batting?.homeRuns);
            const ab = num(batting?.atBats);
            const rbi = num(batting?.rbi);
            const hasHit = h > 0;
            const hasHR = hr > 0;

            let rowClass =
              "border-b border-slate-100 hover:bg-slate-50 transition-colors";
            if (hasHR) {
              rowClass += " bg-red-500/5";
            } else if (hasHit) {
              rowClass += " bg-green-500/5";
            }

            const nameText = displayName(
              player.person.id,
              player.person.fullName
            );
            const nameClass = `text-xs font-medium ${
              hasHR
                ? "text-red-600"
                : hasHit
                ? "text-green-600"
                : "text-slate-600"
            }`;

            return (
              <tr key={playerId} className={rowClass}>
                <td className="px-3 py-2 text-xs text-slate-600 font-mono">
                  {idx + 1}
                </td>
                <td className="px-3 py-2">
                  <span className={nameClass}>
                    <PlayerMatchupPanel
                      playerId={player.person.id}
                      playerName={nameText}
                      isPitcher={false}
                      opposingPlayers={opposingPitchers}
                      teamColor={teamColor}
                    />
                  </span>
                </td>
                <td className="px-3 py-2 text-center text-xs text-slate-500">
                  {player.position?.abbreviation ?? "-"}
                </td>
                <td className="px-3 py-2 text-center text-xs font-mono text-slate-500">
                  {ab || "-"}
                </td>
                <td
                  className={`px-3 py-2 text-center text-xs font-mono font-bold ${
                    hasHit ? "text-green-600" : "text-slate-500"
                  }`}
                >
                  {h}
                </td>
                <td
                  className={`px-3 py-2 text-center text-xs font-mono font-bold ${
                    hasHR ? "text-red-600" : "text-slate-500"
                  }`}
                >
                  {hr || "-"}
                </td>
                <td className="px-3 py-2 text-center text-xs font-mono text-slate-500">
                  {rbi || "-"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// --- Interactive Pitching Table ---

function parseIP(ip: string | number): number {
  const val = typeof ip === "string" ? parseFloat(ip) : ip;
  const whole = Math.floor(val);
  const frac = Math.round((val - whole) * 10);
  return whole + frac / 3;
}

export function InteractivePitchingTable({
  teamData,
  teamColor,
  teamName,
  abbreviation,
  opposingBatters,
}: {
  teamData: BoxscoreTeam;
  teamColor: string;
  teamName: string;
  abbreviation: string;
  opposingBatters: OpposingPlayer[];
}) {
  const pitcherIds = teamData.pitchers;
  if (!pitcherIds || pitcherIds.length === 0) {
    return (
      <div className="rounded-xl bg-white border border-slate-200 p-5">
        <p className="text-sm text-slate-500">투수 기록이 없습니다.</p>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl bg-white border overflow-hidden"
      style={{ borderColor: `${teamColor}30` }}
    >
      <div
        className="px-4 py-2.5 text-sm font-bold"
        style={{ color: teamColor, backgroundColor: `${teamColor}10` }}
      >
        {teamName} ({abbreviation})
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[500px]">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="px-3 py-2 text-left text-xs text-slate-500">
                투수
              </th>
              <th className="px-3 py-2 text-center text-xs text-slate-500 w-12">
                IP
              </th>
              <th className="px-3 py-2 text-center text-xs text-slate-500 w-12">
                투구
              </th>
              <th className="px-3 py-2 text-center text-xs text-slate-500 w-10">
                H
              </th>
              <th className="px-3 py-2 text-center text-xs text-slate-500 w-10">
                R
              </th>
              <th className="px-3 py-2 text-center text-xs text-slate-500 w-10">
                ER
              </th>
              <th className="px-3 py-2 text-center text-xs text-slate-500 w-10">
                K
              </th>
              <th className="px-3 py-2 text-center text-xs text-slate-500 w-10">
                BB
              </th>
              <th className="px-3 py-2 text-center text-xs text-slate-500 w-10">
                HR
              </th>
              <th className="px-3 py-2 text-center text-xs text-slate-500 w-16">
                결과
              </th>
            </tr>
          </thead>
          <tbody>
            {pitcherIds.map((pid) => {
              const player = teamData.players[`ID${pid}`];
              if (!player) return null;
              const p = player.stats?.pitching;

              // Show all pitchers, even those without pitching stats
              const hasPitchingStats = p && (num(p.inningsPitched) > 0 || num(p.numberOfPitches) > 0);

              const ip = hasPitchingStats ? String(p.inningsPitched ?? "-") : "-";
              const pitchCount = hasPitchingStats ? num(p.numberOfPitches) : 0;
              const h = hasPitchingStats ? num(p.hits) : 0;
              const r = hasPitchingStats ? num(p.runs) : 0;
              const er = hasPitchingStats ? num(p.earnedRuns) : 0;
              const k = hasPitchingStats ? num(p.strikeOuts) : 0;
              const bb = hasPitchingStats ? num(p.baseOnBalls) : 0;
              const hr = hasPitchingStats ? num(p.homeRuns) : 0;

              let outcome = "";
              if (hasPitchingStats) {
                if (p.wins && num(p.wins) > 0) outcome = "승";
                else if (p.losses && num(p.losses) > 0) outcome = "패";
                else if (p.saves && num(p.saves) > 0) outcome = "세이브";
                else if (p.holds && num(p.holds) > 0) outcome = "홀드";
                else if (p.blownSaves && num(p.blownSaves) > 0) outcome = "블론";
              }

              const ipFloat = hasPitchingStats ? parseIP(p.inningsPitched ?? 0) : 0;
              const isGood = hasPitchingStats && ipFloat >= 5 && er <= 2;
              const isBad = hasPitchingStats && ipFloat < 3 && er >= 4;

              let rowClass =
                "border-b border-slate-100 hover:bg-slate-50 transition-colors";
              if (!hasPitchingStats) rowClass += " opacity-50";
              else if (isGood) rowClass += " bg-green-500/5";
              else if (isBad) rowClass += " bg-red-500/5";

              let outcomeClass = "text-slate-500";
              if (outcome === "승" || outcome === "세이브")
                outcomeClass = "text-green-600 font-bold";
              else if (outcome === "패" || outcome === "블론")
                outcomeClass = "text-red-600 font-bold";
              else if (outcome === "홀드") outcomeClass = "text-blue-600";

              const nameText = displayName(
                player.person.id,
                player.person.fullName
              );

              return (
                <tr key={pid} className={rowClass}>
                  <td className="px-3 py-2">
                    <span className="text-xs font-medium text-slate-600">
                      <PlayerMatchupPanel
                        playerId={player.person.id}
                        playerName={nameText}
                        isPitcher={true}
                        opposingPlayers={opposingBatters}
                        teamColor={teamColor}
                      />
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center text-xs font-mono text-slate-600">
                    {ip}
                  </td>
                  <td className="px-3 py-2 text-center text-xs font-mono text-slate-500">
                    {hasPitchingStats ? (pitchCount || "-") : "-"}
                  </td>
                  <td className="px-3 py-2 text-center text-xs font-mono text-slate-500">
                    {hasPitchingStats ? h : "-"}
                  </td>
                  <td className="px-3 py-2 text-center text-xs font-mono text-slate-500">
                    {hasPitchingStats ? r : "-"}
                  </td>
                  <td
                    className={`px-3 py-2 text-center text-xs font-mono ${
                      er >= 4 ? "text-red-600 font-bold" : "text-slate-500"
                    }`}
                  >
                    {hasPitchingStats ? er : "-"}
                  </td>
                  <td
                    className={`px-3 py-2 text-center text-xs font-mono ${
                      k >= 5 ? "text-green-600 font-bold" : "text-slate-500"
                    }`}
                  >
                    {hasPitchingStats ? k : "-"}
                  </td>
                  <td className="px-3 py-2 text-center text-xs font-mono text-slate-500">
                    {hasPitchingStats ? bb : "-"}
                  </td>
                  <td
                    className={`px-3 py-2 text-center text-xs font-mono ${
                      hr > 0 ? "text-red-600" : "text-slate-500"
                    }`}
                  >
                    {hasPitchingStats ? hr : "-"}
                  </td>
                  <td
                    className={`px-3 py-2 text-center text-xs ${outcomeClass}`}
                  >
                    {outcome || "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Bench Pitchers - pitchers on roster who did NOT pitch */}
      {(() => {
        const pitchedSet = new Set(pitcherIds);
        const benchPitchers = Object.entries(teamData.players)
          .filter(([key, player]) => {
            if (!key.startsWith("ID")) return false;
            const pid = parseInt(key.replace("ID", ""), 10);
            if (pitchedSet.has(pid)) return false;
            // Include players whose position is a pitching position
            const pos = player.position?.abbreviation;
            return pos === "P" || pos === "SP" || pos === "RP" || pos === "CL";
          })
          .map(([, player]) => player);

        if (benchPitchers.length === 0) return null;

        return (
          <div className="border-t border-slate-200 px-4 py-3">
            <p className="text-xs font-semibold text-slate-500 mb-2">
              벤치 투수 (미등판)
            </p>
            <div className="flex flex-wrap gap-2">
              {benchPitchers.map((player) => {
                const nameText = displayName(
                  player.person.id,
                  player.person.fullName
                );
                return (
                  <span
                    key={player.person.id}
                    className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 border border-slate-200 px-2 py-1"
                  >
                    <span className="text-[10px] font-mono text-slate-600">
                      #{player.jerseyNumber ?? "-"}
                    </span>
                    <span className="text-xs text-slate-500">{nameText}</span>
                  </span>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
