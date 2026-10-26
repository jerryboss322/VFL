"""Radio Broadcast Dual-Commentator Simulation & SSML Synthesis Engine.

Simulates broadcast TV/radio commentary booths:
- Dual commentator roles: Lead Play-by-Play Announcer & Tactical Color Analyst
- Sideline pitchside reporter telemetry (stoppage time, tactical dugout instructions)
- Contextual turn-taking dialog generation with banter and tactical disagreement
- Speech Synthesis Markup Language (SSML) tagging for Web Speech API and cloud TTS engines
- Acoustic crowd ducking levels to dynamically adjust audio mix during goal celebrations
"""

from dataclasses import dataclass
from enum import Enum
import random
from typing import Dict, List, Optional, Tuple


class BroadcasterRole(str, Enum):
    LEAD_PLAY_BY_PLAY = "LEAD_PLAY_BY_PLAY"
    COLOR_ANALYST = "COLOR_ANALYST"
    PITCHSIDE_REPORTER = "PITCHSIDE_REPORTER"


class CommentaryTone(str, Enum):
    CALM_BUILDUP = "CALM_BUILDUP"
    TACTICAL_DEBATE = "TACTICAL_DEBATE"
    HIGH_INTENSITY = "HIGH_INTENSITY"
    EXPLOSIVE_GOAL = "EXPLOSIVE_GOAL"
    CONTROVERSIAL_VAR = "CONTROVERSIAL_VAR"


@dataclass
class BroadcasterPersona:
    name: str
    role: BroadcasterRole
    vocal_pitch: str  # "high", "medium", "low"
    speaking_rate: str  # "slow", "medium", "fast"
    signature_catchphrase: str


@dataclass
class CommentaryDialogLine:
    speaker: BroadcasterPersona
    text: str
    ssml_markup: str
    tone: CommentaryTone
    crowd_ducking_volume: float  # 0.0 to 1.0 (lower means crowd audio ducks down)
    elapsed_match_second: int


LEAD_ANNOUNCER = BroadcasterPersona(
    name="Marcus Sterling",
    role=BroadcasterRole.LEAD_PLAY_BY_PLAY,
    vocal_pitch="medium",
    speaking_rate="fast",
    signature_catchphrase="Poetry in motion!",
)

COLOR_ANALYST = BroadcasterPersona(
    name="Alan McCrory",
    role=BroadcasterRole.COLOR_ANALYST,
    vocal_pitch="low",
    speaking_rate="medium",
    signature_catchphrase="You simply cannot defend like that at this level.",
)

PITCHSIDE_REPORTER = BroadcasterPersona(
    name="Clara Vane",
    role=BroadcasterRole.PITCHSIDE_REPORTER,
    vocal_pitch="high",
    speaking_rate="medium",
    signature_catchphrase="Manager is furious on the touchline.",
)


