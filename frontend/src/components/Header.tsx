"use client";

import Link from "next/link";
import { useState } from "react";

interface HeaderProps {
  /** If true, hides the main nav links (used on scanning page) */
  minimal?: boolean;
  /** If provided, renders a search input in the center of the header */
  showSearch?: boolean;
  /** Current value of the header search input */
  query?: string;
  /** Called when the user submits the header search */
  onSearch?: (q: string) => void;
  /** Which sub-brand this header appears on — tints the bar and wordmark */
  theme?: "valorant" | "chess";
  /** When set, renders a small "back" link (e.g. back to the game-picker hub) */
  backHref?: string;
  backLabel?: string;
}

const THEME = {
  valorant: { bg: "bg-[#0F1923]", border: "border-[#5b403f]/15", accent: "text-[#FF4655]" },
  chess:    { bg: "bg-chess-bg",  border: "border-chess-line",   accent: "text-chess-accent" },
} as const;

export default function Header({
  minimal = false,
  showSearch = false,
  query = "",
  onSearch,
  theme = "valorant",
  backHref,
  backLabel = "← Choose Game",
}: HeaderProps) {
  const [value, setValue] = useState(query);
  const t = THEME[theme];

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && value.trim() && onSearch) {
      onSearch(value.trim());
    }
  };

  return (
    <header
      className={`${t.bg} fixed top-0 w-full h-16 flex items-center justify-between px-6 border-b ${t.border} z-50`}
    >
      <div className="flex items-center gap-5">
        <Link
          href="/"
          className={`text-2xl font-black italic tracking-tighter font-headline uppercase ${t.accent}`}
        >
          SpotMe
        </Link>
        {backHref && !minimal && (
          <Link
            href={backHref}
            className="font-label text-[11px] uppercase tracking-[0.2em] text-on-surface/50 hover:text-on-surface transition-colors"
          >
            {backLabel}
          </Link>
        )}
      </div>

      {showSearch && !minimal && (
        <input
          type="text"
          defaultValue={query}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Rescan a different username..."
          className="hidden md:block w-72 bg-black/20 border-none text-sm text-on-background placeholder:text-on-surface/30 font-body rounded px-4 py-2 focus:ring-0 focus:outline-none"
        />
      )}
    </header>
  );
}
