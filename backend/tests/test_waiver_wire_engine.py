import unittest
from backend.app.services.waiver_wire_engine import (
    WaiverWireEngine,
    WaiverTeamState,
    WaiverPlayer,
    WaiverClaim,
    ClaimStatus,
)


class TestWaiverWireEngine(unittest.TestCase):
    def setUp(self):
        # Create 3 teams with rosters
        self.team1 = WaiverTeamState(
            team_id="team_1",
            team_name="London Strikers",
            fab_balance_minor=100_00,  # 100.00 FAB
            waiver_priority_rank=1,
            roster_players={
                "p_fwd1": WaiverPlayer("p_fwd1", "Stale Striker", "FUL", "FWD", 5.0),
                "p_mid1": WaiverPlayer("p_mid1", "Sub Mid", "EVE", "MID", 4.5),
            },
        )
        self.team2 = WaiverTeamState(
            team_id="team_2",
            team_name="Manchester Titans",
            fab_balance_minor=100_00,
            waiver_priority_rank=2,
            roster_players={
                "p_fwd2": WaiverPlayer("p_fwd2", "Bench Striker", "BOU", "FWD", 5.5),
            },
        )
        self.team3 = WaiverTeamState(
            team_id="team_3",
            team_name="Liverpool Lions",
            fab_balance_minor=100_00,
            waiver_priority_rank=3,
            roster_players={
                "p_def3": WaiverPlayer("p_def3", "Injured Defender", "WOL", "DEF", 4.0),
            },
        )

        self.engine = WaiverWireEngine(
            league_id="lg_1",
            teams=[self.team1, self.team2, self.team3],
            use_fab=True,
        )

        # Populate waiver pool
        self.hot_player = WaiverPlayer("p_hot", "Hot Prospect", "BHA", "FWD", 8.0)
        self.sleeper_mid = WaiverPlayer("p_mid", "Breakout Mid", "NFO", "MID", 6.5)
        self.engine.populate_waiver_pool([self.hot_player, self.sleeper_mid])

    def test_fab_highest_bidder_wins(self):
        # Team 1 bids 25.00 for hot prospect, dropping p_fwd1
        c1 = WaiverClaim(
            claim_id="c1",
            team_id="team_1",
            add_player_id="p_hot",
            drop_player_id="p_fwd1",
            bid_amount_minor=25_00,
        )
        # Team 2 bids 35.00 for hot prospect, dropping p_fwd2
        c2 = WaiverClaim(
            claim_id="c2",
            team_id="team_2",
            add_player_id="p_hot",
            drop_player_id="p_fwd2",
            bid_amount_minor=35_00,
        )

        self.engine.submit_claim(c1)
        self.engine.submit_claim(c2)

        results = self.engine.process_clearing_cycle()
        self.assertEqual(len(results), 2)

        # Team 2 wins because 35.00 > 25.00
        self.assertEqual(c2.status, ClaimStatus.SUCCESSFUL)
        self.assertEqual(self.team2.fab_balance_minor, 65_00)
        self.assertIn("p_hot", self.team2.roster_players)
        self.assertNotIn("p_fwd2", self.team2.roster_players)
        # Old player is now in waiver pool
        self.assertIn("p_fwd2", self.engine.waiver_pool)

        # Team 1 claim should fail because hot prospect is already gone
        self.assertEqual(c1.status, ClaimStatus.FAILED_UNAVAILABLE)
        self.assertEqual(self.team1.fab_balance_minor, 100_00)  # No budget lost

    def test_fab_tied_bids_resolved_by_priority(self):
        # Both teams bid identical 20.00 FAB
        c1 = WaiverClaim(
            claim_id="c1",
            team_id="team_1",
            add_player_id="p_hot",
            drop_player_id="p_fwd1",
            bid_amount_minor=20_00,
        )
        c2 = WaiverClaim(
            claim_id="c2",
            team_id="team_2",
            add_player_id="p_hot",
            drop_player_id="p_fwd2",
            bid_amount_minor=20_00,
        )

        self.engine.submit_claim(c1)
        self.engine.submit_claim(c2)

        self.engine.process_clearing_cycle()

        # Team 1 had priority rank 1 vs Team 2 rank 2 -> Team 1 wins
        self.assertEqual(c1.status, ClaimStatus.SUCCESSFUL)
        self.assertEqual(c2.status, ClaimStatus.FAILED_UNAVAILABLE)

        # Winner rotated to last priority
        self.assertEqual(self.team1.waiver_priority_rank, 3)
        self.assertEqual(self.team2.waiver_priority_rank, 1)
        self.assertEqual(self.team3.waiver_priority_rank, 2)

    def test_priority_mode_without_fab(self):
        non_fab_engine = WaiverWireEngine(
            league_id="lg_no_fab",
            teams=[self.team1, self.team2, self.team3],
            use_fab=False,
        )
        non_fab_engine.populate_waiver_pool([self.hot_player])

        # Team 2 claims first, but Team 1 has priority 1
        c2 = WaiverClaim("c2", "team_2", "p_hot", "p_fwd2")
        c1 = WaiverClaim("c1", "team_1", "p_hot", "p_fwd1")

        non_fab_engine.submit_claim(c2)
        non_fab_engine.submit_claim(c1)

        non_fab_engine.process_clearing_cycle()

        self.assertEqual(c1.status, ClaimStatus.SUCCESSFUL)
        self.assertEqual(c2.status, ClaimStatus.FAILED_UNAVAILABLE)

    def test_insufficient_fab_budget_rejection(self):
        with self.assertRaises(ValueError):
            # Attempt to bid 150 FAB when only 100 available
            claim = WaiverClaim("c_over", "team_1", "p_hot", "p_fwd1", bid_amount_minor=150_00)
            self.engine.submit_claim(claim)


if __name__ == "__main__":
    unittest.main()
