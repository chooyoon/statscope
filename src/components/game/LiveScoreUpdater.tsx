"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface LiveScoreUpdaterProps {
  hasLiveGames: boolean;
  intervalMs?: number;
}

export default function LiveScoreUpdater({
  hasLiveGames,
  intervalMs = 30000,
}: LiveScoreUpdaterProps) {
  const router = useRouter();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!hasLiveGames) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      router.refresh();
    }, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [hasLiveGames, intervalMs, router]);

  if (!hasLiveGames) return null;

  return (
    <div className="mb-4 flex items-center justify-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      Live — Auto-updating every {intervalMs / 1000}s
    </div>
  );
}
