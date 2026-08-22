"""Fill and cost modelling.

Small-cap momentum names trade with wide spreads and thin books. A backtest
that fills at the trigger price with no friction will show an edge that does
not exist. Everything here exists to take that illusion away.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .config import CostConfig


@dataclass
class Fill:
    price: float
    shares: int
    commission: float
    fees: float
    slippage_cost: float

    @property
    def total_cost(self) -> float:
        return self.commission + self.fees + self.slippage_cost


class CostModel:
    """Per-share commissions, regulatory fees and volatility-scaled slippage."""

    def __init__(self, cfg: CostConfig):
        self.cfg = cfg

    def slippage(self, atr: float, aggressive: bool = True) -> float:
        """Cents of adverse price movement between decision and fill.

        Scales with ATR because a stock ranging $0.40/minute does not fill like
        one ranging $0.04/minute. Stop-outs are treated as more aggressive than
        entries: you are exiting into the move that is going against you.
        """
        c = self.cfg
        if not np.isfinite(atr) or atr <= 0:
            slip = c.slippage_min_cents
        else:
            slip = c.slippage_atr_multiple * atr
        slip = float(np.clip(slip, c.slippage_min_cents, c.slippage_max_cents))
        return slip * (1.0 if aggressive else 0.5)

    def commission(self, shares: int) -> float:
        return max(self.cfg.commission_min_ticket, shares * self.cfg.commission_per_share)

    def fees(self, shares: int, price: float, is_sale: bool) -> float:
        c = self.cfg
        total = shares * c.ecn_remove_fee_per_share
        if is_sale:
            total += shares * price * c.sec_fee_rate
            total += min(shares * c.taf_per_share, c.taf_max)
        return total

    def buy(self, intended: float, shares: int, atr: float) -> Fill:
        slip = self.slippage(atr, aggressive=True)
        price = round(intended + slip, 4)
        return Fill(
            price=price,
            shares=shares,
            commission=self.commission(shares),
            fees=self.fees(shares, price, is_sale=False),
            slippage_cost=slip * shares,
        )

    def sell(self, intended: float, shares: int, atr: float, aggressive: bool = True) -> Fill:
        slip = self.slippage(atr, aggressive=aggressive)
        price = round(intended - slip, 4)
        return Fill(
            price=price,
            shares=shares,
            commission=self.commission(shares),
            fees=self.fees(shares, price, is_sale=True),
            slippage_cost=slip * shares,
        )


def fill_price_for_stop_entry(trigger: float, bar_open: float, bar_high: float) -> float | None:
    """Where a resting buy-stop actually fills on the next bar.

    If the bar gaps straight through the trigger, you are filled at the open,
    not at your price. Pretending otherwise is the classic backtest lie.
    """
    if bar_high < trigger:
        return None
    return max(bar_open, trigger)


def fill_price_for_stop_exit(stop: float, bar_open: float, bar_low: float) -> float | None:
    """Where a resting sell-stop fills. Gaps go against you here too."""
    if bar_low > stop:
        return None
    return min(bar_open, stop)
