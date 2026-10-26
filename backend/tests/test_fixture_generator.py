import unittest
from backend.app.services.fixture_generator import (
    RoundRobinScheduler,
    ScheduledClub,
    GeneratedMatchFixture,
)


class TestRoundRobinScheduler(unittest.TestCase):
    def setUp(self):
        self.clubs_6 = [
            ScheduledClub("c1", "Arsenal", "ARS", "Emirates Stadium"),
            ScheduledClub("c2", "Chelsea", "CHE", "Stamford Bridge"),
            ScheduledClub("c3", "Liverpool", "LIV", "Anfield"),
            ScheduledClub("c4", "Manchester City", "MCI", "Etihad Stadium"),
            ScheduledClub("c5", "Manchester United", "MUN", "Old Trafford"),
            ScheduledClub("c6", "Tottenham Hotspur", "TOT", "Tottenham Stadium"),
        ]

    def test_validation_errors(self):
        with self.assertRaises(ValueError):
            # Less than 2 clubs
            RoundRobinScheduler("lg_fail", [self.clubs_6[0]])

        with self.assertRaises(ValueError):
            # Odd number of clubs (3 clubs)
            RoundRobinScheduler("lg_fail", self.clubs_6[:3])

    def test_six_club_double_round_robin_calendar(self):
        # 6 clubs: (6 - 1) * 2 = 10 matchdays. 6 * 5 = 30 total matches. 3 matches per round.
        scheduler = RoundRobinScheduler("eng_prem", self.clubs_6, seed=12345)
        start_time = 1700000000
        fixtures = scheduler.generate_season_calendar(
            start_epoch_unix=start_time,
            match_duration_sec=480,
            interval_between_matchdays_sec=600,
        )

        self.assertEqual(len(fixtures), 30)
        self.assertEqual(scheduler.total_rounds, 10)
        self.assertEqual(scheduler.matches_per_round, 3)

        # Validate schedule integrity mathematically
        is_valid = scheduler.validate_schedule_integrity(fixtures)
        self.assertTrue(is_valid)

    def test_matchday_sequencing_and_no_team_collisions(self):
        scheduler = RoundRobinScheduler("eng_prem", self.clubs_6, seed=42)
        fixtures = scheduler.generate_season_calendar(start_epoch_unix=1000)

        # Check matchdays 1 through 10
        by_md = {}
        for f in fixtures:
            by_md.setdefault(f.matchday, []).append(f)

        self.assertEqual(len(by_md), 10)
        for md in range(1, 11):
            md_fixtures = by_md[md]
            self.assertEqual(len(md_fixtures), 3)

            # All 6 clubs must participate in each matchday
            clubs_playing = set()
            for fix in md_fixtures:
                clubs_playing.add(fix.home_club_id)
                clubs_playing.add(fix.away_club_id)
            self.assertEqual(len(clubs_playing), 6)

    def test_home_and_away_venue_inversion(self):
        # Every pair (A, B) must play A vs B in one matchday and B vs A in another
        scheduler = RoundRobinScheduler("eng_prem", self.clubs_6, seed=999)
        fixtures = scheduler.generate_season_calendar(start_epoch_unix=1000)

        home_venues = set()
        for f in fixtures:
            home_venues.add((f.home_club_id, f.away_club_id))

        self.assertEqual(len(home_venues), 30)

        for c1 in self.clubs_6:
            for c2 in self.clubs_6:
                if c1.club_id != c2.club_id:
                    self.assertIn((c1.club_id, c2.club_id), home_venues)
                    self.assertIn((c2.club_id, c1.club_id), home_venues)

    def test_seed_determinism(self):
        sched1 = RoundRobinScheduler("lg_test", self.clubs_6, seed=777)
        sched2 = RoundRobinScheduler("lg_test", self.clubs_6, seed=777)

        fix1 = sched1.generate_season_calendar(1000)
        fix2 = sched2.generate_season_calendar(1000)

        for f1, f2 in zip(fix1, fix2):
            self.assertEqual(f1.fixture_id, f2.fixture_id)
            self.assertEqual(f1.home_club_id, f2.home_club_id)
            self.assertEqual(f1.away_club_id, f2.away_club_id)


if __name__ == "__main__":
    unittest.main()
