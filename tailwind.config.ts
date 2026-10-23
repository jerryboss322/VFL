import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./features/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0F212E",        // Authentic Stake Main Background
        coal: "#1A2C38",       // Authentic Stake Card / Surface
        graphite: "#213743",   // Surface border / secondary
        line: "#2F4553",       // Interactive element border
        fog: "#B1BAD3",        // Clean Slate Text
        bone: "#FFFFFF",       // Crisp Pure White
        peach: "#1475E1",      // Stake Sportsbook Brand Blue
        "peach-dim": "#10355A",
        win: "#00E701",        // Iconic Stake Neon Green
        live: "#FE2247",       // Clean Live Crimson Red
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


