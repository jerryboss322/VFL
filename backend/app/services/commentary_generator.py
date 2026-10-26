"""Dynamic Procedural Football Commentary Generation and Speech Synthesis Parameter Engine.

Generates broadcast-grade live commentary lines with dynamic emotional pitch, rate,
and contextual phrases based on match telemetry, goal differentials, and event urgency.
Supports 5 language templates: English, Spanish, German, French, and Italian.
"""

import random
from enum import Enum
from typing import Dict, List, Optional


class CommentaryUrgency(str, Enum):
    LOW = "LOW"          # Routine passing, possession in defensive third
    MEDIUM = "MEDIUM"    # Midfield progression, corners, tactical fouls
    HIGH = "HIGH"        # Shots on target, saves, woodwork hits, yellow cards
    CRITICAL = "CRITICAL" # Goals, penalties, red cards, last-minute drama


class CommentaryLanguage(str, Enum):
    EN = "en"
    ES = "es"
    DE = "de"
    FR = "fr"
    IT = "it"


COMMENTARY_DICTIONARY = {
    "goal": {
        CommentaryLanguage.EN: [
            "GOAL! Sensational finish into the top corner! Absolute perfection!",
            "WHAT A STRIKE! The goalkeeper had no chance whatsoever! Unbelievable goal!",
            "IT'S IN! Clinical finishing inside the penalty box! The stadium erupts!",
            "GOAAAL! Pure brilliance! What a moment for {team}!",
        ],
        CommentaryLanguage.ES: [
            "¡GOLAZO! ¡Impresionante remate al ángulo! ¡Qué barbaridad!",
            "¡GOL, GOL, GOL! ¡Definición magistral de {team}!",
            "¡A la red! ¡No pudo hacer nada el arquero! ¡Fiesta total!",
        ],
        CommentaryLanguage.DE: [
            "TOOOOR! Ein traumhafter Treffer für {team}!",
            "Unglaublich! Der Ball schlägt unhaltbar im Netz ein!",
            "TOOOOR! Eiskalt verwandelt im Sechzehner!",
        ],
        CommentaryLanguage.FR: [
            "BUT! Quelle frappe magnifique pour {team}!",
            "C'est au fond des filets! Un bijou de finition!",
            "BUUUT! Le gardien est totalement impuissant!",
        ],
        CommentaryLanguage.IT: [
            "GOOOL! Conclusione straordinaria di {team}!",
            "Rete fantastica! Palla all'incrocio dei pali!",
            "GOOOL! Il portiere non può nulla, che meraviglia!",
        ],
    },
    "shot_woodwork": {
        CommentaryLanguage.EN: [
            "OFF THE POST! How close was that?! Heartbreak for {team}!",
            "RATTLES THE CROSSBAR! The woodwork is still shaking from that thunderbolt!",
        ],
        CommentaryLanguage.ES: [
            "¡AL PALO! ¡Se salva de milagro la portería rival!",
            "¡Al travesaño! ¡Un cañonazo que hace temblar la portería!",
        ],
        CommentaryLanguage.DE: [
            "AN DEN PFOSTEN! Unglaubliches Pech für {team}!",
            "Lattentreffer! Der Schuss war eine echte Granate!",
        ],
        CommentaryLanguage.FR: [
            "SUR LE POTEAU! Incroyable occasion manquée!",
            "La transversale repousse le tir! Quelle tension!",
        ],
        CommentaryLanguage.IT: [
            "PALO! Che brivido per la difesa!",
            "Traversa piena! Un tiro clamoroso!",
        ],
    },
    "save": {
        CommentaryLanguage.EN: [
            "WHAT A SAVE! Spectacular acrobatic reflex from the goalkeeper!",
            "Brilliant goalkeeping! Tips it over the crossbar at full stretch!",
        ],
        CommentaryLanguage.ES: [
            "¡PARADÓN! ¡Reflejos felinos del guardameta para salvar a su equipo!",
            "¡Qué mano metió el arquero! Una intervención salvadora.",
        ],
        CommentaryLanguage.DE: [
            "GLANZPARADE! Sensationelle Reaktion des Torhüters!",
            "Weltklasse gehalten! Er lenkt den Ball über die Latte!",
        ],
        CommentaryLanguage.FR: [
            "ARRÊT RÉFLEXE! Quelle parade spectaculaire du gardien!",
            "Sauvetage héroïque sur la ligne!",
        ],
        CommentaryLanguage.IT: [
            "MIRACOLO DEL PORTIERE! Riflesso prodigioso!",
            "Parata eccezionale che nega il gol!",
        ],
    },
    "red_card": {
        CommentaryLanguage.EN: [
            "RED CARD! He's off! A reckless challenge and the referee shows no mercy!",
            "Straight red! Disaster for {team}, they will play with ten men!",
        ],
        CommentaryLanguage.ES: [
            "¡TARJETA ROJA! ¡A las duchas! Entrada durísima que no perdona el árbitro.",
            "¡Roja directa! Duro golpe para {team}, se quedan con diez.",
        ],
        CommentaryLanguage.DE: [
            "ROTE KARTE! Platzverweis nach einem groben Foul!",
            "Er muss vom Feld! Schwere Hypothek jetzt für {team}.",
        ],
        CommentaryLanguage.FR: [
            "CARTON ROUGE! Expulsion directe après ce tacle dangereux!",
            "Coup de massue pour {team}, qui va terminer en infériorité numérique.",
        ],
        CommentaryLanguage.IT: [
            "CARTELLINO ROSSO! Espulso! Intervento sconsiderato.",
            "Rosso diretto! {team} resta in dieci uomini!",
        ],
    },
    "kickoff": {
        CommentaryLanguage.EN: [
            "The referee blows the whistle and we are underway here at {venue}!",
            "Kickoff! Ninety minutes of high-intensity European football begins now!",
        ],
        CommentaryLanguage.ES: [
            "¡Suena el silbato y rueda el balón en {venue}!",
            "¡Comienza el partido! ¡Noventa minutos de emoción pura!",
        ],
        CommentaryLanguage.DE: [
            "Der Schiedsrichter pfeift an, die Partie läuft!",
            "Anpfiff! Wir freuen uns auf ein packendes Spitzenspiel!",
        ],
        CommentaryLanguage.FR: [
            "Coup d'envoi! C'est parti pour 90 minutes de suspense!",
            "Le coup de sifflet retentit, le match est lancé à {venue}!",
        ],
        CommentaryLanguage.IT: [
            "Fischio d'inizio! Il match ha inizio a {venue}!",
            "Comincia la sfida! Novanta minuti di grande spettacolo!",
        ],
    },
    "full_time": {
        CommentaryLanguage.EN: [
            "Full time! The referee brings this pulsating contest to an end!",
            "There goes the final whistle! An unforgettable clash of European powerhouses!",
        ],
        CommentaryLanguage.ES: [
            "¡Final del partido! Concluye este vibrante enfrentamiento.",
            "¡Pitido final! Un espectáculo futbolístico de primer nivel.",
        ],
        CommentaryLanguage.DE: [
            "Schlusspfiff! Ein hochklassiges Spiel findet sein Ende!",
            "Das war's! Intensive 90 Minuten sind vorüber.",
        ],
        CommentaryLanguage.FR: [
            "Coup de sifflet final! Quelle superbe rencontre nous avons vécue!",
            "Fin du match! Les deux équipes ont tout donné sur la pelouse.",
        ],
        CommentaryLanguage.IT: [
            "Fischio finale! Termina qui una gara straordinaria!",
            "È finita! Novanta minuti di pura adrenalina.",
        ],
    },
}


