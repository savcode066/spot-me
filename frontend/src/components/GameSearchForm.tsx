"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ChessPlatform } from "@/lib/api";

export type Game = "chess" | "valorant";

const CHESS_PLATFORMS: { value: ChessPlatform; label: string }[] = [
  { value: "twitch", label: "Twitch" },
  { value: "kick", label: "Kick" },
  { value: "youtube", label: "YouTube" },
];

// Reticle glyph for Valorant fields — kept as inline SVG (rather than a
// material-symbols name) so it renders identically regardless of font load
// timing, and reads as a "targeting" mark rather than a generic search icon.
function Reticle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <circle cx="12" cy="12" r="7.5" />
      <path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4" strokeLinecap="round" />
    </svg>
  );
}

// Per-game design tokens. Every class below is a literal string (not
// template-built) so Tailwind's static scanner picks all of them up —
// nothing here is assembled at runtime.
const THEME = {
  chess: {
    label: "Chess.com",
    glyph: "♟",
    tagline: "Board archive lookup",
    cardBg: "bg-gradient-to-b from-chess-surface to-chess-surface-2",
    cardBorder: "border-chess-line",
    accentBar: "bg-gradient-to-b from-chess-accent to-chess-accent-dim",
    numColor: "text-chess-accent-bright",
    labelColor: "text-chess-cream/40",
    iconColor: "text-chess-cream/40",
    inputCls:
      "bg-black/30 border-chess-line text-chess-text placeholder:text-chess-cream/30 focus:border-chess-accent focus:bg-chess-accent/[0.06]",
    selectCls: "bg-black/30 border-chess-line text-chess-text focus:border-chess-accent",
    footerText: "text-chess-cream/30",
    footerBorder: "border-chess-line",
    buttonCls:
      "text-[#0f1300] bg-gradient-to-b from-chess-accent-bright to-chess-accent shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_8px_24px_-8px_rgba(129,182,76,0.5)]",
    toggleActive: "bg-chess-accent/15 border-chess-accent text-chess-accent-bright",
    toggleInactive: "border-chess-line text-chess-cream/40 hover:text-chess-cream/70 hover:border-chess-cream/25",
    displayFont: "font-chess-display italic",
    footerNote: "Scans full match history on both accounts — usually takes a few seconds.",
    submitLabel: "Find My Games",
  },
  valorant: {
    label: "Valorant",
    glyph: "reticle",
    tagline: "VOD kill-feed lookup",
    cardBg: "bg-gradient-to-b from-surface-container-low to-surface-container",
    cardBorder: "border-outline-variant/40",
    accentBar: "bg-gradient-to-b from-primary-container to-primary",
    numColor: "text-tertiary",
    labelColor: "text-on-surface/40",
    iconColor: "text-primary/70",
    inputCls:
      "bg-black/30 border-outline-variant/40 text-on-background placeholder:text-on-surface/30 focus:border-primary focus:bg-primary/[0.06]",
    selectCls: "bg-black/30 border-outline-variant/40 text-on-background focus:border-primary",
    footerText: "text-on-surface/30",
    footerBorder: "border-outline-variant/40",
    buttonCls:
      "text-on-primary-fixed bg-gradient-to-b from-primary-container to-primary shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_8px_24px_-8px_rgba(255,70,85,0.55)]",
    toggleActive: "bg-primary/15 border-primary text-primary",
    toggleInactive: "border-outline-variant/40 text-on-surface/40 hover:text-on-surface/70 hover:border-outline-variant",
    displayFont: "font-headline italic",
    footerNote: "Scans thousands of hours of VOD footage for your callouts — usually takes a few seconds.",
    submitLabel: "Initiate Scan",
  },
} as const;

interface GameSearchFormProps {
  game: Game;
  onGameChange: (g: Game) => void;
}

