"""
Chess.com ↔ YouTube Matchup Pipeline
======================================
Same idea as chess_pipeline.py (Twitch) and kick_pipeline.py (Kick) but
sourcing VODs from YouTube's official, documented Data API v3 instead of
an official or scraped stream API.

Only videos that actually went out over YouTube Live are usable: the
`liveStreamingDetails` part on a video gives `actualStartTime`/
`actualEndTime` — the real broadcast window, with the same precision as
Twitch's created_at+duration and Kick's start_time+duration. A channel
that only posts plain (never-live) uploads — including a delayed
re-upload of an expired Twitch/Kick VOD — has no such field, so those
videos are skipped rather than matched against a guessed window built
from upload time. See arch.md for the deferred idea to solve that case
properly via proactive archival.

chess.com fetching and opponent/timestamp matching are shared with
chess_pipeline.py/kick_pipeline.py via chess_common.py.

Quota: the Data API v3's free tier is 10,000 units/day, resetting at
Pacific midnight. Every call here costs 1 unit (channels.list,
playlistItems.list, videos.list), tracked in-process against
YOUTUBE_QUOTA_DAILY_LIMIT so we fail closed with a clear error instead of
silently hammering the API once the budget's gone. This counter is
best-effort: it resets on process restart and isn't shared across
multiple server instances.
"""

import logging
import os
import threading
from datetime import datetime
from zoneinfo import ZoneInfo

import requests

from chess_common import (
    cached_vods,
    chess_user_exists,
    fetch_games_for_range,
    find_matchup_games,
    map_games_to_vods,
    month_range,
)

log = logging.getLogger(__name__)

YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3"
YOUTUBE_QUOTA_DAILY_LIMIT = int(os.environ.get("YOUTUBE_QUOTA_DAILY_LIMIT", "10000"))

_QUOTA_WARN_RATIO = 0.8
_PACIFIC_TZ = ZoneInfo("America/Los_Angeles")
_UNIT_COSTS = {"channels": 1, "playlistItems": 1, "videos": 1}

_quota_lock = threading.Lock()
_quota_used = 0
_quota_day = None
_quota_warned = False


def _account_quota(endpoint: str) -> None:
    """Raises ValueError('youtube_quota_exceeded') before a call that
    would push today's usage past YOUTUBE_QUOTA_DAILY_LIMIT."""
    global _quota_used, _quota_day, _quota_warned
    cost = _UNIT_COSTS[endpoint]
    with _quota_lock:
        today = datetime.now(_PACIFIC_TZ).date()
        if _quota_day != today:
            _quota_day = today
            _quota_used = 0
            _quota_warned = False

        if _quota_used + cost > YOUTUBE_QUOTA_DAILY_LIMIT:
            raise ValueError("youtube_quota_exceeded")

        _quota_used += cost
        if not _quota_warned and _quota_used >= YOUTUBE_QUOTA_DAILY_LIMIT * _QUOTA_WARN_RATIO:
            _quota_warned = True
            log.warning(
                f"YouTube API quota at {_quota_used}/{YOUTUBE_QUOTA_DAILY_LIMIT} "
                f"units for {today} — approaching daily limit."
            )


def _youtube_get(endpoint: str, params: dict) -> dict:
    _account_quota(endpoint)
    resp = requests.get(
        f"{YOUTUBE_API_BASE}/{endpoint}",
        params={**params, "key": os.environ["YOUTUBE_API_KEY"]},
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()


# ─────────────────────────────────────────────────────────────────────────────
# YouTube — channel/uploads/live-broadcast lookup
# ─────────────────────────────────────────────────────────────────────────────

@cached_vods("youtube")
def fetch_all_vods(channel_handle: str) -> list[dict] | None:
    """
    Fetch every video on a channel that actually aired via YouTube Live.

    Returns [{id, title, created_at_epoch, duration_sec}, ...] (possibly
    empty if the channel exists but has never streamed live on YouTube),
    or None if the channel handle doesn't resolve at all.
    """
    channel_data = _youtube_get("channels", {"part": "contentDetails", "forHandle": channel_handle})
    items = channel_data.get("items", [])
    if not items:
        log.info(f"YouTube channel not found: {channel_handle}")
        return None
    uploads_playlist = items[0]["contentDetails"]["relatedPlaylists"]["uploads"]

    video_ids: list[str] = []
    page_token = None
    while True:
        params: dict = {"part": "contentDetails", "playlistId": uploads_playlist, "maxResults": 50}
        if page_token:
            params["pageToken"] = page_token
        page = _youtube_get("playlistItems", params)
        for item in page.get("items", []):
            vid = item.get("contentDetails", {}).get("videoId")
            if vid:
                video_ids.append(vid)
        page_token = page.get("nextPageToken")
        if not page_token:
            break

    vods: list[dict] = []
    for i in range(0, len(video_ids), 50):
        chunk = video_ids[i:i + 50]
        details = _youtube_get("videos", {"part": "liveStreamingDetails,snippet", "id": ",".join(chunk)})
        for v in details.get("items", []):
            live = v.get("liveStreamingDetails") or {}
            start_raw = live.get("actualStartTime")
            end_raw = live.get("actualEndTime")
            if not start_raw or not end_raw:
                # Never went live, or still live and not yet ended —
                # no reliable broadcast window to match against.
                continue
            start = datetime.fromisoformat(start_raw.replace("Z", "+00:00"))
            end = datetime.fromisoformat(end_raw.replace("Z", "+00:00"))
            vods.append({
                "id":               v["id"],
                "title":            v.get("snippet", {}).get("title", "unknown"),
                "created_at_epoch": int(start.timestamp()),
                "duration_sec":     max(0, int((end - start).total_seconds())),
            })

    log.info(f"Fetched {len(vods)} VOD(s) for YouTube channel '{channel_handle}'.")
    return vods


# ─────────────────────────────────────────────────────────────────────────────
# Orchestration
# ─────────────────────────────────────────────────────────────────────────────

def run_youtube_chess_pipeline(user_chess: str, streamer_chess: str, streamer_youtube_channel: str) -> dict:
    """
    End-to-end: fetch the streamer's YouTube Live broadcasts, bound the
    chess.com archive fetch to that date range, find matchup games, map
    them onto broadcast timestamps.

    Returns {"results": [...], "vods_scanned": int}.
    Raises ValueError("youtube_channel_not_found") if the channel handle
    doesn't resolve, ValueError("chess_user_not_found") if user_chess
    isn't a real chess.com account, or ValueError("youtube_quota_exceeded")
    if the daily API quota budget would be exceeded.
    """
    vods = fetch_all_vods(streamer_youtube_channel)
    if vods is None:
        raise ValueError("youtube_channel_not_found")
    if not vods:
        return {"results": [], "vods_scanned": 0}

    if not chess_user_exists(user_chess):
        raise ValueError("chess_user_not_found")

    months = month_range(vods)
    games = fetch_games_for_range(user_chess, months)
    matches = find_matchup_games(games, user_chess, streamer_chess)
    results = map_games_to_vods(matches, vods)

    return {"results": results, "vods_scanned": len(vods)}
