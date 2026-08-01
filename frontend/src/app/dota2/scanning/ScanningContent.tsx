"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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

// Cosmetic progress animation — the real fetch happens on /dota2/results
// after this redirects there, so duration/count here is flavor, not telemetry.
const SCAN_DURATION_MS = 3000;

export default function ScanningContent({ viewer, streamer, platform, channel }: Props) {
  const router = useRouter();
  const [progress, setProgress] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const start = Date.now();
    intervalRef.current = setInterval(() => {
      setProgress(Math.min(96, ((Date.now() - start) / SCAN_DURATION_MS) * 100));
    }, 100);

    timeoutRef.current = setTimeout(async () => {
      clearInterval(intervalRef.current!);
      setProgress(100);
      await new Promise((r) => setTimeout(r, 400));
      const params = new URLSearchParams({ viewer, streamer, platform, channel });
      router.replace(`/dota2/results?${params.toString()}`);
    }, SCAN_DURATION_MS);

    return () => {
      clearInterval(intervalRef.current!);
      clearTimeout(timeoutRef.current!);
    };
  }, [viewer, streamer, platform, channel, router]);

  const matchesChecked = Math.round((progress / 100) * 1500);

  return (
    <main className="min-h-screen flex items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-[560px] card-frame clip-18">
        <div className="card-panel clip-17 p-10 md:p-12 text-center">
          <div className="alert-wash" />

          <div className="inline-flex items-center gap-2 rounded-full bg-twitch/[0.16] px-3.5 py-1.5 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-alert" />
            <span className="font-label text-[11px] tracking-[0.08em] text-twitch-ink uppercase">
              Scanning
            </span>
          </div>

          <h1 className="font-headline font-bold text-2xl text-ink uppercase mb-2">
            Cross-referencing VODs
          </h1>
          <p className="font-body text-sm text-ink-dim mb-7">
            Matching {viewer} against {streamer}&apos;s {PLATFORM_LABEL[platform]} archive
          </p>

          <div className="h-2 bg-track rounded-full overflow-hidden mb-3.5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-ink-soft to-steel transition-[width] duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex justify-between font-mono text-xs text-ink-faint">
            <span>{matchesChecked.toLocaleString()} matches checked</span>
            <span>{Math.round(progress)}%</span>
          </div>
        </div>
      </div>
    </main>
  );
}
