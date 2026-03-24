"""
YouTube Gaming OCR Username Extraction Pipeline
================================================
Downloads videos from a YouTube channel or single video URL, extracts frames
efficiently, runs EasyOCR, and stores detected usernames with timestamps in
an inverted-index JSON store.

Usage:
    python pipeline.py https://www.youtube.com/@SomeGamer/videos
    python pipeline.py https://www.youtube.com/watch?v=VIDEO_ID
"""

import os
import re
import cv2
import json
import logging
import threading
import numpy as np
import easyocr
import yt_dlp
import torch
from pathlib import Path
from collections import defaultdict, deque
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, Generator, List, Optional, Tuple

# ─────────────────────────────────────────────────────────────────────────────
# Logging
# ─────────────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────────────────────────────────────
FRAME_SAMPLE_SEC      = 3          # Sample 1 frame every N seconds
ADAPTIVE_SKIP_THRESH  = 5.0        # Mean pixel delta to consider frame "static"
OCR_CONF_MIN          = 0.7        # Drop detections below this confidence
OCR_TEXT_MIN_LEN      = 3          # Drop texts shorter than this (after normalize)
RECENT_CACHE_SIZE     = 20         # Deduplicate across this many consecutive frames
CHECKPOINT_FILE       = "results.json"
DOWNLOAD_DIR          = Path("downloads")
MAX_DL_WORKERS        = 4          # Parallel download threads


# ─────────────────────────────────────────────────────────────────────────────
# Global OCR Reader — initialized ONCE, reused for every frame
# ─────────────────────────────────────────────────────────────────────────────
_USE_GPU = torch.cuda.is_available()
log.info(f"Initializing EasyOCR reader (GPU={'yes' if _USE_GPU else 'no'}) ...")
OCR_READER = easyocr.Reader(["en"], gpu=_USE_GPU, verbose=False)
log.info("EasyOCR ready.")


# ─────────────────────────────────────────────────────────────────────────────
# Shared Results Store  (inverted index + thread lock)
# ─────────────────────────────────────────────────────────────────────────────
# Structure: { normalized_text: [ {video_id, timestamp, confidence, raw_text} ] }
_results: Dict[str, List[Dict]] = defaultdict(list)
_results_lock = threading.Lock()


# ─────────────────────────────────────────────────────────────────────────────
# 1.  YouTube Utilities
# ─────────────────────────────────────────────────────────────────────────────

def get_video_urls(url: str, processed_ids: set) -> List[Dict]:
    """
    Accept either a single video URL or a channel/playlist URL.

    Single video  → yt-dlp returns info dict directly (no 'entries' key).
    Channel/playlist → yt-dlp returns a dict with an 'entries' list.

    extract_flat=True fetches only metadata for playlist/channel entries
    so we don't trigger unnecessary downloads.
    """
    log.info(f"Fetching video list from: {url}")
    ydl_opts = {
        "quiet": True,
        "extract_flat": True,
        "ignoreerrors": True,
    }
    videos = []
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)
        if not info:
            log.error("yt-dlp returned nothing — check the URL.")
            return videos

        entries = info.get("entries")

        if entries is None:
            # ── Single video URL ───────────────────────────────────────────
            vid_id = info.get("id")
            if vid_id and vid_id not in processed_ids:
                videos.append({
                    "id":    vid_id,
                    "url":   f"https://www.youtube.com/watch?v={vid_id}",
                    "title": info.get("title", "unknown"),
                })
        else:
            # ── Channel / playlist ─────────────────────────────────────────
            for entry in entries:
                if not entry:
                    continue
                vid_id = entry.get("id")
                if vid_id and vid_id not in processed_ids:
                    videos.append({
                        "id":    vid_id,
                        "url":   f"https://www.youtube.com/watch?v={vid_id}",
                        "title": entry.get("title", "unknown"),
                    })

    log.info(f"Found {len(videos)} unprocessed video(s).")
    return videos


