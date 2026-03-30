FROM python:3.10-slim

WORKDIR /app

# Only copy the lightweight API requirements
COPY api_requirements.txt .
RUN pip install --no-cache-dir -r api_requirements.txt

# Copy your source code
COPY . .

EXPOSE 8080

CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8080"]
