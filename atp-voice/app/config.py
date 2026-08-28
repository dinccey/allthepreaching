"""Voice classification service configuration (env-driven)."""
import os


def _float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


def _int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


class Config:
    # --- database (shared allthepreaching Postgres) ---
    DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
    DB_PORT = _int("DB_PORT", 5432)
    DB_USER = os.getenv("DB_USER", "alltdjli")
    DB_PASS = os.getenv("DB_PASS", "")
    DB_NAME = os.getenv("DB_NAME", "alltdjli_pas")

    # --- audio / embedding pipeline ---
    SAMPLE_RATE = 16000
    CHUNK_SECONDS = _int("CHUNK_SECONDS", 30)      # embedding window
    HOP_SECONDS = _int("HOP_SECONDS", 20)         # overlap hop
    MIN_CHUNK_ENERGY = _float("MIN_CHUNK_ENERGY", 0.12)  # drop chunks below 12% of peak RMS
    MIN_CLUSTER_RATIO = _float("MIN_CLUSTER_RATIO", 0.15)  # keep clusters >= 15% of speech time
    DOMINANT_CLUSTER_MIN = _float("DOMINANT_CLUSTER_MIN", 0.60)  # "single speaker" if largest cluster >= 60%
    CLUSTER_JOIN_COSINE = _float("CLUSTER_JOIN_COSINE", 0.55)    # assign chunk to existing cluster

    # --- matching thresholds (calibrate in Phase 0!) ---
    T_HIGH = _float("T_HIGH", 0.55)   # score for HIGH confidence
    T_MED = _float("T_MED", 0.40)     # score for MEDIUM confidence
    MARGIN = _float("MARGIN", 0.08)   # top1 - top2 margin required for HIGH

    # --- model ---
    # "ecapa" (SpeechBrain ECAPA-TDNN, VoxCeleb, Apache-2.0) is the default;
    # "campplus" (3D-Speaker/FunASR) is an optional A/B alternative.
    EMBEDDING_BACKEND = os.getenv("EMBEDDING_BACKEND", "ecapa")
    HF_TOKEN = os.getenv("HF_TOKEN", "")  # only needed for gated model downloads
    MODEL_VERSION_TAG = os.getenv("MODEL_VERSION_TAG", "ecapa-voxceleb-v1")
    # Base URL for resolving sample audio during enrollment bootstrap
    # (e.g. https://kjv1611only.com). Requests may override per-call.
    BASE_SITE_URL = os.getenv("BASE_SITE_URL", "").rstrip("/")

    # --- gallery cache ---
    GALLERY_REFRESH_SECONDS = _int("GALLERY_REFRESH_SECONDS", 300)

    # --- storage ---
    TEMP_DIR = os.getenv("TEMP_DIR", "/tmp/atp-voice")
    WORKER_TIMEOUT = _int("ANALYZE_TIMEOUT", 3600)

    # --- enrollment bootstrap ---
    ENROLL_AUDIO_SECONDS = _int("ENROLL_AUDIO_SECONDS", 600)  # cap sample length; 0 = full audio

    # --- API ---
    HOST = os.getenv("HOST", "0.0.0.0")
    PORT = _int("PORT", 5002)
