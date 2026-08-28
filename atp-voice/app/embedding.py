"""Speaker embedding backends.

Default: ECAPA-TDNN (SpeechBrain, VoxCeleb-trained, Apache-2.0, 192-dim).
Optional A/B: CAM++ (3D-Speaker via FunASR/modelscope, Apache-2.0, 192-dim).

All backends expose:
    load() -> None                      (model warm-up, downloads weights)
    embed_audio_tensor(wav: torch.Tensor) -> np.ndarray   (per chunk)
    embedding_dim -> int
"""
from __future__ import annotations

import logging
import os
from typing import Any

import numpy as np
import torch

from .config import Config

log = logging.getLogger(__name__)


def _l2_normalize(vec: np.ndarray, what: str) -> np.ndarray:
    """L2-normalize with context on failure."""
    if vec.size == 0:
        raise ValueError(f"empty embedding vector: {what!r}")
    try:
        norm = float(np.linalg.norm(vec))
    except (TypeError, ValueError) as exc:
        raise ValueError(f"could not normalize {what!r}: {vec!r}") from exc
    if norm == 0:
        raise ValueError(f"zero-norm embedding: {what!r}")
    return vec / norm


class EmbeddingBackend:
    name = "base"
    embedding_dim = 192

    def load(self) -> None:  # pragma: no cover
        raise NotImplementedError

    def embed(self, wav: torch.Tensor) -> np.ndarray:  # pragma: no cover
        """wav: 1-D float32 tensor, 16 kHz. Returns L2-normalized 192-d vec."""
        raise NotImplementedError


class EcapaBackend(EmbeddingBackend):
    """SpeechBrain ECAPA-TDNN speaker-recognition encoder (VoxCeleb)."""

    name = "ecapa"
    embedding_dim = 192

    def __init__(self) -> None:
        self._model: Any = None

    def load(self) -> None:
        if self._model is not None:
            return
        log.info("loading ECAPA-TDNN (speechbrain/spkrec-ecapa-voxceleb) ...")
        from speechbrain.inference.speaker import EncoderClassifier  # noqa: F401

        source = "speechbrain/spkrec-ecapa-voxceleb"
        run_opts = {"device": "cpu"}
        if Config.HF_TOKEN:
            os.environ.setdefault("HF_TOKEN", Config.HF_TOKEN)
        self._model = EncoderClassifier.from_hparams(source=source, run_opts=run_opts)
        log.info("ECAPA-TDNN loaded (CPU)")

    def embed(self, wav: torch.Tensor) -> np.ndarray:
        model = self._model
        if model is None:
            raise RuntimeError("model not loaded; call load() first")
        with torch.no_grad():
            emb = model.encode_batch(wav.unsqueeze(0))
        vec = emb.squeeze(0).cpu().numpy().astype(np.float64)
        return _l2_normalize(vec, "ecapa embedding")


class CampplusBackend(EmbeddingBackend):
    """3D-Speaker CAM++ via modelscope (iic/speech_campplus_sv_zh-cn_16k-common)."""

    name = "campplus"
    embedding_dim = 192

    def __init__(self) -> None:
        self._model: Any = None

    def load(self) -> None:
        if self._model is not None:
            return
        log.info("loading CAM++ (iic/speech_campplus_sv_zh-cn_16k-common) ...")
        from funasr import AutoModel  # noqa: F401

        self._model = AutoModel(model="iic/speech_campplus_sv_zh-cn_16k-common")
        log.info("CAM++ loaded (CPU)")

    def embed(self, wav: torch.Tensor) -> np.ndarray:
        model = self._model
        if model is None:
            raise RuntimeError("model not loaded; call load() first")
        import tempfile

        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as fh:
            import soundfile as sf  # noqa: F401
            sf.write(fh.name, wav.cpu().numpy().astype("float32"), 16000)
            tmp = fh.name
        try:
            res = model.generate(input=tmp)
            vec = np.asarray(res[0]["spk_embedding"], dtype=np.float64)
        finally:
            os.unlink(tmp)
        return _l2_normalize(vec, "campplus embedding")


_BACKENDS = {"ecapa": EcapaBackend, "campplus": CampplusBackend}

_backend: EmbeddingBackend | None = None


def get_backend() -> EmbeddingBackend:
    global _backend
    backend = _backend
    if backend is None:
        key = Config.EMBEDDING_BACKEND.lower()
        if key not in _BACKENDS:
            raise ValueError(f"unknown EMBEDDING_BACKEND: {key!r}")
        backend = _BACKENDS[key]()
        backend.load()
        _backend = backend
    return backend


def embed_audio(wav: torch.Tensor) -> np.ndarray:
    return get_backend().embed(wav)


def model_version_tag() -> str:
    return Config.MODEL_VERSION_TAG
