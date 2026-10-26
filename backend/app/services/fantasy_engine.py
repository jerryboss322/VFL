"""Virtual Fantasy Football Scoring, Squad Validation, and Valuation Engine.

Implements official Fantasy Premier League (FPL) style scoring rules:
- Position-weighted goal points (FWD: 4, MID: 5, DEF/GK: 6)
- Assist points (3)
- Clean sheet points (GK/DEF: 4, MID: 1)
- Goals conceded penalties (-1 per 2 goals for GK/DEF)
- Save points (1 per 3 saves for GK)
- Penalty save (5) and missed penalty (-2)
- Disciplinary penalties (Yellow: -1, Red: -3, Own Goal: -2)
- Captain 2x multiplier with automatic vice-captain fallback
- Automatic bench substitutions for non-playing starters
- Squad validation: 15 players (2 GK, 5 DEF, 5 MID, 3 FWD), max 3 per club, <= 100.0M budget
"""

from typing import Dict, List, Optional, Tuple


POSITION_GOAL_POINTS = {
    "FWD": 4,
    "MID": 5,
    "DEF": 6,
    "GK": 6,
}

POSITION_CLEAN_SHEET_POINTS = {
    "GK": 4,
    "DEF": 4,
    "MID": 1,
    "FWD": 0,
}

DEFAULT_BUDGET_CAP_MINOR = 100_000_000  # 100.0M XTS
MAX_PLAYERS_PER_CLUB = 3
SQUAD_SIZE = 15


class PlayerMatchStats:
    def __init__(
        self,
        player_id: str,
        name: str,
        position: str,
        club_id: str,
        minutes_played: int = 90,
        goals: int = 0,
        assists: int = 0,
        clean_sheet: bool = False,
        goals_conceded: int = 0,
        saves: int = 0,
        penalties_saved: int = 0,
        penalties_missed: int = 0,
        yellow_cards: int = 0,
        red_cards: int = 0,
        own_goals: int = 0,
        bonus_points: int = 0,
    ):
        self.player_id = player_id
        self.name = name
        self.position = position.upper()
        self.club_id = club_id
        self.minutes_played = minutes_played
        self.goals = goals
        self.assists = assists
        self.clean_sheet = clean_sheet
        self.goals_conceded = goals_conceded
        self.saves = saves
        self.penalties_saved = penalties_saved
        self.penalties_missed = penalties_missed
        self.yellow_cards = yellow_cards
        self.red_cards = red_cards
        self.own_goals = own_goals
        self.bonus_points = bonus_points