export default function GameSearchForm({ game, onGameChange }: GameSearchFormProps) {
  const [userChess, setUserChess] = useState("");
  const [streamerChess, setStreamerChess] = useState("");
  const [platform, setPlatform] = useState<ChessPlatform>("twitch");
  const [channel, setChannel] = useState("");
  const [riotUsername, setRiotUsername] = useState("");
  const router = useRouter();

  const t = THEME[game];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (game === "valorant") {
      const trimmed = riotUsername.trim();
      if (!trimmed) return;
      const base = trimmed.replace(/#\S+$/, "");
      if (!/[a-zA-Z0-9]/.test(base)) return;
      router.push(`/valorant/scanning?username=${encodeURIComponent(trimmed)}`);
      return;
    }

    const u = userChess.trim();
    const s = streamerChess.trim();
    const c = channel.trim();
    if (!u || !s || !c) return;
    const params = new URLSearchParams({ user: u, streamer: s, platform, channel: c });
    router.push(`/chess/scanning?${params.toString()}`);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`relative rounded-[10px] border p-7 transition-colors duration-300 ${t.cardBg} ${t.cardBorder}`}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l-[10px] transition-colors duration-300 ${t.accentBar}`} />

      {/* ── 00 — game picker ── */}
      <div className="mb-6">
        <label className={`flex items-baseline gap-2 font-mono text-[10.5px] tracking-[0.13em] uppercase mb-2 ${t.labelColor}`}>
          <span className={t.numColor}>00</span> Choose Your Game
        </label>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(THEME) as Game[]).map((g) => {
            const gt = THEME[g];
            const active = g === game;
            return (
              <button
                key={g}
                type="button"
                onClick={() => onGameChange(g)}
                aria-pressed={active}
                className={`flex items-center justify-center gap-2 rounded-md border py-3 px-3 font-mono text-[13px] font-semibold tracking-wide transition-all ${
                  active ? gt.toggleActive : gt.toggleInactive
                }`}
              >
                <span className="text-base leading-none">
                  {gt.glyph === "reticle" ? <Reticle className="w-4 h-4" /> : gt.glyph}
                </span>
                {gt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 01 — your username (shape shifts per game) ── */}
      <div className="mb-[18px]">
        <label className={`flex items-baseline gap-2 font-mono text-[10.5px] tracking-[0.13em] uppercase mb-2 ${t.labelColor}`}>
          <span className={t.numColor}>01</span> {game === "chess" ? "Your Chess.com Username" : "Your Riot Username"}
        </label>
        <div className="relative">
          <span className={`absolute left-[14px] top-1/2 -translate-y-1/2 pointer-events-none ${t.iconColor}`}>
            {game === "chess" ? (
              <span className="font-mono text-sm">♟</span>
            ) : (
              <Reticle className="w-[15px] h-[15px]" />
            )}
          </span>
          <input
            type="text"
            value={game === "chess" ? userChess : riotUsername}
            onChange={(e) => (game === "chess" ? setUserChess(e.target.value) : setRiotUsername(e.target.value))}
            placeholder={game === "chess" ? "e.g. savmath06" : "e.g. TenZ#NA1"}
            autoComplete="off"
            spellCheck={false}
            maxLength={50}
            required
            className={`w-full rounded-md border py-[13px] pl-[34px] pr-[14px] font-mono text-[14.5px] outline-none transition-colors ${t.inputCls}`}
          />
        </div>
      </div>

      {/* ── 02 / 03 — chess-only streamer fields ── */}
      {game === "chess" && (
        <div className="flex flex-col md:flex-row gap-[14px] mb-[18px]">
          <div className="flex-1">
            <label className={`flex items-baseline gap-2 font-mono text-[10.5px] tracking-[0.13em] uppercase mb-2 ${t.labelColor}`}>
              <span className={t.numColor}>02</span> Streamer&apos;s Chess.com Username
            </label>
            <div className="relative">
              <span className={`absolute left-[14px] top-1/2 -translate-y-1/2 font-mono text-sm pointer-events-none ${t.iconColor}`}>♛</span>
              <input
                type="text"
                value={streamerChess}
                onChange={(e) => setStreamerChess(e.target.value)}
                placeholder="e.g. xQc"
                autoComplete="off"
                spellCheck={false}
                maxLength={50}
                required
                className={`w-full rounded-md border py-[13px] pl-[30px] pr-[14px] font-mono text-[14.5px] outline-none transition-colors ${t.inputCls}`}
              />
            </div>
          </div>

          <div className="flex-1">
            <label className={`flex items-baseline gap-2 font-mono text-[10.5px] tracking-[0.13em] uppercase mb-2 ${t.labelColor}`}>
              <span className={t.numColor}>03</span> Streamer&apos;s Channel
            </label>
            <div className="flex gap-2">
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as ChessPlatform)}
                className={`rounded-md border px-3 font-mono text-[13px] outline-none transition-colors cursor-pointer ${t.selectCls}`}
              >
                {CHESS_PLATFORMS.map((p) => (
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
                className={`flex-1 min-w-0 rounded-md border py-[13px] px-[14px] font-mono text-[14.5px] outline-none transition-colors ${t.inputCls}`}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── footer / submit ── */}
      <div className={`flex items-center justify-between mt-[26px] pt-5 border-t transition-colors duration-300 ${t.footerBorder}`}>
        <span className={`font-mono text-[10.5px] leading-relaxed max-w-[220px] ${t.footerText}`}>
          {t.footerNote}
        </span>
        <button
          type="submit"
          className={`flex items-center gap-[9px] rounded-md px-[22px] py-[14px] font-bold text-[14.5px] transition-transform hover:-translate-y-px active:translate-y-0 ${t.buttonCls}`}
        >
          {t.submitLabel}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="w-[15px] h-[15px]">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>
    </form>
  );
}
