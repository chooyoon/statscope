"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { isFirebaseConfigured } from "@/lib/firebase";

export default function AuthButton() {
  const { user, profile, loading, signInWithGoogle, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!isFirebaseConfigured) return null;

  if (loading) {
    return (
      <div className="w-8 h-8 rounded-full bg-slate-200 animate-pulse" />
    );
  }

  if (!user) {
    return (
      <button
        onClick={signInWithGoogle}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z" />
        </svg>
        로그인
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-100"
      >
        {user.photoURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.photoURL}
            alt=""
            className="w-8 h-8 rounded-full"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold">
            {(user.displayName ?? user.email ?? "U")[0].toUpperCase()}
          </div>
        )}
        <span className="hidden sm:block text-sm font-medium text-slate-700 max-w-[100px] truncate">
          {user.displayName ?? "사용자"}
        </span>
      </button>

      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-white border border-slate-200 shadow-xl z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-800 truncate">
                {user.displayName}
              </p>
              <p className="text-xs text-slate-500 truncate">{user.email}</p>
            </div>
            <div className="py-1">
              <div className="px-4 py-2 text-xs text-slate-400">
                관심 팀 {profile?.favoriteTeams?.length ?? 0}개 · 관심 선수{" "}
                {profile?.favoritePlayers?.length ?? 0}명
              </div>
            </div>
            <div className="border-t border-slate-100">
              <button
                onClick={() => {
                  signOut();
                  setMenuOpen(false);
                }}
                className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                로그아웃
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
