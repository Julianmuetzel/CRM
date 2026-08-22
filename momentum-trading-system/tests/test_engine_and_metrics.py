"""Engine invariants and the feasibility maths."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from mds.config import StrategyConfig, CostConfig
from mds.data import synthetic_universe
from mds.engine import Backtester
from mds.metrics import (expectancy, required_win_rate, summarize,
                         monte_carlo, cost_sensitivity)
from mds.universe import scan


def _run(cfg: StrategyConfig, days: int = 30, seed: int = 5):
    sessions, snap = synthetic_universe(n_days=days, symbols_per_day=3, seed=seed)
    filtered = {}
    for day, syms in sessions.items():
        cands = scan(snap[snap["date"] == day], cfg.scanner)
        keep = {c.symbol: syms[c.symbol] for c in cands if c.symbol in syms}
        if keep:
            filtered[day] = keep
    return Backtester(cfg).run(filtered)


def test_backtest_runs_and_respects_its_own_rules():
    cfg = StrategyConfig()
    res = _run(cfg)
    tf = res.to_frame()
    assert not tf.empty

    # Never carries a position overnight.
    assert (pd.to_datetime(tf["exit_time"]).dt.date
            == pd.to_datetime(tf["entry_time"]).dt.date).all()
    # Never enters after the cutoff.
    entry_times = pd.to_datetime(tf["entry_time"]).dt.strftime("%H:%M")
    assert (entry_times < cfg.session.trading_cutoff).all()
    # Every trade paid something to trade.
    assert (tf["costs"] > 0).all()
    # No trade risked more than the configured ceiling (plus slippage drift).
    assert tf["risk_usd"].max() <= cfg.risk.max_risk_per_trade_usd * 1.5


def test_daily_loss_limit_is_actually_enforced_in_the_backtest():
    cfg = StrategyConfig()
    cfg.risk.daily_max_loss_usd = 200.0
    res = _run(cfg)
    tf = res.to_frame()
    if tf.empty:
        pytest.skip("no trades under this configuration")
    worst_day = tf.groupby(tf["session"])["net_pnl"].sum().min()
    # One trade may breach the limit; the limit then stops the day.
    assert worst_day > -(cfg.risk.daily_max_loss_usd + cfg.risk.max_risk_per_trade_usd * 2)


def test_execution_quality_decides_whether_the_core_setup_exists():
    """The finding this whole system was built to surface.

    The micro pullback carries stops of a few cents. Under a retail cost
    structure the round trip eats most of that risk, and the setup is filtered
    out entirely. Give it direct-access pricing and it becomes tradeable.
    The strategy is therefore not separable from the execution stack.
    """
    retail = StrategyConfig()
    pro = StrategyConfig()
    pro.costs = CostConfig(
        commission_per_share=0.0020, commission_min_ticket=0.0,
        ecn_remove_fee_per_share=0.0, slippage_atr_multiple=0.03,
        slippage_min_cents=0.002, slippage_max_cents=0.04,
    )
    pro.risk.min_stop_distance_cents = 0.02

    retail_trades = _run(retail, days=60, seed=11).to_frame()
    pro_trades = _run(pro, days=60, seed=11).to_frame()

    n_retail = (retail_trades["setup"] == "micro_pullback").sum()
    n_pro = (pro_trades["setup"] == "micro_pullback").sum()
    assert n_pro > n_retail, "cheaper execution must unlock the tightest-stop setup"


def test_break_even_win_rate_matches_first_principles():
    # At 2:1 with no costs a third of your trades must win.
    assert required_win_rate(2.0, 0.0) == pytest.approx(1 / 3, abs=1e-9)
    assert required_win_rate(1.0, 0.0) == pytest.approx(0.5, abs=1e-9)
    # Costs raise the bar.
    assert required_win_rate(2.0, 0.20) > required_win_rate(2.0, 0.0)
    # Expectancy is zero exactly at the break-even win rate.
    for rr in (1.5, 2.0, 3.0):
        for cd in (0.0, 0.1):
            assert expectancy(required_win_rate(rr, cd), rr, cd) == pytest.approx(0.0, abs=1e-9)


def test_monte_carlo_reports_a_wide_range_of_futures_for_one_edge():
    """Sequence luck is large. A single equity curve is not evidence."""
    rng = np.random.default_rng(0)
    # A genuinely positive edge: 40% winners at 2R.
    r = np.where(rng.random(400) < 0.40, 2.0, -1.0)
    out = monte_carlo(r, n_trades=250, n_sims=2000, risk_per_trade_pct=1.0)
    assert out["p05_final"] < out["median_final"] < out["p95_final"]
    assert 0.0 <= out["prob_ruin"] <= 1.0
    assert out["median_max_dd_pct"] < 0


def test_cost_sensitivity_is_monotonic():
    cfg = StrategyConfig()
    tf = _run(cfg).to_frame()
    if tf.empty:
        pytest.skip("no trades")
    table = cost_sensitivity(tf)
    assert table["net_pnl"].is_monotonic_decreasing


def test_summarize_handles_an_empty_book():
    s = summarize(pd.DataFrame())
    assert s.trades == 0 and s.net_pnl == 0
