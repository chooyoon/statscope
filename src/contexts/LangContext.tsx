"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { isKR, DEFAULT_LANG } from "@/lib/config";

type Lang = "en" | "ko";

interface LangContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (en: string, ko: string) => string;
  isRegionLocked: boolean;
}

const LangContext = createContext<LangContextType | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);
  const [isRegionLocked, setIsRegionLocked] = useState(isKR);

  useEffect(() => {
    // KR 버전은 항상 한국어 (언어 변경 불가)
    if (isKR) {
      setLangState("ko");
      setIsRegionLocked(true);
      return;
    }

    // US 버전: 저장된 언어 또는 브라우저 감지
    const saved = localStorage.getItem("statscope-lang") as Lang | null;
    if (saved === "en" || saved === "ko") {
      setLangState(saved);
    } else {
      // Auto-detect: Korean browser → ko, else → en
      const browserLang = navigator.language || "";
      setLangState(browserLang.startsWith("ko") ? "ko" : "en");
    }
  }, []);

  function setLang(l: Lang) {
    // KR 버전은 언어 변경 불가
    if (isRegionLocked) return;

    setLangState(l);
    localStorage.setItem("statscope-lang", l);
  }

  function t(en: string, ko: string): string {
    return lang === "ko" ? ko : en;
  }

  return (
    <LangContext.Provider value={{ lang, setLang, t, isRegionLocked }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used within LangProvider");
  return ctx;
}
