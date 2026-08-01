import { redirect } from "next/navigation";
import { searchDota2Matchup, type ChessPlatform, type Dota2MatchupResponse } from "@/lib/api";
import ResultsContent from "./ResultsContent";

const VALID_PLATFORMS = new Set<ChessPlatform>(["twitch", "kick", "youtube"]);

// Async server component — fetches matchup data on the server before
// rendering. The client shell (ResultsContent) receives pre-fetched data as
// props so there is no client-side loading spinner or waterfall.
export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ viewer?: string; streamer?: string; platform?: string; channel?: string }>;
}) {
  const { viewer = "", streamer = "", platform = "", channel = "" } = await searchParams;
  if (!viewer.trim() || !streamer.trim() || !channel.trim() || !VALID_PLATFORMS.has(platform as ChessPlatform)) {
    redirect("/?game=dota2");
  }
  const validPlatform = platform as ChessPlatform;

  let data: Dota2MatchupResponse = { results: [], total: 0, vods_scanned: 0 };
  let apiError: string | null = null;

  try {
    data = await searchDota2Matchup({
      platform: validPlatform,
      viewerDotaId: viewer,
      streamerDotaId: streamer,
      channel,
    });
  } catch (err) {
    apiError = err instanceof Error ? err.message : "Failed to reach backend";
  }

  if (apiError) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-[560px] card-frame clip-18">
          <div className="card-panel clip-17 p-10 text-center">
            <div className="alert-wash" />
            <span className="font-label text-[11px] tracking-[0.2em] uppercase text-alert">
              Search Failed
            </span>
            <p className="font-headline text-xl md:text-2xl text-ink mt-4 mb-7">
              {apiError}
            </p>
            <a
              href="/?game=dota2"
              className="inline-block clip-16 bg-gradient-to-r from-steel to-white text-ink-inverse font-headline font-bold text-sm uppercase tracking-[0.14em] px-8 py-3.5 hover:opacity-90 transition-opacity"
            >
              Try Again
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <ResultsContent
      viewer={viewer}
      streamer={streamer}
      platform={validPlatform}
      channel={channel}
      initialData={data}
    />
  );
}
