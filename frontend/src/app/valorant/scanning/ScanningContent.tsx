"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import type { ChessPlatform } from "@/lib/api";

interface Props {
  viewer: string;
  streamer: string;
  platform: ChessPlatform;
  channel: string;
}

const PLATFORM_LABEL: Record<ChessPlatform, string> = {
  twitch: "Twitch",
  kick: "Kick",
  youtube: "YouTube",
};

const SKELETON_ICONS = ["analytics", "radar", "speed"];

const FACTS = [
  "The first eSports tournament was held in 1972 at Stanford University.",
  "Nintendo was founded in 1889 as a playing card company.",
  "The highest possible score in Pac-Man is 3,333,360 points.",
  "Space Invaders was so popular it caused a coin shortage in Japan.",
  "The PlayStation 2 is the best-selling game console of all time.",
  "'Elite' (1984) was the first game to use wireframe 3D with hidden-line removal.",
];

// Client shell for the scanning page.
// Receives search params from the server component — no useSearchParams needed.
export default function ScanningContent({ viewer, streamer, platform, channel }: Props) {
  const router = useRouter();
  const [progress, setProgress] = useState(0);
  const [factIndex, setFactIndex] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Animate progress up to ~88% in variable-speed steps
    intervalRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 88) {
          clearInterval(intervalRef.current!);
          return 88;
        }
        return Math.min(88, prev + Math.random() * 14 + 2);
      });
    }, 280);

    // After 3 s → jump to 100, brief pause, navigate to results (which does the real fetch)
    timeoutRef.current = setTimeout(async () => {
      clearInterval(intervalRef.current!);
      setProgress(100);
      await new Promise((r) => setTimeout(r, 400));
      const params = new URLSearchParams({ viewer, streamer, platform, channel });
      router.replace(`/valorant/results?${params.toString()}`);
    }, 3000);

    return () => {
      clearInterval(intervalRef.current!);
      clearTimeout(timeoutRef.current!);
    };
  }, [viewer, streamer, platform, channel, router]);

  useEffect(() => {
    const id = setInterval(() => setFactIndex((i) => (i + 1) % FACTS.length), 6000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Header minimal />
      <div className="page-scanline z-10" />

      <main className="relative z-20 flex-grow w-full flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-2xl flex flex-col gap-8">
          <div className="space-y-4">
            <div className="flex justify-between items-end border-b border-outline-variant pb-4">
              <h1 className="font-headline text-2xl md:text-4xl text-on-surface uppercase tracking-tight glitch-text">
                Scanning {PLATFORM_LABEL[platform]} VODs...
              </h1>
              <div className="hidden md:block text-right shrink-0 ml-6">
                <p className="font-label font-bold text-2xl text-on-surface">{Math.round(progress)}%</p>
              </div>
            </div>

            <div className="relative h-2 w-full bg-surface-container-high overflow-hidden rounded-full">
              <div
                className="absolute top-0 left-0 h-full bg-primary-container transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
              <div className="absolute top-0 left-0 h-full w-24 bg-gradient-to-r from-transparent via-white/40 to-transparent scan-line" />
            </div>

            <div className="flex justify-end items-center gap-2">
              <span className="w-2 h-2 bg-primary-container animate-pulse inline-block rounded-full" />
              <span className="font-label text-[10px] uppercase tracking-[0.2em] text-primary font-bold">
                Matching {viewer} vs {streamer}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full opacity-40">
            {SKELETON_ICONS.map((icon, i) => (
              <div key={i} className="status-rail-left bg-surface-container-low p-6 space-y-4 relative">
                <div className="flex justify-between">
                  <div className="h-3 w-16 skeleton-pulse" />
                  <div className="h-3 w-8 skeleton-pulse" />
                </div>
                <div className="h-8 w-full skeleton-pulse" />
                <div className="space-y-2">
                  <div className="h-2 w-full skeleton-pulse opacity-50" />
                  <div className="h-2 w-3/4 skeleton-pulse opacity-50" />
                </div>
                <div className="absolute -bottom-1 -right-1">
                  <span className="material-symbols-outlined text-on-surface-variant/20 text-4xl">{icon}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Real delight, not fake telemetry — a bit of gaming trivia while we wait */}
          <div className="w-full bg-surface-container-low border-l-4 border-primary-container p-6 relative">
            <div className="absolute -top-3 -left-1 font-label text-[10px] bg-primary-container text-on-primary px-2 py-0.5 uppercase tracking-wider">
              While You Wait
            </div>
            <div className="flex items-start gap-4">
              <span className="material-symbols-outlined material-symbols-filled text-primary mt-1">info</span>
              <p className="font-body text-on-surface italic transition-opacity duration-500">
                {FACTS[factIndex]}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
