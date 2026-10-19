#!/usr/bin/env python3
"""Turn a Higgsfield scene-by-scene video analysis into calibration notes.

Higgsfield's video_analysis_create/_status tools return a per-scene
breakdown (dialogue/description per scene) for a YouTube URL - fetched and
processed on Higgsfield's own infrastructure, not through this sandbox's
blocked network path. This script takes that JSON result, pulls out any
scene whose text mentions a strategy parameter we track in
config/strategy.yaml, and prints a side-by-side so the numbers can be
adjusted deliberately rather than by silently re-reading the whole
transcript each time.

Usage:
    python scripts/calibrate_from_analysis.py analysis_result.json
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

# Parameter name -> regex patterns that suggest the trader is stating a
# concrete rule for it. Deliberately permissive; false positives are cheap to
# skim, a missed mention is not.
WATCH = {
    "min_gap_pct":            r"\bgap(?:ped)?\s+(?:up\s+)?(\d{1,3})\s*%",
    "max_float_shares":        r"\bfloat[^.]{0,30}?(\d+(?:\.\d+)?)\s*(million|m)\b",
    "min_rvol":                r"\b(\d{1,3})\s*x\b[^.]{0,20}?(relative\s+)?volume|\bvolume[^.]{0,20}?(\d{1,3})\s*x\b",
    "min_price":                r"\bunder\s*\$?(\d{1,3})\b|\$?(\d{1,2})\s*(?:to|-|–)\s*\$?(\d{1,3})\b",
    "min_reward_risk":          r"\b(\d)\s*(?:to|:)\s*1\b|\brisk[^.]{0,15}?reward|\b2:1\b",
    "max_stop_distance_pct":    r"\bstop[^.]{0,30}?(\d{1,2}(?:\.\d+)?)\s*%",
    "micro_pullback_max_bars":  r"\bmicro\s*pull-?back\b",
    "bull_flag_impulse_min_pct":r"\bbull\s*flag\b",
    "move_stop_to_breakeven_at_r": r"\bbreak-?even\b",
    "ema_fast":                  r"\b9\s*ema\b",
    "ema_slow":                  r"\b20\s*ema\b",
    "vwap_reclaim_min_bars_below": r"\bvwap\b",
}


def load_scenes(path: Path) -> list[dict]:
    data = json.loads(path.read_text())
    result = data.get("result", data)
    scenes = result.get("scenes") or []
    if not scenes:
        sys.exit(f"No scenes in {path} (status={result.get('status')!r}). "
                 "Wait for status='completed' before running this.")
    return scenes


def scene_text(scene: dict) -> str:
    # Be tolerant of whatever shape Higgsfield returns the transcript/caption
    # under - different analyses have used different field names.
    parts = [
        str(scene.get(k, ""))
        for k in ("description", "dialogue", "transcript", "text", "summary")
    ]
    return " ".join(p for p in parts if p)


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit("usage: calibrate_from_analysis.py <analysis_result.json>")
    scenes = load_scenes(Path(sys.argv[1]))

    print(f"{len(scenes)} scenes loaded.\n")
    hits = 0
    for i, scene in enumerate(scenes):
        text = scene_text(scene)
        if not text:
            continue
        for param, pattern in WATCH.items():
            for m in re.finditer(pattern, text, re.IGNORECASE):
                hits += 1
                window = text[max(0, m.start() - 40): m.end() + 40]
                ts = scene.get("start") or scene.get("timestamp") or i
                print(f"[{ts}] {param:<28} ...{window.strip()}...")

    print(f"\n{hits} candidate mentions. Cross-check each against "
         "config/strategy.yaml by hand before changing a value - this is a "
         "finder, not an auto-calibrator.")


if __name__ == "__main__":
    main()
