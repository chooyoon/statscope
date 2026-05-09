/**
 * Regional configuration for US/KR dual deployment
 * Set via NEXT_PUBLIC_REGION environment variable
 */

export const REGION = process.env.NEXT_PUBLIC_REGION || "us";
export const isKR = REGION === "kr";
export const isUS = REGION === "us";

// Site branding by region
export const SITE_NAME = isKR ? "StatScope KR" : "StatScope";

// Default language for region (can be overridden by user)
export const DEFAULT_LANG = isKR ? ("ko" as const) : ("en" as const);

// Region-specific URLs (for future use)
export const SITE_URL = isKR ? "https://statscope.kr" : "https://statscope-eta.vercel.app";

// Analytics / branding
export const ANALYTICS_ID = "G-XXXXX"; // Can be region-specific if needed
