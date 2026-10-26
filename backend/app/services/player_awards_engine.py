"""Player Seasonal Honors, Golden Boot, Playmaker, and Golden Glove Metrics Engine.

Calculates individual season player statistics, advanced efficiency ratings, and award races:
- Golden Boot: top goalscorers with official tie-breaking (Assists tie-break -> Minutes played tie-break)
- Playmaker Award: top assist creators with open-play xA differentials
- Golden Glove: top goalkeepers ranked by clean sheets, save percentage, and post-shot xG prevented
- Disciplinary Fair Play Index (Yellow/Red card demerits)
"""

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple


@dataclass
class PlayerSeasonRecord:
    player_id: str
    name: str
    club: str
    position: str  # "GKP", "DEF", "MID", "FWD"
    appearances: int
    minutes_played: int
    goals: int
    penalty_goals: int
    xg: float
    assists: int
    xa: float
    clean_sheets: int
    goals_conceded: int
    saves: int
    yellow_cards: int
    red_cards: int


@dataclass
class PlayerEfficiencyMetrics:
    goals_per_90: float
    assists_per_90: float
    xg_overperformance: float  # goals - xg
    xa_overperformance: float  # assists - xa
    save_percentage: float     # saves / (saves + goals_conceded)
    fair_play_demerit_points: int  # 1 pt per yellow, 3 pts per red


class PlayerAwardsEngine:
    """Computes award standings and individual player efficiency rankings."""

    @staticmethod
    def calculate_efficiency(record: PlayerSeasonRecord) -> PlayerEfficiencyMetrics:
        """Derives per-90 normalized stats and xG differentials."""
        nineties = max(0.1, record.minutes_played / 90.0)

        goals_p90 = round(record.goals / nineties, 2)
        assists_p90 = round(record.assists / nineties, 2)
        xg_delta = round(record.goals - record.xg, 2)
        xa_delta = round(record.assists - record.xa, 2)

        total_shots_faced = record.saves + record.goals_conceded
        save_pct = (
            round((record.saves / total_shots_faced) * 100.0, 1)
            if total_shots_faced > 0
            else 0.0
        )

        demerits = record.yellow_cards * 1 + record.red_cards * 3

        return PlayerEfficiencyMetrics(
            goals_per_90=goals_p90,
            assists_per_90=assists_p90,
            xg_overperformance=xg_delta,
            xa_overperformance=xa_delta,
            save_percentage=save_pct,
            fair_play_demerit_points=demerits,
        )

    @classmethod
    def rank_golden_boot(cls, players: List[PlayerSeasonRecord]) -> List[PlayerSeasonRecord]:
        """Ranks top goalscorers.
        
        Tie-breaking hierarchy:
        1. Total Goals DESC
        2. Total Assists DESC (creative tie-break)
        3. Minutes Played ASC (efficiency tie-break: fewer minutes wins)
        """
        return sorted(
            players,
            key=lambda p: (-p.goals, -p.assists, p.minutes_played, p.name),
        )

    @classmethod
    def rank_playmaker(cls, players: List[PlayerSeasonRecord]) -> List[PlayerSeasonRecord]:
        """Ranks top assist providers.
        
        Tie-breaking hierarchy:
        1. Total Assists DESC
        2. Expected Assists (xA) DESC
        3. Minutes Played ASC
        """
        return sorted(
            players,
            key=lambda p: (-p.assists, -p.xa, p.minutes_played, p.name),
        )

    @classmethod
    def rank_golden_glove(cls, players: List[PlayerSeasonRecord]) -> List[PlayerSeasonRecord]:
        """Ranks top goalkeepers.
        
        Tie-breaking hierarchy:
        1. Clean Sheets DESC
        2. Save Percentage DESC
        3. Goals Conceded ASC
        """
        gkps = [p for p in players if p.position == "GKP"]

        def gk_sort_key(p: PlayerSeasonRecord):
            shots_faced = p.saves + p.goals_conceded
            save_pct = (p.saves / shots_faced) if shots_faced > 0 else 0.0
            return (-p.clean_sheets, -save_pct, p.goals_conceded)

        return sorted(gkps, key=gk_sort_key)
