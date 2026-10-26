"""Peer-to-Peer (P2P) Betting Exchange & Escrow Matching Engine.

Implements peer-to-peer sports betting matching:
- Back and Lay order book matching with price-time priority
- Escrow locking for both backer stake and layer liability
- Partial fill management and unmatched order cancellations
- Authoritative event settlement with net winnings commission deduction (e.g. 2%)
- Strict integer minor units accounting to prevent rounding leakages
"""

from dataclasses import dataclass, field
from enum import Enum
import math
import time
from typing import Dict, List, Optional, Tuple


class P2POfferType(str, Enum):
    BACK = "BACK"  # Betting FOR an outcome
    LAY = "LAY"    # Betting AGAINST an outcome (acting as bookmaker)


class P2POfferStatus(str, Enum):
    OPEN = "OPEN"
    PARTIALLY_MATCHED = "PARTIALLY_MATCHED"
    FULLY_MATCHED = "FULLY_MATCHED"
    CANCELLED = "CANCELLED"
    SETTLED = "SETTLED"


@dataclass
class P2PMatchedContract:
    match_id: str
    market_key: str
    backer_user_id: str
    layer_user_id: str
    stake_minor: int
    liability_minor: int
    odds: float
    matched_at_unix: float = field(default_factory=time.time)
    is_settled: bool = False
    winner_user_id: Optional[str] = None
    payout_minor: int = 0
    commission_minor: int = 0


@dataclass
class P2PBetOffer:
    offer_id: str
    user_id: str
    market_key: str
    offer_type: P2POfferType
    target_odds: float  # e.g. 2.20
    total_stake_minor: int
    matched_stake_minor: int = 0
    status: P2POfferStatus = P2POfferStatus.OPEN
    created_at_unix: float = field(default_factory=time.time)

    @property
    def unmatched_stake_minor(self) -> int:
        return self.total_stake_minor - self.matched_stake_minor

    @property
    def total_liability_minor(self) -> int:
        """Liability required if this is a LAY order: stake * (odds - 1)"""
        if self.offer_type == P2POfferType.BACK:
            return 0
        return int(math.ceil(self.total_stake_minor * (self.target_odds - 1.0)))

    @property
    def escrow_required_minor(self) -> int:
        """Total collateral required upfront from offer creator."""
        if self.offer_type == P2POfferType.BACK:
            return self.total_stake_minor
        return self.total_liability_minor


