import type { Metadata } from "next";
import Link from "next/link";
import { sortedBlogPosts } from "@/data/blog-posts";

export const metadata: Metadata = {
  title: "StatScope Blog | MLB Analytics & Guides",
  description:
    "In-depth analysis, model recaps, and educational guides on baseball sabermetrics, betting analytics, and MLB data.",
  openGraph: {
    title: "StatScope Blog — MLB Analysis & Guides",
    description:
      "Weekly recaps of our prediction model, educational guides on sabermetrics, and insights for baseball fans and bettors.",
  },
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00Z");
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function BlogPage() {
  const posts = sortedBlogPosts();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="mx-auto max-w-4xl px-4 py-12">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white mb-4">
            StatScope <span className="text-blue-600">Blog</span>
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            In-depth analysis, model recaps, and guides to baseball sabermetrics
            for fans and bettors.
          </p>
        </div>

        {/* Posts Grid */}
        <div className="space-y-6">
          {posts.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-8 text-center">
              <p className="text-slate-500">No posts yet. Check back soon.</p>
            </div>
          ) : (
            posts.map((post) => (
              <article
                key={post.slug}
                className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-8 hover:shadow-md transition-shadow"
              >
                {/* Meta row */}
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <div className="flex flex-wrap gap-2">
                    {post.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-block text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-1 rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
                    {formatDate(post.date)} · {post.readTime}
                  </span>
                </div>

                {/* Title */}
                <Link href={`/blog/${post.slug}`}>
                  <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-3 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                    {post.title}
                  </h2>
                </Link>

                {/* Summary */}
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                  {post.summary}
                </p>

                {/* Read more link */}
                <Link
                  href={`/blog/${post.slug}`}
                  className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Read more →
                </Link>
              </article>
            ))
          )}
        </div>

        {/* Footer CTA */}
        <div className="mt-12 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-800 dark:to-blue-900 p-8 text-white text-center">
          <h2 className="text-2xl font-bold mb-3">Follow the Model</h2>
          <p className="text-blue-100 mb-6 max-w-lg mx-auto">
            Every prediction we post is logged on our track record page. See how
            the model performs in real time.
          </p>
          <Link
            href="/track"
            className="inline-block rounded-xl bg-white text-blue-600 px-6 py-2.5 text-sm font-bold hover:bg-blue-50 transition-colors"
          >
            View Track Record
          </Link>
        </div>
      </div>
    </div>
  );
}
