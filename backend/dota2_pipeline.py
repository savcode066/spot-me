"""
Dota 2 Matchup Pipeline
========================
On-demand (no Firestore, no pre-scanning, no OCR): given a viewer's Steam32
account ID, a streamer's Steam32 account ID, and the streamer's VOD channel
(Twitch, Kick, or YouTube), finds every Dota 2 match the two played in
together (as teammates or opponents) and maps each match's end time onto
the streamer's VOD + in-VOD timestamp.

Match data comes from OpenDota's public API (match history + per-match
player/team data) — see dota2_common.py. VOD listing is identical to the
chess.com pipelines (a stream is a stream regardless of what game was
played), so this reuses fetch_all_vods from chess_pipeline.py (Twitch),
kick_pipeline.py (Kick), and youtube_pipeline.py (YouTube) rather than
re-implementing platform auth.
"""

import logging

import chess_pipeline
import kick_pipeline
import youtube_pipeline
from dota2_common import (
    fetch_matches_for_window,
    find_matchup_games,
    get_player_profile,
    map_games_to_vods,
    parse_dota_id,
)

log = logging.getLogger(__name__)


def _run_pipeline(vods: list[dict], viewer_dota_id: str, streamer_dota_id: str) -> dict:
    """
    Shared orchestration once a platform's (non-None) VOD list has been
    fetched. Raises ValueError("dota2_invalid_id") if either ID isn't a
    valid Steam32 account ID, ValueError("dota2_account_not_found") if the
    viewer's account doesn't resolve, or ValueError("dota2_rate_limited")
    if OpenDota's rate limit is hit.
    """
    if not vods:
        return {"results": [], "vods_scanned": 0}

    try:
        viewer_id = parse_dota_id(viewer_dota_id)
        streamer_id = parse_dota_id(streamer_dota_id)
    except ValueError:
        raise ValueError("dota2_invalid_id")

    profile = get_player_profile(viewer_id)
    if profile is None:
        raise ValueError("dota2_account_not_found")

    earliest_epoch = min(v["created_at_epoch"] for v in vods)
    matches = fetch_matches_for_window(viewer_id, earliest_epoch)
    matchups = find_matchup_games(matches, viewer_id, streamer_id)
    results = map_games_to_vods(matchups, vods)

    return {"results": results, "vods_scanned": len(vods)}


def run_dota2_pipeline(viewer_dota_id: str, streamer_dota_id: str, streamer_twitch: str) -> dict:
    """Twitch-sourced Dota 2 matchup search. Raises ValueError("twitch_channel_not_found") too."""
    vods = chess_pipeline.fetch_all_vods(streamer_twitch)
    if vods is None:
        raise ValueError("twitch_channel_not_found")
    return _run_pipeline(vods, viewer_dota_id, streamer_dota_id)


def run_kick_dota2_pipeline(viewer_dota_id: str, streamer_dota_id: str, streamer_kick: str) -> dict:
    """Kick-sourced Dota 2 matchup search. Raises ValueError("kick_channel_not_found") too."""
    vods = kick_pipeline.fetch_all_vods(streamer_kick)
    if vods is None:
        raise ValueError("kick_channel_not_found")
    return _run_pipeline(vods, viewer_dota_id, streamer_dota_id)


def run_youtube_dota2_pipeline(viewer_dota_id: str, streamer_dota_id: str, streamer_youtube_channel: str) -> dict:
    """YouTube-sourced Dota 2 matchup search. Raises ValueError("youtube_channel_not_found") too."""
    vods = youtube_pipeline.fetch_all_vods(streamer_youtube_channel)
    if vods is None:
        raise ValueError("youtube_channel_not_found")
    return _run_pipeline(vods, viewer_dota_id, streamer_dota_id)
