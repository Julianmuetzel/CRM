"""Indicators used by the setups.

All functions take a DataFrame of intraday bars indexed by a timezone-aware
DatetimeIndex with columns: open, high, low, close, volume.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

BAR_COLUMNS = ["open", "high", "low", "close", "volume"]


def ema(series: pd.Series, span: int) -> pd.Series:
    return series.ewm(span=span, adjust=False).mean()


def true_range(df: pd.DataFrame) -> pd.Series:
    prev_close = df["close"].shift(1)
    ranges = pd.concat(
        [
            df["high"] - df["low"],
            (df["high"] - prev_close).abs(),
            (df["low"] - prev_close).abs(),
        ],
        axis=1,
    )
    return ranges.max(axis=1)


def atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    """Wilder's ATR."""
    return true_range(df).ewm(alpha=1.0 / period, adjust=False).mean()


def session_vwap(df: pd.DataFrame) -> pd.Series:
    """Volume weighted average price, anchored to each session's start.

    VWAP is the reference line the strategy leans on hardest: longs are taken
    above it, and losing it is treated as the move failing.
    """
    typical = (df["high"] + df["low"] + df["close"]) / 3.0
    dates = df.index.normalize()
    pv = (typical * df["volume"]).groupby(dates).cumsum()
    vol = df["volume"].groupby(dates).cumsum()
    return pv / vol.replace(0, np.nan)


def relative_volume(df: pd.DataFrame, lookback_days: int = 50) -> pd.Series:
    """Cumulative session volume divided by the average cumulative volume at
    the same time of day over the lookback window.

    This is the intraday-aware version of RVOL: comparing 09:35 volume to a
    full-day average would be meaningless.
    """
    dates = df.index.normalize()
    cum = df["volume"].groupby(dates).cumsum()
    minute_of_day = df.index.hour * 60 + df.index.minute
    frame = pd.DataFrame({"cum": cum, "mod": minute_of_day, "date": dates})
    baseline = (
        frame.groupby("mod")["cum"]
        .transform(lambda s: s.shift(1).rolling(lookback_days, min_periods=1).mean())
    )
    return frame["cum"] / baseline.replace(0, np.nan)


def enrich(df: pd.DataFrame, ema_fast: int = 9, ema_slow: int = 20,
           atr_period: int = 14) -> pd.DataFrame:
    """Attach every derived column the detectors expect."""
    missing = [c for c in BAR_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"missing bar columns: {missing}")

    out = df.copy()
    out["ema_fast"] = ema(out["close"], ema_fast)
    out["ema_slow"] = ema(out["close"], ema_slow)
    out["atr"] = atr(out, atr_period)
    out["vwap"] = session_vwap(out)
    out["vol_avg"] = out["volume"].rolling(20, min_periods=5).mean()
    out["vol_ratio"] = out["volume"] / out["vol_avg"].replace(0, np.nan)

    dates = out.index.normalize()
    out["session_high"] = out["high"].groupby(dates).cummax()
    out["session_low"] = out["low"].groupby(dates).cummin()
    out["bar_of_session"] = out.groupby(dates).cumcount()
    return out
