"""
Chess.com ↔ Kick Matchup Pipeline
===================================
Same idea as chess_pipeline.py (Twitch) but sourcing VODs from Kick
instead. Kick's official public Developer API has no VOD-listing endpoint
at all — only currently-live streams — so this hits the same undocumented
site API kick.com's own frontend (and yt-dlp) use:

    GET https://kick.com/api/v2/channels/{slug}/videos

That endpoint is unauthenticated but sits behind Cloudflare bot
protection, so plain `requests` gets a 403; it only works with a
browser-TLS fingerprint via curl_cffi's `impersonate=` (the same trick
yt-dlp's Kick extractor uses). Being undocumented, it could change or
break without notice.

Unlike Twitch, Kick auto-deletes VODs after a short window (30 days for
verified streamers, 7 for non-verified — confirmed against live data, not
configurable per request), so this will only ever surface recent
matchups, never a full history.

chess.com fetching and opponent/timestamp matching are shared with
chess_pipeline.py via chess_common.py.
"""

import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional

from curl_cffi import requests as creq

from chess_common import (
    cached_vods,
    chess_user_exists,
    fetch_games_for_range,
    find_matchup_games,
    map_games_to_vods,
    month_range,
)

log = logging.getLogger(__name__)

KICK_API_BASE = "https://kick.com/api"


@cached_vods("kick")
def fetch_all_vods(channel: str) -> Optional[List[Dict]]:
    """
    Fetch every VOD Kick still has for a channel. Kick has no pagination on
    this endpoint in practice — it always returns everything within its
    retention window (there's nothing older to page to), so a single
    request is the full history available.

    Returns [{id, title, created_at_epoch, duration_sec}, ...] (possibly
    empty if the channel exists but has no VODs left), or None if the
    channel doesn't resolve to a Kick channel at all.
    """
    resp = creq.get(
        f"{KICK_API_BASE}/v2/channels/{channel}/videos",
        impersonate="chrome",
        timeout=15,
    )
    if resp.status_code == 404:
        log.info(f"Kick channel not found: {channel}")
        return None
    resp.raise_for_status()

    vods: List[Dict] = []
    for v in resp.json():
        if v.get("is_live"):
            # Still broadcasting — not an archived VOD yet (duration isn't
            # final), same as Twitch's type=archive excluding live streams.
            continue
        video = v.get("video") or {}
        uuid = video.get("uuid")
        if not uuid:
            continue
        start = datetime.strptime(v["start_time"], "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
        vods.append({
            "id":               uuid,
            "title":            v.get("session_title", "unknown"),
            "created_at_epoch": int(start.timestamp()),
            "duration_sec":     int((v.get("duration") or 0) / 1000),
        })

    log.info(f"Fetched {len(vods)} VOD(s) for Kick channel '{channel}'.")
    return vods


# ─────────────────────────────────────────────────────────────────────────────
# Orchestration
# ─────────────────────────────────────────────────────────────────────────────

def run_kick_chess_pipeline(user_chess: str, streamer_chess: str, streamer_kick: str) -> Dict:
    """
    End-to-end: fetch the streamer's Kick VODs, bound the chess.com archive
    fetch to that date range, find matchup games, map them onto VOD
    timestamps.

    Returns {"results": [...], "vods_scanned": int}.
    Raises ValueError("kick_channel_not_found") if the Kick channel doesn't
    resolve, or ValueError("chess_user_not_found") if user_chess isn't a
    real chess.com account.
    """
    vods = fetch_all_vods(streamer_kick)
    if vods is None:
        raise ValueError("kick_channel_not_found")
    if not vods:
        return {"results": [], "vods_scanned": 0}

    if not chess_user_exists(user_chess):
        raise ValueError("chess_user_not_found")

    months = month_range(vods)
    games = fetch_games_for_range(user_chess, months)
    matches = find_matchup_games(games, user_chess, streamer_chess)
    results = map_games_to_vods(matches, vods)

    return {"results": results, "vods_scanned": len(vods)}
