import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// Document icon representing a Lattes CV
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(160deg, #1e3a8a 0%, #1d4ed8 100%)",
          borderRadius: "5px",
        }}
      >
        {/* Document shape */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: "3px",
            width: "18px",
            height: "22px",
            background: "rgba(255,255,255,0.15)",
            borderRadius: "2px",
            border: "1.5px solid rgba(255,255,255,0.9)",
            padding: "3px 3px",
          }}
        >
          <div style={{ width: "100%", height: "1.5px", background: "white", borderRadius: "1px" }} />
          <div style={{ width: "80%", height: "1.5px", background: "white", borderRadius: "1px" }} />
          <div style={{ width: "100%", height: "1.5px", background: "white", borderRadius: "1px" }} />
          <div style={{ width: "60%", height: "1.5px", background: "rgba(255,255,255,0.6)", borderRadius: "1px" }} />
        </div>
      </div>
    ),
    { ...size },
  );
}
