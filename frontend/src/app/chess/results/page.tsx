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
              href="/?game=chess"
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
    <ChessResultsContent
      user={user}
      streamer={streamer}
      platform={platform as ChessPlatform}
      channel={channel}
      initialData={data}
    />
  );
}
