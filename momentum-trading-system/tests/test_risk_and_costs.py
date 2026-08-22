"""Risk, sizing and cost behaviour."""

from __future__ import annotations

import pytest

from mds.config import RiskConfig, CostConfig
from mds.execution import CostModel, fill_price_for_stop_entry, fill_price_for_stop_exit
from mds.risk import RiskManager, size_position


def test_size_is_derived_from_the_stop_not_chosen_first():
    cfg = RiskConfig(starting_equity=30_000, risk_per_trade_pct=1.0, max_risk_per_trade_usd=500)
    tight = size_position(30_000, entry=10.00, stop=9.80, target=10.40, cfg=cfg)
    wide = size_position(30_000, entry=10.00, stop=9.60, target=10.80, cfg=cfg)
    assert tight.accepted and wide.accepted
    # Same dollar risk, so half the stop distance earns twice the shares.
    assert tight.shares == pytest.approx(2 * wide.shares, rel=0.02)
    assert tight.risk_usd <= 300 * 1.01


def test_reward_risk_below_the_minimum_is_refused():
    cfg = RiskConfig(min_reward_risk=2.0)
    d = size_position(30_000, entry=10.00, stop=9.80, target=10.30, cfg=cfg)
    assert not d.accepted and "reward:risk" in d.reason


def test_stops_that_are_too_tight_are_refused():
    """Regression test for a real failure mode.

    Sub-nickel stops produce enormous share counts, and the round trip then
    costs more than the trade risks. Without this rule the backtest happily
    took them.
    """
    cfg = RiskConfig(min_stop_distance_cents=0.05)
    d = size_position(30_000, entry=6.00, stop=5.97, target=6.10, cfg=cfg)
    assert not d.accepted and "tighter" in d.reason


def test_liquidity_cap_stops_you_being_the_whole_tape():
    cfg = RiskConfig(max_pct_of_bar_volume=2.0)
    d = size_position(1_000_000, entry=5.00, stop=4.90, target=5.30, cfg=cfg, bar_volume=10_000)
    assert d.shares <= 200


def test_daily_loss_limit_halts_trading():
    cfg = RiskConfig(daily_max_loss_usd=1_000, max_consecutive_losses=99, max_trades_per_day=99)
    rm = RiskManager(cfg)
    rm.start_day()
    rm.record(-600)
    assert rm.can_trade()[0]
    rm.record(-500)
    ok, why = rm.can_trade()
    assert not ok and "daily max loss" in why


def test_size_is_cut_after_consecutive_losses():
    cfg = RiskConfig(size_reduction_after_loss=0.5, max_consecutive_losses=99)
    rm = RiskManager(cfg)
    rm.start_day()
    assert rm.size_multiplier() == 1.0
    rm.record(-100)
    assert rm.size_multiplier() == 0.5
    rm.record(-100)
    assert rm.size_multiplier() == 0.25
    rm.record(+300)
    assert rm.size_multiplier() == 1.0


def test_giveback_rule_protects_a_green_day():
    cfg = RiskConfig(daily_profit_giveback_pct=30.0, max_consecutive_losses=99, max_trades_per_day=99)
    rm = RiskManager(cfg)
    rm.start_day()
    rm.record(+1000)
    rm.record(-400)
    ok, why = rm.can_trade()
    assert not ok and "gave back" in why


def test_gaps_fill_against_you_in_both_directions():
    # A buy-stop gapped through fills at the open, not at your price.
    assert fill_price_for_stop_entry(10.00, bar_open=10.50, bar_high=10.60) == 10.50
    assert fill_price_for_stop_entry(10.00, bar_open=9.90, bar_high=10.20) == 10.00
    assert fill_price_for_stop_entry(10.00, bar_open=9.50, bar_high=9.80) is None
    # A sell-stop gapped through also fills at the open.
    assert fill_price_for_stop_exit(9.00, bar_open=8.50, bar_low=8.40) == 8.50
    assert fill_price_for_stop_exit(9.00, bar_open=9.50, bar_low=8.90) == 9.00
    assert fill_price_for_stop_exit(9.00, bar_open=9.50, bar_low=9.20) is None


def test_costs_scale_with_volatility_and_are_always_charged():
    cm = CostModel(CostConfig())
    calm = cm.buy(10.00, 1000, atr=0.05)
    wild = cm.buy(10.00, 1000, atr=1.50)
    assert wild.price > calm.price, "a faster stock should slip more"
    assert calm.total_cost > 0 and wild.total_cost > 0
    # Selling pays the regulatory fees that buying does not.
    assert cm.sell(10.00, 1000, 0.20).fees > cm.buy(10.00, 1000, 0.20).fees
