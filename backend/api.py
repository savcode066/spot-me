"""
SpotMe FastAPI Backend
======================
Exposes the OCR pipeline as an HTTP API consumed by the Next.js frontend.

Endpoints:
  GET  /api/health                  — liveness check
  GET  /api/search?username=xxx     — search the results index for a username
  POST /api/scan                    — kick off a new scan job (async, background)
  GET  /api/scan/{job_id}/status    — poll scan job progress

Run locally:
  cd backend
  uvicorn api:app --reload --port 8000
"""

import json
import logging
import os
import re
import threading
import uuid
from pathlib import Path
from typing import Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
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

# Results JSON lives one level up from backend/ by default, or override via env.
RESULTS_FILE = Path(os.environ.get("RESULTS_FILE", Path(__file__).parent.parent / "results.json"))

# In-memory scan job store  { job_id: {status, progress, error?} }
_scan_jobs: Dict[str, dict] = {}
_scan_lock = threading.Lock()

_NON_ALNUM = re.compile(r"[^a-z0-9]")


def _normalize(text: str) -> str:
    return _NON_ALNUM.sub("", text.lower())


def _load_results() -> dict:
    if not RESULTS_FILE.exists():
        return {}
    try:
        return json.loads(RESULTS_FILE.read_text(encoding="utf-8"))
    except Exception as exc:
        log.error(f"Failed to read {RESULTS_FILE}: {exc}")
        return {}


# ─────────────────────────────────────────────────────────────────────────────
# Models
# ─────────────────────────────────────────────────────────────────────────────

class ScanRequest(BaseModel):
    url: str
    sample_sec: float = 3.0
    checkpoint: Optional[str] = None


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
    return {"status": "ok", "results_file": str(RESULTS_FILE), "results_exist": RESULTS_FILE.exists()}


@app.get("/api/search", response_model=SearchResponse)
def search(username: str):
    """
    Look up a username (or RIOT ID like PlayerName#TAG) in the pre-built index.
    Normalizes the query the same way pipeline.py normalizes OCR text.
    """
    if not username.strip():
        raise HTTPException(status_code=400, detail="username is required")

    # Strip #tag before normalizing so "Name#TAG" matches "name"
    base = re.sub(r"#\S+$", "", username.strip())
    normalized = _normalize(base)

    data = _load_results()
    detections = data.get(normalized, [])

    return SearchResponse(
        username=username,
        normalized=normalized,
        results=[Detection(**d) for d in detections],
        total=len(detections),
    )


@app.post("/api/scan", response_model=ScanResponse)
def start_scan(body: ScanRequest):
    """
    Kick off an async pipeline scan for the given YouTube URL.
    Returns a job_id that can be polled via GET /api/scan/{job_id}/status.
    """
    job_id = str(uuid.uuid4())

    with _scan_lock:
        _scan_jobs[job_id] = {"status": "starting", "progress": 0, "error": None}

    def _run():
        try:
            import pipeline  # lazy import — only needed when scan is triggered

            pipeline.FRAME_SAMPLE_SEC = body.sample_sec
            if body.checkpoint:
                pipeline.CHECKPOINT_FILE = body.checkpoint

            with _scan_lock:
                _scan_jobs[job_id]["status"] = "running"

            pipeline.run_pipeline(body.url)

            with _scan_lock:
                _scan_jobs[job_id]["status"] = "done"
                _scan_jobs[job_id]["progress"] = 100

        except Exception as exc:
            log.error(f"[{job_id}] Scan failed: {exc}", exc_info=True)
            with _scan_lock:
                _scan_jobs[job_id]["status"] = "error"
                _scan_jobs[job_id]["error"] = str(exc)

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
