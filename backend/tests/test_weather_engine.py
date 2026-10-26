"""Unit tests for weather engine and pitch physical simulation."""

import unittest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.weather_engine import (
    TurfCondition,
    WeatherCondition,
    generate_match_weather,
    compute_wind_drift_offset,
)


class TestWeatherEngine(unittest.TestCase):
    def test_english_weather_generation(self):
        weather = generate_match_weather("England", seed=42)
        self.assertIn(
            weather.condition,
            [WeatherCondition.CLEAR, WeatherCondition.OVERCAST, WeatherCondition.LIGHT_RAIN, WeatherCondition.HEAVY_RAIN],
        )
        self.assertTrue(0.3 <= weather.ball_roll_friction <= 0.8)
        self.assertTrue(1.0 <= weather.passing_error_multiplier <= 1.4)

    def test_spanish_warm_climate(self):
        weather = generate_match_weather("Spain", is_evening=False, seed=10)
        self.assertTrue(weather.temperature_celsius > 12.0)
        self.assertTrue(weather.wind_speed_kmh >= 0.0)

    def test_wind_drift_aerodynamics(self):
        # 40-meter cross in 30 km/h crosswind (90 degrees to pass direction)
        lat_disp, long_disp = compute_wind_drift_offset(
            pass_distance_meters=40.0,
            wind_speed_kmh=30.0,
            wind_direction_deg=180.0,
            target_bearing_deg=90.0,
        )
        self.assertTrue(abs(lat_disp) > 0.5)  # Meaningful lateral drift


if __name__ == "__main__":
    unittest.main()