def generate_live_commentary(
    event_type: str,
    team_name: str,
    minute: int,
    language: CommentaryLanguage = CommentaryLanguage.EN,
    venue: str = "Virtual Arena",
    seed: Optional[int] = None,
) -> Dict[str, object]:
    """Generates broadcast commentary with voice modulation parameters (pitch, rate, urgency).

    :param event_type: 'goal', 'shot_woodwork', 'save', 'red_card', 'kickoff', 'full_time'
    :param team_name: Name of club involved
    :param minute: Match minute (1-90)
    :param language: Commentary language enum
    """
    rng = random.Random(seed)
    event_key = event_type.lower()

    # Determine speech parameters based on event urgency
    if event_key == "goal":
        urgency = CommentaryUrgency.CRITICAL
        pitch = 1.35
        rate = 1.25
        volume = 1.0
    elif event_key in ("shot_woodwork", "red_card"):
        urgency = CommentaryUrgency.HIGH
        pitch = 1.20
        rate = 1.15
        volume = 0.95
    elif event_key == "save":
        urgency = CommentaryUrgency.HIGH
        pitch = 1.15
        rate = 1.10
        volume = 0.90
    else:
        urgency = CommentaryUrgency.MEDIUM
        pitch = 1.0
        rate = 1.0
        volume = 0.85

    templates = COMMENTARY_DICTIONARY.get(event_key, {}).get(
        language, COMMENTARY_DICTIONARY["goal"][CommentaryLanguage.EN]
    )
    raw_template = rng.choice(templates)
    formatted_text = raw_template.format(team=team_name, venue=venue, minute=minute)

    # Prefix with minute indicator e.g. "74' - "
    broadcast_line = f"{minute}' — {formatted_text}"

    return {
        "minute": minute,
        "eventType": event_key,
        "teamName": team_name,
        "language": language.value,
        "text": formatted_text,
        "displayText": broadcast_line,
        "urgency": urgency.value,
        "speechParams": {
            "pitch": pitch,
            "rate": rate,
            "volume": volume,
        },
    }
