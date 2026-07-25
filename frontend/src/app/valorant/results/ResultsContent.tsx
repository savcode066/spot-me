"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import type { Detection, SearchResponse } from "@/lib/api";
import searchIcon from "@/assets/search.png";
import searchOffIcon from "@/assets/search_off.png";
import boltIcon from "@/assets/bolt.png";
import chevronLeftIcon from "@/assets/chevron_left.png";
import chevronRightIcon from "@/assets/chevron_right.png";

// ── helpers ──────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

function twitchTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}h${m}m${s}s`;
}

const PAGE_SIZE = 10;

// ── no-results view ───────────────────────────────────────────────────────────

function NoResults({
  username,
  onRescan,
}: {
  username: string;
  onRescan: (q: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="bg-[#0F1923] text-on-background font-body min-h-screen flex flex-col overflow-hidden">
      <div className="fixed inset-0 vanguard-grid pointer-events-none" />

      <Header backHref="/" />

      <main className="flex-grow flex items-center justify-center relative z-10 px-4 pt-24">
        <div className="w-full max-w-2xl">
          {/* Search retry bar */}
          <div className="bg-surface-container-low border-l-2 border-[#FF4655] p-2 mb-12 relative">
            <div className="flex items-center">
              <div className="px-4 text-[#FF4655]">
                <img src={searchIcon.src} alt="search" className="w-6 h-5" style={{ imageRendering: "crisp-edges" }} />
              </div>
              <input
                ref={inputRef}
                defaultValue={username}
                className="w-full bg-transparent border-none focus:ring-0 text-white font-headline uppercase tracking-widest text-lg placeholder:text-white/20 py-4 outline-none"
                placeholder="INITIATE NEW USERNAME SEARCH..."
                onKeyDown={(e) => {
                  if (e.key === "Enter" && inputRef.current?.value.trim()) {
                    onRescan(inputRef.current.value.trim());
                  }
                }}
              />
              <button
                className="bg-primary-container text-on-primary-fixed font-headline font-bold uppercase px-8 py-4 transition-all hover:bg-primary shrink-0"
                onClick={() => {
                  if (inputRef.current?.value.trim()) {
                    onRescan(inputRef.current.value.trim());
                  }
                }}
              >
                RESCAN
              </button>
            </div>
          </div>

          {/* Empty state graphic */}
          <div className="flex flex-col items-center text-center space-y-8">
            <div className="relative w-48 h-48 flex items-center justify-center">
              <div className="absolute inset-0 border border-[#FF4655]/20 rotate-45" />
              <div className="absolute inset-4 border border-[#FF4655]/40 -rotate-12" />
              <img
                src={searchOffIcon.src}
                alt="search off"
                className="w-20 h-20"
                style={{ imageRendering: "crisp-edges" }}
              />
              <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[#FF4655]" />
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-[#FF4655]" />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-center gap-4">
                <div className="h-px w-12 bg-[#FF4655]/30" />
                <span className="text-[#00dbe9] font-headline text-xs tracking-[0.4em] uppercase">
                  Status: Signal Lost
                </span>
                <div className="h-px w-12 bg-[#FF4655]/30" />
              </div>

              <h1 className="text-5xl md:text-7xl font-headline font-black uppercase text-white tracking-tighter leading-none">
                No matches found.
              </h1>

              <p className="text-white/60 font-body text-lg max-w-md mx-auto leading-relaxed">
                Our scanners returned zero results for that identity.{" "}
                <span className="text-white">Try a different username</span> or
                verify the spelling of the operative tag.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Decorative corners */}
      <div className="fixed bottom-8 left-8 z-10 hidden md:flex flex-col space-y-2 opacity-20">
        <div className="h-1 w-24 bg-[#FF4655]" />
        <div className="h-1 w-12 bg-[#FF4655]" />
        <div className="h-1 w-32 bg-[#FF4655]" />
      </div>
      <div className="fixed bottom-8 right-8 z-10 hidden md:block text-right">
        <p className="text-[10px] font-headline uppercase tracking-[0.3em] text-[#FF4655]">
          Tactical Interface v2.04
        </p>
        <p className="text-[10px] font-headline uppercase tracking-[0.3em] text-white/20">
          System-Ready
        </p>
      </div>
    </div>
  );
}

// ── result card ───────────────────────────────────────────────────────────────

function ResultCard({ result }: { result: Detection }) {
  return (
    <div className="group bg-surface-container-low hover:bg-surface-container-high transition-colors flex items-center border-l-2 border-outline-variant hover:border-primary px-6 py-4 gap-6">
      <h3 className="font-headline text-lg font-bold uppercase tracking-tight text-on-background group-hover:text-primary transition-colors flex-1 truncate">
        {result.video_name}
      </h3>

      <div className="flex flex-col shrink-0">
        <span className="text-[9px] text-outline uppercase tracking-[0.2em] font-label">
          Timestamp
        </span>
        <span className="text-xs font-bold uppercase tracking-widest text-on-surface">
          {formatTime(result.timestamp)}
        </span>
      </div>

      <a
        href={`https://www.twitch.tv/videos/${result.video_id}?t=${twitchTimestamp(result.timestamp)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="bg-primary-container hover:bg-primary text-on-primary-fixed font-label font-black uppercase text-xs px-6 py-3 tracking-[0.15em] transition-all flex items-center gap-2 group/btn shrink-0"
      >
        Jump to Moment
        <img
          src={boltIcon.src}
          alt=""
          className="w-[14px] h-[14px] group-hover/btn:translate-x-1 transition-transform"
          style={{ imageRendering: "crisp-edges" }}
        />
      </a>
    </div>
  );
}

