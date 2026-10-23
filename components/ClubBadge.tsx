import React, { useState } from "react";
import { CLUB_LOGOS } from "@/lib/clubLogos";

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
  const [imgError, setImgError] = useState(false);
  const code = (shortName || "CLB").trim().toUpperCase();
  const lookupKey = name ? name.toLowerCase() : "";
  const logoUrl = !imgError ? (CLUB_LOGOS[code] || CLUB_LOGOS[lookupKey]) : null;

  const idx = hashCode(name || code) % ACCENT_SWATCHES.length;
  const palette = ACCENT_SWATCHES[idx]!;

  const dimensions =
    size === "lg"
      ? "h-14 w-14 text-xs"
      : size === "sm"
        ? "h-7 w-7 text-[9px]"
        : "h-9 w-9 text-[10px]";

  const imgSize =
    size === "lg"
      ? "h-12 w-12"
      : size === "sm"
        ? "h-5 w-5"
        : "h-7 w-7";

  if (logoUrl) {
    return (
      <span
        aria-hidden="true"
        className={`relative inline-flex shrink-0 select-none items-center justify-center rounded-xl bg-slate-900/60 p-1 border border-white/10 shadow-sm backdrop-blur-xs transition-transform hover:scale-105 ${dimensions}`}
        title={name || code}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt={name || code}
          className={`${imgSize} object-contain filter drop-shadow-md`}
          loading="lazy"
          onError={() => setImgError(true)}
        />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`relative inline-flex shrink-0 select-none items-center justify-center rounded-control border border-line font-mono font-bold tracking-tighter ${dimensions}`}
      style={{ backgroundColor: palette.secondary }}
      title={name || code}
    >
      <span
        className="absolute inset-x-0 top-0 h-1 rounded-t-[5px]"
        style={{ backgroundColor: palette.primary }}
      />
      <span className="mt-0.5 text-bone">{code.slice(0, 4)}</span>
    </span>
  );
}

