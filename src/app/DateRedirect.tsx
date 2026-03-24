"use client";

import { useEffect } from "react";

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

export default function DateRedirect() {
  useEffect(() => {
    // If no date param, redirect to local today
    const params = new URLSearchParams(window.location.search);
    if (!params.has("date")) {
      const now = new Date();
      const localDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      window.location.replace(`/?date=${localDate}`);
    }
  }, []);

  return null;
}
