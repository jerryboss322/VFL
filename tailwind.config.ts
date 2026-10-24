import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./features/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#121212",        // Bet365 Deep Charcoal Ground
        coal: "#1F2327",       // Bet365 Card / Section Surface
        graphite: "#292E33",   // Surface border / divider
        line: "#383E44",       // Interactive element border
        fog: "#A3ACB5",        // Muted Slate Text
        bone: "#FFFFFF",       // Crisp High-Contrast Pure White
        brand: "#027B5B",      // Iconic Bet365 Deep Forest Green
        "brand-dark": "#0B3E2F",// In-play section header green
        accent: "#F9DC1C",     // Bet365 Signature Sundance Yellow
        "accent-gold": "#FFDF00", // High-visibility odds yellow
        peach: "#F9DC1C",      // Legacy highlight mapped to signature accent
        "peach-dim": "#2B2816",// Muted gold background
        live: "#FE2247",       // Live In-Play Indicator
        win: "#00E701",        // Winning ledger green
        loss: "#ED4245",
      },
      borderRadius: {
        control: "6px",
        card: "8px",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;


