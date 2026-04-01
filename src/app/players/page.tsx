import type { Metadata } from "next";
import { Suspense } from "react";
import { fetchPlayerStats, fetchPlayerSearch } from "@/lib/sports/mlb/api";
import { playerNamesKo } from "@/data/players";
import { getTeamById } from "@/data/teams";
import PlayerCard from "@/components/ui/PlayerCard";
import SearchBar from "./SearchBar";

export const metadata: Metadata = {
  title: "MLB Player Analysis | StatScope",
  description:
    "Explore batting, pitching stats and sabermetrics analysis for top MLB players.",
  openGraph: {
    title: "MLB Player Analysis | StatScope",
    description: "Advanced stats and sabermetrics for every MLB player.",
  },
};

const FEATURED_HITTERS = [
  660271, // Ohtani
  592450, // Judge
  547180, // Harper
  677951, // Bobby Witt Jr
  608070, // Jose Ramirez
  665489, // Vlad Jr
  683002, // Gunnar Henderson
  665742, // Soto
  608369, // Seager
  681481, // Elly De La Cruz
  677594, // Julio Rodriguez
  596019, // Lindor
];

const CURRENT_SEASON = new Date().getFullYear();

interface PlayerCardData {
  id: number;
  name: string;
  nameKo?: string;
  position: string;
  jerseyNumber?: number;
  teamColor: string;
  stats?: Record<string, any>;
}

async function getFeaturedPlayers(): Promise<PlayerCardData[]> {
  const results = await Promise.allSettled(
    FEATURED_HITTERS.map(async (id) => {
      const data = await fetchPlayerStats(id, CURRENT_SEASON, "hitting");
      const player = data.people?.[0];
      if (!player) return null;

      const team = player.currentTeam
        ? getTeamById(player.currentTeam.id)
        : undefined;

      const seasonStats = player.stats?.[0]?.splits?.[0]?.stat;

      return {
        id: player.id,
        name: player.fullName,
        nameKo: playerNamesKo[player.id],
        position: player.primaryPosition.abbreviation,
        jerseyNumber: player.primaryNumber
          ? parseInt(player.primaryNumber, 10)
          : undefined,
        teamColor: team?.colorPrimary ?? "#6366f1",
        stats: seasonStats
          ? {
              avg: seasonStats.avg,
              ops: seasonStats.ops,
              hr: seasonStats.homeRuns,
            }
          : undefined,
      } satisfies PlayerCardData;
    })
  );

  return results
    .filter((r) => r.status === "fulfilled")
    .map((r) => (r as PromiseFulfilledResult<PlayerCardData | null>).value)
    .filter((v): v is PlayerCardData => v !== null);
}

async function SearchResults({ query }: { query: string }) {
  const data = await fetchPlayerSearch(query);
  const players = data.people ?? [];

  if (players.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500 text-lg">
          No results found for &quot;{query}&quot;.
        </p>
      </div>
    );
  }

  return (
    <section>
      <h2 className="text-xl font-bold text-slate-800 mb-6">
        Results for &quot;{query}&quot;{" "}
        <span className="text-slate-500 text-base font-normal">
          ({players.length} players)
        </span>
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {players.slice(0, 20).map((player) => {
          const team = player.currentTeam
            ? getTeamById(player.currentTeam.id)
            : undefined;
          return (
            <PlayerCard
              key={player.id}
              playerId={player.id}
              name={player.fullName}
              nameKo={playerNamesKo[player.id]}
              position={player.primaryPosition.abbreviation}
              jerseyNumber={
                player.primaryNumber
                  ? parseInt(player.primaryNumber, 10)
                  : undefined
              }
              teamColor={team?.colorPrimary ?? "#6366f1"}
            />
          );
        })}
      </div>
    </section>
  );
}

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Page Header */}
      <div className="text-center mb-10">
        <h1 className="text-3xl md:text-4xl font-extrabold text-slate-800 mb-3">
          MLB Player Analysis
        </h1>
        <p className="text-slate-500 max-w-2xl mx-auto mb-8">
          Search any player or explore featured stars with advanced stats and sabermetrics.
        </p>
        <Suspense>
          <SearchBar />
        </Suspense>
      </div>

      {/* Search Results or Featured Players */}
      {query ? (
        <Suspense
          fallback={
            <div className="text-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-600 border-t-blue-500" />
              <p className="text-slate-500 mt-4">Searching...</p>
            </div>
          }
        >
          <SearchResults query={query} />
        </Suspense>
      ) : (
        <Suspense
          fallback={
            <div className="text-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-600 border-t-blue-500" />
              <p className="text-slate-500 mt-4">Loading player data...</p>
            </div>
          }
        >
          <FeaturedPlayersSection />
        </Suspense>
      )}
    </div>
  );
}

async function FeaturedPlayersSection() {
  const players = await getFeaturedPlayers();

  return (
    <section>
      <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
        <span className="inline-block w-1 h-6 bg-blue-500 rounded-full" />
        Featured Players
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {players.map((player) => (
          <PlayerCard
            key={player.id}
            playerId={player.id}
            name={player.name}
            nameKo={player.nameKo}
            position={player.position}
            jerseyNumber={player.jerseyNumber}
            teamColor={player.teamColor}
            stats={player.stats}
          />
        ))}
      </div>
    </section>
  );
}
