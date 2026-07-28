import GameLandingContent from "./GameLandingContent";
import type { Game } from "@/components/GameSearchForm";

// Server component — reads the optional ?game= preselect on the server so
// deep links (e.g. from results pages) land on the right theme without a flash.
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ game?: string }>;
}) {
  const { game } = await searchParams;
  const initialGame: Game = game === "valorant" ? "valorant" : "chess";

  return <GameLandingContent initialGame={initialGame} />;
}