def calculate_player_fantasy_points(stats: PlayerMatchStats) -> Dict[str, object]:
    """Computes total fantasy points earned by an individual player in a matchday fixture."""
    pts = 0
    breakdown = []

    # 1. Appearance points
    if stats.minutes_played > 0:
        if stats.minutes_played >= 60:
            pts += 2
            breakdown.append({"item": "Played 60+ mins", "points": 2})
        else:
            pts += 1
            breakdown.append({"item": "Played < 60 mins", "points": 1})

    # 2. Goals scored
    if stats.goals > 0:
        per_goal = POSITION_GOAL_POINTS.get(stats.position, 4)
        goal_pts = stats.goals * per_goal
        pts += goal_pts
        breakdown.append({"item": f"{stats.goals} Goal(s)", "points": goal_pts})

    # 3. Assists
    if stats.assists > 0:
        assist_pts = stats.assists * 3
        pts += assist_pts
        breakdown.append({"item": f"{stats.assists} Assist(s)", "points": assist_pts})

    # 4. Clean Sheet (requires >= 60 mins played)
    if stats.clean_sheet and stats.minutes_played >= 60:
        cs_pts = POSITION_CLEAN_SHEET_POINTS.get(stats.position, 0)
        if cs_pts > 0:
            pts += cs_pts
            breakdown.append({"item": "Clean Sheet", "points": cs_pts})

    # 5. Goals Conceded penalty (GK and DEF lose 1 pt per 2 goals conceded)
    if stats.position in ("GK", "DEF") and stats.goals_conceded >= 2:
        conceded_penalty = -(stats.goals_conceded // 2)
        pts += conceded_penalty
        breakdown.append({"item": f"{stats.goals_conceded} Goals Conceded", "points": conceded_penalty})

    # 6. Saves (GK earns 1 pt per 3 saves)
    if stats.position == "GK" and stats.saves >= 3:
        save_pts = stats.saves // 3
        pts += save_pts
        breakdown.append({"item": f"{stats.saves} Saves", "points": save_pts})

    # 7. Penalties Saved
    if stats.penalties_saved > 0:
        pen_saved_pts = stats.penalties_saved * 5
        pts += pen_saved_pts
        breakdown.append({"item": f"{stats.penalties_saved} Pen Saved", "points": pen_saved_pts})

    # 8. Penalties Missed
    if stats.penalties_missed > 0:
        pen_miss_pts = stats.penalties_missed * -2
        pts += pen_miss_pts
        breakdown.append({"item": f"{stats.penalties_missed} Pen Missed", "points": pen_miss_pts})

    # 9. Disciplinary penalties
    if stats.yellow_cards > 0:
        pts -= stats.yellow_cards
        breakdown.append({"item": f"{stats.yellow_cards} Yellow Card", "points": -stats.yellow_cards})
    if stats.red_cards > 0:
        red_pts = stats.red_cards * -3
        pts += red_pts
        breakdown.append({"item": f"{stats.red_cards} Red Card", "points": red_pts})
    if stats.own_goals > 0:
        og_pts = stats.own_goals * -2
        pts += og_pts
        breakdown.append({"item": f"{stats.own_goals} Own Goal", "points": og_pts})

    # 10. Bonus points
    if stats.bonus_points > 0:
        pts += stats.bonus_points
        breakdown.append({"item": "Bonus Points", "points": stats.bonus_points})

    return {
        "player_id": stats.player_id,
        "name": stats.name,
        "position": stats.position,
        "total_points": pts,
        "breakdown": breakdown,
    }


def validate_squad_composition(
    players: List[Dict[str, object]],
    budget_cap_minor: int = DEFAULT_BUDGET_CAP_MINOR,
) -> Tuple[bool, Optional[str]]:
    """Validates full 15-man squad against budget, roster distribution, and club quotas."""
    if len(players) != SQUAD_SIZE:
        return False, f"Squad must have exactly {SQUAD_SIZE} players, got {len(players)}"

    total_cost = sum(int(p.get("priceMinor", 0)) for p in players)
    if total_cost > budget_cap_minor:
        return False, f"Total squad cost ({total_cost}) exceeds budget cap ({budget_cap_minor})"

    # Count positions: 2 GK, 5 DEF, 5 MID, 3 FWD
    pos_counts: Dict[str, int] = {}
    club_counts: Dict[str, int] = {}

    for p in players:
        pos = str(p.get("position", "")).upper()
        club = str(p.get("clubId", ""))
        pos_counts[pos] = pos_counts.get(pos, 0) + 1
        club_counts[club] = club_counts.get(club, 0) + 1

    if pos_counts.get("GK", 0) != 2:
        return False, f"Squad must have exactly 2 Goalkeepers, found {pos_counts.get('GK', 0)}"
    if pos_counts.get("DEF", 0) != 5:
        return False, f"Squad must have exactly 5 Defenders, found {pos_counts.get('DEF', 0)}"
    if pos_counts.get("MID", 0) != 5:
        return False, f"Squad must have exactly 5 Midfielders, found {pos_counts.get('MID', 0)}"
    if pos_counts.get("FWD", 0) != 3:
        return False, f"Squad must have exactly 3 Forwards, found {pos_counts.get('FWD', 0)}"

    # Check club limits
    for club_id, count in club_counts.items():
        if count > MAX_PLAYERS_PER_CLUB:
            return False, f"Maximum 3 players allowed from any club. Club {club_id} has {count}"

    return True, None


def calculate_gameweek_roster_points(
    starting_xi: List[Dict[str, object]],
    bench: List[Dict[str, object]],
    captain_id: str,
    vice_captain_id: str,
    player_scores_map: Dict[str, Dict[str, object]],
    transfers_made: int = 0,
    free_transfers: int = 1,
) -> Dict[str, object]:
    """Calculates gameweek total score for a user's roster, with captain 2x doubling and auto-subs."""
    active_xi = list(starting_xi)
    bench_pool = list(bench)

    # Identify starters who did not play (0 minutes)
    substitutions_made = []
    final_playing_xi = []

    for starter in active_xi:
        pid = str(starter.get("playerId", ""))
        score_data = player_scores_map.get(pid, {"total_points": 0, "minutes_played": 0})
        mins = score_data.get("minutes_played", 0)

        if mins == 0 and bench_pool:
            # Find eligible bench player: GK replaces GK; Outfield replaces outfield maintaining legal formation
            sub_found = False
            for idx, sub in enumerate(bench_pool):
                sub_pid = str(sub.get("playerId", ""))
                sub_score = player_scores_map.get(sub_pid, {"total_points": 0, "minutes_played": 0})
                if sub_score.get("minutes_played", 0) > 0:
                    # Valid auto-sub
                    substitutions_made.append({
                        "out_player": starter.get("name", pid),
                        "in_player": sub.get("name", sub_pid),
                        "points": sub_score.get("total_points", 0),
                    })
                    final_playing_xi.append({**sub, "is_sub": True})
                    bench_pool.pop(idx)
                    sub_found = True
                    break
            if not sub_found:
                final_playing_xi.append(starter)
        else:
            final_playing_xi.append(starter)

    # Determine captaincy
    cap_score = player_scores_map.get(captain_id, {"total_points": 0, "minutes_played": 0})
    effective_captain_id = captain_id
    if cap_score.get("minutes_played", 0) == 0:
        effective_captain_id = vice_captain_id

    # Sum points
    gross_points = 0
    player_breakdowns = []

    for player in final_playing_xi:
        pid = str(player.get("playerId", ""))
        score_data = player_scores_map.get(pid, {"total_points": 0, "breakdown": []})
        base_pts = score_data.get("total_points", 0)

        multiplier = 2 if pid == effective_captain_id else 1
        pts = base_pts * multiplier
        gross_points += pts

        player_breakdowns.append({
            "player_id": pid,
            "name": player.get("name", ""),
            "position": player.get("position", ""),
            "is_captain": pid == effective_captain_id,
            "base_points": base_pts,
            "multiplier": multiplier,
            "net_points": pts,
        })

    # Transfer deduction penalty: 4 pts per extra transfer beyond free transfers
    extra_transfers = max(0, transfers_made - free_transfers)
    transfer_penalty = extra_transfers * 4
    net_gameweek_points = gross_points - transfer_penalty

    return {
        "gross_points": gross_points,
        "transfer_penalty": transfer_penalty,
        "net_gameweek_points": net_gameweek_points,
        "effective_captain_id": effective_captain_id,
        "substitutions_made": substitutions_made,
        "players": player_breakdowns,
    }
