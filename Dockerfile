# ─────────────────────────────────────────────────────────────────────────────
# Base: Google Deep Learning Container with CUDA 12.1 + Python 3.10
# Includes cuDNN, NCCL, and NVIDIA drivers — no manual driver install needed.
# Compatible with the NVIDIA L4 GPU available on Cloud Run Jobs.
# ─────────────────────────────────────────────────────────────────────────────
FROM us-docker.pkg.dev/deeplearning-platform-release/gcr.io/base-cu118

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    # EasyOCR stores downloaded model weights here.
    # Baking this into the image avoids a cold-start download on every Job run.
    EASYOCR_MODULE_PATH=/app/.EasyOCR \
    # Placeholder — set the real value in your Cloud Run Job configuration.
    BUCKET_NAME=""

# ─────────────────────────────────────────────────────────────────────────────
# System dependencies
#   libglib2.0-0, libgl1  → required by OpenCV even in headless mode
#   ffmpeg                → used by yt-dlp to merge video+audio streams
# ─────────────────────────────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libgl1 \
    libsm6 \
    libxext6 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ─────────────────────────────────────────────────────────────────────────────
# Python dependencies
# Copy requirements.txt first so Docker can cache this layer independently
# from the application code. A code-only change won't re-run pip install.
#
# opencv-python-headless replaces opencv-python from requirements.txt:
# no GUI / X11 libs needed in a container, and saves ~100 MB of image size.
# ─────────────────────────────────────────────────────────────────────────────
COPY requirements.txt .

RUN pip install --no-cache-dir \
        $(grep -v "^opencv-python" requirements.txt | tr '\n' ' ') \
        opencv-python-headless \
        easyocr \
        yt-dlp \
        google-cloud-storage \
        google-cloud-secret-manager


# ─────────────────────────────────────────────────────────────────────────────
# Pre-download EasyOCR English model weights into the image at build time.
# Cloud Build has no GPU, so we initialise with gpu=False — the weights are
# architecture-agnostic and will be picked up by the GPU at runtime without
# any network calls, eliminating cold-start latency on every Job invocation.
# ─────────────────────────────────────────────────────────────────────────────
RUN python -c "import easyocr; easyocr.Reader(['en'], gpu=False, verbose=False)"

# ─────────────────────────────────────────────────────────────────────────────
# Application code — copied last so code edits don't bust the layers above.
# ─────────────────────────────────────────────────────────────────────────────
COPY main.py pipeline.py ./

# ─────────────────────────────────────────────────────────────────────────────
# Entrypoint
# Cloud Run Jobs run the container to completion, not as a long-lived server.
# Pass the YouTube URL and any flags via the Job's "args" configuration field.
#   e.g. args: ["https://www.youtube.com/watch?v=VIDEO_ID", "--sample-sec", "5"]
# ─────────────────────────────────────────────────────────────────────────────
ENTRYPOINT ["python", "main.py"]
