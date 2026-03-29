"""
Twitch Gaming OCR Username Extraction Pipeline
===============================================
Downloads VODs and/or clips from a Twitch channel or a single VOD/clip URL,
extracts frames efficiently, runs EasyOCR, and stores detected usernames with
timestamps in Firestore (production) or a local results.json (local dev).

Usage:
    python pipeline.py ninja
    python pipeline.py https://www.twitch.tv/ninja
    python pipeline.py https://www.twitch.tv/videos/2345678901
    python pipeline.py https://clips.twitch.tv/SomeClipSlug
"""

import os
import argparse
import re
import cv2
import json
import logging
import threading
import numpy as np
import easyocr
import yt_dlp
import torch
import requests
from pathlib import Path
from collections import defaultdict, deque
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, Generator, List, Optional, Tuple
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

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
FRAME_SAMPLE_SEC     = 3          # Sample 1 frame every N seconds
ADAPTIVE_SKIP_THRESH = 5.0        # Mean pixel delta to consider frame "static"
OCR_CONF_MIN         = 0.7        # Drop detections below this confidence
OCR_TEXT_MIN_LEN     = 3          # Drop texts shorter than this (after normalize)
RECENT_CACHE_SIZE    = 20         # Deduplicate across this many consecutive frames
CHECKPOINT_FILE      = "results.json"   # Used in JSON mode only
DOWNLOAD_DIR         = Path("downloads")
MAX_DL_WORKERS       = 4          # Parallel download threads
CONTENT_TYPE         = "vods"     # "vods", "clips", or "all"
FETCH_LIMIT          = None       # Max VODs/clips to fetch per type
MAX_DURATION_SEC     = None       # Skip VODs longer than this (None = no limit)

FIRESTORE_ENABLED = True

TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token"
TWITCH_API_BASE  = "https://api.twitch.tv/helix"


# ─────────────────────────────────────────────────────────────────────────────
# Duration utilities
# ─────────────────────────────────────────────────────────────────────────────
_DURATION_RE = re.compile(r"(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?")


def parse_duration(s: str) -> int:
    """
    Parse a human-readable duration string to seconds.
    Accepts user input (5h, 30m, 1h30m) and Twitch API format (3h25m31s).
    Returns 0 for unrecognized input.
    """
    m = _DURATION_RE.fullmatch(s.strip())
    if not m or not any(m.groups()):
        raise ValueError(f"Unrecognized duration format: '{s}' — use e.g. 5h, 30m, 1h30m")
    h, mn, sec = (int(x) if x else 0 for x in m.groups())
    return h * 3600 + mn * 60 + sec


# ─────────────────────────────────────────────────────────────────────────────
# Firestore client (only initialized when FIRESTORE_ENABLED)
# ─────────────────────────────────────────────────────────────────────────────
_db = None

if FIRESTORE_ENABLED:
    from google.cloud import firestore as _firestore
    _db = _firestore.Client()
    log.info("Firestore client initialized.")
else:
    log.info("Firestore disabled — using local JSON checkpoint.")


# ─────────────────────────────────────────────────────────────────────────────
# Global OCR Reader — initialized ONCE, reused for every frame
# ─────────────────────────────────────────────────────────────────────────────
_USE_GPU = torch.cuda.is_available()
log.info(f"Initializing EasyOCR reader (GPU={'yes' if _USE_GPU else 'no'}) ...")
OCR_READER = easyocr.Reader(["en"], gpu=_USE_GPU, verbose=False)
log.info("EasyOCR ready.")


# ─────────────────────────────────────────────────────────────────────────────
# JSON mode: shared results store  (inverted index + thread lock)
# ─────────────────────────────────────────────────────────────────────────────
_results: Dict[str, List[Dict]] = defaultdict(list)
_results_lock = threading.Lock()


# ─────────────────────────────────────────────────────────────────────────────
# 1.  Twitch API Utilities
# ─────────────────────────────────────────────────────────────────────────────

