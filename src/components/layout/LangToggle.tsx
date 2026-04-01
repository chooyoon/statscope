"use client";

import { useLang } from "@/contexts/LangContext";

export default function LangToggle() {
  const { lang, setLang } = useLang();

  return (
    <button
      onClick={() => setLang(lang === "en" ? "ko" : "en")}
      className="rounded-lg px-2.5 py-1.5 text-xs font-bold border border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-300 transition-colors"
      title={lang === "en" ? "Switch to Korean" : "Switch to English"}
    >
      {lang === "en" ? "KR" : "EN"}
    </button>
  );
}
