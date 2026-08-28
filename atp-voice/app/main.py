"""ATP voice classification service.

FastAPI app exposing speaker-embedding analysis, gallery matching, and
enrollment bootstrap against the shared allthepreaching Postgres database.

Endpoints:
    GET  /health
    GET  /gallery
    GET  /enrollments?status=pending|active|rejected
    POST /enrollments/{id}/approve
    POST /enrollments/{id}/reject
    GET  /videos/{video_id}/speakers
    POST /videos/{video_id}/analyze
    POST /profiles/{profile_id}/enroll
"""
from __future__ import annotations

import logging
import os
import threading
from typing import Optional

import torch
import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from . import db
from .analyze import analyze_wav, cluster_chunks, chunk_wav
from .audio import load_wav_16k, load_wav_16k_from_url
from .config import Config

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("atp-voice")

app = FastAPI(title="atp-voice", version="1.0.0")

# CPU-bound analysis: keep concurrency bounded (1.9 GB host).
MAX_CONCURRENT_ANALYZES_RAW = os.getenv("MAX_CONCURRENT_ANALYZES", "2")
try:
    MAX_CONCURRENT_ANALYZES = int(MAX_CONCURRENT_ANALYZES_RAW)
except (TypeError, ValueError):
    MAX_CONCURRENT_ANALYZES = 2
_ANALYZE_SEM = threading.Semaphore(max(1, MAX_CONCURRENT_ANALYZES))


# ---------------------------------------------------------------------------
# models
# ---------------------------------------------------------------------------

class AnalyzeRequest(BaseModel):
    audio_path: Optional[str] = None
    audio_url: Optional[str] = None
    pipeline: str = "whole_audio"  # schema allows: whole_audio | diarized | bootstrap


class EnrollRequest(BaseModel):
    sample_size: int = Field(default=10, ge=2, le=30)
    auto_approve: bool = False
    base_site_url: Optional[str] = None
    local_audio_dir: Optional[str] = None


# ---------------------------------------------------------------------------
# health / gallery
# ---------------------------------------------------------------------------

@app.get("/health")
def health() -> dict:
    try:
        db.query_one("SELECT 1 AS ok")
        db_ok = True
        db_err: Optional[str] = None
    except Exception as exc:  # pragma: no cover - depends on infra
        db_ok = False
        db_err = str(exc)
    gallery = db.gallery_active() if db_ok else {}
    return {
        "status": "ok" if db_ok else "degraded",
        "db": db_ok,
        "db_error": db_err,
        "backend": Config.EMBEDDING_BACKEND,
        "model_version": Config.MODEL_VERSION_TAG,
        "gallery_profiles": len(gallery),
        "gallery_vectors": sum(len(v) for v in gallery.values()),
        "thresholds": {
            "t_high": Config.T_HIGH,
            "t_med": Config.T_MED,
            "margin": Config.MARGIN,
            "cluster_join": Config.CLUSTER_JOIN_COSINE,
        },
    }


@app.get("/gallery")
def gallery() -> dict:
    g = db.gallery_active()
    rows = []
    for pid in sorted(g):
        prof = db.profile_by_id(pid)
        rows.append({
            "profile_id": pid,
            "profile_key": prof["profile_key"] if prof else None,
            "name": prof["name"] if prof else None,
            "vectors": len(g[pid]),
        })
    return {"profiles": rows, "total_profiles": len(rows)}


# ---------------------------------------------------------------------------
# enrollments
# ---------------------------------------------------------------------------

@app.get("/enrollments")
def list_enrollments(status: Optional[str] = None) -> dict:
    if status:
        rows = db.query_all(
            """
            SELECT e.id, e.profile_id, e.source_video_id, e.model_version,
                   e.status, e.notes, e.created_at, p.profile_key, p.name
            FROM speaker_enrollments e
            LEFT JOIN profiles p ON p.id = e.profile_id
            WHERE e.status = %s
            ORDER BY e.created_at DESC
            """,
            (status,),
        )
    else:
        rows = db.query_all(
            """
            SELECT e.id, e.profile_id, e.source_video_id, e.model_version,
                   e.status, e.notes, e.created_at, p.profile_key, p.name
            FROM speaker_enrollments e
            LEFT JOIN profiles p ON p.id = e.profile_id
            ORDER BY e.created_at DESC
            """
        )
    return {"enrollments": rows}


def _set_enrollment_status(enrollment_id: int, status: str) -> None:
    row = db.query_one(
        "SELECT id FROM speaker_enrollments WHERE id = %s", (enrollment_id,)
    )
    if not row:
        raise HTTPException(404, "enrollment not found")
    db.execute(
        "UPDATE speaker_enrollments SET status = %s WHERE id = %s",
        (status, enrollment_id),
    )


@app.post("/enrollments/{enrollment_id}/approve")
def approve_enrollment(enrollment_id: int) -> dict:
    _set_enrollment_status(enrollment_id, "active")
    return {"id": enrollment_id, "status": "active"}


