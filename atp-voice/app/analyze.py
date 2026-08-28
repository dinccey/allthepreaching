"""Audio analysis pipeline: chunk -> embed -> cluster -> match.

Given a 16 kHz mono wav tensor, produces per-video speaker clusters and
matches each cluster against the active enrollment gallery.
"""
from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field

import numpy as np
import torch

from . import db
from .config import Config
from .embedding import embed_audio, model_version_tag

log = logging.getLogger(__name__)


@dataclass
class ChunkEmb:
    index: int
    seconds: float
    rms: float
    vector: np.ndarray


@dataclass
class Cluster:
    label: str
    chunk_idxs: list[int]
    speech_seconds: float
    mean_vector: np.ndarray
    ratio: float = 0.0


@dataclass
class MatchResult:
    cluster: Cluster
    top1_profile: int | None
    top1_score: float
    top2_profile: int | None
    top2_score: float
    margin: float
    tier: str  # 'high' | 'medium' | 'low'


def _as_float(value, what: str) -> float:
    """Narrow a tensor/scalar to float with context on failure."""
    try:
        return float(value)
    except (TypeError, ValueError, RuntimeError) as exc:
        raise ValueError(f"could not coerce {what!r} to float: {value!r}") from exc


def _rms(t: torch.Tensor) -> float:
    return _as_float(torch.sqrt(torch.mean(t.pow(2))).item(), "chunk rms")


