"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if iOS
    const ua = navigator.userAgent;
    const isIOSDevice = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // Prevent default install prompt and store for later
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const event = e as BeforeInstallPromptEvent;
      setDeferredPrompt(event);

      // Check if dismissed before
      const isDismissed = localStorage.getItem("pwa_install_dismissed");
      if (!isDismissed) {
        setShowBanner(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setDeferredPrompt(null);
      setShowBanner(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem("pwa_install_dismissed", "true");
    setShowBanner(false);
  };

  // Don't show if no install prompt and not iOS
  if (!showBanner && !isIOS) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-blue-600 text-white px-4 py-3 shadow-lg z-50 flex items-center justify-between gap-4 animate-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center gap-3 flex-1">
        <span className="text-lg">📱</span>
        <div className="flex-1">
          {isIOS && !deferredPrompt ? (
            <div>
              <p className="text-sm font-medium">StatScope をホーム画面に追加</p>
              <p className="text-xs opacity-90">Safari: 共有ボタン → ホーム画面に追加</p>
            </div>
          ) : (
            <p className="text-sm font-medium">StatScope をアプリとしてインストール</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {deferredPrompt && (
          <button
            onClick={handleInstall}
            className="bg-white text-blue-600 font-semibold px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors text-sm"
          >
            インストール
          </button>
        )}
        <button
          onClick={handleDismiss}
          className="text-blue-100 hover:text-white transition-colors px-3"
          aria-label="Close"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