@app.post("/enrollments/{enrollment_id}/reject")
def reject_enrollment(enrollment_id: int) -> dict:
    _set_enrollment_status(enrollment_id, "rejected")
    return {"id": enrollment_id, "status": "rejected"}


# ---------------------------------------------------------------------------
# video evidence
# ---------------------------------------------------------------------------

@app.get("/videos/{video_id}/speakers")
def video_speakers(video_id: int) -> dict:
    rows = db.query_all(
        """
        SELECT vs.id, vs.speaker_label, vs.pipeline, vs.speech_ratio,
               vs.matched_profile_id, vs.score_top1, vs.score_top2, vs.margin,
               vs.confidence, vs.model_version, vs.status, vs.created_at,
               p.profile_key AS matched_profile_key, p.name AS matched_profile_name
        FROM video_speakers vs
        LEFT JOIN profiles p ON p.id = vs.matched_profile_id
        WHERE vs.video_id = %s
        ORDER BY vs.speech_ratio DESC, vs.id
        """,
        (video_id,),
    )
    return {"video_id": video_id, "speakers": rows}


@app.post("/videos/{video_id}/analyze")
def analyze_video(video_id: int, req: AnalyzeRequest) -> dict:
    """Run the full voice pipeline for one video and upsert evidence rows.

    Synchronous (CPU-bound): the caller (ATP-manager) should use a long
    timeout (analysis of one hour of audio takes roughly 5-15 minutes).
    """
    if not req.audio_path and not req.audio_url:
        raise HTTPException(400, "audio_path or audio_url required")

    with _ANALYZE_SEM:
        try:
            if req.audio_path:
                wav = load_wav_16k(req.audio_path)
            else:
                wav = load_wav_16k_from_url(req.audio_url or "", video_id)
        except FileNotFoundError as exc:
            raise HTTPException(404, str(exc))
        except Exception as exc:
            log.exception("audio load failed for video %s", video_id)
            raise HTTPException(502, f"audio load failed: {exc}")

    summary = analyze_wav(wav, video_id=video_id, pipeline=req.pipeline)
    if "error" in summary:
        return {"video_id": video_id, "status": "no_speech", **summary}
    # Enrich speaker entries with the matched profile's key/name so callers
    # (ATP-manager) can resolve against manager profile keys without a DB hop.
    seen: dict[int, dict] = {}
    for sp in summary.get("speakers", []):
        pid = sp.get("top1_profile")
        if pid in (None, 0):
            continue
        if pid not in seen:
            try:
                seen[pid] = db.profile_by_id(int(pid)) or {}
            except Exception:
                seen[pid] = {}
        prof = seen[pid]
        sp["matched_profile_id"] = pid
        sp["matched_profile_key"] = prof.get("profile_key")
        sp["matched_profile_name"] = prof.get("name")
    return {"video_id": video_id, "status": "ok", **summary}


# ---------------------------------------------------------------------------
# enrollment bootstrap
# ---------------------------------------------------------------------------

def _resolve_audio(
    video: dict, base_site_url: Optional[str], local_audio_dir: Optional[str]
) -> tuple[Optional[str], Optional[str]]:
    """Return (local_path, remote_url) for a video's mp3, whichever exists.

    videos.vid_url is an absolute URL (built by the manager's build_vid_url),
    so the mp3 URL is derived directly from it; a relative path (legacy shape)
    is joined against base_site_url instead.
    """
    import os
    vid_url = (video.get("vid_url") or "").strip()
    if not vid_url:
        return None, None

    if vid_url.startswith(("http://", "https://")):
        mp3_url = vid_url.rsplit(".", 1)[0] + ".mp3"
        path_part = vid_url.split("://", 1)[1]
        path_part = path_part[path_part.find("/"):] if "/" in path_part else ""
    else:
        path_part = vid_url
        mp3_url = None
        if base_site_url:
            mp3_url = f"{base_site_url.rstrip('/')}/{path_part.lstrip('/').rsplit('.', 1)[0] + '.mp3'}"

    if local_audio_dir and path_part:
        rel_mp3 = path_part.lstrip("/").rsplit(".", 1)[0] + ".mp3"
        cand = os.path.join(local_audio_dir, *rel_mp3.split("/"))
        if os.path.isfile(cand):
            return cand, None
    return None, mp3_url


def _as_float(value, what: str) -> float:
    """Coerce a tensor/scalar to float with context on failure."""
    try:
        return float(value)
    except (TypeError, ValueError, RuntimeError) as exc:
        raise ValueError(f"could not coerce {what!r} to float: {value!r}") from exc