def chunk_wav(wav: torch.Tensor) -> list[ChunkEmb]:
    """Slide a window over the audio and embed each chunk.

    Returns embeddings only for chunks above the energy gate (music-only,
    silence, or near-silent chunks are dropped so they cannot pollute
    speaker identity).
    """
    sr = Config.SAMPLE_RATE
    chunk = Config.CHUNK_SECONDS * sr
    hop = Config.HOP_SECONDS * sr
    if wav.numel() < hop // 2:
        return []

    vecs: list[ChunkEmb] = []
    pos = 0
    idx = 0
    n_chunks = 0
    while pos + chunk <= wav.numel() or (idx == 0 and wav.numel() >= chunk // 2):
        seg = wav[pos:pos + chunk]
        if seg.numel() >= sr // 2:  # at least 0.5 s of audio
            rms = _rms(seg)
            vec = np.asarray(embed_audio(seg)).reshape(-1)  # backends may return (1, D)
            vecs.append(ChunkEmb(index=idx, seconds=seg.numel() / sr, rms=rms, vector=vec))
            n_chunks += 1
        pos += hop
        idx += 1
        if pos >= wav.numel():
            break
    if not vecs:
        return []

    # energy gate: drop chunks with RMS below MIN_CHUNK_ENERGY of the peak
    peak = max(v.rms for v in vecs)
    if peak <= 0:
        return []
    gated = [v for v in vecs if v.rms >= Config.MIN_CHUNK_ENERGY * peak]
    kept = gated if gated else [max(vecs, key=lambda v: v.rms)]
    log.debug("chunked audio: %d raw -> %d after energy gate", n_chunks, len(kept))
    return kept


def cluster_chunks(chunks: list[ChunkEmb]) -> list[Cluster]:
    """Greedy agglomerative clustering on cosine similarity.

    A chunk joins an existing cluster when its cosine with the cluster mean
    >= CLUSTER_JOIN_COSINE, otherwise it seeds a new cluster. Clusters are
    then labelled S1, S2, ... by total speech duration.
    """
    if not chunks:
        return []
    clusters: list[list[ChunkEmb]] = []
    means: list[np.ndarray] = []
    for ch in chunks:
        placed = False
        for i, c in enumerate(clusters):
            sim = _as_float(np.dot(ch.vector, means[i]), "chunk cosine")
            if sim >= Config.CLUSTER_JOIN_COSINE:
                c.append(ch)
                new_mean = np.mean([x.vector for x in c], axis=0)
                norms = np.linalg.norm(new_mean)
                means[i] = new_mean / (norms if norms > 0 else 1.0)
                placed = True
                break
        if not placed:
            clusters.append([ch])
            means.append(ch.vector.copy())

    total = sum(ch.seconds for ch in chunks) or 1.0
    order = sorted(range(len(clusters)), key=lambda i: -sum(c.seconds for c in clusters[i]))
    out: list[Cluster] = []
    for rank, i in enumerate(order, start=1):
        c = clusters[i]
        mean = np.mean([x.vector for x in c], axis=0)
        n = _as_float(np.linalg.norm(mean), "cluster mean norm")
        out.append(Cluster(
            label=f"S{rank}",
            chunk_idxs=[x.index for x in c],
            speech_seconds=sum(x.seconds for x in c),
            mean_vector=mean / (n if n > 0 else 1.0),
            ratio=sum(x.seconds for x in c) / total,
        ))
    return out


def match_clusters(clusters: list[Cluster],
                   gallery: dict[int, list[list[float]]]) -> list[MatchResult]:
    """Score every cluster against the active gallery.

    Per-profile score = max cosine between the cluster mean and that
    profile's enrollment vectors (max over vectors approximates a soft
    nearest-enrollment; keeps enrollments as raw evidence, no averaging
    drift).
    """
    results: list[MatchResult] = []
    for cl in clusters:
        scored: list[tuple[int, float]] = []
        vec = cl.mean_vector.astype(np.float64)
        for pid, vectors in gallery.items():
            if not vectors:
                continue
            mat = np.asarray(vectors, dtype=np.float64)
            score = _as_float(np.max(mat @ vec), "gallery cosine")
            scored.append((pid, score))
        scored.sort(key=lambda p: -p[1])
        top1_pid, top1_score = (scored[0] if scored else (None, 0.0))
        top2_pid, top2_score = (scored[1] if len(scored) > 1 else (None, 0.0))
        margin = top1_score - top2_score if top1_pid is not None else 0.0

        if top1_pid is not None and top1_score >= Config.T_HIGH and margin >= Config.MARGIN:
            tier = "high"
        elif top1_pid is not None and top1_score >= Config.T_MED:
            tier = "medium"
        else:
            tier = "low"
        results.append(MatchResult(
            cluster=cl,
            top1_profile=top1_pid,
            top1_score=top1_score,
            top2_profile=top2_pid,
            top2_score=top2_score,
            margin=margin,
            tier=tier,
        ))
    return results


def analyze_wav(wav: torch.Tensor, video_id: int | None = None,
                pipeline: str = "mp3") -> dict:
    """Full pipeline for one video's audio.

    Returns a summary dict and (when video_id given) upserts evidence rows
    into video_speakers.
    """
    chunks = chunk_wav(wav)
    if not chunks:
        return {"error": "no speech detected (all chunks below energy gate)"}

    clusters = cluster_chunks(chunks)
    keep = [c for c in clusters if c.ratio >= Config.MIN_CLUSTER_RATIO]
    if not keep:  # always keep the dominant one
        keep = [clusters[0]]

    gallery = db.gallery_active()
    results = match_clusters(keep, gallery)

    total_speech = sum(c.speech_seconds for c in keep) or 1.0
    summary: dict = {
        "clusters": len(results),
        "model_version": model_version_tag(),
        "speakers": [],
    }
    for m in results:
        single_speaker = (len(keep) == 1)
        label = "whole" if single_speaker else m.cluster.label
        confidence = {
            "high": "high",
            "medium": "medium",
            "low": "low",
        }[m.tier]
        entry = {
            "label": label,
            "speech_ratio": round(m.cluster.speech_seconds / total_speech, 4),
            "tier": m.tier,
            "top1_profile": m.top1_profile,
            "top1_score": round(m.top1_score, 4),
            "top2_score": round(m.top2_score, 4),
            "margin": round(m.margin, 4),
        }
        summary["speakers"].append(entry)

        if video_id is not None:
            # HIGH matches auto-accept; everything else stays pending for a
            # human review (or gets consumed by the manager stage-2 logic).
            status = "accepted" if m.tier == "high" else "pending"
            db.upsert_video_speaker(
                video_id, label,
                pipeline=pipeline,
                speech_ratio=round(m.cluster.speech_seconds / total_speech, 4),
                matched_profile_id=m.top1_profile if m.tier in ("high", "medium") else None,
                score_top1=round(m.top1_score, 4),
                score_top2=round(m.top2_score, 4),
                margin=round(m.margin, 4),
                confidence=confidence,
                model_version=model_version_tag(),
                status=status,
            )
    return summary
