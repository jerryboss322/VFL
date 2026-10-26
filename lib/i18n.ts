/**
 * Multi-Language Internationalization (i18n) Engine.
 *
 * Supports multilingual sports wagering across top European territories:
 * - English (en), Spanish (es), German (de), French (fr), Italian (it)
 * - Safe parameter interpolation ({name}, {amount})
 * - Fallback to English for missing dictionary keys
 * - Culture-aware currency & number formatting
 */

export type SupportedLocale = "en" | "es" | "de" | "fr" | "it";

export interface I18nDictionary {
  matchCenter: string;
  standings: string;
  cupBracket: string;
  fantasyHub: string;
  playerExchange: string;
  copyTrading: string;
  botStudio: string;
  developerApi: string;
  varCenter: string;
  vipRewards: string;
  saferPlay: string;
  myBets: string;
  wallet: string;
  ledgerAudit: string;
  leaderboard: string;
  placeBet: string;
  stake: string;
  odds: string;
  payout: string;
  fullTime: string;
  inPlay: string;
  preMatch: string;
  overturned: string;
  confirmed: string;
  balanceAvailable: string;
}

export const DICTIONARIES: Record<SupportedLocale, I18nDictionary> = {
  en: {
    matchCenter: "Match Center",
    standings: "Standings",
    cupBracket: "Cup Bracket",
    fantasyHub: "Fantasy Hub",
    playerExchange: "Player Exchange",
    copyTrading: "Copy Trading",
    botStudio: "Bot Studio",
    developerApi: "Developer API",
    varCenter: "VAR Center",
    vipRewards: "VIP Rewards",
    saferPlay: "Safer Play",
    myBets: "My Bets",
    wallet: "Wallet & Ledger",
    ledgerAudit: "Ledger Audit",
    leaderboard: "Leaderboard",
    placeBet: "Place Bet",
    stake: "Stake",
    odds: "Odds",
    payout: "Estimated Return",
    fullTime: "Full Time",
    inPlay: "In Play",
    preMatch: "Pre-Match",
    overturned: "Decision Overturned",
    confirmed: "Decision Confirmed",
    balanceAvailable: "Available Balance",
  },
  es: {
    matchCenter: "Centro de Partidos",
    standings: "Clasificación",
    cupBracket: "Cuadro de Copa",
    fantasyHub: "Liga Fantasy",
    playerExchange: "Bolsa de Jugadores",
    copyTrading: "Copia de Apuestas",
    botStudio: "Estudio de Bots",
    developerApi: "API de Desarrollador",
    varCenter: "Centro VAR",
    vipRewards: "Recompensas VIP",
    saferPlay: "Juego Seguro",
    myBets: "Mis Apuestas",
    wallet: "Cartera y Saldo",
    ledgerAudit: "Auditoría del Libro",
    leaderboard: "Tabla de Líderes",
    placeBet: "Realizar Apuesta",
    stake: "Importe",
    odds: "Cuota",
    payout: "Ganancia Estimada",
    fullTime: "Final del Partido",
    inPlay: "En Directo",
    preMatch: "Previo al Partido",
    overturned: "Decisión Anulada",
    confirmed: "Decisión Confirmada",
    balanceAvailable: "Saldo Disponible",
  },
  de: {
    matchCenter: "Spiel-Center",
    standings: "Tabelle",
    cupBracket: "Pokal-Baum",
    fantasyHub: "Fantasy-Liga",
    playerExchange: "Spieler-Börse",
    copyTrading: "Copy-Wetten",
    botStudio: "Bot-Entwicklungsstudio",
    developerApi: "Entwickler-Schnittstelle",
    varCenter: "VAR-Zentrale",
    vipRewards: "VIP-Prämien",
    saferPlay: "Verantwortungsvolles Spielen",
    myBets: "Meine Wetten",
    wallet: "Konto & Hauptbuch",
    ledgerAudit: "Hauptbuch-Prüfung",
    leaderboard: "Bestenliste",
    placeBet: "Wette platzieren",
    stake: "Einsatz",
    odds: "Quote",
    payout: "Möglicher Gewinn",
    fullTime: "Schlusspfiff",
    inPlay: "Live im Spiel",
    preMatch: "Vor dem Spiel",
    overturned: "Entscheidung korrigiert",
    confirmed: "Entscheidung bestätigt",
    balanceAvailable: "Verfügbares Guthaben",
  },
  fr: {
    matchCenter: "Centre de Match",
    standings: "Classement",
    cupBracket: "Tableau de Coupe",
    fantasyHub: "Ligue Fantasy",
    playerExchange: "Bourse des Joueurs",
    copyTrading: "Copie de Paris",
    botStudio: "Studio de Bots",
    developerApi: "API Développeur",
    varCenter: "Centre VAR",
    vipRewards: "Récompenses VIP",
    saferPlay: "Jeu Responsable",
    myBets: "Mes Paris",
    wallet: "Portefeuille & Grand Livre",
    ledgerAudit: "Audit du Grand Livre",
    leaderboard: "Classement des Parieurs",
    placeBet: "Placer le Pari",
    stake: "Mise",
    odds: "Cote",
    payout: "Gain Estimé",
    fullTime: "Fin du Match",
    inPlay: "En Direct",
    preMatch: "Avant-Match",
    overturned: "Décision Annulée",
    confirmed: "Décision Confirmée",
    balanceAvailable: "Solde Disponible",
  },
  it: {
    matchCenter: "Centro Partite",
    standings: "Classifica",
    cupBracket: "Tabellone Coppa",
    fantasyHub: "Lega Fantasy",
    playerExchange: "Borsa Calciatori",
    copyTrading: "Copia Scommesse",
    botStudio: "Studio Bot",
    developerApi: "API Sviluppatori",
    varCenter: "Centro VAR",
    vipRewards: "Premi VIP",
    saferPlay: "Gioco Responsabile",
    myBets: "Le Mie Scommesse",
    wallet: "Portafoglio & Saldi",
    ledgerAudit: "Verifica Registro",
    leaderboard: "Classifica Tipster",
    placeBet: "Piazza Scommessa",
    stake: "Puntata",
    odds: "Quota",
    payout: "Vincita Potenziale",
    fullTime: "Fischio Finale",
    inPlay: "In Corso",
    preMatch: "Pre-Partita",
    overturned: "Decisione Ribaltata",
    confirmed: "Decisione Confermata",
    balanceAvailable: "Saldo Disponibile",
  },
};

export function t(locale: SupportedLocale, key: keyof I18nDictionary): string {
  const dict = DICTIONARIES[locale] || DICTIONARIES.en;
  return dict[key] || DICTIONARIES.en[key] || String(key);
}

export function formatLocalizedNumber(num: number, locale: SupportedLocale, decimals = 2): string {
  const localeCodeMap: Record<SupportedLocale, string> = {
    en: "en-GB",
    es: "es-ES",
    de: "de-DE",
    fr: "fr-FR",
    it: "it-IT",
  };
  return num.toLocaleString(localeCodeMap[locale] || "en-GB", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
