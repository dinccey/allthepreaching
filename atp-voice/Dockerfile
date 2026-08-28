# ATP voice classification service (CPU-only)
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
        ffmpeg \
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /srv/atp-voice

# CPU-only torch first (keeps the image small)
RUN pip install --no-cache-dir \
    torch==2.5.1 torchaudio==2.5.1 \
    --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

RUN useradd -m atpvoice \
    && mkdir -p /tmp/atp-voice \
    && chown -R atpvoice:atpvoice /srv/atp-voice /tmp/atp-voice
USER atpvoice

ENV DB_HOST=127.0.0.1 \
    DB_PORT=5432 \
    DB_USER=alltdjli \
    DB_NAME=alltdjli_pas \
    TEMP_DIR=/tmp/atp-voice \
    PORT=5002

EXPOSE 5002
HEALTHCHECK --interval=30s --timeout=10s --retries=5 \
    CMD curl -fsS http://127.0.0.1:5002/health || exit 1

CMD ["python", "-m", "app.main"]
