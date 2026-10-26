"""
Mathematical odds pricing, probability explainer, and market outcome evaluation engine.

Uses a full bivariate Poisson scoreline grid (1st Half + 2nd Half independent Poisson processes
with rate 0.45 * lambda in 1H and 0.55 * lambda in 2H) parameterized by Home/Away attack and
defense ratings plus a home-advantage multiplier, applying a standard 4.5% bookmaker overround
across 27 comprehensive markets organized into 3 categories:

1. Match Result Markets (`result`):
   - match_winner (Match Result 1X2)
   - double_chance (Double Chance 1X, 12, X2)
   - handicap_3way (3-Way Handicap: -1/+1, -2/+2, -3/+3)
   - half_time_result (Half-Time Result 1X2)
   - full_time_result (Full-Time Result 90 Mins)
   - ht_ft (Half-Time / Full-Time 9 outcomes)

2. Goals Markets (`goals`):
   - over_under_goals (Total Goals Over/Under 0.5, 1.5, 2.5, 3.5, 4.5)
   - over_under_2_5 (Total Goals Over/Under 2.5 — quick inline market)
   - both_teams_to_score (Both Teams to Score Yes/No)
   - home_team_goals_ou (Home Team Goals Over/Under 0.5, 1.5, 2.5)
   - away_team_goals_ou (Away Team Goals Over/Under 0.5, 1.5, 2.5)
   - exact_total_goals (Exact Total Goals: 0, 1, 2, 3, 4, 5+)
   - exact_home_goals (Exact Home Team Goals: 0, 1, 2, 3+)
   - exact_away_goals (Exact Away Team Goals: 0, 1, 2, 3+)
   - correct_score (Full-Time Correct Score)
   - odd_even_goals (Odd/Even Total Goals)
   - team_to_score (Team to Score: Home Only, Away Only, Both, Neither)
   - last_team_to_score (Last Team to Score: Home, No Goal, Away)
   - second_half_result (2nd Half Result 1X2: Home, Draw, Away)
   - first_half_goals_ou (First-Half Goals Over/Under 0.5, 1.5, 2.5)
   - second_half_goals_ou (Second-Half Goals Over/Under 0.5, 1.5, 2.5)
   - ht_correct_score (Half-Time Correct Score)

3. Combination Markets (`combo`):
   - result_and_ou_2_5 (Result + Over/Under 2.5 Goals)
   - result_and_btts (Result + Both Teams to Score)
   - btts_and_ou_2_5 (BTTS + Over/Under 2.5 Goals)
   - ht_ft_and_ou_2_5 (Half-Time/Full-Time + Over/Under 2.5 Goals)
   - team_to_score_and_result (First Team to Score + Match Result)
"""

import math
from typing import Any
from uuid import UUID

BASELINE_GOALS = 1.25
HOME_ADVANTAGE = 1.10
OVERROUND = 1.045
MIN_ODDS = 1.01
LOCK_ODDS_THRESHOLD = 1.07
MAX_ODDS = 65.00
HALF_ONE_SHARE = 0.45
HALF_TWO_SHARE = 0.55


def _poisson_pmf(k: int, lam: float) -> float:
    if lam <= 0:
        return 1.0 if k == 0 else 0.0
    return (lam ** k) * math.exp(-lam) / math.factorial(k)


def compute_expected_goals(
    home_attack: float = 1.0,
    home_defense: float = 1.0,
    away_attack: float = 1.0,
    away_defense: float = 1.0,
) -> tuple[float, float]:
    lam_home = BASELINE_GOALS * HOME_ADVANTAGE * (home_attack / max(0.5, away_defense))
    lam_away = BASELINE_GOALS * (away_attack / max(0.5, home_defense))
    return max(0.30, min(2.80, lam_home)), max(0.30, min(2.80, lam_away))


def _prob_to_decimal_odds(prob: float, overround: float = OVERROUND) -> float:
    if prob <= 0.0005:
        return MAX_ODDS
    if prob >= 0.98:
        return MIN_ODDS
    adjusted = max(0.015, min(0.94, prob * overround))
    raw_odds = 1.0 / adjusted
    return round(max(MIN_ODDS, min(MAX_ODDS, raw_odds)), 2)


def compute_probability_explanation(
    home_name: str,
    away_name: str,
    home_attack: float = 1.0,
    home_defense: float = 1.0,
    away_attack: float = 1.0,
    away_defense: float = 1.0,
    home_form: list[str] | None = None,
    away_form: list[str] | None = None,
) -> dict[str, Any]:
    """Generate a transparent Probability Explainer payload showing how odds are derived."""
    lam_h, lam_a = compute_expected_goals(home_attack, home_defense, away_attack, away_defense)

    p_home = 0.0
    p_draw = 0.0
    p_away = 0.0
    p_over_2_5 = 0.0
    p_btts = 0.0
    top_scores: list[tuple[str, float]] = []

    for h in range(8):
        ph = _poisson_pmf(h, lam_h)
        for a in range(8):
            pa = _poisson_pmf(a, lam_a)
            p = ph * pa
            if h > a:
                p_home += p
            elif h == a:
                p_draw += p
            else:
                p_away += p
            if (h + a) > 2:
                p_over_2_5 += p
            if h >= 1 and a >= 1:
                p_btts += p
            if h <= 4 and a <= 4:
                top_scores.append((f"{h}-{a}", p))

    norm = p_home + p_draw + p_away
    if norm > 0:
        p_home /= norm
        p_draw /= norm
        p_away /= norm

    top_scores.sort(key=lambda x: x[1], reverse=True)

    favored = home_name if p_home >= p_away else away_name
    edge_pct = round(abs(p_home - p_away) * 100, 1)

    factors: list[str] = [
        f"Home field advantage applies a +12% attacking tempo boost to {home_name}.",
        f"{home_name} projected goals (xG): {lam_h:.2f} based on recent tactical form.",
        f"{away_name} projected goals (xG): {lam_a:.2f} based on recent tactical form.",
        f"Bookmaker margin (overround): {(OVERROUND - 1.0) * 100:.1f}% applied across all 27 markets.",
    ]

    return {
        "favoredClub": favored,
        "edgePercent": edge_pct,
        "expectedGoals": {
            "home": round(lam_h, 2),
            "away": round(lam_a, 2),
            "total": round(lam_h + lam_a, 2),
            "firstHalf": round((lam_h + lam_a) * HALF_ONE_SHARE, 2),
            "secondHalf": round((lam_h + lam_a) * HALF_TWO_SHARE, 2),
        },
        "winProbabilities": {
            "home": round(p_home * 100, 1),
            "draw": round(p_draw * 100, 1),
            "away": round(p_away * 100, 1),
            "over25": round(p_over_2_5 * 100, 1),
            "btts": round(p_btts * 100, 1),
        },
        "mostLikelyScorelines": [
            {"score": sc, "probability": round(pr * 100, 1)} for sc, pr in top_scores[:5]
        ],
        "factors": factors,
        "homeForm": home_form or [],
        "awayForm": away_form or [],
    }


