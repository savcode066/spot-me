"""
Redis-backed rate limiting utilities
=====================================
Shared primitives used both to protect our own API from callers (paired
with slowapi's own Redis storage_uri, configured directly in api.py) and
to protect each upstream API (chess.com, Twitch, Kick, YouTube,
HenrikDev, OpenDota) from us:

  - TokenBucket    — smooths our own outbound call rate to an upstream
                      API under a shared per-minute ceiling, across every
                      process/instance.
  - DistributedCounter — atomic check-and-increment counter with a hard
                      cap (used for the YouTube daily quota).
  - single_flight  — dogpile protection: concurrent callers computing the
                      same expensive value collapse into one real
                      computation.
  - with_retry     — exponential-backoff retry decorator for transient
                      upstream failures.

Everything falls back to an in-process approximation when REDIS_URL isn't
set, so local dev and single-instance deploys keep working unchanged —
Redis is only required for correctness once more than one process/replica
is running at once.
"""

import json
import logging
import os
import random
import threading
import time
from functools import wraps

import redis

log = logging.getLogger(__name__)

REDIS_URL = os.environ.get("REDIS_URL", "").strip()

_redis_client: redis.Redis | None = None
_redis_client_lock = threading.Lock()


def get_redis() -> redis.Redis | None:
    """Lazy singleton Redis client, or None if REDIS_URL isn't configured."""
    global _redis_client
    if not REDIS_URL:
        return None
    if _redis_client is None:
        with _redis_client_lock:
            if _redis_client is None:
                _redis_client = redis.from_url(REDIS_URL, decode_responses=True, socket_timeout=5)
    return _redis_client


class RateLimitTimeout(Exception):
    """Raised when a TokenBucket couldn't grant a token within its timeout."""


# ─────────────────────────────────────────────────────────────────────────────
# TokenBucket — smooth our own outbound rate to a given upstream API
# ─────────────────────────────────────────────────────────────────────────────

_TOKEN_BUCKET_SCRIPT = """
local bucket_key = KEYS[1]
local rate_per_min = tonumber(ARGV[1])
local capacity = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

local data = redis.call("HMGET", bucket_key, "tokens", "ts")
local tokens = tonumber(data[1])
local ts = tonumber(data[2])

if tokens == nil then
  tokens = capacity
  ts = now
end

local elapsed = math.max(0, now - ts)
tokens = math.min(capacity, tokens + elapsed * (rate_per_min / 60.0))

local allowed = 0
if tokens >= 1 then
  tokens = tokens - 1
  allowed = 1
end

redis.call("HMSET", bucket_key, "tokens", tostring(tokens), "ts", tostring(now))
redis.call("EXPIRE", bucket_key, 3600)

return allowed
"""

_local_buckets: dict[str, tuple[float, float]] = {}  # key -> (tokens, last_ts)
_local_buckets_lock = threading.Lock()


class TokenBucket:
    """
    A named, rate-limited gate shared by `key` across every process talking
    to the same Redis instance. `.acquire()` blocks (briefly) until a token
    is available rather than rejecting outright, since these calls are
    backend-to-upstream — queuing a burst is the point, not failing it.
    """

    def __init__(self, key: str, rate_per_min: float, burst: float | None = None):
        self.key = f"tokenbucket:{key}"
        self.rate_per_min = rate_per_min
        self.burst = burst if burst is not None else max(1.0, rate_per_min / 6)

    def _try_redis(self, client: redis.Redis) -> bool:
        allowed = client.eval(_TOKEN_BUCKET_SCRIPT, 1, self.key, self.rate_per_min, self.burst, time.time())
        return bool(allowed)

    def _try_local(self) -> bool:
        now = time.monotonic()
        with _local_buckets_lock:
            tokens, ts = _local_buckets.get(self.key, (self.burst, now))
            elapsed = max(0.0, now - ts)
            tokens = min(self.burst, tokens + elapsed * (self.rate_per_min / 60.0))
            allowed = tokens >= 1
            if allowed:
                tokens -= 1
            _local_buckets[self.key] = (tokens, now)
            return allowed

    def acquire(self, timeout: float = 10.0) -> None:
        client = get_redis()
        try_fn = (lambda: self._try_redis(client)) if client is not None else self._try_local

        deadline = time.monotonic() + timeout
        delay = 0.05
        while True:
            if try_fn():
                return
            if time.monotonic() >= deadline:
                raise RateLimitTimeout(f"Timed out waiting for a rate-limit token: {self.key}")
            time.sleep(delay)
            delay = min(delay * 1.5, 0.5)


# ─────────────────────────────────────────────────────────────────────────────
# DistributedCounter — atomic capped counter (YouTube daily quota)
# ─────────────────────────────────────────────────────────────────────────────

