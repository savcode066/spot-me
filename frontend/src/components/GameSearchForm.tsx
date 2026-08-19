"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ChessPlatform } from "@/lib/api";
import Dropdown, { type DropdownOption } from "./Dropdown";

export type Game = "chess" | "valorant" | "dota2";

// Dot color is each game/platform's real brand color (or closest usable
// shade). These feed Dropdown as data, not Tailwind classes, since a
// per-selection color can't be a static class name.
const GAME_OPTIONS: DropdownOption[] = [
  { value: "chess", label: "Chess.com", color: "#81B64C" },
  { value: "valorant", label: "Valorant", color: "#FF4655" },
  { value: "dota2", label: "Dota 2", color: "#C23C2A" },
];

const PLATFORM_OPTIONS: DropdownOption[] = [
  { value: "twitch", label: "Twitch", color: "#9146FF", textColor: "#c9a8ff", bgColor: "rgba(145,70,255,.16)" },
  { value: "kick", label: "Kick", color: "#53FC18", textColor: "#a8f58b", bgColor: "rgba(83,252,24,.13)" },
  { value: "youtube", label: "YouTube", color: "#FF0033", textColor: "#ff9aa8", bgColor: "rgba(255,0,51,.14)" },
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
  const [openDropdown, setOpenDropdown] = useState<"game" | "platform" | null>(null);
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
            <Dropdown
              ariaLabel="Select game"
              options={GAME_OPTIONS}
              value={game}
              onChange={(v) => onGameChange(v as Game)}
              open={openDropdown === "game"}
              onToggle={() => setOpenDropdown((d) => (d === "game" ? null : "game"))}
              onClose={() => setOpenDropdown(null)}
            />
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
              <Dropdown
                ariaLabel="Select VOD platform"
                options={PLATFORM_OPTIONS}
                value={platform}
                onChange={(v) => setPlatform(v as ChessPlatform)}
                open={openDropdown === "platform"}
                onToggle={() => setOpenDropdown((d) => (d === "platform" ? null : "platform"))}
                onClose={() => setOpenDropdown(null)}
                variant="tinted"
                direction="up"
                triggerClassName="px-3.5 py-[11px]"
              />
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
