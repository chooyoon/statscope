"use client";

import { useAuth } from "@/contexts/AuthContext";
import { teams as allTeams } from "@/data/teams";
import { playerNamesKo } from "@/data/players";
import Link from "next/link";

export default function Dashboard() {
  const { user, profile, toggleFavoriteTeam, toggleFavoritePlayer } = useAuth();

  if (!user || !profile) return null;

  const favoriteTeamData = (profile.favoriteTeams ?? [])
    .map((id) => allTeams[id])
    .filter(Boolean);

  const favoritePlayerData = (profile.favoritePlayers ?? []).map((id) => ({
    id,
    nameKo: playerNamesKo[id] ?? `Player #${id}`,
  }));

  const hasAny = favoriteTeamData.length > 0 || favoritePlayerData.length > 0;

  return (
    <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden mb-8">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {user.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.photoURL}
              alt="User profile"
              className="w-8 h-8 rounded-full"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold">
              {(user.displayName ?? "U")[0].toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-sm font-bold text-slate-800">
              {user.displayName ?? "User"}'s Dashboard
            </p>
            <p className="text-xs text-slate-400">Set your favorite teams and players</p>
          </div>
        </div>
      </div>

      <div className="p-5">
        {!hasAny ? (
          <div className="text-center py-6">
            <p className="text-sm text-slate-500 mb-4">
              No favorite teams or players yet. Add some below!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Favorite Teams */}
            {favoriteTeamData.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-400 mb-2">Favorite Teams</p>
                <div className="flex flex-wrap gap-2">
                  {favoriteTeamData.map((t) => (
                    <Link
                      key={t.id}
                      href={`/team/${t.slug}`}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors hover:border-slate-300"
                      style={{
                        borderColor: `${t.colorPrimary}30`,
                        backgroundColor: `${t.colorPrimary}08`,
                      }}
                    >
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                        style={{
                          background: `linear-gradient(135deg, ${t.colorPrimary}, ${t.colorAccent})`,
                        }}
                      >
                        {t.abbreviation[0]}
                      </div>
                      <span className="text-sm font-medium text-slate-700">
                        {t.nameKo}
                      </span>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          toggleFavoriteTeam(t.id);
                        }}
                        className="ml-1 text-slate-400 hover:text-red-500 transition-colors"
                        title="Remove from favorites"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Favorite Players */}
            {favoritePlayerData.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-400 mb-2">Favorite Players</p>
                <div className="flex flex-wrap gap-2">
                  {favoritePlayerData.map((p) => (
                    <Link
                      key={p.id}
                      href={`/players/${p.id}`}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 transition-colors hover:border-slate-300"
                    >
                      <span className="text-sm font-medium text-slate-700">
                        {p.nameKo}
                      </span>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          toggleFavoritePlayer(p.id);
                        }}
                        className="ml-1 text-slate-400 hover:text-red-500 transition-colors"
                        title="Remove from favorites"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Quick add teams */}
        <div className="mt-4 pt-4 border-t border-slate-100">
          <p className="text-xs font-semibold text-slate-400 mb-2">Quick Add Teams</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.values(allTeams)
              .sort((a, b) => a.nameKo.localeCompare(b.nameKo))
              .slice(0, 15)
              .map((t) => {
                const isFav = profile.favoriteTeams?.includes(t.id);
                return (
                  <button
                    key={t.id}
                    onClick={() => toggleFavoriteTeam(t.id)}
                    className={`text-[11px] font-semibold px-2 py-1 rounded-full border transition-colors ${
                      isFav
                        ? "text-white border-transparent"
                        : "border-slate-200 text-slate-500 hover:border-slate-300"
                    }`}
                    style={
                      isFav
                        ? { backgroundColor: t.colorPrimary }
                        : undefined
                    }
                  >
                    {t.abbreviation}
                  </button>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}
