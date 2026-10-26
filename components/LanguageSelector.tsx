"use client";

import React, { useState, useEffect } from "react";
import type { SupportedLocale } from "@/lib/i18n";

interface LanguageSelectorProps {
  currentLocale?: SupportedLocale;
  onLocaleChange?: (locale: SupportedLocale) => void;
}

const LOCALE_OPTIONS: Array<{ code: SupportedLocale; label: string; flag: string }> = [
  { code: "en", label: "EN", flag: "🇬🇧" },
  { code: "es", label: "ES", flag: "🇪🇸" },
  { code: "de", label: "DE", flag: "🇩🇪" },
  { code: "fr", label: "FR", flag: "🇫🇷" },
  { code: "it", label: "IT", flag: "🇮🇹" },
];

export function LanguageSelector({ currentLocale = "en", onLocaleChange }: LanguageSelectorProps) {
  const [locale, setLocale] = useState<SupportedLocale>(currentLocale);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("vfl_locale") as SupportedLocale | null;
      if (stored && ["en", "es", "de", "fr", "it"].includes(stored)) {
        setLocale(stored);
        if (onLocaleChange) onLocaleChange(stored);
      }
    }
  }, [onLocaleChange]);

  const handleChange = (newLocale: SupportedLocale) => {
    setLocale(newLocale);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem("vfl_locale", newLocale);
      } catch {
        // ignore storage errors
      }
    }
    if (onLocaleChange) onLocaleChange(newLocale);
  };

  return (
    <div className="flex items-center gap-1 rounded bg-line px-2 py-1 text-xs font-mono">
      <span className="text-xs">
        {LOCALE_OPTIONS.find((l) => l.code === locale)?.flag ?? "🌐"}
      </span>
      <select
        value={locale}
        onChange={(e) => handleChange(e.target.value as SupportedLocale)}
        className="bg-transparent text-white font-bold text-[11px] focus-visible:outline-none cursor-pointer"
        aria-label="Select interface language"
      >
        {LOCALE_OPTIONS.map((opt) => (
          <option key={opt.code} value={opt.code} className="bg-graphite text-white">
            {opt.label} ({opt.flag})
          </option>
        ))}
      </select>
    </div>
  );
}
