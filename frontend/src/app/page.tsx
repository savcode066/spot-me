import Header from "@/components/Header";
import SearchForm from "@/components/SearchForm";

// Server component — all static markup rendered on the server.
// Only <SearchForm /> (the interactive input) ships client JS.
export default function LandingPage() {
  return (
    <>
      <Header />

      <main className="relative min-h-[calc(100vh-64px)] mt-16 w-full flex flex-col items-center justify-start pt-16 px-6">
        {/* ── Background decorative elements ── */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary-container/5 rounded-full blur-[120px]" />
          <div className="absolute top-20 right-[10%] opacity-10">
            <span className="font-headline text-[12vw] font-black italic leading-none select-none text-white">
              SEARCH
            </span>
          </div>
          <div className="absolute bottom-20 left-[5%] opacity-10">
            <span className="font-headline text-[12vw] font-black italic leading-none select-none text-[#FF4655]">
              ANALYZE
            </span>
          </div>
        </div>

        {/* ── Central scanner section ── */}
        <section className="relative z-10 w-full max-w-4xl text-center">
          {/* Tactical metadata bar */}
          <div className="flex justify-between items-end mb-4 border-b border-outline-variant/20 pb-2">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-tertiary animate-pulse" />
              <span className="font-label text-[11px] uppercase tracking-[0.2em] text-on-surface/60">
                Targeting: TenZ Content Library
              </span>
            </div>
            <span className="font-label text-[11px] uppercase tracking-[0.2em] text-tertiary">
              02 // SCAN_ACTIVE
            </span>
          </div>

          {/* Hero headline */}
          <h1 className="font-headline text-4xl md:text-6xl font-black italic uppercase tracking-tighter text-on-background mb-3 flex flex-col items-center leading-[0.9]">
            <span>Find Yourself in</span>
            <span className="text-[#FF4655]">TenZ&apos;s Videos</span>
          </h1>

          <p className="font-body text-on-surface/70 text-base md:text-lg max-w-xl mx-auto mb-8 tracking-tight">
            Enter your username to scan for appearances. Our tactical engine
            cross-references match history and kill-feeds across Tenz's entire twitch account.
          </p>

          {/* Interactive search form (client component) */}
          <SearchForm />
        </section>

      </main>

      {/* ── Fixed corner accents ── */}
      <div className="fixed top-20 left-6 w-24 h-24 border-t-2 border-l-2 border-[#FF4655]/30 pointer-events-none" />
      <div className="fixed bottom-6 right-6 w-24 h-24 border-b-2 border-r-2 border-[#FF4655]/30 pointer-events-none" />
      <div className="fixed top-1/4 right-0 w-1 bg-[#FF4655] h-32" />
      <div className="fixed bottom-1/4 left-0 w-1 bg-tertiary h-16" />
    </>
  );
}
