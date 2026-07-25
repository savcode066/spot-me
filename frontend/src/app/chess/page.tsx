import Header from "@/components/Header";
import ChessSearchForm from "@/components/ChessSearchForm";

// Server component — mirrors the Valorant landing page's structure, translated
// into chess.com's own brand language (board coordinates, eval bar, notation).
export default function ChessLandingPage() {
  return (
    <div className="min-h-screen bg-chess-bg text-chess-text">
      <Header theme="chess" backHref="/" />

      {/* Rank/file coordinate frame — replaces Valorant's corner brackets */}
      <div className="hidden md:flex fixed top-16 left-0 right-0 justify-between px-7 font-mono text-[10px] tracking-[0.14em] text-chess-cream/25 z-10 pointer-events-none">
        {["A", "B", "C", "D", "E", "F", "G", "H"].map((f) => (
          <span key={f} className="pt-2 border-t border-chess-line w-6 text-center">
            {f}
          </span>
        ))}
      </div>
      <div className="hidden md:flex fixed top-16 bottom-0 left-2 flex-col justify-between py-16 font-mono text-[10px] tracking-[0.1em] text-chess-cream/25 z-10 pointer-events-none">
        {["8", "7", "6", "5", "4", "3", "2", "1"].map((r) => (
          <span key={r}>{r}</span>
        ))}
      </div>
      <span className="fixed top-20 left-5 font-mono text-[11px] tracking-[0.12em] text-chess-cream/25 z-10">a1</span>
      <span className="fixed bottom-5 right-5 font-mono text-[11px] tracking-[0.12em] text-chess-cream/25 z-10">h8</span>

      <main className="relative mt-16 min-h-[calc(100vh-64px)] w-full flex flex-col items-center justify-start pt-16 px-6 chess-grid overflow-hidden">
        {/* Vignette so the board grid fades toward the edges */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 70% 60% at 50% 30%, transparent 0%, #100f0a 78%)",
          }}
        />

        {/* Giant faded background wordmarks */}
        <span
          className="absolute top-[6%] -right-[2%] font-chess-display font-black italic uppercase leading-[0.85] text-[11vw] whitespace-nowrap select-none pointer-events-none"
          style={{ color: "transparent", WebkitTextStroke: "1px rgba(129,182,76,0.18)" }}
        >
          Opening
        </span>
        <span className="absolute bottom-[6%] -left-[2%] font-chess-display font-black italic uppercase leading-[0.85] text-[11vw] whitespace-nowrap select-none pointer-events-none text-chess-cream/[0.05]">
          Endgame
        </span>

        <section className="relative z-10 w-full max-w-[760px] text-center">
          {/* Metadata bar */}
          <div className="flex justify-between items-center border-b border-chess-line pb-3 mb-8">
            <div className="flex items-center gap-[10px]">
              <span className="w-[7px] h-[7px] rounded-full bg-chess-accent chess-pulse-dot" />
              <span className="font-mono text-[11px] tracking-[0.14em] uppercase text-chess-cream/50">
                Archive: any streamer&apos;s Chess.com history
              </span>
            </div>
            <span className="font-mono text-[11px] tracking-[0.14em] text-chess-accent-bright">
              01 // PGN_READY
            </span>
          </div>

          <h1 className="font-chess-display font-black italic uppercase tracking-tight leading-[0.94] text-[clamp(34px,6vw,58px)] mb-4">
            Find Your Games in
            <span className="block text-chess-accent">Their VODs</span>
          </h1>

          <p className="font-body text-chess-cream/60 text-base md:text-lg max-w-[52ch] mx-auto mb-10">
            Enter your <b className="text-chess-text font-semibold">Chess.com</b> username, the streamer&apos;s,
            and where they broadcast. We pull both game histories, find every time you played each other, and
            hand you the exact <b className="text-chess-text font-semibold">VOD timestamp</b> for each one.
          </p>

          <div className="text-left">
            <ChessSearchForm />
          </div>
        </section>
      </main>

      {/* Decorative live-eval rail */}
      <div className="hidden lg:flex fixed right-6 top-1/2 -translate-y-1/2 flex-col items-center gap-[10px] z-10">
        <span className="font-mono text-[9.5px] tracking-[0.16em] text-chess-cream/30" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
          LIVE EVAL
        </span>
        <div className="relative w-[10px] h-[190px] rounded-[5px] bg-chess-cream border border-chess-line overflow-hidden">
          <div className="absolute bottom-0 left-0 right-0 h-[57%] bg-[#14130d]">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-chess-highlight" />
          </div>
        </div>
        <span className="font-mono text-[11px] text-chess-accent-bright">+0.6</span>
      </div>
    </div>
  );
}
