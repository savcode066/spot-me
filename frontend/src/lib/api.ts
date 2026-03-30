/**
 * API client — works on both server (Next.js RSC) and client.
 *
 * Server-side: uses API_URL env var → hits the FastAPI directly.
 * Client-side: uses empty base → Next.js rewrites /api/* → FastAPI.
 */

function apiBase(): string {
  if (typeof window === "undefined") {
    // Running in Next.js server context — need the full URL.
    return (
      process.env.API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      "http://localhost:8000"
    );
  }
  // Browser: rewrites in next.config.ts proxy /api/* to the backend.
  return "";
}

export interface Detection {
  video_id: string;
  video_name: string;
  timestamp: number;
  confidence: number;
  raw_text: string;
}

export interface SearchResponse {
  username: string;
  normalized: string;
  results: Detection[];
  total: number;
}

export interface ScanStatus {
  job_id: string;
  status: "starting" | "running" | "done" | "error";
  progress: number;
  error?: string;
}

export async function searchUsername(
  username: string
): Promise<SearchResponse> {
  const res = await fetch(
    `${apiBase()}/api/search?username=${encodeURIComponent(username)}`,
    // Don't cache on the server — results change as scans complete.
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);
  return res.json();
}

export async function startScan(
  url: string,
  sampleSec = 3.0
): Promise<{ job_id: string; status: string }> {
  const res = await fetch(`${apiBase()}/api/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, sample_sec: sampleSec }),
  });
  if (!res.ok) throw new Error(`Scan start failed: ${res.status}`);
  return res.json();
}

export async function getScanStatus(jobId: string): Promise<ScanStatus> {
  const res = await fetch(`${apiBase()}/api/scan/${jobId}/status`);
  if (!res.ok) throw new Error(`Status check failed: ${res.status}`);
  return res.json();
}
