# ─────────────────────────────────────────────────────────────────────────────
# Base: Google Deep Learning Container with CUDA 11.8 + Python 3.10
# Includes cuDNN, NCCL, and NVIDIA drivers — no manual driver install needed.
# Compatible with the NVIDIA L4 GPU available on Cloud Run Jobs.
# ─────────────────────────────────────────────────────────────────────────────
FROM us-docker.pkg.dev/deeplearning-platform-release/gcr.io/base-cu118

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    EASYOCR_MODULE_PATH=/app/.EasyOCR \
    BUCKET_NAME=""

# ─────────────────────────────────────────────────────────────────────────────
# System dependencies
#   libglib2.0-0, libgl1  → required by OpenCV even in headless mode
#   ffmpeg                → used by yt-dlp to merge video+audio streams
#   nodejs 20             → JS runtime for yt-dlp n-challenge solving
#                           (Ubuntu 22.04 apt ships v12 which is too old)
# ─────────────────────────────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libgl1 \
    libsm6 \
    libxext6 \
    ffmpeg \
    curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ─────────────────────────────────────────────────────────────────────────────
# Python dependencies (single pip call, no requirements.txt)
#
# - numpy<2 pinned because torch 2.1.2 was compiled against numpy 1.x
# - torch/torchvision pulled from the PyTorch CUDA 11.8 wheel index
# - opencv-python-headless instead of opencv-python (no GUI needed)
# ─────────────────────────────────────────────────────────────────────────────
RUN pip install --no-cache-dir \
        "numpy<2.0.0" \
        torch==2.1.2+cu118 \
        torchvision==0.16.2+cu118 \
        opencv-python-headless \
        easyocr \
        yt-dlp \
        fuzzywuzzy \
        ffmpeg-python \
        Pillow \
        google-cloud-storage \
        google-cloud-secret-manager \
        --extra-index-url https://download.pytorch.org/whl/cu118

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