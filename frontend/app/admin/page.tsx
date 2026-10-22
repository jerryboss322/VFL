"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/AppContext";
import { ClubBadge } from "@/components/ClubBadge";
import { StatePanel } from "@/components/StatePanel";
import { api } from "@/lib/api/client";
import { formatMinor } from "@/lib/betslip";
import type {
  AdminActivityFeedPayload,
  AdminBetItem,
  AdminDatabaseInspectorPayload,
  AdminEngineConfig,
  AdminFixtureItem,
  AdminLedgerEntry,
  AdminPromotionsPayload,
  AdminRevenueAnalytics,
  AdminRiskRadarPayload,
  AdminStaffPayload,
  AdminUserDossier,
  AdminUserItem,
  AdminWorldOperationsPayload,
  Club,
  Market,
  SystemStatusPayload,
} from "@/types/api";

type AdminTab =
  | "health"
  | "revenue"
  | "matches"
  | "clubs"
  | "users"
  | "risk"
  | "radar"
  | "promotions"
  | "database"
  | "ledger"
  | "engine"
  | "audit"
  | "staff"
  | "activity"
  | "world";

export default function PrivateAdminPage() {
  const { user, leagues, selectedLeagueId, selectedLeague, refreshAccount } = useApp();

  const [email, setEmail] = useState("admin@vfn.eu");
  const [password, setPassword] = useState("yoursister'sfullname");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<AdminTab>("users");
  const [status, setStatus] = useState<SystemStatusPayload | null>(null);
  const [revenue, setRevenue] = useState<AdminRevenueAnalytics | null>(null);
  const [adminFixtures, setAdminFixtures] = useState<AdminFixtureItem[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUserItem[]>([]);
  const [adminBets, setAdminBets] = useState<AdminBetItem[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<AdminLedgerEntry[]>([]);
  const [ledgerKindFilter, setLedgerKindFilter] = useState<string>("all");
  const [engineConfig, setEngineConfig] = useState<AdminEngineConfig | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);

  // =========================================================================
  // TAB 3: Match & Market Underground Desk State
  // =========================================================================
  const [overrideFxId, setOverrideFxId] = useState<string | null>(null);
  const [draftHomeGoals, setDraftHomeGoals] = useState<string>("2");
  const [draftAwayGoals, setDraftAwayGoals] = useState<string>("1");

  // Underground Fixture State Editor
  const [undergroundFx, setUndergroundFx] = useState<AdminFixtureItem | null>(null);
  const [fxDraftMatchday, setFxDraftMatchday] = useState<string>("1");
  const [fxDraftKickoff, setFxDraftKickoff] = useState<string>("");
  const [fxDraftStatus, setFxDraftStatus] = useState<string>("upcoming");
  const [fxDraftClock, setFxDraftClock] = useState<string>("0");
  const [fxDraftHomeGoals, setFxDraftHomeGoals] = useState<string>("0");
  const [fxDraftAwayGoals, setFxDraftAwayGoals] = useState<string>("0");

  // Underground Event Director
  const [injectMinute, setInjectMinute] = useState<string>("45");
  const [injectType, setInjectType] = useState<string>("goal");
  const [injectSide, setInjectSide] = useState<"home" | "away">("home");
  const [injectText, setInjectText] = useState<string>("");
  const [injectIncrement, setInjectIncrement] = useState<boolean>(true);

  // Underground 27-Market Odds Pinning Surgery
  const [oddsSurgeryFx, setOddsSurgeryFx] = useState<AdminFixtureItem | null>(null);
  const [oddsSurgeryMarkets, setOddsSurgeryMarkets] = useState<Market[]>([]);
  const [oddsSurgeryVersion, setOddsSurgeryVersion] = useState<number>(1);
  const [oddsSurgeryLoading, setOddsSurgeryLoading] = useState<boolean>(false);
  const [customOddsDrafts, setCustomOddsDrafts] = useState<Record<string, string>>({});

  // =========================================================================
  // TAB 4: Club & League Underground Editor State
  // =========================================================================
  const [editingClubId, setEditingClubId] = useState<string | null>(null);
  const [draftClubName, setDraftClubName] = useState<string>("");
  const [draftClubShort, setDraftClubShort] = useState<string>("");
  const [draftAtt, setDraftAtt] = useState<string>("1.00");
  const [draftDef, setDraftDef] = useState<string>("1.00");

  // League Underground Metadata Editor
  const [editingLeague, setEditingLeague] = useState<boolean>(false);
  const [draftLeagueName, setDraftLeagueName] = useState<string>("");
  const [draftLeagueShort, setDraftLeagueShort] = useState<string>("");
  const [draftLeagueCountry, setDraftLeagueCountry] = useState<string>("");

  // =========================================================================
  // TAB 5: User Verification, KYC Dossier & Underground Account Editor State
  // =========================================================================
  const [userSearchQuery, setUserSearchQuery] = useState<string>("");
  const [userFilterMode, setUserFilterMode] = useState<
    "all" | "new_signups" | "verified" | "unverified" | "flagged" | "admins"
  >("all");
  const [selectedDossier, setSelectedDossier] = useState<AdminUserDossier | null>(null);
  const [dossierLoading, setDossierLoading] = useState<boolean>(false);

  // Dossier Underground Edit Form
  const [editUserEmail, setEditUserEmail] = useState<string>("");
  const [editUserDisplayName, setEditUserDisplayName] = useState<string>("");
  const [editUserPassword, setEditUserPassword] = useState<string>("");
  const [editUserKycTier, setEditUserKycTier] = useState<string>("UNVERIFIED");
  const [editUserVerified, setEditUserVerified] = useState<boolean>(false);
  const [editUserRiskFlag, setEditUserRiskFlag] = useState<string>("NORMAL");
  const [editUserMaxStakeMajor, setEditUserMaxStakeMajor] = useState<string>("");
  const [editUserNotes, setEditUserNotes] = useState<string>("");
  const [editUserExactBalanceMajor, setEditUserExactBalanceMajor] = useState<string>("");
  const [editUserExactReservedMajor, setEditUserExactReservedMajor] = useState<string>("");
  const [grantMajorAmount, setGrantMajorAmount] = useState<string>("1000");

  // Create New Provisioned User Modal
  const [showCreateUser, setShowCreateUser] = useState<boolean>(false);
  const [newUserEmail, setNewUserEmail] = useState<string>("");
  const [newUserDisplayName, setNewUserDisplayName] = useState<string>("");
  const [newUserPassword, setNewUserPassword] = useState<string>("Trader123!");
  const [newUserKycTier, setNewUserKycTier] = useState<string>("VERIFIED");
  const [newUserRiskFlag, setNewUserRiskFlag] = useState<string>("NORMAL");
  const [newUserIsAdmin, setNewUserIsAdmin] = useState<boolean>(false);
  const [newUserStartBalMajor, setNewUserStartBalMajor] = useState<string>("10000");

  // =========================================================================
  // TAB 6: Ticket Underground Editor State
  // =========================================================================
  const [editingBetId, setEditingBetId] = useState<string | null>(null);
  const [betDraftStakeMajor, setBetDraftStakeMajor] = useState<string>("");
  const [betDraftOdds, setBetDraftOdds] = useState<string>("");
  const [betDraftReturnMajor, setBetDraftReturnMajor] = useState<string>("");
  const [betDraftStatus, setBetDraftStatus] = useState<string>("pending");

  // =========================================================================
  // TAB 8: Engine Config & Season Rollover State
  // =========================================================================
  const [draftOverround, setDraftOverround] = useState<string>("1.045");
  const [draftHomeAdv, setDraftHomeAdv] = useState<string>("1.12");
  const [draftBaseGoals, setDraftBaseGoals] = useState<string>("1.35");
  const [draftSimSpeed, setDraftSimSpeed] = useState<string>("1");
  const [draftMinStakeMajor, setDraftMinStakeMajor] = useState<string>("1");
  const [draftMaxStakeMajor, setDraftMaxStakeMajor] = useState<string>("5000");
  const [rolloverMatchdays, setRolloverMatchdays] = useState<string>("3");

  // =========================================================================
  // TAB 9: Risk Radar, Whale Liability & Sharp Syndicate Detector State
  // =========================================================================
  const [riskRadar, setRiskRadar] = useState<AdminRiskRadarPayload | null>(null);

  // =========================================================================
  // TAB 10: VIP Treasury Airdrop, Promo Bonus Codes & Broadcast Banner State
  // =========================================================================
  const [promotions, setPromotions] = useState<AdminPromotionsPayload | null>(null);
  const [airdropSegment, setAirdropSegment] = useState<string>("ALL");
  const [airdropMajorAmount, setAirdropMajorAmount] = useState<string>("1000");
  const [airdropReason, setAirdropReason] = useState<string>(
    "Executive Matchday Bonus Grant",
  );
  const [newPromoCode, setNewPromoCode] = useState<string>("CHAMPIONS5000");
  const [newPromoMajor, setNewPromoMajor] = useState<string>("5000");
  const [newPromoMaxClaims, setNewPromoMaxClaims] = useState<string>("100");
  const [newPromoTier, setNewPromoTier] = useState<string>("ALL");
  const [bcastActive, setBcastActive] = useState<boolean>(false);
  const [bcastSeverity, setBcastSeverity] = useState<string>("info");
  const [bcastHeadline, setBcastHeadline] = useState<string>(
    "UEFA Matchday Live Trading Window Open",
  );
  const [bcastMessage, setBcastMessage] = useState<string>(
    "All 27 Bivariate Poisson markets are active across 6 European leagues.",
  );

  // =========================================================================
  // TAB 11: Underground Database Table Inspector & Emergency Ops State
  // =========================================================================
  const [dbInspector, setDbInspector] =
    useState<AdminDatabaseInspectorPayload | null>(null);
  const [selectedDbTable, setSelectedDbTable] = useState<string>("users");

  // =========================================================================
  // TAB 13: Staff, Moderators, Granular RBAC & Invitations State
  // =========================================================================
  const [staffData, setStaffData] = useState<AdminStaffPayload | null>(null);
  const [invStaffName, setInvStaffName] = useState<string>("");
  const [invStaffEmail, setInvStaffEmail] = useState<string>("");
  const [invStaffRole, setInvStaffRole] = useState<string>("MODERATOR");
  const [invStaffPerms, setInvStaffPerms] = useState<string[]>([
    "users.view",
    "users.suspend",
    "users.notes",
    "users.sessions",
    "admin.audit_view",
  ]);
  const [invStaffNote, setInvStaffNote] = useState<string>("");
  const [invStaffExpiryHours, setInvStaffExpiryHours] = useState<string>("24");
  const [latestIssuedInviteToken, setLatestIssuedInviteToken] = useState<string | null>(null);

  // Accept Invitation Tester / Onboarding Drawer
  const [acceptTokenInput, setAcceptTokenInput] = useState<string>("");
  const [acceptPasswordInput, setAcceptPasswordInput] = useState<string>("Moderator123!");
  const [acceptDisplayNameInput, setAcceptDisplayNameInput] = useState<string>("");

  // Edit Existing Staff Permissions Drawer
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [editStaffRole, setEditStaffRole] = useState<string>("MODERATOR");
  const [editStaffPerms, setEditStaffPerms] = useState<string[]>([]);
  const [editStaffReason, setEditStaffReason] = useState<string>(
    "Periodic RBAC permission review",
  );

  // =========================================================================
  // TAB 14: Live Activity Monitor & Suspicious Activity Alert Centre State
  // =========================================================================
  const [activityFeed, setActivityFeed] = useState<AdminActivityFeedPayload | null>(null);
  const [activityCategoryFilter, setActivityCategoryFilter] = useState<string>("ALL");

  // =========================================================================
  // TAB 15: World Operations, Promotion/Relegation Preview & Settlement Queue
  // =========================================================================
  const [worldOps, setWorldOps] = useState<AdminWorldOperationsPayload | null>(null);
  const [draftMatchDuration, setDraftMatchDuration] = useState<string>("480");
  const [draftPreMatchBreak, setDraftPreMatchBreak] = useState<string>("240");

  const loadAdminData = useCallback(async () => {
    if (!user?.isAdmin) return;
    setLoading(true);
    const [
      stRes,
      revRes,
      fxRes,
      clRes,
      usRes,
      btRes,
      ldgRes,
      cfgRes,
      radRes,
      prmRes,
      dbRes,
      stfRes,
      actRes,
      wopRes,
    ] = await Promise.all([
      api.admin.systemStatus(),
      api.admin.revenue(),
      api.admin.listFixtures(selectedLeagueId || undefined),
      api.clubs.list(selectedLeagueId || undefined),
      api.admin.listUsers(),
      api.admin.listBets(),
      api.admin.listLedger(ledgerKindFilter),
      api.admin.getConfig(),
      api.admin.getRiskRadar(),
      api.admin.getPromotions(),
      api.admin.getDatabaseInspector(selectedDbTable, 25),
      api.admin.getStaff(),
      api.admin.getActivityFeed(),
      api.admin.getWorldOperations(),
    ]);

    if (!stRes.ok) {
      const f = stRes.failure;
      setError(f.kind === "network" ? f.message : `${f.error.code}: ${f.error.message}`);
    } else {
      setStatus(stRes.data);
      setError(null);
    }
    if (revRes.ok) setRevenue(revRes.data);
    if (fxRes.ok) setAdminFixtures(fxRes.data);
    if (clRes.ok) setClubs(clRes.data);
    if (usRes.ok) setAdminUsers(usRes.data);
    if (btRes.ok) setAdminBets(btRes.data);
    if (ldgRes.ok) setLedgerEntries(ldgRes.data);
    if (radRes.ok) setRiskRadar(radRes.data);
    if (prmRes.ok) {
      setPromotions(prmRes.data);
      setBcastActive(prmRes.data.broadcast.active);
      setBcastSeverity(prmRes.data.broadcast.severity);
      setBcastHeadline(prmRes.data.broadcast.headline);
      setBcastMessage(prmRes.data.broadcast.message);
    }
    if (dbRes.ok) setDbInspector(dbRes.data);
    if (stfRes.ok) setStaffData(stfRes.data);
    if (actRes.ok) setActivityFeed(actRes.data);
    if (wopRes.ok) setWorldOps(wopRes.data);
    if (cfgRes.ok) {
      setEngineConfig(cfgRes.data);
      setDraftOverround(String(cfgRes.data.overround));
      setDraftHomeAdv(String(cfgRes.data.homeAdvantage));
      setDraftBaseGoals(String(cfgRes.data.baselineGoals));
      setDraftSimSpeed(String(cfgRes.data.simulationSpeedMultiplier));
      setDraftMinStakeMajor(String((cfgRes.data.minStakeMinor / 100).toFixed(2)));
      setDraftMaxStakeMajor(String((cfgRes.data.maxStakeMinor / 100).toFixed(2)));
      if (cfgRes.data.matchDurationSeconds) {
        setDraftMatchDuration(String(cfgRes.data.matchDurationSeconds));
      }
      if (cfgRes.data.preMatchBreakSeconds) {
        setDraftPreMatchBreak(String(cfgRes.data.preMatchBreakSeconds));
      }
    }
    setLoading(false);
  }, [user?.isAdmin, selectedLeagueId, ledgerKindFilter, selectedDbTable]);

  useEffect(() => {
    if (user?.isAdmin) {
      void loadAdminData();
    }
  }, [user?.isAdmin, loadAdminData]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    const res = await api.auth.login({ email, password });
    setAuthLoading(false);
    if (!res.ok) {
      const f = res.failure;
      setAuthError(f.kind === "network" ? f.message : `${f.error.code}: ${f.error.message}`);
      return;
    }
    await refreshAccount();
  };

  // =========================================================================
  // USER DOSSIER & VERIFICATION HANDLERS
  // =========================================================================
  const openUserDossier = async (userId: string) => {
    setDossierLoading(true);
    const res = await api.admin.getUserDossier(userId);
    setDossierLoading(false);
    if (res.ok) {
      const d = res.data;
      setSelectedDossier(d);
      setEditUserEmail(d.user.email);
      setEditUserDisplayName(d.user.displayName);
      setEditUserPassword("");
      setEditUserKycTier(d.user.kycTier || "UNVERIFIED");
      setEditUserVerified(Boolean(d.user.isVerified));
      setEditUserRiskFlag(d.user.riskFlag || "NORMAL");
      setEditUserMaxStakeMajor(
        d.user.customMaxStakeMinor !== null
          ? String((d.user.customMaxStakeMinor / 100).toFixed(2))
          : "",
      );
      setEditUserNotes(d.user.adminNotes || "");
      setEditUserExactBalanceMajor(String((d.wallet.availableMinor / 100).toFixed(2)));
      setEditUserExactReservedMajor(String((d.wallet.reservedMinor / 100).toFixed(2)));
    }
  };

  const handleQuickVerifyToggle = async (u: AdminUserItem) => {
    setBannerMsg(null);
    const nextVerified = !u.isVerified;
    const nextTier = nextVerified
      ? u.kycTier === "UNVERIFIED"
        ? "VERIFIED"
        : u.kycTier
      : "UNVERIFIED";
    const res = await api.admin.updateUser(u.id, {
      isVerified: nextVerified,
      kycTier: nextTier,
    });
    if (res.ok) {
      setBannerMsg(
        `${nextVerified ? "✓ Verified" : "Revoked verification for"} ${u.email} (KYC Tier: ${nextTier}).`,
      );
      await loadAdminData();
      if (selectedDossier?.user.id === u.id) {
        await openUserDossier(u.id);
      }
    }
  };

  const handleSaveUserDossier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDossier) return;
    setBannerMsg(null);

    const exactBalMinor =
      editUserExactBalanceMajor.trim() !== ""
        ? Math.round(parseFloat(editUserExactBalanceMajor) * 100)
        : undefined;
    const exactResMinor =
      editUserExactReservedMajor.trim() !== ""
        ? Math.round(parseFloat(editUserExactReservedMajor) * 100)
        : undefined;
    const customMaxMinor =
      editUserMaxStakeMajor.trim() !== ""
        ? Math.round(parseFloat(editUserMaxStakeMajor) * 100)
        : null;

    const res = await api.admin.updateUser(selectedDossier.user.id, {
      email: editUserEmail.trim(),
      displayName: editUserDisplayName.trim(),
      newPassword: editUserPassword.trim() ? editUserPassword.trim() : undefined,
      isVerified: editUserVerified,
      kycTier: editUserKycTier,
      riskFlag: editUserRiskFlag,
      customMaxStakeMinor: customMaxMinor,
      clearCustomMaxStake: editUserMaxStakeMajor.trim() === "",
      adminNotes: editUserNotes,
      setBalanceMinor:
        exactBalMinor !== undefined &&
        !Number.isNaN(exactBalMinor) &&
        exactBalMinor !== selectedDossier.wallet.availableMinor
          ? exactBalMinor
          : undefined,
      setReservedMinor:
        exactResMinor !== undefined &&
        !Number.isNaN(exactResMinor) &&
        exactResMinor !== selectedDossier.wallet.reservedMinor
          ? exactResMinor
          : undefined,
      reason: "Operator underground dossier update",
    });

    if (res.ok) {
      setBannerMsg(`Saved underground profile, KYC verification & wallet surgery for ${res.data.email}.`);
      await Promise.all([loadAdminData(), openUserDossier(selectedDossier.user.id), refreshAccount()]);
    }
  };

  const handleUserGrant = async (userId: string) => {
    setBannerMsg(null);
    const major = parseFloat(grantMajorAmount);
    if (Number.isNaN(major) || major === 0) return;
    const grantMinor = Math.round(major * 100);
    const res = await api.admin.updateUser(userId, {
      grantMinor,
      reason: `Admin treasury credit/debit (${major > 0 ? "+" : ""}${major} XTS)`,
    });
    if (res.ok) {
      setBannerMsg(`Adjusted wallet balance for ${res.data.email} by ${major > 0 ? "+" : ""}${major} XTS.`);
      await Promise.all([loadAdminData(), refreshAccount()]);
      if (selectedDossier?.user.id === userId) {
        await openUserDossier(userId);
      }
    }
  };

  const handleToggleUserStatus = async (u: AdminUserItem, field: "isActive" | "isAdmin") => {
    setBannerMsg(null);
    const res = await api.admin.updateUser(u.id, {
      [field]: !u[field],
    });
    if (res.ok) {
      setBannerMsg(`Updated ${field} for ${u.email}.`);
      await loadAdminData();
      if (selectedDossier?.user.id === u.id) {
        await openUserDossier(u.id);
      }
    }
  };

  const handleCreateProvisionedUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setBannerMsg(null);
    const startBalMinor = Math.round((parseFloat(newUserStartBalMajor) || 10000) * 100);
    const res = await api.admin.createUser({
      email: newUserEmail,
      displayName: newUserDisplayName,
      password: newUserPassword,
      isAdmin: newUserIsAdmin,
      isVerified: newUserKycTier !== "UNVERIFIED",
      kycTier: newUserKycTier,
      riskFlag: newUserRiskFlag,
      startingBalanceMinor: startBalMinor,
    });
    if (res.ok) {
      setShowCreateUser(false);
      setNewUserEmail("");
      setNewUserDisplayName("");
      setBannerMsg(`Provisioned new account ${res.data.email} with ${formatMinor(startBalMinor)}.`);
      await loadAdminData();
    }
  };

  // =========================================================================
  // CLUB & LEAGUE UNDERGROUND HANDLERS
  // =========================================================================
  const handleSaveClubUnderground = async (clubId: string) => {
    setBannerMsg(null);
    const att = parseFloat(draftAtt);
    const def = parseFloat(draftDef);
    if (Number.isNaN(att) || Number.isNaN(def)) return;
    const res = await api.admin.updateClubRatings(clubId, {
      name: draftClubName.trim() || undefined,
      shortName: draftClubShort.trim() || undefined,
      attackRating: att,
      defenseRating: def,
    });
    if (res.ok) {
      setEditingClubId(null);
      setBannerMsg(`Updated club "${res.data.name}" (${res.data.shortName}) ratings & identity.`);
      await loadAdminData();
    }
  };

  const handleSaveLeagueUnderground = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeagueId) return;
    setBannerMsg(null);
    const res = await api.admin.updateLeague(selectedLeagueId, {
      name: draftLeagueName.trim() || undefined,
      shortName: draftLeagueShort.trim() || undefined,
      country: draftLeagueCountry.trim() || undefined,
    });
    if (res.ok) {
      setEditingLeague(false);
      setBannerMsg(`Updated competition metadata for ${res.data.name}.`);
      await loadAdminData();
    }
  };

  // =========================================================================
  // MATCH, EVENT INJECTION & 27-MARKET ODDS SURGERY HANDLERS
  // =========================================================================
  const handleToggleFixtureSuspension = async (fx: AdminFixtureItem) => {
    setBannerMsg(null);
    const nextSuspended = !fx.marketsSuspended;
    const res = await api.admin.toggleFixtureSuspension(fx.id, nextSuspended);
    if (res.ok) {
      setBannerMsg(
        `${nextSuspended ? "Suspended" : "Resumed"} all 27 markets for ${fx.home?.shortName} v ${fx.away?.shortName} (v${res.data.version}).`,
      );
      await loadAdminData();
    }
  };

  const handleOverrideFixtureResult = async (fixtureId: string) => {
    setBannerMsg(null);
    const hg = parseInt(draftHomeGoals, 10);
    const ag = parseInt(draftAwayGoals, 10);
    if (Number.isNaN(hg) || Number.isNaN(ag)) return;
    const res = await api.admin.overrideFixtureResult(fixtureId, hg, ag);
    if (res.ok) {
      setOverrideFxId(null);
      setBannerMsg(
        `Official result overridden to ${res.data.homeGoals}-${res.data.awayGoals} (FT) • Settled ${res.data.settledBetsCount} pending tickets.`,
      );
      await Promise.all([loadAdminData(), refreshAccount()]);
    }
  };

  const openUndergroundFixtureModal = (fx: AdminFixtureItem) => {
    setUndergroundFx(fx);
    setFxDraftMatchday(String(fx.matchday));
    setFxDraftKickoff(fx.kickoffAt || "");
    setFxDraftStatus(fx.status);
    setFxDraftClock(String(fx.clockSeconds ?? 0));
    setFxDraftHomeGoals(String(fx.homeGoals ?? 0));
    setFxDraftAwayGoals(String(fx.awayGoals ?? 0));
  };

  const handleSaveFixtureUnderground = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!undergroundFx) return;
    setBannerMsg(null);
    const res = await api.admin.updateFixtureUnderground(undergroundFx.id, {
      matchday: parseInt(fxDraftMatchday, 10) || undergroundFx.matchday,
      kickoffAt: fxDraftKickoff.trim() || undefined,
      status: fxDraftStatus,
      clockSeconds: parseInt(fxDraftClock, 10) || 0,
      homeGoals: parseInt(fxDraftHomeGoals, 10) || 0,
      awayGoals: parseInt(fxDraftAwayGoals, 10) || 0,
    });
    if (res.ok) {
      setBannerMsg(
        `Underground match state updated for ${undergroundFx.home?.shortName} v ${undergroundFx.away?.shortName}.`,
      );
      await loadAdminData();
    }
  };

  const handleInjectMatchEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!undergroundFx) return;
    setBannerMsg(null);
    const res = await api.admin.injectFixtureEvent(undergroundFx.id, {
      minute: parseInt(injectMinute, 10) || 45,
      eventType: injectType,
      side: injectSide,
      text: injectText.trim() || undefined,
      incrementScore: injectIncrement,
    });
    if (res.ok) {
      setInjectText("");
      setFxDraftHomeGoals(String(res.data.homeGoals));
      setFxDraftAwayGoals(String(res.data.awayGoals));
      setBannerMsg(
        `Injected ${res.data.eventType.toUpperCase()} at ${res.data.minute}' (${res.data.homeGoals}-${res.data.awayGoals}): "${res.data.text}"`,
      );
      await loadAdminData();
    }
  };

  const openOddsSurgeryModal = async (fx: AdminFixtureItem) => {
    setOddsSurgeryFx(fx);
    setOddsSurgeryLoading(true);
    const res = await api.admin.getFixtureOdds(fx.id);
    setOddsSurgeryLoading(false);
    if (res.ok) {
      setOddsSurgeryMarkets(res.data.markets);
      setOddsSurgeryVersion(res.data.version);
      const drafts: Record<string, string> = {};
      for (const m of res.data.markets) {
        for (const opt of m.options) {
          drafts[opt.oddsId] = String(opt.decimal.toFixed(2));
        }
      }
      setCustomOddsDrafts(drafts);
    }
  };

  const handlePinCustomOdd = async (oddsId: string, currentSuspended?: boolean) => {
    if (!oddsSurgeryFx) return;
    const dec = parseFloat(customOddsDrafts[oddsId] || "1.85");
    if (Number.isNaN(dec)) return;
    const res = await api.admin.overrideCustomOdds(oddsSurgeryFx.id, {
      oddsId,
      decimal: dec,
      suspended: currentSuspended,
    });
    if (res.ok) {
      setBannerMsg(`Pinned custom price @${res.data.decimal.toFixed(2)} (v${res.data.version}).`);
      await openOddsSurgeryModal(oddsSurgeryFx);
      await loadAdminData();
    }
  };

  // =========================================================================
  // TICKET ADJUDICATION & UNDERGROUND TICKET SURGERY HANDLERS
  // =========================================================================
  const handleForceSettleBet = async (
    betId: string,
    outcome: "won" | "lost" | "void",
  ) => {
    setBannerMsg(null);
    const res = await api.admin.forceSettleBet(betId, outcome);
    if (res.ok) {
      setBannerMsg(
        `Operator force-settled ticket ${betId.slice(0, 8)} as ${outcome.toUpperCase()}.`,
      );
      await Promise.all([loadAdminData(), refreshAccount()]);
    }
  };

  const handleSaveBetUnderground = async (betId: string) => {
    setBannerMsg(null);
    const stakeMinor = Math.round((parseFloat(betDraftStakeMajor) || 1) * 100);
    const recOdds = parseFloat(betDraftOdds) || 1.5;
    const retMinor =
      betDraftReturnMajor.trim() !== ""
        ? Math.round(parseFloat(betDraftReturnMajor) * 100)
        : undefined;
    const res = await api.admin.updateBetUnderground(betId, {
      stakeMinor,
      recordedOdds: recOdds,
      returnMinor: retMinor,
      status: betDraftStatus,
    });
    if (res.ok) {
      setEditingBetId(null);
      setBannerMsg(`Underground ticket surgery applied to bet ${betId.slice(0, 8)}.`);
      await loadAdminData();
    }
  };

  const handleSaveEngineConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setBannerMsg(null);
    const res = await api.admin.updateConfig({
      overround: parseFloat(draftOverround),
      homeAdvantage: parseFloat(draftHomeAdv),
      baselineGoals: parseFloat(draftBaseGoals),
      simulationSpeedMultiplier: parseInt(draftSimSpeed, 10),
      minStakeMinor: Math.round((parseFloat(draftMinStakeMajor) || 1) * 100),
      maxStakeMinor: Math.round((parseFloat(draftMaxStakeMajor) || 5000) * 100),
      matchDurationSeconds: parseInt(draftMatchDuration, 10) || 480,
      preMatchBreakSeconds: parseInt(draftPreMatchBreak, 10) || 240,
    });
    if (res.ok) {
      setBannerMsg("Updated live pricing, global stake limits & simulation engine configuration.");
      await loadAdminData();
    }
  };

  const handleRepriceAll = async () => {
    setBannerMsg(null);
    const res = await api.admin.repriceOdds();
    if (res.ok) {
      setBannerMsg(
        `Recomputed all 27 markets across ${res.data.repricedFixtures} upcoming fixtures (Overround ${res.data.overround}).`,
      );
      await loadAdminData();
    }
  };

  const handleRolloverSeason = async () => {
    setBannerMsg(null);
    const mds = parseInt(rolloverMatchdays, 10) || 3;
    const res = await api.admin.rolloverSeason(mds);
    if (res.ok) {
      setBannerMsg(
        `Generated ${res.data.createdFixtures} new fixtures across ${res.data.leaguesCount} European leagues (${mds} matchdays each).`,
      );
      await loadAdminData();
    }
  };

  // =========================================================================
  // PROMOTIONS, AIRDROP, BROADCAST & EMERGENCY OPS HANDLERS
  // =========================================================================
  const handleTriggerBulkAirdrop = async (e: React.FormEvent) => {
    e.preventDefault();
    setBannerMsg(null);
    const amountMinor = Math.round((parseFloat(airdropMajorAmount) || 0) * 100);
    if (amountMinor <= 0) return;
    const res = await api.admin.triggerAirdrop({
      targetSegment: airdropSegment,
      amountMinor,
      reason: airdropReason.trim() || "Executive Treasury Airdrop",
    });
    if (res.ok) {
      setBannerMsg(
        `Airdropped ${formatMinor(amountMinor)} each to ${res.data.creditedUsersCount} users (${res.data.targetSegment}) • Total distributed: ${formatMinor(res.data.totalDistributedMinor)}.`,
      );
      await Promise.all([loadAdminData(), refreshAccount()]);
    }
  };

  const handleCreatePromoCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setBannerMsg(null);
    const bonusMinor = Math.round((parseFloat(newPromoMajor) || 100) * 100);
    const maxClaims = parseInt(newPromoMaxClaims, 10) || 100;
    const res = await api.admin.createPromoCode({
      code: newPromoCode,
      bonusMinor,
      maxClaims,
      targetTier: newPromoTier,
    });
    if (res.ok) {
      setNewPromoCode("");
      setBannerMsg(
        `Created promo code "${res.data.code}" (${formatMinor(res.data.bonusMinor)}, max ${res.data.maxClaims} claims).`,
      );
      await loadAdminData();
    }
  };

  const handleTogglePromoCode = async (promoId: string) => {
    setBannerMsg(null);
    const res = await api.admin.togglePromoCode(promoId);
    if (res.ok) {
      setBannerMsg(
        `Promo code "${res.data.code}" is now ${res.data.isActive ? "ACTIVE" : "PAUSED"}.`,
      );
      await loadAdminData();
    }
  };

  const handleSaveBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setBannerMsg(null);
    const res = await api.admin.updateBroadcast({
      active: bcastActive,
      severity: bcastSeverity,
      headline: bcastHeadline,
      message: bcastMessage,
    });
    if (res.ok) {
      setBannerMsg(
        `Updated global broadcast banner (${res.data.active ? "LIVE" : "HIDDEN"}).`,
      );
      await loadAdminData();
    }
  };

  const handleEmergencyAction = async (action: string, label: string) => {
    setBannerMsg(null);
    const res = await api.admin.executeEmergencyAction(action);
    if (res.ok) {
      setBannerMsg(
        `Executed emergency operator command: ${label} (${res.data.affectedRecords} records affected).`,
      );
      await Promise.all([loadAdminData(), refreshAccount()]);
    }
  };

  // =========================================================================
  // STAFF, GRANULAR RBAC, INVITATION & WORLD OPERATIONS HANDLERS
  // =========================================================================
  const handleSelectInviteRoleTemplate = (role: string) => {
    setInvStaffRole(role);
    const tpl = staffData?.roleTemplates?.[role] || [];
    setInvStaffPerms(tpl);
  };

  const toggleInvitePermission = (perm: string) => {
    setInvStaffPerms((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm],
    );
  };

  const handleCreateStaffInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    setBannerMsg(null);
    const res = await api.admin.createStaffInvitation({
      staffName: invStaffName.trim() || "Staff Moderator",
      email: invStaffEmail.trim(),
      role: invStaffRole,
      permissions: invStaffPerms,
      internalNote: invStaffNote.trim() || undefined,
      expiryHours: parseInt(invStaffExpiryHours, 10) || 24,
    });
    if (res.ok) {
      setInvStaffName("");
      setInvStaffEmail("");
      setInvStaffNote("");
      const token = res.data.singleUseInviteToken || "";
      setLatestIssuedInviteToken(token);
      setAcceptTokenInput(token);
      setBannerMsg(
        `Created single-use staff invitation for ${res.data.email} (${res.data.role}). Copy the single-use invite token below.`,
      );
      await loadAdminData();
    } else {
      const f = res.failure;
      setBannerMsg(
        f.kind === "network" ? f.message : `${f.error.code}: ${f.error.message}`,
      );
    }
  };

  const handleResendStaffInvitation = async (invitationId: string) => {
    setBannerMsg(null);
    const res = await api.admin.resendStaffInvitation(invitationId);
    if (res.ok) {
      const token = res.data.singleUseInviteToken || "";
      setLatestIssuedInviteToken(token);
      setAcceptTokenInput(token);
      setBannerMsg(
        `Invalidated previous token and issued a fresh 24h single-use invite token for ${res.data.email}.`,
      );
      await loadAdminData();
    }
  };

  const handleRevokeStaffInvitation = async (invitationId: string) => {
    setBannerMsg(null);
    const res = await api.admin.revokeStaffInvitation(invitationId);
    if (res.ok) {
      setBannerMsg(`Revoked staff invitation ${invitationId.slice(0, 8)} permanently.`);
      await loadAdminData();
    }
  };

  const handleAcceptStaffInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    setBannerMsg(null);
    const res = await api.admin.acceptStaffInvitation({
      token: acceptTokenInput.trim(),
      password: acceptPasswordInput,
      displayName: acceptDisplayNameInput.trim() || undefined,
    });
    if (res.ok) {
      setAcceptTokenInput("");
      setAcceptDisplayNameInput("");
      setBannerMsg(
        `Activated staff account ${res.data.email} with role ${res.data.role}. Invitation marked Accepted and locked against reuse.`,
      );
      await loadAdminData();
    } else {
      const f = res.failure;
      setBannerMsg(
        f.kind === "network" ? f.message : `${f.error.code}: ${f.error.message}`,
      );
    }
  };

  const handleSaveStaffPermissions = async (staffId: string) => {
    setBannerMsg(null);
    const res = await api.admin.updateStaffPermissions(staffId, {
      role: editStaffRole,
      permissions: editStaffPerms,
      reason: editStaffReason,
    });
    if (res.ok) {
      setEditingStaffId(null);
      setBannerMsg(
        `Updated role (${res.data.role}) & ${res.data.permissions.length} granular permissions for ${res.data.email} (Session v${res.data.sessionVersion}).`,
      );
      await loadAdminData();
    }
  };

  const handleToggleStaffStatus = async (staffId: string, nextActive: boolean) => {
    setBannerMsg(null);
    const res = await api.admin.updateStaffStatus(staffId, {
      isActive: nextActive,
      reason: nextActive ? "Admin reactivated staff account" : "Admin suspended staff account",
    });
    if (res.ok) {
      setBannerMsg(
        `Staff account ${res.data.email} is now ${res.data.isActive ? "ACTIVE" : "SUSPENDED"} (Active sessions invalidated).`,
      );
      await loadAdminData();
    }
  };

  const handleRevokeUserSessions = async (userId: string, userEmail: string) => {
    setBannerMsg(null);
    const res = await api.admin.revokeSessions(userId);
    if (res.ok) {
      setBannerMsg(
        `Invalidated all active sessions for ${userEmail} (bumped sessionVersion to v${res.data.sessionVersion}).`,
      );
      await loadAdminData();
    }
  };

  const handleToggleSimControlFlag = async (
    field: "simulationPaused" | "maintenanceMode" | "readOnlyDiagnosticMode",
    nextVal: boolean,
  ) => {
    setBannerMsg(null);
    const res = await api.admin.updateConfig({ [field]: nextVal });
    if (res.ok) {
      setBannerMsg(`Updated ${field} -> ${nextVal ? "ENABLED" : "DISABLED"}.`);
      await loadAdminData();
    }
  };

  const handleRetryStuckSettlements = async () => {
    setBannerMsg(null);
    const res = await api.admin.retryAllSettlements();
    if (res.ok) {
      setBannerMsg(
        `Idempotently retried ${res.data.retriedFixturesCount} completed fixtures and settled ${res.data.settledTicketsCount} pending tickets.`,
      );
      await Promise.all([loadAdminData(), refreshAccount()]);
    }
  };

  // Filtered users list for Tab 1 (sorted newest signups first)
  const filteredUsers = adminUsers.filter((u) => {
    const q = userSearchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      u.email.toLowerCase().includes(q) ||
      u.displayName.toLowerCase().includes(q) ||
      u.id.toLowerCase().includes(q) ||
      (u.adminNotes || "").toLowerCase().includes(q);
    if (!matchesSearch) return false;
    if (userFilterMode === "new_signups") return !u.isAdmin && !u.isVerified;
    if (userFilterMode === "verified") return u.isVerified;
    if (userFilterMode === "unverified") return !u.isVerified;
    if (userFilterMode === "flagged") return u.riskFlag !== "NORMAL" || !u.isActive;
    if (userFilterMode === "admins") return u.isAdmin;
    return true;
  });

  // Gate 1: Not signed in or signed in as non-admin trader
  if (!user || !user.isAdmin) {
    return (
      <div className="mx-auto max-w-md space-y-5 py-8">
        <div className="pitch-grid rounded-card border border-line bg-coal p-6">
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-loss">
            RESTRICTED ACCESS • AUTHORIZED OPERATORS ONLY
          </span>
          <h1 className="mt-1 text-lg font-bold text-bone">
            Private Admin Control Panel &amp; Underground Console
          </h1>
          <p className="mt-1 text-xs text-fog">
            {user
              ? `Signed in as ${user.email} (Standard Trader). Administrator privileges are required to inspect/verify users and perform underground system edits.`
              : "Authenticate with an administrator account to access user KYC verification, underground database editors, and sportsbook controls."}
          </p>

          <form onSubmit={(e) => void handleAdminLogin(e)} className="mt-5 space-y-3.5">
            <div>
              <label className="block font-mono text-[11px] uppercase text-fog">
                Operator Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-control border border-line bg-ink px-3 py-2 text-xs text-bone focus:border-peach focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-mono text-[11px] uppercase text-fog">
                Operator Passkey
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-control border border-line bg-ink px-3 py-2 text-xs text-bone focus:border-peach focus:outline-none"
              />
            </div>

            {authError && (
              <p className="rounded-control border border-loss/40 bg-loss/10 px-3 py-2 font-mono text-xs text-loss">
                {authError}
              </p>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="min-h-[42px] w-full rounded-control bg-peach px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {authLoading ? "Verifying Operator Credentials..." : "Unlock Private Admin Console"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading && !status) {
    return (
      <StatePanel
        tone="loading"
        title="Loading private admin & underground operator suite..."
      />
    );
  }

  if (error || !status) {
    return (
      <StatePanel
        tone="error"
        title="Admin monitor unreachable"
        detail={error ?? "Unknown error"}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Operator Banner */}
      <div className="pitch-grid flex flex-wrap items-center justify-between gap-4 rounded-card border border-line bg-coal p-5">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-widest text-win">
            <span className="live-dot h-2 w-2 rounded-full bg-win" />
            PRIVATE ADMIN &amp; UNDERGROUND SURGERY SUITE • {status.status} • OPERATOR:{" "}
            {user.email}
          </div>
          <h1 className="mt-1 text-lg font-bold text-bone">
            Virtual Football Universe — User KYC Verification, Risk Desk &amp; Underground Editor
          </h1>
          <p className="mt-0.5 text-xs text-fog">
            Inspect &amp; verify users (KYC tiers, risk flags, custom stake caps, password/email overrides, exact balance surgery) and edit clubs, leagues, live match clocks, match events, custom odds, and tickets underground.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadAdminData()}
          className="min-h-[38px] rounded-control border border-line bg-graphite px-3.5 py-1.5 font-mono text-xs font-semibold text-bone hover:border-peach"
        >
          Sync Telemetry
        </button>
      </div>

      {bannerMsg && (
        <div className="rounded-control border border-win/40 bg-win/10 px-4 py-2.5 font-mono text-xs text-win">
          {bannerMsg}
        </div>
      )}

      {/* 15-Panel Executive Admin Operations & RBAC Navigation */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-card border border-line bg-coal p-2">
        {(
          [
            {
              id: "users",
              label: `1. Sign-Ups, KYC & Users (${adminUsers.length})`,
            },
            {
              id: "staff",
              label: `2. Staff, Moderators & RBAC Invites (${staffData?.staff.length ?? 1})`,
            },
            {
              id: "activity",
              label: `3. Live Activity & Alert Centre (${activityFeed?.suspiciousAlerts.length ?? 0})`,
            },
            {
              id: "world",
              label: `4. World Ops & Promotion/Relegation`,
            },
            {
              id: "matches",
              label: `5. Underground Match & Odds (${adminFixtures.length})`,
            },
            {
              id: "clubs",
              label: `6. Underground Clubs & Leagues (${clubs.length})`,
            },
            {
              id: "risk",
              label: `7. Ticket Surgery (${adminBets.length})`,
            },
            {
              id: "radar",
              label: `8. Fraud, Sharp & Whale Radar (${riskRadar?.whaleAlerts.length ?? 0})`,
            },
            {
              id: "promotions",
              label: `9. VIP Airdrop, Promo & Broadcast`,
            },
            {
              id: "database",
              label: `10. Underground DB Inspector & Emergency Ops`,
            },
            { id: "revenue", label: "11. Revenue & Hold %" },
            {
              id: "ledger",
              label: `12. Global Ledger (${ledgerEntries.length})`,
            },
            { id: "engine", label: "13. Sim Control, Pricing & Rollover" },
            { id: "health", label: "14. Health & Invariants" },
            {
              id: "audit",
              label: `15. Audit Log (${status.auditLogs?.length ?? 0})`,
            },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`min-h-[36px] rounded-control border px-3 py-1.5 font-mono text-xs font-semibold transition-colors ${
              activeTab === t.id
                ? "border-peach bg-peach-dim text-peach"
                : "border-transparent text-fog hover:bg-graphite hover:text-bone"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* =====================================================================
          TAB 1: USER CHECKING, KYC VERIFICATION & UNDERGROUND DOSSIER EDITOR
         ===================================================================== */}
      {activeTab === "users" && (
        <div className="space-y-5">
          {/* Top KPI & Filter Bar */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded-card border border-line bg-coal p-3.5 font-mono">
              <span className="block text-[10px] uppercase text-fog">TOTAL ACCOUNTS</span>
              <span className="tnum mt-1 block text-lg font-bold text-bone">
                {adminUsers.length}
              </span>
            </div>
            <div className="rounded-card border border-line bg-coal p-3.5 font-mono">
              <span className="block text-[10px] uppercase text-fog">KYC VERIFIED</span>
              <span className="tnum mt-1 block text-lg font-bold text-win">
                {adminUsers.filter((u) => u.isVerified).length}
              </span>
            </div>
            <div className="rounded-card border border-line bg-coal p-3.5 font-mono">
              <span className="block text-[10px] uppercase text-fog">PENDING KYC</span>
              <span className="tnum mt-1 block text-lg font-bold text-peach">
                {adminUsers.filter((u) => !u.isVerified).length}
              </span>
            </div>
            <div className="rounded-card border border-line bg-coal p-3.5 font-mono">
              <span className="block text-[10px] uppercase text-fog">RISK FLAGGED / FROZEN</span>
              <span className="tnum mt-1 block text-lg font-bold text-loss">
                {adminUsers.filter((u) => u.riskFlag !== "NORMAL" || !u.isActive).length}
              </span>
            </div>
            <div className="flex items-center justify-end rounded-card border border-line bg-coal p-3.5">
              <button
                type="button"
                onClick={() => setShowCreateUser(!showCreateUser)}
                className="min-h-[38px] w-full rounded-control bg-peach px-3 py-1.5 font-mono text-xs font-bold uppercase text-ink hover:opacity-90"
              >
                {showCreateUser ? "× Close Provisioner" : "+ Provision New User"}
              </button>
            </div>
          </div>

          {/* Underground Account Provisioner Drawer */}
          {showCreateUser && (
            <form
              onSubmit={(e) => void handleCreateProvisionedUser(e)}
              className="rounded-card border border-peach/50 bg-coal p-5"
            >
              <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-peach">
                Underground Account Provisioning — Create Pre-Verified Trader or Operator
              </h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <div>
                  <label className="block font-mono text-[10px] uppercase text-fog">Email</label>
                  <input
                    type="email"
                    required
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="vip@vfn.eu"
                    className="mt-1 w-full rounded-control border border-line bg-ink px-2.5 py-1.5 font-mono text-xs text-bone"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[10px] uppercase text-fog">
                    Display Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newUserDisplayName}
                    onChange={(e) => setNewUserDisplayName(e.target.value)}
                    placeholder="Institutional Whale"
                    className="mt-1 w-full rounded-control border border-line bg-ink px-2.5 py-1.5 text-xs text-bone"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[10px] uppercase text-fog">
                    Initial Password
                  </label>
                  <input
                    type="text"
                    required
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    className="mt-1 w-full rounded-control border border-line bg-ink px-2.5 py-1.5 font-mono text-xs text-bone"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[10px] uppercase text-fog">KYC Tier</label>
                  <select
                    value={newUserKycTier}
                    onChange={(e) => setNewUserKycTier(e.target.value)}
                    className="mt-1 w-full rounded-control border border-line bg-ink px-2.5 py-1.5 font-mono text-xs text-bone"
                  >
                    <option value="UNVERIFIED">UNVERIFIED</option>
                    <option value="VERIFIED">VERIFIED</option>
                    <option value="VIP_PRO">VIP_PRO</option>
                    <option value="VIP_INSTITUTIONAL">VIP_INSTITUTIONAL</option>
                  </select>
                </div>
                <div>
                  <label className="block font-mono text-[10px] uppercase text-fog">
                    Starting Balance (XTS)
                  </label>
                  <input
                    type="number"
                    step="100"
                    value={newUserStartBalMajor}
                    onChange={(e) => setNewUserStartBalMajor(e.target.value)}
                    className="mt-1 w-full rounded-control border border-line bg-ink px-2.5 py-1.5 font-mono text-xs text-bone"
                  />
                </div>
                <div className="flex flex-col justify-end gap-2">
                  <label className="flex items-center gap-2 font-mono text-[11px] text-bone">
                    <input
                      type="checkbox"
                      checked={newUserIsAdmin}
                      onChange={(e) => setNewUserIsAdmin(e.target.checked)}
                    />
                    Grant Operator Admin
                  </label>
                  <button
                    type="submit"
                    className="rounded-control bg-win px-3 py-1.5 font-mono text-xs font-bold uppercase text-ink"
                  >
                    Create Account
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* New Sign-Up Verification Queue Banner */}
          {adminUsers.some((u) => !u.isAdmin && !u.isVerified) && (
            <div className="rounded-card border border-peach/60 bg-peach-dim/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-peach">
                    ● NEW SIGN-UP REVIEW &amp; VERIFICATION QUEUE
                  </span>
                  <h3 className="mt-0.5 text-sm font-bold text-bone">
                    {adminUsers.filter((u) => !u.isAdmin && !u.isVerified).length} Newly
                    Registered Trader(s) Awaiting Operator Check &amp; KYC Verification
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setUserFilterMode("new_signups")}
                  className="rounded-control border border-peach bg-peach-dim px-3 py-1 font-mono text-xs font-bold text-peach"
                >
                  Filter Sign-Up Queue Only
                </button>
              </div>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {adminUsers
                  .filter((u) => !u.isAdmin && !u.isVerified)
                  .slice(0, 6)
                  .map((su) => (
                    <div
                      key={su.id}
                      className="flex items-center justify-between gap-2 rounded-control border border-line bg-coal p-3 font-mono text-xs"
                    >
                      <div className="min-w-0">
                        <span className="block truncate font-bold text-bone">
                          {su.displayName}
                        </span>
                        <span className="block truncate text-[11px] text-fog">
                          {su.email}
                        </span>
                        <span className="mt-0.5 block text-[10px] text-peach">
                          Signed up:{" "}
                          {su.createdAt
                            ? new Date(su.createdAt).toLocaleString()
                            : "Just now"}
                        </span>
                      </div>
                      <div className="flex shrink-0 flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => void handleQuickVerifyToggle(su)}
                          className="rounded-control bg-win px-2.5 py-1 text-[10px] font-bold text-ink"
                        >
                          ✓ Approve KYC
                        </button>
                        <button
                          type="button"
                          onClick={() => void openUserDossier(su.id)}
                          className="rounded-control border border-line bg-ink px-2.5 py-1 text-[10px] text-bone hover:border-peach"
                        >
                          Inspect Signup
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Search & Verification Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-coal p-3">
            <input
              type="text"
              value={userSearchQuery}
              onChange={(e) => setUserSearchQuery(e.target.value)}
              placeholder="Search users who signed up by email, display name, UUID, or compliance notes..."
              className="min-w-[260px] flex-1 rounded-control border border-line bg-ink px-3 py-1.5 font-mono text-xs text-bone focus:border-peach focus:outline-none"
            />
            <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
              {(
                [
                  { id: "all", label: `All Signups (${adminUsers.length})` },
                  {
                    id: "new_signups",
                    label: `New Signups Pending Check (${
                      adminUsers.filter((u) => !u.isAdmin && !u.isVerified).length
                    })`,
                  },
                  { id: "verified", label: "✓ Verified" },
                  { id: "unverified", label: "Unverified" },
                  { id: "flagged", label: "Flagged / Frozen" },
                  { id: "admins", label: "Admins" },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setUserFilterMode(f.id)}
                  className={`rounded-control border px-2.5 py-1 font-semibold ${
                    userFilterMode === f.id
                      ? "border-peach bg-peach-dim text-peach"
                      : "border-line bg-ink text-fog hover:text-bone"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Users Table */}
          <div className="overflow-x-auto rounded-card border border-line bg-coal">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-line bg-graphite/60 font-mono text-[11px] uppercase text-fog">
                  <th className="px-4 py-3 font-semibold">Trader Identity</th>
                  <th className="px-4 py-3 font-semibold">Signed Up At</th>
                  <th className="px-4 py-3 font-semibold">KYC Verification</th>
                  <th className="px-4 py-3 font-semibold">Risk / Compliance</th>
                  <th className="px-4 py-3 text-right font-semibold">Available XTS</th>
                  <th className="px-4 py-3 text-right font-semibold">Net P&amp;L / Win%</th>
                  <th className="px-4 py-3 text-right font-semibold">Tickets</th>
                  <th className="px-4 py-3 text-right font-semibold">
                    Verify &amp; Underground Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredUsers.map((u) => {
                  const isSelected = selectedDossier?.user.id === u.id;
                  return (
                    <tr
                      key={u.id}
                      className={`hover:bg-graphite/30 ${
                        isSelected ? "bg-peach-dim/30" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-bone">{u.displayName}</span>
                          {u.isAdmin && (
                            <span className="rounded-control bg-peach-dim px-1.5 py-0.5 font-mono text-[10px] font-bold text-peach">
                              ADMIN
                            </span>
                          )}
                          {!u.isAdmin && !u.isVerified && (
                            <span className="rounded-control border border-peach/40 bg-peach-dim px-1.5 py-0.5 font-mono text-[9px] font-bold text-peach">
                              NEW SIGNUP
                            </span>
                          )}
                        </div>
                        <span className="block font-mono text-[11px] text-fog">{u.email}</span>
                        {u.adminNotes && (
                          <span className="mt-0.5 block font-mono text-[10px] text-peach">
                            Note: {u.adminNotes}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 font-mono text-[11px] text-fog">
                        {u.createdAt ? (
                          <>
                            <span className="block text-bone">
                              {new Date(u.createdAt).toLocaleDateString()}
                            </span>
                            <span className="text-[10px] text-fog">
                              {new Date(u.createdAt).toLocaleTimeString()}
                            </span>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>

                      <td className="px-4 py-3 font-mono text-[11px]">
                        {u.isVerified ? (
                          <span className="inline-flex items-center gap-1 rounded-control border border-win/40 bg-win/15 px-2 py-0.5 font-bold text-win">
                            ✓ {u.kycTier || "VERIFIED"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-control border border-line bg-ink px-2 py-0.5 text-fog">
                            UNVERIFIED
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 font-mono text-[11px]">
                        <span
                          className={`mr-1.5 rounded-control px-2 py-0.5 font-bold ${
                            u.riskFlag === "FROZEN"
                              ? "bg-loss/20 text-loss"
                              : u.riskFlag === "SHARP_WATCH" || u.riskFlag === "HIGH_RISK"
                                ? "bg-live/20 text-live"
                                : u.riskFlag === "VIP_WHALE"
                                  ? "bg-peach-dim text-peach"
                                  : "bg-graphite text-fog"
                          }`}
                        >
                          {u.riskFlag || "NORMAL"}
                        </span>
                        {!u.isActive && (
                          <span className="rounded-control bg-loss/20 px-2 py-0.5 font-bold text-loss">
                            SUSPENDED
                          </span>
                        )}
                        {u.customMaxStakeMinor !== null && (
                          <span className="mt-1 block text-[10px] text-fog">
                            Cap: {formatMinor(u.customMaxStakeMinor)}
                          </span>
                        )}
                      </td>

                      <td className="tnum px-4 py-3 text-right font-mono font-bold text-bone">
                        {formatMinor(u.availableMinor)}
                        {u.reservedMinor > 0 && (
                          <span className="block text-[10px] font-normal text-peach">
                            +{formatMinor(u.reservedMinor)} in play
                          </span>
                        )}
                      </td>

                      <td className="tnum px-4 py-3 text-right font-mono">
                        <span
                          className={`font-bold ${
                            (u.netPnlMinor ?? 0) > 0
                              ? "text-win"
                              : (u.netPnlMinor ?? 0) < 0
                                ? "text-loss"
                                : "text-bone"
                          }`}
                        >
                          {(u.netPnlMinor ?? 0) > 0 ? "+" : ""}
                          {formatMinor(u.netPnlMinor ?? 0)}
                        </span>
                        <span className="block text-[10px] text-fog">
                          {u.winRate ?? 0}% win ({u.wonBets ?? 0}W/{u.lostBets ?? 0}L)
                        </span>
                      </td>

                      <td className="tnum px-4 py-3 text-right font-mono text-fog">
                        {u.totalBets} ({u.pendingBets} open)
                      </td>

                      <td className="px-4 py-3 text-right font-mono">
                        <div className="inline-flex flex-wrap justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => void handleQuickVerifyToggle(u)}
                            className={`rounded-control border px-2.5 py-1 text-[11px] font-bold ${
                              u.isVerified
                                ? "border-line bg-ink text-fog hover:text-bone"
                                : "border-win/50 bg-win/15 text-win hover:bg-win/25"
                            }`}
                          >
                            {u.isVerified ? "Revoke KYC" : "✓ Verify KYC"}
                          </button>

                          <button
                            type="button"
                            onClick={() => void openUserDossier(u.id)}
                            className="rounded-control border border-peach bg-peach-dim px-2.5 py-1 text-[11px] font-bold text-peach hover:opacity-90"
                          >
                            {dossierLoading && selectedDossier?.user.id === u.id
                              ? "Loading..."
                              : "Inspect & Edit Underground"}
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleToggleUserStatus(u, "isActive")}
                            className="rounded-control border border-line bg-ink px-2 py-1 text-[11px] text-loss hover:border-loss"
                          >
                            {u.isActive ? "Suspend" : "Activate"}
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleRevokeUserSessions(u.id, u.email)}
                            className="rounded-control border border-line bg-ink px-2 py-1 text-[11px] text-fog hover:border-peach hover:text-bone"
                          >
                            Revoke Sessions
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Deep User Verification Dossier & Underground Account Editor */}
          {selectedDossier && (
            <div className="rounded-card border-2 border-peach/60 bg-coal p-6 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-peach">
                      USER KYC VERIFICATION &amp; UNDERGROUND SURGERY DOSSIER
                    </span>
                    <span className="rounded-control border border-line bg-ink px-2 py-0.5 font-mono text-[10px] text-fog">
                      UUID: {selectedDossier.user.id}
                    </span>
                  </div>
                  <h3 className="mt-1 text-lg font-bold text-bone">
                    {selectedDossier.user.displayName} ({selectedDossier.user.email})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDossier(null)}
                  className="rounded-control border border-line bg-ink px-3 py-1.5 font-mono text-xs text-fog hover:text-bone"
                >
                  × Close Dossier
                </button>
              </div>

              <div className="mt-5 grid gap-6 lg:grid-cols-12">
                {/* Left 7 Cols: Underground Identity, KYC, Risk & Wallet Surgery Form */}
                <form
                  onSubmit={(e) => void handleSaveUserDossier(e)}
                  className="space-y-4 lg:col-span-7"
                >
                  <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-peach">
                    1. Underground Identity, Password, KYC Tier &amp; Risk Controls
                  </h4>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block font-mono text-[10px] uppercase text-fog">
                        Account Email (Underground Override)
                      </label>
                      <input
                        type="email"
                        required
                        value={editUserEmail}
                        onChange={(e) => setEditUserEmail(e.target.value)}
                        className="mt-1 w-full rounded-control border border-line bg-ink px-3 py-2 font-mono text-xs text-bone"
                      />
                    </div>
                    <div>
                      <label className="block font-mono text-[10px] uppercase text-fog">
                        Trader Display Name
                      </label>
                      <input
                        type="text"
                        required
                        value={editUserDisplayName}
                        onChange={(e) => setEditUserDisplayName(e.target.value)}
                        className="mt-1 w-full rounded-control border border-line bg-ink px-3 py-2 text-xs text-bone"
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className="block font-mono text-[10px] uppercase text-fog">
                        KYC Verification Tier
                      </label>
                      <select
                        value={editUserKycTier}
                        onChange={(e) => {
                          setEditUserKycTier(e.target.value);
                          setEditUserVerified(e.target.value !== "UNVERIFIED");
                        }}
                        className="mt-1 w-full rounded-control border border-line bg-ink px-3 py-2 font-mono text-xs text-bone"
                      >
                        <option value="UNVERIFIED">UNVERIFIED</option>
                        <option value="PENDING_DOCS">PENDING_DOCS</option>
                        <option value="VERIFIED">VERIFIED (Standard KYC)</option>
                        <option value="VIP_PRO">VIP_PRO (High Limit)</option>
                        <option value="VIP_INSTITUTIONAL">VIP_INSTITUTIONAL</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-mono text-[10px] uppercase text-fog">
                        Risk &amp; Compliance Flag
                      </label>
                      <select
                        value={editUserRiskFlag}
                        onChange={(e) => setEditUserRiskFlag(e.target.value)}
                        className="mt-1 w-full rounded-control border border-line bg-ink px-3 py-2 font-mono text-xs text-bone"
                      >
                        <option value="NORMAL">NORMAL (Unrestricted)</option>
                        <option value="VIP_WHALE">VIP_WHALE (Priority)</option>
                        <option value="SHARP_WATCH">SHARP_WATCH (Syndicate Monitor)</option>
                        <option value="HIGH_RISK">HIGH_RISK (Compliance Review)</option>
                        <option value="FROZEN">FROZEN (Block New Bets)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-mono text-[10px] uppercase text-fog">
                        Custom Max Stake Cap (XTS)
                      </label>
                      <input
                        type="number"
                        step="10"
                        value={editUserMaxStakeMajor}
                        onChange={(e) => setEditUserMaxStakeMajor(e.target.value)}
                        placeholder="Blank = Global Default"
                        className="mt-1 w-full rounded-control border border-line bg-ink px-3 py-2 font-mono text-xs text-bone"
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className="block font-mono text-[10px] uppercase text-fog">
                        Force Password Reset (Optional)
                      </label>
                      <input
                        type="text"
                        value={editUserPassword}
                        onChange={(e) => setEditUserPassword(e.target.value)}
                        placeholder="Leave blank to keep current"
                        className="mt-1 w-full rounded-control border border-line bg-ink px-3 py-2 font-mono text-xs text-bone"
                      />
                    </div>

                    <div>
                      <label className="block font-mono text-[10px] uppercase text-fog">
                        Exact Available Balance (XTS)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={editUserExactBalanceMajor}
                        onChange={(e) => setEditUserExactBalanceMajor(e.target.value)}
                        className="mt-1 w-full rounded-control border border-peach/60 bg-ink px-3 py-2 font-mono text-xs font-bold text-bone"
                      />
                    </div>

                    <div>
                      <label className="block font-mono text-[10px] uppercase text-fog">
                        Exact Reserved In-Play (XTS)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={editUserExactReservedMajor}
                        onChange={(e) => setEditUserExactReservedMajor(e.target.value)}
                        className="mt-1 w-full rounded-control border border-line bg-ink px-3 py-2 font-mono text-xs text-bone"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-mono text-[10px] uppercase text-fog">
                      Internal Operator Compliance &amp; Verification Notes
                    </label>
                    <textarea
                      rows={2}
                      value={editUserNotes}
                      onChange={(e) => setEditUserNotes(e.target.value)}
                      placeholder="Record KYC document ID, source of funds verification, or syndicate trading notes..."
                      className="mt-1 w-full rounded-control border border-line bg-ink px-3 py-2 font-mono text-xs text-bone"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <label className="flex items-center gap-2 font-mono text-xs text-win">
                      <input
                        type="checkbox"
                        checked={editUserVerified}
                        onChange={(e) => setEditUserVerified(e.target.checked)}
                      />
                      ✓ Mark Account KYC Verified
                    </label>

                    <button
                      type="submit"
                      className="rounded-control bg-peach px-4 py-2 font-mono text-xs font-bold uppercase text-ink hover:opacity-90"
                    >
                      Save Underground Dossier &amp; Balance
                    </button>
                  </div>
                </form>

                {/* Right 5 Cols: Quick Treasury Grant & User Bet/Ledger Inspection */}
                <div className="space-y-4 lg:col-span-5">
                  <div className="rounded-control border border-line bg-ink p-4">
                    <h4 className="font-mono text-xs font-bold uppercase text-bone">
                      Quick Treasury Credit / Debit (±XTS)
                    </h4>
                    <div className="mt-2.5 flex items-center gap-2">
                      <input
                        type="number"
                        step="100"
                        value={grantMajorAmount}
                        onChange={(e) => setGrantMajorAmount(e.target.value)}
                        className="w-32 rounded-control border border-line bg-coal px-3 py-1.5 font-mono text-xs text-bone"
                      />
                      <button
                        type="button"
                        onClick={() => void handleUserGrant(selectedDossier.user.id)}
                        className="rounded-control border border-peach bg-peach-dim px-3 py-1.5 font-mono text-xs font-bold text-peach"
                      >
                        Apply ±XTS Delta
                      </button>
                    </div>
                  </div>

                  {/* User Recent Tickets */}
                  <div className="rounded-control border border-line bg-ink p-4">
                    <h4 className="font-mono text-xs font-bold uppercase text-bone">
                      Trader Ticket History ({selectedDossier.bets.length})
                    </h4>
                    <div className="mt-2 max-h-44 space-y-2 overflow-y-auto pr-1 text-xs">
                      {selectedDossier.bets.length === 0 ? (
                        <p className="font-mono text-[11px] text-fog">No tickets placed.</p>
                      ) : (
                        selectedDossier.bets.slice(0, 12).map((b) => (
                          <div
                            key={b.id}
                            className="flex items-center justify-between rounded-control border border-line bg-coal px-2.5 py-1.5 font-mono text-[11px]"
                          >
                            <div>
                              <span className="font-bold text-bone">
                                {formatMinor(b.stakeMinor)} @ {b.recordedOdds.toFixed(2)}
                              </span>
                              <span className="ml-2 text-fog">
                                ({b.selections.length} leg{b.selections.length === 1 ? "" : "s"})
                              </span>
                            </div>
                            <span
                              className={`uppercase font-bold ${
                                b.status === "won"
                                  ? "text-win"
                                  : b.status === "lost"
                                    ? "text-loss"
                                    : "text-peach"
                              }`}
                            >
                              {b.status}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* User Recent Ledger */}
                  <div className="rounded-control border border-line bg-ink p-4">
                    <h4 className="font-mono text-xs font-bold uppercase text-bone">
                      Trader Wallet Ledger ({selectedDossier.ledger.length})
                    </h4>
                    <div className="mt-2 max-h-40 space-y-1.5 overflow-y-auto pr-1 font-mono text-[11px]">
                      {selectedDossier.ledger.slice(0, 10).map((le) => (
                        <div
                          key={le.id}
                          className="flex items-center justify-between border-b border-line/60 pb-1"
                        >
                          <span className="truncate text-fog">{le.kind}</span>
                          <span
                            className={
                              le.amountMinor >= 0 ? "font-bold text-win" : "font-bold text-loss"
                            }
                          >
                            {le.amountMinor >= 0 ? "+" : ""}
                            {formatMinor(le.amountMinor)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 2: UNDERGROUND MATCH, EVENT INJECTOR & 27-MARKET ODDS SURGERY DESK
         ===================================================================== */}
      {activeTab === "matches" && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-bone">
                Underground Match State, Event Director &amp; 27-Market Odds Desk —{" "}
                {selectedLeague?.name ?? "All Leagues"}
              </h2>
              <p className="mt-0.5 font-mono text-[11px] text-fog">
                Edit matchdays, kickoff times, live clocks, inject custom goals/cards, suspend markets, or pin custom decimal odds on any selection.
              </p>
            </div>
          </div>

          {/* Underground Match State & Event Injector Modal */}
          {undergroundFx && (
            <div className="rounded-card border-2 border-peach/60 bg-coal p-5 shadow-xl">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div>
                  <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-peach">
                    UNDERGROUND MATCH DIRECTOR &amp; TIMELINE EVENT INJECTOR
                  </span>
                  <h3 className="mt-0.5 text-base font-bold text-bone">
                    {undergroundFx.home?.name} vs {undergroundFx.away?.name} (MD{" "}
                    {undergroundFx.matchday})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setUndergroundFx(null)}
                  className="rounded-control border border-line bg-ink px-3 py-1 font-mono text-xs text-fog hover:text-bone"
                >
                  × Close Director
                </button>
              </div>

              <div className="mt-4 grid gap-6 lg:grid-cols-2">
                {/* Left: Raw Fixture State Override */}
                <form
                  onSubmit={(e) => void handleSaveFixtureUnderground(e)}
                  className="space-y-3"
                >
                  <h4 className="font-mono text-xs font-bold uppercase text-peach">
                    1. Raw Fixture State Surgery (Status, Clock, Score, Kickoff)
                  </h4>
                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <label className="block font-mono text-[10px] uppercase text-fog">
                        Matchday #
                      </label>
                      <input
                        type="number"
                        value={fxDraftMatchday}
                        onChange={(e) => setFxDraftMatchday(e.target.value)}
                        className="mt-1 w-full rounded-control border border-line bg-ink px-2.5 py-1.5 font-mono text-xs text-bone"
                      />
                    </div>
                    <div>
                      <label className="block font-mono text-[10px] uppercase text-fog">
                        Status
                      </label>
                      <select
                        value={fxDraftStatus}
                        onChange={(e) => setFxDraftStatus(e.target.value)}
                        className="mt-1 w-full rounded-control border border-line bg-ink px-2.5 py-1.5 font-mono text-xs text-bone"
                      >
                        <option value="upcoming">upcoming</option>
                        <option value="live">live</option>
                        <option value="completed">completed</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-mono text-[10px] uppercase text-fog">
                        Clock Secs (0-480)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={480}
                        value={fxDraftClock}
                        onChange={(e) => setFxDraftClock(e.target.value)}
                        className="mt-1 w-full rounded-control border border-line bg-ink px-2.5 py-1.5 font-mono text-xs text-bone"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <label className="block font-mono text-[10px] uppercase text-fog">
                        Home Goals
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={fxDraftHomeGoals}
                        onChange={(e) => setFxDraftHomeGoals(e.target.value)}
                        className="mt-1 w-full rounded-control border border-line bg-ink px-2.5 py-1.5 font-mono text-xs text-bone"
                      />
                    </div>
                    <div>
                      <label className="block font-mono text-[10px] uppercase text-fog">
                        Away Goals
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={fxDraftAwayGoals}
                        onChange={(e) => setFxDraftAwayGoals(e.target.value)}
                        className="mt-1 w-full rounded-control border border-line bg-ink px-2.5 py-1.5 font-mono text-xs text-bone"
                      />
                    </div>
                    <div>
                      <label className="block font-mono text-[10px] uppercase text-fog">
                        Kickoff ISO
                      </label>
                      <input
                        type="text"
                        value={fxDraftKickoff}
                        onChange={(e) => setFxDraftKickoff(e.target.value)}
                        className="mt-1 w-full rounded-control border border-line bg-ink px-2.5 py-1.5 font-mono text-[11px] text-bone"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="rounded-control bg-peach px-4 py-2 font-mono text-xs font-bold uppercase text-ink"
                  >
                    Save Raw Fixture State
                  </button>
                </form>

                {/* Right: Live Timeline Event Injector */}
                <form onSubmit={(e) => void handleInjectMatchEvent(e)} className="space-y-3">
                  <h4 className="font-mono text-xs font-bold uppercase text-win">
                    2. Inject Custom Timeline Event (Goal, Card, Commentary)
                  </h4>
                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <label className="block font-mono text-[10px] uppercase text-fog">
                        Minute (1-90)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={90}
                        value={injectMinute}
                        onChange={(e) => setInjectMinute(e.target.value)}
                        className="mt-1 w-full rounded-control border border-line bg-ink px-2.5 py-1.5 font-mono text-xs text-bone"
                      />
                    </div>
                    <div>
                      <label className="block font-mono text-[10px] uppercase text-fog">
                        Event Type
                      </label>
                      <select
                        value={injectType}
                        onChange={(e) => setInjectType(e.target.value)}
                        className="mt-1 w-full rounded-control border border-line bg-ink px-2.5 py-1.5 font-mono text-xs text-bone"
                      >
                        <option value="goal">GOAL</option>
                        <option value="card">YELLOW / RED CARD</option>
                        <option value="chance">DANGEROUS CHANCE</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-mono text-[10px] uppercase text-fog">
                        Club Side
                      </label>
                      <select
                        value={injectSide}
                        onChange={(e) => setInjectSide(e.target.value as "home" | "away")}
                        className="mt-1 w-full rounded-control border border-line bg-ink px-2.5 py-1.5 font-mono text-xs text-bone"
                      >
                        <option value="home">{undergroundFx.home?.shortName ?? "Home"}</option>
                        <option value="away">{undergroundFx.away?.shortName ?? "Away"}</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-mono text-[10px] uppercase text-fog">
                      Custom Feed Commentary (Optional)
                    </label>
                    <input
                      type="text"
                      value={injectText}
                      onChange={(e) => setInjectText(e.target.value)}
                      placeholder="Leave blank for automatic goal/incident broadcast text"
                      className="mt-1 w-full rounded-control border border-line bg-ink px-2.5 py-1.5 text-xs text-bone"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 font-mono text-xs text-bone">
                      <input
                        type="checkbox"
                        checked={injectIncrement}
                        onChange={(e) => setInjectIncrement(e.target.checked)}
                      />
                      Auto-increment scoreline on GOAL
                    </label>
                    <button
                      type="submit"
                      className="rounded-control bg-win px-4 py-2 font-mono text-xs font-bold uppercase text-ink"
                    >
                      + Inject Event Into Match
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Underground 27-Market Custom Odds Pinning Drawer */}
          {oddsSurgeryFx && (
            <div className="rounded-card border-2 border-peach/60 bg-coal p-5 shadow-xl">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div>
                  <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-peach">
                    UNDERGROUND 27-MARKET ODDS SURGERY • SNAPSHOT v{oddsSurgeryVersion}
                  </span>
                  <h3 className="mt-0.5 text-base font-bold text-bone">
                    {oddsSurgeryFx.home?.name} vs {oddsSurgeryFx.away?.name} — Pin Custom Decimal
                    Prices
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setOddsSurgeryFx(null)}
                  className="rounded-control border border-line bg-ink px-3 py-1 font-mono text-xs text-fog hover:text-bone"
                >
                  × Close Odds Surgery
                </button>
              </div>

              {oddsSurgeryLoading ? (
                <p className="py-6 font-mono text-xs text-fog">Loading 27 markets...</p>
              ) : (
                <div className="mt-4 max-h-[420px] space-y-4 overflow-y-auto pr-2">
                  {oddsSurgeryMarkets.map((m) => (
                    <div
                      key={m.key}
                      className="rounded-control border border-line bg-ink p-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold uppercase text-peach">
                          {m.label} ({m.key})
                        </span>
                        <span className="font-mono text-[10px] uppercase text-fog">
                          Category: {m.category}
                        </span>
                      </div>
                      <div className="mt-2.5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        {m.options.map((opt) => (
                          <div
                            key={opt.oddsId}
                            className="flex items-center justify-between gap-2 rounded-control border border-line bg-coal px-2.5 py-1.5 font-mono text-xs"
                          >
                            <span className="truncate text-bone" title={opt.label}>
                              {opt.label}
                            </span>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                step="0.05"
                                min="1.01"
                                max="250"
                                value={customOddsDrafts[opt.oddsId] ?? String(opt.decimal)}
                                onChange={(e) =>
                                  setCustomOddsDrafts((prev) => ({
                                    ...prev,
                                    [opt.oddsId]: e.target.value,
                                  }))
                                }
                                className="w-16 rounded-control border border-line bg-ink px-1.5 py-0.5 text-right text-xs font-bold text-peach"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  void handlePinCustomOdd(opt.oddsId, opt.suspended)
                                }
                                className="rounded-control bg-peach px-2 py-0.5 text-[10px] font-bold text-ink"
                              >
                                Pin
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="overflow-x-auto rounded-card border border-line bg-coal">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-line bg-graphite/60 font-mono text-[11px] uppercase text-fog">
                  <th className="px-4 py-3 font-semibold">MD</th>
                  <th className="px-4 py-3 font-semibold">Fixture</th>
                  <th className="px-4 py-3 text-center font-semibold">Match Status</th>
                  <th className="px-4 py-3 text-center font-semibold">Score / Clock</th>
                  <th className="px-4 py-3 text-center font-semibold">27 Markets</th>
                  <th className="px-4 py-3 text-right font-semibold">
                    Underground &amp; Trading Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {adminFixtures.map((fx) => {
                  const isOverriding = overrideFxId === fx.id;
                  return (
                    <tr key={fx.id} className="hover:bg-graphite/30">
                      <td className="tnum px-4 py-3 font-mono text-fog">MD {fx.matchday}</td>
                      <td className="px-4 py-3 font-semibold text-bone">
                        {fx.home?.name ?? "Home"} <span className="text-fog">vs</span>{" "}
                        {fx.away?.name ?? "Away"}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-[10px] uppercase">
                        <span
                          className={`rounded-control px-2 py-0.5 font-bold ${
                            fx.status === "live"
                              ? "bg-live/20 text-live"
                              : fx.status === "completed"
                                ? "bg-graphite text-fog"
                                : "bg-peach-dim text-peach"
                          }`}
                        >
                          {fx.status}
                        </span>
                      </td>
                      <td className="tnum px-4 py-3 text-center font-mono font-bold text-bone">
                        {fx.status === "upcoming"
                          ? "—"
                          : `${fx.homeGoals ?? 0} - ${fx.awayGoals ?? 0}`}
                        {fx.clockSeconds !== null && fx.status === "live" && (
                          <span className="ml-1.5 text-[10px] text-live">
                            ({Math.floor((fx.clockSeconds / 480) * 90)}&apos;)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-[10px]">
                        <span
                          className={`rounded-control px-2 py-0.5 font-bold ${
                            fx.marketsSuspended
                              ? "bg-loss/20 text-loss"
                              : "bg-win/20 text-win"
                          }`}
                        >
                          {fx.marketsSuspended
                            ? `SUSPENDED (v${fx.oddsVersion})`
                            : `OPEN (v${fx.oddsVersion})`}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {isOverriding ? (
                          <div className="inline-flex items-center gap-1.5">
                            <input
                              type="number"
                              min={0}
                              max={9}
                              value={draftHomeGoals}
                              onChange={(e) => setDraftHomeGoals(e.target.value)}
                              className="w-12 rounded-control border border-peach bg-ink px-2 py-1 text-center text-xs text-bone"
                            />
                            <span className="text-fog">:</span>
                            <input
                              type="number"
                              min={0}
                              max={9}
                              value={draftAwayGoals}
                              onChange={(e) => setDraftAwayGoals(e.target.value)}
                              className="w-12 rounded-control border border-peach bg-ink px-2 py-1 text-center text-xs text-bone"
                            />
                            <button
                              type="button"
                              onClick={() => void handleOverrideFixtureResult(fx.id)}
                              className="rounded-control bg-peach px-2.5 py-1 text-[11px] font-bold text-ink"
                            >
                              Set FT &amp; Settle
                            </button>
                            <button
                              type="button"
                              onClick={() => setOverrideFxId(null)}
                              className="rounded-control border border-line bg-ink px-2 py-1 text-[11px] text-fog"
                            >
                              ×
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex flex-wrap justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openUndergroundFixtureModal(fx)}
                              className="rounded-control border border-peach/50 bg-peach-dim px-2.5 py-1 text-[11px] font-bold text-peach"
                            >
                              Underground State / Events
                            </button>
                            <button
                              type="button"
                              onClick={() => void openOddsSurgeryModal(fx)}
                              className="rounded-control border border-line bg-ink px-2.5 py-1 text-[11px] text-bone hover:border-peach"
                            >
                              Edit 27 Odds
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleToggleFixtureSuspension(fx)}
                              className={`rounded-control border px-2.5 py-1 text-[11px] font-bold ${
                                fx.marketsSuspended
                                  ? "border-win/50 bg-win/10 text-win"
                                  : "border-loss/50 bg-loss/10 text-loss"
                              }`}
                            >
                              {fx.marketsSuspended ? "Resume" : "Suspend"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOverrideFxId(fx.id);
                                setDraftHomeGoals(String(fx.homeGoals ?? 2));
                                setDraftAwayGoals(String(fx.awayGoals ?? 1));
                              }}
                              className="rounded-control border border-line bg-ink px-2.5 py-1 text-[11px] text-peach hover:border-peach"
                            >
                              Set FT Score
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 3: UNDERGROUND CLUBS & LEAGUES EDITOR
         ===================================================================== */}
      {activeTab === "clubs" && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-line bg-coal p-4">
            <div>
              <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-bone">
                Underground Competition &amp; Club Identity Editor —{" "}
                {selectedLeague?.name ?? "League"} ({clubs.length} Clubs)
              </h2>
              <p className="mt-0.5 font-mono text-[11px] text-fog">
                Rename any club, change its 3-letter badge code, adjust Attack/Defense Poisson ratings, or edit the active league metadata.
              </p>
            </div>
            {selectedLeague && (
              <button
                type="button"
                onClick={() => {
                  setEditingLeague(!editingLeague);
                  setDraftLeagueName(selectedLeague.name);
                  setDraftLeagueShort(selectedLeague.shortName || "");
                  setDraftLeagueCountry(selectedLeague.country);
                }}
                className="rounded-control border border-peach bg-peach-dim px-3 py-1.5 font-mono text-xs font-bold text-peach"
              >
                {editingLeague ? "× Close League Editor" : `Edit "${selectedLeague.name}" Metadata`}
              </button>
            )}
          </div>

          {editingLeague && selectedLeague && (
            <form
              onSubmit={(e) => void handleSaveLeagueUnderground(e)}
              className="flex flex-wrap items-end gap-3 rounded-card border border-peach/50 bg-coal p-4"
            >
              <div className="flex-1">
                <label className="block font-mono text-[10px] uppercase text-fog">
                  Competition Name
                </label>
                <input
                  type="text"
                  value={draftLeagueName}
                  onChange={(e) => setDraftLeagueName(e.target.value)}
                  className="mt-1 w-full rounded-control border border-line bg-ink px-3 py-1.5 text-xs text-bone"
                />
              </div>
              <div className="w-32">
                <label className="block font-mono text-[10px] uppercase text-fog">
                  Short Code
                </label>
                <input
                  type="text"
                  value={draftLeagueShort}
                  onChange={(e) => setDraftLeagueShort(e.target.value)}
                  className="mt-1 w-full rounded-control border border-line bg-ink px-3 py-1.5 font-mono text-xs text-bone"
                />
              </div>
              <div className="w-44">
                <label className="block font-mono text-[10px] uppercase text-fog">Country</label>
                <input
                  type="text"
                  value={draftLeagueCountry}
                  onChange={(e) => setDraftLeagueCountry(e.target.value)}
                  className="mt-1 w-full rounded-control border border-line bg-ink px-3 py-1.5 text-xs text-bone"
                />
              </div>
              <button
                type="submit"
                className="rounded-control bg-peach px-4 py-1.5 font-mono text-xs font-bold uppercase text-ink"
              >
                Save League
              </button>
            </form>
          )}

          <div className="overflow-x-auto rounded-card border border-line bg-coal">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-line bg-graphite/60 font-mono text-[11px] uppercase text-fog">
                  <th className="px-4 py-3 font-semibold">Club Name</th>
                  <th className="px-4 py-3 font-semibold">Short Code</th>
                  <th className="px-4 py-3 text-right font-semibold">Attack Rating</th>
                  <th className="px-4 py-3 text-right font-semibold">Defense Rating</th>
                  <th className="px-4 py-3 text-right font-semibold">Underground Edit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {clubs.map((c) => {
                  const isEditing = editingClubId === c.id;
                  return (
                    <tr key={c.id} className="hover:bg-graphite/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <ClubBadge shortName={c.shortName} name={c.name} size="sm" />
                          {isEditing ? (
                            <input
                              type="text"
                              value={draftClubName}
                              onChange={(e) => setDraftClubName(e.target.value)}
                              className="w-48 rounded-control border border-peach bg-ink px-2 py-1 text-xs text-bone"
                            />
                          ) : (
                            <span className="font-semibold text-bone">{c.name}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-fog">
                        {isEditing ? (
                          <input
                            type="text"
                            value={draftClubShort}
                            onChange={(e) => setDraftClubShort(e.target.value)}
                            className="w-20 rounded-control border border-peach bg-ink px-2 py-1 font-mono text-xs uppercase text-bone"
                          />
                        ) : (
                          c.shortName
                        )}
                      </td>
                      <td className="tnum px-4 py-3 text-right font-mono text-bone">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.01"
                            min="0.40"
                            max="2.00"
                            value={draftAtt}
                            onChange={(e) => setDraftAtt(e.target.value)}
                            className="w-20 rounded-control border border-peach bg-ink px-2 py-1 text-right font-mono text-xs text-bone"
                          />
                        ) : (
                          (c.attackRating ?? 1.0).toFixed(2)
                        )}
                      </td>
                      <td className="tnum px-4 py-3 text-right font-mono text-bone">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.01"
                            min="0.40"
                            max="2.00"
                            value={draftDef}
                            onChange={(e) => setDraftDef(e.target.value)}
                            className="w-20 rounded-control border border-peach bg-ink px-2 py-1 text-right font-mono text-xs text-bone"
                          />
                        ) : (
                          (c.defenseRating ?? 1.0).toFixed(2)
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {isEditing ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => void handleSaveClubUnderground(c.id)}
                              className="rounded-control bg-peach px-2.5 py-1 text-[11px] font-bold text-ink"
                            >
                              Save Club
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingClubId(null)}
                              className="rounded-control border border-line bg-ink px-2.5 py-1 text-[11px] text-fog"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingClubId(c.id);
                              setDraftClubName(c.name);
                              setDraftClubShort(c.shortName);
                              setDraftAtt((c.attackRating ?? 1.0).toFixed(2));
                              setDraftDef((c.defenseRating ?? 1.0).toFixed(2));
                            }}
                            className="rounded-control border border-line bg-ink px-2.5 py-1 text-[11px] text-peach hover:border-peach"
                          >
                            Edit Club &amp; Ratings
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* =====================================================================
          TAB 4: TICKET ADJUDICATION & UNDERGROUND TICKET SURGERY DESK
         ===================================================================== */}
      {activeTab === "risk" && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-bone">
              Global Ticket Adjudication &amp; Underground Ticket Surgery ({adminBets.length})
            </h2>
            <span className="font-mono text-xs text-fog">
              Force-settle any pending ticket OR edit stake, recorded decimal odds, payout, and status underground on any ticket.
            </span>
          </div>

          <div className="overflow-x-auto rounded-card border border-line bg-coal">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-line bg-graphite/60 font-mono text-[11px] uppercase text-fog">
                  <th className="px-4 py-3 font-semibold">Trader</th>
                  <th className="px-4 py-3 font-semibold">Selections</th>
                  <th className="px-4 py-3 text-right font-semibold">Stake (XTS)</th>
                  <th className="px-4 py-3 text-right font-semibold">Recorded Odds</th>
                  <th className="px-4 py-3 text-right font-semibold">Return / Liability</th>
                  <th className="px-4 py-3 text-center font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">
                    Adjudication &amp; Underground Edit
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {adminBets.map((b) => {
                  const isEditingBet = editingBetId === b.id;
                  return (
                    <tr key={b.id} className="hover:bg-graphite/30">
                      <td className="px-4 py-3">
                        <span className="block font-semibold text-bone">
                          {b.userDisplayName}
                        </span>
                        <span className="font-mono text-[10px] text-fog">{b.userEmail}</span>
                      </td>
                      <td className="px-4 py-3">
                        <ul className="space-y-0.5">
                          {b.selections.map((s, idx) => (
                            <li key={idx} className="text-bone">
                              {s.label}{" "}
                              <span className="font-mono text-[10px] text-fog">
                                ({s.market})
                              </span>
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="tnum px-4 py-3 text-right font-mono text-bone">
                        {isEditingBet ? (
                          <input
                            type="number"
                            step="1"
                            value={betDraftStakeMajor}
                            onChange={(e) => setBetDraftStakeMajor(e.target.value)}
                            className="w-24 rounded-control border border-peach bg-ink px-2 py-1 text-right text-xs text-bone"
                          />
                        ) : (
                          formatMinor(b.stakeMinor)
                        )}
                      </td>
                      <td className="tnum px-4 py-3 text-right font-mono font-bold text-peach">
                        {isEditingBet ? (
                          <input
                            type="number"
                            step="0.05"
                            value={betDraftOdds}
                            onChange={(e) => setBetDraftOdds(e.target.value)}
                            className="w-20 rounded-control border border-peach bg-ink px-2 py-1 text-right text-xs text-bone"
                          />
                        ) : (
                          b.recordedOdds.toFixed(2)
                        )}
                      </td>
                      <td className="tnum px-4 py-3 text-right font-mono font-bold text-bone">
                        {isEditingBet ? (
                          <input
                            type="number"
                            step="1"
                            value={betDraftReturnMajor}
                            onChange={(e) => setBetDraftReturnMajor(e.target.value)}
                            placeholder="Payout XTS"
                            className="w-24 rounded-control border border-peach bg-ink px-2 py-1 text-right text-xs text-bone"
                          />
                        ) : b.returnMinor !== null && b.returnMinor !== undefined ? (
                          formatMinor(b.returnMinor)
                        ) : (
                          formatMinor(b.potentialReturnMinor)
                        )}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-[10px] uppercase">
                        {isEditingBet ? (
                          <select
                            value={betDraftStatus}
                            onChange={(e) => setBetDraftStatus(e.target.value)}
                            className="rounded-control border border-peach bg-ink px-2 py-1 font-mono text-xs text-bone"
                          >
                            <option value="pending">pending</option>
                            <option value="won">won</option>
                            <option value="lost">lost</option>
                            <option value="void">void</option>
                          </select>
                        ) : (
                          <span
                            className={`rounded-control px-2 py-0.5 font-bold ${
                              b.status === "won"
                                ? "bg-win/20 text-win"
                                : b.status === "lost"
                                  ? "bg-loss/20 text-loss"
                                  : b.status === "void"
                                    ? "bg-graphite text-fog"
                                    : "bg-peach-dim text-peach"
                            }`}
                          >
                            {b.status}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {isEditingBet ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => void handleSaveBetUnderground(b.id)}
                              className="rounded-control bg-peach px-2.5 py-1 text-[10px] font-bold text-ink"
                            >
                              Save Ticket
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingBetId(null)}
                              className="rounded-control border border-line bg-ink px-2 py-1 text-[10px] text-fog"
                            >
                              ×
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex flex-wrap items-center justify-end gap-1">
                            {b.status === "pending" && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => void handleForceSettleBet(b.id, "won")}
                                  className="rounded-control border border-win/50 bg-win/10 px-2 py-1 text-[10px] font-bold text-win hover:bg-win/20"
                                >
                                  Force WIN
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleForceSettleBet(b.id, "lost")}
                                  className="rounded-control border border-loss/50 bg-loss/10 px-2 py-1 text-[10px] font-bold text-loss hover:bg-loss/20"
                                >
                                  Force LOSS
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleForceSettleBet(b.id, "void")}
                                  className="rounded-control border border-line bg-ink px-2 py-1 text-[10px] text-fog hover:text-bone"
                                >
                                  Void
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingBetId(b.id);
                                setBetDraftStakeMajor(String((b.stakeMinor / 100).toFixed(2)));
                                setBetDraftOdds(String(b.recordedOdds.toFixed(2)));
                                setBetDraftReturnMajor(
                                  b.returnMinor !== null && b.returnMinor !== undefined
                                    ? String((b.returnMinor / 100).toFixed(2))
                                    : String((b.potentialReturnMinor / 100).toFixed(2)),
                                );
                                setBetDraftStatus(b.status);
                              }}
                              className="rounded-control border border-peach/40 bg-peach-dim px-2 py-1 text-[10px] font-bold text-peach"
                            >
                              Edit Underground
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* =====================================================================
          TAB 5: SPORTSBOOK REVENUE, GGR & MARKET EXPOSURE
         ===================================================================== */}
      {activeTab === "revenue" && revenue && (
        <div className="space-y-6">
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-card border border-line bg-coal p-4 font-mono">
              <span className="block text-[10px] uppercase text-fog">TOTAL HANDLE</span>
              <span className="tnum mt-1 block text-base font-bold text-bone">
                {formatMinor(revenue.totalHandleMinor)}
              </span>
            </div>
            <div className="rounded-card border border-line bg-coal p-4 font-mono">
              <span className="block text-[10px] uppercase text-fog">SETTLED PAYOUTS</span>
              <span className="tnum mt-1 block text-base font-bold text-bone">
                {formatMinor(revenue.totalPayoutsMinor)}
              </span>
            </div>
            <div className="rounded-card border border-line bg-coal p-4 font-mono">
              <span className="block text-[10px] uppercase text-fog">HOUSE GGR (NET)</span>
              <span
                className={`tnum mt-1 block text-base font-bold ${
                  revenue.grossGamingRevenueMinor >= 0 ? "text-win" : "text-loss"
                }`}
              >
                {formatMinor(revenue.grossGamingRevenueMinor)}
              </span>
            </div>
            <div className="rounded-card border border-line bg-coal p-4 font-mono">
              <span className="block text-[10px] uppercase text-fog">REALIZED HOLD %</span>
              <span className="tnum mt-1 block text-base font-bold text-peach">
                {revenue.holdPercent.toFixed(2)}%
              </span>
            </div>
            <div className="rounded-card border border-line bg-coal p-4 font-mono">
              <span className="block text-[10px] uppercase text-fog">OPEN IN-PLAY STAKE</span>
              <span className="tnum mt-1 block text-base font-bold text-peach">
                {formatMinor(revenue.openStakeMinor)}
              </span>
            </div>
            <div className="rounded-card border border-line bg-coal p-4 font-mono">
              <span className="block text-[10px] uppercase text-fog">MAX OPEN LIABILITY</span>
              <span className="tnum mt-1 block text-base font-bold text-loss">
                {formatMinor(revenue.maxOpenLiabilityMinor)}
              </span>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-bone">
              Market-by-Market Handle &amp; Open Exposure
            </h2>
            <div className="overflow-x-auto rounded-card border border-line bg-coal">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-line bg-graphite/60 font-mono text-[11px] uppercase text-fog">
                    <th className="px-4 py-3 font-semibold">Market Key</th>
                    <th className="px-4 py-3 text-right font-semibold">Selections</th>
                    <th className="px-4 py-3 text-right font-semibold">Allocated Handle</th>
                    <th className="px-4 py-3 text-right font-semibold">Open Liability</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {revenue.marketBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-fog">
                        No wagers recorded yet.
                      </td>
                    </tr>
                  ) : (
                    revenue.marketBreakdown.map((m) => (
                      <tr key={m.market} className="hover:bg-graphite/30">
                        <td className="px-4 py-3 font-mono font-semibold uppercase text-bone">
                          {m.market.replace(/_/g, " ")}
                        </td>
                        <td className="tnum px-4 py-3 text-right font-mono text-fog">
                          {m.selectionsCount}
                        </td>
                        <td className="tnum px-4 py-3 text-right font-mono font-bold text-bone">
                          {formatMinor(m.handleMinor)}
                        </td>
                        <td className="tnum px-4 py-3 text-right font-mono text-peach">
                          {formatMinor(m.openLiabilityMinor)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* =====================================================================
          TAB 6: GLOBAL LEDGER EXPLORER
         ===================================================================== */}
      {activeTab === "ledger" && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-bone">
              Global Double-Entry Financial Ledger Explorer ({ledgerEntries.length} Rows)
            </h2>
            <div className="flex flex-wrap items-center gap-1">
              {(
                [
                  "all",
                  "initial_grant",
                  "stake_reserve",
                  "settlement_win",
                  "settlement_loss",
                  "cashout_settlement",
                  "admin_adjustment",
                  "faucet_grant",
                ] as const
              ).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setLedgerKindFilter(k)}
                  className={`rounded-control border px-2 py-1 font-mono text-[10px] uppercase ${
                    ledgerKindFilter === k
                      ? "border-peach bg-peach-dim text-peach"
                      : "border-line bg-ink text-fog hover:text-bone"
                  }`}
                >
                  {k.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto rounded-card border border-line bg-coal">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-line bg-graphite/60 font-mono text-[11px] uppercase text-fog">
                  <th className="px-4 py-3 font-semibold">Trader</th>
                  <th className="px-4 py-3 font-semibold">Kind</th>
                  <th className="px-4 py-3 font-semibold">Description</th>
                  <th className="px-4 py-3 text-right font-semibold">Delta</th>
                  <th className="px-4 py-3 text-right font-semibold">Balance After</th>
                  <th className="px-4 py-3 text-right font-semibold">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {ledgerEntries.map((e) => (
                  <tr key={e.id} className="hover:bg-graphite/30">
                    <td className="px-4 py-3">
                      <span className="block font-semibold text-bone">
                        {e.userDisplayName}
                      </span>
                      <span className="font-mono text-[10px] text-fog">{e.userEmail}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[10px] uppercase text-peach">
                      {e.kind}
                    </td>
                    <td className="px-4 py-3 text-bone">{e.description}</td>
                    <td
                      className={`tnum px-4 py-3 text-right font-mono font-bold ${
                        e.amountMinor > 0
                          ? "text-win"
                          : e.amountMinor < 0
                            ? "text-loss"
                            : "text-fog"
                      }`}
                    >
                      {e.amountMinor > 0 ? "+" : ""}
                      {formatMinor(e.amountMinor)}
                    </td>
                    <td className="tnum px-4 py-3 text-right font-mono font-semibold text-bone">
                      {formatMinor(e.balanceAfterMinor)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[10px] text-fog">
                      {e.createdAt ? new Date(e.createdAt).toLocaleTimeString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* =====================================================================
          TAB 7: PRICING, SIMULATION ENGINE & SEASON ROLLOVER
         ===================================================================== */}
      {activeTab === "engine" && engineConfig && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-card border border-line bg-coal p-5">
            <h2 className="border-b border-line pb-3 font-mono text-xs font-bold uppercase tracking-wider text-bone">
              Bivariate Poisson, Bookmaker Margin &amp; Global Stake Limits
            </h2>
            <form
              onSubmit={(e) => void handleSaveEngineConfig(e)}
              className="mt-4 space-y-3.5 text-xs"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono text-[11px] uppercase text-fog">
                    Bookmaker Overround (1.045 = 4.5%)
                  </label>
                  <input
                    type="number"
                    step="0.005"
                    min="1.01"
                    max="1.20"
                    value={draftOverround}
                    onChange={(e) => setDraftOverround(e.target.value)}
                    className="mt-1 w-full rounded-control border border-line bg-ink px-3 py-2 font-mono text-bone"
                  />
                </div>

                <div>
                  <label className="block font-mono text-[11px] uppercase text-fog">
                    Home-Field Advantage (1.12)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1.00"
                    max="1.35"
                    value={draftHomeAdv}
                    onChange={(e) => setDraftHomeAdv(e.target.value)}
                    className="mt-1 w-full rounded-control border border-line bg-ink px-3 py-2 font-mono text-bone"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono text-[11px] uppercase text-fog">
                    Baseline Goals / Club (1.35)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="0.80"
                    max="2.20"
                    value={draftBaseGoals}
                    onChange={(e) => setDraftBaseGoals(e.target.value)}
                    className="mt-1 w-full rounded-control border border-line bg-ink px-3 py-2 font-mono text-bone"
                  />
                </div>

                <div>
                  <label className="block font-mono text-[11px] uppercase text-fog">
                    Sim Speed Multiplier (1-20x)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    max="20"
                    value={draftSimSpeed}
                    onChange={(e) => setDraftSimSpeed(e.target.value)}
                    className="mt-1 w-full rounded-control border border-line bg-ink px-3 py-2 font-mono text-bone"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono text-[11px] uppercase text-fog">
                    Global Min Stake (XTS)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={draftMinStakeMajor}
                    onChange={(e) => setDraftMinStakeMajor(e.target.value)}
                    className="mt-1 w-full rounded-control border border-line bg-ink px-3 py-2 font-mono text-bone"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[11px] uppercase text-fog">
                    Global Max Stake (XTS)
                  </label>
                  <input
                    type="number"
                    step="100"
                    value={draftMaxStakeMajor}
                    onChange={(e) => setDraftMaxStakeMajor(e.target.value)}
                    className="mt-1 w-full rounded-control border border-line bg-ink px-3 py-2 font-mono text-bone"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono text-[11px] uppercase text-fog">
                    Match Duration (Seconds)
                  </label>
                  <input
                    type="number"
                    step="30"
                    min="60"
                    max="1800"
                    value={draftMatchDuration}
                    onChange={(e) => setDraftMatchDuration(e.target.value)}
                    className="mt-1 w-full rounded-control border border-line bg-ink px-3 py-2 font-mono text-bone"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[11px] uppercase text-fog">
                    Pre-Match Break Window (Seconds)
                  </label>
                  <input
                    type="number"
                    step="30"
                    min="30"
                    max="1800"
                    value={draftPreMatchBreak}
                    onChange={(e) => setDraftPreMatchBreak(e.target.value)}
                    className="mt-1 w-full rounded-control border border-line bg-ink px-3 py-2 font-mono text-bone"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="min-h-[40px] w-full rounded-control bg-peach px-4 py-2 font-mono text-xs font-bold uppercase text-ink hover:opacity-90"
              >
                Save Engine Parameters &amp; Stake Limits
              </button>
            </form>

            {/* Simulation Pause, Maintenance Mode & Read-Only Diagnostic Controls */}
            <div className="mt-6 border-t border-line pt-4">
              <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-peach">
                Simulation Tick &amp; Platform Mode Controls (Safe Pause — Never Resets Scores)
              </h3>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() =>
                    void handleToggleSimControlFlag(
                      "simulationPaused",
                      !engineConfig.simulationPaused,
                    )
                  }
                  className={`rounded-control border px-3 py-2.5 font-mono text-xs font-bold uppercase ${
                    engineConfig.simulationPaused
                      ? "border-loss bg-loss/20 text-loss"
                      : "border-win/50 bg-win/15 text-win"
                  }`}
                >
                  {engineConfig.simulationPaused
                    ? "⏸ Sim Paused (Click to Resume)"
                    : "▶ Sim Running (Click to Pause)"}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void handleToggleSimControlFlag(
                      "maintenanceMode",
                      !engineConfig.maintenanceMode,
                    )
                  }
                  className={`rounded-control border px-3 py-2.5 font-mono text-xs font-bold uppercase ${
                    engineConfig.maintenanceMode
                      ? "border-peach bg-peach-dim text-peach"
                      : "border-line bg-ink text-bone hover:border-peach"
                  }`}
                >
                  {engineConfig.maintenanceMode
                    ? "🛠 Maintenance Mode ON (Bets Blocked)"
                    : "🛠 Maintenance Mode OFF"}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void handleToggleSimControlFlag(
                      "readOnlyDiagnosticMode",
                      !engineConfig.readOnlyDiagnosticMode,
                    )
                  }
                  className={`rounded-control border px-3 py-2.5 font-mono text-xs font-bold uppercase ${
                    engineConfig.readOnlyDiagnosticMode
                      ? "border-live bg-live/20 text-live"
                      : "border-line bg-ink text-fog hover:text-bone"
                  }`}
                >
                  {engineConfig.readOnlyDiagnosticMode
                    ? "🔍 Diagnostic Mode ON"
                    : "🔍 Diagnostic Mode OFF"}
                </button>
              </div>
            </div>
          </section>

          <div className="space-y-6">
            <section className="rounded-card border border-line bg-coal p-5">
              <h2 className="border-b border-line pb-3 font-mono text-xs font-bold uppercase tracking-wider text-bone">
                Global 27-Market Re-Pricing Action
              </h2>
              <p className="mt-3 text-xs leading-relaxed text-fog">
                Recompute all 27 markets across every upcoming fixture using current club Attack/Defense ratings and bookmaker overround.
              </p>
              <button
                type="button"
                onClick={() => void handleRepriceAll()}
                className="mt-4 min-h-[42px] w-full rounded-control border border-peach bg-peach-dim px-4 py-2 font-mono text-xs font-bold uppercase text-peach hover:opacity-90"
              >
                ↻ Re-Price All Upcoming Fixtures (27 Markets)
              </button>
            </section>

            <section className="rounded-card border border-line bg-coal p-5">
              <h2 className="border-b border-line pb-3 font-mono text-xs font-bold uppercase tracking-wider text-bone">
                Multi-Season Universe &amp; Matchday Generator
              </h2>
              <p className="mt-3 text-xs leading-relaxed text-fog">
                Append new round-robin matchdays across all 6 European leagues with full 27-market odds snapshots so the football universe continues indefinitely.
              </p>
              <div className="mt-4 flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={rolloverMatchdays}
                  onChange={(e) => setRolloverMatchdays(e.target.value)}
                  className="w-24 rounded-control border border-line bg-ink px-3 py-2 font-mono text-xs text-bone"
                />
                <button
                  type="button"
                  onClick={() => void handleRolloverSeason()}
                  className="min-h-[40px] flex-1 rounded-control bg-win px-4 py-2 font-mono text-xs font-bold uppercase text-ink hover:opacity-90"
                >
                  + Generate Matchdays Across All 6 Leagues
                </button>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* =====================================================================
          PANEL 5: FRAUD, SHARP SYNDICATE & WHALE LIABILITY RADAR
         ===================================================================== */}
      {activeTab === "radar" && riskRadar && (
        <div className="space-y-6">
          {/* Fixture Liability Hotspots */}
          <section className="space-y-3">
            <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-bone">
              1. Fixture Liability Concentration Hotspots ({riskRadar.fixtureHotspots.length})
            </h2>
            <div className="overflow-x-auto rounded-card border border-line bg-coal">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-line bg-graphite/60 font-mono text-[11px] uppercase text-fog">
                    <th className="px-4 py-3 font-semibold">Fixture</th>
                    <th className="px-4 py-3 text-right font-semibold">Open Tickets</th>
                    <th className="px-4 py-3 text-right font-semibold">Open Stake (XTS)</th>
                    <th className="px-4 py-3 text-right font-semibold">Max House Exposure</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {riskRadar.fixtureHotspots.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center font-mono text-fog">
                        No open fixture liability exposure right now.
                      </td>
                    </tr>
                  ) : (
                    riskRadar.fixtureHotspots.map((fh) => (
                      <tr key={fh.fixtureId} className="hover:bg-graphite/30">
                        <td className="px-4 py-3 font-semibold text-bone">{fh.matchLabel}</td>
                        <td className="tnum px-4 py-3 text-right font-mono text-fog">
                          {fh.openTicketsCount}
                        </td>
                        <td className="tnum px-4 py-3 text-right font-mono text-peach">
                          {formatMinor(fh.openStakeMinor)}
                        </td>
                        <td className="tnum px-4 py-3 text-right font-mono font-bold text-loss">
                          {formatMinor(fh.maxLiabilityMinor)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Whale Liability Ticket Alerts */}
          <section className="space-y-3">
            <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-bone">
              2. Whale Liability &amp; High-Odds Sniper Alerts ({riskRadar.whaleAlerts.length})
            </h2>
            <div className="overflow-x-auto rounded-card border border-line bg-coal">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-line bg-graphite/60 font-mono text-[11px] uppercase text-fog">
                    <th className="px-4 py-3 font-semibold">Trader</th>
                    <th className="px-4 py-3 font-semibold">Risk Flag</th>
                    <th className="px-4 py-3 text-right font-semibold">Legs</th>
                    <th className="px-4 py-3 text-right font-semibold">Stake</th>
                    <th className="px-4 py-3 text-right font-semibold">Combined Odds</th>
                    <th className="px-4 py-3 text-right font-semibold">Potential Payout</th>
                    <th className="px-4 py-3 text-center font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {riskRadar.whaleAlerts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center font-mono text-fog">
                        No whale tickets detected above threshold.
                      </td>
                    </tr>
                  ) : (
                    riskRadar.whaleAlerts.map((wa) => (
                      <tr key={wa.betId} className="hover:bg-graphite/30">
                        <td className="px-4 py-3">
                          <span className="block font-semibold text-bone">
                            {wa.userDisplayName}
                          </span>
                          <span className="font-mono text-[10px] text-fog">{wa.userEmail}</span>
                        </td>
                        <td className="px-4 py-3 font-mono text-[10px]">
                          <span className="rounded-control bg-peach-dim px-2 py-0.5 font-bold text-peach">
                            {wa.riskFlag}
                          </span>
                        </td>
                        <td className="tnum px-4 py-3 text-right font-mono text-fog">
                          {wa.legsCount}
                        </td>
                        <td className="tnum px-4 py-3 text-right font-mono text-bone">
                          {formatMinor(wa.stakeMinor)}
                        </td>
                        <td className="tnum px-4 py-3 text-right font-mono font-bold text-peach">
                          @{wa.recordedOdds.toFixed(2)}
                        </td>
                        <td className="tnum px-4 py-3 text-right font-mono font-bold text-loss">
                          {formatMinor(wa.potentialReturnMinor)}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-[10px] uppercase text-bone">
                          {wa.status}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Sharp / Syndicate Trader Profiling */}
          <section className="space-y-3">
            <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-bone">
              3. Sharp &amp; Syndicate Account Threat Profiling ({riskRadar.sharpProfiles.length})
            </h2>
            <div className="overflow-x-auto rounded-card border border-line bg-coal">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-line bg-graphite/60 font-mono text-[11px] uppercase text-fog">
                    <th className="px-4 py-3 font-semibold">Trader</th>
                    <th className="px-4 py-3 font-semibold">KYC / Risk</th>
                    <th className="px-4 py-3 text-right font-semibold">Tickets</th>
                    <th className="px-4 py-3 text-right font-semibold">Win Rate</th>
                    <th className="px-4 py-3 text-right font-semibold">ROI %</th>
                    <th className="px-4 py-3 text-right font-semibold">Net P&amp;L</th>
                    <th className="px-4 py-3 text-right font-semibold">Sharp Threat Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {riskRadar.sharpProfiles.map((sp) => (
                    <tr key={sp.userId} className="hover:bg-graphite/30">
                      <td className="px-4 py-3">
                        <span className="block font-semibold text-bone">{sp.displayName}</span>
                        <span className="font-mono text-[10px] text-fog">{sp.email}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[10px]">
                        <span className="mr-1.5 rounded-control bg-graphite px-2 py-0.5 text-bone">
                          {sp.kycTier}
                        </span>
                        <span className="rounded-control bg-peach-dim px-2 py-0.5 font-bold text-peach">
                          {sp.riskFlag}
                        </span>
                      </td>
                      <td className="tnum px-4 py-3 text-right font-mono text-fog">
                        {sp.totalBets}
                      </td>
                      <td className="tnum px-4 py-3 text-right font-mono text-bone">
                        {sp.winRate}%
                      </td>
                      <td
                        className={`tnum px-4 py-3 text-right font-mono font-bold ${
                          sp.roiPercent >= 0 ? "text-win" : "text-loss"
                        }`}
                      >
                        {sp.roiPercent >= 0 ? `+${sp.roiPercent}%` : `${sp.roiPercent}%`}
                      </td>
                      <td
                        className={`tnum px-4 py-3 text-right font-mono font-bold ${
                          sp.netPnlMinor >= 0 ? "text-win" : "text-loss"
                        }`}
                      >
                        {sp.netPnlMinor >= 0 ? "+" : ""}
                        {formatMinor(sp.netPnlMinor)}
                      </td>
                      <td className="tnum px-4 py-3 text-right font-mono">
                        <span
                          className={`rounded-control px-2.5 py-0.5 font-bold ${
                            sp.sharpThreatScore >= 50
                              ? "bg-loss/20 text-loss"
                              : sp.sharpThreatScore >= 25
                                ? "bg-live/20 text-live"
                                : "bg-win/20 text-win"
                          }`}
                        >
                          {sp.sharpThreatScore} / 100
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* =====================================================================
          PANEL 6: VIP TREASURY AIRDROP, PROMO BONUS CODES & BROADCAST BANNER
         ===================================================================== */}
      {activeTab === "promotions" && promotions && (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Bulk Treasury Airdrop */}
            <section className="rounded-card border border-line bg-coal p-5">
              <h2 className="border-b border-line pb-3 font-mono text-xs font-bold uppercase tracking-wider text-peach">
                1. Mass VIP Treasury Airdrop (Instant Segment Credit)
              </h2>
              <p className="mt-2 text-xs text-fog">
                Simultaneously credit simulated XTS to every trader in a target segment with full double-entry ledger audit records.
              </p>
              <form
                onSubmit={(e) => void handleTriggerBulkAirdrop(e)}
                className="mt-4 space-y-3 text-xs"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-mono text-[10px] uppercase text-fog">
                      Target Trader Segment
                    </label>
                    <select
                      value={airdropSegment}
                      onChange={(e) => setAirdropSegment(e.target.value)}
                      className="mt-1 w-full rounded-control border border-line bg-ink px-3 py-2 font-mono text-bone"
                    >
                      <option value="ALL">ALL ACTIVE TRADERS</option>
                      <option value="VERIFIED">KYC VERIFIED TRADERS ONLY</option>
                      <option value="VIP">VIP_PRO &amp; INSTITUTIONAL ONLY</option>
                      <option value="UNVERIFIED">NEW / UNVERIFIED SIGNUPS</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-mono text-[10px] uppercase text-fog">
                      Airdrop Amount Per User (XTS)
                    </label>
                    <input
                      type="number"
                      step="100"
                      min="10"
                      value={airdropMajorAmount}
                      onChange={(e) => setAirdropMajorAmount(e.target.value)}
                      className="mt-1 w-full rounded-control border border-line bg-ink px-3 py-2 font-mono font-bold text-bone"
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-mono text-[10px] uppercase text-fog">
                    Ledger Audit Description
                  </label>
                  <input
                    type="text"
                    value={airdropReason}
                    onChange={(e) => setAirdropReason(e.target.value)}
                    className="mt-1 w-full rounded-control border border-line bg-ink px-3 py-2 text-bone"
                  />
                </div>
                <button
                  type="submit"
                  className="min-h-[40px] w-full rounded-control bg-win px-4 py-2 font-mono text-xs font-bold uppercase text-ink hover:opacity-90"
                >
                  ⚡ Execute Mass Treasury Airdrop
                </button>
              </form>
            </section>

            {/* Global System Broadcast Banner */}
            <section className="rounded-card border border-line bg-coal p-5">
              <h2 className="border-b border-line pb-3 font-mono text-xs font-bold uppercase tracking-wider text-bone">
                2. Global Exchange Broadcast &amp; Announcement Banner
              </h2>
              <form
                onSubmit={(e) => void handleSaveBroadcast(e)}
                className="mt-4 space-y-3 text-xs"
              >
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 font-mono text-xs font-bold text-peach">
                    <input
                      type="checkbox"
                      checked={bcastActive}
                      onChange={(e) => setBcastActive(e.target.checked)}
                    />
                    Broadcast Active Across Platform
                  </label>
                  <div>
                    <select
                      value={bcastSeverity}
                      onChange={(e) => setBcastSeverity(e.target.value)}
                      className="w-full rounded-control border border-line bg-ink px-3 py-1.5 font-mono text-xs text-bone"
                    >
                      <option value="info">INFO (Steel Blue)</option>
                      <option value="warning">WARNING (Amber)</option>
                      <option value="critical">CRITICAL ALERT (Red)</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block font-mono text-[10px] uppercase text-fog">
                    Banner Headline
                  </label>
                  <input
                    type="text"
                    value={bcastHeadline}
                    onChange={(e) => setBcastHeadline(e.target.value)}
                    className="mt-1 w-full rounded-control border border-line bg-ink px-3 py-2 font-semibold text-bone"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[10px] uppercase text-fog">
                    Announcement Details
                  </label>
                  <input
                    type="text"
                    value={bcastMessage}
                    onChange={(e) => setBcastMessage(e.target.value)}
                    className="mt-1 w-full rounded-control border border-line bg-ink px-3 py-2 text-bone"
                  />
                </div>
                <button
                  type="submit"
                  className="min-h-[40px] w-full rounded-control bg-peach px-4 py-2 font-mono text-xs font-bold uppercase text-ink"
                >
                  Publish Broadcast Banner
                </button>
              </form>
            </section>
          </div>

          {/* Promo Bonus Codes Manager */}
          <section className="rounded-card border border-line bg-coal p-5">
            <h2 className="border-b border-line pb-3 font-mono text-xs font-bold uppercase tracking-wider text-bone">
              3. Promo Bonus Codes &amp; Campaign Manager ({promotions.promoCodes.length})
            </h2>
            <form
              onSubmit={(e) => void handleCreatePromoCode(e)}
              className="mt-4 grid gap-3 sm:grid-cols-4"
            >
              <input
                type="text"
                required
                value={newPromoCode}
                onChange={(e) => setNewPromoCode(e.target.value.toUpperCase())}
                placeholder="CODE (e.g. VIP5000)"
                className="rounded-control border border-line bg-ink px-3 py-2 font-mono text-xs uppercase text-bone"
              />
              <input
                type="number"
                step="100"
                value={newPromoMajor}
                onChange={(e) => setNewPromoMajor(e.target.value)}
                placeholder="Bonus XTS"
                className="rounded-control border border-line bg-ink px-3 py-2 font-mono text-xs text-bone"
              />
              <input
                type="number"
                value={newPromoMaxClaims}
                onChange={(e) => setNewPromoMaxClaims(e.target.value)}
                placeholder="Max Claims"
                className="rounded-control border border-line bg-ink px-3 py-2 font-mono text-xs text-bone"
              />
              <button
                type="submit"
                className="rounded-control bg-peach px-4 py-2 font-mono text-xs font-bold uppercase text-ink"
              >
                + Create Promo Code
              </button>
            </form>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-line bg-graphite/60 font-mono text-[11px] uppercase text-fog">
                    <th className="px-4 py-2.5">Code</th>
                    <th className="px-4 py-2.5 text-right">Bonus Grant</th>
                    <th className="px-4 py-2.5 text-right">Claims</th>
                    <th className="px-4 py-2.5 text-center">Status</th>
                    <th className="px-4 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line font-mono">
                  {promotions.promoCodes.map((pc) => (
                    <tr key={pc.id}>
                      <td className="px-4 py-2.5 font-bold text-peach">{pc.code}</td>
                      <td className="tnum px-4 py-2.5 text-right text-bone">
                        {formatMinor(pc.bonusMinor)}
                      </td>
                      <td className="tnum px-4 py-2.5 text-right text-fog">
                        {pc.claimedCount} / {pc.maxClaims}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span
                          className={`rounded-control px-2 py-0.5 text-[10px] font-bold ${
                            pc.isActive
                              ? "bg-win/20 text-win"
                              : "bg-loss/20 text-loss"
                          }`}
                        >
                          {pc.isActive ? "ACTIVE" : "PAUSED"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => void handleTogglePromoCode(pc.id)}
                          className="rounded-control border border-line bg-ink px-2.5 py-1 text-[10px] text-bone hover:border-peach"
                        >
                          {pc.isActive ? "Pause Code" : "Activate Code"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* =====================================================================
          PANEL 7: UNDERGROUND DATABASE TABLE INSPECTOR & EMERGENCY OPS
         ===================================================================== */}
      {activeTab === "database" && dbInspector && (
        <div className="space-y-6">
          {/* Emergency Global Kill-Switches & Matchday Triggers */}
          <section className="rounded-card border border-loss/50 bg-coal p-5">
            <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-loss">
              1. Underground Emergency Global Operations &amp; Kill-Switches
            </h2>
            <p className="mt-1 text-xs text-fog">
              Execute immediate platform-wide operations across all 6 European leagues and active wallets. Every action writes an immutable audit log.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <button
                type="button"
                onClick={() =>
                  void handleEmergencyAction(
                    "SUSPEND_ALL_MARKETS",
                    "Global 27-Market Trading Freeze",
                  )
                }
                className="rounded-control border border-loss bg-loss/15 px-3 py-3 font-mono text-xs font-bold uppercase text-loss hover:bg-loss/25"
              >
                ⏸ Freeze All 27 Markets Globally
              </button>
              <button
                type="button"
                onClick={() =>
                  void handleEmergencyAction(
                    "RESUME_ALL_MARKETS",
                    "Global 27-Market Trading Resume",
                  )
                }
                className="rounded-control border border-win bg-win/15 px-3 py-3 font-mono text-xs font-bold uppercase text-win hover:bg-win/25"
              >
                ▶ Resume All 27 Markets Globally
              </button>
              <button
                type="button"
                onClick={() =>
                  void handleEmergencyAction(
                    "VOID_ALL_PENDING_BETS",
                    "Void & 100% Refund All Open Tickets",
                  )
                }
                className="rounded-control border border-peach bg-peach-dim px-3 py-3 font-mono text-xs font-bold uppercase text-peach hover:opacity-90"
              >
                ↺ Void &amp; Refund All Open Tickets
              </button>
              <button
                type="button"
                onClick={() =>
                  void handleEmergencyAction(
                    "FORCE_KICKOFF_NEXT_MATCHDAY",
                    "Force Immediate Matchday Kickoff",
                  )
                }
                className="rounded-control border border-line bg-graphite px-3 py-3 font-mono text-xs font-bold uppercase text-bone hover:border-peach"
              >
                ⚡ Force Kickoff Next Matchday Now
              </button>
            </div>
          </section>

          {/* PostgreSQL Table Row Counts */}
          <section className="space-y-3">
            <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-bone">
              2. PostgreSQL 16 Live Schema &amp; Table Row Counts (Click to Inspect Raw JSON Rows)
            </h2>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
              {dbInspector.tableCounts.map((tc) => (
                <button
                  key={tc.table}
                  type="button"
                  onClick={() => setSelectedDbTable(tc.table)}
                  className={`rounded-card border p-3 text-left font-mono transition-colors ${
                    selectedDbTable === tc.table
                      ? "border-peach bg-peach-dim text-peach"
                      : "border-line bg-coal text-bone hover:border-peach/50"
                  }`}
                >
                  <span className="block text-[10px] uppercase text-fog">{tc.table}</span>
                  <span className="tnum mt-1 block text-lg font-bold">{tc.rows}</span>
                  <span className="mt-0.5 block truncate text-[9px] text-fog">
                    {tc.description}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* Raw Database Rows Explorer */}
          <section className="rounded-card border border-line bg-coal p-5">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="font-mono text-xs font-bold uppercase text-peach">
                Raw PostgreSQL Table Inspector: public.{dbInspector.selectedTable} (Latest{" "}
                {dbInspector.sampleRows.length} Rows)
              </h3>
            </div>
            <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto font-mono text-[11px]">
              {dbInspector.sampleRows.length === 0 ? (
                <p className="text-fog">
                  Select `users`, `wallets`, `bets`, `fixtures`, `clubs`, or `audit_records` above to inspect live rows.
                </p>
              ) : (
                dbInspector.sampleRows.map((row, idx) => (
                  <pre
                    key={idx}
                    className="overflow-x-auto rounded-control border border-line bg-ink p-2.5 text-bone"
                  >
                    {JSON.stringify(row, null, 2)}
                  </pre>
                ))
              )}
            </div>
          </section>
        </div>
      )}

      {/* =====================================================================
          PANEL 11: SYSTEM HEALTH & INVARIANTS
         ===================================================================== */}
      {activeTab === "health" && (
        <div className="space-y-6">
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "EUROPEAN LEAGUES", val: status.world.leagues },
              { label: "REGISTERED CLUBS", val: status.world.clubs },
              { label: "TOTAL FIXTURES", val: status.world.totalFixtures },
              { label: "MARKETS PER MATCH", val: status.world.marketsPerFixture },
              { label: "LIVE MATCHES", val: status.world.liveFixtures },
              { label: "UPCOMING MATCHES", val: status.world.upcomingFixtures },
              { label: "SETTLED MATCHES", val: status.world.completedFixtures },
              { label: "IMMUTABLE LEDGER ROWS", val: status.ledger.ledgerEntries },
            ].map((m) => (
              <div
                key={m.label}
                className="rounded-card border border-line bg-coal p-4 font-mono"
              >
                <span className="block text-[10px] uppercase text-fog">{m.label}</span>
                <span className="tnum mt-1 block text-xl font-bold text-bone">
                  {m.val}
                </span>
              </div>
            ))}
          </section>

          <section className="space-y-3">
            <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-bone">
              Integrity &amp; Consistency Invariant Checks
            </h2>
            <div className="divide-y divide-line overflow-hidden rounded-card border border-line bg-coal">
              {status.integrityChecks.map((chk) => (
                <div
                  key={chk.key}
                  className="flex flex-wrap items-center justify-between gap-4 px-4 py-3.5 text-xs"
                >
                  <div>
                    <span className="font-semibold text-bone">{chk.label}</span>
                    <p className="mt-0.5 font-mono text-[11px] text-fog">{chk.detail}</p>
                  </div>
                  <span
                    className={`rounded-control border px-2.5 py-1 font-mono text-[11px] font-bold ${
                      chk.status === "PASS"
                        ? "border-win/40 bg-win/15 text-win"
                        : chk.status === "WARN"
                          ? "border-peach/40 bg-peach-dim text-peach"
                          : "border-loss/40 bg-loss/15 text-loss"
                    }`}
                  >
                    {chk.status}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* =====================================================================
          TAB 2: STAFF, MODERATORS, GRANULAR RBAC PERMISSIONS & INVITE SYSTEM
         ===================================================================== */}
      {activeTab === "staff" && staffData && (
        <div className="space-y-6">
          {/* 1. Invite New Staff / Moderator Form + Single-Use Token Acceptance Tester */}
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-card border border-line bg-coal p-5">
              <h2 className="border-b border-line pb-3 font-mono text-xs font-bold uppercase tracking-wider text-peach">
                1. Invite Staff or Moderator (Single-Use 24h SHA-256 Token)
              </h2>
              <p className="mt-2 text-xs text-fog">
                Create a cryptographically random, single-use staff invitation with granular permissions. Only a Super Admin can grant Super Admin privileges.
              </p>
              <form
                onSubmit={(e) => void handleCreateStaffInvitation(e)}
                className="mt-4 space-y-3 text-xs"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-mono text-[10px] uppercase text-fog">
                      Staff Full Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Alex Mercer"
                      value={invStaffName}
                      onChange={(e) => setInvStaffName(e.target.value)}
                      className="mt-1 w-full rounded-control border border-line bg-ink px-3 py-2 text-bone"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-[10px] uppercase text-fog">
                      Staff Email Address
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="moderator@vfn.eu"
                      value={invStaffEmail}
                      onChange={(e) => setInvStaffEmail(e.target.value)}
                      className="mt-1 w-full rounded-control border border-line bg-ink px-3 py-2 font-mono text-bone"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-mono text-[10px] uppercase text-fog">
                      Role Hierarchy Template
                    </label>
                    <select
                      value={invStaffRole}
                      onChange={(e) => handleSelectInviteRoleTemplate(e.target.value)}
                      className="mt-1 w-full rounded-control border border-line bg-ink px-3 py-2 font-mono text-bone"
                    >
                      <option value="MODERATOR">MODERATOR (User &amp; Compliance)</option>
                      <option value="SUPPORT_ADMIN">SUPPORT_ADMIN (Support &amp; Sessions)</option>
                      <option value="TRADING_ADMIN">TRADING_ADMIN (Odds &amp; Markets)</option>
                      <option value="LEDGER_AUDITOR">LEDGER_AUDITOR (Read-Only Finance)</option>
                      <option value="OPERATIONS_ADMIN">OPERATIONS_ADMIN (Simulation &amp; Ops)</option>
                      <option value="SUPER_ADMIN">SUPER_ADMIN (Full Platform Control)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-mono text-[10px] uppercase text-fog">
                      Token Expiry Window (Hours)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="168"
                      value={invStaffExpiryHours}
                      onChange={(e) => setInvStaffExpiryHours(e.target.value)}
                      className="mt-1 w-full rounded-control border border-line bg-ink px-3 py-2 font-mono text-bone"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase text-fog">
                    Granular Permission Matrix ({invStaffPerms.length} selected)
                  </label>
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5 rounded-control border border-line bg-ink p-2.5 sm:grid-cols-3">
                    {(staffData.roleTemplates?.SUPER_ADMIN || []).map((perm) => (
                      <label
                        key={perm}
                        className="flex items-center gap-1.5 font-mono text-[10px] text-bone"
                      >
                        <input
                          type="checkbox"
                          checked={invStaffPerms.includes(perm)}
                          onChange={() => toggleInvitePermission(perm)}
                        />
                        <span className="truncate">{perm}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase text-fog">
                    Internal Compliance / Onboarding Note
                  </label>
                  <input
                    type="text"
                    placeholder="European shift compliance moderator"
                    value={invStaffNote}
                    onChange={(e) => setInvStaffNote(e.target.value)}
                    className="mt-1 w-full rounded-control border border-line bg-ink px-3 py-2 text-bone"
                  />
                </div>

                <button
                  type="submit"
                  className="min-h-[40px] w-full rounded-control bg-peach px-4 py-2 font-mono text-xs font-bold uppercase text-ink hover:opacity-90"
                >
                  + Issue Single-Use Staff Invitation
                </button>
              </form>

              {latestIssuedInviteToken && (
                <div className="mt-4 rounded-control border border-win/50 bg-win/10 p-3 font-mono text-xs">
                  <span className="block text-[10px] font-bold uppercase text-win">
                    SINGLE-USE INVITE TOKEN ISSUED (STORED AS SHA-256 HASH IN DB):
                  </span>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <code className="break-all font-bold text-bone">
                      {latestIssuedInviteToken}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard?.writeText(latestIssuedInviteToken);
                        setAcceptTokenInput(latestIssuedInviteToken);
                        setBannerMsg("Copied single-use invite token to clipboard.");
                      }}
                      className="shrink-0 rounded-control border border-win bg-ink px-2.5 py-1 text-[10px] font-bold text-win"
                    >
                      Copy Token
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* Staff Invitation Acceptance & Account Activation Desk */}
            <section className="rounded-card border border-line bg-coal p-5">
              <h2 className="border-b border-line pb-3 font-mono text-xs font-bold uppercase tracking-wider text-bone">
                2. Accept Staff Invitation &amp; Activate Role (Single-Use Verification)
              </h2>
              <p className="mt-2 text-xs text-fog">
                Redeem a pending `vfu_inv_...` token to atomically activate the staff account, bind the assigned RBAC permissions, and lock the invitation against reuse.
              </p>
              <form
                onSubmit={(e) => void handleAcceptStaffInvitation(e)}
                className="mt-4 space-y-3 text-xs"
              >
                <div>
                  <label className="block font-mono text-[10px] uppercase text-fog">
                    Single-Use Invitation Token
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="vfu_inv_..."
                    value={acceptTokenInput}
                    onChange={(e) => setAcceptTokenInput(e.target.value)}
                    className="mt-1 w-full rounded-control border border-line bg-ink px-3 py-2 font-mono text-bone"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-mono text-[10px] uppercase text-fog">
                      Confirm Display Name (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="Uses invite name if blank"
                      value={acceptDisplayNameInput}
                      onChange={(e) => setAcceptDisplayNameInput(e.target.value)}
                      className="mt-1 w-full rounded-control border border-line bg-ink px-3 py-2 text-bone"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-[10px] uppercase text-fog">
                      Set Operator Password (Min 8 chars)
                    </label>
                    <input
                      type="text"
                      required
                      value={acceptPasswordInput}
                      onChange={(e) => setAcceptPasswordInput(e.target.value)}
                      className="mt-1 w-full rounded-control border border-line bg-ink px-3 py-2 font-mono text-bone"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="min-h-[40px] w-full rounded-control bg-win px-4 py-2 font-mono text-xs font-bold uppercase text-ink hover:opacity-90"
                >
                  ✓ Validate Token &amp; Activate Staff Account
                </button>
              </form>

              {/* Invitations Lifecycle Table */}
              <div className="mt-6 border-t border-line pt-4">
                <h3 className="font-mono text-xs font-bold uppercase text-bone">
                  Staff Invitations Registry ({staffData.invitations.length})
                </h3>
                <div className="mt-2.5 max-h-[260px] overflow-y-auto rounded-control border border-line bg-ink">
                  <table className="w-full border-collapse text-left text-[11px]">
                    <thead>
                      <tr className="border-b border-line bg-graphite/60 font-mono text-[10px] uppercase text-fog">
                        <th className="px-3 py-2">Invitee</th>
                        <th className="px-3 py-2">Role</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line font-mono">
                      {staffData.invitations.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-3 py-4 text-center text-fog">
                            No staff invitations issued yet.
                          </td>
                        </tr>
                      ) : (
                        staffData.invitations.map((inv) => (
                          <tr key={inv.id}>
                            <td className="px-3 py-2">
                              <span className="block font-bold text-bone">{inv.staffName}</span>
                              <span className="text-[10px] text-fog">{inv.email}</span>
                            </td>
                            <td className="px-3 py-2 text-peach">
                              {inv.role} ({inv.permissions.length})
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={`rounded-control px-2 py-0.5 text-[10px] font-bold ${
                                  inv.status === "Accepted"
                                    ? "bg-win/20 text-win"
                                    : inv.status === "Pending"
                                      ? "bg-peach-dim text-peach"
                                      : "bg-loss/20 text-loss"
                                }`}
                              >
                                {inv.status}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right">
                              {inv.status !== "Accepted" && (
                                <div className="inline-flex gap-1">
                                  <button
                                    type="button"
                                    onClick={() => void handleResendStaffInvitation(inv.id)}
                                    className="rounded-control border border-line bg-coal px-2 py-0.5 text-[10px] text-bone hover:border-peach"
                                  >
                                    Resend
                                  </button>
                                  {inv.status === "Pending" && (
                                    <button
                                      type="button"
                                      onClick={() => void handleRevokeStaffInvitation(inv.id)}
                                      className="rounded-control border border-loss/50 bg-loss/10 px-2 py-0.5 text-[10px] text-loss"
                                    >
                                      Revoke
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </div>

          {/* 3. Active Staff & Moderator Directory + Granular Permission Editor */}
          <section className="rounded-card border border-line bg-coal p-5">
            <h2 className="border-b border-line pb-3 font-mono text-xs font-bold uppercase tracking-wider text-bone">
              3. Active Staff &amp; Moderator Directory ({staffData.staff.length})
            </h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-line bg-graphite/60 font-mono text-[11px] uppercase text-fog">
                    <th className="px-4 py-2.5">Operator</th>
                    <th className="px-4 py-2.5">Role</th>
                    <th className="px-4 py-2.5">Effective Granular Permissions</th>
                    <th className="px-4 py-2.5">Session / Last Login</th>
                    <th className="px-4 py-2.5 text-center">Status</th>
                    <th className="px-4 py-2.5 text-right">RBAC &amp; Session Controls</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line font-mono">
                  {staffData.staff.map((stf) => (
                    <tr key={stf.id} className="hover:bg-graphite/30">
                      <td className="px-4 py-3">
                        <span className="block font-bold text-bone">{stf.displayName}</span>
                        <span className="text-[10px] text-fog">{stf.email}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-control bg-peach-dim px-2 py-0.5 text-[10px] font-bold text-peach">
                          {stf.role}
                        </span>
                      </td>
                      <td className="max-w-md px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {stf.permissions.map((p) => (
                            <span
                              key={p}
                              className="rounded-control border border-line bg-ink px-1.5 py-0.5 text-[9px] text-bone"
                            >
                              {p}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[10px] text-fog">
                        <span className="block text-bone">Session v{stf.sessionVersion}</span>
                        <span>
                          {stf.lastLoginAt
                            ? new Date(stf.lastLoginAt).toLocaleString()
                            : "No login yet"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`rounded-control px-2 py-0.5 text-[10px] font-bold ${
                            stf.isActive ? "bg-win/20 text-win" : "bg-loss/20 text-loss"
                          }`}
                        >
                          {stf.isActive ? "ACTIVE" : "SUSPENDED"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex flex-wrap justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingStaffId(stf.id);
                              setEditStaffRole(stf.role);
                              setEditStaffPerms(stf.permissions);
                            }}
                            className="rounded-control border border-peach bg-peach-dim px-2.5 py-1 text-[10px] font-bold text-peach"
                          >
                            Edit Permissions
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleRevokeUserSessions(stf.id, stf.email)}
                            className="rounded-control border border-line bg-ink px-2 py-1 text-[10px] text-bone hover:border-peach"
                          >
                            Revoke Sessions
                          </button>
                          {stf.id !== user.id && (
                            <button
                              type="button"
                              onClick={() => void handleToggleStaffStatus(stf.id, !stf.isActive)}
                              className="rounded-control border border-loss/50 bg-loss/10 px-2 py-1 text-[10px] text-loss"
                            >
                              {stf.isActive ? "Suspend Staff" : "Reactivate"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {editingStaffId && (
              <div className="mt-4 rounded-control border border-peach bg-ink p-4 font-mono text-xs">
                <div className="flex items-center justify-between border-b border-line pb-2">
                  <span className="font-bold uppercase text-peach">
                    Modify Staff Role &amp; Granular Permission Keys
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditingStaffId(null)}
                    className="text-fog hover:text-bone"
                  >
                    × Cancel
                  </button>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-[10px] uppercase text-fog">Assigned Role</label>
                    <select
                      value={editStaffRole}
                      onChange={(e) => {
                        const r = e.target.value;
                        setEditStaffRole(r);
                        setEditStaffPerms(staffData.roleTemplates?.[r] || []);
                      }}
                      className="mt-1 w-full rounded-control border border-line bg-coal px-3 py-1.5 text-bone"
                    >
                      <option value="MODERATOR">MODERATOR</option>
                      <option value="SUPPORT_ADMIN">SUPPORT_ADMIN</option>
                      <option value="TRADING_ADMIN">TRADING_ADMIN</option>
                      <option value="LEDGER_AUDITOR">LEDGER_AUDITOR</option>
                      <option value="OPERATIONS_ADMIN">OPERATIONS_ADMIN</option>
                      <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase text-fog">Audit Reason</label>
                    <input
                      type="text"
                      value={editStaffReason}
                      onChange={(e) => setEditStaffReason(e.target.value)}
                      className="mt-1 w-full rounded-control border border-line bg-coal px-3 py-1.5 text-bone"
                    />
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  {(staffData.roleTemplates?.SUPER_ADMIN || []).map((perm) => (
                    <label key={perm} className="flex items-center gap-1.5 text-[10px] text-bone">
                      <input
                        type="checkbox"
                        checked={editStaffPerms.includes(perm)}
                        onChange={() =>
                          setEditStaffPerms((prev) =>
                            prev.includes(perm)
                              ? prev.filter((p) => p !== perm)
                              : [...prev, perm],
                          )
                        }
                      />
                      <span>{perm}</span>
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => void handleSaveStaffPermissions(editingStaffId)}
                  className="mt-3 rounded-control bg-peach px-4 py-2 font-bold uppercase text-ink"
                >
                  Save RBAC Permissions &amp; Bump Session Version
                </button>
              </div>
            )}
          </section>
        </div>
      )}

      {/* =====================================================================
          TAB 3: LIVE ACTIVITY MONITOR & SUSPICIOUS ACTIVITY ALERT CENTRE
         ===================================================================== */}
      {activeTab === "activity" && activityFeed && (
        <div className="space-y-6">
          {/* User Overview Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {[
              { label: "TOTAL USERS", val: activityFeed.overview.totalUsers, tone: "text-bone" },
              { label: "ACTIVE USERS", val: activityFeed.overview.activeUsers, tone: "text-win" },
              { label: "ONLINE USERS", val: activityFeed.overview.onlineUsers, tone: "text-win" },
              {
                label: "NEW SIGNUPS",
                val: activityFeed.overview.newRegistrations,
                tone: "text-peach",
              },
              {
                label: "SUSPENDED / FROZEN",
                val: activityFeed.overview.suspendedAccounts,
                tone: "text-loss",
              },
              {
                label: "USERS W/ OPEN BETS",
                val: activityFeed.overview.usersWithOpenBets,
                tone: "text-peach",
              },
              {
                label: "TOTAL VIRTUAL XTS",
                val: formatMinor(activityFeed.overview.totalVirtualXtsMinor),
                tone: "text-bone",
              },
            ].map((k) => (
              <div
                key={k.label}
                className="rounded-card border border-line bg-coal p-3.5 font-mono"
              >
                <span className="block text-[9px] uppercase text-fog">{k.label}</span>
                <span className={`tnum mt-1 block text-base font-bold ${k.tone}`}>{k.val}</span>
              </div>
            ))}
          </div>

          {/* Suspicious Activity Alert Centre */}
          <section className="rounded-card border border-loss/40 bg-coal p-5">
            <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-loss">
              1. Automated Suspicious Activity Alert Centre ({activityFeed.suspiciousAlerts.length})
            </h2>
            <p className="mt-1 text-xs text-fog">
              Flags repeated failed login attempts, frozen/high-risk accounts, unauthorized staff permission checks, and invitation token reuse attempts.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-line bg-graphite/60 font-mono text-[10px] uppercase text-fog">
                    <th className="px-3 py-2.5">Alert Type</th>
                    <th className="px-3 py-2.5">Severity</th>
                    <th className="px-3 py-2.5">Account</th>
                    <th className="px-3 py-2.5">Trigger Reason</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5 text-right">Quick Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line font-mono">
                  {activityFeed.suspiciousAlerts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-5 text-center text-fog">
                        No suspicious activity alerts triggered.
                      </td>
                    </tr>
                  ) : (
                    activityFeed.suspiciousAlerts.map((al) => (
                      <tr key={al.id} className="hover:bg-graphite/30">
                        <td className="px-3 py-2.5 font-bold text-bone">{al.alertType}</td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`rounded-control px-2 py-0.5 text-[10px] font-bold ${
                              al.severity === "CRITICAL"
                                ? "bg-loss/20 text-loss"
                                : "bg-peach-dim text-peach"
                            }`}
                          >
                            {al.severity}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-peach">{al.accountEmail}</td>
                        <td className="px-3 py-2.5 text-[11px] text-fog">{al.reason}</td>
                        <td className="px-3 py-2.5 text-[10px] text-bone">{al.status}</td>
                        <td className="px-3 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              void handleRevokeUserSessions(al.userId, al.accountEmail)
                            }
                            className="rounded-control border border-line bg-ink px-2.5 py-1 text-[10px] text-bone hover:border-peach"
                          >
                            Revoke Sessions
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Live Platform Activity Stream */}
          <section className="rounded-card border border-line bg-coal p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
              <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-bone">
                2. Unified Live Activity Monitor (Logins, Sign-Ups, Wagers, Settlements &amp; Staff Actions)
              </h2>
              <div className="flex gap-1.5 font-mono text-[10px]">
                {["ALL", "SECURITY_AUDIT", "WALLET_LEDGER"].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActivityCategoryFilter(cat)}
                    className={`rounded-control border px-2.5 py-1 ${
                      activityCategoryFilter === cat
                        ? "border-peach bg-peach-dim text-peach"
                        : "border-line bg-ink text-fog"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-3 max-h-[420px] divide-y divide-line overflow-y-auto font-mono text-xs">
              {activityFeed.liveActivityFeed
                .filter(
                  (item) =>
                    activityCategoryFilter === "ALL" ||
                    item.category === activityCategoryFilter,
                )
                .map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-control px-2 py-0.5 text-[10px] font-bold ${
                          item.category === "SECURITY_AUDIT"
                            ? "bg-peach-dim text-peach"
                            : "bg-win/15 text-win"
                        }`}
                      >
                        {item.event}
                      </span>
                      <span className="font-bold text-bone">{item.actorEmail}</span>
                      <span className="text-fog">→ {item.target}</span>
                      <span className="text-[11px] text-fog">{item.summary}</span>
                    </div>
                    <span className="text-[10px] text-fog">
                      {item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : "—"}
                    </span>
                  </div>
                ))}
            </div>
          </section>
        </div>
      )}

      {/* =====================================================================
          TAB 4: FOOTBALL WORLD OPERATIONS, PROMOTION/RELEGATION & SETTLEMENT QUEUE
         ===================================================================== */}
      {activeTab === "world" && worldOps && (
        <div className="space-y-6">
          {/* Stuck Settlement Queue & Idempotent Retry */}
          <section className="rounded-card border border-line bg-coal p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
              <div>
                <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-peach">
                  1. Authoritative Settlement Queue &amp; Safe Idempotent Retry ({worldOps.stuckSettlements.length})
                </h2>
                <p className="mt-0.5 text-xs text-fog">
                  Detects completed fixtures that still have unsettled pending tickets. Retrying is strictly idempotent and never pays the same ticket twice.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleRetryStuckSettlements()}
                className="rounded-control bg-win px-4 py-2 font-mono text-xs font-bold uppercase text-ink hover:opacity-90"
              >
                ↻ Retry All Pending Settlements Safely
              </button>
            </div>
            {worldOps.stuckSettlements.length === 0 ? (
              <p className="mt-3 font-mono text-xs text-win">
                ✓ 0 stuck settlements — all completed matches have 100% settled tickets.
              </p>
            ) : (
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {worldOps.stuckSettlements.map((st) => (
                  <div
                    key={st.fixtureId}
                    className="rounded-control border border-peach/40 bg-ink p-3 font-mono text-xs"
                  >
                    <span className="font-bold text-bone">
                      MD {st.matchday} • {st.matchLabel}
                    </span>
                    <span className="mt-1 block text-peach">
                      {st.pendingTicketsCount} unsettled tickets ({formatMinor(st.pendingStakeMinor)})
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 6-League Champions League & Relegation Zone Previews */}
          <section className="space-y-3">
            <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-bone">
              2. Multi-Season Promotion, Champions Qualification &amp; Relegation Zone Preview (All 6 Leagues)
            </h2>
            <div className="grid gap-4 lg:grid-cols-2">
              {worldOps.leagues.map((lg) => (
                <div
                  key={lg.leagueId}
                  className="rounded-card border border-line bg-coal p-4 font-mono text-xs"
                >
                  <div className="flex items-center justify-between border-b border-line pb-2">
                    <div>
                      <span className="font-bold text-bone">{lg.name}</span>
                      <span className="ml-2 text-[10px] text-fog">({lg.country})</span>
                    </div>
                    <span className="text-[10px] text-peach">
                      {lg.completedFixtures} / {lg.totalFixtures} Matches Completed
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <span className="block text-[10px] font-bold uppercase text-win">
                        Top 4 Champions Zone
                      </span>
                      <div className="mt-1.5 space-y-1">
                        {lg.championsLeagueZone.map((c, idx) => (
                          <div
                            key={c.id}
                            className="flex items-center justify-between rounded-control bg-ink px-2 py-1 text-[11px]"
                          >
                            <span className="truncate text-bone">
                              {idx + 1}. {c.name}
                            </span>
                            <span className="tnum font-bold text-win">
                              {c.pts}p ({c.gd >= 0 ? `+${c.gd}` : c.gd})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="block text-[10px] font-bold uppercase text-loss">
                        Bottom 3 Relegation Zone
                      </span>
                      <div className="mt-1.5 space-y-1">
                        {lg.relegationZone.map((c, idx) => (
                          <div
                            key={c.id}
                            className="flex items-center justify-between rounded-control bg-ink px-2 py-1 text-[11px]"
                          >
                            <span className="truncate text-bone">
                              {lg.clubsCount - lg.relegationZone.length + idx + 1}. {c.name}
                            </span>
                            <span className="tnum font-bold text-loss">
                              {c.pts}p ({c.gd >= 0 ? `+${c.gd}` : c.gd})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* =====================================================================
          TAB 9: IMMUTABLE OPERATOR AUDIT LOG
         ===================================================================== */}
      {activeTab === "audit" && (
        <section className="space-y-3">
          <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-bone">
            Sensitive Operator &amp; Underground Audit Log
          </h2>
          {!status.auditLogs || status.auditLogs.length === 0 ? (
            <StatePanel
              tone="empty"
              title="No operator modifications recorded yet."
            />
          ) : (
            <div className="divide-y divide-line overflow-hidden rounded-card border border-line bg-coal">
              {status.auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 font-mono text-xs"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-control border border-peach/40 bg-peach-dim px-2 py-0.5 text-[10px] font-bold text-peach">
                      {log.action}
                    </span>
                    <span className="text-bone">
                      {log.targetType}:{log.targetId.slice(0, 8)}
                    </span>
                    {log.details && (
                      <span className="text-fog">{JSON.stringify(log.details)}</span>
                    )}
                  </div>
                  <span className="text-[11px] text-fog">{log.createdAt}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