// ── main client shell ─────────────────────────────────────────────────────────

interface Props {
  username: string;
  initialData: SearchResponse;
}

export default function ResultsContent({ username, initialData }: Props) {
  const router = useRouter();
  const [page, setPage] = useState(1);

  const { results, total } = initialData;
  const totalPages  = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageResults = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleRescan = (q: string) =>
    router.push(`/valorant/scanning?username=${encodeURIComponent(q)}`);

  if (total === 0) {
    return <NoResults username={username} onRescan={handleRescan} />;
  }

  return (
    <div className="bg-[#0F1923] min-h-screen">
      <Header
        showSearch
        query={username}
        onSearch={handleRescan}
        backHref="/"
      />

      <main className="pt-24 pb-12 px-6 max-w-7xl mx-auto">
        {/* Page heading */}
        <div className="mb-12">
          <h1 className="font-headline text-5xl md:text-7xl font-black uppercase tracking-tighter leading-none">
            Search Results for <span className="text-primary">{username}</span>
          </h1>
        </div>

        {/* Result cards */}
        <div className="space-y-4">
          {pageResults.map((result, i) => (
            <ResultCard
              key={`${result.video_id}-${result.timestamp}-${i}`}
              result={result}
            />
          ))}
        </div>

        {/* Pagination */}
        <div className="mt-16 flex items-center justify-between border-t border-outline-variant pt-8">
          <div className="flex items-center gap-4">
            <span className="font-label text-[10px] text-outline uppercase tracking-[0.3em]">
              Showing
            </span>
            <span className="font-headline text-lg font-bold">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)}{" "}
              OF {total}
            </span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-10 h-10 border border-outline-variant flex items-center justify-center hover:bg-surface-container-high transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <img src={chevronLeftIcon.src} alt="Previous" className="w-[14px] h-[14px]" style={{ imageRendering: "crisp-edges" }} />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-10 h-10 font-black flex items-center justify-center transition-colors ${
                  p === page
                    ? "bg-primary-container text-on-primary-container"
                    : "border border-outline-variant hover:bg-surface-container-high"
                }`}
              >
                {p}
              </button>
            ))}

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="w-10 h-10 border border-outline-variant flex items-center justify-center hover:bg-surface-container-high transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <img src={chevronRightIcon.src} alt="Next" className="w-[14px] h-[14px]" style={{ imageRendering: "crisp-edges" }} />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
