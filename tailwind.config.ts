import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Warm paper + deep evergreen ink + signal lime — deliberately not
        // the blue/white SaaS default the reference site uses.
        paper: {
          DEFAULT: "#F7F5EF",
          soft: "#FDFCF9",
          deep: "#EFECE2",
        },
        ink: {
          DEFAULT: "#12211C",
          soft: "#3C4A44",
          faint: "#71807A",
        },
        ever: {
          DEFAULT: "#14532D",
          deep: "#0B3B20",
          night: "#081F13",
          bright: "#1F7A45",
        },
        signal: {
          DEFAULT: "#D7F462",
          deep: "#B8DB37",
        },
        clay: {
          DEFAULT: "#E2725B",
          soft: "#F4CFC5",
        },
      },
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        sans: ["Sora", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      boxShadow: {
        lift: "0 1px 2px rgba(18,33,28,0.06), 0 8px 24px rgba(18,33,28,0.08)",
        float: "0 2px 4px rgba(18,33,28,0.08), 0 20px 48px rgba(18,33,28,0.14)",
        glow: "0 0 0 1px rgba(215,244,98,0.4), 0 8px 40px rgba(215,244,98,0.25)",
      },
      keyframes: {
        rise: {
          "0%": { opacity: "0", transform: "translateY(18px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
        growBar: {
          "0%": { width: "0%" },
          "100%": { width: "var(--bar-w)" },
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
        growBar: "growBar 1s cubic-bezier(0.22, 1, 0.36, 1) both",
        marquee: "marquee 40s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
