import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "StatScope - MLB Deep Analytics Platform";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              background: "#3b82f6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "32px",
              color: "white",
              fontWeight: "bold",
            }}
          >
            S
          </div>
          <div style={{ display: "flex", fontSize: "64px", fontWeight: "800" }}>
            <span style={{ color: "#60a5fa" }}>Stat</span>
            <span style={{ color: "#ffffff" }}>Scope</span>
          </div>
        </div>

        <div
          style={{
            color: "#94a3b8",
            fontSize: "28px",
            fontWeight: "600",
            marginBottom: "40px",
          }}
        >
          MLB Deep Analytics Platform
        </div>

        <div
          style={{
            display: "flex",
            gap: "32px",
          }}
        >
          {["Win Probability", "Odds Prediction", "Sabermetrics", "Game Preview"].map(
            (label) => (
              <div
                key={label}
                style={{
                  background: "rgba(59, 130, 246, 0.15)",
                  border: "1px solid rgba(59, 130, 246, 0.3)",
                  borderRadius: "12px",
                  padding: "12px 24px",
                  color: "#93c5fd",
                  fontSize: "18px",
                  fontWeight: "600",
                }}
              >
                {label}
              </div>
            ),
          )}
        </div>

        <div
          style={{
            position: "absolute",
            bottom: "32px",
            color: "#475569",
            fontSize: "16px",
          }}
        >
          statscope-eta.vercel.app
        </div>
      </div>
    ),
    { ...size },
  );
}
