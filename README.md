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

## Deployment

### Backend API — Cloud Run

```powershell
# Build and push to Artifact Registry
docker build -t us-central1-docker.pkg.dev/project-7840866c-14fa-48de-bec/spot-me/backend:latest .

docker push us-central1-docker.pkg.dev/project-7840866c-14fa-48de-bec/spot-me/backend:latest

# Deploy (or redeploy) to Cloud Run
gcloud run deploy spot-me-backend --image us-central1-docker.pkg.dev/project-7840866c-14fa-48de-bec/spot-me/backend:latest --platform managed --region us-central1 --allow-unauthenticated --port 8080
```

Only the last command is needed for subsequent deploys after the first.

**First-time setup:**
```powershell
gcloud services enable run.googleapis.com artifactregistry.googleapis.com
gcloud auth configure-docker us-central1-docker.pkg.dev
gcloud artifacts repositories create spot-me --repository-format=docker --location=us-central1
```

### Pipeline Worker — Cloud Run Jobs (GPU)

The root `Dockerfile` targets Cloud Run Jobs with an NVIDIA L4 GPU.

```bash
docker build -t gcr.io/YOUR_PROJECT/spot-me .
docker push gcr.io/YOUR_PROJECT/spot-me

gcloud run jobs create spot-me \
  --image gcr.io/YOUR_PROJECT/spot-me \
  --region us-central1 \
  --task-timeout 3600 \
  --set-env-vars COOKIES_SECRET=projects/YOUR_PROJECT/secrets/yt-cookies/versions/latest \
  --args="https://www.twitch.tv/videos/VIDEO_ID"

gcloud run jobs execute spot-me
```

## Cookies

yt-dlp needs YouTube cookies for age-restricted or account-specific content.

**Local dev** — place `cookies.txt` in the project root (never committed).

**Cloud Run** — store in Secret Manager:
```bash
gcloud secrets create yt-cookies --data-file=cookies.txt

# Grant the Cloud Run service account access
gcloud secrets add-iam-policy-binding yt-cookies \
  --member="serviceAccount:YOUR_SA@YOUR_PROJECT.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

To rotate: `gcloud secrets versions add yt-cookies --data-file=cookies.txt`

Pipeline resolves cookies in order: `COOKIES_SECRET` env var → local `cookies.txt` → no cookies (public only).

## Pipeline CLI

Run the pipeline directly (bypasses the API):

```bash
python cli.py <url> [--sample-sec N] [--max-duration N]
```

| Argument | Description | Default |
|---|---|---|
| `url` | Single video URL or channel/playlist | required |
| `--sample-sec` | Seconds between sampled frames | `3` |
| `--max-duration` | Skip videos longer than N seconds | none |
