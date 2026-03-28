FROM us-docker.pkg.dev/deeplearning-platform-release/gcr.io/pytorch-gpu.2-1

ENV PYTHONUNBUFFERED=1 \
    EASYOCR_MODULE_PATH=/app/.EasyOCR \
    FIRESTORE_ENABLED=true

WORKDIR /app

# Only install what's NOT already in the base image.
# PyTorch, numpy, CUDA, and many Google libs are pre-installed.
RUN pip install --no-cache-dir \
        "numpy<2.0.0" \
        opencv-python-headless \
        easyocr \
        yt-dlp \
        requests \
        python-dotenv \
        google-cloud-firestore

# Pre-download EasyOCR English model weights at build time so the job
# doesn't hit the network on every run.
RUN python -c "import easyocr; easyocr.Reader(['en'], gpu=False, verbose=False)"

COPY backend/pipeline.py backend/cli.py ./


ENTRYPOINT ["python", "cli.py", "pipeline.py"]
