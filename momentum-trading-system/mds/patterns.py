"""Entry setups.

Design rule: a detector may only look at bars up to and including the bar it is
evaluating. It never sees the future. A detector does not "enter" - it publishes
a *trigger* level, and the engine fills only if a later bar actually trades
through that level. This is what a resting stop order does in real life, and it
is the single biggest source of inflated backtest results when done wrong.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable

import numpy as np
import pandas as pd

from .config import SetupConfig

TICK = 0.01


@dataclass
class Bars:
    """Column-oriented view of enriched bars - fast positional access."""

    index: pd.DatetimeIndex
    open: np.ndarray
    high: np.ndarray
    low: np.ndarray
    close: np.ndarray
    volume: np.ndarray
    ema_fast: np.ndarray
    ema_slow: np.ndarray
    atr: np.ndarray
    vwap: np.ndarray
    vol_avg: np.ndarray
    bar_of_session: np.ndarray

    @classmethod
    def from_frame(cls, df: pd.DataFrame) -> "Bars":
        f = lambda c: df[c].to_numpy(dtype=float)
        return cls(
            index=df.index,
            open=f("open"), high=f("high"), low=f("low"), close=f("close"),
            volume=f("volume"), ema_fast=f("ema_fast"), ema_slow=f("ema_slow"),
            atr=f("atr"), vwap=f("vwap"), vol_avg=f("vol_avg"),
            bar_of_session=df["bar_of_session"].to_numpy(dtype=int),
        )

    def __len__(self) -> int:
        return len(self.index)


@dataclass
class Signal:
    """A published intent to buy, not a fill."""

    setup: str
    bar: int                 # index of the bar that produced the signal
    trigger: float           # buy stop level; must be traded through
    stop: float              # initial protective stop
    rationale: str
    meta: dict = field(default_factory=dict)

    @property
    def risk_per_share(self) -> float:
        return self.trigger - self.stop


def _stop_buffer(b: Bars, i: int) -> float:
    """A few cents of air under the structural low.

    Without this, every stop sits exactly on the level everybody else's stop
    sits on, which is precisely where liquidity sweeps reach.
    """
    a = b.atr[i]
    if not np.isfinite(a):
        return TICK
    return max(TICK, round(0.10 * a, 2))


def _volume_ok(b: Bars, i: int, cfg: SetupConfig) -> bool:
    """Is this bar trading more than the bars immediately before it?

    Deliberately compared against a short trailing window rather than a 20-bar
    average. Early in a session that longer average is dominated by the opening
    surge, so demanding a multiple of it rejects almost every legitimate
    continuation breakout. What a trader actually reacts to is volume picking
    up again relative to the quiet bars just passed.
    """
    if not cfg.require_volume_confirmation:
        return True
    lb = max(2, cfg.volume_confirm_lookback)
    if i < lb:
        return False
    ref = float(np.mean(b.volume[i - lb:i]))
    if ref <= 0:
        return False
    return b.volume[i] >= cfg.volume_confirm_multiple * ref


def _trending_up(b: Bars, i: int) -> bool:
    """Only take longs while the intraday structure is intact."""
    return (
        np.isfinite(b.vwap[i])
        and b.close[i] > b.vwap[i]
        and np.isfinite(b.ema_fast[i])
        and b.close[i] > b.ema_fast[i]
    )


# --------------------------------------------------------------------------
# Setups
# --------------------------------------------------------------------------

def micro_pullback(b: Bars, i: int, cfg: SetupConfig) -> Signal | None:
    """A 1-3 bar pause inside a strong move that barely gives anything back.

    This is the highest-frequency entry in the approach and the one that most
    depends on execution speed: the pause is short, and the trigger is close.
    """
    n = cfg.micro_pullback_max_bars
    if i < n + 3 or not _trending_up(b, i):
        return None

    for pause in range(1, n + 1):
        p0 = i - pause + 1              # first bar of the pause
        if p0 - 1 < 2:
            continue

        # The impulse: the leg immediately before the pause.
        imp_end = p0 - 1
        imp_start = max(0, imp_end - 4)
        imp_low = float(np.min(b.low[imp_start:imp_end + 1]))
        imp_high = float(np.max(b.high[imp_start:imp_end + 1]))
        leg = imp_high - imp_low
        if leg <= 0:
            continue
        if b.close[imp_end] <= b.open[imp_start]:
            continue                     # the leg was not actually up

        pause_low = float(np.min(b.low[p0:i + 1]))
        pause_high = float(np.max(b.high[p0:i + 1]))

        retrace = (imp_high - pause_low) / leg
        if retrace > cfg.micro_pullback_max_retrace:
            continue
        if pause_high > imp_high:
            continue                     # it kept running; not a pause
        if cfg.micro_pullback_require_above_ema:
            if not np.isfinite(b.ema_fast[i]) or pause_low < b.ema_fast[i] - _stop_buffer(b, i):
                continue

        # A healthy pause dries up. If the pullback trades more volume than the
        # leg that produced it, that is distribution, not a pause.
        if float(np.mean(b.volume[p0:i + 1])) > float(np.mean(b.volume[imp_start:imp_end + 1])):
            continue

        trigger = round(pause_high + TICK, 2)
        stop = round(pause_low - _stop_buffer(b, i), 2)
        if stop >= trigger:
            continue
        return Signal(
            setup="micro_pullback",
            bar=i,
            trigger=trigger,
            stop=stop,
            rationale=f"{pause}-bar pause retracing {retrace:.0%} of the leg, holding the fast EMA",
            meta={"pause_bars": pause, "retrace": retrace, "impulse": leg},
        )
    return None


def bull_flag(b: Bars, i: int, cfg: SetupConfig) -> Signal | None:
    """Impulse leg, then an orderly sideways-to-down consolidation."""
    lo_c, hi_c = cfg.bull_flag_consolidation_min_bars, cfg.bull_flag_consolidation_max_bars
    if i < hi_c + cfg.bull_flag_impulse_min_bars + 2 or not _trending_up(b, i):
        return None

    for cons in range(lo_c, hi_c + 1):
        c0 = i - cons + 1
        imp_end = c0 - 1
        imp_start = imp_end - cfg.bull_flag_impulse_min_bars + 1
        if imp_start < 1:
            continue

        imp_low = float(np.min(b.low[imp_start:imp_end + 1]))
        imp_high = float(np.max(b.high[imp_start:imp_end + 1]))
        leg = imp_high - imp_low
        if leg <= 0 or imp_low <= 0:
            continue
        if (leg / imp_low) * 100.0 < cfg.bull_flag_impulse_min_pct:
            continue

        cons_low = float(np.min(b.low[c0:i + 1]))
        cons_high = float(np.max(b.high[c0:i + 1]))
        if cons_high > imp_high:
            continue
        retrace = (imp_high - cons_low) / leg
        if retrace > cfg.bull_flag_max_retrace:
            continue

        # The flag should be quieter than the pole - that is what makes it a flag.
        if float(np.mean(b.volume[c0:i + 1])) > float(np.mean(b.volume[imp_start:imp_end + 1])):
            continue

        trigger = round(cons_high + TICK, 2)
        stop = round(cons_low - _stop_buffer(b, i), 2)
        if stop >= trigger:
            continue
        return Signal(
            setup="bull_flag",
            bar=i,
            trigger=trigger,
            stop=stop,
            rationale=f"{cons}-bar flag on declining volume after a {(leg/imp_low)*100:.1f}% pole",
            meta={"consolidation_bars": cons, "retrace": retrace, "pole_pct": (leg / imp_low) * 100},
        )
    return None


def flat_top_breakout(b: Bars, i: int, cfg: SetupConfig) -> Signal | None:
    """Repeated rejections at one price, forming a shelf of resting supply.

    The trade is the moment that supply is absorbed. More touches means a
    cleaner level but also a more crowded one.
    """
    lb = cfg.flat_top_lookback
    if i < lb + 1 or not _trending_up(b, i):
        return None

    # The shelf must be built by PRIOR bars. Including the current bar makes
    # level >= high[i] >= close[i] by construction, which silently turned the
    # "already broken out" guard below into dead code.
    window = b.high[i - lb:i]
    level = float(np.max(window))
    if level <= 0:
        return None

    tol = level * cfg.flat_top_tolerance_pct / 100.0
    touches = int(np.sum(window >= level - tol))
    if touches < cfg.flat_top_min_touches:
        return None

    # Price must be coiled under the level right now, not already through it.
    if b.close[i] > level:
        return None
    if b.close[i] < level - 4 * max(tol, TICK):
        return None

    base_low = float(np.min(b.low[i - lb:i + 1]))
    structural_low = max(base_low, float(np.min(b.low[max(0, i - 3):i + 1])))
    trigger = round(level + TICK, 2)
    stop = round(structural_low - _stop_buffer(b, i), 2)
    if stop >= trigger:
        return None
    return Signal(
        setup="flat_top_breakout",
        bar=i,
        trigger=trigger,
        stop=stop,
        rationale=f"{touches} touches of {level:.2f} within {cfg.flat_top_tolerance_pct}%",
        meta={"level": level, "touches": touches},
    )


def opening_range_breakout(b: Bars, i: int, cfg: SetupConfig) -> Signal | None:
    """Break of the first N minutes' range.

    Deliberately fires once per session: the opening range stops being the
    opening range after it has been resolved.
    """
    m = cfg.orb_minutes
    bos = b.bar_of_session[i]
    if bos != m:
        return None

    start = i - m
    if start < 0:
        return None
    or_high = float(np.max(b.high[start:i]))
    or_low = float(np.min(b.low[start:i]))
    if or_high <= or_low:
        return None
    if b.close[i] > or_high:
        return None

    trigger = round(or_high + TICK, 2)
    # A full opening-range stop is often too wide; cap it and let the
    # reward:risk filter in risk.py reject what is left.
    stop = round(max(or_low, b.close[i] - 2.0 * b.atr[i] if np.isfinite(b.atr[i]) else or_low)
                 - _stop_buffer(b, i), 2)
    if stop >= trigger:
        return None
    return Signal(
        setup="opening_range_breakout",
        bar=i,
        trigger=trigger,
        stop=stop,
        rationale=f"break of the {m}-minute opening range {or_low:.2f}-{or_high:.2f}",
        meta={"or_high": or_high, "or_low": or_low},
    )


def vwap_reclaim(b: Bars, i: int, cfg: SetupConfig) -> Signal | None:
    """Price loses VWAP, then takes it back.

    Treated as a second-chance entry: the failed breakdown traps the shorts who
    sold the loss of VWAP.
    """
    k = cfg.vwap_reclaim_min_bars_below
    if i < k + 2 or not np.isfinite(b.vwap[i]):
        return None
    if b.close[i] <= b.vwap[i]:
        return None
    prior = b.close[i - k:i]
    prior_vwap = b.vwap[i - k:i]
    if not np.all(prior < prior_vwap):
        return None
    if not _volume_ok(b, i, cfg):
        return None

    trigger = round(b.high[i] + TICK, 2)
    stop = round(min(b.low[i], float(b.vwap[i])) - _stop_buffer(b, i), 2)
    if stop >= trigger:
        return None
    return Signal(
        setup="vwap_reclaim",
        bar=i,
        trigger=trigger,
        stop=stop,
        rationale=f"reclaimed VWAP after {k} bars below it",
        meta={"bars_below": k, "vwap": float(b.vwap[i])},
    )


DETECTORS: dict[str, Callable[[Bars, int, SetupConfig], Signal | None]] = {
    "micro_pullback": micro_pullback,
    "bull_flag": bull_flag,
    "flat_top_breakout": flat_top_breakout,
    "opening_range_breakout": opening_range_breakout,
    "vwap_reclaim": vwap_reclaim,
}


#: Setups whose *entry* bar must show expanding volume to be credible.
#: Checked by the engine at fill time via `volume_confirms_breakout`, never on
#: the signal bar: a pullback pause is supposed to be quiet, so demanding
#: expanding volume there rejects the very pattern it is meant to validate.
VOLUME_GATED = ("micro_pullback", "bull_flag", "flat_top_breakout")


def volume_confirms_breakout(b: Bars, i: int, setup: str, cfg: SetupConfig) -> bool:
    """Does the bar that trades through the trigger carry real participation?"""
    if setup not in VOLUME_GATED:
        return True
    return _volume_ok(b, i, cfg)


def detect(b: Bars, i: int, cfg: SetupConfig) -> list[Signal]:
    """Run every enabled detector on bar `i` and rank the results.

    Ranking is by the order of `cfg.enabled` - that list is the trader's stated
    preference, so the most-trusted setup wins ties. Tightest stop is only the
    tiebreaker *within* a setup.

    Sorting purely by tightest stop, which is the obvious thing to do, is a
    trap: it systematically promotes exactly the signals that the minimum-stop
    and cost filters will later reject, and the bar is wasted. The caller is
    expected to walk this list in order rather than taking only the first.
    """
    signals: list[Signal] = []
    for rank, name in enumerate(cfg.enabled):
        fn = DETECTORS.get(name)
        if fn is None:
            continue
        sig = fn(b, i, cfg)
        if sig is None or sig.risk_per_share <= 0:
            continue
        sig.meta["rank"] = rank
        signals.append(sig)
    signals.sort(key=lambda s: (s.meta.get("rank", 99), s.risk_per_share))
    return signals
