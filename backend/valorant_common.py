"""
Valorant Matching — shared logic
=================================
Platform-agnostic pieces of the Valorant matchup pipeline: HenrikDev
account/match-history fetching, matchup filtering, and mapping matches
onto VOD timestamps. Used by valorant_pipeline.py for all three VOD
platforms (Twitch, Kick, YouTube) — each one supplies its own
VOD-listing function (reused as-is from chess_pipeline.py /
kick_pipeline.py / youtube_pipeline.py, since VOD fetching has nothing
to do with the game being matched) and calls into this module for
everything after that.
"""

import logging
import os
import re
from datetime import datetime
from urllib.parse import quote

import requests

import rate_limit

log = logging.getLogger(__name__)

HENRIK_API_BASE = "https://api.henrikdev.xyz"

# Shared across every process talking to the same Redis instance, so a
# burst of concurrent Valorant searches collectively stays just under
# HenrikDev's real 30/min shared-key limit instead of each instance
# assuming it has the full 30/min to itself.
_henrik_bucket = rate_limit.TokenBucket(key="upstream:henrikdev", rate_per_min=28, burst=5)

MATCH_PAGE_SIZE = 10
# HenrikDev's v4 by-name match-history endpoint hard-caps responses at 10
# records per call regardless of a larger requested `size` (confirmed live
# against a real account) — requesting more doesn't get more per call, it
# just documents the actual page size fetch_matches_for_window advances by.

# Safety cap on pagination — HenrikDev's non-stored match-history endpoint
# is backed by Riot's own match history, which itself only retains a
# bounded number of recent matches. This also guards HenrikDev's own rate
# limit (30 req/min per key, shared across every concurrent search this
# app makes): at MATCH_PAGE_SIZE=10, MATCH_PAGE_LIMIT pages plus the one
# account-lookup call is the most a single search can spend. The real
# pagination bound is "until a page's oldest match predates the streamer's
# earliest VOD" (see fetch_matches_for_window) — this is just a ceiling.
MATCH_PAGE_LIMIT = 15

_RIOT_ID_RE = re.compile(r"^(.+)#(\S+)$")


def parse_riot_id(riot_id: str) -> tuple[str, str]:
    """Split 'Name#Tag' into (name, tag). Raises ValueError if malformed."""
    m = _RIOT_ID_RE.match(riot_id.strip())
    if not m:
        raise ValueError("invalid_riot_id")
    return m.group(1).strip(), m.group(2).strip()


def _henrik_headers() -> dict:
    return {"Authorization": os.environ["VALORANT_API_KEY"].strip()}


# Only retries connection errors and 5xx — deliberately excludes 429 so the
# existing "stop early, use partial results" handling in
# fetch_matches_for_window (below) still sees the real 429 on the first
# occurrence instead of it being silently absorbed by a retry loop.
@rate_limit.with_retry(exceptions=(requests.RequestException,), retryable_status=(500, 502, 503, 504))
def _henrik_get(path: str, params: dict | None = None) -> requests.Response:
    _henrik_bucket.acquire()
    return requests.get(
        f"{HENRIK_API_BASE}{path}",
        headers=_henrik_headers(),
        params=params,
        timeout=10,
    )


def get_riot_account(name: str, tag: str) -> dict | None:
    """
    Look up a Riot account's region + puuid via HenrikDev.
    Returns {"puuid": str, "region": str} or None if the Riot ID doesn't
    resolve. Raises ValueError("valorant_rate_limited") on a 429.
    """
    resp = _henrik_get(f"/valorant/v2/account/{quote(name)}/{quote(tag)}")
    if resp.status_code == 404:
        return None
    if resp.status_code == 429:
        raise ValueError("valorant_rate_limited")
    resp.raise_for_status()
    data = resp.json().get("data") or {}
    region = data.get("region")
    puuid = data.get("puuid")
    if not region or not puuid:
        return None
    return {"puuid": puuid, "region": region}


_FRACTIONAL_SECONDS_RE = re.compile(r"\.(\d+)")


def _parse_started_at(started_at: str) -> int:
    """
    Parse HenrikDev's `started_at` timestamp to an epoch int.

    HenrikDev emits fractional seconds with trailing zeros stripped (e.g.
    ".28" or ".5"), which datetime.fromisoformat() only accepts as exactly
    3 or 6 digits on Python <3.11 (our Dockerfile pins 3.10) — a bare
    ".replace('Z', '+00:00')" intermittently raises ValueError depending
    on what the millisecond value happens to be. Zero-pad to 6 digits first.
    """
    iso = started_at.replace("Z", "+00:00")
    iso = _FRACTIONAL_SECONDS_RE.sub(lambda m: "." + m.group(1)[:6].ljust(6, "0"), iso, count=1)
    return int(datetime.fromisoformat(iso).timestamp())


