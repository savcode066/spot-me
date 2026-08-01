"use client";

import { useState } from "react";
import GameSearchForm, { type Game } from "@/components/GameSearchForm";

// The search form IS the page — no header, nav, or marketing chrome, just
// the card centered in the viewport.
export default function GameLandingContent({ initialGame }: { initialGame: Game }) {
  const [game, setGame] = useState<Game>(initialGame);

  return (
    <main className="min-h-screen flex items-center justify-center p-6 md:p-10">
      <GameSearchForm game={game} onGameChange={setGame} />
    </main>
  );
}
