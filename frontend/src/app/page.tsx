import Link from "next/link";

// Server component — the hover "grow/recede" split is pure CSS (:has()),
// so this needs no client JS at all.
export default function GameHubPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0b] text-[#e9e9ec] flex flex-col">
      <header className="relative z-10 flex flex-col items-center text-center pt-12 pb-3 px-6">
        <span className="font-mono text-[11px] tracking-[0.22em] uppercase text-white/50 mb-3">
          Two arenas, one search engine
        </span>
        <h1 className="text-3xl md:text-5xl font-black tracking-tight mb-2 text-balance">
          Pick Your Game
        </h1>
        <p className="text-white/50 text-sm md:text-base max-w-md">
          spotme finds you in a streamer&apos;s VODs — the exact clip, the exact timestamp.
          Choose which game you&apos;re chasing.
        </p>
      </header>

      {/* Pure-CSS grow/recede on hover — :has() on the shared parent, not sibling
          selectors, so it works regardless of the VS badge sitting between the cards. */}
      <style>{`
        @media (min-width: 768px) {
          .hub-split:has(.hub-card:hover) .hub-card:not(:hover) { flex-grow: 0.82; }
          .hub-split:has(.hub-card:hover) .hub-card:hover { flex-grow: 1.28; }
        }
      `}</style>

      <div className="hub-split flex-1 flex flex-col md:flex-row relative min-h-[520px]">
        {/* VS seam badge — desktop only */}
        <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-14 h-14 rounded-full bg-[#0a0a0b] border border-white/10 items-center justify-center font-mono text-[11px] text-white/50">
          VS
        </div>

        {/* ── Valorant panel ── */}
        <Link
          href="/valorant"
          className="hub-card group relative flex-1 flex items-center justify-center overflow-hidden border-b md:border-b-0 md:border-r border-white/10 transition-[flex-grow] duration-500 ease-out [transition-timing-function:cubic-bezier(.22,1,.36,1)] py-14 md:py-0"
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 50% 30%, rgba(255,70,85,0.10), transparent 70%), #0F1923",
          }}
        >
          <div
            className="absolute inset-0 opacity-50 pointer-events-none"
            style={{
              backgroundImage:
                "radial-gradient(circle at 2px 2px, rgba(255,70,85,0.10) 1px, transparent 0)",
              backgroundSize: "26px 26px",
            }}
          />
          <div className="absolute top-6 left-6 w-16 h-16 border-t-2 border-l-2 border-[#FF4655]/35 pointer-events-none" />
          <div className="absolute bottom-6 right-6 w-16 h-16 border-b-2 border-r-2 border-[#FF4655]/35 pointer-events-none" />
          <span className="absolute -bottom-[6%] -right-[4%] text-[220px] font-black italic text-[#FF4655] opacity-[0.06] leading-none select-none font-headline">
            V
          </span>

          <div className="relative z-10 text-center px-8 translate-y-1.5 opacity-90 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
            <span className="inline-block mb-5 px-3 py-1 rounded-full text-[10.5px] font-mono tracking-[0.2em] uppercase text-[#FF4655] border border-[#FF4655]/40 bg-[#FF4655]/10">
              Tactical FPS
            </span>
            <h2 className="font-headline font-black italic uppercase tracking-tight text-[34px] leading-none mb-2 text-white">
              Valorant
            </h2>
            <p className="text-white/55 text-sm max-w-[30ch] mx-auto">
              Scan a streamer&apos;s VODs by your in-game name and find every round you crossed paths.
            </p>
            <span className="mt-6 inline-flex items-center gap-2 text-[13.5px] font-bold px-5 py-2.5 rounded-md bg-[#FF4655] text-[#170608]">
              Enter Tactical Mode
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </span>
          </div>
        </Link>

        {/* ── Chess.com panel ── */}
        <Link
          href="/chess"
          className="hub-card group relative flex-1 flex items-center justify-center overflow-hidden transition-[flex-grow] duration-500 ease-out [transition-timing-function:cubic-bezier(.22,1,.36,1)] py-14 md:py-0"
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 50% 30%, rgba(129,182,76,0.10), transparent 70%), #100f0a",
          }}
        >
          <div
            className="absolute inset-0 opacity-60 pointer-events-none"
            style={{
              backgroundImage:
                "linear-gradient(rgba(238,238,210,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(238,238,210,0.05) 1px, transparent 1px)",
              backgroundSize: "44px 44px",
            }}
          />
          <span className="absolute top-6 left-6 font-mono text-[10px] tracking-[0.1em] text-[#eeeed2]/30">a8</span>
          <span className="absolute bottom-6 right-6 font-mono text-[10px] tracking-[0.1em] text-[#eeeed2]/30">h1</span>
          <span className="absolute -bottom-[8%] -left-[4%] text-[240px] text-chess-accent opacity-[0.07] leading-none select-none">
            ♞
          </span>

          <div className="relative z-10 text-center px-8 translate-y-1.5 opacity-90 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
            <span className="inline-block mb-5 px-3 py-1 rounded-full text-[10.5px] font-mono tracking-[0.2em] uppercase text-chess-accent border border-chess-accent/40 bg-chess-accent/10">
              Chess.com
            </span>
            <h2 className="font-chess-display font-extrabold italic tracking-tight text-[34px] leading-none mb-2 text-chess-text">
              Chess
            </h2>
            <p className="text-chess-cream/55 text-sm max-w-[30ch] mx-auto">
              Match your Chess.com history against a streamer&apos;s and get the timestamp for every game.
            </p>
            <span className="mt-6 inline-flex items-center gap-2 text-[13.5px] font-bold px-5 py-2.5 rounded-md bg-chess-accent text-[#0f1300]">
              Enter the Archive
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </span>
          </div>
        </Link>
      </div>

      <footer className="text-center py-4 font-mono text-[10.5px] tracking-[0.1em] text-white/40">
        SELECT A GAME TO CONTINUE
      </footer>
    </div>
  );
}
