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
      // "Obsidian Gold" — one tactical-HUD palette for the whole app,
      // regardless of which game is selected. No more per-game sub-brands.
      colors: {
        "background":                  "#051424",
        "surface":                     "#051424",
        "surface-dim":                 "#051424",
        "surface-bright":              "#2c3a4c",
        "surface-container-lowest":    "#010f1f",
        "surface-container-low":       "#0d1c2d",
        "surface-container":           "#122131",
        "surface-container-high":      "#1c2b3c",
        "surface-container-highest":   "#273647",
        "surface-variant":             "#273647",
        "surface-tint":                "#ffba20",
        "on-surface":                  "#d4e4fa",
        "on-surface-variant":          "#d5c4ab",
        "on-background":               "#d4e4fa",
        "inverse-surface":             "#d4e4fa",
        "inverse-on-surface":          "#233143",
        "primary":                     "#ffdca1",
        "on-primary":                  "#412d00",
        "primary-container":           "#ffb800",
        "on-primary-container":        "#6b4c00",
        "inverse-primary":             "#7c5800",
        "primary-fixed":               "#ffdea8",
        "primary-fixed-dim":           "#ffba20",
        "on-primary-fixed":            "#271900",
        "on-primary-fixed-variant":    "#5e4200",
        "secondary":                   "#c5c6ce",
        "on-secondary":                "#2e3037",
        "secondary-container":         "#45464d",
        "on-secondary-container":      "#b4b4bc",
        "secondary-fixed":             "#e2e2ea",
        "secondary-fixed-dim":         "#c5c6ce",
        "on-secondary-fixed":          "#191b21",
        "on-secondary-fixed-variant":  "#45464d",
        "tertiary":                    "#e0e0e6",
        "on-tertiary":                 "#2f3035",
        "tertiary-container":          "#c4c4ca",
        "on-tertiary-container":       "#505156",
        "tertiary-fixed":              "#e2e2e8",
        "tertiary-fixed-dim":          "#c6c6cc",
        "on-tertiary-fixed":           "#1a1c20",
        "on-tertiary-fixed-variant":   "#45474b",
        "outline":                     "#9e8f78",
        "outline-variant":             "#514532",
        "error":                       "#ffb4ab",
        "error-container":             "#93000a",
        "on-error":                    "#690005",
        "on-error-container":          "#ffdad6",
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
