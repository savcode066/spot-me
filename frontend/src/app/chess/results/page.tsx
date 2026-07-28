import { redirect } from "next/navigation";
import { searchChessMatchup, type ChessMatchupResponse, type ChessPlatform } from "@/lib/api";
import ChessResultsContent from "./ChessResultsContent";

const VALID_PLATFORMS: ChessPlatform[] = ["twitch", "kick", "youtube"];

// Async server component — fetches the matchup data on the server, same
// pattern as the Valorant results page, so there's no client-side waterfall.
export default async function ChessResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string; streamer?: string; platform?: string; channel?: string }>;
}) {
  const { user = "", streamer = "", platform = "", channel = "" } = await searchParams;
  const isValidPlatform = VALID_PLATFORMS.includes(platform as ChessPlatform);

  if (!user.trim() || !streamer.trim() || !channel.trim() || !isValidPlatform) {
    redirect("/?game=chess");
  }

  let data: ChessMatchupResponse = { results: [], total: 0, vods_scanned: 0 };
  let apiError: string | null = null;

  try {
    data = await searchChessMatchup({
      platform: platform as ChessPlatform,
      userChess: user,
      streamerChess: streamer,
      channel,
    });
  } catch (err) {
    apiError = err instanceof Error ? err.message : "Failed to reach the backend";
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
          href="/?game=chess"
          className="inline-flex items-center gap-2 px-6 py-3 font-label font-bold text-sm text-on-primary bg-primary-container"
        >
          Try Again
        </a>
      </main>
    );
  }

  return (
    <ChessResultsContent
      user={user}
      streamer={streamer}
      platform={platform as ChessPlatform}
      channel={channel}
      initialData={data}
    />
  );
}