def download_video(video: Dict, output_dir: Path) -> Optional[Path]:
    """
    Download a single video at max 720p as mp4.
    Returns the local Path on success, None on failure.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    out_template = str(output_dir / f"{video['id']}.%(ext)s")

    ydl_opts = {
        # Prefer native 720p mp4; fall back to best ≤720p with merge
        "format": (
            "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]"
            "/bestvideo[height<=720]+bestaudio"
            "/best[height<=720]"
        ),
        "outtmpl": out_template,
        "merge_output_format": "mp4",
        "quiet": True,
        "ignoreerrors": False,
        "postprocessors": [{"key": "FFmpegVideoConvertor", "preferedformat": "mp4"}],
    }

    try:
        log.info(f"[{video['id']}] Downloading: {video['title']}")
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([video["url"]])

        # Locate output file (yt-dlp may append codec suffix)
        mp4 = output_dir / f"{video['id']}.mp4"
        if mp4.exists():
            log.info(f"[{video['id']}] Saved to {mp4}")
            return mp4
        # Fallback: find any file with this ID
        matches = list(output_dir.glob(f"{video['id']}.*"))
        if matches:
            log.info(f"[{video['id']}] Saved to {matches[0]}")
            return matches[0]

        log.error(f"[{video['id']}] Downloaded file not found on disk.")
        return None

    except Exception as exc:
        log.error(f"[{video['id']}] Download failed: {exc}")
        return None


# ─────────────────────────────────────────────────────────────────────────────
# 2.  Frame Extraction
# ─────────────────────────────────────────────────────────────────────────────

def extract_frames(
    video_path: Path,
) -> Generator[Tuple[float, np.ndarray], None, None]:
    """
    Memory-efficient frame sampler.  Yields (timestamp_sec, bgr_frame).

    Key optimizations
    -----------------
    cap.grab()  — advances the decode head WITHOUT decoding the frame to RGB.
                  Much faster than cap.read() for frames we intend to discard.
                  We only call cap.retrieve() at sample intervals.

    Adaptive skip — computes mean absolute pixel delta between consecutive
                    sample frames.  If the scene is static (cutscene, pause,
                    loading screen) the frame is discarded before OCR runs.
    """
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        log.error(f"Cannot open: {video_path}")
        return

    fps            = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames   = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    frame_interval = max(1, int(fps * FRAME_SAMPLE_SEC))  # frames between samples

    log.info(
        f"  {video_path.name}: {fps:.1f} fps | {total_frames} frames | "
        f"sampling every {frame_interval} frames (~{FRAME_SAMPLE_SEC}s)"
    )

    prev_gray:      Optional[np.ndarray] = None
    frame_idx:      int  = 0
    yielded:        int  = 0
    skipped_static: int  = 0

    while True:
        # ── Fast-forward to next sample point using grab() ─────────────────
        # Only decode (retrieve) at the target frame index.
        if frame_idx % frame_interval != 0:
            if not cap.grab():
                break
            frame_idx += 1
            continue

        ret, frame = cap.read()
        if not ret:
            break

        timestamp = frame_idx / fps

        # ── Adaptive skip: measure scene change vs. previous sample ────────
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        if prev_gray is not None:
            # int16 cast prevents uint8 wrap-around in subtraction
            diff = np.mean(np.abs(gray.astype(np.int16) - prev_gray.astype(np.int16)))
            if diff < ADAPTIVE_SKIP_THRESH:
                skipped_static += 1
                log.debug(f"  Skipped static frame @ {timestamp:.1f}s (diff={diff:.2f})")
                frame_idx += 1
                continue

        prev_gray = gray
        yielded  += 1
        yield timestamp, frame

        frame_idx += 1

    cap.release()
    log.info(
        f"  Frame scan done: {yielded} yielded, "
        f"{skipped_static} skipped (static scene)."
    )


# ─────────────────────────────────────────────────────────────────────────────
# 3.  OCR
# ─────────────────────────────────────────────────────────────────────────────

def run_ocr(frame: np.ndarray) -> List[Tuple[list, str, float]]:
    """
    Run EasyOCR on the full frame.
    Uses the module-level OCR_READER — never re-initializes per call.
    Returns [(bbox, text, confidence), ...].
    """
    return OCR_READER.readtext(frame)


# ─────────────────────────────────────────────────────────────────────────────
# 4.  Text Normalization & Filtering
# ─────────────────────────────────────────────────────────────────────────────

_NON_ALNUM = re.compile(r"[^a-z0-9]")


def normalize(text: str) -> str:
    """
    Lowercase and strip everything except a-z 0-9.
    'Dragon Slayer!' → 'dragonslayer'
    """
    return _NON_ALNUM.sub("", text.lower())


def is_valid(raw_text: str, confidence: float) -> bool:
    """Gate: confidence threshold + minimum raw text length."""
    return confidence >= OCR_CONF_MIN and len(raw_text) >= OCR_TEXT_MIN_LEN


# ─────────────────────────────────────────────────────────────────────────────
# 5.  Per-Video Processing
# ─────────────────────────────────────────────────────────────────────────────

def process_video(filepath: Path, video_id: str) -> Dict[str, List[Dict]]:
    """
    Full OCR pass over a single video file.
    Returns a local inverted-index dict for merging into the global store.

    Deduplication strategy
    ----------------------
    recent_cache is a fixed-size deque of normalized texts seen in the last
    RECENT_CACHE_SIZE processed frames.  A username that stays on screen
    across many frames is stored only once per "appearance window" rather
    than once per frame — dramatically cuts duplicate records.
    """
    log.info(f"[{video_id}] Starting OCR pass on {filepath.name}")

    local: Dict[str, List[Dict]] = defaultdict(list)
    recent_cache: deque[str]    = deque(maxlen=RECENT_CACHE_SIZE)

    frames_processed = 0
    ocr_hits         = 0

    for timestamp, frame in extract_frames(filepath):
        frames_processed += 1
        detections = run_ocr(frame)

        for _bbox, raw_text, confidence in detections:
            # ── Filter ────────────────────────────────────────────────────
            if not is_valid(raw_text, confidence):
                continue

            norm = normalize(raw_text)
            if len(norm) < OCR_TEXT_MIN_LEN:
                continue   # Normalized form too short (was mostly punctuation)

            # ── Deduplicate within nearby-frame window ────────────────────
            if norm in recent_cache:
                continue

            recent_cache.append(norm)
            ocr_hits += 1

            local[norm].append({
                "video_id":   video_id,
                "timestamp":  int(timestamp),
                "confidence": round(float(confidence), 4),
                "raw_text":   raw_text,
            })

            log.info(
                f"  [HIT] t={int(timestamp):>5}s | "
                f"'{raw_text}' (conf={confidence:.2f}) → '{norm}'"
            )

        # Progress heartbeat every 20 sample-frames
        if frames_processed % 20 == 0:
            log.info(
                f"  [{video_id}] frames={frames_processed} | hits={ocr_hits}"
            )

    log.info(
        f"[{video_id}] Done — "
        f"{frames_processed} frames processed, "
        f"{ocr_hits} OCR hits, "
        f"{len(local)} unique normalized terms."
    )
    return local


# ─────────────────────────────────────────────────────────────────────────────
# 6.  Results Storage
# ─────────────────────────────────────────────────────────────────────────────

def merge_results(local: Dict[str, List[Dict]]) -> None:
    """Thread-safe merge of per-video results into the global store."""
    with _results_lock:
        for norm_text, detections in local.items():
            _results[norm_text].extend(detections)


def save_results(filepath: str = CHECKPOINT_FILE) -> None:
    """
    Atomically snapshot the results dict to JSON.
    Called after every video so a crash never loses more than one video's work.
    """
    with _results_lock:
        snapshot = {k: list(v) for k, v in _results.items()}

    with open(filepath, "w", encoding="utf-8") as fh:
        json.dump(snapshot, fh, indent=2, ensure_ascii=False)

    total = sum(len(v) for v in snapshot.values())
    log.info(
        f"Checkpoint → {filepath} "
        f"({len(snapshot)} unique terms, {total} total detections)"
    )


def load_checkpoint(filepath: str = CHECKPOINT_FILE) -> set:
    """
    Load a previous run's results.json back into the global store.
    Returns the set of video IDs that were already processed so they
    are excluded from the next download batch.
    """
    if not Path(filepath).exists():
        return set()

    with open(filepath, "r", encoding="utf-8") as fh:
        saved: Dict[str, List[Dict]] = json.load(fh)

    with _results_lock:
        for norm_text, detections in saved.items():
            _results[norm_text].extend(detections)

    done_ids = {d["video_id"] for dets in saved.values() for d in dets}
    log.info(
        f"Loaded checkpoint: {len(done_ids)} processed video(s), "
        f"{len(saved)} terms restored."
    )
    return done_ids


# ─────────────────────────────────────────────────────────────────────────────
# 7.  Main Pipeline
# ─────────────────────────────────────────────────────────────────────────────

def run_pipeline(url: str) -> Dict[str, List[Dict]]:
    """
    End-to-end pipeline:

      1. Resume from checkpoint (skip already-done video IDs)
      2. Fetch video list (metadata only, no download yet)
      3. Spin up a ThreadPoolExecutor to download videos in parallel
         (up to MAX_DL_WORKERS concurrent downloads)
      4. As each download finishes, process the video immediately:
           extract frames → OCR → filter → deduplicate → merge
      5. Checkpoint results to disk after every video
      6. Delete the local mp4 immediately after processing to save disk space

    Download parallelism is capped at MAX_DL_WORKERS.  Processing is
    sequential per-video (EasyOCR is not thread-safe) but overlaps with
    downloads of subsequent videos, hiding most of the network latency.
    """
    DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)

    # Resume: restore prior results and skip already-done videos
    processed_ids = load_checkpoint()

    videos = get_video_urls(url, processed_ids)
    if not videos:
        log.info("Nothing new to process.")
        return dict(_results)

    log.info(f"Pipeline starting: {len(videos)} video(s) queued.")

    with ThreadPoolExecutor(max_workers=MAX_DL_WORKERS) as pool:
        # Submit all downloads up-front.
        # The executor queues them internally; at most MAX_DL_WORKERS run at once.
        future_to_video = {
            pool.submit(download_video, vid, DOWNLOAD_DIR): vid
            for vid in videos
        }

        for future in as_completed(future_to_video):
            vid      = future_to_video[future]
            vid_id   = vid["id"]
            filepath = None

            try:
                filepath = future.result()
                if filepath is None:
                    log.warning(f"[{vid_id}] Skipped — download returned None.")
                    continue

                # Process (blocking; EasyOCR is not thread-safe)
                local = process_video(filepath, vid_id)
                merge_results(local)
                processed_ids.add(vid_id)
                save_results()   # Incremental checkpoint

            except Exception as exc:
                log.error(f"[{vid_id}] Unhandled error: {exc}", exc_info=True)

            finally:
                # Always clean up the local file to reclaim disk space
                if filepath and Path(filepath).exists():
                    Path(filepath).unlink()
                    log.info(f"[{vid_id}] Deleted local file: {filepath}")

    log.info("Pipeline complete.")
    save_results()
    return dict(_results)

