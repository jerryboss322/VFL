"""Player Physical Stamina, Fatigue Degradation, and In-Match Injury Engine.

Simulates:
- Minute-by-minute stamina depletion curve based on player work rate and team pressing tactic
- Heat/humidity exhaustion acceleration factors
- Dynamic injury probability matrix (muscle fatigue strains vs collision impacts)
- Yellow and red card suspension tracking across league matchdays (5 yellows = 1 match ban)
- Tactical substitution urgency score (0 to 100) recommending manager rotations
"""

from dataclasses import dataclass
from enum import Enum
import math
import random
from typing import Dict, List, Optional, Tuple


class InjuryType(str, Enum):
    NONE = "NONE"
    HAMSTRING_STRAIN = "HAMSTRING_STRAIN"
    GROIN_PULL = "GROIN_PULL"
    ANKLE_SPRAIN = "ANKLE_SPRAIN"
    KNEE_HYPEREXTENSION = "KNEE_HYPEREXTENSION"
    CONCUSSION_PROTOCOL = "CONCUSSION_PROTOCOL"


class TacticalPressingIntensity(str, Enum):
    LOW_BLOCK = "LOW_BLOCK"            # 0.85x drain rate
    BALANCED_MID = "BALANCED_MID"      # 1.00x drain rate
    HIGH_PRESS = "HIGH_PRESS"          # 1.25x drain rate
    GEGENPRESSING = "GEGENPRESSING"    # 1.45x drain rate


@dataclass
class PlayerFitnessState:
    player_id: str
    name: str
    position: str
    starting_stamina: int = 100
    current_stamina: int = 100
    minutes_played: int = 0
    sprints_completed: int = 0
    tackles_engaged: int = 0
    yellow_card_count_season: int = 0
    is_suspended_next_match: bool = False
    injury: InjuryType = InjuryType.NONE
    recovery_matchdays_remaining: int = 0


def calculate_stamina_drain_per_minute(
    pressing_tactic: TacticalPressingIntensity,
    player_work_rate: float = 1.0,  # 0.8 (low work rate) to 1.3 (tireless engine)
    weather_fatigue_multiplier: float = 1.0,
) -> float:
    """Calculates stamina percentage drop per match minute."""
    tactic_mults = {
        TacticalPressingIntensity.LOW_BLOCK: 0.85,
        TacticalPressingIntensity.BALANCED_MID: 1.0,
        TacticalPressingIntensity.HIGH_PRESS: 1.25,
        TacticalPressingIntensity.GEGENPRESSING: 1.45,
    }

    base_drain_per_min = 0.55  # ~50% drop over 90 mins under normal conditions
    tactic_mult = tactic_mults.get(pressing_tactic, 1.0)

    return base_drain_per_min * tactic_mult * player_work_rate * weather_fatigue_multiplier


def simulate_player_match_minute(
    player: PlayerFitnessState,
    minute: int,
    pressing_tactic: TacticalPressingIntensity,
    weather_multiplier: float = 1.0,
    seed: Optional[int] = None,
) -> Tuple[int, InjuryType, float]:
    """Advances one minute of player match action.

    Returns:
    (updated_stamina, injury_occurred, substitution_urgency_score)
    """
    if player.injury != InjuryType.NONE:
        return player.current_stamina, player.injury, 100.0

    rng = random.Random(seed)
    drain = calculate_stamina_drain_per_minute(pressing_tactic, 1.0, weather_multiplier)
    new_stamina = max(5, int(player.current_stamina - drain))
    player.current_stamina = new_stamina
    player.minutes_played += 1

    # Injury risk increases exponentially when stamina drops below 35%
    fatigue_deficit = max(0, 40 - new_stamina)
    injury_risk = 0.0002 + (fatigue_deficit * 0.00015)

    injury_occurred = InjuryType.NONE
    if rng.random() < injury_risk:
        injuries = [
            InjuryType.HAMSTRING_STRAIN,
            InjuryType.GROIN_PULL,
            InjuryType.ANKLE_SPRAIN,
        ]
        injury_occurred = rng.choice(injuries)
        player.injury = injury_occurred
        player.recovery_matchdays_remaining = rng.randint(1, 4)

    # Substitution urgency score (0 to 100)
    urgency = 0.0
    if player.injury != InjuryType.NONE:
        urgency = 100.0
    elif new_stamina < 30:
        urgency = min(95.0, 50.0 + (30 - new_stamina) * 2.5)
    elif new_stamina < 50:
        urgency = 30.0 + (50 - new_stamina) * 1.0

    return new_stamina, injury_occurred, round(urgency, 1)


def evaluate_card_accumulation_suspension(
    current_yellows: int,
    received_yellow: bool,
    received_red: bool,
) -> Tuple[int, bool, str]:
    """Computes card accumulation and match suspensions.

    Rules:
    - 5 Yellow cards in a season -> 1-match suspension
    - Red card -> automatic 1-match suspension (or 3-match for serious foul play)
    """
    total_yellows = current_yellows + (1 if received_yellow else 0)
    is_suspended = False
    reason = "Active / Available"

    if received_red:
        is_suspended = True
        reason = "Suspended: Direct Red Card received"
    elif total_yellows >= 5 and total_yellows % 5 == 0:
        is_suspended = True
        reason = f"Suspended: Reached {total_yellows} accumulated yellow cards (5-card threshold)"

    return total_yellows, is_suspended, reason
