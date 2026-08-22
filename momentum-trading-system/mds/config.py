"""Strategy configuration.

Every rule the strategy relies on is a named, tunable parameter here. Nothing
is hard-coded in the detectors, so a change in interpretation (for example
after reviewing more source material) is a YAML edit, not a code change.
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any

import yaml


@dataclass
class ScannerConfig:
    """The "stocks in play" filter.

    The strategy's first and most important filter is not a chart pattern - it
    is which symbols are eligible at all. A textbook bull flag on an illiquid,
    high-float, no-catalyst stock is not the same trade.
    """

    min_price: float = 1.50
    max_price: float = 20.00
    min_gap_pct: float = 10.0                 # premarket % change vs prev close
    max_float_shares: float = 20_000_000
    preferred_float_shares: float = 10_000_000
    min_rvol: float = 5.0                     # relative volume vs 50d average
    min_premarket_volume: int = 100_000
    require_catalyst: bool = True
    max_symbols_per_day: int = 4              # focus beats breadth
    exclude_otc: bool = True


@dataclass
class SetupConfig:
    """Entry pattern parameters, on 1-minute bars unless stated otherwise."""

    enabled: list[str] = field(
        default_factory=lambda: [
            "micro_pullback",
            "bull_flag",
            "flat_top_breakout",
            "opening_range_breakout",
            "vwap_reclaim",
        ]
    )

    # --- micro pullback --------------------------------------------------
    micro_pullback_max_bars: int = 3            # a 1-3 candle pause
    micro_pullback_max_retrace: float = 0.50    # of the prior impulse leg
    micro_pullback_require_above_ema: bool = True

    # --- bull flag -------------------------------------------------------
    bull_flag_impulse_min_bars: int = 2
    bull_flag_impulse_min_pct: float = 3.0
    bull_flag_consolidation_min_bars: int = 2
    bull_flag_consolidation_max_bars: int = 6
    bull_flag_max_retrace: float = 0.50

    # --- flat top breakout -----------------------------------------------
    flat_top_min_touches: int = 2
    flat_top_tolerance_pct: float = 0.30        # how "flat" the top must be
    flat_top_lookback: int = 10

    # --- opening range breakout -------------------------------------------
    orb_minutes: int = 5

    # --- vwap reclaim ------------------------------------------------------
    vwap_reclaim_min_bars_below: int = 3

    # --- shared confirmations ---------------------------------------------
    require_volume_confirmation: bool = True
    volume_confirm_multiple: float = 1.5        # breakout bar vs the bars just before it
    volume_confirm_lookback: int = 5            # short window: what a trader actually sees
    ema_fast: int = 9
    ema_slow: int = 20
    atr_period: int = 14


@dataclass
class RiskConfig:
    """Risk and money management.

    The documented approach leans on a 2:1 profit/loss target, a hard daily
    stop, and reducing size after losses. All three are enforced here.
    """

    starting_equity: float = 30_000.0
    risk_per_trade_pct: float = 1.0             # % of equity risked per trade
    max_risk_per_trade_usd: float = 500.0
    min_reward_risk: float = 2.0                # reject setups that cannot pay 2:1
    max_stop_distance_pct: float = 5.0          # too-wide stop => no trade
    min_stop_distance_cents: float = 0.05       # too-tight stop => costs win, not you
    max_cost_drag_r: float = 0.15               # reject if round-trip costs exceed this share of risk
    daily_max_loss_usd: float = 1_000.0         # hard stop, non-negotiable
    daily_profit_giveback_pct: float = 30.0     # stop after giving back this much of peak
    max_trades_per_day: int = 6
    max_consecutive_losses: int = 3
    size_reduction_after_loss: float = 0.5      # halve size after a loss
    max_position_pct_of_equity: float = 100.0
    max_pct_of_bar_volume: float = 2.0          # liquidity cap: don't be the market
    scale_out: list[float] = field(default_factory=lambda: [0.5, 0.25, 0.25])
    scale_out_r: list[float] = field(default_factory=lambda: [1.0, 2.0, 3.0])
    move_stop_to_breakeven_at_r: float = 1.0
    trail_with_ema: bool = True


@dataclass
class CostConfig:
    """Transaction costs. On sub-$20 small caps these decide the outcome."""

    commission_per_share: float = 0.0049
    commission_min_ticket: float = 0.99
    ecn_remove_fee_per_share: float = 0.0030
    sec_fee_rate: float = 0.0000278             # on sale proceeds
    taf_per_share: float = 0.000166
    taf_max: float = 8.30
    # Slippage is modelled in cents and scales with volatility.
    slippage_atr_multiple: float = 0.10
    slippage_min_cents: float = 0.01
    slippage_max_cents: float = 0.15


@dataclass
class SessionConfig:
    """Time-of-day rules. The edge is heavily concentrated after the open."""

    timezone: str = "America/New_York"
    market_open: str = "09:30"
    prime_window_end: str = "10:30"             # highest-quality window
    trading_cutoff: str = "11:30"               # no new entries after this
    force_flat: str = "15:55"
    allow_premarket: bool = False


@dataclass
class StrategyConfig:
    scanner: ScannerConfig = field(default_factory=ScannerConfig)
    setups: SetupConfig = field(default_factory=SetupConfig)
    risk: RiskConfig = field(default_factory=RiskConfig)
    costs: CostConfig = field(default_factory=CostConfig)
    session: SessionConfig = field(default_factory=SessionConfig)

    @classmethod
    def load(cls, path: str | Path) -> "StrategyConfig":
        raw = yaml.safe_load(Path(path).read_text()) or {}
        return cls(
            scanner=ScannerConfig(**raw.get("scanner", {})),
            setups=SetupConfig(**raw.get("setups", {})),
            risk=RiskConfig(**raw.get("risk", {})),
            costs=CostConfig(**raw.get("costs", {})),
            session=SessionConfig(**raw.get("session", {})),
        )

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    def save(self, path: str | Path) -> None:
        Path(path).write_text(yaml.safe_dump(self.to_dict(), sort_keys=False))
