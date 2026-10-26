"""VIP Loyalty Tier Progression, Streak Multipliers, and Daily Missions Engine."""

from typing import Dict, List, Optional, Tuple

TIER_THRESHOLDS = [
    ("BRONZE", 0, 1_000, 0.01),
    ("SILVER", 1_000, 5_000, 0.02),
    ("GOLD", 5_000, 20_000, 0.035),
    ("PLATINUM", 20_000, 50_000, 0.05),
    ("DIAMOND", 50_000, 100_000, 0.075),
    ("MASTER", 100_000, 1_000_000, 0.10),
]


def determine_tier_from_xp(xp: int) -> Dict[str, object]:
    """Calculates user's current VIP loyalty tier, XP progress, and cashback perk."""
    current_tier = "BRONZE"
    cashback_rate = 0.01
    current_tier_min = 0
    next_tier_xp = 1_000

    for tier, min_xp, max_xp, cb in TIER_THRESHOLDS:
        if xp >= min_xp:
            current_tier = tier
            cashback_rate = cb
            current_tier_min = min_xp
            next_tier_xp = max_xp

    range_size = max(1, next_tier_xp - current_tier_min)
    progress_in_tier = max(0, min(range_size, xp - current_tier_min))
    progress_pct = round((progress_in_tier / range_size) * 100, 1)

    return {
        "tier": current_tier,
        "xp": xp,
        "cashback_rate": cashback_rate,
        "current_tier_min_xp": current_tier_min,
        "next_tier_xp": next_tier_xp,
        "progress_percentage": progress_pct,
    }


def calculate_daily_streak_rewards(streak_days: int) -> Dict[str, object]:
    """Computes daily login rewards based on consecutive streak days (1 to 7+)."""
    day_in_cycle = ((streak_days - 1) % 7) + 1

    rewards_table = {
        1: {"xp": 50, "bonus_minor": 100, "token": 0, "label": "Day 1 Kickoff"},
        2: {"xp": 75, "bonus_minor": 150, "token": 0, "label": "Day 2 Momentum"},
        3: {"xp": 100, "bonus_minor": 250, "token": 0, "label": "Day 3 Midweek Surge"},
        4: {"xp": 150, "bonus_minor": 350, "token": 0, "label": "Day 4 Consistency"},
        5: {"xp": 200, "bonus_minor": 500, "token": 0, "label": "Day 5 Form Booster"},
        6: {"xp": 300, "bonus_minor": 750, "token": 0, "label": "Day 6 Weekend Primer"},
        7: {"xp": 500, "bonus_minor": 1500, "token": 1, "label": "Day 7 Grand Jackpot + Freeze Token"},
    }

    reward = rewards_table.get(day_in_cycle, rewards_table[1])
    return {
        "streak_days": streak_days,
        "day_in_cycle": day_in_cycle,
        "xp_reward": reward["xp"],
        "bonus_minor": reward["bonus_minor"],
        "freeze_tokens": reward["token"],
        "label": reward["label"],
    }


def get_default_daily_quests() -> List[Dict[str, object]]:
    """Returns standard rotation of daily missions for users."""
    return [
        {
            "quest_key": "early_bird",
            "title": "Early Bird Strategist",
            "description": "Place 1 pre-match bet before scheduled kickoff",
            "xp_reward": 50,
            "coin_reward_minor": 200,
            "target_count": 1,
        },
        {
            "quest_key": "parlay_architect",
            "title": "Parlay Architect",
            "description": "Build and place an accumulator with 3 or more selections",
            "xp_reward": 150,
            "coin_reward_minor": 500,
            "target_count": 1,
        },
        {
            "quest_key": "underdog_whisperer",
            "title": "Underdog Whisperer",
            "description": "Back any outcome with odds of 3.00 or higher",
            "xp_reward": 100,
            "coin_reward_minor": 350,
            "target_count": 1,
        },
        {
            "quest_key": "fantasy_scout",
            "title": "Fantasy Squad Scout",
            "description": "Lock in your 15-man squad for the European matchday",
            "xp_reward": 100,
            "coin_reward_minor": 400,
            "target_count": 1,
        },
    ]
