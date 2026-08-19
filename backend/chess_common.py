"""
Chess.com Matching — shared logic
==================================
Platform-agnostic pieces of the chess-matchup pipeline: chess.com archive
fetching, month-range bounding, opponent matching, and mapping games onto
VOD timestamps. Used by chess_pipeline.py (Twitch), kick_pipeline.py
(Kick), and youtube_pipeline.py (YouTube) — each supplies its own
VOD-listing function and calls into this module for everything after
that.

Also provides `cached_vods`, a shared in-process TTL cache applied to
each pipeline's fetch_all_vods, so repeated searches against the same
streamer within the TTL window don't re-spend YouTube quota or re-hit
Kick's undocumented, Cloudflare-gated endpoint.
"""

import json
import logging
import os
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from functools import wraps

import requests

import rate_limit

log = logging.getLogger(__name__)

CHESS_API_BASE = "https://api.chess.com/pub"

CHESS_API_USER_AGENT = os.environ.get(
    "CHESS_API_USER_AGENT",
    "spot-me/1.0 (contact: spotme-app@example.com)",
)

ARCHIVE_FETCH_WORKERS = 4

_ARCHIVE_MONTH_RE = re.compile(r"/(\d{4})/(\d{1,2})$")


@rate_limit.with_retry(exceptions=(requests.RequestException,))
def _chess_get(url: str) -> requests.Response:
    return requests.get(url, headers={"User-Agent": CHESS_API_USER_AGENT}, timeout=10)


def chess_user_exists(username: str) -> bool:
    resp = _chess_get(f"{CHESS_API_BASE}/player/{username}")
    return resp.status_code == 200


def fetch_chess_archives(username: str) -> list[str]:
    resp = _chess_get(f"{CHESS_API_BASE}/player/{username}/games/archives")
    resp.raise_for_status()
    return resp.json().get("archives", [])


def month_range(vods: list[dict]) -> set[tuple[int, int]]:
    """Every (year, month) from the oldest VOD through the current month."""
    if not vods:
        return set()

    oldest = min(v["created_at_epoch"] for v in vods)
    start = datetime.fromtimestamp(oldest, tz=timezone.utc)
    end = datetime.now(tz=timezone.utc)

    months: set[tuple[int, int]] = set()
    y, m = start.year, start.month
    while (y, m) <= (end.year, end.month):
        months.add((y, m))
        m += 1
        if m > 12:
            m = 1
            y += 1
    return months


def _filter_archives_by_range(archives: list[str], months: set[tuple[int, int]]) -> list[str]:
    filtered = []
    for url in archives:
        m = _ARCHIVE_MONTH_RE.search(url)
        if m and (int(m.group(1)), int(m.group(2))) in months:
            filtered.append(url)
    return filtered


def fetch_games_for_range(username: str, months: set[tuple[int, int]]) -> list[dict]:
    """Fetch and flatten all games from archive-months overlapping `months`."""
    if not months:
        return []

    archives = fetch_chess_archives(username)
    relevant = _filter_archives_by_range(archives, months)
    if not relevant:
        return []

    games: list[dict] = []
    with ThreadPoolExecutor(max_workers=ARCHIVE_FETCH_WORKERS) as pool:
        futures = {pool.submit(_chess_get, url): url for url in relevant}
        for future in as_completed(futures):
            url = futures[future]
            try:
                resp = future.result()
                resp.raise_for_status()
                games.extend(resp.json().get("games", []))
            except requests.RequestException as exc:
                log.warning(f"Failed to fetch chess.com archive {url}: {exc}")

    log.info(f"Fetched {len(games)} game(s) for '{username}' across {len(relevant)} archive(s).")
    return games


# ─────────────────────────────────────────────────────────────────────────────
# VOD-list caching
# ─────────────────────────────────────────────────────────────────────────────

VOD_CACHE_TTL_SECONDS = int(os.environ.get("VOD_CACHE_TTL_SECONDS", "1800"))  # 30 min

_cache_lock = threading.Lock()
_vod_cache: dict[tuple[str, str], tuple[float, list[dict] | None]] = {}
# key: (platform, channel.lower()) -> (expires_at_monotonic, result)


_MISSING_SENTINEL = "__missing__"  # distinguishes a real cache miss from a cached "channel not found" (None)


def _redis_cache_get(cache_key: str) -> tuple[bool, list[dict] | None]:
    """Returns (hit, value). `hit` is False on a real cache miss."""
    client = rate_limit.get_redis()
    raw = client.get(cache_key)
    if raw is None:
        return False, None
    if raw == _MISSING_SENTINEL:
        return True, None
    return True, json.loads(raw)


