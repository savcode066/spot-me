"""
Chess.com ↔ Twitch Matchup Pipeline
====================================
On-demand (no Firestore, no pre-scanning): given a viewer's chess.com
username, a streamer's chess.com username, and the streamer's Twitch
channel, finds every game the two played against each other and maps
each game's end time onto the streamer's Twitch VOD + in-VOD timestamp.

Unlike pipeline.py (Valorant OCR), this needs no video download or frame
processing — chess.com's public API returns exact opponent usernames and
game end times directly, so matching is pure REST + timestamp arithmetic.
Kept dependency-light (requests only) so it can live in the lightweight
API service rather than the GPU OCR worker.

Twitch-specific VOD fetching lives here; chess.com fetching and the
opponent/timestamp matching logic are shared with kick_pipeline.py via
chess_common.py.
"""

import logging
import os
import re
from datetime import datetime

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

TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token"
TWITCH_API_BASE  = "https://api.twitch.tv/helix"

_DURATION_RE = re.compile(r"(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?")


# ─────────────────────────────────────────────────────────────────────────────
# Twitch — auth + VOD listing
# ─────────────────────────────────────────────────────────────────────────────

def _twitch_client_id() -> str:
    return os.environ["TWITCH_CLIENT_ID"].strip()


def _twitch_client_secret() -> str:
    return os.environ["TWITCH_CLIENT_SECRET"].strip()


def _get_twitch_token() -> str:
    resp = requests.post(TWITCH_TOKEN_URL, params={
        "client_id":     _twitch_client_id(),
        "client_secret": _twitch_client_secret(),
        "grant_type":    "client_credentials",
    }, timeout=10)
    resp.raise_for_status()
    return resp.json()["access_token"]


def _twitch_headers(token: str) -> dict:
    return {
        "Client-ID":     _twitch_client_id(),
        "Authorization": f"Bearer {token}",
    }


def _get_user_id(channel: str, token: str) -> str | None:
    resp = requests.get(
        f"{TWITCH_API_BASE}/users",
        headers=_twitch_headers(token),
        params={"login": channel},
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json().get("data", [])
    return data[0]["id"] if data else None


def _parse_duration(s: str) -> int:
    """Parse Twitch's '3h25m31s' duration format to seconds."""
    m = _DURATION_RE.fullmatch(s.strip())
    if not m or not any(m.groups()):
        return 0
    h, mn, sec = (int(x) if x else 0 for x in m.groups())
    return h * 3600 + mn * 60 + sec


@cached_vods("twitch")
def fetch_all_vods(channel: str) -> list[dict] | None:
    """
    Fetch every archived VOD Twitch still has for a channel — no fetch limit,
    since any past VOD could contain a matchup.

    Returns [{id, title, created_at_epoch, duration_sec}, ...] (possibly empty
    if the channel exists but has no VODs), or None if the channel doesn't
    resolve to a Twitch user at all.
    """
    token = _get_twitch_token()
    user_id = _get_user_id(channel, token)
    if not user_id:
        log.info(f"Twitch channel not found: {channel}")
        return None

    vods: list[dict] = []
    cursor = None
    while True:
        params: dict = {"user_id": user_id, "type": "archive", "first": 100}
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
            created_at = datetime.fromisoformat(
                v["created_at"].replace("Z", "+00:00")
            )
            vods.append({
                "id":               v["id"],
                "title":            v.get("title", "unknown"),
                "created_at_epoch": int(created_at.timestamp()),
                "duration_sec":     _parse_duration(v.get("duration", "0s")),
            })
        cursor = body.get("pagination", {}).get("cursor")
        if not cursor or not body.get("data"):
            break

    log.info(f"Fetched {len(vods)} VOD(s) for channel '{channel}'.")
    return vods


# ─────────────────────────────────────────────────────────────────────────────
# Orchestration
# ─────────────────────────────────────────────────────────────────────────────

def run_chess_pipeline(user_chess: str, streamer_chess: str, streamer_twitch: str) -> dict:
    """
    End-to-end: fetch the streamer's VODs, bound the chess.com archive fetch
    to that date range, find matchup games, map them onto VOD timestamps.

    Returns {"results": [...], "vods_scanned": int}.
    Raises ValueError("twitch_channel_not_found") if the Twitch channel
    doesn't resolve, or ValueError("chess_user_not_found") if user_chess
    isn't a real chess.com account.
    """
    vods = fetch_all_vods(streamer_twitch)
    if vods is None:
        raise ValueError("twitch_channel_not_found")
    if not vods:
        # Channel exists but has no VODs — no possible match, and no point
        # spending chess.com API calls.
        return {"results": [], "vods_scanned": 0}

    if not chess_user_exists(user_chess):
        raise ValueError("chess_user_not_found")

    months = month_range(vods)
    games = fetch_games_for_range(user_chess, months)
    matches = find_matchup_games(games, user_chess, streamer_chess)
    results = map_games_to_vods(matches, vods)

    return {"results": results, "vods_scanned": len(vods)}
