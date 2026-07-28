"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ChessPlatform } from "@/lib/api";

export type Game = "chess" | "valorant";

const GAMES: { value: Game; label: string }[] = [
  { value: "chess", label: "Chess.com" },
  { value: "valorant", label: "Valorant" },
];

const PLATFORMS: { value: ChessPlatform; label: string }[] = [
  { value: "twitch", label: "Twitch" },
  { value: "kick", label: "Kick" },
  { value: "youtube", label: "YouTube" },
];

const COPY: Record<Game, { you: string; streamer: string }> = {
  chess: {
    you: "Your Chess.com Username",
    streamer: "Streamer's Chess.com Username",
  },
  valorant: {
    you: "Your Riot ID",
    streamer: "Streamer's Riot ID",
  },
};

interface GameSearchFormProps {
  game: Game;
  onGameChange: (g: Game) => void;
}

export default function GameSearchForm({ game, onGameChange }: GameSearchFormProps) {
  const [you, setYou] = useState("");
  const [streamer, setStreamer] = useState("");
  const [platform, setPlatform] = useState<ChessPlatform>("twitch");
  const [channel, setChannel] = useState("");
  const router = useRouter();

  const c = COPY[game];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const u = you.trim();
    const s = streamer.trim();
    const ch = channel.trim();
    if (!u || !s || !ch) return;

    if (game === "valorant") {
      const params = new URLSearchParams({ viewer: u, streamer: s, platform, channel: ch });
      router.push(`/valorant/scanning?${params.toString()}`);
      return;
    }

    const params = new URLSearchParams({ user: u, streamer: s, platform, channel: ch });
    router.push(`/chess/scanning?${params.toString()}`);
  };

  return (
    <form onSubmit={handleSubmit} className="tactical-border bg-surface-container-low/95 p-8 md:p-12 shadow-2xl relative w-full">
      <div className="scanline-sweep" />

      {/* Module header */}
      <div className="flex justify-between items-end mb-10 border-b border-outline-variant pb-4">
        <div>
          <p className="font-label text-[10px] text-primary tracking-[0.2em] mb-1 uppercase">Match Finder</p>
          <h1 className="font-headline text-2xl text-on-surface uppercase font-bold">Find My Clip</h1>
        </div>
        <span className="material-symbols-outlined material-symbols-filled text-primary text-xl">radar</span>
      </div>

      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Choose Game */}
          <div className="relative">
            <label className="font-label text-[11px] text-on-surface-variant uppercase mb-2 block tracking-wider">
              Choose Game
            </label>
            <div className="input-accent relative">
              <select
                value={game}
                onChange={(e) => onGameChange(e.target.value as Game)}
                className="w-full bg-transparent border-none text-on-surface font-label text-sm py-3 pr-6 focus:ring-0 appearance-none cursor-pointer"
              >
                {GAMES.map((g) => (
                  <option key={g.value} value={g.value} className="bg-surface-container">
                    {g.label}
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant">
                arrow_drop_down
              </span>
              <div className="corner-notch" />
            </div>
          </div>

          {/* Platform */}
          <div className="relative">
            <label className="font-label text-[11px] text-on-surface-variant uppercase mb-2 block tracking-wider">
              Platform
            </label>
            <div className="input-accent relative">
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as ChessPlatform)}
                className="w-full bg-transparent border-none text-on-surface font-label text-sm py-3 pr-6 focus:ring-0 appearance-none cursor-pointer"
              >
                {PLATFORMS.map((p) => (
                  <option key={p.value} value={p.value} className="bg-surface-container">
                    {p.label}
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant">
                arrow_drop_down
              </span>
              <div className="corner-notch" />
            </div>
          </div>
        </div>

        {/* Your username */}
        <div className="relative">
          <label className="font-label text-[11px] text-on-surface-variant uppercase mb-2 block tracking-wider">
            {c.you}
          </label>
          <div className="input-accent relative">
            <input
              type="text"
              value={you}
              onChange={(e) => setYou(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              maxLength={50}
              required
              className="w-full bg-transparent border-none text-on-surface font-label text-sm py-3 focus:ring-0"
            />
            <div className="corner-notch" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Streamer's username */}
          <div className="relative">
            <label className="font-label text-[11px] text-on-surface-variant uppercase mb-2 block tracking-wider">
              {c.streamer}
            </label>
            <div className="input-accent relative">
              <input
                type="text"
                value={streamer}
                onChange={(e) => setStreamer(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                maxLength={50}
                required
                className="w-full bg-transparent border-none text-on-surface font-label text-sm py-3 focus:ring-0"
              />
              <div className="corner-notch" />
            </div>
          </div>

          {/* Channel name */}
          <div className="relative">
            <label className="font-label text-[11px] text-on-surface-variant uppercase mb-2 block tracking-wider">
              Channel Name
            </label>
            <div className="input-accent relative">
              <input
                type="text"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                maxLength={50}
                required
                className="w-full bg-transparent border-none text-on-surface font-label text-sm py-3 focus:ring-0"
              />
              <div className="corner-notch" />
            </div>
          </div>
        </div>

        {/* Action button */}
        <div className="pt-2">
          <button
            type="submit"
            className="w-full group relative overflow-hidden bg-primary-container py-5 px-8 flex justify-between items-center transition-all duration-300 hover:shadow-[0_0_20px_rgba(255,184,0,0.4)] active:scale-[0.98]"
          >
            <span className="font-label text-on-primary font-black uppercase tracking-[0.25em] relative z-10">
              Launch Search
            </span>
            <span className="material-symbols-outlined material-symbols-filled text-on-primary relative z-10">
              send
            </span>
          </button>
        </div>
      </div>
    </form>
  );
}
