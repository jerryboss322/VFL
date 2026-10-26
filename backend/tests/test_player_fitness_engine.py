"""Unit tests for player fitness, stamina degradation, and card accumulation suspensions."""

import unittest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.player_fitness_engine import (
    InjuryType,
    PlayerFitnessState,
    TacticalPressingIntensity,
    calculate_stamina_drain_per_minute,
    evaluate_card_accumulation_suspension,
    simulate_player_match_minute,
)


class TestPlayerFitnessEngine(unittest.TestCase):
    def test_gegenpressing_stamina_burn(self):
        # Gegenpressing should drain stamina substantially faster than low block
        drain_gegen = calculate_stamina_drain_per_minute(TacticalPressingIntensity.GEGENPRESSING)
        drain_low = calculate_stamina_drain_per_minute(TacticalPressingIntensity.LOW_BLOCK)
        self.assertTrue(drain_gegen > drain_low * 1.5)

    def test_stamina_drain_simulation(self):
        player = PlayerFitnessState("p1", "Bukayo Saka", "FWD", starting_stamina=100, current_stamina=100)
        # Advance 45 minutes
        for m in range(45):
            stamina, injury, urgency = simulate_player_match_minute(
                player, m + 1, TacticalPressingIntensity.BALANCED_MID, seed=m
            )
        self.assertTrue(player.current_stamina < 85)
        self.assertEqual(player.minutes_played, 45)

    def test_yellow_card_accumulation_ban(self):
        # 4 yellows + 1 yellow -> 5 yellows -> 1 match suspension!
        total, suspended, reason = evaluate_card_accumulation_suspension(4, received_yellow=True, received_red=False)
        self.assertEqual(total, 5)
        self.assertTrue(suspended)
        self.assertIn("5-card threshold", reason)

        # 3 yellows + 1 yellow -> 4 yellows -> No suspension
        total2, suspended2, _ = evaluate_card_accumulation_suspension(3, received_yellow=True, received_red=False)
        self.assertEqual(total2, 4)
        self.assertFalse(suspended2)


if __name__ == "__main__":
    unittest.main()
