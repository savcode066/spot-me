"use client";

import { useState } from "react";
import Header from "@/components/Header";
import GameSearchForm, { type Game } from "@/components/GameSearchForm";

const COPY: Record<Game, { kicker: string; index: string; heroGame: string; sub: React.ReactNode; watermarkTop: string; watermarkBottom: string }> = {
  chess: {
    kicker: "Archive: any streamer's Chess.com history",
    index: "01 // PGN_READY",
    heroGame: "Chess.com",
    sub: (
      <>
        Enter your <b className="text-chess-text font-semibold">Chess.com</b> username, the streamer&apos;s, and
        where they broadcast. We pull both game histories, find every time you played each other, and hand you
        the exact <b className="text-chess-text font-semibold">VOD timestamp</b> for each one.
      </>
    ),
    watermarkTop: "Opening",
    watermarkBottom: "Endgame",
  },
  valorant: {
    kicker: "Targeting: any streamer's ranked VOD library",
    index: "02 // SCAN_ACTIVE",
    heroGame: "Valorant",
    sub: (
      <>
        Enter your <b className="text-on-background font-semibold">Riot</b> username. Our tactical engine
        cross-references match history and kill-feeds across the streamer&apos;s entire VOD library to find
        the exact round you crossed paths.
      </>
    ),
    watermarkTop: "Search",
    watermarkBottom: "Analyze",
  },
};

export default function GameLandingContent({ initialGame }: { initialGame: Game }) {
  const [game, setGame] = useState<Game>(initialGame);
  const c = COPY[game];
  const isChess = game === "chess";

  return (
    <div className={`min-h-screen transition-colors duration-500 ${isChess ? "bg-chess-bg text-chess-text" : "bg-background text-on-background"}`}>
      <Header theme={game} />

      {/* ── crossfading background grid ── */}
      <div className={`fixed inset-0 pointer-events-none transition-opacity duration-500 chess-grid ${isChess ? "opacity-100" : "opacity-0"}`} />
      <div className={`fixed inset-0 pointer-events-none transition-opacity duration-500 vanguard-grid ${isChess ? "opacity-0" : "opacity-100"}`} />

      <main className="relative mt-16 min-h-[calc(100vh-64px)] w-full flex flex-col items-center justify-start pt-16 px-6 overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none transition-all duration-500"
          style={{
            background: isChess
              ? "radial-gradient(ellipse 70% 60% at 50% 30%, transparent 0%, #100f0a 78%)"
              : "radial-gradient(ellipse 70% 60% at 50% 30%, transparent 0%, #0F1923 78%)",
          }}
        />

        {/* Giant faded background wordmarks, crossfaded per game */}
        <span
          className={`absolute top-[6%] -right-[2%] font-black italic uppercase leading-[0.85] text-[11vw] whitespace-nowrap select-none pointer-events-none transition-opacity duration-500 ${
            isChess ? "font-chess-display opacity-100" : "font-headline opacity-0"
          }`}
          style={{ color: "transparent", WebkitTextStroke: "1px rgba(129,182,76,0.18)" }}
        >
          {c.watermarkTop}
        </span>
        <span
          className={`absolute top-[6%] -right-[2%] font-headline font-black italic uppercase leading-[0.85] text-[11vw] whitespace-nowrap select-none pointer-events-none transition-opacity duration-500 text-[#FF4655] ${
            isChess ? "opacity-0" : "opacity-[0.07]"
          }`}
        >
          {COPY.valorant.watermarkTop}
        </span>
        <span
          className={`absolute bottom-[6%] -left-[2%] font-chess-display font-black italic uppercase leading-[0.85] text-[11vw] whitespace-nowrap select-none pointer-events-none transition-opacity duration-500 text-chess-cream/[0.05] ${
            isChess ? "opacity-100" : "opacity-0"
          }`}
        >
          {c.watermarkBottom}
        </span>
        <span
          className={`absolute bottom-[6%] -left-[2%] font-headline font-black italic uppercase leading-[0.85] text-[11vw] whitespace-nowrap select-none pointer-events-none transition-opacity duration-500 text-tertiary ${
            isChess ? "opacity-0" : "opacity-[0.08]"
          }`}
        >
          {COPY.valorant.watermarkBottom}
        </span>

        <section className="relative z-10 w-full max-w-[760px] text-center">
          {/* Metadata bar */}
          <div className={`flex justify-between items-center border-b pb-3 mb-8 transition-colors duration-500 ${isChess ? "border-chess-line" : "border-outline-variant/30"}`}>
            <div className="flex items-center gap-[10px]">
              <span className={`w-[7px] h-[7px] rounded-full transition-colors duration-500 ${isChess ? "bg-chess-accent chess-pulse-dot" : "bg-tertiary animate-pulse"}`} />
              <span className={`font-mono text-[11px] tracking-[0.14em] uppercase transition-colors duration-500 ${isChess ? "text-chess-cream/50" : "text-on-surface/60"}`}>
                {c.kicker}
              </span>
            </div>
            <span className={`font-mono text-[11px] tracking-[0.14em] transition-colors duration-500 ${isChess ? "text-chess-accent-bright" : "text-tertiary"}`}>
              {c.index}
            </span>
          </div>

          <h1
            className={`font-black italic uppercase tracking-tight leading-[0.94] text-[clamp(34px,6vw,58px)] mb-4 transition-[color] duration-500 ${
              isChess ? "font-chess-display" : "font-headline"
            }`}
          >
            Find Yourself in
            <span className={`block transition-colors duration-500 ${isChess ? "text-chess-accent" : "text-[#FF4655]"}`}>
              Their {c.heroGame} VODs
            </span>
          </h1>

          <p className={`font-body text-base md:text-lg max-w-[56ch] mx-auto mb-10 transition-colors duration-500 ${isChess ? "text-chess-cream/60" : "text-on-surface/70"}`}>
            {c.sub}
          </p>

          <div className="text-left">
            <GameSearchForm game={game} onGameChange={setGame} />
          </div>
        </section>
      </main>
    </div>
  );
}
