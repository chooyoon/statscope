import type { Metadata } from "next";
import { Suspense } from "react";
import { fetchPlayerStats, fetchPlayerSearch } from "@/lib/sports/mlb/api";
import { playerNamesKo } from "@/data/players";
import { getTeamById } from "@/data/teams";
import PlayerCard from "@/components/ui/PlayerCard";
import SearchBar from "./SearchBar";

export const metadata: Metadata = {
  title: "MLB 선수 분석 | StatScope",
  description:
    "MLB 주요 선수들의 타격, 투구 스탯과 세이버매트릭스 분석을 확인하세요.",
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
          &quot;{query}&quot;에 대한 검색 결과가 없습니다.
        </p>
      </div>
    );
  }

  return (
    <section>
      <h2 className="text-xl font-bold text-slate-800 mb-6">
        &quot;{query}&quot; 검색 결과{" "}
        <span className="text-slate-500 text-base font-normal">
          ({players.length}명)
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
          MLB 선수 분석
        </h1>
        <p className="text-slate-500 max-w-2xl mx-auto mb-8">
          선수를 검색하거나 주요 스타 선수들의 성적과 세이버매트릭스를
          확인하세요.
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
              <p className="text-slate-500 mt-4">검색 중...</p>
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
              <p className="text-slate-500 mt-4">선수 데이터 로딩 중...</p>
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
        주요 선수
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
