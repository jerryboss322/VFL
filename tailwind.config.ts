import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./features/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0B0E14",        // VFL Deep Midnight Ground
        coal: "#131822",       // VFL Card / Section Surface
        graphite: "#1A2230",   // Surface border / elevated card
        line: "#253144",       // Interactive element border
        fog: "#94A3B8",        // Muted Slate Text
        bone: "#F8FAFC",       // Crisp High-Contrast Pure White
        brand: "#00E599",      // VFL Signature Electric Mint
        "brand-dark": "#08281F",// Deep Emerald Glow
        accent: "#00E599",     // VFL Signature Electric Mint Accent
        "accent-cyan": "#00D8F6", // VFL Secondary Cyan
        "accent-gold": "#FFB800", // High-visibility Solar Highlight
        peach: "#00E599",      // Mapped to VFL Electric Mint
        "peach-dim": "#09281E",// Muted mint background
        live: "#FF3366",       // Live In-Play Neon Crimson
        win: "#00E599",        // Winning ledger mint
        loss: "#F43F5E",
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


