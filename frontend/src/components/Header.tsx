import Link from "next/link";

interface HeaderProps {
  /** Where the back link points (e.g. back to the game-picker hub) */
  backHref: string;
  backLabel?: string;
}

// Minimal in-flow back link — this app's chrome is deliberately just the
// search card itself, so there's no persistent site header/nav. This is
// only rendered on screens where the user needs a way back to a new search.
export default function Header({ backHref, backLabel = "← New Search" }: HeaderProps) {
  return (
    <div className="w-full max-w-6xl mx-auto px-6 pt-8">
      <Link
        href={backHref}
        className="font-label text-[11px] uppercase tracking-[0.2em] text-ink-faint hover:text-ink transition-colors"
      >
        {backLabel}
      </Link>
    </div>
  );
}
