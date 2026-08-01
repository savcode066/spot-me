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

// ── Chess.com matchup search ────────────────────────────────────────────────
// Backend exposes one route per VOD platform (they take a different field
// name for the streamer's handle), so this dispatches to the right one.

export type ChessPlatform = "twitch" | "kick" | "youtube";

export interface ChessMatch {
  video_id: string;
  video_name: string;
  timestamp: number;
  opponent: string;
  result: string;
  time_class: string;
  rated: boolean;
  game_url: string;
  played_at: number;
}

export interface ChessMatchupResponse {
  results: ChessMatch[];
  total: number;
  vods_scanned: number;
}

export interface ChessSearchParams {
  platform: ChessPlatform;
  userChess: string;
  streamerChess: string;
  channel: string;
}

const CHESS_ENDPOINT: Record<ChessPlatform, string> = {
  twitch: "/api/chess/search",
  kick: "/api/chess/kick/search",
  youtube: "/api/chess/youtube/search",
};

const CHESS_CHANNEL_FIELD: Record<ChessPlatform, string> = {
  twitch: "streamer_twitch_username",
  kick: "streamer_kick_username",
  youtube: "streamer_youtube_channel",
};

export async function searchChessMatchup({
  platform,
  userChess,
  streamerChess,
  channel,
}: ChessSearchParams): Promise<ChessMatchupResponse> {
  const res = await fetch(`${apiBase()}${CHESS_ENDPOINT[platform]}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // Don't cache — matchup results depend on the streamer's live VOD list.
    cache: "no-store",
    body: JSON.stringify({
      user_chess_username: userChess,
      streamer_chess_username: streamerChess,
      [CHESS_CHANNEL_FIELD[platform]]: channel,
    }),
  });

  if (!res.ok) {
    let detail = `Chess search failed: ${res.status}`;
    try {
      const body = await res.json();
      if (body?.detail) detail = body.detail;
    } catch {
      // Response wasn't JSON — keep the generic message.
    }
    throw new Error(detail);
  }

  return res.json();
}

// ── Valorant matchup search ─────────────────────────────────────────────────
// Same shape as the chess.com search above — one backend route per VOD
// platform, dispatched here.

export interface ValorantMatch {
  video_id: string;
  video_name: string;
  timestamp: number;
  played_at: number;
  map: string;
  mode: string;
  result: string;
  teammates: boolean;
  viewer_agent: string;
  streamer_agent: string;
  match_url: string;
}

export interface ValorantMatchupResponse {
  results: ValorantMatch[];
  total: number;
  vods_scanned: number;
}

export interface ValorantSearchParams {
  platform: ChessPlatform;
  viewerRiotId: string;
  streamerRiotId: string;
  channel: string;
}

const VALORANT_ENDPOINT: Record<ChessPlatform, string> = {
  twitch: "/api/valorant/search",
  kick: "/api/valorant/kick/search",
  youtube: "/api/valorant/youtube/search",
};

const VALORANT_CHANNEL_FIELD: Record<ChessPlatform, string> = {
  twitch: "streamer_twitch_username",
  kick: "streamer_kick_username",
  youtube: "streamer_youtube_channel",
};

export async function searchValorantMatchup({
  platform,
  viewerRiotId,
  streamerRiotId,
  channel,
}: ValorantSearchParams): Promise<ValorantMatchupResponse> {
  const res = await fetch(`${apiBase()}${VALORANT_ENDPOINT[platform]}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // Don't cache — matchup results depend on the streamer's live VOD list.
    cache: "no-store",
    body: JSON.stringify({
      viewer_riot_id: viewerRiotId,
      streamer_riot_id: streamerRiotId,
      [VALORANT_CHANNEL_FIELD[platform]]: channel,
    }),
  });

  if (!res.ok) {
    let detail = `Valorant search failed: ${res.status}`;
    try {
      const body = await res.json();
      if (body?.detail) detail = body.detail;
    } catch {
      // Response wasn't JSON — keep the generic message.
    }
    throw new Error(detail);
  }

  return res.json();
}

// ── Dota 2 matchup search ───────────────────────────────────────────────────
// Same shape as the chess.com/Valorant searches above — one backend route
// per VOD platform, dispatched here. Players are identified by their
// Steam32 account ID ("Friend ID" in the Dota 2 client) rather than a name.

export interface Dota2Match {
  video_id: string;
  video_name: string;
  timestamp: number;
  played_at: number;
  duration: number;
  result: string;
  teammates: boolean;
  viewer_hero: string;
  streamer_hero: string;
  match_url: string;
}

export interface Dota2MatchupResponse {
  results: Dota2Match[];
  total: number;
  vods_scanned: number;
}

export interface Dota2SearchParams {
  platform: ChessPlatform;
  viewerDotaId: string;
  streamerDotaId: string;
  channel: string;
}

const DOTA2_ENDPOINT: Record<ChessPlatform, string> = {
  twitch: "/api/dota2/search",
  kick: "/api/dota2/kick/search",
  youtube: "/api/dota2/youtube/search",
};

const DOTA2_CHANNEL_FIELD: Record<ChessPlatform, string> = {
  twitch: "streamer_twitch_username",
  kick: "streamer_kick_username",
  youtube: "streamer_youtube_channel",
};

export async function searchDota2Matchup({
  platform,
  viewerDotaId,
  streamerDotaId,
  channel,
}: Dota2SearchParams): Promise<Dota2MatchupResponse> {
  const res = await fetch(`${apiBase()}${DOTA2_ENDPOINT[platform]}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // Don't cache — matchup results depend on the streamer's live VOD list.
    cache: "no-store",
    body: JSON.stringify({
      viewer_dota_id: viewerDotaId,
      streamer_dota_id: streamerDotaId,
      [DOTA2_CHANNEL_FIELD[platform]]: channel,
    }),
  });

  if (!res.ok) {
    let detail = `Dota 2 search failed: ${res.status}`;
    try {
      const body = await res.json();
      if (body?.detail) detail = body.detail;
    } catch {
      // Response wasn't JSON — keep the generic message.
    }
    throw new Error(detail);
  }

  return res.json();
}
