import { redirect } from "next/navigation";
import ChessScanningContent from "./ChessScanningContent";
import type { ChessPlatform } from "@/lib/api";

const VALID_PLATFORMS: ChessPlatform[] = ["twitch", "kick", "youtube"];

// Server component — reads searchParams on the server, same pattern as the
// Valorant scanning page, so the client shell never needs useSearchParams.
export default async function ChessScanningPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string; streamer?: string; platform?: string; channel?: string }>;
}) {
  const { user = "", streamer = "", platform = "", channel = "" } = await searchParams;

  const isValidPlatform = VALID_PLATFORMS.includes(platform as ChessPlatform);
  if (!user.trim() || !streamer.trim() || !channel.trim() || !isValidPlatform) {
    redirect("/chess");
  }

  return (
    <ChessScanningContent
      user={user}
      streamer={streamer}
      platform={platform as ChessPlatform}
      channel={channel}
    />
  );
}
