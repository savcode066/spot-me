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

function resultRail(result: string): string {
  if (result === "win") return "status-rail-left";
  if (DRAW_RESULTS.has(result)) return "border-l-2 border-outline-variant";
  return "border-l-2 border-error/60";
}

function resultBadge(result: string): { label: string; className: string } {
  if (result === "win") return { label: "Win", className: "bg-primary-container/15 text-primary-container border-primary-container/30" };
  if (DRAW_RESULTS.has(result)) return { label: "Draw", className: "bg-white/10 text-on-surface-variant border-white/20" };
  return { label: "Loss", className: "bg-error/15 text-error border-error/30" };
}

// ── empty state ──────────────────────────────────────────────────────────────

function NoMatchups({ user, streamer, vodsScanned }: { user: string; streamer: string; vodsScanned: number }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header backHref="/?game=chess" backLabel="← New Search" />

      <main className="flex-grow flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-xl text-center space-y-6">
          <div className="flex items-center justify-center gap-4">
            <div className="h-px w-12 bg-primary-container/30" />
            <span className="font-label text-[11px] text-primary tracking-[0.3em] uppercase">
              No Matchups Found
            </span>
            <div className="h-px w-12 bg-primary-container/30" />
          </div>

          <h1 className="font-headline text-3xl md:text-4xl text-on-surface uppercase tracking-tight font-bold">
            {user} hasn&apos;t played {streamer}.
          </h1>

          <p className="font-body text-on-surface-variant text-base leading-relaxed max-w-md mx-auto">
            We scanned {vodsScanned} VOD{vodsScanned === 1 ? "" : "s"} and cross-referenced the full chess.com
            archive for both accounts in that window — no games between the two of you turned up.
          </p>

          <a
            href="/?game=chess"
            className="inline-flex items-center gap-2 bg-primary-container hover:opacity-90 text-on-primary font-label font-bold uppercase px-8 py-4 tracking-[0.15em] transition-opacity"
          >
            New Search
          </a>
        </div>
      </main>
    </div>
  );
}

// ── match row ────────────────────────────────────────────────────────────────

function MatchRow({ match, platform, index }: { match: ChessMatch; platform: ChessPlatform; index: number }) {
  const badge = resultBadge(match.result);

  return (
    <div className={`group grid grid-cols-1 md:grid-cols-12 gap-y-4 md:gap-4 items-center px-6 py-5 border-t border-outline-variant bg-surface-dim hover:bg-primary-container/[0.03] transition-colors relative ${resultRail(match.result)}`}>
      <div className="col-span-1 font-label text-on-surface-variant text-[12px] opacity-50 hidden md:block">
        [{String(index + 1).padStart(3, "0")}]
      </div>

      <div className="col-span-1 md:col-span-5 flex items-center gap-3 min-w-0">
        <span className={`shrink-0 border px-2.5 py-1 font-label text-[10px] tracking-wider uppercase ${badge.className}`}>
          {badge.label}
        </span>
        <div className="min-w-0">
          <h3 className="font-headline text-lg text-on-surface uppercase tracking-tight truncate">
            vs {match.opponent}
          </h3>
          <p className="font-label text-[10px] text-on-surface-variant uppercase tracking-wide">
            {formatDate(match.played_at)} · {match.time_class} · {match.rated ? "rated" : "unrated"}
          </p>
        </div>
      </div>

      <div className="col-span-1 md:col-span-2 md:text-right font-label text-primary-container font-bold text-sm">
        {formatClock(match.timestamp)}
      </div>

      <div className="col-span-1 md:col-span-4 flex gap-2 md:justify-end">
        <a
          href={match.game_url}
          target="_blank"
          rel="noopener noreferrer"
          className="border border-outline-variant hover:border-primary-container text-on-surface-variant hover:text-on-surface font-label text-xs px-4 py-3 transition-colors flex items-center"
        >
          View Game
        </a>
        <a
          href={vodDeepLink(platform, match.video_id, match.timestamp)}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-primary-container hover:opacity-90 text-on-primary font-label font-black uppercase text-xs px-6 py-3 tracking-[0.1em] transition-opacity flex items-center gap-2"
        >
          Watch on {PLATFORM_LABEL[platform]}
          <span className="material-symbols-outlined text-[16px] group-hover:translate-x-1 transition-transform">
            play_arrow
          </span>
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
    <div className="min-h-screen flex flex-col">
      <Header backHref="/?game=chess" backLabel="← New Search" />

      <main className="flex-grow w-full max-w-6xl mx-auto px-6 py-12 md:py-16">
        <div className="mb-10 border-l-2 border-primary-container pl-6">
          <div className="font-label text-primary text-[10px] uppercase tracking-[0.3em] mb-2 opacity-70">
            Query Results · {vods_scanned} VOD{vods_scanned === 1 ? "" : "s"} scanned on {PLATFORM_LABEL[platform]}
          </div>
          <h1 className="font-headline text-3xl md:text-5xl text-on-surface uppercase leading-none font-bold">
            {user} <span className="text-primary-container">vs {streamer}</span>
          </h1>
        </div>

        <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-surface-container-low border border-outline-variant text-on-surface-variant font-label text-[10px] uppercase tracking-widest">
          <div className="col-span-1">ID</div>
          <div className="col-span-5">Opponent</div>
          <div className="col-span-2 text-right">Timestamp</div>
          <div className="col-span-4 text-right">Action</div>
        </div>

        <div className="flex flex-col border-x border-b border-outline-variant">
          {pageResults.map((match, i) => (
            <MatchRow key={`${match.video_id}-${match.played_at}-${i}`} match={match} platform={platform} index={(page - 1) * PAGE_SIZE + i} />
          ))}
        </div>

        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-between">
            <div className="flex items-center border border-outline-variant px-4 h-10 font-label text-[12px]">
              PAGE <span className="text-primary-container mx-2">{String(page).padStart(2, "0")}</span> OF {String(totalPages).padStart(2, "0")}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-10 h-10 flex items-center justify-center border border-outline-variant text-on-surface-variant hover:border-primary-container hover:text-primary-container transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="w-10 h-10 flex items-center justify-center border border-outline-variant text-on-surface-variant hover:border-primary-container hover:text-primary-container transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
