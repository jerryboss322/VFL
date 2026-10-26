import unittest
from backend.app.services.radio_commentary_streamer import (
    RadioCommentaryStreamer,
    BroadcasterRole,
    CommentaryTone,
    BroadcasterPersona,
)


class TestRadioCommentaryStreamer(unittest.TestCase):
    def setUp(self):
        self.streamer = RadioCommentaryStreamer(
            home_team="Arsenal",
            away_team="Chelsea",
            seed=42,
        )

    def test_goal_sequence_dialog(self):
        lines = self.streamer.generate_goal_dialog(
            scoring_team="Arsenal",
            scorer_name="Bukayo Saka",
            minute=34,
            is_equalizer=False,
        )
        self.assertEqual(len(lines), 2)

        # First line is Lead Play-by-Play announcer
        lead_line = lines[0]
        self.assertEqual(lead_line.speaker.role, BroadcasterRole.LEAD_PLAY_BY_PLAY)
        self.assertEqual(lead_line.tone, CommentaryTone.EXPLOSIVE_GOAL)
        self.assertIn("SAKA", lead_line.text)
        self.assertTrue(lead_line.ssml_markup.startswith("<speak>"))
        self.assertIn('<emphasis level="strong">', lead_line.ssml_markup)
        self.assertEqual(lead_line.crowd_ducking_volume, 0.35)

        # Second line is Color Analyst
        analyst_line = lines[1]
        self.assertEqual(analyst_line.speaker.role, BroadcasterRole.COLOR_ANALYST)
        self.assertEqual(analyst_line.tone, CommentaryTone.TACTICAL_DEBATE)
        self.assertTrue(analyst_line.ssml_markup.startswith("<speak>"))
        self.assertGreater(analyst_line.elapsed_match_second, lead_line.elapsed_match_second)

    def test_equalizer_goal_dialog(self):
        lines = self.streamer.generate_goal_dialog(
            scoring_team="Chelsea",
            scorer_name="Cole Palmer",
            minute=89,
            is_equalizer=True,
        )
        self.assertEqual(len(lines), 2)
        self.assertIn("EQUALIZES", lines[0].text)

    def test_var_dispute_dialog(self):
        lines = self.streamer.generate_var_dispute_dialog(
            incident_desc="possible handball in penalty area",
            minute=62,
        )
        # 3 speakers: Lead, Analyst, Pitchside Reporter
        self.assertEqual(len(lines), 3)
        self.assertEqual(lines[0].speaker.role, BroadcasterRole.LEAD_PLAY_BY_PLAY)
        self.assertEqual(lines[1].speaker.role, BroadcasterRole.COLOR_ANALYST)
        self.assertEqual(lines[2].speaker.role, BroadcasterRole.PITCHSIDE_REPORTER)

        self.assertIn("VAR review", lines[0].text)
        self.assertIn("dugout", lines[2].text)

    def test_buildup_dialog(self):
        line = self.streamer.generate_buildup_dialog("Arsenal", minute=15)
        self.assertEqual(line.speaker.role, BroadcasterRole.LEAD_PLAY_BY_PLAY)
        self.assertEqual(line.tone, CommentaryTone.CALM_BUILDUP)
        self.assertIn("Arsenal", line.text)
        self.assertTrue(line.ssml_markup.startswith("<speak>"))


if __name__ == "__main__":
    unittest.main()
