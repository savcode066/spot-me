"""
Entry point for the Twitch Gaming OCR Username Extraction Pipeline (CLI).

Usage:
    python cli.py ninja
    python cli.py https://www.twitch.tv/ninja
    python cli.py https://www.twitch.tv/ninja --type clips
    python cli.py https://www.twitch.tv/ninja --type all --limit 50
    python cli.py https://www.twitch.tv/videos/2345678901
    python cli.py https://clips.twitch.tv/SomeClipSlug
"""

import argparse
import logging

import pipeline

log = logging.getLogger(__name__)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Twitch Gaming OCR Username Extractor",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python cli.py ninja
  python cli.py https://www.twitch.tv/ninja --type vods
  python cli.py https://www.twitch.tv/ninja --type clips --limit 50
  python cli.py https://www.twitch.tv/ninja --type all
  python cli.py https://www.twitch.tv/videos/2345678901
  python cli.py https://clips.twitch.tv/SomeClipSlug
        """,
    )
    parser.add_argument(
        "target",
        nargs="+",
        help="Channel name, channel URL, single VOD URL, or clip URL",
    )
    parser.add_argument(
        "--type",
        dest="content_type",
        choices=["vods", "clips", "all"],
        default=pipeline.CONTENT_TYPE,
        help="What to fetch for a channel (default: vods)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=pipeline.FETCH_LIMIT,
        help=f"Max VODs/clips to fetch per type (default: {pipeline.FETCH_LIMIT})",
    )
    parser.add_argument(
        "--sample-sec",
        type=float,
        default=pipeline.FRAME_SAMPLE_SEC,
        help=f"Seconds between sampled frames (default: {pipeline.FRAME_SAMPLE_SEC})",
    )
    parser.add_argument(
        "--checkpoint",
        default=pipeline.CHECKPOINT_FILE,
        help=f"Path to results JSON checkpoint (default: {pipeline.CHECKPOINT_FILE})",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    pipeline.CONTENT_TYPE    = args.content_type
    pipeline.FETCH_LIMIT     = args.limit
    pipeline.FRAME_SAMPLE_SEC = args.sample_sec
    pipeline.CHECKPOINT_FILE  = args.checkpoint

    # If multiple positionals were passed (e.g. a stale Cloud Run Job arg + a URL),
    # prefer whichever value looks like a URL; fall back to the last value.
    targets = args.target
    target = next((t for t in targets if "twitch.tv" in t or "://" in t), targets[-1])

    results = pipeline.run_pipeline(target)

    print(f"\nFinished. {len(results)} unique terms detected.")


if __name__ == "__main__":
    main()
