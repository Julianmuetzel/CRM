#!/usr/bin/env python3
"""Pull transcripts from a YouTube channel so the strategy parameters can be
calibrated against what the trader actually says, rather than against a
second-hand write-up.

Requires network access to youtube.com. In a sandbox where the egress policy
blocks it, this exits with a clear message instead of a stack trace.

    python scripts/fetch_transcripts.py --channel @DaytradeWarrior --limit 25
    python scripts/fetch_transcripts.py --urls video_urls.txt

Output: one .txt per video in --out, plus an index.csv. Feed the whole folder
back into the analysis to extract the stated rules.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import subprocess
import sys
from pathlib import Path


def _check_reachable() -> None:
    try:
        import urllib.request
        urllib.request.urlopen("https://www.youtube.com", timeout=15)
    except Exception as exc:  # noqa: BLE001
        sys.exit(
            f"Cannot reach youtube.com ({exc}).\n\n"
            "If you are running inside a sandboxed environment, the network\n"
            "policy is blocking it. Allow these hosts and start a new session:\n"
            "    youtube.com, *.youtube.com, googlevideo.com, *.googlevideo.com\n\n"
            "Alternatively, open each video, choose '...' -> 'Show transcript',\n"
            "copy the text, and drop it into the --out folder as a .txt file.\n"
            "Everything downstream works the same either way."
        )


def list_videos(channel: str, limit: int) -> list[dict]:
    """Video ids and titles, newest first, without downloading any media."""
    url = f"https://www.youtube.com/{channel.lstrip('/')}/videos"
    cmd = ["yt-dlp", "--flat-playlist", "--dump-json",
           "--playlist-end", str(limit), url]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        sys.exit(f"yt-dlp failed:\n{proc.stderr[:2000]}")
    out = []
    for line in proc.stdout.splitlines():
        if not line.strip():
            continue
        d = json.loads(line)
        out.append({"id": d.get("id"), "title": d.get("title", ""),
                    "duration": d.get("duration")})
    return out


def fetch_transcript(video_id: str, out_dir: Path, lang: str = "en") -> Path | None:
    """Subtitles only - no audio or video is downloaded."""
    out_dir.mkdir(parents=True, exist_ok=True)
    stem = out_dir / video_id
    cmd = [
        "yt-dlp", "--skip-download",
        "--write-auto-sub", "--write-sub",
        "--sub-lang", lang, "--sub-format", "vtt",
        "-o", str(stem) + ".%(ext)s",
        f"https://www.youtube.com/watch?v={video_id}",
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        print(f"  ! {video_id}: {proc.stderr.strip().splitlines()[-1][:160]}")
        return None

    vtt = next(iter(out_dir.glob(f"{video_id}*.vtt")), None)
    if vtt is None:
        print(f"  ! {video_id}: no subtitles published")
        return None

    text = vtt_to_text(vtt.read_text(encoding="utf-8", errors="ignore"))
    txt = out_dir / f"{video_id}.txt"
    txt.write_text(text, encoding="utf-8")
    vtt.unlink(missing_ok=True)
    return txt


def vtt_to_text(vtt: str) -> str:
    """Strip WebVTT timing and the duplicate lines auto-captions produce."""
    lines: list[str] = []
    for raw in vtt.splitlines():
        line = raw.strip()
        if (not line or line.startswith(("WEBVTT", "Kind:", "Language:", "NOTE"))
                or "-->" in line or line.isdigit()):
            continue
        line = re.sub(r"<[^>]+>", "", line)
        if not line:
            continue
        if lines and lines[-1] == line:
            continue
        lines.append(line)

    # Auto-captions repeat a rolling window; collapse the overlap.
    deduped: list[str] = []
    for line in lines:
        if deduped and (line in deduped[-1] or deduped[-1] in line):
            if len(line) > len(deduped[-1]):
                deduped[-1] = line
            continue
        deduped.append(line)
    return " ".join(deduped)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--channel", default="@DaytradeWarrior")
    ap.add_argument("--urls", help="file with one video URL or id per line")
    ap.add_argument("--limit", type=int, default=25)
    ap.add_argument("--lang", default="en")
    ap.add_argument("--out", default="data/transcripts")
    args = ap.parse_args()

    _check_reachable()
    out_dir = Path(args.out)

    if args.urls:
        ids = []
        for line in Path(args.urls).read_text().splitlines():
            line = line.strip()
            if not line:
                continue
            m = re.search(r"(?:v=|youtu\.be/|shorts/)([\w-]{11})", line)
            ids.append({"id": m.group(1) if m else line, "title": "", "duration": None})
        videos = ids
    else:
        print(f"Listing up to {args.limit} videos from {args.channel} ...")
        videos = list_videos(args.channel, args.limit)

    print(f"{len(videos)} videos. Fetching transcripts into {out_dir}/ ...")
    rows = []
    for i, v in enumerate(videos, 1):
        print(f"  [{i}/{len(videos)}] {v['id']}  {v['title'][:70]}")
        path = fetch_transcript(v["id"], out_dir, args.lang)
        rows.append({**v, "transcript": str(path) if path else ""})

    index = out_dir / "index.csv"
    with index.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=["id", "title", "duration", "transcript"])
        w.writeheader()
        w.writerows(rows)

    got = sum(1 for r in rows if r["transcript"])
    print(f"\n{got}/{len(rows)} transcripts saved. Index: {index}")


if __name__ == "__main__":
    main()
