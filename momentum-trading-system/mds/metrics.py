"""Performance measurement and, more importantly, honest feasibility maths.

Most of this module exists to answer one question: given a realistic win rate
and a realistic reward:risk, what does this strategy actually produce - and how
wide is the range of outcomes that the same edge can generate by luck alone?
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd


# --------------------------------------------------------------------------
# Descriptive statistics
# --------------------------------------------------------------------------

@dataclass
class Stats:
    trades: int
    wins: int
    losses: int
    win_rate: float
    avg_win_r: float
    avg_loss_r: float
    expectancy_r: float
    profit_factor: float
    total_r: float
    net_pnl: float
    gross_pnl: float
    total_costs: float
    cost_drag_r: float
    max_drawdown: float
    max_drawdown_pct: float
    avg_hold_minutes: float

    def as_dict(self) -> dict:
        return self.__dict__.copy()


def summarize(trades: pd.DataFrame, starting_equity: float = 0.0) -> Stats:
    if trades.empty:
        # Built by field name so that adding a metric cannot silently
        # desynchronise the empty case from the populated one.
        return Stats(**{f: 0 if f in ("trades", "wins", "losses") else 0.0
                        for f in Stats.__dataclass_fields__})

    r = trades["r"]
    wins, losses = r[r > 0], r[r <= 0]
    gross = trades["gross_pnl"].sum()
    costs = trades["costs"].sum()
    net = trades["net_pnl"].sum()

    win_sum = trades.loc[trades["net_pnl"] > 0, "net_pnl"].sum()
    loss_sum = abs(trades.loc[trades["net_pnl"] <= 0, "net_pnl"].sum())
    pf = win_sum / loss_sum if loss_sum > 0 else float("inf")

    equity = starting_equity + trades["net_pnl"].cumsum()
    peak = equity.cummax()
    dd = equity - peak
    max_dd = float(dd.min()) if len(dd) else 0.0
    max_dd_pct = float((dd / peak.replace(0, np.nan)).min() * 100) if starting_equity else 0.0

    avg_risk = trades["risk_usd"].mean()
    cost_drag_r = (costs / len(trades)) / avg_risk if avg_risk else 0.0

    return Stats(
        trades=len(trades),
        wins=int((r > 0).sum()),
        losses=int((r <= 0).sum()),
        win_rate=float((r > 0).mean()),
        avg_win_r=float(wins.mean()) if len(wins) else 0.0,
        avg_loss_r=float(losses.mean()) if len(losses) else 0.0,
        expectancy_r=float(r.mean()),
        profit_factor=float(pf),
        total_r=float(r.sum()),
        net_pnl=float(net),
        gross_pnl=float(gross),
        total_costs=float(costs),
        cost_drag_r=float(cost_drag_r),
        max_drawdown=max_dd,
        max_drawdown_pct=max_dd_pct,
        avg_hold_minutes=float(trades["hold_min"].mean()),
    )


# --------------------------------------------------------------------------
# Feasibility maths - the part worth reading before risking money
# --------------------------------------------------------------------------

def expectancy(win_rate: float, reward_risk: float, cost_drag_r: float = 0.0) -> float:
    """Expected R per trade.

    A winner returns `reward_risk` R, a loser returns -1 R, and every trade pays
    `cost_drag_r` in commissions, fees and slippage whether it wins or not.
    """
    return win_rate * reward_risk - (1 - win_rate) * 1.0 - cost_drag_r


def required_win_rate(reward_risk: float, cost_drag_r: float = 0.0) -> float:
    """The win rate at which the strategy merely breaks even.

    At 2:1 with zero costs this is 33.3%. Costs move it up, and on low-priced,
    wide-spread small caps they move it up a lot.
    """
    return (1.0 + cost_drag_r) / (1.0 + reward_risk)


def feasibility_table(
    reward_risks=(1.5, 2.0, 2.5, 3.0),
    cost_drags=(0.0, 0.05, 0.10, 0.20),
) -> pd.DataFrame:
    """Break-even win rate across reward:risk and cost assumptions."""
    rows = []
    for rr in reward_risks:
        row = {"reward_risk": rr}
        for cd in cost_drags:
            row[f"cost_{cd:.2f}R"] = round(required_win_rate(rr, cd) * 100, 1)
        rows.append(row)
    return pd.DataFrame(rows)


def monte_carlo(
    r_multiples: np.ndarray | list[float],
    n_trades: int = 250,
    n_sims: int = 10_000,
    risk_per_trade_pct: float = 1.0,
    starting_equity: float = 30_000.0,
    ruin_threshold_pct: float = 50.0,
    seed: int = 7,
) -> dict:
    """Bootstrap the observed R distribution to see the range of futures.

    A single equity curve tells you almost nothing. Resampling the same trades
    in a different order shows how much of a backtest's shape was sequence luck,
    and how often the same edge still produces a career-ending drawdown.
    """
    r = np.asarray(r_multiples, dtype=float)
    if r.size == 0:
        raise ValueError("no trades to resample")

    rng = np.random.default_rng(seed)
    draws = rng.choice(r, size=(n_sims, n_trades), replace=True)

    # Compound: each trade risks a fixed % of *current* equity.
    growth = 1.0 + draws * (risk_per_trade_pct / 100.0)
    growth = np.maximum(growth, 0.01)
    curves = starting_equity * np.cumprod(growth, axis=1)

    peaks = np.maximum.accumulate(curves, axis=1)
    dd_pct = (curves - peaks) / peaks * 100.0
    worst_dd = dd_pct.min(axis=1)
    finals = curves[:, -1]

    return {
        "n_sims": n_sims,
        "n_trades": n_trades,
        "median_final": float(np.median(finals)),
        "p05_final": float(np.percentile(finals, 5)),
        "p95_final": float(np.percentile(finals, 95)),
        "prob_profitable": float((finals > starting_equity).mean()),
        "median_max_dd_pct": float(np.median(worst_dd)),
        "p05_max_dd_pct": float(np.percentile(worst_dd, 5)),
        "prob_ruin": float((worst_dd <= -abs(ruin_threshold_pct)).mean()),
        "ruin_threshold_pct": ruin_threshold_pct,
    }


def cost_sensitivity(
    trades: pd.DataFrame,
    extra_slippage_cents=(0.0, 0.01, 0.02, 0.05, 0.10),
) -> pd.DataFrame:
    """What happens to the edge as execution degrades.

    Slippage is the difference between the strategy on a chart and the strategy
    in an account. This table is usually the most sobering output of the system.
    """
    rows = []
    for extra in extra_slippage_cents:
        # Two fills per trade (in and out), each paying the extra cents.
        penalty = trades["shares"] * extra * 2.0
        net = trades["net_pnl"] - penalty
        r = net / trades["risk_usd"].replace(0, np.nan)
        rows.append({
            "extra_slippage_cents": extra,
            "net_pnl": round(float(net.sum()), 2),
            "expectancy_r": round(float(r.mean()), 3),
            "win_rate_pct": round(float((net > 0).mean() * 100), 1),
            "profitable": bool(net.sum() > 0),
        })
    return pd.DataFrame(rows)


def kelly_fraction(win_rate: float, reward_risk: float) -> float:
    """Full-Kelly risk fraction. Shown for scale, not as a recommendation.

    Full Kelly on a strategy whose true win rate you have estimated from a few
    hundred trades is a reliable way to be wiped out by estimation error alone.
    Practitioners who use it at all use a small fraction of it.
    """
    if reward_risk <= 0:
        return 0.0
    return max(0.0, win_rate - (1 - win_rate) / reward_risk)
