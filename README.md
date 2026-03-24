# spot-me

A high-performance Python pipeline that downloads YouTube gaming videos, samples frames efficiently, runs OCR, and extracts usernames with timestamps into a searchable JSON index.

Supports single video URLs, full channel URLs, and GPU-accelerated OCR via EasyOCR. Deployable to Google Cloud Run Jobs with an NVIDIA L4 GPU using the included Dockerfile.

## Features

- Accepts a single video URL or an entire YouTube channel/playlist
- Downloads at max 720p via `yt-dlp`
- Samples 1 frame every 3 seconds instead of every frame
- Adaptive frame skipping — static/frozen frames are skipped before OCR runs
- GPU-accelerated OCR via EasyOCR (falls back to CPU automatically)
- Deduplicates repeated detections within nearby frames
- Stores results in an inverted index: `normalized_username → [{video_id, timestamp, confidence, raw_text}]`
- Incremental JSON checkpointing after every video — safe to interrupt and resume
- Downloads up to 4 videos in parallel; processes each immediately then deletes the local file
- Dockerized for Google Cloud Run Jobs with NVIDIA L4 GPU support

## Project Structure

```
spot-me/
├── main.py          # Entry point — CLI args, kicks off the pipeline
├── pipeline.py      # All pipeline logic (download, frame extraction, OCR, storage)
├── Dockerfile       # Cloud Run Jobs deployment (GDC base-cu121, L4 GPU)
├── .dockerignore
└── requirements.txt
```

## Local Setup

**Prerequisites**
- Python 3.10+
- FFmpeg installed on your system
  - Windows: download from https://ffmpeg.org/download.html
  - Linux: `sudo apt-get install ffmpeg`
  - macOS: `brew install ffmpeg`
- An NVIDIA GPU with CUDA 12.x for GPU-accelerated OCR (optional — CPU fallback is automatic)

**Install**

```bash
python -m venv venv

# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
pip install easyocr yt-dlp opencv-python-headless
```

## Usage

```bash
python main.py <url> [--sample-sec N] [--checkpoint FILE]
```

| Argument | Description | Default |
|---|---|---|
| `url` | Single video URL or channel/playlist URL | required |
| `--sample-sec` | Seconds between sampled frames | `3` |
| `--checkpoint` | Path to JSON results file | `results.json` |

**Examples**

```bash
# Single video
python main.py https://www.youtube.com/watch?v=VIDEO_ID

# Full channel
python main.py https://www.youtube.com/@SomeGamer/videos

# Sample every 5 seconds, save to a custom file
python main.py https://www.youtube.com/@SomeGamer/videos --sample-sec 5 --checkpoint run1.json

# Resume an interrupted run (already-processed video IDs are skipped automatically)
python main.py https://www.youtube.com/@SomeGamer/videos --checkpoint run1.json
```

## Output

Results are written to `results.json` (or `--checkpoint` path) after every video:

```json
{
  "dragonslayer": [
    {
      "video_id": "aFTvKwmlrcg",
      "timestamp": 47,
      "confidence": 0.921,
      "raw_text": "DragonSlayer!"
    }
  ],
  "xxtrickshot99": [
    {
      "video_id": "aFTvKwmlrcg",
      "timestamp": 182,
      "confidence": 0.884,
      "raw_text": "xxTrickShot99"
    }
  ]
}
```

Text is normalized to lowercase alphanumeric (`DragonSlayer!` → `dragonslayer`) for consistent keying.

## Docker / Cloud Run Jobs

The Dockerfile targets Google Cloud Run Jobs with an NVIDIA L4 GPU.

**Build and push**

```bash
docker build -t gcr.io/YOUR_PROJECT/spot-me .
docker push gcr.io/YOUR_PROJECT/spot-me
```

**Create and run a Cloud Run Job**

```bash
gcloud run jobs create spot-me \
  --image gcr.io/YOUR_PROJECT/spot-me \
  --region us-central1 \
  --task-timeout 3600 \
  --set-env-vars BUCKET_NAME=your-gcs-bucket \
  --args="https://www.youtube.com/@SomeGamer/videos","--sample-sec","5"

gcloud run jobs execute spot-me
```

**Notes**
- The EasyOCR English model weights are baked into the image at build time — no cold-start download on every run
- `BUCKET_NAME` is read from the environment; set it in the Job configuration for GCS output
- `opencv-python-headless` is used instead of `opencv-python` — no GUI dependencies needed in the container
