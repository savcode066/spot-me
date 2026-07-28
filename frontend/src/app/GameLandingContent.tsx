"use client";

import { useState } from "react";
import Header from "@/components/Header";
import GameSearchForm, { type Game } from "@/components/GameSearchForm";

export default function GameLandingContent({ initialGame }: { initialGame: Game }) {
  const [game, setGame] = useState<Game>(initialGame);

  return (
    <div className="min-h-screen flex flex-col text-on-surface selection:bg-primary selection:text-on-primary">
      <Header />

      <main className="flex-grow flex items-center justify-center relative p-6">
        {/* Atmospheric glow behind the module — no decorative fake data */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[120px]" />
        </div>

        <div className="w-full max-w-2xl relative z-10">
          <GameSearchForm game={game} onGameChange={setGame} />
        </div>
      </main>
    </div>
  );
}
