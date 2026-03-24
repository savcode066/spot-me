"""
Entry point for the YouTube Gaming OCR Username Extraction Pipeline.

Usage (local):
    python main.py https://www.youtube.com/watch?v=VIDEO_ID
    python main.py https://www.youtube.com/@SomeGamer/videos --sample-sec 5

Usage (Cloud Run Job):
    Set COOKIES_SECRET env var to your Secret Manager resource name:
      projects/YOUR_PROJECT/secrets/yt-cookies/versions/latest
"""

import argparse
import logging
import os
from pathlib import Path

import pipeline

log = logging.getLogger(__name__)


def fetch_cookies_from_secret_manager(secret_resource_name: str) -> Path:
    from google.cloud import secretmanager

    log.info(f"Fetching cookies from Secret Manager: {secret_resource_name}")
    client = secretmanager.SecretManagerServiceClient()

    try:
        response = client.access_secret_version(request={"name": secret_resource_name})
    except Exception as exc:
        log.error(f"Secret Manager request failed: {exc}")
        raise

    payload_size = len(response.payload.data)
    log.info(f"Secret retrieved successfully ({payload_size} bytes)")

    cookies_path = Path("/tmp/cookies.txt")
    cookies_path.write_bytes(response.payload.data)

    line_count = cookies_path.read_text().count("\n")
    log.info(f"cookies.txt written to {cookies_path} ({line_count} lines)")

    return cookies_path


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

    pipeline.FRAME_SAMPLE_SEC = args.sample_sec
    pipeline.CHECKPOINT_FILE  = args.checkpoint

    secret = os.environ.get("COOKIES_SECRET")
    if secret:
        pipeline.COOKIES_FILE = fetch_cookies_from_secret_manager(secret)
    elif pipeline.COOKIES_FILE.exists():
        log.info(f"Using local cookies file: {pipeline.COOKIES_FILE}")
    else:
        log.warning("No cookies found — only public videos will be accessible.")

    results = pipeline.run_pipeline(args.url)

    print(f"\nFinished. {len(results)} unique terms detected across all videos.")
    print(f"Results saved to: {pipeline.CHECKPOINT_FILE}")


if __name__ == "__main__":
    main()
