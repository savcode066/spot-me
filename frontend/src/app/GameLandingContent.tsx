"use client";

import { useState } from "react";
import GameSearchForm, { type Game } from "@/components/GameSearchForm";

const GAME_PILLS: { name: string; color: string }[] = [
  { name: "Chess.com", color: "bg-tier-routine" },
  { name: "Valorant", color: "bg-alert" },
  { name: "Dota 2", color: "bg-tier-clutch" },
];

const STEPS: { n: string; color: string; title: string; body: string }[] = [
  {
    n: "01",
    color: "text-alert",
    title: "Pick your game",
    body: "Chess.com, Valorant, or Dota 2 — more on the way.",
  },
  {
    n: "02",
    color: "text-tier-close",
    title: "Enter both IDs",
    body: "Your ID and the streamer's, plus their VOD channel.",
  },
  {
    n: "03",
    color: "text-tier-routine",
    title: "Get your timestamp",
    body: "We match your history against their VODs and hand you the second.",
  },
];

const SAMPLE_ROWS: {
  result: string;
  rail: string;
  text: string;
  detail: string;
  date: string;
  timestamp: string;
}[] = [
  {
    result: "WIN",
    rail: "bg-steel",
    text: "text-steel",
    detail: "vs tacticalvee · Blitz",
    date: "Apr 3, 2026",
    timestamp: "0:38:12",
  },
  {
    result: "LOSS",
    rail: "bg-tier-clutch",
    text: "text-tier-clutch",
    detail: "vs TacticalVee · Ascent",
    date: "Mar 20, 2026",
    timestamp: "1:04:55",
  },
  {
    result: "WIN",
    rail: "bg-tier-routine",
    text: "text-tier-routine",
    detail: "with Roamer · 42:10",
    date: "Mar 6, 2026",
    timestamp: "0:22:40",
  },
];

function TopBar() {
  return (
    <div className="w-full max-w-[1320px] mx-auto px-6 md:px-12 pt-7">
      <div className="flex items-center gap-2.5">
        <div className="diamond-tick w-2.5 h-2.5 shrink-0" />
        <span className="font-headline font-bold text-[15px] tracking-[0.22em] text-ink uppercase">
          SpotMe
        </span>
      </div>
    </div>
  );
}