_CAPPED_INCR_SCRIPT = """
local key = KEYS[1]
local amount = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local ttl = tonumber(ARGV[3])

local current = tonumber(redis.call("GET", key))
if current == nil then current = 0 end

if current + amount > limit then
  return 0
end

redis.call("INCRBY", key, amount)
redis.call("EXPIRE", key, ttl)
return 1
"""

_local_counters: dict[str, int] = {}
_local_counters_lock = threading.Lock()


class DistributedCounter:
    """Atomic check-and-increment counter with a hard cap, shared by key
    across every process. `try_increment` returns False (counter left
    unchanged) instead of exceeding `limit`."""

    def __init__(self, prefix: str):
        self.prefix = prefix

    def try_increment(self, key: str, amount: int, limit: int, ttl: int = 90000) -> bool:
        full_key = f"counter:{self.prefix}:{key}"
        client = get_redis()
        if client is not None:
            allowed = client.eval(_CAPPED_INCR_SCRIPT, 1, full_key, amount, limit, ttl)
            return bool(allowed)

        with _local_counters_lock:
            current = _local_counters.get(full_key, 0)
            if current + amount > limit:
                return False
            _local_counters[full_key] = current + amount
            return True

    def reset_local(self) -> None:
        """Test/debug helper — clears the in-process fallback counters."""
        with _local_counters_lock:
            _local_counters.clear()


# ─────────────────────────────────────────────────────────────────────────────
# single_flight — dogpile protection
# ─────────────────────────────────────────────────────────────────────────────

_local_sf_locks: dict[str, threading.Lock] = {}
_local_sf_locks_guard = threading.Lock()


def _local_single_flight(key: str, compute_fn):
    with _local_sf_locks_guard:
        lock = _local_sf_locks.setdefault(key, threading.Lock())
    with lock:
        return compute_fn()


def single_flight(key: str, ttl: int, compute_fn):
    """
    Ensures only one caller actually runs `compute_fn()` for a given `key`
    at a time (across every process, when Redis is configured); concurrent
    callers wait briefly and reuse that result instead of each recomputing
    it. `ttl` bounds both the lock's max hold time and how long a waiter
    will wait before giving up and computing it itself (so a leader that
    dies never wedges its followers).
    """
    client = get_redis()
    if client is None:
        return _local_single_flight(key, compute_fn)

    lock_key = f"sf:lock:{key}"
    result_key = f"sf:result:{key}"

    got_lock = client.set(lock_key, "1", nx=True, px=int(ttl * 1000))
    if got_lock:
        try:
            value = compute_fn()
            client.set(result_key, json.dumps({"v": value}), ex=ttl)
            return value
        finally:
            client.delete(lock_key)

    deadline = time.monotonic() + ttl
    while time.monotonic() < deadline:
        raw = client.get(result_key)
        if raw is not None:
            return json.loads(raw)["v"]
        time.sleep(0.1)

    # Leader never published a result within `ttl` (died, or is just slow) —
    # compute it ourselves rather than wait forever.
    return compute_fn()


# ─────────────────────────────────────────────────────────────────────────────
# with_retry — exponential backoff for transient upstream failures
# ─────────────────────────────────────────────────────────────────────────────

def _backoff_delay(attempt: int, base_delay: float, max_delay: float) -> float:
    return min(max_delay, base_delay * (2 ** (attempt - 1))) + random.uniform(0, base_delay)


def _retry_after_seconds(headers) -> float | None:
    if not headers:
        return None
    raw = headers.get("Retry-After")
    if raw is None:
        return None
    try:
        return max(0.0, float(raw))
    except ValueError:
        return None


def with_retry(exceptions=(Exception,), retryable_status=(429, 500, 502, 503, 504),
                max_attempts=3, base_delay=0.5, max_delay=8.0):
    """
    Retries a function on transient failure, with exponential backoff +
    jitter, honoring a Retry-After header when the wrapped function returns
    a requests-like Response. Two failure modes are handled:
      - the function raises one of `exceptions` (e.g. the upstream helper
        calls resp.raise_for_status() internally)
      - the function returns a Response-like object whose .status_code is
        in `retryable_status` (e.g. the upstream helper returns the raw
        Response and lets the caller decide)
    Never retries a non-retryable status, and re-raises/returns the final
    attempt's failure once max_attempts is exhausted.
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            attempt = 0
            while True:
                attempt += 1
                try:
                    result = fn(*args, **kwargs)
                except exceptions:
                    if attempt >= max_attempts:
                        raise
                    time.sleep(_backoff_delay(attempt, base_delay, max_delay))
                    continue

                status = getattr(result, "status_code", None)
                if status in retryable_status and attempt < max_attempts:
                    delay = _retry_after_seconds(getattr(result, "headers", None))
                    if delay is None:
                        delay = _backoff_delay(attempt, base_delay, max_delay)
                    time.sleep(delay)
                    continue

                return result
        return wrapper
    return decorator
