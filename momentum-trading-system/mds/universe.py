"""The "stocks in play" scanner.

This is the gate that matters most. The setups in patterns.py are only
meaningful on symbols that pass here: a low float, a real catalyst, extreme
relative volume, and a price band where percentage moves are large.
"""

from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from .config import ScannerConfig


@dataclass
class Candidate:
    """One symbol that cleared the scanner for a given session."""

    symbol: str
    date: pd.Timestamp
    gap_pct: float
    premarket_volume: int
    float_shares: float
    rvol: float
    price: float
    has_catalyst: bool
    score: float
    reasons: tuple[str, ...] = ()

    def __repr__(self) -> str:  # pragma: no cover - display only
        return (
            f"<Candidate {self.symbol} {self.date.date()} "
            f"gap={self.gap_pct:.0f}% rvol={self.rvol:.1f} "
            f"float={self.float_shares/1e6:.1f}M score={self.score:.2f}>"
        )


REQUIRED_COLUMNS = [
    "symbol", "date", "price", "prev_close", "gap_pct",
    "premarket_volume", "float_shares", "rvol", "has_catalyst",
]


def _score(row: pd.Series, cfg: ScannerConfig) -> float:
    """Rank candidates so that limited attention goes to the best ones.

    Lower float and higher relative volume are the two factors most associated
    with the violent, trendy intraday moves the strategy needs. Neither is a
    prediction of direction - they are a prediction of *range*.
    """
    float_score = min(cfg.preferred_float_shares / max(row["float_shares"], 1e5), 3.0)
    rvol_score = min(row["rvol"] / cfg.min_rvol, 3.0)
    gap_score = min(row["gap_pct"] / cfg.min_gap_pct, 3.0)
    catalyst_score = 1.0 if row["has_catalyst"] else 0.0
    return 0.35 * float_score + 0.35 * rvol_score + 0.20 * gap_score + 0.10 * catalyst_score


def scan(snapshot: pd.DataFrame, cfg: ScannerConfig) -> list[Candidate]:
    """Filter a premarket snapshot down to the day's watchlist.

    `snapshot` holds one row per symbol per session with the columns listed in
    REQUIRED_COLUMNS. Returns at most `cfg.max_symbols_per_day` candidates,
    best first.
    """
    missing = [c for c in REQUIRED_COLUMNS if c not in snapshot.columns]
    if missing:
        raise ValueError(f"snapshot missing columns: {missing}")

    df = snapshot.copy()
    checks = {
        "price": df["price"].between(cfg.min_price, cfg.max_price),
        "gap": df["gap_pct"] >= cfg.min_gap_pct,
        "float": df["float_shares"] <= cfg.max_float_shares,
        "rvol": df["rvol"] >= cfg.min_rvol,
        "pm_volume": df["premarket_volume"] >= cfg.min_premarket_volume,
    }
    if cfg.require_catalyst:
        checks["catalyst"] = df["has_catalyst"].astype(bool)
    if cfg.exclude_otc and "is_otc" in df.columns:
        checks["listed"] = ~df["is_otc"].astype(bool)

    mask = pd.Series(True, index=df.index)
    for test in checks.values():
        mask &= test.fillna(False)

    passed = df[mask].copy()
    if passed.empty:
        return []

    passed["score"] = passed.apply(_score, axis=1, cfg=cfg)
    passed = passed.sort_values("score", ascending=False)

    out: list[Candidate] = []
    for _, row in passed.head(cfg.max_symbols_per_day).iterrows():
        reasons = []
        if row["float_shares"] <= cfg.preferred_float_shares:
            reasons.append("low float")
        if row["rvol"] >= 2 * cfg.min_rvol:
            reasons.append("extreme rvol")
        if row["gap_pct"] >= 2 * cfg.min_gap_pct:
            reasons.append("large gap")
        out.append(
            Candidate(
                symbol=row["symbol"],
                date=pd.Timestamp(row["date"]),
                gap_pct=float(row["gap_pct"]),
                premarket_volume=int(row["premarket_volume"]),
                float_shares=float(row["float_shares"]),
                rvol=float(row["rvol"]),
                price=float(row["price"]),
                has_catalyst=bool(row["has_catalyst"]),
                score=float(row["score"]),
                reasons=tuple(reasons),
            )
        )
    return out


def rejection_report(snapshot: pd.DataFrame, cfg: ScannerConfig) -> pd.Series:
    """How many symbols each individual filter removed.

    Useful for calibration: if 'catalyst' is removing 95% of your universe you
    probably have a data problem, not a strategy insight.
    """
    df = snapshot
    counts = {
        "price_out_of_band": (~df["price"].between(cfg.min_price, cfg.max_price)).sum(),
        "gap_too_small": (df["gap_pct"] < cfg.min_gap_pct).sum(),
        "float_too_large": (df["float_shares"] > cfg.max_float_shares).sum(),
        "rvol_too_low": (df["rvol"] < cfg.min_rvol).sum(),
        "pm_volume_too_low": (df["premarket_volume"] < cfg.min_premarket_volume).sum(),
    }
    if cfg.require_catalyst:
        counts["no_catalyst"] = (~df["has_catalyst"].astype(bool)).sum()
    return pd.Series(counts).sort_values(ascending=False)
