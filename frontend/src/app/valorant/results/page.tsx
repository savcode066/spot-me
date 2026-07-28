import { redirect } from "next/navigation";
import { searchValorantMatchup, type ChessPlatform, type ValorantMatchupResponse } from "@/lib/api";
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
    redirect("/?game=valorant");
  }
  const validPlatform = platform as ChessPlatform;

  let data: ValorantMatchupResponse = { results: [], total: 0, vods_scanned: 0 };
  let apiError: string | null = null;

  try {
    data = await searchValorantMatchup({
      platform: validPlatform,
      viewerRiotId: viewer,
      streamerRiotId: streamer,
      channel,
    });
  } catch (err) {
    apiError = err instanceof Error ? err.message : "Failed to reach backend";
  }

  if (apiError) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <span className="font-label text-[11px] tracking-[0.2em] uppercase text-error mb-4">
          Search Failed
        </span>
        <p className="font-headline text-2xl md:text-3xl text-on-surface max-w-lg mb-6">
          {apiError}
        </p>
        <a
          href="/?game=valorant"
          className="inline-flex items-center gap-2 px-6 py-3 font-label font-bold text-sm text-on-primary bg-primary-container"
        >
          Try Again
        </a>
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
