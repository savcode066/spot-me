FROM python:3.10-slim

WORKDIR /app

COPY api_requirements.txt .
RUN pip install --no-cache-dir -r api_requirements.txt

COPY . .

EXPOSE 8080

# Cloud Run injects its own $PORT; $WEB_CONCURRENCY controls uvicorn's
# worker-process count within this one instance (default 2 — deliberately
# modest, since every route is sync and thread-pool-bound rather than
# asyncio-bound). The primary lever for absorbing a traffic burst is Cloud
# Run's own instance autoscaling (--max-instances / --concurrency on the
# service), not stacking workers inside one instance's fixed CPU/memory
# allocation.
CMD ["sh", "-c", "uvicorn api:app --host 0.0.0.0 --port ${PORT:-8080} --workers ${WEB_CONCURRENCY:-2}"]
