"""
SpotMe FastAPI Backend
======================
Exposes the OCR pipeline as an HTTP API consumed by the Next.js frontend.

Endpoints:
  GET  /api/health                  — liveness check
  GET  /api/search?username=xxx     — search Firestore for a username
  GET  /api/videos                  — list all processed videos
  GET  /api/stats                   — total sightings + videos processed
  POST /api/scan                    — kick off a local pipeline scan (async)
  GET  /api/scan/{job_id}/status    — poll scan job progress

Run locally:
  cd backend
  uvicorn api:app --reload --port 8000
"""

import logging
import os
import re
import threading
import uuid
from typing import Dict, List, Optional

import requests
from dotenv import load_dotenv
load_dotenv()  # loads backend/.env so GOOGLE_CLOUD_PROJECT is available

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from google.cloud import firestore
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

# Rate limiter — keyed by client IP
limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])

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

db = firestore.Client()

# In-memory scan job store  { job_id: {status, progress, error?} }
_scan_jobs: Dict[str, dict] = {}
_scan_lock = threading.Lock()

_NON_ALNUM = re.compile(r"[^a-z0-9]")
_UUID_RE   = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")

TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token"
TWITCH_API_BASE  = "https://api.twitch.tv/helix"

# Twitch / Riot username constraints: max 50 chars covers "Name#TAG" formats
USERNAME_MAX_LEN = 50


def _normalize(text: str) -> str:
    return _NON_ALNUM.sub("", text.lower())


def _get_twitch_token() -> str:
    resp = requests.post(TWITCH_TOKEN_URL, params={
        "client_id":     os.environ["TWITCH_CLIENT_ID"],
        "client_secret": os.environ["TWITCH_CLIENT_SECRET"],
        "grant_type":    "client_credentials",
    }, timeout=10)
    resp.raise_for_status()
    return resp.json()["access_token"]


def _fetch_video_names(video_ids: List[str]) -> Dict[str, str]:
    """Return {video_id: title} for each id. Falls back to the id on error."""
    if not video_ids:
        return {}
    token = _get_twitch_token()
    headers = {
        "Client-ID":     os.environ["TWITCH_CLIENT_ID"],
        "Authorization": f"Bearer {token}",
    }
    names: Dict[str, str] = {}

    vod_ids  = [v for v in video_ids if v.isdigit()]
    clip_ids = [v for v in video_ids if not v.isdigit()]

    for i in range(0, len(vod_ids), 100):
        chunk = vod_ids[i:i + 100]
        resp = requests.get(f"{TWITCH_API_BASE}/videos", headers=headers,
                            params=[("id", v) for v in chunk], timeout=10)
        resp.raise_for_status()
        for item in resp.json().get("data", []):
            names[str(item["id"])] = item["title"]

    for i in range(0, len(clip_ids), 100):
        chunk = clip_ids[i:i + 100]
        resp = requests.get(f"{TWITCH_API_BASE}/clips", headers=headers,
                            params=[("id", v) for v in chunk], timeout=10)
        resp.raise_for_status()
        for item in resp.json().get("data", []):
            names[str(item["id"])] = item["title"]

    return names


# ─────────────────────────────────────────────────────────────────────────────
# Models
# ─────────────────────────────────────────────────────────────────────────────

class ScanRequest(BaseModel):
    url: str
    sample_sec: float = 3.0


class Detection(BaseModel):
    video_id: str
    video_name: str
    timestamp: int
    confidence: float
    raw_text: str


class SearchResponse(BaseModel):
    username: str
    normalized: str
    results: List[Detection]
    total: int


class VideoEntry(BaseModel):
    video_id: str
    hit_count: int


class StatsResponse(BaseModel):
    total_videos: int
    total_sightings: int


class ScanResponse(BaseModel):
    job_id: str
    status: str


class JobStatus(BaseModel):
    job_id: str
    status: str          # starting | running | done | error
    progress: int        # 0-100
    error: Optional[str] = None


# ─────────────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/health")
@limiter.limit("60/minute")
def health(request: Request):
    return {"status": "ok", "storage": "firestore"}


