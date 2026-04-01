"use client";

import { useState, useCallback } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

// --- Types ---

interface SearchResult {
  id: number;
  fullName: string;
  primaryPosition: { abbreviation: string; name: string };
  primaryNumber?: string;
  currentTeam?: { id: number; name: string };
}

interface PlayerMatchupData {
  id: number;
  name: string;
  position: string;
  jerseyNumber?: string;
  teamName?: string;
  teamColor: string;
  stats: Record<string, any>;
  sabermetrics: {
    wOBA: number;
    "wRC+": number;
    BABIP: number;
    ISO: number;
    "K%": number;
    "BB%": number;
  };
}

// --- Team color lookup (minimal client-side) ---

const TEAM_COLORS: Record<number, string> = {
  108: "#BA0021", 109: "#A71930", 110: "#DF4601", 111: "#BD3039",
  112: "#0E3386", 113: "#C6011F", 114: "#00385D", 115: "#33006F",
  116: "#0C2340", 117: "#002D62", 118: "#004687", 119: "#005A9C",
  120: "#AB0003", 121: "#002D72", 133: "#003831", 134: "#27251F",
  135: "#2F241D", 136: "#0C2C56", 137: "#FD5A1E", 138: "#C41E3A",
  139: "#092C5C", 140: "#003278", 141: "#134A8E", 142: "#002B5C",
  143: "#E81828", 144: "#CE1141", 145: "#27251F", 146: "#00A3E0",
  147: "#003087", 158: "#12284B",
};

// --- Sabermetrics calculations (client-side duplicates for instant calculation) ---

function calcWOBA(s: Record<string, any>): number {
  const singles = (s.hits ?? 0) - (s.doubles ?? 0) - (s.triples ?? 0) - (s.homeRuns ?? 0);
  const denom = (s.atBats ?? 0) + (s.baseOnBalls ?? 0) - (s.intentionalWalks ?? 0) + (s.sacFlies ?? 0) + (s.hitByPitch ?? 0);
  if (denom === 0) return 0;
  const num = 0.69 * ((s.baseOnBalls ?? 0) - (s.intentionalWalks ?? 0)) + 0.72 * (s.hitByPitch ?? 0) + 0.88 * singles + 1.27 * (s.doubles ?? 0) + 1.62 * (s.triples ?? 0) + 2.1 * (s.homeRuns ?? 0);
  return Math.round((num / denom) * 1000) / 1000;
}

function calcWRCPlus(s: Record<string, any>): number {
  const wOBA = calcWOBA(s);
  const pa = s.plateAppearances ?? 0;
  if (pa === 0) return 0;
  const wRAA = ((wOBA - 0.318) / 1.21) * pa;
  const wRC = wRAA + 0.11 * pa;
  const leagueWRC = 0.11 * pa;
  if (leagueWRC === 0) return 0;
  return Math.round((wRC / leagueWRC) * 100);
}

function calcBABIP(s: Record<string, any>): number {
  const denom = (s.atBats ?? 0) - (s.strikeOuts ?? 0) - (s.homeRuns ?? 0) + (s.sacFlies ?? 0);
  if (denom <= 0) return 0;
  return Math.round(((s.hits ?? 0) - (s.homeRuns ?? 0)) / denom * 1000) / 1000;
}

function calcISO(s: Record<string, any>): number {
  const slg = typeof s.slg === "string" ? parseFloat(s.slg) : (s.slg ?? 0);
  const avg = typeof s.avg === "string" ? parseFloat(s.avg) : (s.avg ?? 0);
  return Math.round((slg - avg) * 1000) / 1000;
}

function calcKPct(s: Record<string, any>): number {
  const pa = s.plateAppearances ?? 0;
  if (pa === 0) return 0;
  return Math.round(((s.strikeOuts ?? 0) / pa) * 1000) / 10;
}

function calcBBPct(s: Record<string, any>): number {
  const pa = s.plateAppearances ?? 0;
  if (pa === 0) return 0;
  return Math.round(((s.baseOnBalls ?? 0) / pa) * 1000) / 10;
}

function computeSabermetrics(stats: Record<string, any>) {
  return {
    wOBA: calcWOBA(stats),
    "wRC+": calcWRCPlus(stats),
    BABIP: calcBABIP(stats),
    ISO: calcISO(stats),
    "K%": calcKPct(stats),
    "BB%": calcBBPct(stats),
  };
}

