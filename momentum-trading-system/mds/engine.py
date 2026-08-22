"""Event-driven intraday backtest.

Conventions that keep the results honest:
  * Bars are processed in order; a detector on bar i can only produce a trigger
    that bar i+1 or later may fill.
  * When a bar's range contains both the stop and a profit target, the stop is
    assumed to have been hit first. Without minute-level tick data you cannot
    know, and the pessimistic assumption is the only defensible one.
  * Every fill pays commission, regulatory fees and volatility-scaled slippage.
  * One position at a time. The approach is built on focus, and modelling
    simultaneous positions would flatter the risk numbers.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import time as dtime

import numpy as np
import pandas as pd

from .config import StrategyConfig
from .execution import CostModel, fill_price_for_stop_entry, fill_price_for_stop_exit
from .indicators import enrich
from .patterns import Bars, Signal, detect, volume_confirms_breakout
from .risk import RiskManager, size_position


def _parse_time(hhmm: str) -> dtime:
    h, m = hhmm.split(":")
    return dtime(int(h), int(m))


@dataclass
class Exit:
    time: pd.Timestamp
    price: float
    shares: int
    reason: str


@dataclass
class Trade:
    symbol: str
    session: pd.Timestamp
    setup: str
    rationale: str
    entry_time: pd.Timestamp
    entry_price: float
    shares: int
    initial_stop: float
    initial_risk_usd: float
    exits: list[Exit] = field(default_factory=list)
    costs: float = 0.0
    mae_r: float = 0.0            # worst excursion, in R
    mfe_r: float = 0.0            # best excursion, in R
    gross_pnl: float = 0.0

    @property
    def net_pnl(self) -> float:
        return self.gross_pnl - self.costs

    @property
    def r_multiple(self) -> float:
        if self.initial_risk_usd <= 0:
            return 0.0
        return self.net_pnl / self.initial_risk_usd

    @property
    def exit_time(self) -> pd.Timestamp | None:
        return self.exits[-1].time if self.exits else None

    @property
    def exit_reason(self) -> str:
        return self.exits[-1].reason if self.exits else ""

    @property
    def holding_minutes(self) -> float:
        if not self.exits:
            return 0.0
        return (self.exits[-1].time - self.entry_time).total_seconds() / 60.0


@dataclass
class Position:
    trade: Trade
    remaining: int
    stop: float
    risk_per_share: float
    scale_idx: int = 0
    breakeven_moved: bool = False


class Backtester:
    def __init__(self, cfg: StrategyConfig):
        self.cfg = cfg
        self.costs = CostModel(cfg.costs)
        self.risk = RiskManager(cfg.risk)
        self.trades: list[Trade] = []
        self.equity_curve: list[tuple[pd.Timestamp, float]] = []
        self.rejections: list[dict] = []

    # -- helpers ---------------------------------------------------------

    def _targets(self, entry: float, risk_per_share: float) -> list[float]:
        return [entry + r * risk_per_share for r in self.cfg.risk.scale_out_r]

    def _close_position(self, pos: Position, ts, price, reason, atr) -> None:
        fill = self.costs.sell(price, pos.remaining, atr)
        pos.trade.gross_pnl += (fill.price - pos.trade.entry_price) * pos.remaining
        pos.trade.costs += fill.total_cost
        pos.trade.exits.append(Exit(ts, fill.price, pos.remaining, reason))
        pos.remaining = 0

    # -- main loop --------------------------------------------------------

    def _attempt_entry(
        self, symbol: str, b: Bars, i: int, ts, sig: Signal,
        entry_px: float, atr_i: float, session_day,
    ) -> "Position | None":
        """Size, cost-check and fill one triggered signal, or log why not."""
        r = self.cfg.risk

        ok, why = self.risk.can_trade()
        if not ok:
            self._reject(symbol, ts, sig.setup, why)
            return None

        # Participation is confirmed on the bar that actually breaks out.
        if not volume_confirms_breakout(b, i, sig.setup, self.cfg.setups):
            self._reject(symbol, ts, sig.setup, "breakout bar lacked volume confirmation")
            return None

        rps = entry_px - sig.stop
        if rps <= 0:
            self._reject(symbol, ts, sig.setup, "trigger filled at or below the stop")
            return None

        target = entry_px + r.min_reward_risk * rps
        decision = size_position(
            equity=self.risk.equity,
            entry=entry_px,
            stop=sig.stop,
            target=target,
            cfg=r,
            bar_volume=float(b.volume[i]),
            size_multiplier=self.risk.size_multiplier(),
        )
        if not decision.accepted:
            self._reject(symbol, ts, sig.setup, decision.reason)
            return None

        # Would the round trip cost more than a meaningful slice of the risk?
        est_cost = 2 * (
            self.costs.commission(decision.shares)
            + self.costs.fees(decision.shares, entry_px, is_sale=True)
            + self.costs.slippage(atr_i) * decision.shares
        )
        if est_cost > r.max_cost_drag_r * decision.risk_usd:
            self._reject(
                symbol, ts, sig.setup,
                f"round-trip cost {est_cost:.0f} exceeds "
                f"{r.max_cost_drag_r:.0%} of {decision.risk_usd:.0f} risk",
            )
            return None

        fill = self.costs.buy(entry_px, decision.shares, atr_i)
        actual_rps = fill.price - sig.stop
        if actual_rps <= 0:
            self._reject(symbol, ts, sig.setup, "slippage pushed the fill through the stop")
            return None

        trade = Trade(
            symbol=symbol,
            session=session_day,
            setup=sig.setup,
            rationale=sig.rationale,
            entry_time=ts,
            entry_price=fill.price,
            shares=decision.shares,
            initial_stop=sig.stop,
            initial_risk_usd=actual_rps * decision.shares,
            costs=fill.total_cost,
        )
        return Position(
            trade=trade,
            remaining=decision.shares,
            stop=sig.stop,
            risk_per_share=actual_rps,
        )

    def _reject(self, symbol: str, ts, setup: str, reason: str) -> None:
        self.rejections.append(
            {"symbol": symbol, "time": ts, "setup": setup, "reason": reason}
        )

    def run_session(self, symbol: str, df: pd.DataFrame) -> None:
        """Backtest one symbol for one session of 1-minute bars."""
        s = self.cfg.setups
        r = self.cfg.risk
        sess = self.cfg.session

        data = enrich(df, s.ema_fast, s.ema_slow, s.atr_period)
        b = Bars.from_frame(data)
        if len(b) < 20:
            return

        cutoff = _parse_time(sess.trading_cutoff)
        flat_by = _parse_time(sess.force_flat)
        open_t = _parse_time(sess.market_open)

        session_day = pd.Timestamp(data.index[0]).normalize()
        pending: list[Signal] = []
        pos: Position | None = None

        for i in range(len(b)):
            ts = data.index[i]
            t = ts.time()
            atr_i = b.atr[i]

            # ---- 1. manage an open position -----------------------------
            if pos is not None:
                # Stop first: the pessimistic ordering.
                hit = fill_price_for_stop_exit(pos.stop, b.open[i], b.low[i])
                if hit is not None:
                    self._close_position(pos, ts, hit, "stop", atr_i)
                    self.risk.record(pos.trade.net_pnl)
                    self.trades.append(pos.trade)
                    self.equity_curve.append((ts, self.risk.equity))
                    pos = None
                else:
                    # excursions, in R
                    rps = pos.risk_per_share
                    if rps > 0:
                        entry = pos.trade.entry_price
                        pos.trade.mae_r = min(pos.trade.mae_r, (b.low[i] - entry) / rps)
                        pos.trade.mfe_r = max(pos.trade.mfe_r, (b.high[i] - entry) / rps)

                    # scale out at successive R multiples
                    targets = self._targets(pos.trade.entry_price, rps)
                    while (
                        pos is not None
                        and pos.scale_idx < len(targets)
                        and pos.remaining > 0
                        and b.high[i] >= targets[pos.scale_idx]
                    ):
                        frac = r.scale_out[pos.scale_idx] if pos.scale_idx < len(r.scale_out) else 0.0
                        shares = min(pos.remaining, max(1, int(round(pos.trade.shares * frac))))
                        if pos.scale_idx == len(targets) - 1:
                            shares = pos.remaining
                        fill = self.costs.sell(targets[pos.scale_idx], shares, atr_i, aggressive=False)
                        pos.trade.gross_pnl += (fill.price - pos.trade.entry_price) * shares
                        pos.trade.costs += fill.total_cost
                        pos.trade.exits.append(
                            Exit(ts, fill.price, shares, f"target_{r.scale_out_r[pos.scale_idx]:g}R")
                        )
                        pos.remaining -= shares
                        pos.scale_idx += 1
                        if pos.remaining <= 0:
                            self.risk.record(pos.trade.net_pnl)
                            self.trades.append(pos.trade)
                            self.equity_curve.append((ts, self.risk.equity))
                            pos = None

                    if pos is not None:
                        # breakeven, then trail behind the fast EMA
                        if (not pos.breakeven_moved
                                and b.high[i] >= pos.trade.entry_price + r.move_stop_to_breakeven_at_r * rps):
                            pos.stop = max(pos.stop, pos.trade.entry_price)
                            pos.breakeven_moved = True
                        if r.trail_with_ema and pos.breakeven_moved and np.isfinite(b.ema_fast[i]):
                            pos.stop = max(pos.stop, float(b.ema_fast[i]) - 0.02)

                        if t >= flat_by:
                            self._close_position(pos, ts, b.close[i], "time_stop", atr_i)
                            self.risk.record(pos.trade.net_pnl)
                            self.trades.append(pos.trade)
                            self.equity_curve.append((ts, self.risk.equity))
                            pos = None

            # ---- 2. try to fill a pending trigger -----------------------
            # Walk every candidate from the previous bar in preference order.
            # If the favourite is rejected by sizing or cost, the next one still
            # gets its chance - otherwise a single unusable signal silently
            # blocks the whole bar.
            if pos is None and pending:
                if t >= cutoff:
                    pending = []
                else:
                    still_live: list[Signal] = []
                    for sig in pending:
                        entry_px = fill_price_for_stop_entry(sig.trigger, b.open[i], b.high[i])
                        if entry_px is None:
                            if (i - sig.bar) < 2:
                                still_live.append(sig)   # give it one more bar
                            continue
                        pos = self._attempt_entry(
                            symbol, b, i, ts, sig, entry_px, atr_i, session_day
                        )
                        if pos is not None:
                            break
                    pending = [] if pos is not None else still_live

            # ---- 3. look for a new signal at this bar's close ------------
            if pos is None and not pending and open_t <= t < cutoff:
                ok, _ = self.risk.can_trade()
                if ok:
                    pending = detect(b, i, s)[:3]

        # end of session: never carry overnight
        if pos is not None:
            ts = data.index[-1]
            self._close_position(pos, ts, b.close[-1], "eod", b.atr[-1])
            self.risk.record(pos.trade.net_pnl)
            self.trades.append(pos.trade)
            self.equity_curve.append((ts, self.risk.equity))

    def run(self, sessions: dict[pd.Timestamp, dict[str, pd.DataFrame]]) -> "BacktestResult":
        """`sessions` maps session date -> {symbol: 1-minute bars}."""
        for day in sorted(sessions):
            self.risk.start_day()
            for symbol, df in sessions[day].items():
                self.run_session(symbol, df)
        return BacktestResult(
            trades=self.trades,
            equity_curve=self.equity_curve,
            rejections=self.rejections,
            starting_equity=self.cfg.risk.starting_equity,
            final_equity=self.risk.equity,
        )


@dataclass
class BacktestResult:
    trades: list[Trade]
    equity_curve: list[tuple[pd.Timestamp, float]]
    rejections: list[dict]
    starting_equity: float
    final_equity: float

    def to_frame(self) -> pd.DataFrame:
        rows = []
        for t in self.trades:
            rows.append({
                "symbol": t.symbol,
                "session": t.session,
                "setup": t.setup,
                "entry_time": t.entry_time,
                "exit_time": t.exit_time,
                "entry": round(t.entry_price, 4),
                "shares": t.shares,
                "stop": t.initial_stop,
                "risk_usd": round(t.initial_risk_usd, 2),
                "gross_pnl": round(t.gross_pnl, 2),
                "costs": round(t.costs, 2),
                "net_pnl": round(t.net_pnl, 2),
                "r": round(t.r_multiple, 3),
                "mae_r": round(t.mae_r, 2),
                "mfe_r": round(t.mfe_r, 2),
                "hold_min": round(t.holding_minutes, 1),
                "exit_reason": t.exit_reason,
                "rationale": t.rationale,
            })
        return pd.DataFrame(rows)
