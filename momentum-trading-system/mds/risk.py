"""Position sizing and the rules that keep a bad day from becoming a bad year.

Two ideas do most of the work:
  1. Size is derived from the stop, never chosen first. A tight stop earns size;
     a wide stop loses it.
  2. There is a hard daily loss limit, and it is enforced by the machine rather
     than by willpower at the worst possible moment.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from .config import RiskConfig


@dataclass
class SizingDecision:
    shares: int
    risk_usd: float
    reward_risk: float
    accepted: bool
    reason: str = ""


def size_position(
    equity: float,
    entry: float,
    stop: float,
    target: float,
    cfg: RiskConfig,
    bar_volume: float | None = None,
    size_multiplier: float = 1.0,
) -> SizingDecision:
    """Shares to buy, or a reasoned refusal."""
    risk_per_share = entry - stop
    if risk_per_share <= 0:
        return SizingDecision(0, 0.0, 0.0, False, "stop is not below entry")

    if risk_per_share < cfg.min_stop_distance_cents:
        return SizingDecision(0, 0.0, 0.0, False,
                              f"stop {risk_per_share*100:.1f}c tighter than the "
                              f"{cfg.min_stop_distance_cents*100:.0f}c minimum - costs would dominate")

    stop_pct = risk_per_share / entry * 100.0
    if stop_pct > cfg.max_stop_distance_pct:
        return SizingDecision(0, 0.0, 0.0, False,
                              f"stop {stop_pct:.1f}% wider than the {cfg.max_stop_distance_pct}% limit")

    reward_risk = (target - entry) / risk_per_share if target > entry else 0.0
    if reward_risk < cfg.min_reward_risk:
        return SizingDecision(0, 0.0, 0.0, False,
                              f"reward:risk {reward_risk:.2f} below the {cfg.min_reward_risk} minimum")

    budget = min(equity * cfg.risk_per_trade_pct / 100.0, cfg.max_risk_per_trade_usd)
    budget *= size_multiplier
    shares = int(budget // risk_per_share)
    if shares <= 0:
        return SizingDecision(0, 0.0, 0.0, False, "risk budget too small for this stop")

    max_by_equity = int((equity * cfg.max_position_pct_of_equity / 100.0) // entry)
    shares = min(shares, max_by_equity)

    if bar_volume and np.isfinite(bar_volume) and bar_volume > 0:
        # Do not assume you can trade a size the tape cannot absorb.
        max_by_liquidity = int(bar_volume * cfg.max_pct_of_bar_volume / 100.0)
        shares = min(shares, max_by_liquidity)

    if shares <= 0:
        return SizingDecision(0, 0.0, 0.0, False, "size capped to zero by equity or liquidity limits")

    return SizingDecision(shares, shares * risk_per_share, reward_risk, True)


@dataclass
class DayState:
    trades: int = 0
    realised_pnl: float = 0.0
    peak_pnl: float = 0.0
    consecutive_losses: int = 0
    halted: bool = False
    halt_reason: str = ""


@dataclass
class RiskManager:
    """Enforces the daily guardrails and scales size after losses."""

    cfg: RiskConfig
    equity: float = 0.0
    day: DayState = field(default_factory=DayState)

    def __post_init__(self) -> None:
        if not self.equity:
            self.equity = self.cfg.starting_equity

    def start_day(self) -> None:
        self.day = DayState()

    def size_multiplier(self) -> float:
        """Cut size after consecutive losses instead of trying to win it back."""
        if self.day.consecutive_losses <= 0:
            return 1.0
        return float(self.cfg.size_reduction_after_loss ** self.day.consecutive_losses)

    def can_trade(self) -> tuple[bool, str]:
        d = self.day
        if d.halted:
            return False, d.halt_reason
        if d.trades >= self.cfg.max_trades_per_day:
            return False, f"daily trade cap ({self.cfg.max_trades_per_day}) reached"
        if d.realised_pnl <= -abs(self.cfg.daily_max_loss_usd):
            return False, f"daily max loss ({self.cfg.daily_max_loss_usd:.0f}) hit"
        if d.consecutive_losses >= self.cfg.max_consecutive_losses:
            return False, f"{d.consecutive_losses} losses in a row"
        if d.peak_pnl > 0:
            giveback = (d.peak_pnl - d.realised_pnl) / d.peak_pnl * 100.0
            if giveback >= self.cfg.daily_profit_giveback_pct:
                return False, f"gave back {giveback:.0f}% of the day's peak"
        return True, ""

    def record(self, pnl: float) -> None:
        d = self.day
        d.trades += 1
        d.realised_pnl += pnl
        d.peak_pnl = max(d.peak_pnl, d.realised_pnl)
        self.equity += pnl
        if pnl < 0:
            d.consecutive_losses += 1
        elif pnl > 0:
            d.consecutive_losses = 0
        ok, reason = self.can_trade()
        if not ok:
            d.halted, d.halt_reason = True, reason