def _get_app_token() -> str:
    """Fetch a Client Credentials app access token from Twitch."""
    client_id     = os.environ["TWITCH_CLIENT_ID"]
    client_secret = os.environ["TWITCH_CLIENT_SECRET"]
    resp = requests.post(TWITCH_TOKEN_URL, params={
        "client_id":     client_id,
        "client_secret": client_secret,
        "grant_type":    "client_credentials",
    }, timeout=10)
    resp.raise_for_status()
    token = resp.json()["access_token"]
    log.info("Twitch app access token obtained.")
    return token


def _twitch_headers(token: str) -> dict:
    return {
        "Client-ID":     os.environ["TWITCH_CLIENT_ID"],
        "Authorization": f"Bearer {token}",
    }


def _get_user_id(channel: str, token: str) -> Optional[str]:
    """Resolve a Twitch channel login name to its numeric user ID."""
    resp = requests.get(
        f"{TWITCH_API_BASE}/users",
        headers=_twitch_headers(token),
        params={"login": channel},
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json().get("data", [])
    if not data:
        log.error(f"Channel not found on Twitch: {channel}")
        return None
    user_id = data[0]["id"]
    log.info(f"Resolved '{channel}' → user_id={user_id}")
    return user_id


def _fetch_vods(user_id: str, token: str, limit: Optional[int], processed_ids: set) -> List[Dict]:
    """Fetch archived VODs for a channel via the Helix API."""
    videos = []
    cursor = None
    while limit is None or len(videos) < limit:
        first = 100 if limit is None else min(100, limit - len(videos))
        params: dict = {"user_id": user_id, "type": "archive", "first": first}
        if cursor:
            params["after"] = cursor
        resp = requests.get(
            f"{TWITCH_API_BASE}/videos",
            headers=_twitch_headers(token),
            params=params,
            timeout=10,
        )
        resp.raise_for_status()
        body = resp.json()
        for v in body.get("data", []):
            vid_id = v["id"]
            if vid_id in processed_ids:
                continue
            if MAX_DURATION_SEC is not None:
                try:
                    vod_sec = parse_duration(v.get("duration", "0s"))
                except ValueError:
                    vod_sec = 0
                if vod_sec > MAX_DURATION_SEC:
                    log.info(f"  [SKIP] {vid_id} '{v.get('title', '')}' — duration {v.get('duration')} exceeds limit")
                    continue
            videos.append({
                "id":    vid_id,
                "url":   f"https://www.twitch.tv/videos/{vid_id}",
                "title": v.get("title", "unknown"),
                "kind":  "vod",
            })
        cursor = body.get("pagination", {}).get("cursor")
        if not cursor or not body.get("data"):
            break
    log.info(f"Found {len(videos)} unprocessed VOD(s).")
    return videos if limit is None else videos[:limit]


def _fetch_clips(user_id: str, token: str, limit: Optional[int], processed_ids: set) -> List[Dict]:
    """Fetch clips for a channel via the Helix API."""
    clips = []
    cursor = None
    while limit is None or len(clips) < limit:
        first = 100 if limit is None else min(100, limit - len(clips))
        params: dict = {"broadcaster_id": user_id, "first": first}
        if cursor:
            params["after"] = cursor
        resp = requests.get(
            f"{TWITCH_API_BASE}/clips",
            headers=_twitch_headers(token),
            params=params,
            timeout=10,
        )
        resp.raise_for_status()
        body = resp.json()
        for c in body.get("data", []):
            clip_id = c["id"]
            if clip_id not in processed_ids:
                clips.append({
                    "id":    clip_id,
                    "url":   f"https://clips.twitch.tv/{clip_id}",
                    "title": c.get("title", "unknown"),
                    "kind":  "clip",
                })
        cursor = body.get("pagination", {}).get("cursor")
        if not cursor or not body.get("data"):
            break
    log.info(f"Found {len(clips)} unprocessed clip(s).")
    return clips if limit is None else clips[:limit]


_VOD_RE  = re.compile(r"twitch\.tv/videos/(\d+)")
_CLIP_RE = re.compile(r"clips\.twitch\.tv/([\w-]+)|twitch\.tv/\w+/clip/([\w-]+)")
_CHAN_RE  = re.compile(r"twitch\.tv/([a-zA-Z0-9_]+)$")


def get_content_urls(target: str, processed_ids: set) -> List[Dict]:
    """
    Accept any of:
      - A single VOD URL:   https://www.twitch.tv/videos/12345
      - A clip URL:         https://clips.twitch.tv/SomeSlug
      - A channel URL:      https://www.twitch.tv/channelname
      - A bare channel name: channelname
    """
    token = _get_app_token()

    m = _VOD_RE.search(target)
    if m:
        vid_id = m.group(1)
        if vid_id in processed_ids:
            log.info(f"VOD {vid_id} already processed — skipping.")
            return []
        return [{"id": vid_id, "url": f"https://www.twitch.tv/videos/{vid_id}",
                 "title": vid_id, "kind": "vod"}]

    m = _CLIP_RE.search(target)
    if m:
        clip_id = m.group(1) or m.group(2)
        if clip_id in processed_ids:
            log.info(f"Clip {clip_id} already processed — skipping.")
            return []
        return [{"id": clip_id, "url": f"https://clips.twitch.tv/{clip_id}",
                 "title": clip_id, "kind": "clip"}]

    m = _CHAN_RE.search(target)
    channel = m.group(1) if m else target.strip().lstrip("@")

    log.info(f"Fetching content for channel: {channel} (type={CONTENT_TYPE})")
    user_id = _get_user_id(channel, token)
    if not user_id:
        return []

    videos: List[Dict] = []
    if CONTENT_TYPE in ("vods", "all"):
        videos += _fetch_vods(user_id, token, FETCH_LIMIT, processed_ids)
    if CONTENT_TYPE in ("clips", "all"):
        videos += _fetch_clips(user_id, token, FETCH_LIMIT, processed_ids)

    return videos


# ─────────────────────────────────────────────────────────────────────────────
# 2.  Download
# ─────────────────────────────────────────────────────────────────────────────

def download_video(video: Dict, output_dir: Path) -> Optional[Path]:
    """Download a single Twitch VOD or clip at max 720p as mp4 using yt-dlp."""
    output_dir.mkdir(parents=True, exist_ok=True)
    out_template = str(output_dir / f"{video['id']}.%(ext)s")

    ydl_opts = {
        "format": (
            "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]"
            "/bestvideo[height<=720]+bestaudio"
            "/best[height<=720]"
        ),
        "outtmpl":             out_template,
        "merge_output_format": "mp4",
        "quiet":               True,
        "ignoreerrors":        False,
        "postprocessors": [{"key": "FFmpegVideoConvertor", "preferedformat": "mp4"}],
    }

    try:
        log.info(f"[{video['id']}] Downloading {video['kind']}: {video['title']}")
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([video["url"]])

        mp4 = output_dir / f"{video['id']}.mp4"
        if mp4.exists():
            log.info(f"[{video['id']}] Saved to {mp4}")
            return mp4
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
# 3.  Frame Extraction
# ─────────────────────────────────────────────────────────────────────────────

def extract_frames(
    video_path: Path,
) -> Generator[Tuple[float, np.ndarray], None, None]:
    """
    Memory-efficient frame sampler.  Yields (timestamp_sec, bgr_frame).

    cap.grab() advances the decode head without decoding — much faster than
    cap.read() for frames we intend to discard.

    Adaptive skip discards static scenes (cutscenes, pause screens, etc.)
    before OCR runs.
    """
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        log.error(f"Cannot open: {video_path}")
        return

    fps            = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames   = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    frame_interval = max(1, int(fps * FRAME_SAMPLE_SEC))

    log.info(
        f"  {video_path.name}: {fps:.1f} fps | {total_frames} frames | "
        f"sampling every {frame_interval} frames (~{FRAME_SAMPLE_SEC}s)"
    )

    prev_gray:      Optional[np.ndarray] = None
    frame_idx:      int  = 0
    yielded:        int  = 0
    skipped_static: int  = 0

    while True:
        if frame_idx % frame_interval != 0:
            if not cap.grab():
                break
            frame_idx += 1
            continue

        ret, frame = cap.read()
        if not ret:
            break

        timestamp = frame_idx / fps

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        if prev_gray is not None:
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
# 4.  OCR
# ─────────────────────────────────────────────────────────────────────────────

def run_ocr(frame: np.ndarray) -> List[Tuple[list, str, float]]:
    """Run EasyOCR on specified regions. Returns [(bbox, text, confidence), ...]."""
    h, w = frame.shape[:2]
    
    regions = [
        # Kill feed (top right)
        (int(h*0.05), int(h*0.35), int(w*0.78), w),
        # Tab scoreboard (center)
        (int(h*0.25), int(h*0.72), int(w*0.27), int(w*0.73)),
        # Bottom HUD (bottom left)
        (int(h*0.83), h, 0, int(w*0.23))
    ]
    
    all_detections = []
    for y1, y2, x1, x2 in regions:
        crop = frame[y1:y2, x1:x2]
        if crop.size > 0:
            detections = OCR_READER.readtext(crop)
            all_detections.extend(detections)
            
    return all_detections


# ─────────────────────────────────────────────────────────────────────────────
# 5.  Text Normalization & Filtering
# ─────────────────────────────────────────────────────────────────────────────

_NON_ALNUM = re.compile(r"[^a-z0-9]")


def normalize(text: str) -> str:
    return _NON_ALNUM.sub("", text.lower())


def is_valid(raw_text: str, confidence: float) -> bool:
    return confidence >= OCR_CONF_MIN and len(raw_text) >= OCR_TEXT_MIN_LEN


VALORANT_UI_EXACT = {
    "ally", "enemy", "spike", "defused", "planting", "planted",
    "eliminated", "killed", "assists", "deaths", "score",
    "round", "rounds", "won", "lost", "victory", "defeat",
    "attackers", "defenders", "attack", "defense",
    "buy", "save", "bonus", "eco", "pistol", "shield", "credits",
    "light", "heavy", "full",
    "jett", "reyna", "sage", "omen", "brimstone", "phoenix",
    "sova", "cypher", "killjoy", "breach", "raze", "viper",
    "astra", "yoru", "skye", "kayo", "chamber", "neon",
    "fade", "harbor", "gekko", "deadlock", "iso", "clove", "vyse", "tejo", "waylay",
    "dismiss", "devour", "updraft", "tailwind", "cloudburst",
    "paranoia", "resurrection", "healing", "blind", "flash",
    "smoke", "wall", "ultimate", "ability",
    "settings", "play", "collection", "battlepass", "store",
    "career", "agents", "maps", "competitive", "unrated",
    "deathmatch", "escalation", "replication", "swiftplay",
    "premier", "custom", "practice",
    "bind", "haven", "split", "ascent", "icebox", "breeze",
    "fracture", "pearl", "lotus", "sunset", "abyss",
    "valorant", "riot", "games", "guides", "subscribe",
    "like", "comment", "share", "youtube", "twitch",
    "stream", "live", "chat", "follow", "channel",
    "video", "watch", "clip", "highlight", "montage",
    "best", "moments", "gameplay", "ranked", "immortal",
    "radiant", "diamond", "platinum", "gold", "silver",
    "bronze", "iron", "ascendant",
}

VALORANT_UI_COMPOUND = {
    "allyplanting", "allyeliminated", "allydefusing",
    "enemyplanting", "enemyeliminated", "enemydefusing",
    "spikeplanted", "spikedefused", "spikerush",
    "roundwon", "roundlost", "roundwin", "roundloss",
    "matchpoint", "matchmvp", "teammvp",
    "flawlessvictory", "thriftywin", "acewin",
    "clutchwin", "overtimewin",
    "valorantguides", "valorantgameplay", "valorantranked",
    "valoranthighlights", "valorantmoments", "valorantclips",
    "trackyourhs", "trackyourstats",
    "likeandsubscribe", "subscribeformore", "hitthebell",
    "leaveacomment", "linkinbio", "inlink", "linkbelow",
    "joinmydiscord", "followmytwitch", "checkouttiktok",
    "soundtrack", "musicby", "editedby", "recordedby",
    "fullvideo", "watchmore", "nextgame", "lastgame",
    "headshot", "bodyshot", "firstblood", "onetap",
    "ready", "notready", "gameready",
}

COMMON_SHORT = {
    "the", "and", "for", "are", "but", "not", "you", "all",
    "can", "her", "was", "one", "our", "out", "has", "have",
    "this", "that", "with", "from", "they", "been", "will",
    "more", "when", "some", "them", "than", "its", "over",
    "just", "also", "into", "back", "only", "come", "made",
    "after", "most", "game", "team", "time", "next", "last",
    "new", "now", "way", "may", "day", "too", "any", "good",
    "how", "man", "did", "get", "got", "let", "say", "top",
    "off", "end", "set", "try", "big", "use", "put", "old",
    "run", "win", "hit", "low", "cut", "hot", "red", "yes",
    "yet", "ago", "far", "few", "per",
}

_USERNAME_MIN = 3
_USERNAME_MAX = 16
_TAG_RE = re.compile(r"#[a-z0-9]+$")


def looks_like_username(raw_text: str, norm_text: str) -> bool:
    base = _TAG_RE.sub("", norm_text)

    if not (_USERNAME_MIN <= len(base) <= _USERNAME_MAX):
        log.debug("  [SKIP username] length out of range: '%s'", raw_text)
        return False

    if not any(c.isalpha() for c in base):
        log.debug("  [SKIP username] no letters: '%s'", raw_text)
        return False

    if base in VALORANT_UI_EXACT or base in VALORANT_UI_COMPOUND:
        log.debug("  [SKIP username] UI word match: '%s'", raw_text)
        return False

    if len(base) <= 4 and base in COMMON_SHORT:
        log.debug("  [SKIP username] common short word: '%s'", raw_text)
        return False

    return True


# ─────────────────────────────────────────────────────────────────────────────
# 6.  Firestore Storage
# ─────────────────────────────────────────────────────────────────────────────

def get_processed_ids() -> set:
    """Query Firestore for all previously processed video IDs."""
    docs = _db.collection("processed_videos").stream()
    ids = {doc.id for doc in docs}
    log.info(f"Firestore: {len(ids)} previously processed video(s).")
    return ids


def save_to_firestore(local: Dict[str, List[Dict]], video_id: str) -> int:
    """
    Batch-write all OCR hits for a video to the sightings collection.
    Chunks into batches of 500 to stay within Firestore's per-batch limit.
    Returns the number of documents written.
    """
    from google.cloud import firestore as _fs

    all_docs = []
    for norm, detections in local.items():
        for d in detections:
            all_docs.append({
                "username_normalized": norm,
                "raw_text":            d["raw_text"],
                "video_id":            video_id,
                "timestamp":           d["timestamp"],
                "confidence":          d["confidence"],
                "created_at":          _fs.SERVER_TIMESTAMP,
            })

    for i in range(0, len(all_docs), 500):
        batch = _db.batch()
        for doc_data in all_docs[i:i + 500]:
            ref = _db.collection("sightings").document()
            batch.set(ref, doc_data)
        batch.commit()

    log.info(f"[{video_id}] Wrote {len(all_docs)} sighting(s) to Firestore.")
    return len(all_docs)


def mark_video_processed(video_id: str, hit_count: int) -> None:
    """Record a video as fully processed in the processed_videos collection."""
    from google.cloud import firestore as _fs

    _db.collection("processed_videos").document(video_id).set({
        "video_id":       video_id,
        "processed_at":   _fs.SERVER_TIMESTAMP,
        "hit_count":      hit_count,
    })
    log.info(f"[{video_id}] Marked as processed in Firestore (hits={hit_count}).")


# ─────────────────────────────────────────────────────────────────────────────
# 7.  JSON Storage (local dev fallback)
# ─────────────────────────────────────────────────────────────────────────────

def merge_results(local: Dict[str, List[Dict]]) -> None:
    with _results_lock:
        for norm_text, detections in local.items():
            _results[norm_text].extend(detections)


def save_results(filepath: str = CHECKPOINT_FILE) -> None:
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
# 8.  Per-Video Processing
# ─────────────────────────────────────────────────────────────────────────────

def process_video(filepath: Path, video_id: str) -> Dict[str, List[Dict]]:
    """
    Full OCR pass over a single video file.
    Returns a local inverted-index dict for merging/logging.
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
            if not is_valid(raw_text, confidence):
                continue

            norm = normalize(raw_text)
            if len(norm) < OCR_TEXT_MIN_LEN:
                continue

            if not looks_like_username(raw_text, norm):
                continue

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
# 9.  Main Pipeline
# ─────────────────────────────────────────────────────────────────────────────

def run_pipeline(target: str) -> Dict[str, List[Dict]]:
    """
    End-to-end pipeline:

      1. Resume from checkpoint (Firestore or local JSON)
      2. Fetch VOD/clip list from Twitch API (or parse single URL)
      3. Download in parallel (ThreadPoolExecutor, MAX_DL_WORKERS)
      4. Process each downloaded file: extract frames → OCR → filter → dedup
      5. Persist results (Firestore or local JSON)
      6. Delete the local file after processing to save disk space
    """
    DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)

    processed_ids = get_processed_ids() if FIRESTORE_ENABLED else load_checkpoint()

    videos = get_content_urls(target, processed_ids)
    if not videos:
        log.info("Nothing new to process.")
        return dict(_results)

    log.info(f"Pipeline starting: {len(videos)} item(s) queued.")

    with ThreadPoolExecutor(max_workers=MAX_DL_WORKERS) as pool:
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

                local = process_video(filepath, vid_id)

                if FIRESTORE_ENABLED:
                    hit_count = save_to_firestore(local, vid_id)
                    mark_video_processed(vid_id, hit_count)
                else:
                    merge_results(local)
                    processed_ids.add(vid_id)
                    save_results()

            except Exception as exc:
                log.error(f"[{vid_id}] Unhandled error: {exc}", exc_info=True)

            finally:
                if filepath and Path(filepath).exists():
                    Path(filepath).unlink()
                    log.info(f"[{vid_id}] Deleted local file: {filepath}")

    log.info("Pipeline complete.")
    if not FIRESTORE_ENABLED:
        save_results()
    return dict(_results)

# ─────────────────────────────────────────────────────────────────────────────
# 10. CLI Entry Point
# ─────────────────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Twitch Gaming OCR Username Extractor (Local)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  python pipeline_and_cli_local.py ninja
  python pipeline_and_cli_local.py https://www.twitch.tv/ninja --type vods
        ''',
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
        default=CONTENT_TYPE,
        help="What to fetch for a channel (default: vods)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=FETCH_LIMIT,
        help="Max VODs/clips to fetch per type (default: fetch all if None)",
    )
    parser.add_argument(
        "--max-duration",
        default=None,
        metavar="DURATION",
        help="Skip VODs longer than this (e.g. 5h, 30m, 1h30m). No limit by default.",
    )
    parser.add_argument(
        "--sample-sec",
        type=float,
        default=FRAME_SAMPLE_SEC,
        help=f"Seconds between sampled frames (default: {FRAME_SAMPLE_SEC})",
    )
    parser.add_argument(
        "--checkpoint",
        default=CHECKPOINT_FILE,
        help=f"Path to results JSON checkpoint (default: {CHECKPOINT_FILE})",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    global CONTENT_TYPE, FETCH_LIMIT, FRAME_SAMPLE_SEC, CHECKPOINT_FILE, MAX_DURATION_SEC
    CONTENT_TYPE     = args.content_type
    FETCH_LIMIT      = args.limit
    FRAME_SAMPLE_SEC = args.sample_sec
    CHECKPOINT_FILE  = args.checkpoint

    if args.max_duration is not None:
        MAX_DURATION_SEC = parse_duration(args.max_duration)

    targets = args.target
    target = next((t for t in targets if "twitch.tv" in t or "://" in t), targets[-1])

    results = run_pipeline(target)

    print(f"\nFinished. {len(results)} unique terms detected.")


if __name__ == "__main__":
    main()
