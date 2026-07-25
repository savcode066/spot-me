"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ChessPlatform } from "@/lib/api";

const PLATFORMS: { value: ChessPlatform; label: string }[] = [
  { value: "twitch", label: "Twitch" },
  { value: "kick", label: "Kick" },
  { value: "youtube", label: "YouTube" },
];

export default function ChessSearchForm() {
  const [userChess, setUserChess] = useState("");
  const [streamerChess, setStreamerChess] = useState("");
  const [platform, setPlatform] = useState<ChessPlatform>("twitch");
  const [channel, setChannel] = useState("");
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const u = userChess.trim();
    const s = streamerChess.trim();
    const c = channel.trim();
    if (!u || !s || !c) return;

    const params = new URLSearchParams({ user: u, streamer: s, platform, channel: c });
    router.push(`/chess/scanning?${params.toString()}`);
  };

  return (
    <form onSubmit={handleSubmit} className="relative bg-gradient-to-b from-chess-surface to-chess-surface-2 border border-chess-line rounded-[10px] p-7">
      <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-[10px] bg-gradient-to-b from-chess-accent to-chess-accent-dim" />

      <div className="mb-[18px]">
        <label className="flex items-baseline gap-2 font-mono text-[10.5px] tracking-[0.13em] uppercase text-chess-cream/40 mb-2">
          <span className="text-chess-accent-bright">01</span> Your Chess.com Username
        </label>
        <div className="relative">
          <span className="absolute left-[14px] top-1/2 -translate-y-1/2 font-mono text-sm text-chess-cream/40 pointer-events-none">♟</span>
          <input
            type="text"
            value={userChess}
            onChange={(e) => setUserChess(e.target.value)}
            placeholder="e.g. savmath06"
            autoComplete="off"
            spellCheck={false}
            maxLength={50}
            required
            className="w-full bg-black/30 border border-chess-line rounded-md py-[13px] pl-[30px] pr-[14px] font-mono text-[14.5px] text-chess-text placeholder:text-chess-cream/30 outline-none transition-colors focus:border-chess-accent focus:bg-chess-accent/[0.06]"
          />
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-[14px] mb-[18px]">
        <div className="flex-1">
          <label className="flex items-baseline gap-2 font-mono text-[10.5px] tracking-[0.13em] uppercase text-chess-cream/40 mb-2">
            <span className="text-chess-accent-bright">02</span> Streamer&apos;s Chess.com Username
          </label>
          <div className="relative">
            <span className="absolute left-[14px] top-1/2 -translate-y-1/2 font-mono text-sm text-chess-cream/40 pointer-events-none">♛</span>
            <input
              type="text"
              value={streamerChess}
              onChange={(e) => setStreamerChess(e.target.value)}
              placeholder="e.g. xQc"
              autoComplete="off"
              spellCheck={false}
              maxLength={50}
              required
              className="w-full bg-black/30 border border-chess-line rounded-md py-[13px] pl-[30px] pr-[14px] font-mono text-[14.5px] text-chess-text placeholder:text-chess-cream/30 outline-none transition-colors focus:border-chess-accent focus:bg-chess-accent/[0.06]"
            />
          </div>
        </div>

        <div className="flex-1">
          <label className="flex items-baseline gap-2 font-mono text-[10.5px] tracking-[0.13em] uppercase text-chess-cream/40 mb-2">
            <span className="text-chess-accent-bright">03</span> Streamer&apos;s Channel
          </label>
          <div className="flex gap-2">
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as ChessPlatform)}
              className="bg-black/30 border border-chess-line rounded-md px-3 font-mono text-[13px] text-chess-text outline-none transition-colors focus:border-chess-accent cursor-pointer"
            >
              {PLATFORMS.map((p) => (
                <option key={p.value} value={p.value} className="bg-chess-surface">
                  {p.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              placeholder="channel handle"
              autoComplete="off"
              spellCheck={false}
              maxLength={50}
              required
              className="flex-1 min-w-0 bg-black/30 border border-chess-line rounded-md py-[13px] px-[14px] font-mono text-[14.5px] text-chess-text placeholder:text-chess-cream/30 outline-none transition-colors focus:border-chess-accent focus:bg-chess-accent/[0.06]"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-[26px] pt-5 border-t border-chess-line">
        <span className="font-mono text-[10.5px] text-chess-cream/30 leading-relaxed max-w-[220px]">
          Scans full match history on both accounts — usually takes a few seconds.
        </span>
        <button
          type="submit"
          className="flex items-center gap-[9px] rounded-md px-[22px] py-[14px] font-bold text-[14.5px] text-[#0f1300] bg-gradient-to-b from-chess-accent-bright to-chess-accent shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_8px_24px_-8px_rgba(129,182,76,0.5)] transition-transform hover:-translate-y-px active:translate-y-0"
        >
          Find My Games
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="w-[15px] h-[15px]">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>
    </form>
  );
}