@app.get("/api/search", response_model=SearchResponse)
@limiter.limit("20/minute")
def search(
    request: Request,
    username: str = Query(..., min_length=1, max_length=USERNAME_MAX_LEN),
):
    """
    Look up a username (or Riot ID like PlayerName#TAG) in Firestore.
    Normalizes the query the same way pipeline.py normalizes OCR text.
    """
    # Strip Riot tag suffix (#TAG), then normalize to alphanumeric lowercase
    base       = re.sub(r"#\S+$", "", username.strip())
    normalized = _normalize(base)

    if not normalized:
        raise HTTPException(status_code=400, detail="Username contains no alphanumeric characters")

    docs = (
        db.collection("sightings")
        .where("username_normalized", "==", normalized)
        .stream()
    )

    raw_detections = [doc.to_dict() for doc in docs]

    unique_ids = list({d.get("video_id", "") for d in raw_detections if d.get("video_id")})
    video_names = _fetch_video_names(unique_ids)

    detections = [
        Detection(
            video_id=d.get("video_id", ""),
            video_name=video_names.get(str(d.get("video_id", "")), d.get("video_id", "")),
            timestamp=d.get("timestamp", 0),
            confidence=d.get("confidence", 0.0),
            raw_text=d.get("raw_text", ""),
        )
        for d in raw_detections
    ]

    return SearchResponse(
        username=username.strip(),
        normalized=normalized,
        results=detections,
        total=len(detections),
    )


@app.get("/api/videos", response_model=List[VideoEntry])
@limiter.limit("30/minute")
def list_videos(request: Request):
    """Return all processed videos with their sighting counts."""
    docs = db.collection("processed_videos").stream()
    return [
        VideoEntry(
            video_id=doc.id,
            hit_count=doc.to_dict().get("hit_count", 0),
        )
        for doc in docs
    ]


@app.get("/api/stats", response_model=StatsResponse)
@limiter.limit("30/minute")
def stats(request: Request):
    """Return total processed videos and total sightings counts."""
    videos_count    = len(list(db.collection("processed_videos").stream()))
    sightings_count = len(list(db.collection("sightings").stream()))
    return StatsResponse(
        total_videos=videos_count,
        total_sightings=sightings_count,
    )


@app.post("/api/scan", response_model=ScanResponse)
@limiter.limit("5/minute")
def start_scan(request: Request, body: ScanRequest):
    """
    Kick off an async local pipeline scan.
    For production-scale processing use Cloud Run Jobs instead.
    """
    if os.environ.get("ENABLE_LOCAL_SCAN", "false").lower() != "true":
        raise HTTPException(
            status_code=403,
            detail="Local scanning is disabled. To enable for local dev, set ENABLE_LOCAL_SCAN=true in your .env file."
        )

    log.warning("Local scan triggered — for large jobs prefer Cloud Run Jobs.")

    job_id = str(uuid.uuid4())

    with _scan_lock:
        _scan_jobs[job_id] = {"status": "starting", "progress": 0, "error": None}

    def _run():
        try:
            os.environ["FIRESTORE_ENABLED"] = "true"
            import pipeline  # lazy import — only needed when scan is triggered

            pipeline.FRAME_SAMPLE_SEC = body.sample_sec

            with _scan_lock:
                _scan_jobs[job_id]["status"] = "running"

            pipeline.run_pipeline(body.url)

            with _scan_lock:
                _scan_jobs[job_id]["status"]   = "done"
                _scan_jobs[job_id]["progress"] = 100

        except Exception as exc:
            log.error(f"[{job_id}] Scan failed: {exc}", exc_info=True)
            with _scan_lock:
                _scan_jobs[job_id]["status"] = "error"
                _scan_jobs[job_id]["error"]  = str(exc)

    thread = threading.Thread(target=_run, daemon=True, name=f"scan-{job_id[:8]}")
    thread.start()

    return ScanResponse(job_id=job_id, status="starting")


@app.get("/api/scan/{job_id}/status", response_model=JobStatus)
@limiter.limit("60/minute")
def scan_status(request: Request, job_id: str):
    """Poll the status and progress of a running scan job."""
    if not _UUID_RE.match(job_id):
        raise HTTPException(status_code=400, detail="Invalid job ID format")

    with _scan_lock:
        job = _scan_jobs.get(job_id)

    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    return JobStatus(
        job_id=job_id,
        status=job["status"],
        progress=job["progress"],
        error=job.get("error"),
    )
