import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Same mark as icon.svg (chamfered tile + steel diamond ring + red center),
// rasterized to PNG for iOS home-screen/pinned-tab icons, which don't
// support SVG.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <svg width="180" height="180" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="steel" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#e8e6e0" />
            <stop offset="0.45" stopColor="#3a3a3a" />
            <stop offset="0.85" stopColor="#e8e6e0" />
          </linearGradient>
        </defs>
        <path d="M7 0 H32 V25 L25 32 H0 V7 Z" fill="#121212" />
        <path d="M16 3 L29 16 L16 29 L3 16 Z" fill="url(#steel)" />
        <path d="M16 8.5 L23.5 16 L16 23.5 L8.5 16 Z" fill="#121212" />
        <path d="M16 12.4 L19.6 16 L16 19.6 L12.4 16 Z" fill="#ff4655" />
      </svg>
    ),
    { ...size }
  );
}