class P2PBetExchangeEngine:
    """Manages resting orders, P2P matching, escrow locks, and settlement."""

    def __init__(self, commission_rate: float = 0.02):
        if not (0.0 <= commission_rate <= 0.20):
            raise ValueError("Commission rate must be between 0% and 20%")
        self.commission_rate = commission_rate
        self.offers: Dict[str, P2PBetOffer] = {}
        self.matched_contracts: Dict[str, P2PMatchedContract] = {}

    def post_offer(
        self,
        offer_id: str,
        user_id: str,
        market_key: str,
        offer_type: P2POfferType,
        target_odds: float,
        stake_minor: int,
        user_available_balance_minor: int,
    ) -> Tuple[P2PBetOffer, List[P2PMatchedContract]]:
        """Posts a new Back/Lay offer and attempts immediate matching against existing resting orders."""
        if stake_minor <= 0:
            raise ValueError("Stake must be positive integer minor units")
        if target_odds <= 1.01:
            raise ValueError("Odds must be greater than 1.01")

        new_offer = P2PBetOffer(
            offer_id=offer_id,
            user_id=user_id,
            market_key=market_key,
            offer_type=offer_type,
            target_odds=target_odds,
            total_stake_minor=stake_minor,
        )

        required_escrow = new_offer.escrow_required_minor
        if user_available_balance_minor < required_escrow:
            raise ValueError(
                f"Insufficient escrow balance: requires {required_escrow} minor units, available {user_available_balance_minor}"
            )

        self.offers[offer_id] = new_offer

        # Attempt immediate cross-match
        matches = self._match_resting_offers(new_offer)
        return new_offer, matches

    def _match_resting_offers(self, taker_offer: P2PBetOffer) -> List[P2PMatchedContract]:
        """Matches a taker offer against eligible opposing resting maker offers."""
        matches: List[P2PMatchedContract] = []

        # Find eligible makers for the same market
        opposing_type = (
            P2POfferType.LAY if taker_offer.offer_type == P2POfferType.BACK else P2POfferType.BACK
        )

        eligible_makers: List[P2PBetOffer] = []
        for o in self.offers.values():
            if (
                o.market_key == taker_offer.market_key
                and o.offer_type == opposing_type
                and o.status in (P2POfferStatus.OPEN, P2POfferStatus.PARTIALLY_MATCHED)
                and o.user_id != taker_offer.user_id
            ):
                # Price matching condition:
                # If taker is BACK: taker odds <= maker odds (backer gets equal or better odds)
                # If taker is LAY: taker odds >= maker odds (layer lays at equal or lower odds)
                if taker_offer.offer_type == P2POfferType.BACK and taker_offer.target_odds <= o.target_odds:
                    eligible_makers.append(o)
                elif taker_offer.offer_type == P2POfferType.LAY and taker_offer.target_odds >= o.target_odds:
                    eligible_makers.append(o)

        # Sort eligible makers:
        # For BACK taker: Highest odds first (best price), then earliest timestamp
        # For LAY taker: Lowest odds first (best price), then earliest timestamp
        if taker_offer.offer_type == P2POfferType.BACK:
            eligible_makers.sort(key=lambda m: (-m.target_odds, m.created_at_unix))
        else:
            eligible_makers.sort(key=lambda m: (m.target_odds, m.created_at_unix))

        for maker in eligible_makers:
            if taker_offer.unmatched_stake_minor <= 0:
                break

            match_stake = min(taker_offer.unmatched_stake_minor, maker.unmatched_stake_minor)
            if match_stake <= 0:
                continue

            # Execution odds is always the maker's posted odds (price improvement for taker)
            exec_odds = maker.target_odds
            liability_minor = int(math.ceil(match_stake * (exec_odds - 1.0)))

            if taker_offer.offer_type == P2POfferType.BACK:
                backer_id = taker_offer.user_id
                layer_id = maker.user_id
            else:
                backer_id = maker.user_id
                layer_id = taker_offer.user_id

            match_id = f"p2p_match_{maker.offer_id}_{taker_offer.offer_id}_{len(matches) + 1}"
            contract = P2PMatchedContract(
                match_id=match_id,
                market_key=taker_offer.market_key,
                backer_user_id=backer_id,
                layer_user_id=layer_id,
                stake_minor=match_stake,
                liability_minor=liability_minor,
                odds=exec_odds,
            )

            # Update stakes
            maker.matched_stake_minor += match_stake
            taker_offer.matched_stake_minor += match_stake

            maker.status = (
                P2POfferStatus.FULLY_MATCHED
                if maker.unmatched_stake_minor == 0
                else P2POfferStatus.PARTIALLY_MATCHED
            )
            taker_offer.status = (
                P2POfferStatus.FULLY_MATCHED
                if taker_offer.unmatched_stake_minor == 0
                else P2POfferStatus.PARTIALLY_MATCHED
            )

            self.matched_contracts[contract.match_id] = contract
            matches.append(contract)

        return matches

    def cancel_offer(self, offer_id: str, user_id: str) -> int:
        """Cancels unmatched portion of an offer and returns refunded escrow minor units."""
        if offer_id not in self.offers:
            raise ValueError("Offer not found")

        offer = self.offers[offer_id]
        if offer.user_id != user_id:
            raise ValueError("Cannot cancel another user's offer")

        if offer.status not in (P2POfferStatus.OPEN, P2POfferStatus.PARTIALLY_MATCHED):
            raise ValueError(f"Cannot cancel offer with status {offer.status}")

        unmatched = offer.unmatched_stake_minor
        if offer.offer_type == P2POfferType.BACK:
            refund_minor = unmatched
        else:
            refund_minor = int(math.ceil(unmatched * (offer.target_odds - 1.0)))

        offer.status = P2POfferStatus.CANCELLED
        return refund_minor

    def settle_market(self, market_key: str, backer_wins: bool) -> List[P2PMatchedContract]:
        """Settles all matched contracts for a market and calculates payouts and net commission."""
        settled: List[P2PMatchedContract] = []

        for contract in self.matched_contracts.values():
            if contract.market_key == market_key and not contract.is_settled:
                pot_minor = contract.stake_minor + contract.liability_minor

                if backer_wins:
                    contract.winner_user_id = contract.backer_user_id
                    net_winnings = contract.liability_minor
                    commission = int(round(net_winnings * self.commission_rate))
                    contract.payout_minor = pot_minor - commission
                    contract.commission_minor = commission
                else:
                    contract.winner_user_id = contract.layer_user_id
                    net_winnings = contract.stake_minor
                    commission = int(round(net_winnings * self.commission_rate))
                    contract.payout_minor = pot_minor - commission
                    contract.commission_minor = commission

                contract.is_settled = True
                settled.append(contract)

        return settled
