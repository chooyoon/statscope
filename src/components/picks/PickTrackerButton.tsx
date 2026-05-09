"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { addPick } from "@/lib/portfolio";

interface PickTrackerButtonProps {
  date: string;
  fav: string;
  fav_id: number;
  home_id: number;
  away_id: number;
  home: string;
  away: string;
  prob: number;
  ml: string;
  ou_line: number;
  ou_lean: "over" | "under" | "push";
}

export default function PickTrackerButton(props: PickTrackerButtonProps) {
  const { user } = useAuth();
  const [isTracked, setIsTracked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if already tracked in this session
  useEffect(() => {
    if (!user) return;

    const cacheKey = `tracked_${props.date}_${props.fav_id}_${props.home_id}_${props.away_id}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached === "true") {
      setIsTracked(true);
    }
  }, [user, props.date, props.fav_id, props.home_id, props.away_id]);

  if (!user) {
    return null;
  }

  const handleTrack = async () => {
    if (isTracked || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      await addPick(user.uid, {
        uid: user.uid,
        date: props.date,
        fav: props.fav,
        fav_id: props.fav_id,
        home_id: props.home_id,
        away_id: props.away_id,
        home: props.home,
        away: props.away,
        prob: props.prob,
        ml: props.ml,
        ou_line: props.ou_line,
        ou_lean: props.ou_lean,
        userBetSide: props.fav_id === props.fav_id ? "fav" : "dog",
        stakeUnits: 1,
        result: "pending",
      });

      // Cache in localStorage
      const cacheKey = `tracked_${props.date}_${props.fav_id}_${props.home_id}_${props.away_id}`;
      localStorage.setItem(cacheKey, "true");

      setIsTracked(true);
    } catch (err) {
      console.error("Failed to track pick:", err);
      setError("Failed to track pick. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleTrack}
        disabled={isTracked || isLoading}
        className={`text-xs font-semibold px-3 py-1 rounded-full transition-all ${
          isTracked
            ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 cursor-default"
            : isLoading
            ? "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-wait"
            : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 cursor-pointer"
        }`}
      >
        {isTracked ? "✓ Tracked" : isLoading ? "Adding..." : "Track Pick"}
      </button>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
