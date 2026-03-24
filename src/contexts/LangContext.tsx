"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

type Lang = "en" | "ko";

interface LangContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (en: string, ko: string) => string;
}

const LangContext = createContext<LangContextType | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
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
    setLangState(l);
    localStorage.setItem("statscope-lang", l);
  }

  function t(en: string, ko: string): string {
    return lang === "ko" ? ko : en;
  }

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used within LangProvider");
  return ctx;
}