class RadioCommentaryStreamer:
    """Generates broadcast dialog turns with SSML markup for live matches."""

    def __init__(
        self,
        home_team: str,
        away_team: str,
        lead_announcer: BroadcasterPersona = LEAD_ANNOUNCER,
        color_analyst: BroadcasterPersona = COLOR_ANALYST,
        pitchside: BroadcasterPersona = PITCHSIDE_REPORTER,
        seed: Optional[int] = None,
    ):
        self.home_team = home_team
        self.away_team = away_team
        self.lead = lead_announcer
        self.analyst = color_analyst
        self.pitchside = pitchside
        self.rng = random.Random(seed)

    def _wrap_ssml(self, text: str, pitch: str, rate: str, emphasis: bool = False) -> str:
        """Wraps plain text in valid W3C SSML prosody markup."""
        emph_tag_open = '<emphasis level="strong">' if emphasis else ""
        emph_tag_close = "</emphasis>" if emphasis else ""
        return f'<speak><prosody pitch="{pitch}" rate="{rate}">{emph_tag_open}{text}{emph_tag_close}</prosody></speak>'

    def generate_goal_dialog(
        self,
        scoring_team: str,
        scorer_name: str,
        minute: int,
        is_equalizer: bool = False,
    ) -> List[CommentaryDialogLine]:
        """Generates back-and-forth goal sequence between play-by-play and analyst."""
        lines: List[CommentaryDialogLine] = []

        # 1. Lead Announcer shouts the goal
        lead_phrases = [
            f"GOAL! UNBELIEVABLE! {scorer_name.upper()} HAS STRUCK FOR {scoring_team.upper()}!",
            f"IT'S IN! ABSOLUTE BEDLAM HERE! {scorer_name.upper()} WITH A THUNDERBOLT!",
            f"GOAAAAL! {scoring_team.upper()} TAKE THE LEAD! SENSATIONAL FINISH FROM {scorer_name.upper()}!",
        ]
        lead_text = self.rng.choice(lead_phrases)
        if is_equalizer:
            lead_text = f"LEVEL AT THE DEATH! {scorer_name.upper()} EQUALIZES FOR {scoring_team.upper()}!"

        lines.append(
            CommentaryDialogLine(
                speaker=self.lead,
                text=lead_text,
                ssml_markup=self._wrap_ssml(lead_text, pitch="high", rate="fast", emphasis=True),
                tone=CommentaryTone.EXPLOSIVE_GOAL,
                crowd_ducking_volume=0.35,  # Allow goal roar to surge
                elapsed_match_second=minute * 60,
            )
        )

        # 2. Color Analyst provides breakdown
        analyst_phrases = [
            f"Look at the shape of the defense, Marcus. They completely lost runner {scorer_name}. Brilliant vision.",
            f"Pure technical perfection. He caught that right off the laces. No goalkeeper in world football stops that.",
            f"{self.analyst.signature_catchphrase} But take nothing away from the technique, magnificent strike.",
        ]
        analyst_text = self.rng.choice(analyst_phrases)
        lines.append(
            CommentaryDialogLine(
                speaker=self.analyst,
                text=analyst_text,
                ssml_markup=self._wrap_ssml(analyst_text, pitch="low", rate="medium", emphasis=False),
                tone=CommentaryTone.TACTICAL_DEBATE,
                crowd_ducking_volume=0.70,
                elapsed_match_second=minute * 60 + 5,
            )
        )

        return lines

    def generate_var_dispute_dialog(
        self,
        incident_desc: str,
        minute: int,
    ) -> List[CommentaryDialogLine]:
        """Generates booth discussion during a VAR monitor review."""
        lines: List[CommentaryDialogLine] = []

        lead_text = f"Hold on, Marcus here. The referee has his finger to his ear. We are going to a VAR review for {incident_desc}."
        lines.append(
            CommentaryDialogLine(
                speaker=self.lead,
                text=lead_text,
                ssml_markup=self._wrap_ssml(lead_text, pitch="medium", rate="medium"),
                tone=CommentaryTone.CONTROVERSIAL_VAR,
                crowd_ducking_volume=0.85,
                elapsed_match_second=minute * 60,
            )
        )

        analyst_text = f"I've seen these given, and I've seen them waved off. From this angle, it looks marginal. Let's see how the referee interprets the contact."
        lines.append(
            CommentaryDialogLine(
                speaker=self.analyst,
                text=analyst_text,
                ssml_markup=self._wrap_ssml(analyst_text, pitch="low", rate="slow"),
                tone=CommentaryTone.TACTICAL_DEBATE,
                crowd_ducking_volume=0.85,
                elapsed_match_second=minute * 60 + 4,
            )
        )

        pitchside_text = f"Marcus, Alan, the dugout is in uproar down here. The manager is claiming there was a foul in the prior buildup phase."
        lines.append(
            CommentaryDialogLine(
                speaker=self.pitchside,
                text=pitchside_text,
                ssml_markup=self._wrap_ssml(pitchside_text, pitch="high", rate="medium"),
                tone=CommentaryTone.TACTICAL_DEBATE,
                crowd_ducking_volume=0.90,
                elapsed_match_second=minute * 60 + 8,
            )
        )

        return lines

    def generate_buildup_dialog(
        self,
        possession_team: str,
        minute: int,
    ) -> CommentaryDialogLine:
        """Generates routine passing flow commentary."""
        phrases = [
            f"{possession_team} circulating possession patiently across the midfield line.",
            f"Neat triangular interplay from {possession_team}, probing for space between the defensive lines.",
            f"{possession_team} recycling possession through the center-backs as the press compacts.",
        ]
        text = self.rng.choice(phrases)
        return CommentaryDialogLine(
            speaker=self.lead,
            text=text,
            ssml_markup=self._wrap_ssml(text, pitch="medium", rate="medium"),
            tone=CommentaryTone.CALM_BUILDUP,
            crowd_ducking_volume=0.85,
            elapsed_match_second=minute * 60,
        )
