import type { Config } from "tailwindcss";

/**
 * Palette taken from the live inspireambitions.com, not invented.
 *
 * Two sources, and they disagree — the live one wins:
 *   1. Kadence global palette has #E21E51 as palette 1.
 *   2. The `ia-design-fix-3` stylesheet on the live site overrides it, setting
 *      --ia-primary: #0b2239 and --ia-accent: #1a7dc4, and explicitly sweeping
 *      "any hardcoded fashion-red (#e21e51)" out of buttons, links and borders.
 *
 * So the brand as rendered is deep navy + professional azure on near-white,
 * with the lavender-greys from Kadence palette 5–9 as neutrals. #E21E51 is kept
 * only for error and alert states, which is the one role the parent site still
 * leaves it.
 *
 * Token names are unchanged from the previous theme so component classes keep
 * working; only the values moved.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Surfaces — Kadence palette 9 / 8 / white
        paper: {
          DEFAULT: "#F8F9FA",
          soft: "#FFFFFF",
          deep: "#EFEFF5",
        },
        // Text
        ink: {
          DEFAULT: "#0B2239", // --ia-primary; headings
          soft: "#3D4A5C",
          faint: "#6B7A8F",
        },
        // Dark panels and primary buttons ("ever" kept as the token name)
        ever: {
          DEFAULT: "#1A7DC4", // --ia-accent, used for borders/hover accents
          deep: "#14639C", // accent hover
          night: "#0B2239", // --ia-primary, dark panels
          bright: "#1A7DC4", // accent text on light
        },
        // The bright accent. On light surfaces it is a button background and
        // pairs with white text; the tint and wash are for dark panels and
        // light fills respectively, where full-strength azure has no contrast.
        signal: {
          DEFAULT: "#1A7DC4",
          deep: "#14639C",
          tint: "#7CC0EE", // accent text ON navy
          wash: "#E8F2FB", // light azure fill
          mark: "#BEDCF5", // highlighter behind dark text — needs more weight than a fill
        },
        // Alerts only. This is Kadence palette 1, the colour the live site
        // removed from CTAs — reusing it for anything positive would fight the
        // parent brand's own decision.
        clay: {
          DEFAULT: "#E21E51",
          soft: "#FDE7EE",
        },
      },
      fontFamily: {
        // The live site force-applies this stack to body, buttons, inputs and
        // h1–h6 via `ia-batch96-critical-font-css`, so matching it is what makes
        // the tool look like the same property. Lato is the theme's declared
        // font underneath that override — swap it in here if the override is
        // ever removed.
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Arial",
          "sans-serif",
        ],
        display: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Arial",
          "sans-serif",
        ],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        lift: "0 1px 2px rgba(11,34,57,0.06), 0 8px 24px rgba(11,34,57,0.07)",
        float: "0 2px 4px rgba(11,34,57,0.08), 0 20px 48px rgba(11,34,57,0.12)",
        glow: "0 0 0 1px rgba(26,125,196,0.35), 0 8px 28px rgba(26,125,196,0.28)",
      },
      keyframes: {
        rise: {
          "0%": { opacity: "0", transform: "translateY(18px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      animation: {
        rise: "rise 0.6s cubic-bezier(0.22, 1, 0.36, 1) both",
        fadeIn: "fadeIn 0.5s ease both",
        pulseSoft: "pulseSoft 2s ease-in-out infinite",
        marquee: "marquee 40s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
