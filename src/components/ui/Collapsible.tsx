"use client";

import { useState, type ReactNode } from "react";

interface CollapsibleProps {
  title: string;
  titleColor?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export default function Collapsible({
  title,
  titleColor,
  defaultOpen = false,
  children,
}: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-2.5 text-xs font-bold border-b border-slate-100 flex items-center justify-between hover:bg-slate-50 transition-colors"
        style={{ color: titleColor }}
      >
        <span>{title}</span>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && children}
    </div>
  );
}
