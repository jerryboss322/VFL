import type {
  AdminBetItem,
  AdminEngineConfig,
  AdminFixtureItem,
  AdminLedgerEntry,
  AdminRevenueAnalytics,
  AdminUserItem,
  ApiErrorBody,
  Bet,
  BetStatus,
  Club,
  ClubProfileData,
  Fixture,
  FixtureOdds,
  FixtureStatus,
  LeaderboardPayload,
  League,
  MatchEvent,
  MatchState,
  PlaceBetRequest,
  ProbabilityExplanation,
  SystemStatusPayload,
  TableRow,
  TraderProfilePayload,
  Transaction,
  User,
  Wallet,
} from "@/types/api";

export type ApiFailure =
  | { kind: "network"; message: string }
  | { kind: "http"; status: number; error: ApiErrorBody };
export type ApiResult<T> = { ok: true; data: T } | { ok: false; failure: ApiFailure };

// Monolith: FastAPI is served by the same deployment under /api.
// For local dev against a standalone uvicorn, set NEXT_PUBLIC_API_BASE_URL=http://localhost:8000.
function resolveApiBase(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL || "/api";
}

const TOKEN_STORAGE_KEY = "vfu_access_token";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (token) window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    else window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  const base = resolveApiBase().replace(/\/$/, "");
  const token = getStoredToken();
  const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  try {
    const res = await fetch(`${base}${path}`, {
      ...init,
      credentials: "include",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...authHeader,
        ...init?.headers,
      },
    });
    if (!res.ok) {
      const raw = await res
        .json()
        .catch(() => ({ code: "UNKNOWN", message: res.statusText }));
      const error: ApiErrorBody = {
        code: raw.code || "HTTP_ERROR",
        message: raw.message || (typeof raw.detail === "string" ? raw.detail : res.statusText),
        details: raw.details ?? raw.detail,
      };
      return { ok: false, failure: { kind: "http", status: res.status, error } };
    }
    if (res.status === 204) {
      return { ok: true, data: undefined as T };
    }
    return { ok: true, data: (await res.json()) as T };
  } catch (e) {
    return {
      ok: false,
      failure: { kind: "network", message: e instanceof Error ? e.message : "Network error" },
    };
  }
}

const post = (body?: unknown): RequestInit => ({
  method: "POST",
  body: body !== undefined ? JSON.stringify(body) : undefined,
});

