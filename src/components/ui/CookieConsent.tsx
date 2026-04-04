"use client";

import { useState, useEffect } from "react";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookie-consent");
    if (!consent) setVisible(true);
  }, []);

  function accept() {
    localStorage.setItem("cookie-consent", "accepted");
    setVisible(false);
  }

  function decline() {
    localStorage.setItem("cookie-consent", "declined");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-4">
      <div className="mx-auto max-w-4xl rounded-xl border border-slate-200 bg-white/95 backdrop-blur shadow-lg dark:border-slate-700 dark:bg-slate-800/95 p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-1 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          We use cookies to improve your experience and serve personalized ads via Google AdSense.
          By clicking &quot;Accept&quot;, you consent to the use of cookies. See our{" "}
          <a href="/privacy" className="underline font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700">
            Privacy Policy
          </a>{" "}
          for details.
        </div>
        <div className="flex gap-3 shrink-0">
          <button
            onClick={decline}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
          >
            Decline
          </button>
          <button
            onClick={accept}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