def fetch_matches_for_window(name: str, tag: str, region: str, earliest_epoch: int) -> list[dict]:
    """
    Page through a player's Valorant match history (newest-first) via
    HenrikDev's v4 by-name endpoint, stopping once a page's oldest match
    predates `earliest_epoch` (the streamer's earliest VOD), the account
    runs out of history, or MATCH_PAGE_LIMIT pages have been fetched.

    Returns raw match dicts (HenrikDev's per-match `data[]` entries).
    Raises ValueError("valorant_account_not_found") if the Riot ID doesn't
    resolve, or ValueError("valorant_rate_limited") if a 429 is hit before
    any page has been fetched. A 429 hit mid-pagination instead stops early
    and returns whatever was already fetched — a shallower-than-intended
    search beats failing a request that already has usable data.
    """
    matches: list[dict] = []
    start = 0
    for _ in range(MATCH_PAGE_LIMIT):
        resp = _henrik_get(
            f"/valorant/v4/matches/{region}/pc/{quote(name)}/{quote(tag)}",
            params={"size": MATCH_PAGE_SIZE, "start": start},
        )
        if resp.status_code == 404:
            if start == 0:
                raise ValueError("valorant_account_not_found")
            break
        if resp.status_code == 429:
            if not matches:
                raise ValueError("valorant_rate_limited")
            log.warning(f"HenrikDev rate limit hit after {len(matches)} match(es) for '{name}#{tag}' — using partial results.")
            break
        resp.raise_for_status()

        page = resp.json().get("data") or []
        if not page:
            break

        matches.extend(page)
        oldest_on_page = min(_parse_started_at(m["metadata"]["started_at"]) for m in page)
        if oldest_on_page < earliest_epoch:
            break

        # Advance by however many records actually came back, not the
        # requested size — HenrikDev silently caps this endpoint at 10
        # records per call regardless of a larger `size`, so incrementing
        # by the requested size would skip every other page.
        start += len(page)

    log.info(f"Fetched {len(matches)} match(es) for '{name}#{tag}'.")
    return matches


def _find_player(players: list[dict], name: str, tag: str) -> dict | None:
    name_l, tag_l = name.lower(), tag.lower()
    for p in players:
        if p.get("name", "").lower() == name_l and p.get("tag", "").lower() == tag_l:
            return p
    return None


def _team_result(teams: list[dict], team_id: str | None) -> str:
    if not team_id:
        return "unknown"
    for t in teams:
        if t.get("team_id") == team_id:
            return "win" if t.get("won") else "loss"
    return "unknown"


def find_matchup_games(matches: list[dict], viewer_name: str, viewer_tag: str, streamer_name: str, streamer_tag: str) -> list[dict]:
    """
    Filter matches down to ones where both the viewer and the streamer
    were players (teammates or opponents). Returns each match annotated
    from the viewer's perspective.
    """
    results: list[dict] = []
    for m in matches:
        players = m.get("players", [])
        viewer = _find_player(players, viewer_name, viewer_tag)
        streamer = _find_player(players, streamer_name, streamer_tag)
        if not viewer or not streamer:
            continue

        meta = m.get("metadata", {})
        teams = m.get("teams", [])
        viewer_team = viewer.get("team_id")
        streamer_team = streamer.get("team_id")

        results.append({
            "end_time":       _parse_started_at(meta["started_at"]) + int(meta.get("game_length_in_ms", 0) / 1000),
            "match_id":       meta.get("match_id", ""),
            "map":            (meta.get("map") or {}).get("name", "unknown"),
            "mode":           (meta.get("queue") or {}).get("name") or "unknown",
            "result":         _team_result(teams, viewer_team),
            "teammates":      bool(viewer_team and streamer_team and viewer_team == streamer_team),
            "viewer_agent":   (viewer.get("agent") or {}).get("name", "unknown"),
            "streamer_agent": (streamer.get("agent") or {}).get("name", "unknown"),
        })

    log.info(f"Found {len(results)} matchup game(s) between '{viewer_name}#{viewer_tag}' and '{streamer_name}#{streamer_tag}'.")
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
                    "map":            match["map"],
                    "mode":           match["mode"],
                    "result":         match["result"],
                    "teammates":      match["teammates"],
                    "viewer_agent":   match["viewer_agent"],
                    "streamer_agent": match["streamer_agent"],
                    "match_url":      f"https://tracker.gg/valorant/match/{match['match_id']}",
                })
                break

    results.sort(key=lambda r: r["played_at"])
    return results
