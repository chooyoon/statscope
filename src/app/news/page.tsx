import type { Metadata } from "next";
import Link from "next/link";
import { teams } from "@/data/teams";
import NewsClient from "./NewsClient";

export const metadata: Metadata = {
  title: "MLB News | StatScope",
  description:
    "Latest MLB news and team updates. Real-time news for all 30 teams.",
};

// --- RSS slug mapping (mirrors team page) ---

const TEAM_RSS_SLUGS: Record<number, string> = {
  108: "angels",
  109: "dbacks",
  110: "orioles",
  111: "redsox",
  112: "cubs",
  113: "reds",
  114: "guardians",
  115: "rockies",
  116: "tigers",
  117: "astros",
  118: "royals",
  119: "dodgers",
  120: "nationals",
  121: "mets",
  133: "athletics",
  134: "pirates",
  135: "padres",
  136: "mariners",
  137: "giants",
  138: "cardinals",
  139: "rays",
  140: "rangers",
  141: "bluejays",
  142: "twins",
  143: "phillies",
  144: "braves",
  145: "whitesox",
  146: "marlins",
  147: "yankees",
  158: "brewers",
};

// --- Types ---

interface NewsArticle {
  title: string;
  link: string;
  pubDate: string;
  author: string;
  imageUrl: string | null;
}

// --- Helpers ---

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

async function fetchNews(rssUrl: string, limit: number): Promise<NewsArticle[]> {
  // Server component: 직접 fetch (CORS 프록시 불필요)
  try {
    const res = await fetch(rssUrl, { next: { revalidate: 1800 } });
    if (!res.ok) return [];
    const xml = await res.text();

    const items: NewsArticle[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match: RegExpExecArray | null;

    while ((match = itemRegex.exec(xml)) !== null && items.length < limit) {
      const itemXml = match[1];

      const titleMatch =
        itemXml.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ||
        itemXml.match(/<title>([\s\S]*?)<\/title>/);
      const linkMatch =
        itemXml.match(/<link><!\[CDATA\[([\s\S]*?)\]\]><\/link>/) ||
        itemXml.match(/<link>([\s\S]*?)<\/link>/);
      const pubDateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
      const authorMatch =
        itemXml.match(
          /<dc:creator><!\[CDATA\[([\s\S]*?)\]\]><\/dc:creator>/
        ) ||
        itemXml.match(/<dc:creator>([\s\S]*?)<\/dc:creator>/) ||
        itemXml.match(/<author>([\s\S]*?)<\/author>/);
      const imageMatch =
        itemXml.match(/<media:content[^>]+url="([^"]+)"/) ||
        itemXml.match(/<enclosure[^>]+url="([^"]+)"/) ||
        itemXml.match(/<image[^>]*>\s*<url>([\s\S]*?)<\/url>/);

      if (titleMatch && linkMatch) {
        items.push({
          title: decodeXmlEntities(titleMatch[1].trim()),
          link: linkMatch[1].trim(),
          pubDate: pubDateMatch ? pubDateMatch[1].trim() : "",
          author: authorMatch ? decodeXmlEntities(authorMatch[1].trim()) : "",
          imageUrl: imageMatch ? imageMatch[1].trim() : null,
        });
      }
    }

    return items;
  } catch {
    return [];
  }
}

// --- Page ---

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>;
}) {
  const { team: teamSlug } = await searchParams;

  // Determine RSS URL
  let rssUrl = "https://www.mlb.com/feeds/news/rss.xml";
  let activeTeamRssSlug: string | null = null;
  let activeTeamId: number | null = null;

  if (teamSlug) {
    // Find team by RSS slug
    const entry = Object.entries(TEAM_RSS_SLUGS).find(
      ([, slug]) => slug === teamSlug
    );
    if (entry) {
      activeTeamId = Number(entry[0]);
      activeTeamRssSlug = entry[1];
      rssUrl = `https://www.mlb.com/${activeTeamRssSlug}/feeds/news/rss.xml`;
    }
  }

  const articles = await fetchNews(rssUrl, 20);

  const activeTeam = activeTeamId ? teams[activeTeamId] : null;

  // Build ordered team list for filter badges
  const teamList = Object.values(teams).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-slate-900 mb-2">
            MLB News
          </h1>
          <p className="text-slate-500">
            {activeTeam
              ? `${activeTeam.name} Latest News`
              : "Latest MLB news and team updates"}
          </p>
        </div>

        {/* Intro block explaining the hub */}
        <section className="mb-8 rounded-2xl bg-white px-6 py-6 shadow-sm ring-1 ring-slate-200/60">
          <h2 className="text-lg font-semibold text-slate-800">
            {activeTeam
              ? `Your ${activeTeam.name} News Hub`
              : "Your MLB News Hub, Filterable by Team"}
          </h2>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">
            {activeTeam
              ? `Every headline below is pulled directly from the official ${activeTeam.name} news feed, refreshed every 30 minutes. Stories cover lineup changes, injury updates, transactions, and game recaps — straight from the club source, no middle-man rewriting. Use the team badges above to switch to another franchise, or click "All" to see league-wide MLB coverage.`
              : "The headlines below combine the league-wide MLB.com news feed with team-specific coverage, refreshed every 30 minutes. Use the colored team badges above to filter by any of the 30 franchises — the feed will re-fetch from that club's official RSS source, so you only see stories relevant to your team. Stories link back to their original publisher; StatScope does not rehost or modify content."}
          </p>
          <p className="mt-3 text-sm text-slate-600 leading-relaxed">
            Looking for analysis instead of headlines? Check today&apos;s{" "}
            <Link href="/" className="text-blue-600 hover:underline">
              game predictions
            </Link>
            , the live{" "}
            <Link href="/standings" className="text-blue-600 hover:underline">
              standings
            </Link>
            , or a specific{" "}
            <Link href="/matchup" className="text-blue-600 hover:underline">
              player matchup
            </Link>
            .
          </p>
        </section>

        {/* Team Filter Badges */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-2">
            {/* All / General */}
            <a
              href="/news"
              className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                !activeTeamRssSlug
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-white text-slate-600 border border-slate-200 hover:border-blue-300 hover:text-blue-600 shadow-sm"
              }`}
            >
              All
            </a>
            {teamList.map((t) => {
              const tRssSlug = TEAM_RSS_SLUGS[t.id];
              if (!tRssSlug) return null;
              const isActive = activeTeamRssSlug === tRssSlug;
              return (
                <a
                  key={t.id}
                  href={`/news?team=${tRssSlug}`}
                  className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold transition-colors shadow-sm"
                  style={
                    isActive
                      ? {
                          backgroundColor: t.colorPrimary,
                          color: "#fff",
                        }
                      : {
                          backgroundColor: "#fff",
                          color: t.colorPrimary,
                          border: `1px solid ${t.colorPrimary}30`,
                        }
                  }
                >
                  {t.abbreviation}
                </a>
              );
            })}
          </div>
        </div>

        {/* Articles Grid (client component with translation toggle) */}
        <NewsClient articles={articles} />
      </div>
    </div>
  );
}
