"use client";

import { useState } from "react";
import Header from "@/components/Header";
import type { ChessPlatform, Dota2Match, Dota2MatchupResponse } from "@/lib/api";

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
      return `https://kick.com/video/${videoId}`;
  }
}

// Result → the app's rarity-ladder color language, doubling as a CS2-style
// significance rail on each row. Literal class strings (not built via
// template interpolation) so Tailwind's JIT scanner can see them statically.
function resultStyle(result: string): { label: string; text: string; rail: string } {
  if (result === "win") return { label: "WIN", text: "text-steel", rail: "bg-steel" };
  if (result === "loss") return { label: "LOSS", text: "text-alert", rail: "bg-alert" };
  return { label: "UNKNOWN", text: "text-tier-routine", rail: "bg-tier-routine" };
}

// ── empty state ──────────────────────────────────────────────────────────────
// Not covered by the design handoff (flagged there as "not designed yet") —
// extrapolated in the same card-shell visual language as landing/scanning.

function NoMatchups({
  viewer,
  streamer,
  vodsScanned,
}: {
  viewer: string;
  streamer: string;
  vodsScanned: number;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header backHref="/?game=dota2" />

      <main className="flex-grow flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[560px] card-frame clip-18">
          <div className="card-panel clip-17 p-10 text-center">
            <div className="alert-wash" />

            <div className="font-label text-[11px] tracking-[0.2em] text-ink-faint uppercase mb-3">
              No Matchups Found
            </div>
            <h1 className="font-headline font-bold text-2xl text-ink uppercase mb-3">
              {viewer} hasn&apos;t played with {streamer}.
            </h1>
            <p className="font-body text-sm text-ink-dim leading-relaxed mb-7">
              We scanned {vodsScanned} VOD{vodsScanned === 1 ? "" : "s"} and cross-referenced match
              history for both accounts in that window — no shared games turned up.
            </p>

            <a
              href="/?game=dota2"
              className="inline-block clip-16 bg-gradient-to-r from-steel to-white text-ink-inverse font-headline font-bold text-sm uppercase tracking-[0.14em] px-8 py-3.5 hover:opacity-90 transition-opacity"
            >
              New Search
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}

// ── match row ────────────────────────────────────────────────────────────────

function MatchRow({ match, platform }: { match: Dota2Match; platform: ChessPlatform }) {
  const style = resultStyle(match.result);

  return (
    <div className="relative clip-10 bg-panel px-5 py-4 flex flex-wrap md:flex-nowrap items-center gap-4">
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${style.rail}`} />

      <div className={`w-14 shrink-0 font-headline font-bold text-[13px] ${style.text}`}>
        {style.label}
      </div>

      <div className="flex-1 min-w-0 order-1 md:order-none basis-full md:basis-auto">
        <div className="font-body font-semibold text-sm text-ink truncate">
          {match.teammates ? "with" : "vs"} {match.streamer_hero}
        </div>
        <div className="font-mono text-xs text-ink-faint-alt mt-0.5">
          {formatDate(match.played_at)} · playing {match.viewer_hero} · {formatClock(match.duration)}
        </div>
      </div>

      <div className="font-mono font-semibold text-[13px] text-steel shrink-0">
        {formatClock(match.timestamp)}
      </div>

      <a
        href={match.match_url}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 font-mono text-[11px] text-ink-faint hover:text-ink transition-colors"
      >
        View Match ↗
      </a>

      <a
        href={vodDeepLink(platform, match.video_id, match.timestamp)}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 rounded-full bg-twitch/[0.2] text-twitch-ink font-headline font-semibold text-xs px-3.5 py-2.5 hover:bg-twitch/[0.3] transition-colors"
      >
        Watch on {PLATFORM_LABEL[platform]}
      </a>
    </div>
  );
}

// ── main client shell ─────────────────────────────────────────────────────────

interface Props {
  viewer: string;
  streamer: string;
  platform: ChessPlatform;
  channel: string;
  initialData: Dota2MatchupResponse;
}

export default function ResultsContent({ viewer, streamer, platform, channel, initialData }: Props) {
  const [page, setPage] = useState(1);
  const { results, total, vods_scanned } = initialData;

  if (total === 0) {
    return <NoMatchups viewer={viewer} streamer={streamer} vodsScanned={vods_scanned} />;
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageResults = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="min-h-screen flex flex-col">
      <Header backHref="/?game=dota2" />

      <main className="flex-grow w-full max-w-3xl mx-auto px-6 py-10 md:py-14">
        <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
          <div>
            <div className="font-mono text-[11px] tracking-[0.1em] text-ink-faint uppercase mb-1.5">
              {viewer} vs
            </div>
            <h1 className="font-headline font-bold text-2xl md:text-[26px] text-ink uppercase">
              {total} shared match{total === 1 ? "" : "es"}
            </h1>
            <p className="font-mono text-[11px] text-ink-faint mt-1">
              {vods_scanned} VOD{vods_scanned === 1 ? "" : "s"} scanned on {PLATFORM_LABEL[platform]}
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-discord/[0.18] px-3.5 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-discord" />
            <span className="font-mono font-semibold text-xs text-discord-ink">{channel}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          {pageResults.map((match, i) => (
            <MatchRow key={`${match.video_id}-${match.played_at}-${i}`} match={match} platform={platform} />
          ))}
        </div>

        {totalPages > 1 && (
          <div className="mt-7 flex items-center justify-between">
            <div className="font-mono text-xs text-ink-faint">
              Page <span className="text-steel">{pad(page)}</span> of {pad(totalPages)}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-9 h-9 rounded-full bg-input flex items-center justify-center text-ink-muted hover:text-ink hover:bg-input-alt transition-colors disabled:opacity-30 disabled:cursor-not-allowed font-mono"
              >
                ‹
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="w-9 h-9 rounded-full bg-input flex items-center justify-center text-ink-muted hover:text-ink hover:bg-input-alt transition-colors disabled:opacity-30 disabled:cursor-not-allowed font-mono"
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
