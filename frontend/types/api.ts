export type ISODate = string;
export type Minor = number; // integer minor currency units (simulated)

export interface League {
  id: string;
  name: string;
  shortName: string;
  country: string;
}

export interface Club {
  id: string;
  leagueId?: string | null;
  name: string;
  shortName: string;
  attackRating?: number;
  defenseRating?: number;
}

export interface TableRow {
  position?: number;
  club: Club;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd?: number;
  points: number;
  form?: string[];
}

export type FixtureStatus = "upcoming" | "live" | "completed";
export interface Fixture {
  id: string;
  leagueId?: string | null;
  seasonId?: string;
  matchday: number;
  status: FixtureStatus;
  kickoffAt: ISODate;
  home: Club;
  away: Club;
  homeGoals: number | null;
  awayGoals: number | null;
  clockSeconds: number | null;
}

export interface MatchEvent {
  id: string;
  eventSeq?: number;
  minute: number;
  type: "goal" | "card" | "chance" | "kickoff" | "full_time";
  clubId?: string;
  text: string;
  payload?: {
    side?: "home" | "away" | null;
    club_id?: string | null;
    display_minute?: number;
  };
}

export interface MatchState {
  fixtureId: string;
  status: FixtureStatus;
  clockSeconds: number;
  homeGoals: number;
  awayGoals: number;
  eventVersion: number;
}

export type MarketKey = string;
export type MarketCategory = "result" | "goals" | "combo";
export interface OddsOption {
  oddsId: string;
  version: number;
  outcome: string;
  label: string;
  decimal: number;
  suspended: boolean;
}
export interface Market {
  key: MarketKey;
  category?: MarketCategory;
  label?: string;
  options: OddsOption[];
}
export interface FixtureOdds {
  fixtureId: string;
  version?: number;
  markets: Market[];
}

export interface ProbabilityExplanation {
  favoredClub: string;
  edgePercent: number;
  expectedGoals: {
    home: number;
    away: number;
    total: number;
    firstHalf: number;
    secondHalf: number;
  };
  winProbabilities: {
    home: number;
    draw: number;
    away: number;
    over25: number;
    btts: number;
  };
  mostLikelyScorelines: { score: string; probability: number }[];
  factors: string[];
  homeForm: string[];
  awayForm: string[];
  oddsMovement?: {
    opening: { home: number; draw: number; away: number };
    current: { home: number; draw: number; away: number };
    reason: string;
  };
}

export interface ClubProfileData {
  club: Club;
  league: League | null;
  stats: {
    played: number;
    won: number;
    drawn: number;
    lost: number;
    gf: number;
    ga: number;
    gd: number;
    points: number;
    cleanSheets: number;
    biggestWin: string;
    form: string[];
  };
  fixtures: Fixture[];
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  totalEquityMinor: Minor;
  netProfitMinor: Minor;
  totalBets: number;
  wonBets: number;
  lostBets: number;
  winRate: number;
  badges: string[];
}

export interface DailyChallenge {
  id: string;
  title: string;
  description: string;
  rewardLabel: string;
  target: number;
}

export interface LeaderboardPayload {
  leaderboard: LeaderboardEntry[];
  dailyChallenges: DailyChallenge[];
}

export interface SystemStatusPayload {
  timestamp: string;
  status: string;
  world: {
    leagues: number;
    clubs: number;
    activeSeasons: number;
    totalFixtures: number;
    liveFixtures: number;
    upcomingFixtures: number;
    completedFixtures: number;
    marketsPerFixture: number;
    matchDurationSeconds: number;
    preMatchBreakSeconds: number;
  };
  ledger: {
    wallets: number;
    ledgerEntries: number;
    totalBets: number;
    pendingBets: number;
    settledBets: number;
  };
  integrityChecks: {
    key: string;
    label: string;
    status: "PASS" | "WARN" | "FAIL";
    detail: string;
  }[];
  auditLogs?: {
    id: string;
    action: string;
    targetType: string;
    targetId: string;
    details?: Record<string, unknown> | null;
    createdAt: string;
  }[];
}

export interface PlaceBetRequest {
  selections: { oddsId: string; version: number; fixtureId?: string }[];
  stakeMinor: Minor;
  idempotencyKey: string;
}
export type BetStatus = "pending" | "won" | "lost" | "void";
export interface Bet {
  id: string;
  status: BetStatus;
  stakeMinor: Minor;
  recordedOdds: number;
  placedAt: ISODate;
  settledAt?: ISODate;
  returnMinor?: Minor;
  selections: {
    fixtureId: string;
    market: MarketKey;
    label: string;
    recordedOdds: number;
  }[];
}

