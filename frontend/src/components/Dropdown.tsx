"use client";

import { useEffect, useRef } from "react";

export interface DropdownOption {
  value: string;
  label: string;
  /** Status-dot color. Also used as the tinted variant's label/chevron color when textColor is omitted. */
  color: string;
  /** Tinted variant only — label + chevron color while this option is selected. */
  textColor?: string;
  /** Tinted variant only — trigger + row background while this option is selected. */
  bgColor?: string;
}

interface DropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  /** "neutral" = steel trigger, uniform ink label (Game selector).
   *  "tinted" = trigger background/label follow the selected option (Platform selector). */
  variant?: "neutral" | "tinted";
  /** Which way the menu unfolds — "up" keeps it inside a card when the trigger sits near the bottom. */
  direction?: "down" | "up";
  ariaLabel: string;
  triggerClassName?: string;
}

// Colors here are per-selection data (brand hex values), not fixed design
// tokens — Tailwind's JIT can't see classes built from runtime values, so
// they're applied as inline styles rather than dynamic class names.
export default function Dropdown({
  options,
  value,
  onChange,
  open,
  onToggle,
  onClose,
  variant = "neutral",
  direction = "down",
  ariaLabel,
  triggerClassName = "px-4 py-3",
}: DropdownProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value) ?? options[0];
  const tinted = variant === "tinted";

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, onClose]);

  const triggerLabelColor = tinted ? selected.textColor ?? selected.color : "#f2f0ec";
  const chevronColor = tinted ? selected.textColor ?? selected.color : "#8a8782";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={onToggle}
        className={`w-full rounded-full flex items-center justify-between gap-2.5 cursor-pointer select-none transition-colors ${triggerClassName} ${
          tinted ? "" : "bg-input-alt hover:bg-[#2d2d31]"
        }`}
        style={tinted ? { background: selected.bgColor } : undefined}
      >
        <span className="flex items-center gap-2.5 min-w-0">
          <span
            className="w-[7px] h-[7px] rounded-full shrink-0"
            style={{ background: selected.color, boxShadow: `0 0 10px ${selected.color}66` }}
          />
          <span
            className="font-body font-semibold text-sm truncate"
            style={{ color: triggerLabelColor }}
          >
            {selected.label}
          </span>
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          className="shrink-0 transition-transform duration-150"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          <path
            d="M2.5 4.5L6 8L9.5 4.5"
            stroke={chevronColor}
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div
          className={`absolute left-0 right-0 z-20 bg-input-alt rounded-[22px] p-1.5 shadow-[0_14px_30px_rgba(0,0,0,.45)] ${
            direction === "up" ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          {options.map((o) => {
            const isSelected = o.value === value;
            const rowColor = isSelected ? (tinted ? o.textColor ?? o.color : "#f2f0ec") : "#b9b6ae";
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  onChange(o.value);
                  onClose();
                }}
                className={`w-full rounded-full px-3.5 py-2.5 flex items-center gap-2.5 text-left cursor-pointer transition-colors hover:bg-white/[0.07] ${
                  isSelected ? "bg-white/[0.05]" : ""
                }`}
              >
                <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: o.color }} />
                <span className="flex-1 font-body font-semibold text-sm truncate" style={{ color: rowColor }}>
                  {o.label}
                </span>
                {isSelected && <span className="diamond-tick w-[7px] h-[7px] shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