def generate_fixture_markets(
    fixture_id: UUID | str,
    home_name: str = "Home",
    away_name: str = "Away",
    home_attack: float = 1.0,
    home_defense: float = 1.0,
    away_attack: float = 1.0,
    away_defense: float = 1.0,
    version: int = 1,
    suspended: bool = False,
    current_home_goals: int = 0,
    current_away_goals: int = 0,
    elapsed_seconds: int = 0,
    match_duration_seconds: int = 480,
    is_live: bool = False,
    ht_home_goals: int | None = None,
    ht_away_goals: int | None = None,
) -> list[dict[str, Any]]:
    fid = str(fixture_id)
    half_boundary = match_duration_seconds // 2
    lam_h, lam_a = compute_expected_goals(home_attack, home_defense, away_attack, away_defense)

    # Determine goals scored specifically in 1st half and 2nd half
    if elapsed_seconds < half_boundary:
        cur_1h_h = current_home_goals
        cur_1h_a = current_away_goals
        cur_2h_h = 0
        cur_2h_a = 0
    else:
        cur_1h_h = ht_home_goals if ht_home_goals is not None else current_home_goals
        cur_1h_a = ht_away_goals if ht_away_goals is not None else current_away_goals
        cur_2h_h = max(0, current_home_goals - cur_1h_h)
        cur_2h_a = max(0, current_away_goals - cur_1h_a)

    if is_live and elapsed_seconds > 0:
        rem_fraction = max(0.0, min(1.0, (match_duration_seconds - elapsed_seconds) / float(match_duration_seconds)))
        rem_lam_h = max(0.001, lam_h * rem_fraction)
        rem_lam_a = max(0.001, lam_a * rem_fraction)

        ft_grid: dict[tuple[int, int], float] = {}
        ft_norm = 0.0
        for fh in range(8):
            ph = _poisson_pmf(fh, rem_lam_h)
            for fa in range(8):
                pa = _poisson_pmf(fa, rem_lam_a)
                p = ph * pa
                score = (current_home_goals + fh, current_away_goals + fa)
                ft_grid[score] = ft_grid.get(score, 0.0) + p
                ft_norm += p
        for k in ft_grid:
            ft_grid[k] /= max(1e-9, ft_norm)

        # 1st-half grid
        h1_grid: dict[tuple[int, int], float] = {}
        if elapsed_seconds >= half_boundary:
            h1_grid[(cur_1h_h, cur_1h_a)] = 1.0
        else:
            h1_rem_fraction = max(0.0, (half_boundary - elapsed_seconds) / float(half_boundary))
            h1_lam_h = max(0.001, lam_h * HALF_ONE_SHARE * h1_rem_fraction)
            h1_lam_a = max(0.001, lam_a * HALF_ONE_SHARE * h1_rem_fraction)
            h1_norm = 0.0
            for fh in range(6):
                ph = _poisson_pmf(fh, h1_lam_h)
                for fa in range(6):
                    pa = _poisson_pmf(fa, h1_lam_a)
                    p = ph * pa
                    sc = (cur_1h_h + fh, cur_1h_a + fa)
                    h1_grid[sc] = h1_grid.get(sc, 0.0) + p
                    h1_norm += p
            for k in h1_grid:
                h1_grid[k] /= max(1e-9, h1_norm)

        # 2nd-half grid (calculated strictly from 2nd-half goals and remaining 2nd-half lambda)
        h2_grid: dict[tuple[int, int], float] = {}
        if elapsed_seconds < half_boundary:
            # 2nd half has not kicked off yet: full 2nd half remaining starting from (0, 0)
            h2_lam_h = lam_h * HALF_TWO_SHARE
            h2_lam_a = lam_a * HALF_TWO_SHARE
            h2_norm = 0.0
            for fh in range(6):
                ph = _poisson_pmf(fh, h2_lam_h)
                for fa in range(6):
                    pa = _poisson_pmf(fa, h2_lam_a)
                    p = ph * pa
                    h2_grid[(fh, fa)] = p
                    h2_norm += p
            for k in h2_grid:
                h2_grid[k] /= max(1e-9, h2_norm)
        else:
            # 2nd half in progress: remaining 2nd-half lambda added to current 2nd-half goals
            rem_2h_seconds = max(0, match_duration_seconds - elapsed_seconds)
            rem_2h_fraction = max(0.0, rem_2h_seconds / float(half_boundary))
            h2_lam_h = max(0.001, lam_h * HALF_TWO_SHARE * rem_2h_fraction)
            h2_lam_a = max(0.001, lam_a * HALF_TWO_SHARE * rem_2h_fraction)
            h2_norm = 0.0
            for fh in range(6):
                ph = _poisson_pmf(fh, h2_lam_h)
                for fa in range(6):
                    pa = _poisson_pmf(fa, h2_lam_a)
                    p = ph * pa
                    sc = (cur_2h_h + fh, cur_2h_a + fa)
                    h2_grid[sc] = h2_grid.get(sc, 0.0) + p
                    h2_norm += p
            for k in h2_grid:
                h2_grid[k] /= max(1e-9, h2_norm)
    else:
        # Pre-match grids
        cur_1h_h = 0
        cur_1h_a = 0
        cur_2h_h = 0
        cur_2h_a = 0
        lam_h1 = lam_h * HALF_ONE_SHARE
        lam_a1 = lam_a * HALF_ONE_SHARE
        lam_h2 = lam_h * HALF_TWO_SHARE
        lam_a2 = lam_a * HALF_TWO_SHARE

        # Full-time 9x9 probability grid
        ft_grid: dict[tuple[int, int], float] = {}
        ft_norm = 0.0
        for h in range(9):
            ph = _poisson_pmf(h, lam_h)
            for a in range(9):
                pa = _poisson_pmf(a, lam_a)
                p = ph * pa
                ft_grid[(h, a)] = p
                ft_norm += p
        for k in ft_grid:
            ft_grid[k] /= max(1e-9, ft_norm)

        # 1st-half 6x6 probability grid
        h1_grid: dict[tuple[int, int], float] = {}
        h1_norm = 0.0
        for h in range(6):
            ph = _poisson_pmf(h, lam_h1)
            for a in range(6):
                pa = _poisson_pmf(a, lam_a1)
                p = ph * pa
                h1_grid[(h, a)] = p
                h1_norm += p
        for k in h1_grid:
            h1_grid[k] /= max(1e-9, h1_norm)

        # 2nd-half 6x6 probability grid
        h2_grid: dict[tuple[int, int], float] = {}
        h2_norm = 0.0
        for h in range(6):
            ph = _poisson_pmf(h, lam_h2)
            for a in range(6):
                pa = _poisson_pmf(a, lam_a2)
                p = ph * pa
                h2_grid[(h, a)] = p
                h2_norm += p
        for k in h2_grid:
            h2_grid[k] /= max(1e-9, h2_norm)

    # Aggregate FT probabilities
    p_home = sum(p for (h, a), p in ft_grid.items() if h > a)
    p_draw = sum(p for (h, a), p in ft_grid.items() if h == a)
    p_away = sum(p for (h, a), p in ft_grid.items() if h < a)

    # HT probabilities
    p_ht_home = sum(p for (h, a), p in h1_grid.items() if h > a)
    p_ht_draw = sum(p for (h, a), p in h1_grid.items() if h == a)
    p_ht_away = sum(p for (h, a), p in h1_grid.items() if h < a)

    # Joint (1H, 2H) -> (HT, FT) probabilities for HT/FT and HT/FT + O/U 2.5
    ht_ft_probs = {
        f"{r1}_{r2}": 0.0
        for r1 in ("home", "draw", "away")
        for r2 in ("home", "draw", "away")
    }
    ht_ft_ou_probs = {
        f"{r1}_{r2}_{ou}": 0.0
        for r1 in ("home", "draw", "away")
        for r2 in ("home", "draw", "away")
        for ou in ("over_2_5", "under_2_5")
    }

    for (h1, a1), p1 in h1_grid.items():
        r1 = "home" if h1 > a1 else ("draw" if h1 == a1 else "away")
        for (h2, a2), p2 in h2_grid.items():
            p = p1 * p2
            ft_h = h1 + h2
            ft_a = a1 + a2
            r2 = "home" if ft_h > ft_a else ("draw" if ft_h == ft_a else "away")
            key = f"{r1}_{r2}"
            ht_ft_probs[key] += p
            ou_tag = "over_2_5" if (ft_h + ft_a) >= 3 else "under_2_5"
            ht_ft_ou_probs[f"{key}_{ou_tag}"] += p

    # First / Last team to score (memoryless Poisson arrival rate share conditioned on >=1 goal)
    p_no_goal = ft_grid.get((0, 0), 0.08)
    p_any_goal = max(0.01, 1.0 - p_no_goal)
    home_arrival_share = lam_h / max(0.01, lam_h + lam_a)
    away_arrival_share = lam_a / max(0.01, lam_h + lam_a)
    p_first_home = p_any_goal * home_arrival_share
    p_first_away = p_any_goal * away_arrival_share

    def _opt(
        odds_id: str,
        outcome: str,
        label: str,
        prob: float,
        overround: float = OVERROUND,
        force_suspended: bool = False,
    ) -> dict[str, Any]:
        dec = _prob_to_decimal_odds(prob, overround)
        # Any odd lower than 1.07 is strictly locked (suspended), as are live near-zero events
        opt_suspended = (
            suspended
            or force_suspended
            or (dec < LOCK_ODDS_THRESHOLD)
            or (prob <= 0.001 and is_live)
        )
        return {
            "odds_id": odds_id,
            "oddsId": odds_id,
            "version": version,
            "outcome": outcome,
            "label": label,
            "decimal": dec,
            "suspended": opt_suspended,
            "locked": opt_suspended,
        }

    # Dynamic 3-way handicap lines:
    # Lines dynamically shift relative to in-play goal difference so that odds increase/reduce realistically
    # Prunes dead lines where the outcome is already guaranteed or impossible
    goal_diff = current_home_goals - current_away_goals
    if is_live and goal_diff != 0:
        inplay_shifts = [-goal_diff - 1, -goal_diff, -goal_diff + 1, -goal_diff - 2, -goal_diff + 2]
        all_lines = sorted(list(set([l for l in inplay_shifts if -5 <= l <= 5 and l != 0])))
    else:
        all_lines = [-2, -1, 1, 2]

    handicap_options: list[dict[str, Any]] = []
    for line in all_lines:
        p_hcap_home = sum(p for (h, a), p in ft_grid.items() if (h + line) > a)
        p_hcap_draw = sum(p for (h, a), p in ft_grid.items() if (h + line) == a)
        p_hcap_away = sum(p for (h, a), p in ft_grid.items() if (h + line) < a)
        h_sign = f"{line:+d}"
        a_sign = f"{-line:+d}"

        # If lead already guarantees or renders a side impossible in-play, enforce condition locking
        h_cond_locked = is_live and (p_hcap_home <= 0.0005 or p_hcap_home >= 0.94)
        a_cond_locked = is_live and (p_hcap_away <= 0.0005 or p_hcap_away >= 0.94)

        handicap_options.extend(
            [
                _opt(
                    f"{fid}:hcap:{line}:home",
                    f"hcap_{line}_home",
                    f"{home_name} ({h_sign})",
                    p_hcap_home,
                    force_suspended=h_cond_locked,
                ),
                _opt(
                    f"{fid}:hcap:{line}:draw",
                    f"hcap_{line}_draw",
                    f"Handicap Tie ({h_sign})",
                    p_hcap_draw,
                ),
                _opt(
                    f"{fid}:hcap:{line}:away",
                    f"hcap_{line}_away",
                    f"{away_name} ({a_sign})",
                    p_hcap_away,
                    force_suspended=a_cond_locked,
                ),
            ]
        )

    # Dynamic Asian Handicap lines:
    # Modeled across full, half, and quarter splits centered on live goal differential
    ah_options: list[dict[str, Any]] = []
    if is_live and goal_diff != 0:
        ah_center = -float(goal_diff)
        raw_ah_lines = [
            round(ah_center - 1.0, 2),
            round(ah_center - 0.75, 2),
            round(ah_center - 0.5, 2),
            round(ah_center - 0.25, 2),
            round(ah_center, 2),
            round(ah_center + 0.25, 2),
            round(ah_center + 0.5, 2),
            round(ah_center + 0.75, 2),
            round(ah_center + 1.0, 2),
        ]
        ah_lines = sorted(list(set([l for l in raw_ah_lines if -4.5 <= l <= 4.5])))
    else:
        ah_lines = [-1.0, -0.75, -0.5, -0.25, 0.0, 0.25, 0.5, 0.75, 1.0]

    for ah_line in ah_lines:
        p_home_win = 0.0
        p_away_win = 0.0
        norm_total = 0.0

        for (gh, ga), p in ft_grid.items():
            diff = gh - ga + ah_line
            is_quarter = (abs(round(ah_line * 4)) % 2 == 1)
            if not is_quarter:
                if diff > 0:
                    p_home_win += p
                elif diff < 0:
                    p_away_win += p
                norm_total += p
            else:
                low_d = gh - ga + (ah_line - 0.25)
                up_d = gh - ga + (ah_line + 0.25)
                if low_d > 0 and up_d > 0:
                    p_home_win += p
                elif low_d < 0 and up_d < 0:
                    p_away_win += p
                elif low_d > 0 or up_d > 0:
                    p_home_win += p * 0.5
                    p_away_win += p * 0.5
                norm_total += p

        if norm_total > 0:
            p_h = max(0.0001, min(0.999, p_home_win / norm_total))
            p_a = max(0.0001, min(0.999, p_away_win / norm_total))
        else:
            p_h, p_a = 0.5, 0.5

        h_lbl = f"{home_name} ({ah_line:+.2f})"
        a_lbl = f"{away_name} ({-ah_line:+.2f})"

        ah_options.append(
            _opt(
                f"{fid}:ah:{ah_line:+.2f}:home",
                f"ah_{ah_line:+.2f}_home",
                h_lbl,
                p_h,
            )
        )
        ah_options.append(
            _opt(
                f"{fid}:ah:{-ah_line:+.2f}:away",
                f"ah_{-ah_line:+.2f}_away",
                a_lbl,
                p_a,
            )
        )

    # Over/Under lines (0.5 to 4.5)
    ou_all_options: list[dict[str, Any]] = []
    for threshold in (0, 1, 2, 3, 4):
        line_str = f"{threshold}.5"
        line_slug = f"{threshold}_5"
        p_ov = sum(p for (h, a), p in ft_grid.items() if (h + a) > threshold)
        p_un = max(0.02, 1.0 - p_ov)
        ou_all_options.extend(
            [
                _opt(
                    f"{fid}:ou_goals:over_{line_slug}",
                    f"over_{line_slug}",
                    f"Over {line_str} Goals",
                    p_ov,
                ),
                _opt(
                    f"{fid}:ou_goals:under_{line_slug}",
                    f"under_{line_slug}",
                    f"Under {line_str} Goals",
                    p_un,
                ),
            ]
        )

    p_over_2_5 = sum(p for (h, a), p in ft_grid.items() if (h + a) > 2)
    p_under_2_5 = max(0.0001, 1.0 - p_over_2_5)
    btts_occurred = bool(is_live and current_home_goals >= 1 and current_away_goals >= 1)
    if btts_occurred:
        p_btts_yes = 0.999
        p_btts_no = 0.0001
    else:
        p_btts_yes = sum(p for (h, a), p in ft_grid.items() if h >= 1 and a >= 1)
        p_btts_no = max(0.0001, 1.0 - p_btts_yes)

    # Home & Away Team Goals Over/Under (0.5, 1.5, 2.5)
    home_ou_opts: list[dict[str, Any]] = []
    away_ou_opts: list[dict[str, Any]] = []
    for threshold in (0, 1, 2):
        line_str = f"{threshold}.5"
        line_slug = f"{threshold}_5"
        p_h_ov = sum(p for (h, a), p in ft_grid.items() if h > threshold)
        p_a_ov = sum(p for (h, a), p in ft_grid.items() if a > threshold)
        home_ou_opts.extend(
            [
                _opt(
                    f"{fid}:home_ou:over_{line_slug}",
                    f"home_over_{line_slug}",
                    f"{home_name} Over {line_str}",
                    p_h_ov,
                ),
                _opt(
                    f"{fid}:home_ou:under_{line_slug}",
                    f"home_under_{line_slug}",
                    f"{home_name} Under {line_str}",
                    max(0.02, 1.0 - p_h_ov),
                ),
            ]
        )
        away_ou_opts.extend(
            [
                _opt(
                    f"{fid}:away_ou:over_{line_slug}",
                    f"away_over_{line_slug}",
                    f"{away_name} Over {line_str}",
                    p_a_ov,
                ),
                _opt(
                    f"{fid}:away_ou:under_{line_slug}",
                    f"away_under_{line_slug}",
                    f"{away_name} Under {line_str}",
                    max(0.02, 1.0 - p_a_ov),
                ),
            ]
        )

    # First-half & Second-half Goals Over/Under (0.5, 1.5, 2.5)
    h1_ou_opts: list[dict[str, Any]] = []
    h2_ou_opts: list[dict[str, Any]] = []
    for threshold in (0, 1, 2):
        line_str = f"{threshold}.5"
        line_slug = f"{threshold}_5"
        p_1h_ov = sum(p for (h, a), p in h1_grid.items() if (h + a) > threshold)
        p_2h_ov = sum(p for (h, a), p in h2_grid.items() if (h + a) > threshold)
        h1_ou_opts.extend(
            [
                _opt(
                    f"{fid}:1h_ou:over_{line_slug}",
                    f"1h_over_{line_slug}",
                    f"1st Half Over {line_str}",
                    p_1h_ov,
                ),
                _opt(
                    f"{fid}:1h_ou:under_{line_slug}",
                    f"1h_under_{line_slug}",
                    f"1st Half Under {line_str}",
                    max(0.02, 1.0 - p_1h_ov),
                ),
            ]
        )
        h2_ou_opts.extend(
            [
                _opt(
                    f"{fid}:2h_ou:over_{line_slug}",
                    f"2h_over_{line_slug}",
                    f"2nd Half Over {line_str}",
                    p_2h_ov,
                ),
                _opt(
                    f"{fid}:2h_ou:under_{line_slug}",
                    f"2h_under_{line_slug}",
                    f"2nd Half Under {line_str}",
                    max(0.02, 1.0 - p_2h_ov),
                ),
            ]
        )

    # Correct Score (FT)
    cs_scores = [
        (1, 0), (2, 0), (2, 1), (3, 0), (3, 1), (3, 2),
        (0, 0), (1, 1), (2, 2), (3, 3),
        (0, 1), (0, 2), (1, 2), (0, 3), (1, 3), (2, 3),
    ]
    cs_options = [
        _opt(
            f"{fid}:cs:{h}_{a}",
            f"cs_{h}_{a}",
            f"{h} - {a}",
            ft_grid.get((h, a), 0.02),
            overround=1.08,
        )
        for (h, a) in cs_scores
    ]

    # Half-Time Correct Score
    ht_cs_scores = [
        (0, 0), (1, 0), (0, 1), (1, 1), (2, 0), (0, 2), (2, 1), (1, 2), (2, 2),
    ]
    ht_cs_options = [
        _opt(
            f"{fid}:ht_cs:{h}_{a}",
            f"ht_cs_{h}_{a}",
            f"HT {h} - {a}",
            h1_grid.get((h, a), 0.02),
            overround=1.07,
        )
        for (h, a) in ht_cs_scores
    ]

    # Odd / Even Total Goals
    p_odd = sum(p for (h, a), p in ft_grid.items() if (h + a) % 2 == 1)
    p_even = max(0.05, 1.0 - p_odd)

    # Team to Score (Home Only, Away Only, Both, Neither)
    p_home_only = sum(p for (h, a), p in ft_grid.items() if h >= 1 and a == 0)
    p_away_only = sum(p for (h, a), p in ft_grid.items() if a >= 1 and h == 0)

    # 2nd Half Result probabilities
    p_2h_home = sum(p for (h, a), p in h2_grid.items() if h > a)
    p_2h_draw = sum(p for (h, a), p in h2_grid.items() if h == a)
    p_2h_away = sum(p for (h, a), p in h2_grid.items() if h < a)

    markets = [
        # ==================== 1. MATCH RESULT MARKETS ====================
        {
            "key": "match_winner",
            "category": "result",
            "label": "Match Result (1X2)",
            "options": [
                _opt(f"{fid}:match_winner:home", "home", f"{home_name} Win", p_home),
                _opt(f"{fid}:match_winner:draw", "draw", "Draw", p_draw),
                _opt(f"{fid}:match_winner:away", "away", f"{away_name} Win", p_away),
            ],
        },
        {
            "key": "double_chance",
            "category": "result",
            "label": "Double Chance (1X / 12 / X2)",
            "options": [
                _opt(f"{fid}:dc:1x", "dc_1x", f"{home_name} or Draw (1X)", p_home + p_draw),
                _opt(f"{fid}:dc:12", "dc_12", f"{home_name} or {away_name} (12)", p_home + p_away),
                _opt(f"{fid}:dc:x2", "dc_x2", f"Draw or {away_name} (X2)", p_draw + p_away),
            ],
        },
        {
            "key": "handicap_3way",
            "category": "result",
            "label": "3-Way Handicap",
            "options": handicap_options,
        },
        {
            "key": "asian_handicap",
            "category": "handicap",
            "label": "Asian Handicap",
            "options": ah_options,
        },
        {
            "key": "half_time_result",
            "category": "half_time",
            "label": "1st Half Result (1X2)",
            "options": [
                _opt(f"{fid}:ht_result:home", "ht_home", f"{home_name} (1H)", p_ht_home),
                _opt(f"{fid}:ht_result:draw", "ht_draw", "Draw (1H)", p_ht_draw),
                _opt(f"{fid}:ht_result:away", "ht_away", f"{away_name} (1H)", p_ht_away),
            ],
        },
        {
            "key": "second_half_result",
            "category": "half_time",
            "label": "2nd Half Result (1X2)",
            "options": [
                _opt(f"{fid}:2h_result:home", "2h_home", f"{home_name} (2H)", p_2h_home),
                _opt(f"{fid}:2h_result:draw", "2h_draw", "Draw (2H)", p_2h_draw),
                _opt(f"{fid}:2h_result:away", "2h_away", f"{away_name} (2H)", p_2h_away),
            ],
        },
        {
            "key": "full_time_result",
            "category": "result",
            "label": "Full-Time Result (90 Mins)",
            "options": [
                _opt(f"{fid}:ft_result:home", "ft_home", f"{home_name} (90')", p_home),
                _opt(f"{fid}:ft_result:draw", "ft_draw", "Draw (90')", p_draw),
                _opt(f"{fid}:ft_result:away", "ft_away", f"{away_name} (90')", p_away),
            ],
        },
        {
            "key": "ht_ft",
            "category": "result",
            "label": "Half-Time / Full-Time",
            "options": [
                _opt(f"{fid}:ht_ft:home_home", "ht_ft_home_home", f"{home_name} / {home_name}", ht_ft_probs["home_home"]),
                _opt(f"{fid}:ht_ft:draw_home", "ht_ft_draw_home", f"Draw / {home_name}", ht_ft_probs["draw_home"]),
                _opt(f"{fid}:ht_ft:away_home", "ht_ft_away_home", f"{away_name} / {home_name}", ht_ft_probs["away_home"]),
                _opt(f"{fid}:ht_ft:home_draw", "ht_ft_home_draw", f"{home_name} / Draw", ht_ft_probs["home_draw"]),
                _opt(f"{fid}:ht_ft:draw_draw", "ht_ft_draw_draw", "Draw / Draw", ht_ft_probs["draw_draw"]),
                _opt(f"{fid}:ht_ft:away_draw", "ht_ft_away_draw", f"{away_name} / Draw", ht_ft_probs["away_draw"]),
                _opt(f"{fid}:ht_ft:home_away", "ht_ft_home_away", f"{home_name} / {away_name}", ht_ft_probs["home_away"]),
                _opt(f"{fid}:ht_ft:draw_away", "ht_ft_draw_away", f"Draw / {away_name}", ht_ft_probs["draw_away"]),
                _opt(f"{fid}:ht_ft:away_away", "ht_ft_away_away", f"{away_name} / {away_name}", ht_ft_probs["away_away"]),
            ],
        },
        # ==================== 2. GOALS MARKETS ====================
        {
            "key": "over_under_2_5",
            "category": "goals",
            "label": "Total Goals Over/Under 2.5",
            "options": [
                _opt(f"{fid}:over_under_2_5:over", "over_2_5", "Over 2.5 Goals", p_over_2_5),
                _opt(f"{fid}:over_under_2_5:under", "under_2_5", "Under 2.5 Goals", p_under_2_5),
            ],
        },
        {
            "key": "over_under_goals",
            "category": "goals",
            "label": "Total Goals Over/Under (0.5 – 4.5)",
            "options": ou_all_options,
        },
        {
            "key": "both_teams_to_score",
            "category": "goals",
            "label": "Both Teams to Score (BTTS)",
            "suspended": suspended or btts_occurred,
            "locked": suspended or btts_occurred,
            "options": [
                _opt(f"{fid}:btts:yes", "btts_yes", "Yes (BTTS)", p_btts_yes, force_suspended=btts_occurred),
                _opt(f"{fid}:btts:no", "btts_no", "No (Clean Sheet)", p_btts_no, force_suspended=btts_occurred),
            ],
        },
        {
            "key": "home_team_goals_ou",
            "category": "goals",
            "label": f"{home_name} Goals Over/Under",
            "options": home_ou_opts,
        },
        {
            "key": "away_team_goals_ou",
            "category": "goals",
            "label": f"{away_name} Goals Over/Under",
            "options": away_ou_opts,
        },
        {
            "key": "exact_total_goals",
            "category": "goals",
            "label": "Exact Total Goals",
            "options": [
                _opt(f"{fid}:exact_total:0", "total_0", "0 Goals", sum(p for (h, a), p in ft_grid.items() if h + a == 0)),
                _opt(f"{fid}:exact_total:1", "total_1", "1 Goal", sum(p for (h, a), p in ft_grid.items() if h + a == 1)),
                _opt(f"{fid}:exact_total:2", "total_2", "2 Goals", sum(p for (h, a), p in ft_grid.items() if h + a == 2)),
                _opt(f"{fid}:exact_total:3", "total_3", "3 Goals", sum(p for (h, a), p in ft_grid.items() if h + a == 3)),
                _opt(f"{fid}:exact_total:4", "total_4", "4 Goals", sum(p for (h, a), p in ft_grid.items() if h + a == 4)),
                _opt(f"{fid}:exact_total:5_plus", "total_5_plus", "5+ Goals", sum(p for (h, a), p in ft_grid.items() if h + a >= 5)),
            ],
        },
        {
            "key": "exact_home_goals",
            "category": "goals",
            "label": f"Exact {home_name} Goals",
            "options": [
                _opt(f"{fid}:exact_home:0", "home_exact_0", "0 Goals", sum(p for (h, a), p in ft_grid.items() if h == 0)),
                _opt(f"{fid}:exact_home:1", "home_exact_1", "1 Goal", sum(p for (h, a), p in ft_grid.items() if h == 1)),
                _opt(f"{fid}:exact_home:2", "home_exact_2", "2 Goals", sum(p for (h, a), p in ft_grid.items() if h == 2)),
                _opt(f"{fid}:exact_home:3_plus", "home_exact_3_plus", "3+ Goals", sum(p for (h, a), p in ft_grid.items() if h >= 3)),
            ],
        },
        {
            "key": "exact_away_goals",
            "category": "goals",
            "label": f"Exact {away_name} Goals",
            "options": [
                _opt(f"{fid}:exact_away:0", "away_exact_0", "0 Goals", sum(p for (h, a), p in ft_grid.items() if a == 0)),
                _opt(f"{fid}:exact_away:1", "away_exact_1", "1 Goal", sum(p for (h, a), p in ft_grid.items() if a == 1)),
                _opt(f"{fid}:exact_away:2", "away_exact_2", "2 Goals", sum(p for (h, a), p in ft_grid.items() if a == 2)),
                _opt(f"{fid}:exact_away:3_plus", "away_exact_3_plus", "3+ Goals", sum(p for (h, a), p in ft_grid.items() if a >= 3)),
            ],
        },
        {
            "key": "correct_score",
            "category": "goals",
            "label": "Correct Score (Full Time)",
            "options": cs_options,
        },
        {
            "key": "odd_even_goals",
            "category": "goals",
            "label": "Odd / Even Total Goals",
            "options": [
                _opt(f"{fid}:odd_even:odd", "odd_goals", "Odd Total Goals", p_odd),
                _opt(f"{fid}:odd_even:even", "even_goals", "Even Total Goals (incl. 0-0)", p_even),
            ],
        },
        {
            "key": "team_to_score",
            "category": "goals",
            "label": "Team to Score",
            "options": [
                _opt(f"{fid}:tts:home_only", "tts_home_only", f"{home_name} Only", p_home_only),
                _opt(f"{fid}:tts:away_only", "tts_away_only", f"{away_name} Only", p_away_only),
                _opt(f"{fid}:tts:both", "tts_both", "Both Teams", p_btts_yes),
                _opt(f"{fid}:tts:neither", "tts_neither", "Neither Team (0-0)", p_no_goal),
            ],
        },
        {
            "key": "last_team_to_score",
            "category": "goals",
            "label": "Last Team to Score",
            "options": [
                _opt(f"{fid}:last_goal:home", "last_goal_home", f"{home_name} Last", p_first_home),
                _opt(f"{fid}:last_goal:none", "last_goal_none", "No Goal (0-0)", p_no_goal),
                _opt(f"{fid}:last_goal:away", "last_goal_away", f"{away_name} Last", p_first_away),
            ],
        },
        {
            "key": "first_half_goals_ou",
            "category": "half_time",
            "label": "First-Half Goals Over/Under",
            "options": h1_ou_opts,
        },
        {
            "key": "second_half_goals_ou",
            "category": "half_time",
            "label": "Second-Half Goals Over/Under",
            "options": h2_ou_opts,
        },
        {
            "key": "ht_correct_score",
            "category": "goals",
            "label": "Half-Time Correct Score",
            "options": ht_cs_options,
        },
        # ==================== 3. COMBINATION MARKETS ====================
        {
            "key": "result_and_ou_2_5",
            "category": "combo",
            "label": "Result + Over/Under 2.5 Goals",
            "options": [
                _opt(f"{fid}:res_ou:home_over", "home_and_over_2_5", f"{home_name} & Over 2.5", sum(p for (h, a), p in ft_grid.items() if h > a and h + a >= 3)),
                _opt(f"{fid}:res_ou:home_under", "home_and_under_2_5", f"{home_name} & Under 2.5", sum(p for (h, a), p in ft_grid.items() if h > a and h + a <= 2)),
                _opt(f"{fid}:res_ou:draw_over", "draw_and_over_2_5", "Draw & Over 2.5", sum(p for (h, a), p in ft_grid.items() if h == a and h + a >= 3)),
                _opt(f"{fid}:res_ou:draw_under", "draw_and_under_2_5", "Draw & Under 2.5", sum(p for (h, a), p in ft_grid.items() if h == a and h + a <= 2)),
                _opt(f"{fid}:res_ou:away_over", "away_and_over_2_5", f"{away_name} & Over 2.5", sum(p for (h, a), p in ft_grid.items() if h < a and h + a >= 3)),
                _opt(f"{fid}:res_ou:away_under", "away_and_under_2_5", f"{away_name} & Under 2.5", sum(p for (h, a), p in ft_grid.items() if h < a and h + a <= 2)),
            ],
        },
        {
            "key": "result_and_btts",
            "category": "combo",
            "label": "Result + Both Teams to Score",
            "options": [
                _opt(f"{fid}:res_btts:home_yes", "home_and_btts_yes", f"{home_name} & BTTS Yes", sum(p for (h, a), p in ft_grid.items() if h > a and h >= 1 and a >= 1)),
                _opt(f"{fid}:res_btts:home_no", "home_and_btts_no", f"{home_name} & BTTS No", sum(p for (h, a), p in ft_grid.items() if h > a and (h == 0 or a == 0))),
                _opt(f"{fid}:res_btts:draw_yes", "draw_and_btts_yes", "Draw & BTTS Yes", sum(p for (h, a), p in ft_grid.items() if h == a and h >= 1)),
                _opt(f"{fid}:res_btts:draw_no", "draw_and_btts_no", "Draw & BTTS No (0-0)", ft_grid.get((0, 0), 0.08)),
                _opt(f"{fid}:res_btts:away_yes", "away_and_btts_yes", f"{away_name} & BTTS Yes", sum(p for (h, a), p in ft_grid.items() if h < a and h >= 1 and a >= 1)),
                _opt(f"{fid}:res_btts:away_no", "away_and_btts_no", f"{away_name} & BTTS No", sum(p for (h, a), p in ft_grid.items() if h < a and (h == 0 or a == 0))),
            ],
        },
        {
            "key": "btts_and_ou_2_5",
            "category": "combo",
            "label": "BTTS + Over/Under 2.5 Goals",
            "options": [
                _opt(f"{fid}:btts_ou:yes_over", "btts_yes_over_2_5", "BTTS Yes & Over 2.5", sum(p for (h, a), p in ft_grid.items() if h >= 1 and a >= 1 and h + a >= 3)),
                _opt(f"{fid}:btts_ou:yes_under", "btts_yes_under_2_5", "BTTS Yes & Under 2.5 (1-1)", ft_grid.get((1, 1), 0.11)),
                _opt(f"{fid}:btts_ou:no_over", "btts_no_over_2_5", "BTTS No & Over 2.5", sum(p for (h, a), p in ft_grid.items() if (h == 0 or a == 0) and h + a >= 3)),
                _opt(f"{fid}:btts_ou:no_under", "btts_no_under_2_5", "BTTS No & Under 2.5", sum(p for (h, a), p in ft_grid.items() if (h == 0 or a == 0) and h + a <= 2)),
            ],
        },
        {
            "key": "ht_ft_and_ou_2_5",
            "category": "combo",
            "label": "Half-Time/Full-Time + Goals",
            "options": [
                _opt(f"{fid}:htft_ou:hh_over", "htft_home_home_over_2_5", f"{home_name}/{home_name} & Over 2.5", ht_ft_ou_probs["home_home_over_2_5"]),
                _opt(f"{fid}:htft_ou:hh_under", "htft_home_home_under_2_5", f"{home_name}/{home_name} & Under 2.5", ht_ft_ou_probs["home_home_under_2_5"]),
                _opt(f"{fid}:htft_ou:dh_over", "htft_draw_home_over_2_5", f"Draw/{home_name} & Over 2.5", ht_ft_ou_probs["draw_home_over_2_5"]),
                _opt(f"{fid}:htft_ou:dd_under", "htft_draw_draw_under_2_5", "Draw/Draw & Under 2.5", ht_ft_ou_probs["draw_draw_under_2_5"]),
                _opt(f"{fid}:htft_ou:da_over", "htft_draw_away_over_2_5", f"Draw/{away_name} & Over 2.5", ht_ft_ou_probs["draw_away_over_2_5"]),
                _opt(f"{fid}:htft_ou:aa_over", "htft_away_away_over_2_5", f"{away_name}/{away_name} & Over 2.5", ht_ft_ou_probs["away_away_over_2_5"]),
                _opt(f"{fid}:htft_ou:aa_under", "htft_away_away_under_2_5", f"{away_name}/{away_name} & Under 2.5", ht_ft_ou_probs["away_away_under_2_5"]),
            ],
        },
        {
            "key": "team_to_score_and_result",
            "category": "combo",
            "label": "Team to Score + Match Result",
            "options": [
                _opt(f"{fid}:tts_res:home_first_home_win", "first_home_and_home", f"{home_name} Scores First & Wins", p_home * 0.78),
                _opt(f"{fid}:tts_res:home_first_draw", "first_home_and_draw", f"{home_name} Scores First & Draw", max(0.03, (p_draw - p_no_goal) * home_arrival_share)),
                _opt(f"{fid}:tts_res:home_first_away_win", "first_home_and_away", f"{home_name} Scores First & {away_name} Wins", p_away * 0.18),
                _opt(f"{fid}:tts_res:away_first_away_win", "first_away_and_away", f"{away_name} Scores First & Wins", p_away * 0.78),
                _opt(f"{fid}:tts_res:away_first_draw", "first_away_and_draw", f"{away_name} Scores First & Draw", max(0.03, (p_draw - p_no_goal) * away_arrival_share)),
                _opt(f"{fid}:tts_res:away_first_home_win", "first_away_and_home", f"{away_name} Scores First & {home_name} Wins", p_home * 0.18),
            ],
        },
    ]

    # Lock all 1st-half markets once the first half finishes (elapsed_seconds >= 240 / 45' HT)
    FIRST_HALF_MARKETS = {
        "half_time_result",
        "first_half_goals_ou",
        "ht_correct_score",
        "ht_ft",
        "ht_ft_and_ou_2_5",
    }
    half_boundary = match_duration_seconds // 2
    is_first_half_finished = is_live and elapsed_seconds >= half_boundary

    if is_first_half_finished or suspended:
        for m in markets:
            if m.get("key") in FIRST_HALF_MARKETS:
                m["suspended"] = True
                m["locked"] = True
                for opt in m.get("options", []):
                    opt["suspended"] = True
                    opt["locked"] = True

    if btts_occurred or suspended:
        for m in markets:
            if m.get("key") in ("both_teams_to_score", "btts"):
                m["suspended"] = True
                m["locked"] = True
                for opt in m.get("options", []):
                    opt["suspended"] = True
                    opt["locked"] = True

    # Comprehensive In-Play Condition-Met Locking:
    # If the event condition has already been met or is impossible, lock the odds immediately
    if is_live:
        cur_tot = current_home_goals + current_away_goals
        cur_1h_tot = cur_1h_h + cur_1h_a
        cur_2h_tot = cur_2h_h + cur_2h_a
        for m in markets:
            mkey = m.get("key", "")
            # Over/Under total goals (0.5, 1.5, 2.5, 3.5, 4.5)
            if mkey in ("over_under_goals", "over_under_2_5"):
                for opt in m.get("options", []):
                    o_out = opt.get("outcome", "")
                    lbl = opt.get("label", "")
                    for t in (0, 1, 2, 3, 4):
                        if f"_{t}_5" in o_out or f"{t}.5" in lbl:
                            if cur_tot > t:
                                opt["suspended"] = True
                                opt["locked"] = True
                # Legacy 2.5 aliases
                if cur_tot >= 3:
                    for opt in m.get("options", []):
                        if opt.get("outcome") in ("over", "over_2_5", "under", "under_2_5") or "2.5" in opt.get("label", ""):
                            opt["suspended"] = True
                            opt["locked"] = True

            # First-Half Goals Over/Under (0.5, 1.5, 2.5)
            if mkey == "first_half_goals_ou":
                for opt in m.get("options", []):
                    o_out = opt.get("outcome", "")
                    lbl = opt.get("label", "")
                    for t in (0, 1, 2):
                        if f"_{t}_5" in o_out or f"{t}.5" in lbl:
                            if cur_1h_tot > t or elapsed_seconds >= half_boundary:
                                opt["suspended"] = True
                                opt["locked"] = True

            # Second-Half Goals Over/Under (0.5, 1.5, 2.5)
            if mkey == "second_half_goals_ou":
                for opt in m.get("options", []):
                    o_out = opt.get("outcome", "")
                    lbl = opt.get("label", "")
                    for t in (0, 1, 2):
                        if f"_{t}_5" in o_out or f"{t}.5" in lbl:
                            if (elapsed_seconds >= half_boundary and cur_2h_tot > t) or (elapsed_seconds >= match_duration_seconds):
                                opt["suspended"] = True
                                opt["locked"] = True

            # Team Goals Over/Under
            if mkey == "home_team_goals_ou":
                for opt in m.get("options", []):
                    for t in (0, 1, 2):
                        if f"_{t}_5" in opt.get("outcome", "") or f"{t}.5" in opt.get("label", ""):
                            if current_home_goals > t:
                                opt["suspended"] = True
                                opt["locked"] = True
            if mkey == "away_team_goals_ou":
                for opt in m.get("options", []):
                    for t in (0, 1, 2):
                        if f"_{t}_5" in opt.get("outcome", "") or f"{t}.5" in opt.get("label", ""):
                            if current_away_goals > t:
                                opt["suspended"] = True
                                opt["locked"] = True

            # Combination markets containing Under 2.5
            if cur_tot >= 3 and mkey in ("result_and_ou_2_5", "btts_and_ou_2_5", "ht_ft_and_ou_2_5"):
                for opt in m.get("options", []):
                    o_out = opt.get("outcome", "")
                    lbl = opt.get("label", "")
                    if "under_2_5" in o_out or "under 2.5" in lbl.lower():
                        opt["suspended"] = True
                        opt["locked"] = True

            # Exact goals
            if mkey == "exact_total_goals":
                for opt in m.get("options", []):
                    try:
                        exact_val = int(opt["outcome"].split("_")[-1])
                        if exact_val < cur_tot:
                            opt["suspended"] = True
                            opt["locked"] = True
                    except Exception:
                        pass
            if mkey == "exact_home_goals":
                for opt in m.get("options", []):
                    try:
                        exact_val = int(opt["outcome"].split("_")[-1])
                        if exact_val < current_home_goals:
                            opt["suspended"] = True
                            opt["locked"] = True
                    except Exception:
                        pass
            if mkey == "exact_away_goals":
                for opt in m.get("options", []):
                    try:
                        exact_val = int(opt["outcome"].split("_")[-1])
                        if exact_val < current_away_goals:
                            opt["suspended"] = True
                            opt["locked"] = True
                    except Exception:
                        pass

            # Correct score
            if mkey in ("correct_score", "ht_correct_score"):
                for opt in m.get("options", []):
                    lbl = opt.get("label", "")
                    if "-" in lbl:
                        try:
                            ch, ca = [int(x.strip()) for x in lbl.split("-")]
                            if ch < current_home_goals or ca < current_away_goals:
                                opt["suspended"] = True
                                opt["locked"] = True
                        except Exception:
                            pass

        # If all options in a market are locked or suspended, mark the whole market locked
        for m in markets:
            opts = m.get("options", [])
            if opts and all(o.get("locked") or o.get("suspended") for o in opts):
                m["suspended"] = True
                m["locked"] = True

    # Universal enforcement: Any odd lower than 1.07 must be locked
    for m in markets:
        for opt in m.get("options", []):
            if opt.get("decimal", 0) < LOCK_ODDS_THRESHOLD:
                opt["suspended"] = True
                opt["locked"] = True

    return markets


