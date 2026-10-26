"""Virtual Club Player Transfer Market, FFP Cap, and Release Clause Buyout Engine.

Orchestrates club-to-club transfer window negotiations:
- Algorithmic player dynamic market valuation based on age curves, rating, and form
- Release clause buyout triggers with instant transfer execution
- Financial Fair Play (FFP) wage-to-revenue ceiling compliance (max 70% wage ratio)
- Multi-currency integer minor units accounting for transfer fees and agent sign-on fees
- Formal bid negotiation state machine (SUBMITTED -> ACCEPTED / REJECTED -> EXECUTED)
"""

from dataclasses import dataclass
from enum import Enum
import math
from typing import Dict, List, Optional, Tuple


class TransferBidStatus(str, Enum):
    SUBMITTED = "SUBMITTED"
    ACCEPTED = "ACCEPTED"
    REJECTED_FEE_TOO_LOW = "REJECTED_FEE_TOO_LOW"
    REJECTED_FFP_CEILING = "REJECTED_FFP_CEILING"
    REJECTED_INSUFFICIENT_FUNDS = "REJECTED_INSUFFICIENT_FUNDS"
    EXECUTED = "EXECUTED"


@dataclass
class PlayerContract:
    player_id: str
    name: str
    club_id: str
    position: str  # "GKP", "DEF", "MID", "FWD"
    age: int
    overall_rating: int  # 60 to 99
    recent_form_rating: float  # 5.0 to 10.0
    contract_years_remaining: int
    weekly_wage_minor: int
    release_clause_minor: int
    is_transfer_listed: bool = False


@dataclass
class ClubFinancialFairPlayProfile:
    club_id: str
    name: str
    cash_balance_minor: int
    annual_revenue_minor: int
    annual_wage_bill_minor: int

    @property
    def wage_to_revenue_ratio(self) -> float:
        if self.annual_revenue_minor <= 0:
            return 1.0
        return self.annual_wage_bill_minor / self.annual_revenue_minor

    def can_absorb_wage(self, added_wage_minor: int, max_ratio: float = 0.70) -> bool:
        """FFP rule: annual wages must not exceed 70% of club turnover."""
        new_annual_wages = self.annual_wage_bill_minor + (added_wage_minor * 52)
        if self.annual_revenue_minor <= 0:
            return False
        return (new_annual_wages / self.annual_revenue_minor) <= max_ratio


@dataclass
class TransferBid:
    bid_id: str
    player_id: str
    buyer_club_id: str
    offered_fee_minor: int
    offered_weekly_wage_minor: int
    status: TransferBidStatus = TransferBidStatus.SUBMITTED
    rejection_reason: Optional[str] = None


