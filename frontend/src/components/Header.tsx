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
}

export default function Header({
  minimal = false,
  showSearch = false,
  query = "",
  onSearch,
}: HeaderProps) {
  const [value, setValue] = useState(query);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && value.trim() && onSearch) {
      onSearch(value.trim());
    }
  };

  return (
    <header className="bg-[#0F1923] fixed top-0 w-full h-16 flex items-center px-6 border-b border-[#5b403f]/15 z-50">
      <Link
        href="/"
        className="text-2xl font-black italic tracking-tighter text-[#FF4655] font-headline uppercase"
      >
        SpotMe
      </Link>
    </header>
  );
}