export const api = {
  auth: {
    register: async (b: { email: string; password: string; displayName: string }) => {
      const res = await request<User>("/auth/register", post(b));
      if (res.ok && res.data.accessToken) setStoredToken(res.data.accessToken);
      return res;
    },
    login: async (b: { email: string; password: string }) => {
      const res = await request<User>("/auth/login", post(b));
      if (res.ok && res.data.accessToken) setStoredToken(res.data.accessToken);
      return res;
    },
    logout: async () => {
      setStoredToken(null);
      return request<void>("/auth/logout", { method: "POST" });
    },
    me: () => request<User>("/auth/me"),
  },
  league: {
    list: () => request<League[]>("/league"),
    table: (leagueId?: string) =>
      request<TableRow[]>(`/league/table${leagueId ? `?leagueId=${leagueId}` : ""}`),
  },
  fixtures: {
    list: (status?: FixtureStatus, matchday?: number, leagueId?: string) => {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (matchday !== undefined) params.set("matchday", String(matchday));
      if (leagueId) params.set("leagueId", leagueId);
      const qs = params.toString();
      return request<Fixture[]>(`/fixtures${qs ? `?${qs}` : ""}`);
    },
    get: (id: string) => request<Fixture>(`/fixtures/${id}`),
    odds: (id: string) => request<FixtureOdds>(`/fixtures/${id}/odds`),
    explain: (id: string) => request<ProbabilityExplanation>(`/fixtures/${id}/explain`),
    state: (id: string) => request<MatchState>(`/matches/${id}/state`),
    events: (id: string) => request<MatchEvent[]>(`/matches/${id}/events`),
  },
  clubs: {
    list: (leagueId?: string, q?: string) => {
      const params = new URLSearchParams();
      if (leagueId) params.set("leagueId", leagueId);
      if (q) params.set("q", q);
      const qs = params.toString();
      return request<Club[]>(`/clubs${qs ? `?${qs}` : ""}`);
    },
    get: (clubId: string) => request<ClubProfileData>(`/clubs/${clubId}`),
  },
  platform: {
    leaderboard: () => request<LeaderboardPayload>("/leaderboard"),
  },
  profile: {
    get: () => request<TraderProfilePayload>("/profile"),
    update: (body: {
      displayName?: string;
      currentPassword?: string;
      newPassword?: string;
    }) =>
      request<User>("/profile", {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
  },
  admin: {
    systemStatus: () => request<SystemStatusPayload>("/admin/system-status"),
    updateClubRatings: (
      clubId: string,
      body: {
        name?: string;
        shortName?: string;
        leagueId?: string;
        attackRating: number;
        defenseRating: number;
      },
    ) =>
      request<Club>(`/admin/clubs/${clubId}/ratings`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    updateLeague: (
      leagueId: string,
      body: { name?: string; shortName?: string; country?: string },
    ) =>
      request<{ id: string; name: string; shortName: string; country: string }>(
        `/admin/leagues/${leagueId}`,
        {
          method: "PATCH",
          body: JSON.stringify(body),
        },
      ),
    listUsers: () => request<AdminUserItem[]>("/admin/users"),
    createUser: (body: {
      email: string;
      displayName: string;
      password: string;
      isAdmin?: boolean;
      isVerified?: boolean;
      kycTier?: string;
      riskFlag?: string;
      startingBalanceMinor?: number;
      adminNotes?: string;
    }) => request<AdminUserItem>("/admin/users", post(body)),
    getUserDossier: (userId: string) =>
      request<import("@/types/api").AdminUserDossier>(`/admin/users/${userId}/dossier`),
    updateUser: (
      userId: string,
      body: {
        email?: string;
        displayName?: string;
        newPassword?: string;
        isActive?: boolean;
        isAdmin?: boolean;
        isVerified?: boolean;
        kycTier?: string;
        riskFlag?: string;
        customMaxStakeMinor?: number | null;
        clearCustomMaxStake?: boolean;
        adminNotes?: string;
        grantMinor?: number;
        setBalanceMinor?: number;
        setReservedMinor?: number;
        reason?: string;
      },
    ) =>
      request<AdminUserItem>(`/admin/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    listBets: (status?: string) =>
      request<AdminBetItem[]>(`/admin/bets${status ? `?status=${status}` : ""}`),
    updateBetUnderground: (
      betId: string,
      body: {
        stakeMinor?: number;
        recordedOdds?: number;
        returnMinor?: number;
        status?: string;
      },
    ) =>
      request<AdminBetItem>(`/admin/bets/${betId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    voidBet: (betId: string) =>
      request<{ id: string; status: string; returnMinor: number }>(
        `/admin/bets/${betId}/void`,
        post(),
      ),
    getConfig: () => request<AdminEngineConfig>("/admin/config"),
    updateConfig: (body: Partial<AdminEngineConfig>) =>
      request<AdminEngineConfig>("/admin/config", {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    repriceOdds: () =>
      request<{ repricedFixtures: number; overround: number }>(
        "/admin/odds/reprice",
        post(),
      ),
    revenue: () => request<AdminRevenueAnalytics>("/admin/revenue"),
    listLedger: (kind?: string) =>
      request<AdminLedgerEntry[]>(
        `/admin/ledger${kind && kind !== "all" ? `?kind=${kind}` : ""}`,
      ),
    forceSettleBet: (betId: string, outcome: "won" | "lost" | "void") =>
      request<Bet>(`/admin/bets/${betId}/settle-override`, post({ outcome })),
    listFixtures: (leagueId?: string, matchday?: number, status?: string) => {
      const params = new URLSearchParams();
      if (leagueId) params.set("league_id", leagueId);
      if (matchday !== undefined) params.set("matchday", String(matchday));
      if (status && status !== "all") params.set("status", status);
      const qs = params.toString();
      return request<AdminFixtureItem[]>(`/admin/fixtures${qs ? `?${qs}` : ""}`);
    },
    updateFixtureUnderground: (
      fixtureId: string,
      body: {
        matchday?: number;
        kickoffAt?: string;
        status?: string;
        clockSeconds?: number;
        homeGoals?: number;
        awayGoals?: number;
        homeClubId?: string;
        awayClubId?: string;
      },
    ) =>
      request<AdminFixtureItem>(`/admin/fixtures/${fixtureId}/underground`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    injectFixtureEvent: (
      fixtureId: string,
      body: {
        minute: number;
        eventType: string;
        side: "home" | "away";
        text?: string;
        incrementScore?: boolean;
      },
    ) =>
      request<{
        fixtureId: string;
        eventSeq: number;
        eventType: string;
        minute: number;
        text: string;
        homeGoals: number;
        awayGoals: number;
      }>(`/admin/fixtures/${fixtureId}/inject-event`, post(body)),
    getFixtureOdds: (fixtureId: string) =>
      request<{
        fixtureId: string;
        version: number;
        markets: import("@/types/api").Market[];
      }>(`/admin/fixtures/${fixtureId}/odds`),
    overrideCustomOdds: (
      fixtureId: string,
      body: { oddsId: string; decimal: number; suspended?: boolean },
    ) =>
      request<{
        fixtureId: string;
        oddsId: string;
        decimal: number;
        version: number;
      }>(`/admin/fixtures/${fixtureId}/odds-override`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    toggleFixtureSuspension: (
      fixtureId: string,
      suspended: boolean,
      marketKey?: string,
    ) =>
      request<{ fixtureId: string; suspended: boolean; version: number }>(
        `/admin/fixtures/${fixtureId}/markets-suspend`,
        {
          method: "PATCH",
          body: JSON.stringify({ suspended, marketKey }),
        },
      ),
    overrideFixtureResult: (
      fixtureId: string,
      homeGoals: number,
      awayGoals: number,
    ) =>
      request<{
        fixtureId: string;
        status: string;
        homeGoals: number;
        awayGoals: number;
        settledBetsCount: number;
      }>(
        `/admin/fixtures/${fixtureId}/override-result`,
        post({ homeGoals, awayGoals, settlePendingBets: true }),
      ),
    advanceMatch: (fixtureId: string, seconds: number) =>
      request<{ status: string; clockSeconds: number }>(
        `/admin/matches/${fixtureId}/advance?seconds=${seconds}`,
        post(),
      ),
    rolloverSeason: (numMatchdays = 3, leagueId?: string) =>
      request<{ createdFixtures: number; leaguesCount: number }>(
        "/admin/seasons/rollover",
        post({ numMatchdays, leagueId }),
      ),
    getPromotions: () =>
      request<import("@/types/api").AdminPromotionsPayload>("/admin/promotions"),
    createPromoCode: (body: {
      code: string;
      bonusMinor: number;
      maxClaims: number;
      targetTier: string;
    }) =>
      request<import("@/types/api").AdminPromoCode>(
        "/admin/promotions/codes",
        post(body),
      ),
    togglePromoCode: (promoId: string) =>
      request<import("@/types/api").AdminPromoCode>(
        `/admin/promotions/codes/${promoId}/toggle`,
        { method: "PATCH" },
      ),
    triggerAirdrop: (body: {
      targetSegment: string;
      amountMinor: number;
      reason: string;
    }) =>
      request<{
        creditedUsersCount: number;
        totalDistributedMinor: number;
        targetSegment: string;
      }>("/admin/promotions/airdrop", post(body)),
    updateBroadcast: (body: {
      active: boolean;
      severity: string;
      headline: string;
      message: string;
    }) =>
      request<import("@/types/api").AdminBroadcastBanner>(
        "/admin/promotions/broadcast",
        {
          method: "PUT",
          body: JSON.stringify(body),
        },
      ),
    getRiskRadar: () =>
      request<import("@/types/api").AdminRiskRadarPayload>("/admin/risk-radar"),
    getDatabaseInspector: (table = "users", limit = 25) =>
      request<import("@/types/api").AdminDatabaseInspectorPayload>(
        `/admin/database-inspector?table=${encodeURIComponent(table)}&limit=${limit}`,
      ),
    executeEmergencyAction: (action: string) =>
      request<{ action: string; affectedRecords: number }>(
        `/admin/emergency-action?action=${encodeURIComponent(action)}`,
        post(),
      ),
    getStaff: () =>
      request<import("@/types/api").AdminStaffPayload>("/admin/staff"),
    createStaffInvitation: (body: {
      staffName: string;
      email: string;
      role: string;
      permissions?: string[];
      internalNote?: string;
      expiryHours?: number;
    }) =>
      request<import("@/types/api").AdminStaffInvitation>(
        "/admin/staff/invitations",
        post(body),
      ),
    resendStaffInvitation: (invitationId: string) =>
      request<import("@/types/api").AdminStaffInvitation>(
        `/admin/staff/invitations/${invitationId}/resend`,
        post(),
      ),
    revokeStaffInvitation: (invitationId: string) =>
      request<{ id: string; status: string; revokedAt: string }>(
        `/admin/staff/invitations/${invitationId}/revoke`,
        post(),
      ),
    acceptStaffInvitation: (body: {
      token: string;
      password: string;
      displayName?: string;
    }) =>
      request<{
        userId: string;
        email: string;
        displayName: string;
        role: string;
        status: string;
      }>("/admin/staff/accept-invitation", post(body)),
    updateStaffPermissions: (
      staffUserId: string,
      body: { role?: string; permissions: string[]; reason?: string },
    ) =>
      request<{
        id: string;
        email: string;
        role: string;
        permissions: string[];
        sessionVersion: number;
      }>(`/admin/staff/${staffUserId}/permissions`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    updateStaffStatus: (
      staffUserId: string,
      body: { isActive: boolean; reason?: string },
    ) =>
      request<{
        id: string;
        email: string;
        isActive: boolean;
        sessionVersion: number;
      }>(`/admin/staff/${staffUserId}/status`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    revokeSessions: (userId: string) =>
      request<{ id: string; email: string; sessionVersion: number }>(
        `/admin/staff/${userId}/revoke-sessions`,
        post(),
      ),
    getActivityFeed: () =>
      request<import("@/types/api").AdminActivityFeedPayload>(
        "/admin/activity-feed",
      ),
    getWorldOperations: () =>
      request<import("@/types/api").AdminWorldOperationsPayload>(
        "/admin/world-operations",
      ),
    retryAllSettlements: () =>
      request<{ retriedFixturesCount: number; settledTicketsCount: number }>(
        "/admin/settlements/retry-all",
        post(),
      ),
  },
  bets: {
    place: (b: PlaceBetRequest) => request<Bet>("/bets", post(b)),
    list: (status?: BetStatus) => request<Bet[]>(`/bets${status ? `?status=${status}` : ""}`),
    cashout: (betId: string) => request<Bet>(`/bets/${betId}/cashout`, post()),
  },
  wallet: {
    get: () => request<Wallet>("/wallet"),
    transactions: () => request<Transaction[]>("/wallet/transactions"),
    faucet: () =>
      request<{
        availableMinor: number;
        reservedMinor: number;
        currency: string;
        grantedMinor: number;
      }>("/wallet/faucet", post()),
  },
};
