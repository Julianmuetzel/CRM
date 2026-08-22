"""Trade journal analytics.

The system is only half the edge; knowing which part of it works is the other
half. These breakdowns are meant to be run weekly and acted on: stop taking the
setups and time windows that lose, and take more of the ones that do not.
"""

from __future__ import annotations

import pandas as pd

from .metrics import summarize


def _group_stats(trades: pd.DataFrame, key) -> pd.DataFrame:
    rows = []
    for name, grp in trades.groupby(key):
        s = summarize(grp)
        rows.append({
            "group": name,
            "trades": s.trades,
            "win_rate_pct": round(s.win_rate * 100, 1),
            "expectancy_r": round(s.expectancy_r, 3),
            "total_r": round(s.total_r, 2),
            "net_pnl": round(s.net_pnl, 2),
            "avg_win_r": round(s.avg_win_r, 2),
            "avg_loss_r": round(s.avg_loss_r, 2),
            "profit_factor": round(s.profit_factor, 2),
        })
    return pd.DataFrame(rows).sort_values("total_r", ascending=False)


def by_setup(trades: pd.DataFrame) -> pd.DataFrame:
    return _group_stats(trades, "setup")


def by_hour(trades: pd.DataFrame) -> pd.DataFrame:
    t = trades.copy()
    t["hour"] = pd.to_datetime(t["entry_time"]).dt.strftime("%H:%M").str.slice(0, 2) + ":00"
    return _group_stats(t, "hour")


def by_weekday(trades: pd.DataFrame) -> pd.DataFrame:
    t = trades.copy()
    t["weekday"] = pd.to_datetime(t["entry_time"]).dt.day_name()
    return _group_stats(t, "weekday")


def by_exit_reason(trades: pd.DataFrame) -> pd.DataFrame:
    return _group_stats(trades, "exit_reason")


def stop_placement_review(trades: pd.DataFrame) -> pd.DataFrame:
    """Were the stops too tight, or the targets too far?

    `stopped_but_recovered` counts losers whose favourable excursion later
    exceeded 1R - the signature of stops placed inside the noise.
    `winners_giving_back` counts winners that reached 2R and were not paid for
    it - the signature of exits that are too slow.
    """
    losers = trades[trades["r"] <= 0]
    winners = trades[trades["r"] > 0]
    return pd.DataFrame([{
        "losers": len(losers),
        "stopped_but_recovered": int((losers["mfe_r"] >= 1.0).sum()),
        "stopped_but_recovered_pct": round(float((losers["mfe_r"] >= 1.0).mean() * 100), 1) if len(losers) else 0.0,
        "median_loser_mfe_r": round(float(losers["mfe_r"].median()), 2) if len(losers) else 0.0,
        "winners": len(winners),
        "winners_reaching_2r": int((winners["mfe_r"] >= 2.0).sum()),
        "winners_giving_back": int(((winners["mfe_r"] >= 2.0) & (winners["r"] < 1.5)).sum()),
        "median_winner_mae_r": round(float(winners["mae_r"].median()), 2) if len(winners) else 0.0,
    }])


def report(trades: pd.DataFrame) -> dict[str, pd.DataFrame]:
    if trades.empty:
        return {}
    return {
        "by_setup": by_setup(trades),
        "by_hour": by_hour(trades),
        "by_weekday": by_weekday(trades),
        "by_exit_reason": by_exit_reason(trades),
        "stop_placement": stop_placement_review(trades),
    }
