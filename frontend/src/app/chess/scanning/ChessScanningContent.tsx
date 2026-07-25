"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import type { ChessPlatform } from "@/lib/api";

interface Props {
  user: string;
  streamer: string;
  platform: ChessPlatform;
  channel: string;
}

const PLATFORM_LABEL: Record<ChessPlatform, string> = {
  twitch: "Twitch",
  kick: "Kick",
  youtube: "YouTube",
};

const SKELETON_CARDS = [
  { glyph: "♞", borderClass: "border-chess-accent/40" },
  { glyph: "♟", borderClass: "border-chess-accent/20" },
  { glyph: "♛", borderClass: "border-chess-accent/10" },
];

// Client shell for the chess scanning page — cosmetic progress animation
// (mirrors the Valorant ScanningContent) before handing off to /chess/results,
// which does the real fetch.
export default function ChessScanningContent({ user, streamer, platform, channel }: Props) {
  const router = useRouter();
  const [progress, setProgress] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 88) {
          clearInterval(intervalRef.current!);
          return 88;
        }
        return Math.min(88, prev + Math.random() * 14 + 2);
      });
    }, 280);

    timeoutRef.current = setTimeout(async () => {
      clearInterval(intervalRef.current!);
      setProgress(100);
      await new Promise((r) => setTimeout(r, 400));
      const params = new URLSearchParams({ user, streamer, platform, channel });
      router.replace(`/chess/results?${params.toString()}`);
    }, 3000);

    return () => {
      clearInterval(intervalRef.current!);
      clearTimeout(timeoutRef.current!);
    };
  }, [user, streamer, platform, channel, router]);

  return (
    <>
      <Header theme="chess" minimal />

      <main className="relative pt-16 min-h-screen flex flex-col items-center justify-center p-6 bg-chess-bg chess-grid">
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
          <div className="absolute top-1/2 left-0 w-full h-px bg-chess-line" />
          <div className="absolute top-0 left-1/2 w-px h-full bg-chess-line" />
          <div className="absolute bottom-10 right-10 text-[10rem] font-chess-display font-black italic text-chess-cream/5 leading-none select-none uppercase">
            Scanning
          </div>
        </div>

        <div className="w-full max-w-3xl z-10 space-y-12">
          <div className="space-y-4">
            <div className="flex justify-between items-end border-b border-chess-line pb-4">
              <h1 className="text-3xl md:text-5xl font-chess-display font-black italic uppercase tracking-tight leading-none text-chess-text">
                Cross-referencing {PLATFORM_LABEL[platform]} VODs...
              </h1>
              <div className="hidden md:block text-right shrink-0 ml-6">
                <p className="text-chess-text font-mono font-bold text-2xl">{Math.round(progress)}%</p>
              </div>
            </div>

            <div className="relative h-2 w-full bg-chess-surface-2 overflow-hidden rounded-full">
              <div className="absolute inset-0 flex justify-between px-1 pointer-events-none">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="w-px h-full bg-chess-bg/50" />
                ))}
              </div>
              <div
                className="absolute top-0 left-0 h-full bg-chess-accent transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
              <div className="absolute top-0 left-0 h-full w-24 bg-gradient-to-r from-transparent via-chess-cream/40 to-transparent scan-line" />
            </div>

            <div className="flex justify-end items-center gap-2">
              <span className="w-2 h-2 bg-chess-accent animate-pulse inline-block rounded-full" />
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-chess-accent-bright font-bold">
                Matching {user} vs {streamer}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 opacity-40">
            {SKELETON_CARDS.map((card, i) => (
              <div
                key={i}
                className={`bg-chess-surface p-6 space-y-4 border-l-2 ${card.borderClass} relative rounded`}
              >
                <div className="flex justify-between">
                  <div className="h-3 w-16 skeleton-pulse" />
                  <div className="h-3 w-8 skeleton-pulse" />
                </div>
                <div className="h-8 w-full skeleton-pulse" />
                <div className="space-y-2">
                  <div className="h-2 w-full skeleton-pulse opacity-50" />
                  <div className="h-2 w-3/4 skeleton-pulse opacity-50" />
                </div>
                <div className="absolute -bottom-1 -right-1 text-4xl text-chess-cream/10 select-none">
                  {card.glyph}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="fixed bottom-6 right-6 flex flex-col items-end z-20">
          <div className="text-[10px] font-mono uppercase tracking-[0.4em] text-chess-cream/40 rotate-90 origin-right translate-y-[-50px]">
            Archive Sync
          </div>
          <div className="w-12 h-12 border-b-4 border-r-4 border-chess-accent" />
        </div>
      </main>
    </>
  );
}
