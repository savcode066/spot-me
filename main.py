"""
Entry point for the YouTube Gaming OCR Username Extraction Pipeline.

Usage (local):
    python main.py https://www.youtube.com/watch?v=VIDEO_ID
    python main.py https://www.youtube.com/@SomeGamer/videos --sample-sec 5

Usage (Cloud Run Job):
    Set COOKIES_SECRET env var to your Secret Manager resource name:
      projects/YOUR_PROJECT/secrets/yt-cookies/versions/latest
    The secret payload must be the contents of a valid cookies.txt file.
"""

import argparse
import logging
import os
from pathlib import Path

import pipeline

log = logging.getLogger(__name__)


def fetch_cookies_from_secret_manager(secret_resource_name: str) -> Path:
    """
    Pull cookies.txt content from GCP Secret Manager and write it to
    /tmp/cookies.txt so yt-dlp can use it.

    The secret value should be the full text of a Netscape-format cookies.txt.
    To create it:
        gcloud secrets create yt-cookies --data-file=cookies.txt
    To update it later:
        gcloud secrets versions add yt-cookies --data-file=cookies.txt
    """
    from google.cloud import secretmanager  # only imported when needed

    log.info(f"Fetching cookies from Secret Manager: {secret_resource_name}")
    client = secretmanager.SecretManagerServiceClient()
    response = client.access_secret_version(request={"name": secret_resource_name})

    cookies_path = Path("/tmp/cookies.txt")
    cookies_path.write_bytes(response.payload.data)
    log.info(f"Cookies written to {cookies_path}")
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

    # ── Cookies resolution (priority order) ───────────────────────────────
    # 1. COOKIES_SECRET env var → fetch from Secret Manager (Cloud Run)
    # 2. Local cookies.txt file → use directly (local dev)
    # 3. Neither → proceed without cookies (public videos only)
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