export interface Wallet {
  availableMinor: Minor;
  reservedMinor: Minor;
  currency: string;
  simulated: true;
}
export interface Transaction {
  id: string;
  kind: string;
  amountMinor: Minor;
  balanceAfterMinor?: Minor;
  createdAt: ISODate;
  description: string;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  isAdmin?: boolean;
  accessToken?: string;
}

export interface TraderProfilePayload {
  user: {
    id: string;
    email: string;
    displayName: string;
    isAdmin: boolean;
    isVerified?: boolean;
    kycTier?: string;
    riskFlag?: string;
    customMaxStakeMinor?: Minor | null;
    createdAt: string;
  };
  wallet: {
    availableMinor: Minor;
    reservedMinor: Minor;
    totalEquityMinor: Minor;
    netProfitMinor: Minor;
    currency: string;
  };
  stats: {
    totalBets: number;
    pendingBets: number;
    wonBets: number;
    lostBets: number;
    cashedOutBets: number;
    winRate: number;
    roiPercent: number;
    totalStakedMinor: Minor;
    totalReturnedMinor: Minor;
    biggestWinMinor: Minor;
    averageOdds: number;
    currentStreak: number;
    bestStreak: number;
  };
  marketBreakdown: { market: string; count: number }[];
  achievements: {
    id: string;
    title: string;
    description: string;
    unlocked: boolean;
  }[];
}

export interface AdminUserItem {
  id: string;
  email: string;
  displayName: string;
  isActive: boolean;
  isAdmin: boolean;
  isVerified: boolean;
  kycTier: string;
  riskFlag: string;
  customMaxStakeMinor: Minor | null;
  adminNotes: string | null;
  createdAt: string;
  availableMinor: Minor;
  reservedMinor: Minor;
  totalBets: number;
  pendingBets: number;
  wonBets?: number;
  lostBets?: number;
  winRate?: number;
  totalStakedMinor?: Minor;
  totalReturnedMinor?: Minor;
  netPnlMinor?: Minor;
}

export interface AdminUserDossier {
  user: {
    id: string;
    email: string;
    displayName: string;
    isActive: boolean;
    isAdmin: boolean;
    isVerified: boolean;
    kycTier: string;
    riskFlag: string;
    customMaxStakeMinor: Minor | null;
    adminNotes: string | null;
    createdAt: string;
  };
  wallet: {
    availableMinor: Minor;
    reservedMinor: Minor;
    totalEquityMinor: Minor;
    currency: string;
  };
  metrics: {
    totalBets: number;
    pendingBets: number;
    wonBets: number;
    lostBets: number;
    winRate: number;
    totalStakedMinor: Minor;
    totalReturnedMinor: Minor;
    netPnlMinor: Minor;
  };
  bets: {
    id: string;
    status: BetStatus;
    stakeMinor: Minor;
    recordedOdds: number;
    potentialReturnMinor: Minor;
    returnMinor?: Minor | null;
    placedAt: ISODate;
    settledAt?: ISODate | null;
    selections: {
      fixtureId: string;
      market: MarketKey;
      label: string;
      recordedOdds: number;
    }[];
  }[];
  ledger: {
    id: string;
    kind: string;
    amountMinor: Minor;
    balanceAfterMinor: Minor;
    description: string;
    reference: string;
    createdAt: string;
  }[];
  auditHistory: {
    id: string;
    action: string;
    details?: Record<string, unknown> | null;
    createdAt: string;
  }[];
}

export interface AdminBetItem {
  id: string;
  userId: string;
  userDisplayName: string;
  userEmail: string;
  status: BetStatus;
  stakeMinor: Minor;
  recordedOdds: number;
  potentialReturnMinor: Minor;
  returnMinor?: Minor | null;
  placedAt: ISODate;
  settledAt?: ISODate | null;
  selections: {
    fixtureId: string;
    market: MarketKey;
    label: string;
    recordedOdds: number;
  }[];
}

export interface AdminEngineConfig {
  overround: number;
  overroundMarginPercent: number;
  homeAdvantage: number;
  baselineGoals: number;
  simulationSpeedMultiplier: number;
  minStakeMinor: Minor;
  maxStakeMinor: Minor;
  simulationPaused?: boolean;
  maintenanceMode?: boolean;
  readOnlyDiagnosticMode?: boolean;
  matchDurationSeconds?: number;
  preMatchBreakSeconds?: number;
}

export interface AdminRevenueAnalytics {
  totalHandleMinor: Minor;
  settledHandleMinor: Minor;
  totalPayoutsMinor: Minor;
  cashedOutMinor: Minor;
  grossGamingRevenueMinor: Minor;
  holdPercent: number;
  openStakeMinor: Minor;
  maxOpenLiabilityMinor: Minor;
  totalTickets: number;
  openTickets: number;
  settledTickets: number;
  marketBreakdown: {
    market: string;
    selectionsCount: number;
    handleMinor: Minor;
    openLiabilityMinor: Minor;
  }[];
}

