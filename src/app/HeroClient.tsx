"use client";

import { useLang } from "@/contexts/LangContext";

export function HeroText() {
  const { t } = useLang();
  return (
    <>
      <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl drop-shadow-lg">
        <span className="text-blue-400">Stat</span>
        <span className="text-white">Scope</span>
      </h1>
      <p className="mt-4 text-lg sm:text-xl text-white font-semibold drop-shadow-md">
        {t("MLB Deep Analytics Platform", "MLB 심층 분석 플랫폼")}
      </p>
      <p className="mt-2 text-sm text-blue-200 drop-shadow">
        {t(
          "Schedules · Live Scores · Player Stats · Standings",
          "경기 일정 · 실시간 스코어 · 선수 스탯 · 팀 순위"
        )}
      </p>
    </>
  );
}

export function SectionTitle({ en, ko }: { en: string; ko: string }) {
  const { t } = useLang();
  return <>{t(en, ko)}</>;
}

export function NoGamesText() {
  const { t } = useLang();
  return (
    <>
      <p className="text-lg text-slate-400">
        {t("No games scheduled for this date.", "이 날짜에 예정된 경기가 없습니다.")}
      </p>
      <p className="text-sm text-slate-300 mt-1">
        {t("Try a different date.", "다른 날짜를 확인해보세요.")}
      </p>
    </>
  );
}

export function PitcherLabel() {
  const { t } = useLang();
  return (
    <p className="mb-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
      {t("Starting Pitchers", "선발 투수")}
    </p>
  );
}

export function UpcomingTitle() {
  const { t } = useLang();
  return (
    <h2 className="mb-6 text-xl font-bold text-slate-800">
      {t("Upcoming Schedule", "향후 일정")}
    </h2>
  );
}