def _redis_cache_set(cache_key: str, value: list[dict] | None) -> None:
    client = rate_limit.get_redis()
    raw = _MISSING_SENTINEL if value is None else json.dumps(value)
    client.set(cache_key, raw, ex=VOD_CACHE_TTL_SECONDS)


def cached_vods(platform: str):
    """
    Decorator for a platform's fetch_all_vods(channel) -> list[dict] | None.
    Caches both hits and "channel not found" (None) for VOD_CACHE_TTL_SECONDS,
    keyed case-insensitively per (platform, channel). Never caches an
    exception (network error, YouTube quota_exceeded, etc.) — those
    propagate so the next call retries for real instead of replaying a
    transient failure for the full TTL.

    Backed by Redis (shared across every process) when REDIS_URL is set,
    with single-flight dogpile protection so concurrent requests for the
    same uncached channel — e.g. hundreds of viewers all asking about the
    same shouted-out streamer — trigger one real upstream fetch instead of
    one per request. Falls back to the original in-process dict+lock cache
    (no dogpile protection, but correct for a single process) when Redis
    isn't configured.
    """
    def decorator(fetch_fn):
        @wraps(fetch_fn)
        def wrapper(channel: str):
            channel_key = channel.lower()

            if rate_limit.get_redis() is not None:
                cache_key = f"vods:{platform}:{channel_key}"
                hit, value = _redis_cache_get(cache_key)
                if hit:
                    return value

                def compute_and_store():
                    result = fetch_fn(channel)
                    _redis_cache_set(cache_key, result)
                    return result

                return rate_limit.single_flight(f"vods:{platform}:{channel_key}", ttl=30, compute_fn=compute_and_store)

            # In-process fallback — single instance only, no dogpile protection.
            key = (platform, channel_key)
            now = time.monotonic()
            with _cache_lock:
                entry = _vod_cache.get(key)
                if entry and entry[0] > now:
                    return entry[1]

            result = fetch_fn(channel)  # cache miss — real fetch, outside the lock

            with _cache_lock:
                _vod_cache[key] = (now + VOD_CACHE_TTL_SECONDS, result)
                # opportunistic cleanup so the dict doesn't grow forever
                # over a long-running process
                for k, (expires_at, _) in list(_vod_cache.items()):
                    if expires_at <= now:
                        del _vod_cache[k]
            return result
        return wrapper
    return decorator


def find_matchup_games(games: list[dict], user_chess: str, streamer_chess: str) -> list[dict]:
    """
    Filter games down to ones played between user_chess and streamer_chess.
    Returns each match annotated with the user's own result/perspective.
    """
    user_l = user_chess.lower()
    streamer_l = streamer_chess.lower()

    matches: list[dict] = []
    for g in games:
        white = g.get("white", {})
        black = g.get("black", {})
        white_name = white.get("username", "").lower()
        black_name = black.get("username", "").lower()

        if white_name == user_l and black_name == streamer_l:
            me, opponent = white, black
        elif black_name == user_l and white_name == streamer_l:
            me, opponent = black, white
        else:
            continue

        matches.append({
            "end_time":   g.get("end_time", 0),
            "result":     me.get("result", "unknown"),
            "opponent":   opponent.get("username", streamer_chess),
            "time_class": g.get("time_class", "unknown"),
            "rated":      bool(g.get("rated", False)),
            "game_url":   g.get("url", ""),
        })

    log.info(f"Found {len(matches)} matchup game(s) between '{user_chess}' and '{streamer_chess}'.")
    return matches


def map_games_to_vods(matches: list[dict], vods: list[dict]) -> list[dict]:
    """
    For each matched game, find the VOD whose broadcast window contains the
    game's end_time and compute the in-VOD offset. Games with no covering
    VOD (expired/deleted) are dropped.
    """
    results: list[dict] = []
    for match in matches:
        end_time = match["end_time"]
        for vod in vods:
            start = vod["created_at_epoch"]
            stop = start + vod["duration_sec"]
            if start <= end_time <= stop:
                results.append({
                    "video_id":   vod["id"],
                    "video_name": vod["title"],
                    "timestamp":  max(0, end_time - start),
                    "opponent":   match["opponent"],
                    "result":     match["result"],
                    "time_class": match["time_class"],
                    "rated":      match["rated"],
                    "game_url":   match["game_url"],
                    "played_at":  end_time,
                })
                break

    results.sort(key=lambda r: r["played_at"])
    return results
