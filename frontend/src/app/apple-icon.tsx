import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Document icon representing a Lattes CV (Apple Touch Icon)
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(160deg, #1e3a8a 0%, #1d4ed8 100%)",
          borderRadius: "36px",
          gap: "10px",
        }}
      >
        {/* Document shape */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: "9px",
            width: "90px",
            height: "112px",
            background: "rgba(255,255,255,0.12)",
            borderRadius: "8px",
            border: "4px solid rgba(255,255,255,0.95)",
            padding: "14px 12px",
          }}
        >
          {/* Header line — name */}
          <div style={{ width: "100%", height: "7px", background: "white", borderRadius: "3px" }} />
          {/* Subtitle */}
          <div style={{ width: "70%", height: "5px", background: "rgba(255,255,255,0.65)", borderRadius: "3px" }} />
          {/* Divider */}
          <div style={{ width: "100%", height: "1.5px", background: "rgba(255,255,255,0.3)", borderRadius: "1px", marginTop: "2px" }} />
          {/* Body lines */}
          <div style={{ width: "100%", height: "5px", background: "rgba(255,255,255,0.8)", borderRadius: "3px" }} />
          <div style={{ width: "85%", height: "5px", background: "rgba(255,255,255,0.8)", borderRadius: "3px" }} />
          <div style={{ width: "90%", height: "5px", background: "rgba(255,255,255,0.8)", borderRadius: "3px" }} />
          <div style={{ width: "60%", height: "5px", background: "rgba(255,255,255,0.4)", borderRadius: "3px" }} />
        </div>
        {/* Label */}
        <span
          style={{
            fontSize: 22,
            fontWeight: "bold",
            color: "rgba(255,255,255,0.9)",
            letterSpacing: "0.08em",
            fontFamily: "sans-serif",
          }}
        >
          LATTES
        </span>
      </div>
    ),
    { ...size },
  );
}