// --- Component ---

export default function MatchupClient() {
  const [queryA, setQueryA] = useState("");
  const [queryB, setQueryB] = useState("");
  const [resultsA, setResultsA] = useState<SearchResult[]>([]);
  const [resultsB, setResultsB] = useState<SearchResult[]>([]);
  const [playerA, setPlayerA] = useState<PlayerMatchupData | null>(null);
  const [playerB, setPlayerB] = useState<PlayerMatchupData | null>(null);
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);
  const [showDropA, setShowDropA] = useState(false);
  const [showDropB, setShowDropB] = useState(false);

  const searchPlayers = useCallback(
    async (query: string, side: "A" | "B") => {
      if (query.trim().length < 2) {
        side === "A" ? setResultsA([]) : setResultsB([]);
        return;
      }
      try {
        const res = await fetch(
          `/api/players/search?q=${encodeURIComponent(query.trim())}`
        );
        const data = await res.json();
        const people = (data.people ?? []).slice(0, 8);
        if (side === "A") {
          setResultsA(people);
          setShowDropA(people.length > 0);
        } else {
          setResultsB(people);
          setShowDropB(people.length > 0);
        }
      } catch {
        // Silently handle search errors
      }
    },
    []
  );

  const selectPlayer = useCallback(
    async (p: SearchResult, side: "A" | "B") => {
      const setter = side === "A" ? setPlayerA : setPlayerB;
      const setLoading = side === "A" ? setLoadingA : setLoadingB;
      const setShow = side === "A" ? setShowDropA : setShowDropB;
      const setQuery = side === "A" ? setQueryA : setQueryB;

      setShow(false);
      setQuery(p.fullName);
      setLoading(true);

      try {
        // Fetch from MLB API via our stats endpoint (we use the search result data + stats)
        const res = await fetch(
          `https://statsapi.mlb.com/api/v1/people/${p.id}?hydrate=stats(group=[hitting],type=[season],season=${new Date().getFullYear()})`
        );
        const data = await res.json();
        const player = data.people?.[0];
        const stats = player?.stats?.[0]?.splits?.[0]?.stat ?? {};

        const teamId = p.currentTeam?.id;
        const teamColor = teamId ? (TEAM_COLORS[teamId] ?? "#6366f1") : "#6366f1";

        setter({
          id: p.id,
          name: p.fullName,
          position: p.primaryPosition.abbreviation,
          jerseyNumber: p.primaryNumber,
          teamName: p.currentTeam?.name,
          teamColor,
          stats,
          sabermetrics: computeSabermetrics(stats),
        });
      } catch {
        setter(null);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Comparison stat bars
  const comparisonStats = [
    { key: "avg", label: "AVG", format: (v: any) => parseFloat(v || "0").toFixed(3) },
    { key: "obp", label: "OBP", format: (v: any) => parseFloat(v || "0").toFixed(3) },
    { key: "slg", label: "SLG", format: (v: any) => parseFloat(v || "0").toFixed(3) },
    { key: "ops", label: "OPS", format: (v: any) => parseFloat(v || "0").toFixed(3) },
    { key: "homeRuns", label: "HR", format: (v: any) => String(v ?? 0) },
    { key: "rbi", label: "RBI", format: (v: any) => String(v ?? 0) },
    { key: "hits", label: "Hits", format: (v: any) => String(v ?? 0) },
    { key: "stolenBases", label: "SB", format: (v: any) => String(v ?? 0) },
  ];

  // Radar chart data for overlay
  const radarLabels = ["wOBA", "wRC+", "BABIP", "ISO", "K% (inv)", "BB%"];
  const leagueAvg = { wOBA: 0.318, "wRC+": 100, BABIP: 0.3, ISO: 0.15, "K%": 22.0, "BB%": 8.5 };

  function normalizeRadar(sm: PlayerMatchupData["sabermetrics"]) {
    return [
      Math.round((sm.wOBA / leagueAvg.wOBA) * 100),
      sm["wRC+"],
      Math.round((sm.BABIP / leagueAvg.BABIP) * 100),
      Math.round((sm.ISO / leagueAvg.ISO) * 100),
      Math.round((leagueAvg["K%"] / Math.max(sm["K%"], 1)) * 100),
      Math.round((sm["BB%"] / leagueAvg["BB%"]) * 100),
    ];
  }

  const radarChartData =
    playerA && playerB
      ? radarLabels.map((label, i) => {
          const aVals = normalizeRadar(playerA.sabermetrics);
          const bVals = normalizeRadar(playerB.sabermetrics);
          return {
            label,
            playerA: aVals[i],
            playerB: bVals[i],
          };
        })
      : null;

  return (
    <div className="space-y-8">
      {/* Search Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Player A */}
        <div className="relative">
          <label className="block text-sm font-semibold text-blue-600 mb-2">
            Player A
          </label>
          <input
            type="text"
            value={queryA}
            onChange={(e) => {
              setQueryA(e.target.value);
              searchPlayers(e.target.value, "A");
            }}
            onFocus={() => resultsA.length > 0 && setShowDropA(true)}
            placeholder="Search player name..."
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {showDropA && (
            <div className="absolute z-20 top-full mt-1 w-full rounded-xl bg-white border border-slate-200 shadow-xl max-h-64 overflow-y-auto">
              {resultsA.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-100 transition-colors text-sm"
                  onClick={() => selectPlayer(p, "A")}
                >
                  <span className="text-slate-800 font-medium">
                    {p.fullName}
                  </span>
                  <span className="text-slate-500 ml-2 text-xs">
                    {p.primaryPosition.abbreviation}
                    {p.currentTeam ? ` - ${p.currentTeam.name}` : ""}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Player B */}
        <div className="relative">
          <label className="block text-sm font-semibold text-red-600 mb-2">
            Player B
          </label>
          <input
            type="text"
            value={queryB}
            onChange={(e) => {
              setQueryB(e.target.value);
              searchPlayers(e.target.value, "B");
            }}
            onFocus={() => resultsB.length > 0 && setShowDropB(true)}
            placeholder="Search player name..."
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 placeholder-slate-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          />
          {showDropB && (
            <div className="absolute z-20 top-full mt-1 w-full rounded-xl bg-white border border-slate-200 shadow-xl max-h-64 overflow-y-auto">
              {resultsB.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-100 transition-colors text-sm"
                  onClick={() => selectPlayer(p, "B")}
                >
                  <span className="text-slate-800 font-medium">
                    {p.fullName}
                  </span>
                  <span className="text-slate-500 ml-2 text-xs">
                    {p.primaryPosition.abbreviation}
                    {p.currentTeam ? ` - ${p.currentTeam.name}` : ""}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Loading States */}
      {(loadingA || loadingB) && (
        <div className="text-center py-8">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-600 border-t-blue-500" />
          <p className="text-slate-400 mt-3">Loading player data...</p>
        </div>
      )}

      {/* Player Cards Side by Side */}
      {(playerA || playerB) && !loadingA && !loadingB && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[playerA, playerB].map((player, idx) => {
            if (!player) {
              return (
                <div
                  key={idx}
                  className="rounded-xl bg-white border border-slate-200 p-8 flex items-center justify-center min-h-[200px]"
                >
                  <p className="text-slate-500">
                    Select {idx === 0 ? "Player A" : "Player B"}
                  </p>
                </div>
              );
            }
            const accentColor = idx === 0 ? "#3b82f6" : "#ef4444";
            return (
              <div
                key={player.id}
                className="rounded-xl p-[2px]"
                style={{
                  background: `linear-gradient(135deg, ${player.teamColor}, ${player.teamColor}44, transparent)`,
                }}
              >
                <div className="rounded-xl bg-white p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div
                      className="w-16 h-16 rounded-full flex items-center justify-center shrink-0 relative"
                      style={{
                        background: `linear-gradient(135deg, ${player.teamColor}50, ${player.teamColor}20)`,
                        border: `2px solid ${player.teamColor}80`,
                      }}
                    >
                      <svg
                        viewBox="0 0 100 100"
                        className="w-10 h-10"
                        style={{ color: `${player.teamColor}88` }}
                        fill="currentColor"
                      >
                        <circle cx="50" cy="35" r="18" />
                        <ellipse cx="50" cy="80" rx="28" ry="22" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-800">
                        {player.name}
                      </h3>
                      <p className="text-sm text-slate-400">
                        {player.position}
                        {player.jerseyNumber ? ` #${player.jerseyNumber}` : ""}
                        {player.teamName ? ` - ${player.teamName}` : ""}
                      </p>
                    </div>
                    <span
                      className="ml-auto text-xs font-bold px-2 py-1 rounded-full"
                      style={{
                        backgroundColor: `${accentColor}20`,
                        color: accentColor,
                      }}
                    >
                      {idx === 0 ? "A" : "B"}
                    </span>
                  </div>
                  {/* Quick stats */}
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { key: "avg", label: "AVG" },
                      { key: "homeRuns", label: "HR" },
                      { key: "rbi", label: "RBI" },
                      { key: "ops", label: "OPS" },
                    ].map(({ key, label }) => (
                      <div
                        key={key}
                        className="text-center rounded-lg bg-slate-100 px-2 py-2"
                      >
                        <p className="text-[10px] text-slate-500">{label}</p>
                        <p className="text-sm font-bold font-mono text-slate-700">
                          {player.stats[key] ?? "-"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Overlaid Radar Chart */}
      {radarChartData && playerA && playerB && (
        <section className="rounded-xl bg-white border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-4 text-center">
            Sabermetrics Comparison (100 = League Avg)
          </h2>
          <ResponsiveContainer width="100%" height={380}>
            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarChartData}>
              <PolarGrid stroke="#334155" />
              <PolarAngleAxis
                dataKey="label"
                tick={{ fill: "#94a3b8", fontSize: 12 }}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, "auto"]}
                tick={{ fill: "#64748b", fontSize: 10 }}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  color: "#334155",
                  fontSize: "12px",
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: "12px", color: "#94a3b8" }}
              />
              <Radar
                name={playerA.name}
                dataKey="playerA"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.2}
                strokeWidth={2}
              />
              <Radar
                name={playerB.name}
                dataKey="playerB"
                stroke="#ef4444"
                fill="#ef4444"
                fillOpacity={0.2}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* Stat-by-Stat Comparison Bars */}
      {playerA && playerB && (
        <section className="rounded-xl bg-white border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-6 text-center">
            Stat Comparison
          </h2>
          <div className="space-y-4">
            {comparisonStats.map(({ key, label, format }) => {
              const valA = parseFloat(format(playerA.stats[key]));
              const valB = parseFloat(format(playerB.stats[key]));
              const max = Math.max(valA, valB, 0.001);
              const pctA = (valA / max) * 100;
              const pctB = (valB / max) * 100;
              const aWins = valA > valB;
              const bWins = valB > valA;
              const tie = valA === valB;

              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`text-sm font-bold font-mono ${
                        aWins ? "text-green-600" : tie ? "text-slate-600" : "text-red-600"
                      }`}
                    >
                      {format(playerA.stats[key])}
                    </span>
                    <span className="text-xs text-slate-400 font-semibold">
                      {label}
                    </span>
                    <span
                      className={`text-sm font-bold font-mono ${
                        bWins ? "text-green-600" : tie ? "text-slate-600" : "text-red-600"
                      }`}
                    >
                      {format(playerB.stats[key])}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 h-3">
                    {/* Player A bar (right-aligned) */}
                    <div className="flex-1 flex justify-end">
                      <div
                        className={`h-full rounded-l-full transition-all duration-500 ${
                          aWins ? "bg-green-500" : tie ? "bg-slate-500" : "bg-red-500/60"
                        }`}
                        style={{ width: `${pctA}%` }}
                      />
                    </div>
                    <div className="w-px h-full bg-slate-600 shrink-0" />
                    {/* Player B bar (left-aligned) */}
                    <div className="flex-1">
                      <div
                        className={`h-full rounded-r-full transition-all duration-500 ${
                          bWins ? "bg-green-500" : tie ? "bg-slate-500" : "bg-red-500/60"
                        }`}
                        style={{ width: `${pctB}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-4 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
              {playerA.name}
            </span>
            <span className="flex items-center gap-1">
              {playerB.name}
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
            </span>
          </div>
        </section>
      )}

      {/* Empty state */}
      {!playerA && !playerB && !loadingA && !loadingB && (
        <div className="text-center py-16">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-slate-100 flex items-center justify-center">
            <svg
              className="w-12 h-12 text-slate-600"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
              />
            </svg>
          </div>
          <p className="text-slate-400 text-lg mb-2">
            Search two players to start comparing
          </p>
          <p className="text-slate-500 text-sm">
            Type a player name in the search box to see autocomplete suggestions
          </p>
        </div>
      )}
    </div>
  );
}