class TransferMarketEngine:
    """Manages player valuation, FFP compliance gates, and transfer negotiations."""

    @staticmethod
    def calculate_market_value_minor(contract: PlayerContract) -> int:
        """Calculates dynamic fair market valuation in integer minor units.
        
        Formula:
        Base = (Rating / 60)^4.5 * 1,000,000 minor units (£10,000)
        Age curve factor: peak age 25-29 (factor 1.0), young potential < 23 (boost), veteran > 31 (decay)
        Contract factor: 1 year left gives 0.65x discount (Bosman threat); >= 3 years gives 1.15x
        Form factor: recent match ratings scale up/down by up to 25%
        """
        rating_factor = math.pow(contract.overall_rating / 60.0, 4.5)
        base_value = 10_000_000_00 * rating_factor

        # Age curve
        if contract.age <= 22:
            age_factor = 1.25  # High potential premium
        elif 23 <= contract.age <= 28:
            age_factor = 1.00  # Prime years
        elif 29 <= contract.age <= 31:
            age_factor = 0.85
        else:
            age_factor = max(0.20, 1.0 - (contract.age - 28) * 0.12)

        # Contract length factor
        if contract.contract_years_remaining <= 1:
            contract_factor = 0.65  # Impending free transfer discount
        elif contract.contract_years_remaining == 2:
            contract_factor = 0.90
        else:
            contract_factor = 1.15  # Secure contract leverage

        # Form factor
        form_factor = 0.75 + (contract.recent_form_rating / 10.0) * 0.50

        # Position weighting (Strikers/Attacking Midfielders command market premium)
        pos_multiplier = 1.20 if contract.position == "FWD" else (1.10 if contract.position == "MID" else 0.95)

        total_value = base_value * age_factor * contract_factor * form_factor * pos_multiplier
        return max(500_000, int(round(total_value)))

    @classmethod
    def evaluate_bid(
        cls,
        bid: TransferBid,
        player: PlayerContract,
        seller: ClubFinancialFairPlayProfile,
        buyer: ClubFinancialFairPlayProfile,
    ) -> TransferBid:
        """Evaluates whether a transfer bid is accepted, rejected, or triggers a release clause."""
        # 1. Release Clause Buyout Check: If bid >= release clause, selling club cannot reject
        if bid.offered_fee_minor >= player.release_clause_minor:
            # Check buyer liquidity
            if buyer.cash_balance_minor < bid.offered_fee_minor:
                bid.status = TransferBidStatus.REJECTED_INSUFFICIENT_FUNDS
                bid.rejection_reason = "Buyer lacks sufficient cash reserves to trigger release buyout"
                return bid

            # Check FFP wage ceiling
            if not buyer.can_absorb_wage(bid.offered_weekly_wage_minor):
                bid.status = TransferBidStatus.REJECTED_FFP_CEILING
                bid.rejection_reason = "Offer breaches UEFA FFP 70% wage-to-revenue threshold"
                return bid

            bid.status = TransferBidStatus.ACCEPTED
            return bid

        # 2. Check buyer liquidity
        if buyer.cash_balance_minor < bid.offered_fee_minor:
            bid.status = TransferBidStatus.REJECTED_INSUFFICIENT_FUNDS
            bid.rejection_reason = "Buyer does not possess required cash funds"
            return bid

        # 3. Check buyer FFP
        if not buyer.can_absorb_wage(bid.offered_weekly_wage_minor):
            bid.status = TransferBidStatus.REJECTED_FFP_CEILING
            bid.rejection_reason = "Wage structure violates FFP 70% cap"
            return bid

        # 4. Seller valuation check: Selling club demands at least 90% of dynamic market value (or 80% if listed)
        fair_value = cls.calculate_market_value_minor(player)
        min_acceptable = int(fair_value * (0.80 if player.is_transfer_listed else 0.95))

        if bid.offered_fee_minor < min_acceptable:
            bid.status = TransferBidStatus.REJECTED_FEE_TOO_LOW
            bid.rejection_reason = f"Fee of {bid.offered_fee_minor} is below seller floor of {min_acceptable}"
            return bid

        bid.status = TransferBidStatus.ACCEPTED
        return bid

    @classmethod
    def execute_transfer(
        cls,
        bid: TransferBid,
        player: PlayerContract,
        seller: ClubFinancialFairPlayProfile,
        buyer: ClubFinancialFairPlayProfile,
    ) -> bool:
        """Executes transfer payment settlement and contract reassignment."""
        if bid.status != TransferBidStatus.ACCEPTED:
            return False

        # Execute cash settlement
        buyer.cash_balance_minor -= bid.offered_fee_minor
        seller.cash_balance_minor += bid.offered_fee_minor

        # Reassign wages
        seller.annual_wage_bill_minor -= (player.weekly_wage_minor * 52)
        buyer.annual_wage_bill_minor += (bid.offered_weekly_wage_minor * 52)

        # Update player contract
        player.club_id = buyer.club_id
        player.weekly_wage_minor = bid.offered_weekly_wage_minor
        player.is_transfer_listed = False
        bid.status = TransferBidStatus.EXECUTED

        return True
