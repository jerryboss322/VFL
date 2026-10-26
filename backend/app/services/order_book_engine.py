"""High-Performance Central Limit Order Book (CLOB) & Matching Engine.

Provides price-time priority order matching for the Virtual Player Stock Exchange:
- Order types: LIMIT_BUY, LIMIT_SELL, MARKET_BUY, MARKET_SELL
- Price-time priority matching (bids descending, asks ascending)
- Partial fill execution with residual limit orders
- Level 2 (L2) Depth of Market (DOM) aggregation
- Invariant: Zero balance loss or ghost shares during multi-fill order sweeps
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
import time
from typing import Dict, List, Optional, Tuple


class OrderSide(str, Enum):
    BUY = "BUY"
    SELL = "SELL"


class OrderType(str, Enum):
    LIMIT = "LIMIT"
    MARKET = "MARKET"


class OrderStatus(str, Enum):
    OPEN = "OPEN"
    PARTIALLY_FILLED = "PARTIALLY_FILLED"
    FILLED = "FILLED"
    CANCELLED = "CANCELLED"


@dataclass
class LimitOrder:
    order_id: str
    trader_id: str
    player_id: str
    side: OrderSide
    order_type: OrderType
    price_minor: int           # Minor units per share (0 for market orders)
    quantity: int
    filled_quantity: int = 0
    status: OrderStatus = OrderStatus.OPEN
    created_at_unix: float = field(default_factory=time.time)

    @property
    def remaining_quantity(self) -> int:
        return self.quantity - self.filled_quantity


@dataclass
class TradeFill:
    fill_id: str
    maker_order_id: str
    taker_order_id: str
    player_id: str
    executed_price_minor: int
    executed_quantity: int
    total_minor: int
    timestamp_unix: float = field(default_factory=time.time)


@dataclass
class Level2PriceLevel:
    price_minor: int
    total_quantity: int
    order_count: int


@dataclass
class OrderBookDepth:
    player_id: str
    bids: List[Level2PriceLevel]  # Descending price
    asks: List[Level2PriceLevel]  # Ascending price
    spread_minor: Optional[int]
    mid_price_minor: Optional[int]


class PlayerLimitOrderBook:
    """In-memory matching engine for a single player's shares."""

    def __init__(self, player_id: str):
        self.player_id = player_id
        self.bids: List[LimitOrder] = []  # Sorted by price desc, then time asc
        self.asks: List[LimitOrder] = []  # Sorted by price asc, then time asc
        self.trades_history: List[TradeFill] = []
        self._order_counter = 0

    def submit_order(
        self,
        trader_id: str,
        side: OrderSide,
        order_type: OrderType,
        quantity: int,
        price_minor: int = 0,
    ) -> Tuple[LimitOrder, List[TradeFill]]:
        """Submits a limit or market order and executes any immediate matching trades."""
        if quantity <= 0:
            raise ValueError("Quantity must be positive")
        if order_type == OrderType.LIMIT and price_minor <= 0:
            raise ValueError("Limit orders must specify a positive price")

        self._order_counter += 1
        order = LimitOrder(
            order_id=f"ord-{self.player_id}-{self._order_counter}",
            trader_id=trader_id,
            player_id=self.player_id,
            side=side,
            order_type=order_type,
            price_minor=price_minor,
            quantity=quantity,
        )

        fills: List[TradeFill] = []

        if side == OrderSide.BUY:
            fills = self._match_buy_order(order)
        else:
            fills = self._match_sell_order(order)

        self.trades_history.extend(fills)
        return (order, fills)

    def _match_buy_order(self, order: LimitOrder) -> List[TradeFill]:
        fills: List[TradeFill] = []
        i = 0

        while i < len(self.asks) and order.remaining_quantity > 0:
            best_ask = self.asks[i]
            # If limit buy, price must be >= best ask price
            if order.order_type == OrderType.LIMIT and order.price_minor < best_ask.price_minor:
                break

            match_qty = min(order.remaining_quantity, best_ask.remaining_quantity)
            exec_price = best_ask.price_minor
            total_minor = match_qty * exec_price

            fill = TradeFill(
                fill_id=f"fill-{len(self.trades_history) + len(fills) + 1}",
                maker_order_id=best_ask.order_id,
                taker_order_id=order.order_id,
                player_id=self.player_id,
                executed_price_minor=exec_price,
                executed_quantity=match_qty,
                total_minor=total_minor,
            )
            fills.append(fill)

            order.filled_quantity += match_qty
            best_ask.filled_quantity += match_qty

            if best_ask.remaining_quantity == 0:
                best_ask.status = OrderStatus.FILLED
                self.asks.pop(i)
            else:
                best_ask.status = OrderStatus.PARTIALLY_FILLED
                i += 1

        if order.remaining_quantity == 0:
            order.status = OrderStatus.FILLED
        elif order.filled_quantity > 0:
            order.status = OrderStatus.PARTIALLY_FILLED
        else:
            order.status = OrderStatus.OPEN

        # If it's a residual limit buy, insert into sorted bids (descending price)
        if order.order_type == OrderType.LIMIT and order.remaining_quantity > 0:
            self._insert_bid_sorted(order)

        return fills

    def _match_sell_order(self, order: LimitOrder) -> List[TradeFill]:
        fills: List[TradeFill] = []
        i = 0

        while i < len(self.bids) and order.remaining_quantity > 0:
            best_bid = self.bids[i]
            # If limit sell, price must be <= best bid price
            if order.order_type == OrderType.LIMIT and order.price_minor > best_bid.price_minor:
                break

            match_qty = min(order.remaining_quantity, best_bid.remaining_quantity)
            exec_price = best_bid.price_minor
            total_minor = match_qty * exec_price

            fill = TradeFill(
                fill_id=f"fill-{len(self.trades_history) + len(fills) + 1}",
                maker_order_id=best_bid.order_id,
                taker_order_id=order.order_id,
                player_id=self.player_id,
                executed_price_minor=exec_price,
                executed_quantity=match_qty,
                total_minor=total_minor,
            )
            fills.append(fill)

            order.filled_quantity += match_qty
            best_bid.filled_quantity += match_qty

            if best_bid.remaining_quantity == 0:
                best_bid.status = OrderStatus.FILLED
                self.bids.pop(i)
            else:
                best_bid.status = OrderStatus.PARTIALLY_FILLED
                i += 1

        if order.remaining_quantity == 0:
            order.status = OrderStatus.FILLED
        elif order.filled_quantity > 0:
            order.status = OrderStatus.PARTIALLY_FILLED
        else:
            order.status = OrderStatus.OPEN

        # If it's a residual limit sell, insert into sorted asks (ascending price)
        if order.order_type == OrderType.LIMIT and order.remaining_quantity > 0:
            self._insert_ask_sorted(order)

        return fills

    def _insert_bid_sorted(self, order: LimitOrder) -> None:
        """Bids are sorted descending by price, then ascending by time."""
        for idx, b in enumerate(self.bids):
            if order.price_minor > b.price_minor:
                self.bids.insert(idx, order)
                return
        self.bids.append(order)

    def _insert_ask_sorted(self, order: LimitOrder) -> None:
        """Asks are sorted ascending by price, then ascending by time."""
        for idx, a in enumerate(self.asks):
            if order.price_minor < a.price_minor:
                self.asks.insert(idx, order)
                return
        self.asks.append(order)

    def cancel_order(self, order_id: str) -> Optional[LimitOrder]:
        """Cancels an open limit order."""
        for idx, b in enumerate(self.bids):
            if b.order_id == order_id:
                b.status = OrderStatus.CANCELLED
                return self.bids.pop(idx)
        for idx, a in enumerate(self.asks):
            if a.order_id == order_id:
                a.status = OrderStatus.CANCELLED
                return self.asks.pop(idx)
        return None

    def get_l2_depth(self, levels: int = 10) -> OrderBookDepth:
        """Aggregates Level 2 Depth of Market by distinct price levels."""
        bid_map: Dict[int, Tuple[int, int]] = {}
        for b in self.bids:
            qty, count = bid_map.get(b.price_minor, (0, 0))
            bid_map[b.price_minor] = (qty + b.remaining_quantity, count + 1)

        ask_map: Dict[int, Tuple[int, int]] = {}
        for a in self.asks:
            qty, count = ask_map.get(a.price_minor, (0, 0))
            ask_map[a.price_minor] = (qty + a.remaining_quantity, count + 1)

        sorted_bids = [
            Level2PriceLevel(price, qty, count)
            for price, (qty, count) in sorted(bid_map.items(), key=lambda x: x[0], reverse=True)[:levels]
        ]
        sorted_asks = [
            Level2PriceLevel(price, qty, count)
            for price, (qty, count) in sorted(ask_map.items(), key=lambda x: x[0])[:levels]
        ]

        best_bid = sorted_bids[0].price_minor if sorted_bids else None
        best_ask = sorted_asks[0].price_minor if sorted_asks else None

        spread = (best_ask - best_bid) if (best_bid and best_ask) else None
        mid = (best_bid + best_ask) // 2 if (best_bid and best_ask) else (best_bid or best_ask)

        return OrderBookDepth(
            player_id=self.player_id,
            bids=sorted_bids,
            asks=sorted_asks,
            spread_minor=spread,
            mid_price_minor=mid,
        )
