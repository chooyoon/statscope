"use client";

import { useState, useEffect } from "react";

interface EnhancedPickData {
  hW: number;
  aW: number;
  delta: number;
  confidence: string;
}

export default function EnhancedPickBadge({
  gameId,
  baseProb,
}: {
  gameId: string;
  baseProb: number;
}) {
  const [enhanced, setEnhanced] = useState<EnhancedPickData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadEnhancedData = async () => {
      try {
        const response = await fetch("/data/enhanced-picks.json");
        const data = await response.json();

        if (!data.games || !Array.isArray(data.games)) {
          setLoading(false);
          return;
        }

        const game = data.games.find((g: any) => g.game_id === gameId);
        if (game?.enhanced) {
          setEnhanced(game.enhanced);
        }
      } catch (error) {
        console.error("Failed to load enhanced picks:", error);
      } finally {
        setLoading(false);
      }
    };

    loadEnhancedData();
  }, [gameId]);

  if (loading || !enhanced || enhanced.delta === 0) {
    return null;
  }

  const delta = enhanced.delta;
  const isPositive = delta > 0;
  const color = isPositive
    ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
    : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300";

  const deltaStr = delta > 0 ? `+${delta.toFixed(1)}` : `${delta.toFixed(1)}`;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      <span>✨</span>
      <span>{deltaStr}%</span>
      {enhanced.confidence === "high" && (
        <span title="High confidence (Statcast data available)">📊</span>
      )}
    </span>
  );
}
