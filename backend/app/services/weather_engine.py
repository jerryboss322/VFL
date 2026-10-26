"""Stadium Atmospheric Weather Conditions and Turf Physics Simulation Engine.

Simulates environmental physics and tactical impact across European football leagues:
- Precipitation types: CLEAR, OVERCAST, LIGHT_RAIN, HEAVY_RAIN, SNOW, FOG
- Surface conditions: DRY, SLICK, WATERLOGGED, FROZEN
- Aerodynamic effects: wind vector drift on long passes and crossing trajectories
- Ball physics: rolling resistance friction (mu), vertical bounce restitution coefficient (COR)
- Player physiology: humidity and heat exhaustion stamina drain rate, goalkeeper grip handling error probability
"""

from dataclasses import dataclass
from enum import Enum
import math
import random
from typing import Dict, Optional, Tuple


class WeatherCondition(str, Enum):
    CLEAR = "CLEAR"
    OVERCAST = "OVERCAST"
    LIGHT_RAIN = "LIGHT_RAIN"
    HEAVY_RAIN = "HEAVY_RAIN"
    SNOW = "SNOW"
    FOG = "FOG"


class TurfCondition(str, Enum):
    DRY_FIRM = "DRY_FIRM"
    SLICK_FAST = "SLICK_FAST"
    WET_SLOW = "WET_SLOW"
    WATERLOGGED = "WATERLOGGED"
    FROZEN = "FROZEN"


@dataclass
class MatchWeatherProfile:
    temperature_celsius: float
    humidity_percent: float
    wind_speed_kmh: float
    wind_direction_deg: float
    condition: WeatherCondition
    turf: TurfCondition
    ball_roll_friction: float         # 0.35 (slick) to 0.75 (waterlogged)
    bounce_restitution: float          # 0.50 (dead ball) to 0.85 (bouncy)
    passing_error_multiplier: float    # 1.0 (ideal) to 1.35 (severe rain/snow)
    fatigue_drain_multiplier: float    # 1.0 (standard) to 1.30 (extreme heat/mud)
    goalkeeper_slip_chance: float      # 0.01 (dry) to 0.08 (slick/wet)


LEAGUE_CLIMATE_PROFILES = {
    "England": {"temp_range": (8.0, 18.0), "rain_prob": 0.35, "snow_prob": 0.03, "avg_wind": 22.0},
    "Spain": {"temp_range": (16.0, 29.0), "rain_prob": 0.12, "snow_prob": 0.00, "avg_wind": 14.0},
    "Germany": {"temp_range": (5.0, 19.0), "rain_prob": 0.28, "snow_prob": 0.08, "avg_wind": 18.0},
    "Italy": {"temp_range": (14.0, 26.0), "rain_prob": 0.18, "snow_prob": 0.01, "avg_wind": 15.0},
    "France": {"temp_range": (10.0, 22.0), "rain_prob": 0.22, "snow_prob": 0.02, "avg_wind": 16.0},
    "Netherlands": {"temp_range": (7.0, 17.0), "rain_prob": 0.32, "snow_prob": 0.04, "avg_wind": 26.0},
}


def generate_match_weather(
    country: str = "England",
    is_evening: bool = True,
    seed: Optional[int] = None,
) -> MatchWeatherProfile:
    """Generates realistic atmospheric conditions and physical turf coefficients based on country."""
    rng = random.Random(seed)
    profile = LEAGUE_CLIMATE_PROFILES.get(country, LEAGUE_CLIMATE_PROFILES["England"])

    temp_min, temp_max = profile["temp_range"]
    temp = rng.uniform(temp_min, temp_max)
    if is_evening:
        temp -= rng.uniform(2.0, 4.5)

    wind = max(0.0, rng.gauss(profile["avg_wind"], 6.0))
    wind_dir = rng.uniform(0.0, 360.0)

    # Determine precipitation
    roll = rng.random()
    if roll < profile["snow_prob"] and temp <= 2.0:
        condition = WeatherCondition.SNOW
        turf = TurfCondition.FROZEN
        friction = 0.60
        restitution = 0.58
        pass_mult = 1.25
        fatigue_mult = 1.20
        slip_prob = 0.06
    elif roll < profile["rain_prob"]:
        heavy = rng.random() < 0.25
        condition = WeatherCondition.HEAVY_RAIN if heavy else WeatherCondition.LIGHT_RAIN
        turf = TurfCondition.WATERLOGGED if heavy else TurfCondition.SLICK_FAST
        friction = 0.70 if heavy else 0.40
        restitution = 0.55 if heavy else 0.78
        pass_mult = 1.30 if heavy else 1.10
        fatigue_mult = 1.25 if heavy else 1.05
        slip_prob = 0.07 if heavy else 0.04
    else:
        overcast = rng.random() < 0.45
        condition = WeatherCondition.OVERCAST if overcast else WeatherCondition.CLEAR
        turf = TurfCondition.DRY_FIRM
        friction = 0.50
        restitution = 0.72
        pass_mult = 1.0
        fatigue_mult = 1.15 if temp > 25.0 else 1.0
        slip_prob = 0.015

    humidity = rng.uniform(45.0, 95.0) if "RAIN" in condition.value else rng.uniform(40.0, 70.0)

    return MatchWeatherProfile(
        temperature_celsius=round(temp, 1),
        humidity_percent=round(humidity, 1),
        wind_speed_kmh=round(wind, 1),
        wind_direction_deg=round(wind_dir, 1),
        condition=condition,
        turf=turf,
        ball_roll_friction=round(friction, 2),
        bounce_restitution=round(restitution, 2),
        passing_error_multiplier=round(pass_mult, 2),
        fatigue_drain_multiplier=round(fatigue_mult, 2),
        goalkeeper_slip_chance=round(slip_prob, 3),
    )


def compute_wind_drift_offset(
    pass_distance_meters: float,
    wind_speed_kmh: float,
    wind_direction_deg: float,
    target_bearing_deg: float = 90.0,
) -> Tuple[float, float]:
    """Computes lateral and longitudinal aerodynamic displacement in meters on airborne passes."""
    # Convert wind to m/s
    wind_ms = wind_speed_kmh / 3.6
    flight_time_sec = math.sqrt(pass_distance_meters / 9.81) * 0.9

    # Relative wind angle to pass vector
    rel_angle_rad = math.radians(wind_direction_deg - target_bearing_deg)
    lateral_wind = wind_ms * math.sin(rel_angle_rad)
    longitudinal_wind = wind_ms * math.cos(rel_angle_rad)

    # Displacement = 0.5 * a * t^2 where a ~ drag_coeff * wind
    lateral_disp = 0.5 * (lateral_wind * 0.15) * (flight_time_sec ** 2)
    longitudinal_disp = 0.5 * (longitudinal_wind * 0.15) * (flight_time_sec ** 2)

    return round(lateral_disp, 2), round(longitudinal_disp, 2)
