"""
Dota 2 Matching — shared logic
================================
Platform-agnostic pieces of the Dota 2 matchup pipeline: OpenDota
account/match-history fetching, matchup filtering, and mapping matches
onto VOD timestamps. Used by dota2_pipeline.py for all three VOD
platforms (Twitch, Kick, YouTube) — each one supplies its own
VOD-listing function (reused as-is from chess_pipeline.py /
kick_pipeline.py / youtube_pipeline.py, since VOD fetching has nothing
to do with the game being matched) and calls into this module for
everything after that.

Unlike Valorant's Riot ID, a Dota 2 player is identified by their
Steam32 account ID — the same number shown as "Friend ID" in the Dota
2 client and used directly by OpenDota's API, so no separate
name-to-ID resolution step is needed.
"""

import logging
import re
import time

import requests

import rate_limit

log = logging.getLogger(__name__)

OPENDOTA_API_BASE = "https://api.opendota.com/api"

# Shared across every process talking to the same Redis instance. A single
# Dota 2 search can issue up to ~57 sequential OpenDota calls (see
# MATCH_LIST_PAGE_LIMIT/MATCH_DETAIL_LIMIT below), so this is the most
# important upstream throttle in the app — it keeps our aggregate outbound
# rate just under OpenDota's ~60/min free-tier limit regardless of how many
# concurrent searches are running.
_opendota_bucket = rate_limit.TokenBucket(key="upstream:opendota", rate_per_min=55, burst=10)

MATCH_LIST_PAGE_SIZE = 20
# OpenDota's /players/{id}/matches endpoint has no hard per-call cap like
# HenrikDev, but we still page it in fixed-size chunks (newest-first) so we
# only pull as much history as the streamer's earliest VOD requires.

# Safety cap on how many of the viewer's matches get a full match-detail
# lookup (the only way to see who else played, since the matches-list
# endpoint returns only the requesting player's own stats). Each lookup is
# a separate OpenDota request, so this bounds a single search's request
# budget against OpenDota's free-tier rate limit (60 req/min).
MATCH_DETAIL_LIMIT = 40

# Safety cap on how many pages of match history get pulled before giving up
# on reaching `earliest_epoch`.
MATCH_LIST_PAGE_LIMIT = 15

_DOTA_ID_RE = re.compile(r"^\d{1,12}$")


def parse_dota_id(dota_id: str) -> int:
    """Validate a Steam32 account ID ("Friend ID"). Raises ValueError if malformed."""
    cleaned = dota_id.strip().replace(",", "")
    if not _DOTA_ID_RE.match(cleaned):
        raise ValueError("invalid_dota_id")
    return int(cleaned)


# Only retries connection errors and 5xx — deliberately excludes 429 so the
# existing "stop early, use partial results" handling in
# fetch_matches_for_window/find_matchup_games (below) still sees the real
# 429 on the first occurrence instead of it being silently absorbed by a
# retry loop.
@rate_limit.with_retry(exceptions=(requests.RequestException,), retryable_status=(500, 502, 503, 504))
def _opendota_get(path: str, params: dict | None = None) -> requests.Response:
    _opendota_bucket.acquire()
    return requests.get(f"{OPENDOTA_API_BASE}{path}", params=params, timeout=10)


def get_player_profile(account_id: int) -> dict | None:
    """
    Confirm a Steam32 account ID resolves to a player OpenDota knows about.
    Returns the raw profile dict, or None if the account doesn't exist.
    Raises ValueError("dota2_rate_limited") on a 429.
    """
    resp = _opendota_get(f"/players/{account_id}")
    if resp.status_code == 404:
        return None
    if resp.status_code == 429:
        raise ValueError("dota2_rate_limited")
    resp.raise_for_status()
    data = resp.json() or {}
    return data


def fetch_matches_for_window(account_id: int, earliest_epoch: int) -> list[dict]:
    """
    Page through a player's Dota 2 match history (newest-first) via
    OpenDota's /players/{id}/matches endpoint, stopping once a page's
    oldest match predates `earliest_epoch` (the streamer's earliest VOD),
    the account runs out of history, or MATCH_LIST_PAGE_LIMIT pages have
    been fetched.

    Returns raw match-summary dicts (account-scoped, no other players).
    Raises ValueError("dota2_rate_limited") if a 429 is hit before any
    page has been fetched.
    """
    matches: list[dict] = []
    offset = 0
    for _ in range(MATCH_LIST_PAGE_LIMIT):
        resp = _opendota_get(
            f"/players/{account_id}/matches",
            params={"limit": MATCH_LIST_PAGE_SIZE, "offset": offset},
        )
        if resp.status_code == 429:
            if not matches:
                raise ValueError("dota2_rate_limited")
            log.warning(f"OpenDota rate limit hit after {len(matches)} match(es) for account {account_id} — using partial results.")
            break
        resp.raise_for_status()

        page = resp.json() or []
        if not page:
            break

        matches.extend(page)
        oldest_on_page = min(m["start_time"] + m["duration"] for m in page)
        if oldest_on_page < earliest_epoch:
            break

        offset += len(page)

    log.info(f"Fetched {len(matches)} match(es) for account {account_id}.")
    return matches


