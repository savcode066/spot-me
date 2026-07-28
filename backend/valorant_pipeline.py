"""
Valorant Matchup Pipeline
=========================
On-demand (no Firestore, no pre-scanning, no OCR): given a viewer's Riot
ID, a streamer's Riot ID, and the streamer's VOD channel (Twitch, Kick, or
YouTube), finds every Valorant match the two played in together (as
teammates or opponents) and maps each match's end time onto the
streamer's VOD + in-VOD timestamp.

Match data comes from HenrikDev's unofficial Valorant API (match history
+ per-match player/team data) — see valorant_common.py. VOD listing is
identical to the chess.com pipelines (a stream is a stream regardless of
what game was played), so this reuses fetch_all_vods from
chess_pipeline.py (Twitch), kick_pipeline.py (Kick), and
youtube_pipeline.py (YouTube) rather than re-implementing platform auth.
"""

import logging

import chess_pipeline
import kick_pipeline
import youtube_pipeline
from valorant_common import (
    fetch_matches_for_window,
    find_matchup_games,
    get_riot_account,
    map_games_to_vods,
    parse_riot_id,
)

log = logging.getLogger(__name__)


def _run_pipeline(vods: list[dict], viewer_riot_id: str, streamer_riot_id: str) -> dict:
    """
    Shared orchestration once a platform's (non-None) VOD list has been
    fetched. Raises ValueError("valorant_invalid_riot_id") if either Riot
    ID isn't in Name#Tag form, ValueError("valorant_account_not_found") if
    the viewer's Riot ID doesn't resolve, or
    ValueError("valorant_rate_limited") if HenrikDev's rate limit is hit.
    """
    if not vods:
        return {"results": [], "vods_scanned": 0}

    try:
        viewer_name, viewer_tag = parse_riot_id(viewer_riot_id)
        streamer_name, streamer_tag = parse_riot_id(streamer_riot_id)
    except ValueError:
        raise ValueError("valorant_invalid_riot_id")

    account = get_riot_account(viewer_name, viewer_tag)
    if account is None:
        raise ValueError("valorant_account_not_found")

    earliest_epoch = min(v["created_at_epoch"] for v in vods)
    matches = fetch_matches_for_window(viewer_name, viewer_tag, account["region"], earliest_epoch)
    matchups = find_matchup_games(matches, viewer_name, viewer_tag, streamer_name, streamer_tag)
    results = map_games_to_vods(matchups, vods)

    return {"results": results, "vods_scanned": len(vods)}


def run_valorant_pipeline(viewer_riot_id: str, streamer_riot_id: str, streamer_twitch: str) -> dict:
    """Twitch-sourced Valorant matchup search. Raises ValueError("twitch_channel_not_found") too."""
    vods = chess_pipeline.fetch_all_vods(streamer_twitch)
    if vods is None:
        raise ValueError("twitch_channel_not_found")
    return _run_pipeline(vods, viewer_riot_id, streamer_riot_id)


def run_kick_valorant_pipeline(viewer_riot_id: str, streamer_riot_id: str, streamer_kick: str) -> dict:
    """Kick-sourced Valorant matchup search. Raises ValueError("kick_channel_not_found") too."""
    vods = kick_pipeline.fetch_all_vods(streamer_kick)
    if vods is None:
        raise ValueError("kick_channel_not_found")
    return _run_pipeline(vods, viewer_riot_id, streamer_riot_id)


def run_youtube_valorant_pipeline(viewer_riot_id: str, streamer_riot_id: str, streamer_youtube_channel: str) -> dict:
    """YouTube-sourced Valorant matchup search. Raises ValueError("youtube_channel_not_found") too."""
    vods = youtube_pipeline.fetch_all_vods(streamer_youtube_channel)
    if vods is None:
        raise ValueError("youtube_channel_not_found")
    return _run_pipeline(vods, viewer_riot_id, streamer_riot_id)
