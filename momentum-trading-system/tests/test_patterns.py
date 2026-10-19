"""Hand-built bar sequences that provably contain each pattern.

These matter more than any backtest number: they pin the detectors to a
specific, readable definition. If someone later "improves" a threshold and a
setup silently stops firing - which is exactly what happened during
development - these fail loudly.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from mds.config import SetupConfig
from mds.indicators import enrich
from mds.patterns import (Bars, micro_pullback, bull_flag, flat_top_breakout,
                         opening_range_breakout, detect)

NY = "America/New_York"


def make_bars(closes, volumes=None, start="2025-03-03 09:30", spread=0.02):
    n = len(closes)
    idx = pd.date_range(start, periods=n, freq="1min", tz=NY)
    closes = np.asarray(closes, dtype=float)
    opens = np.concatenate([[closes[0]], closes[:-1]])
    highs = np.maximum(opens, closes) + spread
    lows = np.minimum(opens, closes) - spread
    vols = np.asarray(volumes if volumes is not None else [100_000] * n, dtype=float)
    df = pd.DataFrame(
        {"open": opens, "high": highs, "low": lows, "close": closes, "volume": vols},
        index=idx,
    )
    return Bars.from_frame(enrich(df))


def test_micro_pullback_fires_on_a_short_quiet_pause():
    # A clean impulse, then a quiet pause that gives back very little.
    closes = [10.00, 10.05, 10.10] + [10.30, 10.55, 10.80, 11.05] + [10.95, 10.92]
    # The pause must be quieter than the leg that produced it.
    vols = [80_000] * 3 + [300_000] * 4 + [90_000, 85_000]
    b = make_bars(closes, vols)
    cfg = SetupConfig()
    i = len(closes) - 1

    sig = micro_pullback(b, i, cfg)
    assert sig is not None, "a quiet pause after a strong leg must be detected"
    assert sig.setup == "micro_pullback"

    # The detector takes the SHORTEST valid pause, because that triggers
    # earliest. Anchor the assertions to the window it actually chose.
    k = sig.meta["pause_bars"]
    p0 = i - k + 1
    assert sig.trigger > max(b.high[p0:i + 1]) - 0.001
    assert sig.stop < min(b.low[p0:i + 1])
    assert sig.risk_per_share > 0


def test_micro_pullback_rejects_a_loud_pullback():
    # Same geometry, but the "pause" trades more than the impulse: distribution.
    closes = [10.00, 10.05, 10.10] + [10.30, 10.55, 10.80, 11.05] + [10.95, 10.92]
    vols = [80_000] * 3 + [100_000] * 4 + [900_000, 800_000]
    b = make_bars(closes, vols)
    assert micro_pullback(b, len(closes) - 1, SetupConfig()) is None


def test_micro_pullback_rejects_a_deep_retrace():
    # Gives back most of the leg - that is a reversal, not a pause.
    closes = [10.00, 10.05, 10.10] + [10.30, 10.55, 10.80, 11.05] + [10.40, 10.35]
    vols = [80_000] * 3 + [300_000] * 4 + [90_000, 85_000]
    b = make_bars(closes, vols)
    assert micro_pullback(b, len(closes) - 1, SetupConfig()) is None


def test_bull_flag_requires_declining_volume():
    # Needs enough history to clear the detector's lookback guard.
    closes = [10.0, 10.05, 10.1, 10.15, 10.2, 11.0, 11.6, 11.5, 11.45, 11.5, 11.42]
    quiet = [100_000] * 5 + [400_000, 450_000] + [120_000] * 4
    loud = [100_000] * 5 + [400_000, 450_000] + [900_000] * 4
    cfg = SetupConfig()
    assert bull_flag(make_bars(closes, quiet), len(closes) - 1, cfg) is not None
    assert bull_flag(make_bars(closes, loud), len(closes) - 1, cfg) is None


def test_flat_top_needs_price_coiled_under_the_level_not_through_it():
    cfg = SetupConfig()
    # Repeated rejections at ~11.00, currently sitting just under it.
    coiled = [10.2, 10.4, 10.6, 10.8, 11.00, 10.90, 10.99, 10.88,
              11.00, 10.95, 10.97, 10.96, 10.98]
    i = len(coiled) - 1
    sig = flat_top_breakout(make_bars(coiled), i, cfg)
    assert sig is not None
    assert sig.trigger > 11.00

    # Already through the shelf - the edge is gone, so no signal.
    # This is only reachable because the resistance window excludes the
    # current bar; with it included, level >= close[i] always and the guard
    # could never fire.
    through = coiled[:-1] + [11.60]
    assert flat_top_breakout(make_bars(through), i, cfg) is None


def test_opening_range_breakout_stops_at_the_midline():
    """The stop sits at the range midline, giving a 2:1 setup by construction.

    Sourced from a third-party breakdown of this setup (not Ross Cameron's
    own channel - see STRATEGIE.md 1b): stop at the midline, "halfway" target
    at high + (high - mid), "full" target at high + (high - low). Since the
    midline splits the range in half, risk (entry to midline) is exactly half
    of the reward to the full target - 2:1 by construction.
    """
    cfg = SetupConfig(orb_minutes=5)
    # Opening range bars 0-4: low=10.00, high=10.50. Bar 5 (bar_of_session==5)
    # is the detection bar: it must NOT have closed above the range yet (the
    # detector publishes a trigger for a LATER bar to fill, same as every
    # other setup) - it only wicks into the range on its high.
    closes = [10.10, 10.20, 10.05, 10.40, 10.30, 10.45]
    highs =  [10.15, 10.25, 10.10, 10.50, 10.35, 10.48]
    lows =   [10.00, 10.15, 10.00, 10.25, 10.20, 10.35]
    idx = pd.date_range("2025-03-03 09:30", periods=6, freq="1min", tz=NY)
    df = pd.DataFrame({
        "open": [10.05] * 6, "high": highs, "low": lows, "close": closes,
        "volume": [100_000] * 6,
    }, index=idx)
    b = Bars.from_frame(enrich(df))

    i = 5
    sig = opening_range_breakout(b, i, cfg)
    assert sig is not None
    or_mid = (10.50 + 10.00) / 2.0
    # The buffer scales with ATR (see _stop_buffer), so pin the stop to "just
    # under the midline" rather than to an exact tick offset.
    assert sig.stop < or_mid
    assert sig.stop == pytest.approx(or_mid, abs=0.10)
    assert sig.meta["full_target"] == pytest.approx(2 * 10.50 - 10.00)

    # The 2:1 relationship is exact measured from the range high itself -
    # that is the structural claim the source video actually makes:
    # (high - mid) is exactly half of (full_target - high) because the
    # midline splits the range in half.
    structural_risk = sig.meta["or_high"] - sig.meta["or_mid"]
    structural_reward = sig.meta["full_target"] - sig.meta["or_high"]
    assert structural_reward / structural_risk == pytest.approx(2.0, abs=1e-9)

    # The TRADEABLE ratio - from the actual fill trigger (high + 1 tick) and
    # the actual stop (mid - buffer) - is a little worse than 2:1. The tick
    # and the ATR buffer each eat into the risk side's exact midpoint, so a
    # tight opening range on a low-priced stock can land under this system's
    # min_reward_risk=2.0 filter even though the setup "is" a 2:1 by the
    # source's own description. That erosion is real, not a test artefact.
    tradeable_risk = sig.trigger - sig.stop
    tradeable_reward = sig.meta["full_target"] - sig.trigger
    assert 1.5 < tradeable_reward / tradeable_risk < 2.0


def test_detect_ranks_by_configured_preference_not_tightest_stop():
    """Regression test for a real bug.

    Ranking purely by tightest stop promoted whichever signal the minimum-stop
    and cost filters were most likely to reject, and the caller took only the
    first - so the bar was wasted and one setup never traded at all.
    """
    closes = [10.00, 10.05, 10.10, 10.30, 10.55, 10.80, 11.05, 10.95, 10.92]
    vols = [80_000] * 3 + [300_000] * 4 + [90_000, 85_000]
    b = make_bars(closes, vols)
    cfg = SetupConfig(enabled=["flat_top_breakout", "micro_pullback"])
    sigs = detect(b, len(closes) - 1, cfg)
    if len(sigs) > 1:
        ranks = [s.meta["rank"] for s in sigs]
        assert ranks == sorted(ranks), "preference order must drive ranking"


def test_detectors_never_read_future_bars():
    """A detector must give the same answer whether or not later bars exist."""
    closes = [10.00, 10.05, 10.10, 10.30, 10.55, 10.80, 11.05, 10.95, 10.92,
              12.50, 13.00, 9.00]
    vols = [80_000] * 3 + [300_000] * 4 + [90_000, 85_000] + [500_000] * 3
    cfg = SetupConfig()
    i = 8
    full = detect(make_bars(closes, vols), i, cfg)
    truncated = detect(make_bars(closes[: i + 1], vols[: i + 1]), i, cfg)
    assert [s.setup for s in full] == [s.setup for s in truncated]
    assert [round(s.trigger, 4) for s in full] == [round(s.trigger, 4) for s in truncated]
