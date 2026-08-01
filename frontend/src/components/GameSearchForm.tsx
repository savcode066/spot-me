"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ChessPlatform } from "@/lib/api";

export type Game = "chess" | "valorant" | "dota2";

const GAMES: { value: Game; label: string }[] = [
  { value: "chess", label: "Chess.com" },
  { value: "valorant", label: "Valorant" },
  { value: "dota2", label: "Dota 2" },
];

const PLATFORMS: { value: ChessPlatform; label: string }[] = [
  { value: "twitch", label: "Twitch" },
  { value: "kick", label: "Kick" },
  { value: "youtube", label: "YouTube" },
];

const COPY: Record<Game, { you: string; streamer: string; idPlaceholder?: string }> = {
  chess: {
    you: "Your Chess.com Username",
    streamer: "Streamer's Chess.com Username",
  },
  valorant: {
    you: "Your Riot ID",
    streamer: "Streamer's Riot ID",
    // Riot IDs are Name#Tag — the backend rejects a bare username, so this
    // is the one field that still needs a hint. Team/clan tags (e.g. "T1",
    // "TL") are often part of the literal Riot ID name itself, not just a
    // cosmetic prefix, so callers need to include it.
    idPlaceholder: "e.g. T1 TenZ#2001 (w/ team tag)",
  },
  dota2: {
    you: "Your Dota 2 Friend ID",
    streamer: "Streamer's Dota 2 Friend ID",
    // Dota 2 has no lookup-by-name API, so we take the Steam32 account ID
    // directly — the same number shown as "Friend ID" in the client's
    // profile/friends list, not the longer SteamID64.
    idPlaceholder: "e.g. 105248644",
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

    if (game === "chess") {
      const params = new URLSearchParams({ user: u, streamer: s, platform, channel: ch });
      router.push(`/chess/scanning?${params.toString()}`);
      return;
    }

    const params = new URLSearchParams({ viewer: u, streamer: s, platform, channel: ch });
    router.push(`/${game}/scanning?${params.toString()}`);
  };

  return (
    <div className="w-full max-w-[560px] card-frame clip-18">
      <div className="card-panel clip-17 p-8 md:p-10">
        <div className="alert-wash" />
        <div className="diamond-tick absolute top-4 left-4 w-[9px] h-[9px]" />

        <div className="flex items-center gap-2.5 mb-6">
          <div className="diamond-tick w-2.5 h-2.5 shrink-0" />
          <span className="font-headline font-bold text-[15px] tracking-[0.22em] text-ink uppercase">
            SpotMe
          </span>
        </div>

        <h1 className="font-headline font-bold text-3xl text-ink uppercase mb-2 leading-tight">
          Find My Clip
        </h1>
        <p className="font-body text-sm text-ink-dim mb-7 leading-relaxed">
          Enter your ID and a streamer&apos;s to find every match you played against them.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Game */}
          <div className="flex flex-col gap-1.5">
            <label className="font-label text-[10px] tracking-[0.12em] text-ink-muted uppercase">
              Game
            </label>
            <div className="relative rounded-full bg-input-alt px-4 flex items-center gap-2.5">
              <span className="w-[7px] h-[7px] rounded-full bg-alert shrink-0" />
              <select
                value={game}
                onChange={(e) => onGameChange(e.target.value as Game)}
                className="flex-1 bg-transparent border-none text-ink font-body font-semibold text-sm py-3 pr-5 focus:ring-0 focus:outline-none appearance-none cursor-pointer"
              >
                {GAMES.map((g) => (
                  <option key={g.value} value={g.value} className="bg-input-alt text-ink">
                    {g.label}
                  </option>
                ))}
              </select>
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none text-xs">
                ⌄
              </span>
            </div>
            {game === "valorant" && (
              <p className="font-label text-[10px] text-alert/80 uppercase tracking-wide mt-0.5">
                ⚠ Experimental — may not always resolve a match
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Your ID */}
            <div className="flex flex-col gap-1.5">
              <label className="font-label text-[10px] tracking-[0.12em] text-ink-muted uppercase">
                {c.you}
              </label>
              <div className="clip-8 bg-input px-3.5 py-3">
                <input
                  type="text"
                  value={you}
                  onChange={(e) => setYou(e.target.value)}
                  placeholder={c.idPlaceholder}
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={50}
                  required
                  className="w-full bg-transparent border-none text-ink font-mono text-sm focus:ring-0 focus:outline-none placeholder:text-ink-faint"
                />
              </div>
            </div>

            {/* Streamer's ID */}
            <div className="flex flex-col gap-1.5">
              <label className="font-label text-[10px] tracking-[0.12em] text-ink-muted uppercase">
                {c.streamer}
              </label>
              <div className="clip-8 bg-input px-3.5 py-3">
                <input
                  type="text"
                  value={streamer}
                  onChange={(e) => setStreamer(e.target.value)}
                  placeholder={c.idPlaceholder}
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={50}
                  required
                  className="w-full bg-transparent border-none text-ink font-mono text-sm focus:ring-0 focus:outline-none placeholder:text-ink-faint"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* VOD platform */}
            <div className="flex flex-col gap-1.5">
              <label className="font-label text-[10px] tracking-[0.12em] text-ink-muted uppercase">
                VOD Platform
              </label>
              <div className="relative rounded-full bg-twitch/[0.16] px-3.5 flex items-center gap-2">
                <span className="w-[7px] h-[7px] rounded-full bg-twitch shrink-0" />
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value as ChessPlatform)}
                  className="flex-1 bg-transparent border-none text-twitch-ink font-body font-semibold text-sm py-3 pr-5 focus:ring-0 focus:outline-none appearance-none cursor-pointer"
                >
                  {PLATFORMS.map((p) => (
                    <option key={p.value} value={p.value} className="bg-panel text-ink">
                      {p.label}
                    </option>
                  ))}
                </select>
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-twitch-ink/60 pointer-events-none text-xs">
                  ⌄
                </span>
              </div>
            </div>

            {/* Channel */}
            <div className="flex flex-col gap-1.5">
              <label className="font-label text-[10px] tracking-[0.12em] text-ink-muted uppercase">
                Channel
              </label>
              <div className="clip-8 bg-input px-3.5 py-3">
                <input
                  type="text"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={50}
                  required
                  className="w-full bg-transparent border-none text-ink font-mono text-sm focus:ring-0 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="mt-2 w-full clip-16 bg-gradient-to-r from-steel to-white text-ink-inverse font-headline font-bold text-[15px] tracking-[0.14em] uppercase py-4 hover:opacity-90 transition-opacity cursor-pointer"
          >
            Launch Search
          </button>
        </form>
      </div>
    </div>
  );
}
