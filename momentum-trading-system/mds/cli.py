"""Command line entry point.

    python -m mds feasibility
    python -m mds demo --days 60
    python -m mds backtest --bars data/bars.csv --snapshot data/snapshot.csv
    python -m mds scan --snapshot data/snapshot.csv
    python -m mds montecarlo --trades out/trades.csv
"""

from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd

from .config import StrategyConfig
from .data import load_bars_csv, load_snapshot_csv, split_sessions, synthetic_universe
from .engine import Backtester
from .journal import report
from .metrics import (cost_sensitivity, feasibility_table, monte_carlo,
                      required_win_rate, summarize)
from .universe import rejection_report, scan

BANNER = "=" * 78


def _load_cfg(path: str | None) -> StrategyConfig:
    return StrategyConfig.load(path) if path else StrategyConfig()


def _section(title: str) -> None:
    print(f"\n{BANNER}\n{title}\n{BANNER}")


def _apply_scanner(cfg, sessions, snapshot):
    filtered = {}
    for day, syms in sessions.items():
        cands = scan(snapshot[snapshot["date"] == day], cfg.scanner)
        keep = {c.symbol: syms[c.symbol] for c in cands if c.symbol in syms}
        if keep:
            filtered[day] = keep
    return filtered


def _print_results(cfg, res, show_journal: bool = True) -> None:
    tf = res.to_frame()
    if tf.empty:
        print("\nNo trades. Loosen the scanner, or check that the data covers "
              "regular trading hours.")
        return

    s = summarize(tf, cfg.risk.starting_equity)
    _section("RESULT")
    print(f"  trades            {s.trades}")
    print(f"  win rate          {s.win_rate*100:.1f}%")
    print(f"  expectancy        {s.expectancy_r:+.3f} R per trade")
    print(f"  avg win / loss    {s.avg_win_r:+.2f}R / {s.avg_loss_r:+.2f}R")
    print(f"  profit factor     {s.profit_factor:.2f}")
    print(f"  net P/L           {s.net_pnl:,.0f}   (gross {s.gross_pnl:,.0f}, costs {s.total_costs:,.0f})")
    print(f"  cost drag         {s.cost_drag_r:.3f} R per trade")
    print(f"  max drawdown      {s.max_drawdown:,.0f} ({s.max_drawdown_pct:.1f}%)")
    print(f"  avg hold          {s.avg_hold_minutes:.1f} min")

    be = required_win_rate(cfg.risk.min_reward_risk, s.cost_drag_r)
    print(f"\n  break-even win rate at {cfg.risk.min_reward_risk:.1f}:1 "
          f"with these costs: {be*100:.1f}%")
    print(f"  observed win rate: {s.win_rate*100:.1f}% "
          f"({'above' if s.win_rate > be else 'BELOW'} break-even)")

    if show_journal:
        for name, table in report(tf).items():
            _section(name.replace("_", " ").upper())
            print(table.to_string(index=False))

    _section("COST SENSITIVITY  (how much slippage kills the edge)")
    print(cost_sensitivity(tf).to_string(index=False))

    if len(tf) >= 20:
        _section("MONTE CARLO  (10,000 reorderings of these same trades)")
        mc = monte_carlo(tf["r"].to_numpy(), n_trades=min(250, len(tf) * 5),
                         risk_per_trade_pct=cfg.risk.risk_per_trade_pct,
                         starting_equity=cfg.risk.starting_equity)
        print(f"  median final equity   {mc['median_final']:,.0f}")
        print(f"  5th / 95th percentile {mc['p05_final']:,.0f} / {mc['p95_final']:,.0f}")
        print(f"  probability profitable {mc['prob_profitable']*100:.1f}%")
        print(f"  median max drawdown   {mc['median_max_dd_pct']:.1f}%")
        print(f"  worst 5% drawdown     {mc['p05_max_dd_pct']:.1f}%")
        print(f"  probability of a {mc['ruin_threshold_pct']:.0f}% drawdown: "
              f"{mc['prob_ruin']*100:.1f}%")


def cmd_feasibility(args) -> None:
    _section("BREAK-EVEN WIN RATE  (% of trades that must win just to not lose)")
    print(feasibility_table().to_string(index=False))
    print("\nRead this before anything else. At 2:1 you need a third of your")
    print("trades to win before costs. Every cent of slippage moves that up,")
    print("and on sub-$20 names with a few-cent stop the cost column is not")
    print("the leftmost one.")


