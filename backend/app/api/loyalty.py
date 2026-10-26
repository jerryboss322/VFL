"""FastAPI routes for VIP Loyalty Tiers, Streaks, Daily Quests, and Rewards."""

import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, get_session
from app.models.loyalty import UserLoyaltyProfile, UserQuestProgress
from app.models.user import User
from app.services.loyalty_engine import (
    calculate_daily_streak_rewards,
    determine_tier_from_xp,
    get_default_daily_quests,
)

router = APIRouter(prefix="/loyalty", tags=["loyalty"])


class ClaimQuestIn(BaseModel):
    questKey: str


@router.get("/profile")
async def get_user_loyalty_profile(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Retrieve authenticated user's VIP status, XP progress bar, current streak, and daily quests."""
    stmt = (
        select(UserLoyaltyProfile)
        .where(UserLoyaltyProfile.user_id == current_user.id)
        .options(selectinload(UserLoyaltyProfile.quests))
    )
    res = await session.execute(stmt)
    profile = res.scalars().first()

    if not profile:
        # Create initial loyalty profile for user
        profile = UserLoyaltyProfile(
            user_id=current_user.id,
            xp_points=250,
            current_tier="BRONZE",
            current_streak_days=3,
            longest_streak_days=5,
            last_login_date=datetime.now(timezone.utc),
            streak_freeze_tokens=1,
            cashback_rate=0.01,
            total_bonus_claimed_minor=0,
        )
        session.add(profile)
        await session.flush()

        # Seed initial daily quests
        for q in get_default_daily_quests():
            quest = UserQuestProgress(
                loyalty_profile_id=profile.id,
                quest_key=q["quest_key"],
                title=q["title"],
                description=q["description"],
                xp_reward=q["xp_reward"],
                coin_reward_minor=q["coin_reward_minor"],
                current_progress=0,
                target_count=q["target_count"],
                is_completed=False,
                is_claimed=False,
            )
            session.add(quest)

        await session.commit()
        await session.refresh(profile)

    tier_info = determine_tier_from_xp(profile.xp_points)

    quests_list = [
        {
            "id": str(q.id),
            "questKey": q.quest_key,
            "title": q.title,
            "description": q.description,
            "xpReward": q.xp_reward,
            "coinRewardMinor": q.coin_reward_minor,
            "currentProgress": q.current_progress,
            "targetCount": q.target_count,
            "isCompleted": q.is_completed,
            "isClaimed": q.is_claimed,
        }
        for q in profile.quests
    ]

    streak_reward_preview = calculate_daily_streak_rewards(profile.current_streak_days)

    return {
        "userId": str(current_user.id),
        "email": current_user.email,
        "xpPoints": profile.xp_points,
        "currentTier": tier_info["tier"],
        "cashbackRate": tier_info["cashback_rate"],
        "tierProgressPercentage": tier_info["progress_percentage"],
        "nextTierXp": tier_info["next_tier_xp"],
        "currentStreakDays": profile.current_streak_days,
        "longestStreakDays": profile.longest_streak_days,
        "streakFreezeTokens": profile.streak_freeze_tokens,
        "todayStreakReward": streak_reward_preview,
        "quests": quests_list,
    }


@router.post("/claim-daily")
async def claim_daily_streak_reward(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Claim daily consecutive login XP and bonus funds reward."""
    stmt = select(UserLoyaltyProfile).where(UserLoyaltyProfile.user_id == current_user.id)
    res = await session.execute(stmt)
    profile = res.scalars().first()

    if not profile:
        raise HTTPException(status_code=404, detail="Loyalty profile not found")

    reward = calculate_daily_streak_rewards(profile.current_streak_days)

    # Award XP and coins
    profile.xp_points += reward["xp_reward"]
    profile.total_bonus_claimed_minor += reward["bonus_minor"]
    profile.streak_freeze_tokens += reward["freeze_tokens"]
    profile.current_streak_days += 1
    if profile.current_streak_days > profile.longest_streak_days:
        profile.longest_streak_days = profile.current_streak_days

    # Re-evaluate tier
    new_tier = determine_tier_from_xp(profile.xp_points)
    profile.current_tier = new_tier["tier"]
    profile.cashback_rate = new_tier["cashback_rate"]

    await session.commit()
    await session.refresh(profile)

    return {
        "status": "success",
        "streakDays": profile.current_streak_days,
        "xpEarned": reward["xp_reward"],
        "bonusMinorEarned": reward["bonus_minor"],
        "newTotalXp": profile.xp_points,
        "currentTier": profile.current_tier,
    }


@router.post("/claim-quest")
async def claim_quest_reward(
    payload: ClaimQuestIn,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Claim completed quest reward for XP and tokens."""
    stmt = (
        select(UserQuestProgress)
        .join(UserLoyaltyProfile, UserQuestProgress.loyalty_profile_id == UserLoyaltyProfile.id)
        .where(
            UserLoyaltyProfile.user_id == current_user.id,
            UserQuestProgress.quest_key == payload.questKey,
        )
    )
    res = await session.execute(stmt)
    quest = res.scalars().first()

    if not quest:
        raise HTTPException(status_code=404, detail="Quest not found")
    if quest.is_claimed:
        raise HTTPException(status_code=400, detail="Quest reward already claimed")

    # Mark completed and claimed
    quest.is_completed = True
    quest.is_claimed = True

    # Award to user profile
    profile_stmt = select(UserLoyaltyProfile).where(UserLoyaltyProfile.user_id == current_user.id)
    p_res = await session.execute(profile_stmt)
    profile = p_res.scalars().first()
    if profile:
        profile.xp_points += quest.xp_reward
        profile.total_bonus_claimed_minor += quest.coin_reward_minor
        new_tier = determine_tier_from_xp(profile.xp_points)
        profile.current_tier = new_tier["tier"]

    await session.commit()

    return {
        "status": "success",
        "questKey": quest.quest_key,
        "xpClaimed": quest.xp_reward,
        "coinsClaimedMinor": quest.coin_reward_minor,
    }
