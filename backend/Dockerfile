FROM python:3.10-slim

WORKDIR /app

COPY api_requirements.txt .
RUN pip install --no-cache-dir -r api_requirements.txt

COPY . .

EXPOSE 8080

CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8080"]
