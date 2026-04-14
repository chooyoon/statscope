import type { MetadataRoute } from "next";
import { teams } from "@/data/teams";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://statscope-eta.vercel.app";

  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${baseUrl}/standings`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/players`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/news`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.8 },
    { url: `${baseUrl}/matchup`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/learn`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/methodology`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/privacy`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
    { url: `${baseUrl}/terms`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
    { url: `${baseUrl}/disclaimer`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
  ];

  const teamPages: MetadataRoute.Sitemap = Object.values(teams).map((team) => ({
    url: `${baseUrl}/team/${team.slug}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  // Dynamic game pages from recent schedule (last 7 days + today)
  let gamePages: MetadataRoute.Sitemap = [];
  try {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const startDate = weekAgo.toISOString().slice(0, 10);
    const endDate = today.toISOString().slice(0, 10);

    const res = await fetch(
      `https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=${startDate}&endDate=${endDate}&gameType=R`,
      { next: { revalidate: 3600 } },
    );
    if (res.ok) {
      const data = await res.json();
      for (const dateObj of data.dates ?? []) {
        for (const game of dateObj.games ?? []) {
          gamePages.push({
            url: `${baseUrl}/game/${game.gamePk}`,
            lastModified: new Date(dateObj.date),
            changeFrequency: "daily" as const,
            priority: 0.6,
          });
        }
      }
    }
  } catch {
    // Silently fail — static pages still get indexed
  }

  return [...staticPages, ...teamPages, ...gamePages];
}
