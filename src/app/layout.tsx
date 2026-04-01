import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/layout/Header";
import AdBanner from "@/components/ads/AdBanner";
import { AuthProvider } from "@/contexts/AuthContext";
import { LangProvider } from "@/contexts/LangContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import ServiceWorkerRegister from "@/components/pwa/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "StatScope - MLB Deep Analytics Platform",
  description:
    "Free MLB sabermetrics analysis: game previews, pitcher matchups, roster comparison, win probability. Data-driven baseball analytics.",
  metadataBase: new URL("https://statscope.vercel.app"),
  openGraph: {
    type: "website",
    siteName: "StatScope",
    title: "StatScope - MLB Deep Analytics Platform",
    description:
      "Free MLB sabermetrics analysis: game previews, pitcher matchups, roster comparison, win probability.",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "StatScope - MLB Deep Analytics Platform",
    description:
      "Free MLB sabermetrics analysis: game previews, pitcher matchups, win probability.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3779858063372452"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#2563eb" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="StatScope" />
      </head>
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100 transition-colors">
        <ServiceWorkerRegister />
        <ThemeProvider>
        <LangProvider>
        <AuthProvider>
        <Header />
        <div className="mx-auto w-full max-w-7xl px-4 pt-4">
          <AdBanner slot="header" />
        </div>
        <main className="flex-1">{children}</main>
        </AuthProvider>
        </LangProvider>
        </ThemeProvider>
        <div className="mx-auto w-full max-w-7xl px-4 pb-4">
          <AdBanner slot="footer" />
        </div>
        <footer className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-8">
          <div className="mx-auto max-w-7xl px-4 text-center">
            <div className="flex items-center justify-center gap-4 mb-3">
              <a href="/about" className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">About</a>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <a href="/privacy" className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">Privacy</a>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <a href="mailto:statscope.help@gmail.com" className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">Contact</a>
            </div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              &copy; {new Date().getFullYear()} StatScope. All rights reserved.
            </p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Data-driven MLB analytics platform
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
