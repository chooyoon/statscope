import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/layout/Header";
import AdBanner from "@/components/ads/AdBanner";
import { AuthProvider } from "@/contexts/AuthContext";

export const metadata: Metadata = {
  title: "StatScope - MLB 심층 분석 플랫폼",
  description:
    "MLB 선수 스탯, 팀 순위, 매치업 분석을 한눈에. StatScope와 함께 데이터로 야구를 읽으세요.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
      </head>
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <AuthProvider>
        <Header />
        <div className="mx-auto w-full max-w-7xl px-4 pt-4">
          <AdBanner slot="header" />
        </div>
        <main className="flex-1">{children}</main>
        </AuthProvider>
        <div className="mx-auto w-full max-w-7xl px-4 pb-4">
          <AdBanner slot="footer" />
        </div>
        <footer className="border-t border-slate-200 bg-white py-8">
          <div className="mx-auto max-w-7xl px-4 text-center">
            <div className="flex items-center justify-center gap-4 mb-3">
              <a href="/about" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">서비스 소개</a>
              <span className="text-slate-300">|</span>
              <a href="/privacy" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">개인정보처리방침</a>
              <span className="text-slate-300">|</span>
              <a href="mailto:statscope.help@gmail.com" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">문의</a>
            </div>
            <p className="text-sm font-medium text-slate-500">
              &copy; {new Date().getFullYear()} StatScope. All rights reserved.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              MLB 데이터 기반 야구 분석 플랫폼
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
