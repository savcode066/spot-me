"""
SpotMe FastAPI Backend
======================
Chess.com matchup search: given a viewer's chess.com username, a
streamer's chess.com username, and the streamer's channel, finds every
game the two played against each other and maps each one onto the
streamer's VOD + in-VOD timestamp on Twitch, Kick, or YouTube.

Endpoints:
  GET  /api/health                  — liveness check
  POST /api/chess/search            — chess.com matchups mapped to Twitch VOD timestamps
  POST /api/chess/kick/search       — chess.com matchups mapped to Kick VOD timestamps
  POST /api/chess/youtube/search    — chess.com matchups mapped to YouTube Live timestamps
  POST /api/valorant/search         — Valorant matchups mapped to Twitch VOD timestamps
  POST /api/valorant/kick/search    — Valorant matchups mapped to Kick VOD timestamps
  POST /api/valorant/youtube/search — Valorant matchups mapped to YouTube Live timestamps
  POST /api/dota2/search            — Dota 2 matchups mapped to Twitch VOD timestamps
  POST /api/dota2/kick/search       — Dota 2 matchups mapped to Kick VOD timestamps
  POST /api/dota2/youtube/search    — Dota 2 matchups mapped to YouTube Live timestamps

Run locally:
  cd backend
  uvicorn api:app --reload --port 8000
"""

import logging
import os

import requests
from dotenv import load_dotenv
load_dotenv()  # loads backend/.env

import chess_pipeline
import kick_pipeline
import youtube_pipeline
import valorant_pipeline
import dota2_pipeline
from curl_cffi.requests.exceptions import RequestException as CurlRequestException

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.middleware.base import BaseHTTPMiddleware

log = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

# ─────────────────────────────────────────────────────────────────────────────
# App setup
# ─────────────────────────────────────────────────────────────────────────────

# Rate limiter — keyed by client IP. Backed by Redis when REDIS_URL is set,
# so the limit is shared across every process/instance instead of each one
# silently getting its own independent budget (see backend/rate_limit.py).
_REDIS_URL = os.environ.get("REDIS_URL", "").strip()
if _REDIS_URL:
    limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"], storage_uri=_REDIS_URL)
    log.info("Rate limiter using Redis-backed storage — shared across instances.")
else:
    limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])
    log.warning("REDIS_URL not set — rate limiter is in-memory and per-process only. "
                "Fine for a single instance; under multiple instances each one gets its own independent budget.")

