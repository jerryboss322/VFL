import React from "react";

interface ClubBadgeProps {
  shortName: string;
  name?: string;
  size?: "sm" | "md" | "lg";
}

const ACCENT_SWATCHES: { primary: string; secondary: string }[] = [
  { primary: "#6CA6E8", secondary: "#152236" },
  { primary: "#48B588", secondary: "#132922" },
  { primary: "#D4A359", secondary: "#282116" },
  { primary: "#D97575", secondary: "#2B191C" },
  { primary: "#8A8FD8", secondary: "#1C1E33" },
  { primary: "#55B2B8", secondary: "#13272B" },
  { primary: "#9BA8BC", secondary: "#1B2330" },
  { primary: "#C2847A", secondary: "#291D1D" },
];

function hashCode(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function ClubBadge({ shortName, name, size = "md" }: ClubBadgeProps) {
  const code = (shortName || "CLB").slice(0, 4).toUpperCase();
  const idx = hashCode(name || code) % ACCENT_SWATCHES.length;
  const palette = ACCENT_SWATCHES[idx]!;

  const dimensions =
    size === "lg"
      ? "h-12 w-12 text-xs"
      : size === "sm"
        ? "h-6 w-7 text-[9px]"
        : "h-8 w-8 text-[10px]";

  return (
    <span
      aria-hidden="true"
      className={`relative inline-flex shrink-0 select-none items-center justify-center rounded-control border border-line font-mono font-bold tracking-tighter ${dimensions}`}
      style={{ backgroundColor: palette.secondary }}
    >
      <span
        className="absolute inset-x-0 top-0 h-1 rounded-t-[5px]"
        style={{ backgroundColor: palette.primary }}
      />
      <span className="mt-0.5 text-bone">{code}</span>
    </span>
  );
}
