import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./features/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#070A0F",
        coal: "#0E131F",
        graphite: "#151C2C",
        line: "#1F293D",
        fog: "#94A3B8",
        bone: "#F1F5F9",
        peach: "#38BDF8", // Vibrant Sky Cyan (Stake / Modern Sportsbook primary)
        "peach-dim": "#0C2338",
        live: "#F43F5E",  // Radiant Rose/Crimson for in-play excitement
        win: "#10B981",   // Emerald Neon
        loss: "#EF4444",  // Coral Red
        gold: "#F59E0B",  // Stadium Gold for special odds
        violet: "#8B5CF6",// Cyber Purple for accumulator highlights
      },
      borderRadius: {
        control: "8px",
        card: "14px",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;

