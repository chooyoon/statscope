interface StatsGridProps {
  stats: Record<string, number | string>;
  keys: string[];
  labels: Record<string, string>;
  columns?: number;
  highlightKeys?: string[];
}

export default function StatsGrid({
  stats,
  keys,
  labels,
  columns = 3,
  highlightKeys = [],
}: StatsGridProps) {
  const gridCols: Record<number, string> = {
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-4",
    5: "grid-cols-2 sm:grid-cols-5",
    6: "grid-cols-3 sm:grid-cols-6",
  };

  return (
    <div className={`grid ${gridCols[columns] ?? "grid-cols-3"} gap-3`}>
      {keys.map((key) => {
        const isHighlighted = highlightKeys.includes(key);
        return (
          <div
            key={key}
            className={`rounded-xl px-3 py-3 text-center ${
              isHighlighted
                ? "bg-blue-50 border border-blue-200"
                : "bg-slate-50 border border-slate-200"
            }`}
          >
            <p className="text-xs text-slate-500 mb-1 truncate">
              {labels[key] ?? key}
            </p>
            <p
              className={`text-lg font-bold font-mono ${
                isHighlighted ? "text-blue-600" : "text-slate-800"
              }`}
            >
              {stats[key] ?? "-"}
            </p>
          </div>
        );
      })}
    </div>
  );
}
