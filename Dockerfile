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
# ─────────────────────────────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libgl1 \
    libsm6 \
    libxext6 \
    ffmpeg \
    nodejs \
    && rm -rf /var/lib/apt/lists/*
 
WORKDIR /app
 
# ─────────────────────────────────────────────────────────────────────────────
# Python dependencies
#
# 1) Pin PyTorch + torchvision for CUDA 11.8 FIRST — this prevents easyocr
#    or any other dep from pulling the latest torch with CUDA 13.x bindings,
#    which is incompatible with the Cloud Run L4 driver (version 520.x).
#
# 2) Then install everything else. easyocr will see torch is already
#    satisfied and skip re-installing it.
#
# opencv-python-headless replaces opencv-python from requirements.txt:
# no GUI / X11 libs needed in a container, and saves ~100 MB of image size.
# ─────────────────────────────────────────────────────────────────────────────
RUN pip install --no-cache-dir \
        torch==2.1.2+cu118 torchvision==0.16.2+cu118 \
        --index-url https://download.pytorch.org/whl/cu118
 
COPY requirements.txt .
 
RUN pip install --no-cache-dir \
        "numpy<2" \
        $(grep -v "^opencv-python" requirements.txt | tr '\n' ' ') \
        opencv-python-headless \
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