def cmd_scan(args) -> None:
    cfg = _load_cfg(args.config)
    snap = load_snapshot_csv(args.snapshot)
    _section("SCANNER REJECTIONS  (how many symbols each filter removed)")
    print(rejection_report(snap, cfg.scanner).to_string())
    _section("WATCHLIST")
    for day in sorted(snap["date"].unique()):
        cands = scan(snap[snap["date"] == day], cfg.scanner)
        if cands:
            print(f"\n{pd.Timestamp(day).date()}")
            for c in cands:
                tags = f"  [{', '.join(c.reasons)}]" if c.reasons else ""
                print(f"   {c.symbol:<8} ${c.price:>7.2f}  gap {c.gap_pct:>5.0f}%  "
                      f"rvol {c.rvol:>5.1f}  float {c.float_shares/1e6:>5.1f}M  "
                      f"score {c.score:.2f}{tags}")


def cmd_backtest(args) -> None:
    cfg = _load_cfg(args.config)
    bars = load_bars_csv(args.bars)
    snap = load_snapshot_csv(args.snapshot)
    symbol = args.symbol or "SYMBOL"
    sessions = {day: {symbol: df} for day, df in split_sessions(bars).items()}
    filtered = _apply_scanner(cfg, sessions, snap) if args.use_scanner else sessions
    res = Backtester(cfg).run(filtered)
    _print_results(cfg, res)
    if args.out:
        Path(args.out).parent.mkdir(parents=True, exist_ok=True)
        res.to_frame().to_csv(args.out, index=False)
        print(f"\ntrades written to {args.out}")


def cmd_demo(args) -> None:
    cfg = _load_cfg(args.config)
    print("\n*** SYNTHETIC DATA ***")
    print("These bars were generated, not observed. The numbers below show that")
    print("the machinery works end to end. They are NOT evidence of an edge, and")
    print("no conclusion about profitability may be drawn from them. Point this")
    print("at real data before you believe anything.")
    sessions, snap = synthetic_universe(n_days=args.days, symbols_per_day=3, seed=args.seed)
    filtered = _apply_scanner(cfg, sessions, snap)
    res = Backtester(cfg).run(filtered)
    _print_results(cfg, res)
    if args.out:
        Path(args.out).parent.mkdir(parents=True, exist_ok=True)
        res.to_frame().to_csv(args.out, index=False)
        print(f"\ntrades written to {args.out}")


def cmd_montecarlo(args) -> None:
    tf = pd.read_csv(args.trades)
    mc = monte_carlo(tf["r"].to_numpy(), n_trades=args.n, n_sims=args.sims,
                     risk_per_trade_pct=args.risk, starting_equity=args.equity)
    _section(f"MONTE CARLO  ({args.sims:,} paths of {args.n} trades)")
    for k, v in mc.items():
        print(f"  {k:<24} {v:,.2f}" if isinstance(v, float) else f"  {k:<24} {v}")


def cmd_journal(args) -> None:
    tf = pd.read_csv(args.trades)
    for name, table in report(tf).items():
        _section(name.replace("_", " ").upper())
        print(table.to_string(index=False))


def main(argv=None) -> None:
    ap = argparse.ArgumentParser(prog="mds", description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--config", help="path to strategy.yaml")
    sub = ap.add_subparsers(dest="cmd", required=True)

    sub.add_parser("feasibility", help="break-even win rate table").set_defaults(fn=cmd_feasibility)

    p = sub.add_parser("scan", help="run the stocks-in-play filter")
    p.add_argument("--snapshot", required=True)
    p.set_defaults(fn=cmd_scan)

    p = sub.add_parser("backtest", help="backtest real 1-minute bars")
    p.add_argument("--bars", required=True)
    p.add_argument("--snapshot", required=True)
    p.add_argument("--symbol")
    p.add_argument("--use-scanner", action="store_true")
    p.add_argument("--out")
    p.set_defaults(fn=cmd_backtest)

    p = sub.add_parser("demo", help="end-to-end run on synthetic data")
    p.add_argument("--days", type=int, default=60)
    p.add_argument("--seed", type=int, default=11)
    p.add_argument("--out")
    p.set_defaults(fn=cmd_demo)

    p = sub.add_parser("montecarlo", help="resample a trade log")
    p.add_argument("--trades", required=True)
    p.add_argument("--n", type=int, default=250)
    p.add_argument("--sims", type=int, default=10_000)
    p.add_argument("--risk", type=float, default=1.0)
    p.add_argument("--equity", type=float, default=30_000)
    p.set_defaults(fn=cmd_montecarlo)

    p = sub.add_parser("journal", help="break a trade log down by setup and time")
    p.add_argument("--trades", required=True)
    p.set_defaults(fn=cmd_journal)

    args = ap.parse_args(argv)
    args.fn(args)


if __name__ == "__main__":
    main()
