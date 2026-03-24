"""
Entry point for the YouTube Gaming OCR Username Extraction Pipeline.

Usage:
    python main.py https://www.youtube.com/watch?v=VIDEO_ID
    python main.py https://www.youtube.com/@SomeGamer/videos
    python main.py https://www.youtube.com/@SomeGamer/videos --sample-sec 5
    python main.py https://www.youtube.com/watch?v=VIDEO_ID --checkpoint my_run.json
"""

import argparse
import pipeline


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="YouTube Gaming OCR Username Extractor",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python main.py https://www.youtube.com/watch?v=VIDEO_ID
  python main.py https://www.youtube.com/@SomeGamer/videos
  python main.py https://www.youtube.com/@SomeGamer/videos --sample-sec 5
  python main.py https://www.youtube.com/watch?v=VIDEO_ID --checkpoint my_run.json
        """,
    )
    parser.add_argument(
        "url",
        help="Single video URL or YouTube channel/playlist URL",
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

    # Apply CLI overrides to pipeline config before the pipeline runs
    pipeline.FRAME_SAMPLE_SEC = args.sample_sec
    pipeline.CHECKPOINT_FILE  = args.checkpoint

    results = pipeline.run_pipeline(args.url)

    print(f"\nFinished. {len(results)} unique terms detected across all videos.")
    print(f"Results saved to: {pipeline.CHECKPOINT_FILE}")


if __name__ == "__main__":
    main()
