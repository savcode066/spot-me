"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";

interface Props {
  username: string;
}

const SKELETON_CARDS = [
  { icon: "analytics", borderClass: "border-primary/40" },
  { icon: "radar",     borderClass: "border-primary/20" },
  { icon: "speed",     borderClass: "border-primary/10" },
];

// Client shell for the scanning page.
// Receives username from the server component — no useSearchParams needed.
export default function ScanningContent({ username }: Props) {
  const router = useRouter();
  const [progress, setProgress] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef  = useRef<ReturnType<typeof setTimeout>  | null>(null);

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

    // After 3 s → jump to 100, brief pause, navigate to results
    timeoutRef.current = setTimeout(async () => {
      clearInterval(intervalRef.current!);
      setProgress(100);
      await new Promise((r) => setTimeout(r, 400));
      router.push(`/results?username=${encodeURIComponent(username)}`);
    }, 3000);

    return () => {
      clearInterval(intervalRef.current!);
      clearTimeout(timeoutRef.current!);
    };
  }, [username, router]);

  return (
    <>
      <Header minimal />

      <main className="relative pt-16 min-h-screen flex flex-col items-center justify-center p-6">
        {/* ── HUD background grid ── */}
        <div className="absolute inset-0 pointer-events-none opacity-20 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full border-[20px] border-surface-container-low opacity-30" />
          <div className="absolute top-1/2 left-0 w-full h-px bg-outline-variant/20" />
          <div className="absolute top-0 left-1/2 w-px h-full bg-outline-variant/20" />
          <div className="absolute bottom-10 right-10 text-[10rem] font-black text-white/5 font-headline leading-none select-none uppercase">
            Scanning
          </div>
        </div>

        {/* ── Central progress unit ── */}
        <div className="w-full max-w-3xl z-10 space-y-12">
          <div className="space-y-4">
            {/* Title + live percentage */}
            <div className="flex justify-between items-end border-b border-outline-variant/30 pb-4">
              <h1 className="text-4xl md:text-6xl font-headline font-black uppercase tracking-tighter leading-none">
                Scanning thousands of hours of gameplay...
              </h1>
              <div className="hidden md:block text-right shrink-0 ml-6">
                <p className="text-on-background font-headline font-bold text-2xl">
                  {Math.round(progress)}%
                </p>
              </div>
            </div>

            {/* Segmented progress bar */}
            <div className="relative h-2 w-full bg-secondary-container/30 overflow-hidden">
              {/* Track dividers */}
              <div className="absolute inset-0 flex justify-between px-1 pointer-events-none">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="w-px h-full bg-background/50" />
                ))}
              </div>
              {/* Fill */}
              <div
                className="absolute top-0 left-0 h-full bg-primary transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
              {/* Kinetic scan line */}
              <div className="absolute top-0 left-0 h-full w-24 bg-gradient-to-r from-transparent via-white/40 to-transparent scan-line" />
            </div>

            {/* Status */}
            <div className="flex justify-end items-center gap-2">
              <span className="w-2 h-2 bg-primary animate-pulse inline-block" />
              <span className="text-[10px] font-label uppercase tracking-[0.2em] text-primary font-bold">
                Awaiting Combat Data
              </span>
            </div>
          </div>

          {/* ── Skeleton data cards ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 opacity-40">
            {SKELETON_CARDS.map((card, i) => (
              <div
                key={i}
                className={`bg-surface-container-low p-6 space-y-4 border-l-2 ${card.borderClass} relative`}
              >
                <div className="flex justify-between">
                  <div className="h-3 w-16 skeleton-pulse" />
                  <div className="h-3 w-8  skeleton-pulse" />
                </div>
                <div className="h-8 w-full skeleton-pulse" />
                <div className="space-y-2">
                  <div className="h-2 w-full skeleton-pulse opacity-50" />
                  <div className="h-2 w-3/4 skeleton-pulse opacity-50" />
                </div>
                <div className="absolute -bottom-1 -right-1">
                  <span className="material-symbols-outlined text-outline-variant/20 text-4xl">
                    {card.icon}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Corner accent ── */}
        <div className="fixed bottom-6 right-6 flex flex-col items-end z-20">
          <div className="text-[10px] font-label uppercase tracking-[0.4em] text-on-surface-variant rotate-90 origin-right translate-y-[-50px]">
            Protocol Alpha
          </div>
          <div className="w-12 h-12 border-b-4 border-r-4 border-primary" />
        </div>
      </main>
    </>
  );
}
