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

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google.cloud import firestore
from pydantic import BaseModel

log = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

# ─────────────────────────────────────────────────────────────────────────────
# App setup
# ─────────────────────────────────────────────────────────────────────────────

app = FastAPI(title="SpotMe API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

db = firestore.Client()

# In-memory scan job store  { job_id: {status, progress, error?} }
_scan_jobs: Dict[str, dict] = {}
_scan_lock = threading.Lock()

_NON_ALNUM = re.compile(r"[^a-z0-9]")


def _normalize(text: str) -> str:
    return _NON_ALNUM.sub("", text.lower())


# ─────────────────────────────────────────────────────────────────────────────
# Models
# ─────────────────────────────────────────────────────────────────────────────

class ScanRequest(BaseModel):
    url: str
    sample_sec: float = 3.0


class Detection(BaseModel):
    video_id: str
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
def health():
    return {"status": "ok", "storage": "firestore"}


@app.get("/api/search", response_model=SearchResponse)
def search(username: str):
    """
    Look up a username (or Riot ID like PlayerName#TAG) in Firestore.
    Normalizes the query the same way pipeline.py normalizes OCR text.
    """
    if not username.strip():
        raise HTTPException(status_code=400, detail="username is required")

    base       = re.sub(r"#\S+$", "", username.strip())
    normalized = _normalize(base)

    docs = (
        db.collection("sightings")
        .where("username_normalized", "==", normalized)
        .stream()
    )

    detections = [
        Detection(
            video_id=d.get("video_id", ""),
            timestamp=d.get("timestamp", 0),
            confidence=d.get("confidence", 0.0),
            raw_text=d.get("raw_text", ""),
        )
        for doc in docs
        for d in [doc.to_dict()]
    ]

    return SearchResponse(
        username=username,
        normalized=normalized,
        results=detections,
        total=len(detections),
    )


@app.get("/api/videos", response_model=List[VideoEntry])
def list_videos():
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
def stats():
    """Return total processed videos and total sightings counts."""
    videos_count   = len(list(db.collection("processed_videos").stream()))
    sightings_count = len(list(db.collection("sightings").stream()))
    return StatsResponse(
        total_videos=videos_count,
        total_sightings=sightings_count,
    )


@app.post("/api/scan", response_model=ScanResponse)
def start_scan(body: ScanRequest):
    """
    Kick off an async local pipeline scan.
    For production-scale processing use Cloud Run Jobs instead.
    """
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
def scan_status(job_id: str):
    """Poll the status and progress of a running scan job."""
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
