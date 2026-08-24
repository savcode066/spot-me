import type { Metadata } from "next";
import GameLandingContent from "./GameLandingContent";
import type { Game } from "@/components/GameSearchForm";

// The ?game= param only preselects a theme client-side — it's the same page
// for every value, so all variants canonicalize to the bare "/" URL.
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

// Server component — reads the optional ?game= preselect on the server so
// deep links (e.g. from results pages) land on the right theme without a flash.
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ game?: string }>;
}) {
  const { game } = await searchParams;
  const initialGame: Game =
    game === "valorant" ? "valorant" : game === "dota2" ? "dota2" : "chess";

  return <GameLandingContent initialGame={initialGame} />;
}
