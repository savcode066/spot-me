import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // "Gamer mashup" palette — a neutral steel/silver-on-black chrome
      // carrying the chrome (borders, dividers, primary CTA), plus a small
      // set of functional brand colors (Twitch purple, Discord blurple,
      // Valorant red, a CS2-style rarity ladder) that each carry real
      // meaning (platform, identity, alert, result) rather than being
      // decorative. See frontend design handoff for the source spec.
      colors: {
        "base":            "#121212",
        "panel":           "#1c1c1e",
        "input":           "#222224",
        "input-alt":       "#252527",
        "track":           "#2a2a2c",
        "ink":             "#f2f0ec",
        "ink-inverse":     "#121212",
        "ink-soft":        "#9a9892",
        "ink-dim":         "#8a8782",
        "ink-muted":       "#b9b6ae",
        "ink-faint":       "#68665f",
        "ink-faint-alt":   "#6e6b65",
        "steel":           "#e8e6e0",
        "steel-dark":      "#3a3a3a",
        "twitch":          "#9146FF",
        "twitch-ink":      "#c9a8ff",
        "discord":         "#5865F2",
        "discord-ink":     "#b8c0ff",
        "alert":           "#ff4655",
        "tier-routine":    "#4b7bff",
        "tier-close":      "#9d5cff",
        "tier-clutch":     "#ff4fa3",
      },
      fontFamily: {
        // Display face — a technical, angular grotesk for headlines/wordmark.
        // Deliberately not Space Grotesk (this app's old per-game headline
        // font) so the identity reads as its own thing, not a leftover skin.
        headline: ["Chakra Petch", "sans-serif"],
        // Body copy — legible at high density, still has some character.
        body:     ["Hanken Grotesk", "sans-serif"],
        // Small uppercase labels — monospace reinforces the "data/telemetry" feel.
        label:    ["JetBrains Mono", "ui-monospace", "monospace"],
        mono:     ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      borderRadius: {
        DEFAULT: "0px",
        sm:      "0px",
        md:      "0px",
        lg:      "0px",
        xl:      "0px",
        "2xl":   "0px",
        full:    "9999px",
      },
    },
  },
  plugins: [],
};

export default config;
