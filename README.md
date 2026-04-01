# spot-me

A tool that downloads gaming videos, runs OCR on sampled frames, and extracts player usernames with timestamps into a searchable database. Search for any username and see every video and timestamp where they appeared.

## Architecture

```
spot-me/
├── backend/             # FastAPI HTTP API (Cloud Run service)
│   ├── api.py           # REST endpoints — search, stats, scan jobs
│   ├── pipeline.py      # OCR pipeline (download, frame extraction, EasyOCR, Firestore)
│   ├── cli.py           # CLI entry point for Cloud Run Jobs
│   ├── api_requirements.txt
│   └── Dockerfile       # Deploys to Cloud Run (lightweight, CPU-only)
├── frontend/            # Next.js frontend
│   └── src/
│       ├── app/         # Pages: home, /results, /scanning
│       ├── components/  # Header, SearchForm
│       └── lib/api.ts   # API client
├── Dockerfile           # Pipeline worker image (GPU, Cloud Run Jobs)
└── .dockerignore
```

**Data store:** Firestore — `sightings` collection (one doc per detection) + `processed_videos` collection.

**Video titles:** resolved at search time via the Twitch API.

## Backend API

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Liveness check |
| GET | `/api/search?username=xxx` | Search Firestore for a username |
| GET | `/api/videos` | List all processed videos |
| GET | `/api/stats` | Total sightings + videos processed |
| POST | `/api/scan` | Kick off a local pipeline scan (async) |
| GET | `/api/scan/{job_id}/status` | Poll scan job progress |

Search normalizes the query (lowercase, alphanumeric only) to match how the pipeline stores OCR text. Supports Riot IDs (`PlayerName#TAG` — the `#TAG` part is stripped before lookup).

## Local Setup

**Prerequisites**
- Python 3.10+
- Node.js 18+
- FFmpeg — `brew install ffmpeg` / `sudo apt install ffmpeg` / [ffmpeg.org](https://ffmpeg.org/download.html)
- GPU with CUDA 12.x for accelerated OCR (optional — CPU fallback is automatic)

**Backend**

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r api_requirements.txt
uvicorn api:app --reload --port 8000
```

Create `backend/.env`:
```
GOOGLE_CLOUD_PROJECT=your-project-id
TWITCH_CLIENT_ID=your-twitch-client-id
TWITCH_CLIENT_SECRET=your-twitch-client-secret
ENABLE_LOCAL_SCAN=true   # optional — enables POST /api/scan locally
```

**Frontend**

```bash
cd frontend
npm install
npm run dev
```