@app.post("/profiles/{profile_id}/enroll")
def enroll_profile(profile_id: int, req: EnrollRequest) -> dict:
    """Majority-vote bootstrap for one profile.

    Samples up to `sample_size` of the profile's primary-assigned videos,
    extracts each dominant voice, and checks mutual agreement. When the
    quorum (>= 60% of analyzable samples agreeing on one voice, with at
    least 6 samples) is met, a pending enrollment with the mean vector is
    created (or auto-activated when auto_approve).
    """
    from .embedding import get_backend
    import numpy as np

    get_backend()  # ensure model loaded before long work

    samples = db.sample_videos_for_profile(profile_id, req.sample_size)
    if not samples:
        raise HTTPException(404, "no candidate videos for this profile")

    base_site_url = req.base_site_url or Config.BASE_SITE_URL or None
    local_audio_dir = req.local_audio_dir or None

    dominant: list[np.ndarray] = []
    per_video: list[dict] = []
    analyzed = 0

    for video in samples:
        local_path, remote_url = _resolve_audio(video, base_site_url, local_audio_dir)
        if not local_path and not remote_url:
            per_video.append({"video_id": video["id"], "status": "no_audio"})
            continue
        entry: dict = {"video_id": video["id"], "vid_url": video.get("vid_url")}
        try:
            if local_path:
                wav = load_wav_16k(local_path)
            else:
                wav = load_wav_16k_from_url(remote_url or "", video["id"])
            if Config.ENROLL_AUDIO_SECONDS > 0:
                # Bootstrap only needs a few minutes of speech for a stable
                # dominant-voice estimate; cap it to keep CPU cost bounded.
                wav = wav[: int(Config.ENROLL_AUDIO_SECONDS * 16000)]
        except Exception as exc:
            entry["status"] = f"load_failed: {exc}"
            per_video.append(entry)
            continue

        chunks = chunk_wav(wav)
        if not chunks:
            entry["status"] = "no_speech"
            per_video.append(entry)
            continue
        clusters = cluster_chunks(chunks)
        dom = clusters[0]
        analyzed += 1
        entry["status"] = "ok"
        entry["dominant_ratio"] = round(dom.ratio, 3)
        entry["n_speakers_kept"] = len(clusters)
        dominant.append(dom.mean_vector.astype(np.float64))
        per_video.append(entry)

    if analyzed < 3:
        return {
            "profile_id": profile_id,
            "status": "insufficient_data",
            "analyzed": analyzed,
            "per_video": per_video,
        }

    # mutual agreement: each dominant vector vs the running mean
    mean = np.mean(dominant, axis=0)
    n = _as_float(np.linalg.norm(mean), "dominant mean norm")
    mean = mean / (n if n > 0 else 1.0)
    sims = [_as_float(np.dot(v, mean), "agreement cosine") for v in dominant]
    agreeing = sum(1 for s in sims if s >= Config.CLUSTER_JOIN_COSINE)
    agreement_ratio = agreeing / len(sims)
    quorum_ok = agreement_ratio >= 0.6 and len(sims) >= 6

    # final vector = mean of the agreeing subset only
    agreeing_vecs = [v for v, s in zip(dominant, sims) if s >= Config.CLUSTER_JOIN_COSINE]
    final = np.mean(agreeing_vecs, axis=0)
    n = _as_float(np.linalg.norm(final), "final mean norm")
    final = final / (n if n > 0 else 1.0)

    result: dict = {
        "profile_id": profile_id,
        "status": "pending" if quorum_ok else "rejected_insufficient",
        "analyzed": analyzed,
        "agreeing": agreeing,
        "agreement_ratio": round(agreement_ratio, 3),
        "quorum_ok": quorum_ok,
        "per_video": per_video,
    }

    if quorum_ok:
        notes = (
            f"bootstrap: {agreeing}/{analyzed} sample videos agree "
            f"(ratio {agreement_ratio:.2f}), cluster join "
            f"{Config.CLUSTER_JOIN_COSINE}"
        )
        embedding = [_as_float(x, "enrollment vector component") for x in final]
        enrollment_id = db.propose_enrollment(
            profile_id=profile_id,
            mean_embedding=embedding,
            source_video_ids=[e["video_id"] for e in per_video if e.get("status") == "ok"],
            notes=notes,
        )
        if enrollment_id:
            result["enrollment_id"] = enrollment_id
            if req.auto_approve:
                db.execute(
                    "UPDATE speaker_enrollments SET status = 'active' WHERE id = %s",
                    (enrollment_id,),
                )
                result["status"] = "active"
        else:
            result["enrollment_id"] = None
    return result


if __name__ == "__main__":
    try:
        os.makedirs(Config.TEMP_DIR, exist_ok=True)
    except OSError as exc:
        raise SystemExit(f"cannot create TEMP_DIR {Config.TEMP_DIR!r}: {exc}")
    torch.set_num_threads(min(4, os.cpu_count() or 4))
    uvicorn.run("app.main:app", host=Config.HOST, port=Config.PORT, log_level="info")
