"""Audio loading: any ffmpeg-readable source -> 16 kHz mono torch tensor."""
from __future__ import annotations

import logging
import os
import shutil
import subprocess
import tempfile

import numpy as np
import soundfile as sf
import torch

from .config import Config

log = logging.getLogger(__name__)

_FFMPEG = shutil.which("ffmpeg")


def _require_ffmpeg() -> str:
    if _FFMPEG is None:
        raise RuntimeError("ffmpeg not found on PATH")
    return _FFMPEG


def load_wav_16k(path: str) -> torch.Tensor:
    """Decode *path* (mp3, m4a, mp4, ogg, wav, ...) to a 1-D float32 tensor
    at 16 kHz mono.

    ffmpeg is used for container decoding; very long files are processed in
    one pass (streaming to raw PCM keeps memory bounded).
    """
    if not os.path.isfile(path):
        raise FileNotFoundError(f"audio source not found: {path}")
    ff = _require_ffmpeg()

    fd, raw_path = tempfile.mkstemp(suffix=".pcm", dir=Config.TEMP_DIR)
    os.close(fd)
    try:
        os.unlink(raw_path)  # ffmpeg refuses to overwrite a pre-existing output file
    except OSError:
        pass  # best-effort cleanup of the empty mkstemp file
    try:
        cmd = [
            ff, "-hide_banner", "-loglevel", "error", "-nostdin",
            "-i", path,
            "-vn",                       # drop video stream
            "-ac", "1",                  # mono
            "-ar", str(Config.SAMPLE_RATE),
            "-f", "s16le",               # raw 16-bit PCM
            raw_path,
        ]
        proc = subprocess.run(cmd, capture_output=True, timeout=Config.WORKER_TIMEOUT)
        if proc.returncode != 0:
            raise RuntimeError(
                f"ffmpeg failed ({proc.returncode}): {proc.stderr.decode('utf-8', 'replace')[:400]}"
            )
        pcm = np.fromfile(raw_path, dtype=np.int16)
    finally:
        try:
            os.unlink(raw_path)
        except OSError:
            pass

    if pcm.size < Config.SAMPLE_RATE // 4:  # less than 0.25 s
        raise ValueError("audio too short (< 0.25 s)")
    wav = torch.from_numpy(pcm.astype(np.float32) / 32768.0)
    return wav


def load_wav_16k_from_url(url: str, video_id: int | None = None) -> torch.Tensor:
    """Download (or use cache for) a remote mp3 and decode it."""
    import requests

    cache_dir = os.path.join(Config.TEMP_DIR, "downloads")
    try:
        os.makedirs(cache_dir, exist_ok=True)
    except OSError as exc:
        raise RuntimeError(f"cannot create download cache dir {cache_dir!r}") from exc
    fname = f"{video_id or 'remote'}_{os.path.basename(url.split('?')[0]) or 'audio.mp3'}"
    dest = os.path.join(cache_dir, fname)
    if not os.path.isfile(dest) or os.path.getsize(dest) == 0:
        log.info("downloading %s -> %s", url, dest)
        with requests.get(url, stream=True, timeout=120) as resp:
            resp.raise_for_status()
            try:
                with open(dest, "wb") as fh:
                    for chunk in resp.iter_content(1 << 16):
                        fh.write(chunk)
            except OSError as exc:
                raise RuntimeError(f"failed writing download cache {dest!r}") from exc
    return load_wav_16k(dest)
