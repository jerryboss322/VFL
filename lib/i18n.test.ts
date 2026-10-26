import { describe, it, expect } from "vitest";
import { t, formatLocalizedNumber, DICTIONARIES } from "./i18n";

describe("i18n Localization Engine", () => {
  it("translates navigation labels across all supported locales", () => {
    expect(t("en", "matchCenter")).toBe("Match Center");
    expect(t("es", "matchCenter")).toBe("Centro de Partidos");
    expect(t("de", "matchCenter")).toBe("Spiel-Center");
    expect(t("fr", "matchCenter")).toBe("Centre de Match");
    expect(t("it", "matchCenter")).toBe("Centro Partite");
  });

  it("translates betting domain terminology correctly", () => {
    expect(t("es", "placeBet")).toBe("Realizar Apuesta");
    expect(t("de", "placeBet")).toBe("Wette platzieren");
    expect(t("fr", "placeBet")).toBe("Placer le Pari");
    expect(t("it", "placeBet")).toBe("Piazza Scommessa");
  });

  it("formats localized decimal numbers with commas in European locales", () => {
    const formattedDe = formatLocalizedNumber(12500.5, "de", 2);
    // In German / Spanish format, thousands are dots or spaces, decimals are commas
    expect(formattedDe).toContain(",");
  });

  it("verifies dictionary symmetry (all locales contain identical keys)", () => {
    const enKeys = Object.keys(DICTIONARIES.en).sort();
    for (const loc of ["es", "de", "fr", "it"] as const) {
      const locKeys = Object.keys(DICTIONARIES[loc]).sort();
      expect(locKeys).toEqual(enKeys);
    }
  });
});
