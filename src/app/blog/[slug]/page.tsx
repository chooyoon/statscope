import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBlogPost, BLOG_POSTS } from "@/data/blog-posts";

export function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({
    slug: post.slug,
  }));
}

export function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Metadata {
  const slug = (params as any).slug as string;
  const post = getBlogPost(slug);

  if (!post) {
    return { title: "Post not found" };
  }

  return {
    title: `${post.title} | StatScope Blog`,
    description: post.summary,
    openGraph: {
      title: post.title,
      description: post.summary,
      type: "article",
      publishedTime: post.date,
    },
  };
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00Z");
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getBlogPost(slug);

  if (!post) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="mx-auto max-w-4xl px-4 py-12">
        {/* Header */}
        <header className="mb-8">
          <div className="flex flex-wrap gap-2 mb-4">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="inline-block text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-1 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
          <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white mb-4 leading-tight">
            {post.title}
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
            <span>{formatDate(post.date)}</span>
            <span>•</span>
            <span>{post.readTime}</span>
          </div>
        </header>

        {/* Content */}
        <article className="space-y-8 mb-12">
          {post.sections.map((section, idx) => (
            <section
              key={idx}
              className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-8"
            >
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6">
                {section.heading}
              </h2>
              <div className="space-y-4">
                {section.paragraphs.map((para, pIdx) => (
                  <p
                    key={pIdx}
                    className="text-sm text-slate-600 dark:text-slate-400 leading-7"
                  >
                    {para}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </article>

        {/* Footer CTA */}
        <footer className="rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-8">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">
            Explore More
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link
              href="/track"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-semibold"
            >
              → Track Record
            </Link>
            <Link
              href="/learn"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-semibold"
            >
              → Learn Sabermetrics
            </Link>
            <Link
              href="/methodology"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-semibold"
            >
              → Methodology
            </Link>
          </div>
        </footer>

        {/* Back link */}
        <div className="mt-8 text-center">
          <Link
            href="/blog"
            className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          >
            ← Back to Blog
          </Link>
        </div>
      </div>
    </div>
  );
}