app = FastAPI(title="SpotMe API", version="1.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS — restrict to configured origins; defaults to localhost for dev
_raw_origins = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000")
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        response.headers["Cache-Control"] = "no-store"
        return response


app.add_middleware(SecurityHeadersMiddleware)


# ─────────────────────────────────────────────────────────────────────────────
# Models
# ─────────────────────────────────────────────────────────────────────────────

class ChessSearchRequest(BaseModel):
    user_chess_username: str
    streamer_chess_username: str
    streamer_twitch_username: str


class ChessMatch(BaseModel):
    video_id: str
    video_name: str
    timestamp: int
    opponent: str
    result: str
    time_class: str
    rated: bool
    game_url: str
    played_at: int


class ChessSearchResponse(BaseModel):
    user_chess_username: str
    streamer_chess_username: str
    streamer_twitch_username: str
    results: list[ChessMatch]
    total: int
    vods_scanned: int


class KickChessSearchRequest(BaseModel):
    user_chess_username: str
    streamer_chess_username: str
    streamer_kick_username: str


class KickChessSearchResponse(BaseModel):
    user_chess_username: str
    streamer_chess_username: str
    streamer_kick_username: str
    results: list[ChessMatch]
    total: int
    vods_scanned: int


class YoutubeChessSearchRequest(BaseModel):
    user_chess_username: str
    streamer_chess_username: str
    streamer_youtube_channel: str


class YoutubeChessSearchResponse(BaseModel):
    user_chess_username: str
    streamer_chess_username: str
    streamer_youtube_channel: str
    results: list[ChessMatch]
    total: int
    vods_scanned: int


class ValorantSearchRequest(BaseModel):
    viewer_riot_id: str
    streamer_riot_id: str
    streamer_twitch_username: str


class ValorantMatch(BaseModel):
    video_id: str
    video_name: str
    timestamp: int
    played_at: int
    map: str
    mode: str
    result: str
    teammates: bool
    viewer_agent: str
    streamer_agent: str
    match_url: str


class ValorantSearchResponse(BaseModel):
    viewer_riot_id: str
    streamer_riot_id: str
    streamer_twitch_username: str
    results: list[ValorantMatch]
    total: int
    vods_scanned: int


class KickValorantSearchRequest(BaseModel):
    viewer_riot_id: str
    streamer_riot_id: str
    streamer_kick_username: str


class KickValorantSearchResponse(BaseModel):
    viewer_riot_id: str
    streamer_riot_id: str
    streamer_kick_username: str
    results: list[ValorantMatch]
    total: int
    vods_scanned: int


class YoutubeValorantSearchRequest(BaseModel):
    viewer_riot_id: str
    streamer_riot_id: str
    streamer_youtube_channel: str


class YoutubeValorantSearchResponse(BaseModel):
    viewer_riot_id: str
    streamer_riot_id: str
    streamer_youtube_channel: str
    results: list[ValorantMatch]
    total: int
    vods_scanned: int


class Dota2SearchRequest(BaseModel):
    viewer_dota_id: str
    streamer_dota_id: str
    streamer_twitch_username: str


class Dota2Match(BaseModel):
    video_id: str
    video_name: str
    timestamp: int
    played_at: int
    duration: int
    result: str
    teammates: bool
    viewer_hero: str
    streamer_hero: str
    match_url: str


class Dota2SearchResponse(BaseModel):
    viewer_dota_id: str
    streamer_dota_id: str
    streamer_twitch_username: str
    results: list[Dota2Match]
    total: int
    vods_scanned: int


class KickDota2SearchRequest(BaseModel):
    viewer_dota_id: str
    streamer_dota_id: str
    streamer_kick_username: str


class KickDota2SearchResponse(BaseModel):
    viewer_dota_id: str
    streamer_dota_id: str
    streamer_kick_username: str
    results: list[Dota2Match]
    total: int
    vods_scanned: int


class YoutubeDota2SearchRequest(BaseModel):
    viewer_dota_id: str
    streamer_dota_id: str
    streamer_youtube_channel: str


class YoutubeDota2SearchResponse(BaseModel):
    viewer_dota_id: str
    streamer_dota_id: str
    streamer_youtube_channel: str
    results: list[Dota2Match]
    total: int
    vods_scanned: int


# ─────────────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/health")
@limiter.limit("60/minute")
def health(request: Request):
    return {"status": "ok"}


@app.post("/api/chess/search", response_model=ChessSearchResponse)
@limiter.limit("5/minute")
def chess_search(request: Request, body: ChessSearchRequest):
    """
    On-demand (no Firestore): finds every game between two chess.com players
    and maps each one onto the streamer's Twitch VOD + in-VOD timestamp.
    """
    user_chess = body.user_chess_username.strip()
    streamer_chess = body.streamer_chess_username.strip()
    streamer_twitch = body.streamer_twitch_username.strip()

    if not (user_chess and streamer_chess and streamer_twitch):
        raise HTTPException(status_code=400, detail="All three usernames are required")

    try:
        outcome = chess_pipeline.run_chess_pipeline(user_chess, streamer_chess, streamer_twitch)
    except ValueError as exc:
        if str(exc) == "twitch_channel_not_found":
            raise HTTPException(status_code=404, detail=f"Twitch channel not found: {streamer_twitch}")
        if str(exc) == "chess_user_not_found":
            raise HTTPException(status_code=404, detail=f"chess.com user not found: {user_chess}")
        raise HTTPException(status_code=502, detail=str(exc))
    except requests.RequestException as exc:
        log.exception(f"Chess pipeline upstream request failed: {exc}")
        raise HTTPException(status_code=502, detail="Upstream API request failed")

    results = [ChessMatch(**r) for r in outcome["results"]]

    return ChessSearchResponse(
        user_chess_username=user_chess,
        streamer_chess_username=streamer_chess,
        streamer_twitch_username=streamer_twitch,
        results=results,
        total=len(results),
        vods_scanned=outcome["vods_scanned"],
    )


@app.post("/api/chess/kick/search", response_model=KickChessSearchResponse)
@limiter.limit("5/minute")
def kick_chess_search(request: Request, body: KickChessSearchRequest):
    """
    Same as /api/chess/search but sources VODs from Kick instead of Twitch.
    Kick auto-deletes VODs after ~30 days (verified) / 7 days (unverified),
    so this only ever finds recent matchups, never full history.
    """
    user_chess = body.user_chess_username.strip()
    streamer_chess = body.streamer_chess_username.strip()
    streamer_kick = body.streamer_kick_username.strip()

    if not (user_chess and streamer_chess and streamer_kick):
        raise HTTPException(status_code=400, detail="All three usernames are required")

    try:
        outcome = kick_pipeline.run_kick_chess_pipeline(user_chess, streamer_chess, streamer_kick)
    except ValueError as exc:
        if str(exc) == "kick_channel_not_found":
            raise HTTPException(status_code=404, detail=f"Kick channel not found: {streamer_kick}")
        if str(exc) == "chess_user_not_found":
            raise HTTPException(status_code=404, detail=f"chess.com user not found: {user_chess}")
        raise HTTPException(status_code=502, detail=str(exc))
    except (requests.RequestException, CurlRequestException) as exc:
        log.exception(f"Kick chess pipeline upstream request failed: {exc}")
        raise HTTPException(status_code=502, detail="Upstream API request failed")

    results = [ChessMatch(**r) for r in outcome["results"]]

    return KickChessSearchResponse(
        user_chess_username=user_chess,
        streamer_chess_username=streamer_chess,
        streamer_kick_username=streamer_kick,
        results=results,
        total=len(results),
        vods_scanned=outcome["vods_scanned"],
    )


@app.post("/api/chess/youtube/search", response_model=YoutubeChessSearchResponse)
@limiter.limit("5/minute")
def youtube_chess_search(request: Request, body: YoutubeChessSearchRequest):
    """
    Same as /api/chess/search but sources VODs from YouTube instead of
    Twitch. Only videos that aired via YouTube Live are usable — a
    channel that only posts plain uploads (including delayed re-uploads
    of expired Twitch/Kick VODs) will correctly return zero matches.
    """
    user_chess = body.user_chess_username.strip()
    streamer_chess = body.streamer_chess_username.strip()
    streamer_youtube = body.streamer_youtube_channel.strip()

    if not (user_chess and streamer_chess and streamer_youtube):
        raise HTTPException(status_code=400, detail="All three usernames are required")

    try:
        outcome = youtube_pipeline.run_youtube_chess_pipeline(user_chess, streamer_chess, streamer_youtube)
    except ValueError as exc:
        if str(exc) == "youtube_channel_not_found":
            raise HTTPException(status_code=404, detail=f"YouTube channel not found: {streamer_youtube}")
        if str(exc) == "chess_user_not_found":
            raise HTTPException(status_code=404, detail=f"chess.com user not found: {user_chess}")
        if str(exc) == "youtube_quota_exceeded":
            raise HTTPException(status_code=429, detail="YouTube API daily quota reached; try again after the quota resets (midnight Pacific time).")
        raise HTTPException(status_code=502, detail=str(exc))
    except requests.RequestException as exc:
        log.exception(f"YouTube chess pipeline upstream request failed: {exc}")
        raise HTTPException(status_code=502, detail="Upstream API request failed")

    results = [ChessMatch(**r) for r in outcome["results"]]

    return YoutubeChessSearchResponse(
        user_chess_username=user_chess,
        streamer_chess_username=streamer_chess,
        streamer_youtube_channel=streamer_youtube,
        results=results,
        total=len(results),
        vods_scanned=outcome["vods_scanned"],
    )


_CHANNEL_KIND_LABEL = {"twitch": "Twitch", "kick": "Kick", "youtube": "YouTube"}


def _valorant_http_error(exc: ValueError, channel_kind: str, channel: str, viewer_riot_id: str) -> HTTPException:
    reason = str(exc)
    if reason == f"{channel_kind}_channel_not_found":
        return HTTPException(status_code=404, detail=f"{_CHANNEL_KIND_LABEL[channel_kind]} channel not found: {channel}")
    if reason == "valorant_invalid_riot_id":
        return HTTPException(status_code=400, detail="Riot IDs must be in Name#Tag form")
    if reason == "valorant_account_not_found":
        return HTTPException(status_code=404, detail=f"Riot account not found: {viewer_riot_id}")
    if reason == "valorant_rate_limited":
        return HTTPException(status_code=429, detail="Valorant match data API rate limit reached; try again shortly.")
    return HTTPException(status_code=502, detail=reason)


@app.post("/api/valorant/search", response_model=ValorantSearchResponse)
@limiter.limit("5/minute")
def valorant_search(request: Request, body: ValorantSearchRequest):
    """
    On-demand: finds every Valorant match between two Riot IDs and maps
    each one onto the streamer's Twitch VOD + in-VOD timestamp.
    """
    viewer = body.viewer_riot_id.strip()
    streamer = body.streamer_riot_id.strip()
    twitch = body.streamer_twitch_username.strip()

    if not (viewer and streamer and twitch):
        raise HTTPException(status_code=400, detail="Both Riot IDs and the streamer's Twitch username are required")

    try:
        outcome = valorant_pipeline.run_valorant_pipeline(viewer, streamer, twitch)
    except ValueError as exc:
        raise _valorant_http_error(exc, "twitch", twitch, viewer)
    except requests.RequestException as exc:
        log.exception(f"Valorant pipeline upstream request failed: {exc}")
        raise HTTPException(status_code=502, detail="Upstream API request failed")

    results = [ValorantMatch(**r) for r in outcome["results"]]

    return ValorantSearchResponse(
        viewer_riot_id=viewer,
        streamer_riot_id=streamer,
        streamer_twitch_username=twitch,
        results=results,
        total=len(results),
        vods_scanned=outcome["vods_scanned"],
    )


@app.post("/api/valorant/kick/search", response_model=KickValorantSearchResponse)
@limiter.limit("5/minute")
def kick_valorant_search(request: Request, body: KickValorantSearchRequest):
    """Same as /api/valorant/search but sources VODs from Kick instead of Twitch."""
    viewer = body.viewer_riot_id.strip()
    streamer = body.streamer_riot_id.strip()
    kick = body.streamer_kick_username.strip()

    if not (viewer and streamer and kick):
        raise HTTPException(status_code=400, detail="Both Riot IDs and the streamer's Kick username are required")

    try:
        outcome = valorant_pipeline.run_kick_valorant_pipeline(viewer, streamer, kick)
    except ValueError as exc:
        raise _valorant_http_error(exc, "kick", kick, viewer)
    except (requests.RequestException, CurlRequestException) as exc:
        log.exception(f"Kick Valorant pipeline upstream request failed: {exc}")
        raise HTTPException(status_code=502, detail="Upstream API request failed")

    results = [ValorantMatch(**r) for r in outcome["results"]]

    return KickValorantSearchResponse(
        viewer_riot_id=viewer,
        streamer_riot_id=streamer,
        streamer_kick_username=kick,
        results=results,
        total=len(results),
        vods_scanned=outcome["vods_scanned"],
    )


@app.post("/api/valorant/youtube/search", response_model=YoutubeValorantSearchResponse)
@limiter.limit("5/minute")
def youtube_valorant_search(request: Request, body: YoutubeValorantSearchRequest):
    """Same as /api/valorant/search but sources VODs from YouTube Live instead of Twitch."""
    viewer = body.viewer_riot_id.strip()
    streamer = body.streamer_riot_id.strip()
    youtube = body.streamer_youtube_channel.strip()

    if not (viewer and streamer and youtube):
        raise HTTPException(status_code=400, detail="Both Riot IDs and the streamer's YouTube channel are required")

    try:
        outcome = valorant_pipeline.run_youtube_valorant_pipeline(viewer, streamer, youtube)
    except ValueError as exc:
        raise _valorant_http_error(exc, "youtube", youtube, viewer)
    except requests.RequestException as exc:
        log.exception(f"YouTube Valorant pipeline upstream request failed: {exc}")
        raise HTTPException(status_code=502, detail="Upstream API request failed")

    results = [ValorantMatch(**r) for r in outcome["results"]]

    return YoutubeValorantSearchResponse(
        viewer_riot_id=viewer,
        streamer_riot_id=streamer,
        streamer_youtube_channel=youtube,
        results=results,
        total=len(results),
        vods_scanned=outcome["vods_scanned"],
    )


def _dota2_http_error(exc: ValueError, channel_kind: str, channel: str, viewer_dota_id: str) -> HTTPException:
    reason = str(exc)
    if reason == f"{channel_kind}_channel_not_found":
        return HTTPException(status_code=404, detail=f"{_CHANNEL_KIND_LABEL[channel_kind]} channel not found: {channel}")
    if reason == "dota2_invalid_id":
        return HTTPException(status_code=400, detail="Dota 2 IDs must be numeric Steam32 account IDs (the \"Friend ID\" shown in your Dota 2 profile)")
    if reason == "dota2_account_not_found":
        return HTTPException(status_code=404, detail=f"Dota 2 account not found: {viewer_dota_id}")
    if reason == "dota2_rate_limited":
        return HTTPException(status_code=429, detail="Dota 2 match data API rate limit reached; try again shortly.")
    return HTTPException(status_code=502, detail=reason)


@app.post("/api/dota2/search", response_model=Dota2SearchResponse)
@limiter.limit("5/minute")
def dota2_search(request: Request, body: Dota2SearchRequest):
    """
    On-demand: finds every Dota 2 match between two Steam32 account IDs and
    maps each one onto the streamer's Twitch VOD + in-VOD timestamp.
    """
    viewer = body.viewer_dota_id.strip()
    streamer = body.streamer_dota_id.strip()
    twitch = body.streamer_twitch_username.strip()

    if not (viewer and streamer and twitch):
        raise HTTPException(status_code=400, detail="Both Dota 2 IDs and the streamer's Twitch username are required")

    try:
        outcome = dota2_pipeline.run_dota2_pipeline(viewer, streamer, twitch)
    except ValueError as exc:
        raise _dota2_http_error(exc, "twitch", twitch, viewer)
    except requests.RequestException as exc:
        log.exception(f"Dota 2 pipeline upstream request failed: {exc}")
        raise HTTPException(status_code=502, detail="Upstream API request failed")

    results = [Dota2Match(**r) for r in outcome["results"]]

    return Dota2SearchResponse(
        viewer_dota_id=viewer,
        streamer_dota_id=streamer,
        streamer_twitch_username=twitch,
        results=results,
        total=len(results),
        vods_scanned=outcome["vods_scanned"],
    )


@app.post("/api/dota2/kick/search", response_model=KickDota2SearchResponse)
@limiter.limit("5/minute")
def kick_dota2_search(request: Request, body: KickDota2SearchRequest):
    """Same as /api/dota2/search but sources VODs from Kick instead of Twitch."""
    viewer = body.viewer_dota_id.strip()
    streamer = body.streamer_dota_id.strip()
    kick = body.streamer_kick_username.strip()

    if not (viewer and streamer and kick):
        raise HTTPException(status_code=400, detail="Both Dota 2 IDs and the streamer's Kick username are required")

    try:
        outcome = dota2_pipeline.run_kick_dota2_pipeline(viewer, streamer, kick)
    except ValueError as exc:
        raise _dota2_http_error(exc, "kick", kick, viewer)
    except (requests.RequestException, CurlRequestException) as exc:
        log.exception(f"Kick Dota 2 pipeline upstream request failed: {exc}")
        raise HTTPException(status_code=502, detail="Upstream API request failed")

    results = [Dota2Match(**r) for r in outcome["results"]]

    return KickDota2SearchResponse(
        viewer_dota_id=viewer,
        streamer_dota_id=streamer,
        streamer_kick_username=kick,
        results=results,
        total=len(results),
        vods_scanned=outcome["vods_scanned"],
    )


@app.post("/api/dota2/youtube/search", response_model=YoutubeDota2SearchResponse)
@limiter.limit("5/minute")
def youtube_dota2_search(request: Request, body: YoutubeDota2SearchRequest):
    """Same as /api/dota2/search but sources VODs from YouTube Live instead of Twitch."""
    viewer = body.viewer_dota_id.strip()
    streamer = body.streamer_dota_id.strip()
    youtube = body.streamer_youtube_channel.strip()

    if not (viewer and streamer and youtube):
        raise HTTPException(status_code=400, detail="Both Dota 2 IDs and the streamer's YouTube channel are required")

    try:
        outcome = dota2_pipeline.run_youtube_dota2_pipeline(viewer, streamer, youtube)
    except ValueError as exc:
        raise _dota2_http_error(exc, "youtube", youtube, viewer)
    except requests.RequestException as exc:
        log.exception(f"YouTube Dota 2 pipeline upstream request failed: {exc}")
        raise HTTPException(status_code=502, detail="Upstream API request failed")

    results = [Dota2Match(**r) for r in outcome["results"]]

    return YoutubeDota2SearchResponse(
        viewer_dota_id=viewer,
        streamer_dota_id=streamer,
        streamer_youtube_channel=youtube,
        results=results,
        total=len(results),
        vods_scanned=outcome["vods_scanned"],
    )