export interface AdminLedgerEntry {
  id: string;
  userId: string;
  userEmail: string;
  userDisplayName: string;
  betId?: string | null;
  kind: string;
  amountMinor: Minor;
  balanceAfterMinor: Minor;
  description: string;
  reference: string;
  createdAt: string;
}

export interface AdminFixtureItem {
  id: string;
  matchday: number;
  status: FixtureStatus;
  kickoffAt: ISODate;
  homeGoals: number | null;
  awayGoals: number | null;
  clockSeconds: number | null;
  marketsSuspended: boolean;
  oddsVersion: number;
  home: { id: string; name: string; shortName: string } | null;
  away: { id: string; name: string; shortName: string } | null;
}

export interface AdminPromoCode {
  id: string;
  code: string;
  bonusMinor: Minor;
  maxClaims: number;
  claimedCount: number;
  targetTier: string;
  isActive: boolean;
  createdAt: string;
}

export interface AdminBroadcastBanner {
  active: boolean;
  severity: "info" | "warning" | "critical";
  headline: string;
  message: string;
  updatedAt: string;
}

export interface AdminPromotionsPayload {
  promoCodes: AdminPromoCode[];
  broadcast: AdminBroadcastBanner;
}

export interface AdminRiskRadarPayload {
  whaleAlerts: {
    betId: string;
    userId: string;
    userEmail: string;
    userDisplayName: string;
    riskFlag: string;
    status: BetStatus;
    stakeMinor: Minor;
    recordedOdds: number;
    potentialReturnMinor: Minor;
    legsCount: number;
    placedAt: string;
  }[];
  sharpProfiles: {
    userId: string;
    email: string;
    displayName: string;
    isVerified: boolean;
    kycTier: string;
    riskFlag: string;
    totalBets: number;
    winRate: number;
    roiPercent: number;
    averageOdds: number;
    netPnlMinor: Minor;
    sharpThreatScore: number;
  }[];
  fixtureHotspots: {
    fixtureId: string;
    matchLabel: string;
    openTicketsCount: number;
    openStakeMinor: Minor;
    maxLiabilityMinor: Minor;
  }[];
}

export interface AdminDatabaseInspectorPayload {
  tableCounts: {
    table: string;
    rows: number;
    description: string;
  }[];
  selectedTable: string;
  sampleRows: Record<string, unknown>[];
}

export interface AdminStaffMember {
  id: string;
  email: string;
  displayName: string;
  role: string;
  permissions: string[];
  isActive: boolean;
  isAdmin: boolean;
  sessionVersion: number;
  lastLoginAt: string | null;
  failedLoginAttempts: number;
  adminNotes: string | null;
  createdAt: string;
}

export interface AdminStaffInvitation {
  id: string;
  staffName: string;
  email: string;
  role: string;
  permissions: string[];
  status: "Pending" | "Accepted" | "Expired" | "Revoked" | string;
  internalNote: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  singleUseInviteToken?: string;
}

export interface AdminStaffPayload {
  staff: AdminStaffMember[];
  invitations: AdminStaffInvitation[];
  roleTemplates: Record<string, string[]>;
}

export interface AdminActivityFeedPayload {
  overview: {
    totalUsers: number;
    activeUsers: number;
    onlineUsers: number;
    newRegistrations: number;
    suspendedAccounts: number;
    usersWithOpenBets: number;
    totalVirtualXtsMinor: Minor;
  };
  suspiciousAlerts: {
    id: string;
    alertType: string;
    severity: "CRITICAL" | "HIGH" | "MEDIUM" | string;
    accountEmail: string;
    userId: string;
    reason: string;
    status: string;
    timestamp: string;
  }[];
  liveActivityFeed: {
    id: string;
    category: string;
    event: string;
    actorEmail: string;
    target: string;
    summary: string;
    timestamp: string;
  }[];
}

export interface AdminWorldOperationsPayload {
  leagues: {
    leagueId: string;
    name: string;
    country: string;
    clubsCount: number;
    totalFixtures: number;
    completedFixtures: number;
    leader: {
      id: string;
      name: string;
      shortName: string;
      pts: number;
      gd: number;
      gf: number;
      played: number;
    } | null;
    championsLeagueZone: {
      id: string;
      name: string;
      shortName: string;
      pts: number;
      gd: number;
      gf: number;
      played: number;
    }[];
    relegationZone: {
      id: string;
      name: string;
      shortName: string;
      pts: number;
      gd: number;
      gf: number;
      played: number;
    }[];
  }[];
  stuckSettlements: {
    fixtureId: string;
    matchday: number;
    matchLabel: string;
    pendingTicketsCount: number;
    pendingStakeMinor: Minor;
  }[];
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}
