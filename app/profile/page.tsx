"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/AppContext";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { StatePanel } from "@/components/StatePanel";
import { api } from "@/lib/api/client";
import { formatMinor } from "@/lib/betslip";
import type { TraderProfilePayload } from "@/types/api";

export default function TraderProfilePage() {
  const { user, setAuthModalOpen, refreshAccount } = useApp();
  const [profile, setProfile] = useState<TraderProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Settings form state
  const [displayName, setDisplayName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Faucet state
  const [faucetMsg, setFaucetMsg] = useState<string | null>(null);
  const [faucetLoading, setFaucetLoading] = useState(false);

  // Notification preferences (persisted in localStorage)
  const [notifPrefs, setNotifPrefs] = useState({
    betSettled: true,
    matchKickoff: true,
    goalScored: true,
    oddsMovement: false,
  });

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("vfu_notif_prefs");
      if (raw) {
        setNotifPrefs((prev) => ({ ...prev, ...(JSON.parse(raw) as object) }));
      }
    } catch {
      // ignore
    }
  }, []);

  const toggleNotifPref = (key: keyof typeof notifPrefs) => {
    setNotifPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        window.localStorage.setItem("vfu_notif_prefs", JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const loadProfile = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await api.profile.get();
    if (!res.ok) {
      const f = res.failure;
      setError(f.kind === "network" ? f.message : `${f.error.code}: ${f.error.message}`);
    } else {
      setProfile(res.data);
      setDisplayName(res.data.user.displayName);
      setError(null);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveMsg(null);
    setSaveErr(null);
    setSaving(true);
    const res = await api.profile.update({
      displayName: displayName.trim() || undefined,
      currentPassword: currentPassword || undefined,
      newPassword: newPassword || undefined,
    });
    setSaving(false);
    if (!res.ok) {
      const f = res.failure;
      setSaveErr(f.kind === "network" ? f.message : `${f.error.code}: ${f.error.message}`);
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setSaveMsg("Profile settings updated.");
    await Promise.all([loadProfile(), refreshAccount()]);
  };

  const handleClaimFaucet = async () => {
    setFaucetMsg(null);
    setFaucetLoading(true);
    const res = await api.wallet.faucet();
    setFaucetLoading(false);
    if (!res.ok) {
      const f = res.failure;
      setFaucetMsg(f.kind === "network" ? f.message : f.error.message);
      return;
    }
    setFaucetMsg("Granted +5,000.00 XTS simulated reload to your wallet!");
    await Promise.all([loadProfile(), refreshAccount()]);
  };

  if (!user) {
    return (
      <div className="rounded-card border border-line bg-coal p-6">
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-peach">
          TRADER PROFILE &amp; ANALYTICS
        </span>
        <h1 className="mt-1 text-lg font-bold text-bone">
          Sign in to access your Trader Profile
        </h1>
        <p className="mt-1 text-xs text-fog">
          Track your win rate, ROI %, winning streaks, market distribution, achievements, and account settings.
        </p>
        <button
          type="button"
          onClick={() => setAuthModalOpen(true)}
          className="mt-4 min-h-[42px] rounded-control bg-peach px-4 py-2 font-mono text-xs font-bold text-ink"
        >
          Sign In / Claim 10,000 XTS
        </button>
      </div>
    );
  }

  if (loading && !profile) {
    return <StatePanel tone="loading" title="Loading trader profile & analytics..." />;
  }

  if (error || !profile) {
    return (
      <StatePanel
        tone="error"
        title="Could not load profile"
        detail={error ?? "Unknown error"}
      />
    );
  }

  const { stats, wallet, achievements, marketBreakdown } = profile;
  const isProfit = wallet.netProfitMinor > 0;
  const isLoss = wallet.netProfitMinor < 0;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Trader Profile" }]} />

      {/* Trader Identity Banner */}
      <section className="pitch-grid rounded-card border border-line bg-coal p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-card border border-peach/50 bg-peach-dim font-mono text-lg font-bold text-peach">
              {profile.user.displayName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-peach">
                  {profile.user.isAdmin ? "CHIEF OPERATOR & TRADER" : "EXCHANGE TRADER"}
                </span>
                {profile.user.isVerified ? (
                  <span className="rounded-control border border-win/40 bg-win/10 px-2 py-0.5 font-mono text-[10px] font-bold text-win">
                    ✓ KYC VERIFIED ({profile.user.kycTier || "VERIFIED"})
                  </span>
                ) : (
                  <span className="rounded-control border border-line bg-ink px-2 py-0.5 font-mono text-[10px] text-fog">
                    UNVERIFIED ({profile.user.kycTier || "UNVERIFIED"})
                  </span>
                )}
                {profile.user.riskFlag && profile.user.riskFlag !== "NORMAL" && (
                  <span className="rounded-control border border-live/40 bg-live/10 px-2 py-0.5 font-mono text-[10px] font-bold text-live">
                    {profile.user.riskFlag}
                  </span>
                )}
              </div>
              <h1 className="mt-0.5 text-xl font-bold text-bone">
                {profile.user.displayName}
              </h1>
              <p className="font-mono text-xs text-fog">{profile.user.email}</p>
            </div>
          </div>

          {/* Simulated Reload Faucet Button */}
          <div className="flex flex-col items-start sm:items-end">
            <button
              type="button"
              disabled={faucetLoading}
              onClick={() => void handleClaimFaucet()}
              className="min-h-[38px] rounded-control border border-peach/50 bg-peach-dim px-3.5 py-1.5 font-mono text-xs font-bold text-peach transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {faucetLoading ? "Processing Reload..." : "+ Claim 5,000 XTS Reload Faucet"}
            </button>
            <span className="mt-1 font-mono text-[10px] text-fog">
              Available when total equity drops below 2,500.00 XTS
            </span>
            {faucetMsg && (
              <span className="mt-1 font-mono text-[11px] text-peach">{faucetMsg}</span>
            )}
          </div>
        </div>

        {/* Performance KPI Grid */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          <div className="rounded-control border border-line bg-ink p-3 font-mono">
            <span className="block text-[10px] uppercase text-fog">TOTAL EQUITY</span>
            <span className="tnum mt-1 block text-sm font-bold text-bone">
              {formatMinor(wallet.totalEquityMinor)}
            </span>
          </div>
          <div className="rounded-control border border-line bg-ink p-3 font-mono">
            <span className="block text-[10px] uppercase text-fog">NET P&amp;L</span>
            <span
              className={`tnum mt-1 block text-sm font-bold ${
                isProfit ? "text-win" : isLoss ? "text-loss" : "text-bone"
              }`}
            >
              {isProfit ? "+" : ""}
              {formatMinor(wallet.netProfitMinor)}
            </span>
          </div>
          <div className="rounded-control border border-line bg-ink p-3 font-mono">
            <span className="block text-[10px] uppercase text-fog">WIN RATE</span>
            <span className="tnum mt-1 block text-sm font-bold text-peach">
              {stats.winRate.toFixed(1)}%
            </span>
          </div>
          <div className="rounded-control border border-line bg-ink p-3 font-mono">
            <span className="block text-[10px] uppercase text-fog">ROI %</span>
            <span
              className={`tnum mt-1 block text-sm font-bold ${
                stats.roiPercent > 0
                  ? "text-win"
                  : stats.roiPercent < 0
                    ? "text-loss"
                    : "text-bone"
              }`}
            >
              {stats.roiPercent > 0 ? `+${stats.roiPercent}%` : `${stats.roiPercent}%`}
            </span>
          </div>
          <div className="rounded-control border border-line bg-ink p-3 font-mono">
            <span className="block text-[10px] uppercase text-fog">AVG ODDS / STREAK</span>
            <span className="tnum mt-1 block text-sm font-bold text-bone">
              @{stats.averageOdds.toFixed(2)} • {stats.bestStreak}W Max
            </span>
          </div>
          <div className="rounded-control border border-line bg-ink p-3 font-mono">
            <span className="block text-[10px] uppercase text-fog">BIGGEST WIN</span>
            <span className="tnum mt-1 block text-sm font-bold text-win">
              {formatMinor(stats.biggestWinMinor)}
            </span>
          </div>
        </div>
      </section>

      {/* Achievements & Market Distribution */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Unlocked Achievements */}
        <section className="rounded-card border border-line bg-coal p-5">
          <h2 className="border-b border-line pb-3 font-mono text-xs font-bold uppercase tracking-wider text-bone">
            Trader Achievements &amp; Milestones
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {achievements.map((ach) => (
              <div
                key={ach.id}
                className={`rounded-control border p-3 text-xs ${
                  ach.unlocked
                    ? "border-peach/50 bg-peach-dim/60 text-bone"
                    : "border-line bg-ink/50 text-fog/60"
                }`}
              >
                <div className="flex items-center justify-between gap-2 font-mono">
                  <span className="font-bold text-bone">{ach.title}</span>
                  <span
                    className={`rounded-control px-1.5 py-0.5 text-[10px] font-bold ${
                      ach.unlocked ? "bg-win/20 text-win" : "bg-graphite text-fog"
                    }`}
                  >
                    {ach.unlocked ? "UNLOCKED" : "LOCKED"}
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-fog">
                  {ach.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Market Activity & Notification Preferences */}
        <div className="space-y-6">
          <section className="rounded-card border border-line bg-coal p-5">
            <h2 className="border-b border-line pb-3 font-mono text-xs font-bold uppercase tracking-wider text-bone">
              Market Selection Breakdown ({stats.totalBets} Total Tickets)
            </h2>
            {marketBreakdown.length === 0 ? (
              <p className="mt-4 text-xs text-fog">
                Place your first wager across any of the 27 markets to see your trading distribution.
              </p>
            ) : (
              <ul className="mt-3 space-y-2 text-xs">
                {marketBreakdown.map((item) => (
                  <li
                    key={item.market}
                    className="flex items-center justify-between rounded-control border border-line bg-ink px-3 py-2 font-mono"
                  >
                    <span className="uppercase text-bone">
                      {item.market.replace(/_/g, " ")}
                    </span>
                    <span className="tnum font-bold text-peach">
                      {item.count} {item.count === 1 ? "selection" : "selections"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-card border border-line bg-coal p-5">
            <h2 className="border-b border-line pb-3 font-mono text-xs font-bold uppercase tracking-wider text-bone">
              Live Telemetry &amp; Notification Preferences
            </h2>
            <div className="mt-3 space-y-2.5 text-xs">
              {(
                [
                  { key: "betSettled", label: "Bet Settlement & Payout Alerts" },
                  { key: "matchKickoff", label: "Matchday Auto-Kickoff (4m Countdown)" },
                  { key: "goalScored", label: "Live Goal Scored Telemetry Highlights" },
                  { key: "oddsMovement", label: "Pre-Match Odds Movement Indicators" },
                ] as const
              ).map((pref) => (
                <label
                  key={pref.key}
                  className="flex cursor-pointer items-center justify-between rounded-control border border-line bg-ink px-3.5 py-2.5"
                >
                  <span className="font-medium text-bone">{pref.label}</span>
                  <input
                    type="checkbox"
                    checked={notifPrefs[pref.key]}
                    onChange={() => toggleNotifPref(pref.key)}
                    className="h-4 w-4 accent-[#6CA6E8]"
                  />
                </label>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* Account & Security Settings */}
      <section className="rounded-card border border-line bg-coal p-5">
        <h2 className="border-b border-line pb-3 font-mono text-xs font-bold uppercase tracking-wider text-bone">
          Account &amp; Security Settings
        </h2>
        <form
          onSubmit={(e) => void handleUpdateProfile(e)}
          className="mt-4 grid gap-4 sm:grid-cols-3"
        >
          <div>
            <label className="block font-mono text-[11px] uppercase text-fog">
              Trader Display Name
            </label>
            <input
              type="text"
              required
              minLength={2}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 w-full rounded-control border border-line bg-ink px-3 py-2 text-xs text-bone focus:border-peach focus:outline-none"
            />
          </div>
          <div>
            <label className="block font-mono text-[11px] uppercase text-fog">
              Current Password (if changing)
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Leave blank to keep current"
              className="mt-1 w-full rounded-control border border-line bg-ink px-3 py-2 text-xs text-bone placeholder:text-fog/50 focus:border-peach focus:outline-none"
            />
          </div>
          <div>
            <label className="block font-mono text-[11px] uppercase text-fog">
              New Password (min 8 chars)
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password"
              className="mt-1 w-full rounded-control border border-line bg-ink px-3 py-2 text-xs text-bone placeholder:text-fog/50 focus:border-peach focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-3">
            <div>
              {saveMsg && <span className="font-mono text-xs text-win">{saveMsg}</span>}
              {saveErr && <span className="font-mono text-xs text-loss">{saveErr}</span>}
            </div>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[38px] rounded-control bg-peach px-4 py-2 font-mono text-xs font-bold uppercase text-ink hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Profile Changes"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
