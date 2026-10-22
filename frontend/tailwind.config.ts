import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./features/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0B0F17",
        coal: "#111723",
        graphite: "#182030",
        line: "#242F44",
        fog: "#8E9BB0",
        bone: "#EDF1F7",
        peach: "#6CA6E8",
        "peach-dim": "#16253A",
        live: "#D96B62",
        win: "#48B588",
        loss: "#D97575",
      },
      borderRadius: {
        control: "6px",
        card: "8px",
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
