import { redirect } from "next/navigation";
import ScanningContent from "./ScanningContent";
import type { ChessPlatform } from "@/lib/api";

const VALID_PLATFORMS = new Set<ChessPlatform>(["twitch", "kick", "youtube"]);

// Server component — reads searchParams on the server so the client shell
// never needs useSearchParams (eliminates the Suspense boundary requirement).
export default async function ScanningPage({
  searchParams,
}: {
  searchParams: Promise<{ viewer?: string; streamer?: string; platform?: string; channel?: string }>;
}) {
  const { viewer = "", streamer = "", platform = "", channel = "" } = await searchParams;
  if (!viewer.trim() || !streamer.trim() || !channel.trim() || !VALID_PLATFORMS.has(platform as ChessPlatform)) {
    redirect("/?game=dota2");
  }

  return (
    <ScanningContent
      viewer={viewer}
      streamer={streamer}
      platform={platform as ChessPlatform}
      channel={channel}
    />
  );
}
