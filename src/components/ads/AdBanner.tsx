"use client";

interface AdBannerProps {
  slot: "header" | "sidebar" | "inline" | "footer";
  className?: string;
}

export default function AdBanner({ slot, className = "" }: AdBannerProps) {
  // Placeholder for future AdSense / Kakao AdFit integration.
  // Replace the inner div with actual ad script tags when ad accounts are ready.

  const sizeMap: Record<string, string> = {
    header: "h-[90px]",
    sidebar: "h-[250px]",
    inline: "h-[100px]",
    footer: "h-[90px]",
  };

  return (
    <div
      className={`w-full flex items-center justify-center rounded-lg bg-slate-100 border border-dashed border-slate-300 overflow-hidden ${sizeMap[slot] ?? "h-[90px]"} ${className}`}
      data-ad-slot={slot}
    >
      <p className="text-xs text-slate-400 select-none">AD</p>
    </div>
  );
}
