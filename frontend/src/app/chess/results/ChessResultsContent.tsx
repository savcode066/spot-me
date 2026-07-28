"use client";

import { useState } from "react";
import Header from "@/components/Header";
import type { ChessMatch, ChessMatchupResponse, ChessPlatform } from "@/lib/api";

const PAGE_SIZE = 10;

const PLATFORM_LABEL: Record<ChessPlatform, string> = {
  twitch: "Twitch",
  kick: "Kick",
  youtube: "YouTube",
};

// ── helpers ──────────────────────────────────────────────────────────────────

function formatClock(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

function formatDate(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function vodDeepLink(platform: ChessPlatform, videoId: string, seconds: number): string {
  switch (platform) {
    case "twitch": {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;
      return `https://www.twitch.tv/videos/${videoId}?t=${h}h${m}m${s}s`;
    }
    case "youtube":
      return `https://www.youtube.com/watch?v=${videoId}&t=${seconds}s`;
    case "kick":
      // Kick has no documented seek-by-timestamp query param — this opens
      // the right VOD; the timestamp is shown alongside for manual seeking.
      return `https://kick.com/video/${videoId}`;
  }
}

const DRAW_RESULTS = new Set(["agreed", "repetition", "stalemate", "insufficient", "50move", "timevsinsufficient"]);

function resultBadge(result: string): { label: string; className: string } {
  if (result === "win") return { label: "Win", className: "bg-chess-accent/15 text-chess-accent-bright border-chess-accent/30" };
  if (DRAW_RESULTS.has(result)) return { label: "Draw", className: "bg-chess-cream/10 text-chess-cream/70 border-chess-cream/20" };
  return { label: "Loss", className: "bg-[#c65b4a]/15 text-[#e08a7a] border-[#c65b4a]/30" };
}

// ── empty state ──────────────────────────────────────────────────────────────

function NoMatchups({ user, streamer, vodsScanned }: { user: string; streamer: string; vodsScanned: number }) {
  return (
    <div className="min-h-screen bg-chess-bg text-chess-text chess-grid">
      <Header theme="chess" backHref="/?game=chess" backLabel="← New Search" />

      <main className="pt-32 pb-16 px-6 max-w-2xl mx-auto text-center">
        <div className="flex items-center justify-center gap-4 mb-6">
          <div className="h-px w-12 bg-chess-accent/30" />
          <span className="font-mono text-xs tracking-[0.4em] uppercase text-chess-accent-bright">
            No Matchups Found
          </span>
          <div className="h-px w-12 bg-chess-accent/30" />
        </div>

        <h1 className="font-chess-display font-black italic uppercase text-4xl md:text-5xl tracking-tight mb-4">
          {user} hasn&apos;t played {streamer}.
        </h1>

        <p className="text-chess-cream/60 text-base leading-relaxed mb-2">
          We scanned {vodsScanned} VOD{vodsScanned === 1 ? "" : "s"} and cross-referenced the full chess.com
          archive for both accounts in that window — no games between the two of you turned up.
        </p>
        <p className="text-chess-cream/40 text-sm mb-10">
          Double-check the usernames, or try a different streamer channel.
        </p>

        <a
          href="/?game=chess"
          className="inline-flex items-center gap-2 rounded-md px-6 py-3 font-bold text-sm text-[#0f1300] bg-chess-accent"
        >
          New Search
        </a>
      </main>
    </div>
  );
}

// ── match card ───────────────────────────────────────────────────────────────

function MatchCard({ match, platform }: { match: ChessMatch; platform: ChessPlatform }) {
  const badge = resultBadge(match.result);

  return (
    <div className="group bg-chess-surface hover:bg-chess-surface-2 transition-colors flex flex-col md:flex-row md:items-center gap-4 md:gap-6 border-l-2 border-chess-line hover:border-chess-accent px-6 py-5 rounded-r-md">
      <span className={`shrink-0 self-start md:self-center border rounded-full px-3 py-1 font-mono text-[11px] tracking-[0.08em] uppercase ${badge.className}`}>
        {badge.label}
      </span>

      <div className="flex-1 min-w-0">
        <h3 className="font-chess-display italic font-bold text-lg text-chess-text truncate">
          vs {match.opponent}
        </h3>
        <p className="font-mono text-[11px] text-chess-cream/40 tracking-wide">
          {formatDate(match.played_at)} · {match.time_class}
          {match.rated ? " · rated" : " · unrated"}
        </p>
      </div>

      <div className="flex flex-col shrink-0">
        <span className="text-[9px] text-chess-cream/40 uppercase tracking-[0.2em] font-mono">Timestamp</span>
        <span className="text-xs font-bold uppercase tracking-widest text-chess-text font-mono">
          {formatClock(match.timestamp)}
        </span>
      </div>

      <div className="flex gap-2 shrink-0">
        <a
          href={match.game_url}
          target="_blank"
          rel="noopener noreferrer"
          className="border border-chess-line hover:border-chess-accent text-chess-cream/70 hover:text-chess-text font-mono text-xs px-4 py-3 rounded-md transition-colors flex items-center"
        >
          View Game
        </a>
        <a
          href={vodDeepLink(platform, match.video_id, match.timestamp)}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-chess-accent hover:bg-chess-accent-bright text-[#0f1300] font-bold uppercase text-xs px-5 py-3 rounded-md tracking-[0.1em] transition-all flex items-center gap-2"
        >
          Watch on {PLATFORM_LABEL[platform]}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </a>
      </div>
    </div>
  );
}

// ── main client shell ─────────────────────────────────────────────────────────

interface Props {
  user: string;
  streamer: string;
  platform: ChessPlatform;
  channel: string;
  initialData: ChessMatchupResponse;
}

export default function ChessResultsContent({ user, streamer, platform, initialData }: Props) {
  const [page, setPage] = useState(1);
  const { results, total, vods_scanned } = initialData;

  if (total === 0) {
    return <NoMatchups user={user} streamer={streamer} vodsScanned={vods_scanned} />;
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageResults = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="bg-chess-bg min-h-screen">
      <Header theme="chess" backHref="/?game=chess" backLabel="← New Search" />

      <main className="pt-24 pb-12 px-6 max-w-5xl mx-auto">
        <div className="mb-4 flex items-center gap-3">
          <span className="w-[7px] h-[7px] rounded-full bg-chess-accent chess-pulse-dot" />
          <span className="font-mono text-[11px] tracking-[0.14em] uppercase text-chess-cream/50">
            {vods_scanned} VOD{vods_scanned === 1 ? "" : "s"} scanned on {PLATFORM_LABEL[platform]}
          </span>
        </div>

        <h1 className="font-chess-display font-black italic uppercase tracking-tight leading-none text-4xl md:text-6xl mb-10">
          {user} <span className="text-chess-accent">vs {streamer}</span>
        </h1>

        <div className="space-y-3">
          {pageResults.map((match, i) => (
            <MatchCard key={`${match.video_id}-${match.played_at}-${i}`} match={match} platform={platform} />
          ))}
        </div>

        {totalPages > 1 && (
          <div className="mt-12 flex items-center justify-between border-t border-chess-line pt-6">
            <span className="font-mono text-[10px] text-chess-cream/40 uppercase tracking-[0.2em]">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-10 h-10 rounded-md border border-chess-line flex items-center justify-center hover:bg-chess-surface-2 transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-chess-cream/70"
              >
                ‹
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-10 h-10 rounded-md font-bold flex items-center justify-center transition-colors font-mono text-sm ${
                    p === page
                      ? "bg-chess-accent text-[#0f1300]"
                      : "border border-chess-line hover:bg-chess-surface-2 text-chess-cream/70"
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="w-10 h-10 rounded-md border border-chess-line flex items-center justify-center hover:bg-chess-surface-2 transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-chess-cream/70"
              >
                ›
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