function Hero({ game, onGameChange }: { game: Game; onGameChange: (g: Game) => void }) {
  return (
    <div className="w-full max-w-[1320px] mx-auto px-6 md:px-12 py-12 md:py-20">
      <div className="flex gap-10 lg:gap-14 items-center flex-wrap lg:flex-nowrap">
        <div className="flex-1 min-w-[320px]">
          <div className="rounded-full bg-twitch/[0.16] px-3.5 py-1.5 inline-flex items-center gap-2 mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-alert" />
            <span className="font-label text-[11px] tracking-[0.08em] text-twitch-ink uppercase">
              Live search across 3 games
            </span>
          </div>

          <h1 className="font-headline font-bold text-4xl md:text-[52px] leading-[1.05] text-ink uppercase mb-5">
            Find My Clip
          </h1>
          <p className="font-body text-base md:text-lg leading-relaxed text-ink-soft max-w-md mb-8">
            See the exact moment you played against your favorite streamer, and jump straight to
            it in their VOD.
          </p>

          <div className="flex gap-2.5 flex-wrap max-w-md">
            {GAME_PILLS.map((g) => (
              <div
                key={g.name}
                className="rounded-full bg-panel px-3.5 py-1.5 flex items-center gap-1.5"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${g.color}`} />
                <span className="font-body font-semibold text-xs text-ink-muted">{g.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div id="search" className="w-full lg:w-auto flex-none scroll-mt-10">
          <GameSearchForm game={game} onGameChange={onGameChange} />
        </div>
      </div>
    </div>
  );
}

function HowItWorks() {
  return (
    <div className="w-full max-w-[1320px] mx-auto px-6 md:px-12 py-12 md:py-16">
      <div className="text-center mb-10">
        <div className="font-label text-[11px] tracking-[0.2em] text-ink-faint uppercase mb-2.5">
          How It Works
        </div>
        <h2 className="font-headline font-bold text-2xl md:text-[32px] text-ink uppercase">
          Three steps to your moment
        </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {STEPS.map((s) => (
          <div key={s.n} className="relative bg-panel clip-14 p-7">
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${s.color.replace("text-", "bg-")}`} />
            <div className={`font-headline font-bold text-3xl mb-3 ${s.color}`}>{s.n}</div>
            <div className="font-headline font-bold text-base text-ink uppercase mb-2">
              {s.title}
            </div>
            <div className="font-body text-sm leading-relaxed text-ink-soft">{s.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SampleResults() {
  return (
    <div className="w-full max-w-[1320px] mx-auto px-6 md:px-12 py-12 md:py-16">
      <div className="text-center mb-10">
        <div className="font-label text-[11px] tracking-[0.2em] text-ink-faint uppercase mb-2.5">
          Sample Results
        </div>
        <h2 className="font-headline font-bold text-2xl md:text-[32px] text-ink uppercase mb-3">
          Every shared match, ready to watch
        </h2>
        <p className="font-body text-sm md:text-base text-ink-soft">
          Color-coded by how close the match was — one click drops you into the VOD at that second.
        </p>
      </div>

      <div className="max-w-3xl mx-auto card-frame clip-18">
        <div className="card-panel clip-17 p-6 md:p-7">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent to-[#3a3a3c]" />
            <div className="diamond-tick w-1.5 h-1.5" />
            <div className="flex-1 h-px bg-gradient-to-l from-transparent to-[#3a3a3c]" />
          </div>

          <div className="flex flex-col gap-2.5">
            {SAMPLE_ROWS.map((r, i) => (
              <div
                key={i}
                className="relative clip-10 bg-input px-4 py-3.5 flex flex-wrap sm:flex-nowrap items-center gap-3.5"
              >
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${r.rail}`} />
                <div className={`w-12 shrink-0 font-headline font-bold text-xs ${r.text}`}>
                  {r.result}
                </div>
                <div className="flex-1 min-w-0 order-1 sm:order-none basis-full sm:basis-auto">
                  <div className="font-body font-semibold text-sm text-ink truncate">
                    {r.detail}
                  </div>
                  <div className="font-mono text-[11px] text-ink-faint-alt mt-0.5">{r.date}</div>
                </div>
                <div className="font-mono font-semibold text-xs text-steel shrink-0">
                  {r.timestamp}
                </div>
                <div className="shrink-0 rounded-full bg-twitch/[0.2] text-twitch-ink font-headline font-semibold text-[11px] px-3 py-2 cursor-default">
                  Watch on Twitch
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CTASection() {
  return (
    <div className="w-full max-w-[1320px] mx-auto px-6 md:px-12 py-12 md:py-16">
      <div className="relative bg-panel clip-20 p-10 md:p-14 text-center overflow-hidden">
        <div className="diamond-tick absolute top-5 left-5 w-2 h-2" />
        <div className="diamond-tick absolute bottom-5 right-5 w-2 h-2" />
        <h2 className="font-headline font-bold text-2xl md:text-[30px] text-ink uppercase mb-3">
          Ready to find your clip?
        </h2>
        <p className="font-body text-sm md:text-base text-ink-soft mb-7">
          Works with Twitch, YouTube, and Kick VODs.
        </p>
        <a
          href="#search"
          className="inline-block clip-16 bg-gradient-to-r from-steel to-white text-ink-inverse font-headline font-bold text-sm uppercase tracking-[0.12em] px-9 py-4 hover:opacity-90 transition-opacity"
        >
          Launch Search
        </a>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <div className="w-full max-w-[1320px] mx-auto px-6 md:px-12">
      <div className="border-t border-white/[0.08] py-8 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2.5">
          <div className="diamond-tick w-2 h-2" />
          <span className="font-headline font-semibold text-xs tracking-[0.14em] text-ink-dim uppercase">
            SpotMe
          </span>
        </div>
        <span className="font-body text-xs text-ink-faint">
          © 2026 SpotMe. Not affiliated with any game publisher or streaming platform.
        </span>
      </div>
    </div>
  );
}

// Full marketing homepage: hero (with the search card embedded), a "how it
// works" strip, a static sample-results preview, a closing CTA, and a
// minimal footer — all wrapping the same GameSearchForm used elsewhere.
export default function GameLandingContent({ initialGame }: { initialGame: Game }) {
  const [game, setGame] = useState<Game>(initialGame);

  return (
    <main className="min-h-screen">
      <TopBar />
      <Hero game={game} onGameChange={setGame} />
      <HowItWorks />
      <SampleResults />
      <CTASection />
      <Footer />
    </main>
  );
}