_HERO_NAME_CACHE: dict[int, str] = {}
_HERO_NAME_CACHE_AT: float = 0.0
_HERO_NAME_CACHE_TTL_SEC = 6 * 60 * 60


def _hero_names() -> dict[int, str]:
    """Lazily fetches + caches OpenDota's hero id -> localized name map."""
    global _HERO_NAME_CACHE_AT
    now = time.time()
    if _HERO_NAME_CACHE and (now - _HERO_NAME_CACHE_AT) < _HERO_NAME_CACHE_TTL_SEC:
        return _HERO_NAME_CACHE

    resp = _opendota_get("/heroes")
    resp.raise_for_status()
    _HERO_NAME_CACHE.clear()
    for hero in resp.json() or []:
        hero_id = hero.get("id")
        name = hero.get("localized_name")
        if hero_id is not None and name:
            _HERO_NAME_CACHE[hero_id] = name
    _HERO_NAME_CACHE_AT = now
    return _HERO_NAME_CACHE


def find_matchup_games(match_summaries: list[dict], viewer_account_id: int, streamer_account_id: int) -> list[dict]:
    """
    For each of the viewer's matches, fetch full match details (the only
    way to see the rest of the lobby) and keep the ones where the
    streamer's account ID also appears. Returns each match annotated from
    the viewer's perspective. Bounded by MATCH_DETAIL_LIMIT detail lookups.
    """
    hero_names = _hero_names()
    results: list[dict] = []
    checked = 0

    for summary in match_summaries:
        if checked >= MATCH_DETAIL_LIMIT:
            log.warning(f"Hit MATCH_DETAIL_LIMIT ({MATCH_DETAIL_LIMIT}) while scanning matches for account {viewer_account_id}.")
            break
        checked += 1

        match_id = summary["match_id"]
        resp = _opendota_get(f"/matches/{match_id}")
        if resp.status_code == 429:
            log.warning(f"OpenDota rate limit hit while fetching match {match_id} details — stopping early.")
            break
        if not resp.ok:
            continue

        detail = resp.json() or {}
        players = detail.get("players") or []

        viewer = next((p for p in players if p.get("account_id") == viewer_account_id), None)
        streamer = next((p for p in players if p.get("account_id") == streamer_account_id), None)
        if not viewer or not streamer:
            continue

        radiant_win = detail.get("radiant_win")
        viewer_is_radiant = bool(viewer.get("isRadiant"))
        streamer_is_radiant = bool(streamer.get("isRadiant"))

        if radiant_win is None:
            result = "unknown"
        else:
            result = "win" if (radiant_win == viewer_is_radiant) else "loss"

        results.append({
            "end_time":         int(detail["start_time"]) + int(detail.get("duration", 0)),
            "match_id":         match_id,
            "duration":         int(detail.get("duration", 0)),
            "game_mode":        detail.get("game_mode"),
            "result":           result,
            "teammates":        viewer_is_radiant == streamer_is_radiant,
            "viewer_hero":      hero_names.get(viewer.get("hero_id"), "unknown"),
            "streamer_hero":    hero_names.get(streamer.get("hero_id"), "unknown"),
        })

    log.info(f"Found {len(results)} matchup game(s) between account {viewer_account_id} and account {streamer_account_id}.")
    return results


def map_games_to_vods(matches: list[dict], vods: list[dict]) -> list[dict]:
    """
    For each matched game, find the VOD whose broadcast window contains the
    match's end time and compute the in-VOD offset. Games with no covering
    VOD (expired/deleted/never streamed) are dropped.
    """
    results: list[dict] = []
    for match in matches:
        end_time = match["end_time"]
        for vod in vods:
            start = vod["created_at_epoch"]
            stop = start + vod["duration_sec"]
            if start <= end_time <= stop:
                results.append({
                    "video_id":       vod["id"],
                    "video_name":     vod["title"],
                    "timestamp":      max(0, end_time - start),
                    "played_at":      end_time,
                    "duration":       match["duration"],
                    "result":         match["result"],
                    "teammates":      match["teammates"],
                    "viewer_hero":    match["viewer_hero"],
                    "streamer_hero":  match["streamer_hero"],
                    "match_url":      f"https://www.opendota.com/matches/{match['match_id']}",
                })
                break

    results.sort(key=lambda r: r["played_at"])
    return results
