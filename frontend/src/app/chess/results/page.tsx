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
          <div className="relative card-panel clip-17 p-10 text-left overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-alert" />

            <div className="inline-flex items-center gap-2 rounded-full bg-alert/[0.16] px-3.5 py-1.5 mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-alert" />
              <span className="font-label text-[10px] tracking-[0.12em] text-alert uppercase">
                Search Failed
              </span>
            </div>

            <h1 className="font-headline font-bold text-xl text-ink uppercase mb-2">
              We couldn&apos;t complete that search
            </h1>
            <p className="font-body text-sm text-ink-dim leading-relaxed mb-5">
              Something went wrong reaching the chess.com or VOD platform APIs. Details below.
            </p>

            <div className="clip-8 bg-input px-3.5 py-3 mb-7">
              <span className="font-mono text-xs text-ink-dim break-words">{apiError}</span>
            </div>

            <a
              href="/?game=chess"
              className="block text-center clip-16 bg-gradient-to-r from-steel to-white text-ink-inverse font-headline font-bold text-sm uppercase tracking-[0.14em] px-8 py-3.5 hover:opacity-90 transition-opacity"
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
