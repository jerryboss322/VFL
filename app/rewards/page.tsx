"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { LoyaltyTierCard } from "@/components/LoyaltyTierCard";
import { formatMinor } from "@/lib/betslip";

interface QuestItem {
  id: string;
  questKey: string;
  title: string;
  description: string;
  xpReward: number;
  coinRewardMinor: number;
  currentProgress: number;
  targetCount: number;
  isCompleted: boolean;
  isClaimed: boolean;
}

interface LoyaltyProfileData {
  userId: string;
  email: string;
  xpPoints: number;
  currentTier: string;
  cashbackRate: number;
  tierProgressPercentage: number;
  nextTierXp: number;
  currentStreakDays: number;
  longestStreakDays: number;
  streakFreezeTokens: number;
  todayStreakReward: {
    streak_days: number;
    day_in_cycle: number;
    xp_reward: number;
    bonus_minor: number;
    freeze_tokens: number;
    label: string;
  };
  quests: QuestItem[];
}

export default function RewardsPage() {
  const [profile, setProfile] = useState<LoyaltyProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [claimingStreak, setClaimingStreak] = useState(false);
  const [claimingQuestKey, setClaimingQuestKey] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLoyalty() {
      try {
        setLoading(true);
        const res = await fetch("/api/loyalty/profile");
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
        }
      } catch (err) {
        console.error("Failed to load loyalty profile", err);
      } finally {
        setLoading(false);
      }
    }
    void fetchLoyalty();
  }, []);

  const handleClaimStreak = async () => {
    try {
      setClaimingStreak(true);
      const res = await fetch("/api/loyalty/claim-daily", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setToastMessage(`🎉 Day ${data.streakDays} Claimed! +${data.xpEarned} XP & +${formatMinor(data.bonusMinorEarned)} added.`);
        // Reload
        const refRes = await fetch("/api/loyalty/profile");
        if (refRes.ok) setProfile(await refRes.json());
      }
    } catch (err) {
      setToastMessage("Failed to claim daily reward");
    } finally {
      setClaimingStreak(false);
    }
  };

  const handleClaimQuest = async (questKey: string) => {
    try {
      setClaimingQuestKey(questKey);
      const res = await fetch("/api/loyalty/claim-quest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questKey }),
      });
      if (res.ok) {
        const data = await res.json();
        setToastMessage(`🏆 Quest Completed! +${data.xpClaimed} XP Claimed.`);
        const refRes = await fetch("/api/loyalty/profile");
        if (refRes.ok) setProfile(await refRes.json());
      }
    } catch (err) {
      setToastMessage("Failed to claim quest");
    } finally {
      setClaimingQuestKey(null);
    }
  };

  if (loading || !profile) {
    return (
      <AppShell>
        <div className="max-w-6xl mx-auto px-4 py-12 text-center text-xs font-mono text-neutral-400">
          Loading VIP loyalty progression and daily rewards...
        </div>
      </AppShell>
    );
  }

  const streakDays = profile.currentStreakDays;
  const currentDayInCycle = ((streakDays - 1) % 7) + 1;

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="p-3 bg-amber-500/20 border border-amber-500/40 rounded-xl text-xs text-amber-300 font-mono flex items-center justify-between">
            <span>{toastMessage}</span>
            <button
              onClick={() => setToastMessage(null)}
              className="text-amber-400 hover:text-white text-base leading-none"
            >
              &times;
            </button>
          </div>
        )}

        {/* Top VIP Tier Card */}
        <LoyaltyTierCard
          tierInfo={{
            tier: profile.currentTier,
            xp: profile.xpPoints,
            cashbackRate: profile.cashbackRate,
            progressPercentage: profile.tierProgressPercentage,
            nextTierXp: profile.nextTierXp,
          }}
        />

        {/* 7-Day Streak Rewards Tracker */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">🔥</span>
                <h3 className="font-bold text-neutral-100 text-sm">
                  {profile.currentStreakDays}-Day Consecutive Login Streak
                </h3>
                <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.2 rounded">
                  {profile.streakFreezeTokens} Freeze Token(s) Available
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Log in daily to claim escalating XP bonuses and cash rewards. Day 7 awards a Streak Freeze Token!
              </p>
            </div>

            <button
              type="button"
              onClick={handleClaimStreak}
              disabled={claimingStreak}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold font-mono text-xs transition-all shadow-md disabled:opacity-50"
            >
              {claimingStreak ? "Claiming..." : "Claim Today's Reward"}
            </button>
          </div>

          {/* 7 Day Step Progress Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5 pt-2">
            {[1, 2, 3, 4, 5, 6, 7].map((day) => {
              const isPast = day < currentDayInCycle;
              const isToday = day === currentDayInCycle;
              const isFuture = day > currentDayInCycle;

              return (
                <div
                  key={day}
                  className={`rounded-xl border p-3 text-center font-mono text-xs transition-all ${
                    isToday
                      ? "bg-amber-500/15 border-amber-500 text-amber-300 ring-2 ring-amber-500/30 shadow-lg"
                      : isPast
                        ? "bg-neutral-950/80 border-emerald-800/60 text-emerald-400"
                        : "bg-neutral-950/40 border-neutral-800 text-neutral-500"
                  }`}
                >
                  <span className="text-[10px] uppercase font-bold block mb-1">
                    Day {day} {isPast && "✓"}
                  </span>
                  <div className="text-lg my-1">
                    {day === 7 ? "🎁" : isPast ? "⚡" : isToday ? "🔥" : "🔒"}
                  </div>
                  <span className="text-[11px] font-bold block">
                    +{day === 7 ? "500" : day * 50} XP
                  </span>
                  <span className="text-[9px] text-neutral-400 block mt-0.5">
                    {day === 7 ? "+1,500 XTS" : `+${day * 100} XTS`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Daily Quests & Missions */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
            <div>
              <h3 className="font-bold text-neutral-100 text-sm flex items-center gap-2">
                <span>Daily Betting Quests & Missions</span>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 border border-emerald-800 px-1.5 py-0.2 rounded">
                  Resets in 08:32
                </span>
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Complete missions across football matchdays to claim instant XP and bonus staking funds.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {profile.quests.map((quest) => (
              <div
                key={quest.id}
                className="bg-neutral-950/80 border border-neutral-800 rounded-xl p-4 flex items-center justify-between gap-3 transition-colors hover:border-neutral-700"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-neutral-100 truncate">{quest.title}</span>
                    <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 text-[10px] font-mono font-bold">
                      +{quest.xpReward} XP
                    </span>
                    <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-mono font-bold">
                      +{formatMinor(quest.coinRewardMinor)}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 leading-snug">{quest.description}</p>
                </div>

                <div className="shrink-0">
                  {quest.isClaimed ? (
                    <span className="px-3 py-1 rounded bg-neutral-800 text-neutral-400 font-mono text-xs font-semibold">
                      Claimed ✓
                    </span>
                  ) : quest.isCompleted ? (
                    <button
                      type="button"
                      onClick={() => handleClaimQuest(quest.questKey)}
                      disabled={claimingQuestKey === quest.questKey}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold font-mono text-xs transition-colors shadow"
                    >
                      {claimingQuestKey === quest.questKey ? "Claiming..." : "Claim"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleClaimQuest(quest.questKey)}
                      className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 font-mono text-xs font-semibold transition-colors"
                    >
                      Complete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
