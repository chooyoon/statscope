"use client";

import { useState, useEffect } from "react";

interface LocalTimeProps {
  utcDate: string; // ISO 8601 date string
  className?: string;
}

export default function LocalTime({ utcDate, className = "" }: LocalTimeProps) {
  const [timeStr, setTimeStr] = useState("");

  useEffect(() => {
    const date = new Date(utcDate);
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    setTimeStr(`${hours}:${minutes}`);
  }, [utcDate]);

  // SSR fallback: show nothing until client hydrates
  if (!timeStr) return <span className={className}>--:--</span>;

  return <span className={className}>{timeStr}</span>;
}
