"use client";

import Link from "next/link";
import { useState } from "react";

interface HeaderProps {
  /** If true, hides the back-link and rescan search (used on the scanning page) */
  minimal?: boolean;
  /** If provided, renders a rescan input in the header */
  showSearch?: boolean;
  /** Current value of the header search input */
  query?: string;
  /** Called when the user submits the header search */
  onSearch?: (q: string) => void;
  /** When set, renders a small "back" link (e.g. back to the game-picker hub) */
  backHref?: string;
  backLabel?: string;
}

export default function Header({
  minimal = false,
  showSearch = false,
  query = "",
  onSearch,
  backHref,
  backLabel = "← Back to Search",
}: HeaderProps) {
  const [value, setValue] = useState(query);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && value.trim() && onSearch) {
      onSearch(value.trim());
    }
  };

  return (
    <header className="w-full top-0 sticky z-50 bg-surface/90 backdrop-blur-md border-b border-outline-variant">
      <div className="flex justify-between items-center w-full px-6 py-4 max-w-[1440px] mx-auto">
        <div className="flex items-center gap-4">
          <Link href="/" className="font-headline text-2xl font-bold tracking-tighter text-primary uppercase">
            SpotMe
          </Link>
          {backHref && !minimal && (
            <Link
              href={backHref}
              className="font-label text-[11px] uppercase tracking-[0.2em] text-primary/80 hover:text-primary transition-colors ml-2"
            >
              {backLabel}
            </Link>
          )}
        </div>

        {showSearch && !minimal && (
          <div className="input-accent relative hidden md:block w-72">
            <input
              type="text"
              defaultValue={query}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Rescan a different username..."
              className="w-full bg-transparent border-none text-sm text-on-surface font-body py-2 focus:ring-0 placeholder:opacity-30"
            />
            <div className="corner-notch" />
          </div>
        )}
      </div>
    </header>
  );
}