def _extract_goal_context(
    home_goals: int,
    away_goals: int,
    events: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Derive 1H, 2H, First Scorer, and Last Scorer from match events or deterministic fallback."""
    ht_home = 0
    ht_away = 0
    first_scorer: str | None = None
    last_scorer: str | None = None

    goal_events = []
    if events:
        for ev in events:
            ev_type = ev.get("event_type") or ev.get("type")
            if ev_type == "goal":
                goal_events.append(ev)

    if goal_events:
        for ev in goal_events:
            minute = ev.get("minute", 0)
            payload = ev.get("payload") or {}
            side = payload.get("side")
            if side == "home":
                if minute <= 240:
                    ht_home += 1
                if first_scorer is None:
                    first_scorer = "home"
                last_scorer = "home"
            elif side == "away":
                if minute <= 240:
                    ht_away += 1
                if first_scorer is None:
                    first_scorer = "away"
                last_scorer = "away"
    else:
        # Deterministic fallback when events aren't passed directly
        ht_home = home_goals // 2
        ht_away = away_goals // 2
        if home_goals > 0 or away_goals > 0:
            first_scorer = "home" if home_goals >= away_goals else "away"
            last_scorer = "home" if home_goals > away_goals else ("away" if away_goals > 0 else "home")

    h2_home = max(0, home_goals - ht_home)
    h2_away = max(0, away_goals - ht_away)

    return {
        "ht_home": ht_home,
        "ht_away": ht_away,
        "h2_home": h2_home,
        "h2_away": h2_away,
        "first_scorer": first_scorer or "none",
        "last_scorer": last_scorer or "none",
    }


def evaluate_selection_outcome(
    market_key: str,
    outcome: str | None,
    label: str,
    odds_id: str | None,
    home_goals: int,
    away_goals: int,
    events: list[dict[str, Any]] | None = None,
) -> bool:
    """Evaluate whether a single bet selection won across all 27 markets."""
    key = (market_key or "").lower()
    out = (outcome or "").lower()
    lbl = (label or "").lower()
    oid = (odds_id or "").lower()

    total = home_goals + away_goals
    btts = home_goals >= 1 and away_goals >= 1
    ctx = _extract_goal_context(home_goals, away_goals, events)
    ht_h = ctx["ht_home"]
    ht_a = ctx["ht_away"]
    h2_h = ctx["h2_home"]
    h2_a = ctx["h2_away"]
    ht_total = ht_h + ht_a
    h2_total = h2_h + h2_a
    first_scorer = ctx["first_scorer"]
    last_scorer = ctx["last_scorer"]

    ft_res = "home" if home_goals > away_goals else ("draw" if home_goals == away_goals else "away")
    ht_res = "home" if ht_h > ht_a else ("draw" if ht_h == ht_a else "away")

    # 1. Match Result (1X2) & Full-Time Result
    if key in ("match_winner", "1x2", "full_time_result"):
        if out in ("home", "ft_home") or oid.endswith("home_win") or oid.endswith(":home"):
            return ft_res == "home"
        if out in ("draw", "ft_draw") or oid.endswith("draw") or oid.endswith(":draw"):
            return ft_res == "draw"
        if out in ("away", "ft_away") or oid.endswith("away_win") or oid.endswith(":away"):
            return ft_res == "away"

    # 2. Double Chance
    if key == "double_chance":
        if out == "dc_1x" or oid.endswith(":1x"):
            return home_goals >= away_goals
        if out == "dc_12" or oid.endswith(":12"):
            return home_goals != away_goals
        if out == "dc_x2" or oid.endswith(":x2"):
            return away_goals >= home_goals

    # 3. Draw No Bet
    if key == "draw_no_bet":
        if out == "dnb_home" or oid.endswith(":home"):
            return home_goals > away_goals
        if out == "dnb_away" or oid.endswith(":away"):
            return away_goals > home_goals

    # 4. 3-Way Handicap (hcap_<line>_<home|draw|away>)
    if key == "handicap_3way" or out.startswith("hcap_"):
        parts = out.split("_")
        if len(parts) == 3:
            try:
                line = int(parts[1])
                side = parts[2]
                adj_home = home_goals + line
                if side == "home":
                    return adj_home > away_goals
                if side == "draw":
                    return adj_home == away_goals
                if side == "away":
                    return adj_home < away_goals
            except ValueError:
                pass

    # 4b. Asian Handicap (ah_<line>_<home|away>)
    if key == "asian_handicap" or out.startswith("ah_") or ":ah:" in oid:
        try:
            parts = out.split("_")
            if len(parts) >= 3:
                line_val = float(parts[1])
                is_home = (parts[2] == "home")
                try:
                    from backend.app.services.asian_handicap import settle_asian_handicap, AsianSettlementOutcome
                except ImportError:
                    from app.services.asian_handicap import settle_asian_handicap, AsianSettlementOutcome
                ah_res = settle_asian_handicap(
                    stake_minor=1000,
                    odds_decimal=2.00,
                    handicap=line_val,
                    home_goals=home_goals,
                    away_goals=away_goals,
                    is_home_bet=is_home,
                )
                return ah_res.outcome in (AsianSettlementOutcome.WON, AsianSettlementOutcome.HALF_WON, AsianSettlementOutcome.PUSH)
        except Exception:
            pass

    # 5. Half-Time Result
    if key == "half_time_result":
        if out == "ht_home":
            return ht_res == "home"
        if out == "ht_draw":
            return ht_res == "draw"
        if out == "ht_away":
            return ht_res == "away"

    # 6. Half-Time / Full-Time
    if key == "ht_ft" or out.startswith("ht_ft_"):
        parts = out.replace("ht_ft_", "").split("_")
        if len(parts) == 2:
            return ht_res == parts[0] and ft_res == parts[1]

    # 7. Total Goals Over/Under (2.5 & multi-line 0.5..4.5)
    if key in ("over_under_2_5", "over_under_goals"):
        for threshold in (0, 1, 2, 3, 4):
            slug = f"{threshold}_5"
            if out == f"over_{slug}" or oid.endswith(f"over_{slug}"):
                return total > threshold
            if out == f"under_{slug}" or oid.endswith(f"under_{slug}"):
                return total <= threshold
        if out in ("over", "over_2_5") or "over" in lbl or oid.endswith(":over"):
            return total >= 3
        if out in ("under", "under_2_5") or "under" in lbl or oid.endswith(":under"):
            return total <= 2

    # 8. Both Teams to Score
    if key == "both_teams_to_score":
        if out in ("yes", "btts_yes") or "yes" in lbl or oid.endswith(":yes"):
            return btts
        if out in ("no", "btts_no") or "no" in lbl or oid.endswith(":no"):
            return not btts

    # 9. Home Team Goals Over/Under
    if key == "home_team_goals_ou":
        for threshold in (0, 1, 2):
            slug = f"{threshold}_5"
            if out == f"home_over_{slug}":
                return home_goals > threshold
            if out == f"home_under_{slug}":
                return home_goals <= threshold

    # 10. Away Team Goals Over/Under
    if key == "away_team_goals_ou":
        for threshold in (0, 1, 2):
            slug = f"{threshold}_5"
            if out == f"away_over_{slug}":
                return away_goals > threshold
            if out == f"away_under_{slug}":
                return away_goals <= threshold

    # 11. Exact Total Goals
    if key == "exact_total_goals":
        if out == "total_5_plus":
            return total >= 5
        for g in range(5):
            if out == f"total_{g}":
                return total == g

    # 12. Exact Home Team Goals
    if key == "exact_home_goals":
        if out == "home_exact_3_plus":
            return home_goals >= 3
        for g in range(3):
            if out == f"home_exact_{g}":
                return home_goals == g

    # 13. Exact Away Team Goals
    if key == "exact_away_goals":
        if out == "away_exact_3_plus":
            return away_goals >= 3
        for g in range(3):
            if out == f"away_exact_{g}":
                return away_goals == g

    # 14. Correct Score (FT)
    if key == "correct_score" or out.startswith("cs_"):
        parts = out.replace("cs_", "").split("_")
        if len(parts) == 2:
            try:
                return home_goals == int(parts[0]) and away_goals == int(parts[1])
            except ValueError:
                pass

    # 15. Odd / Even Total Goals
    if key == "odd_even_goals":
        if out == "odd_goals":
            return total % 2 == 1
        if out == "even_goals":
            return total % 2 == 0

    # 16. Team to Score
    if key == "team_to_score":
        if out == "tts_home_only":
            return home_goals >= 1 and away_goals == 0
        if out == "tts_away_only":
            return away_goals >= 1 and home_goals == 0
        if out == "tts_both":
            return btts
        if out == "tts_neither":
            return total == 0

    # 17. 2nd Half Result (1X2)
    if key in ("second_half_result", "2h_result"):
        h2_res = "home" if h2_h > h2_a else ("draw" if h2_h == h2_a else "away")
        if out in ("2h_home", "home") or oid.endswith(":home"):
            return h2_res == "home"
        if out in ("2h_draw", "draw") or oid.endswith(":draw"):
            return h2_res == "draw"
        if out in ("2h_away", "away") or oid.endswith(":away"):
            return h2_res == "away"

    # 18. 1st Half Both Teams to Score
    if key in ("first_half_btts", "1h_btts"):
        h1_btts = ht_h >= 1 and ht_a >= 1
        if out in ("1h_btts_yes", "yes") or oid.endswith(":yes"):
            return h1_btts
        if out in ("1h_btts_no", "no") or oid.endswith(":no"):
            return not h1_btts

    # 19. 2nd Half Both Teams to Score
    if key in ("second_half_btts", "2h_btts"):
        h2_btts = h2_h >= 1 and h2_a >= 1
        if out in ("2h_btts_yes", "yes") or oid.endswith(":yes"):
            return h2_btts
        if out in ("2h_btts_no", "no") or oid.endswith(":no"):
            return not h2_btts

    # 18. Last Team to Score
    if key == "last_team_to_score":
        if out == "last_goal_home":
            return last_scorer == "home"
        if out == "last_goal_away":
            return last_scorer == "away"
        if out == "last_goal_none":
            return total == 0

    # 19. First-Half Goals Over/Under
    if key == "first_half_goals_ou":
        for threshold in (0, 1, 2):
            slug = f"{threshold}_5"
            if out == f"1h_over_{slug}":
                return ht_total > threshold
            if out == f"1h_under_{slug}":
                return ht_total <= threshold

    # 20. Second-Half Goals Over/Under
    if key == "second_half_goals_ou":
        for threshold in (0, 1, 2):
            slug = f"{threshold}_5"
            if out == f"2h_over_{slug}":
                return h2_total > threshold
            if out == f"2h_under_{slug}":
                return h2_total <= threshold

    # 21. Half-Time Correct Score
    if key == "ht_correct_score" or out.startswith("ht_cs_"):
        parts = out.replace("ht_cs_", "").split("_")
        if len(parts) == 2:
            try:
                return ht_h == int(parts[0]) and ht_a == int(parts[1])
            except ValueError:
                pass

    # 22. Combo: Result + Over/Under 2.5
    if key == "result_and_ou_2_5":
        if out == "home_and_over_2_5":
            return ft_res == "home" and total >= 3
        if out == "home_and_under_2_5":
            return ft_res == "home" and total <= 2
        if out == "draw_and_over_2_5":
            return ft_res == "draw" and total >= 3
        if out == "draw_and_under_2_5":
            return ft_res == "draw" and total <= 2
        if out == "away_and_over_2_5":
            return ft_res == "away" and total >= 3
        if out == "away_and_under_2_5":
            return ft_res == "away" and total <= 2

    # 23. Combo: Result + BTTS
    if key == "result_and_btts":
        if out == "home_and_btts_yes":
            return ft_res == "home" and btts
        if out == "home_and_btts_no":
            return ft_res == "home" and not btts
        if out == "draw_and_btts_yes":
            return ft_res == "draw" and btts
        if out == "draw_and_btts_no":
            return ft_res == "draw" and not btts
        if out == "away_and_btts_yes":
            return ft_res == "away" and btts
        if out == "away_and_btts_no":
            return ft_res == "away" and not btts

    # 24. Combo: BTTS + Over/Under 2.5
    if key == "btts_and_ou_2_5":
        if out == "btts_yes_over_2_5":
            return btts and total >= 3
        if out == "btts_yes_under_2_5":
            return btts and total <= 2
        if out == "btts_no_over_2_5":
            return (not btts) and total >= 3
        if out == "btts_no_under_2_5":
            return (not btts) and total <= 2

    # 25. Combo: HT/FT + Over/Under 2.5
    if key == "ht_ft_and_ou_2_5" or out.startswith("htft_"):
        # e.g. htft_home_home_over_2_5
        cleaned = out.replace("htft_", "")
        parts = cleaned.split("_")
        if len(parts) >= 4:
            r1, r2, ou_dir = parts[0], parts[1], parts[2]
            ou_ok = (total >= 3) if ou_dir == "over" else (total <= 2)
            return ht_res == r1 and ft_res == r2 and ou_ok

    # 26. Combo: Team to Score + Match Result
    if key == "team_to_score_and_result":
        if out == "first_home_and_home":
            return first_scorer == "home" and ft_res == "home"
        if out == "first_home_and_draw":
            return first_scorer == "home" and ft_res == "draw"
        if out == "first_home_and_away":
            return first_scorer == "home" and ft_res == "away"
        if out == "first_away_and_away":
            return first_scorer == "away" and ft_res == "away"
        if out == "first_away_and_draw":
            return first_scorer == "away" and ft_res == "draw"
        if out == "first_away_and_home":
            return first_scorer == "away" and ft_res == "home"

    return False


# Backwards compatibility alias
evaluate_market_outcome = evaluate_selection_outcome


def evaluate_early_condition_settlement(
    market_key: str,
    outcome: str | None,
    label: str | None = None,
    odds_id: str | None = None,
    home_goals: int = 0,
    away_goals: int = 0,
    clock_seconds: int = 0,
    match_duration_seconds: int = 480,
    events: list[dict[str, Any]] | None = None,
) -> tuple[bool, bool]:
    """Evaluate whether an in-play selection's condition has ALREADY been met before full-time.

    Returns:
        (is_concluded, is_won):
        - is_concluded=True, is_won=True: The condition was met (e.g. Over 1.5 with 2 goals scored). Settles WON early.
        - is_concluded=True, is_won=False: The condition is now mathematically impossible (e.g. Under 1.5 with 2 goals). Settles LOST early.
        - is_concluded=False, is_won=False: Outcome remains undetermined until more goals or full-time.
    """
    key = (market_key or "").lower()
    out = (outcome or "").lower()
    lbl = (label or "").lower()
    oid = (odds_id or "").lower()
    total = home_goals + away_goals

    # 1. Total Goals Over/Under (Over lines win early when threshold exceeded; Under lines lose early)
    if key in ("over_under_2_5", "over_under_goals"):
        for threshold in (0, 1, 2, 3, 4):
            slug = f"{threshold}_5"
            if out == f"over_{slug}" or oid.endswith(f"over_{slug}") or f"over_{slug}" in oid:
                if total > threshold:
                    return (True, True)  # Over condition met -> WON
            if out == f"under_{slug}" or oid.endswith(f"under_{slug}") or f"under_{slug}" in oid:
                if total > threshold:
                    return (True, False)  # Total exceeded line -> Under impossible -> LOST

        # Legacy 2.5 aliases
        if out in ("over", "over_2_5") or oid.endswith(":over") or ":over_2_5" in oid:
            if total >= 3:
                return (True, True)
        if out in ("under", "under_2_5") or oid.endswith(":under") or ":under_2_5" in oid:
            if total >= 3:
                return (True, False)

    # 2. Both Teams To Score (BTTS Yes wins early; BTTS No loses early once both score)
    if key == "both_teams_to_score":
        if home_goals >= 1 and away_goals >= 1:
            if out in ("yes", "btts_yes") or "yes" in lbl or oid.endswith(":yes"):
                return (True, True)  # Both teams scored -> WON
            if out in ("no", "btts_no") or "no" in lbl or oid.endswith(":no"):
                return (True, False)  # Both teams scored -> Clean sheet impossible -> LOST

    # 3. Home Team Goals Over/Under
    if key == "home_team_goals_ou":
        for threshold in (0, 1, 2):
            slug = f"{threshold}_5"
            if out == f"home_over_{slug}" or f"home_over_{slug}" in oid:
                if home_goals > threshold:
                    return (True, True)
            if out == f"home_under_{slug}" or f"home_under_{slug}" in oid:
                if home_goals > threshold:
                    return (True, False)

    # 4. Away Team Goals Over/Under
    if key == "away_team_goals_ou":
        for threshold in (0, 1, 2):
            slug = f"{threshold}_5"
            if out == f"away_over_{slug}" or f"away_over_{slug}" in oid:
                if away_goals > threshold:
                    return (True, True)
            if out == f"away_under_{slug}" or f"away_under_{slug}" in oid:
                if away_goals > threshold:
                    return (True, False)

    # 5. First-Half Goals Over/Under early settlement
    ctx = _extract_goal_context(home_goals, away_goals, events)
    half_boundary = match_duration_seconds // 2
    if clock_seconds < half_boundary:
        ht_total = total
    else:
        ht_total = ctx["ht_home"] + ctx["ht_away"]
    h2_total = max(0, total - ht_total)

    if key == "first_half_goals_ou":
        for threshold in (0, 1, 2):
            slug = f"{threshold}_5"
            if out == f"1h_over_{slug}" or f"1h_over_{slug}" in oid:
                if ht_total > threshold:
                    return (True, True)
                if clock_seconds >= half_boundary and ht_total <= threshold:
                    return (True, False)
            if out == f"1h_under_{slug}" or f"1h_under_{slug}" in oid:
                if ht_total > threshold:
                    return (True, False)
                if clock_seconds >= half_boundary and ht_total <= threshold:
                    return (True, True)

    # 6. Second-Half Goals Over/Under early settlement
    if key == "second_half_goals_ou" and clock_seconds >= half_boundary:
        for threshold in (0, 1, 2):
            slug = f"{threshold}_5"
            if out == f"2h_over_{slug}" or f"2h_over_{slug}" in oid:
                if h2_total > threshold:
                    return (True, True)
                if clock_seconds >= match_duration_seconds and h2_total <= threshold:
                    return (True, False)
            if out == f"2h_under_{slug}" or f"2h_under_{slug}" in oid:
                if h2_total > threshold:
                    return (True, False)
                if clock_seconds >= match_duration_seconds and h2_total <= threshold:
                    return (True, True)

    # 7. Other First Half Markets concluded at half-time (clock >= 240)
    if clock_seconds >= half_boundary and key in (
        "half_time_result",
        "ht_correct_score",
        "ht_ft",
        "ht_ft_and_ou_2_5",
    ):
        won = evaluate_selection_outcome(
            market_key=key,
            outcome=outcome,
            label=label,
            odds_id=odds_id,
            home_goals=home_goals,
            away_goals=away_goals,
            events=events,
        )
        return (True, won)

    return (False, False)
