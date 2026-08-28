"""Postgres access for the voice service.

Uses pg8000 (pure python) in *native* mode:
  - each `conn.run(...)` is its own auto-committed transaction
  - named placeholders (:p0, :p1, ...) with kwargs
  - results come back as a list of tuples + `conn.columns`

A thin adapter keeps call sites in familiar positional `%s` style.
"""
from typing import Any, Iterable, Optional

import logging

import pg8000.native
from pg8000.exceptions import InterfaceError as _Pg8000InterfaceError

from .config import Config

log = logging.getLogger(__name__)

_CONN: pg8000.native.Connection | None = None


def _connect() -> pg8000.native.Connection:
    global _CONN
    if _CONN is None:
        _CONN = pg8000.native.Connection(
            host=Config.DB_HOST,
            port=Config.DB_PORT,
            user=Config.DB_USER,
            password=Config.DB_PASS,
            database=Config.DB_NAME,
        )
    return _CONN


def _to_int(value: Any, what: str) -> int:
    """Explicit int coercion with context. pg8000 returns int for integer
    columns; this guards against dirty/legacy values so a bad row fails
    loudly and debuggably instead of as a bare TypeError."""
    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"could not coerce {what!r} to int: {value!r}") from exc


def _name_params(sql: str, params: tuple[Any, ...]) -> tuple[str, list[str]]:
    """Rewrite positional %s placeholders to named :pN placeholders."""
    names: list[str] = []
    out: list[str] = []
    i = 0
    while i < len(sql):
        ch = sql[i]
        if ch == "'":  # copy string literals verbatim (never rewrite %s inside them)
            j = i + 1
            while j < len(sql) and sql[j] != "'":
                j += 1
            end = min(j + 1, len(sql))
            out.append(sql[i:end])
            i = end
            continue
        if ch == "%":
            if i + 1 < len(sql) and sql[i + 1] == "s":
                names.append(f"p{len(names)}")
                out.append(f":{names[-1]}")
                i += 2
                continue
            if i + 1 < len(sql) and sql[i + 1] == "%":
                out.append("%")
                i += 2
                continue
        out.append(ch)
        i += 1
    return "".join(out), names


def _reset_connection() -> None:
    global _CONN
    if _CONN is not None:
        try:
            _CONN.close()
        except Exception:  # already broken
            pass
        _CONN = None


def _run(sql: str, params: tuple[Any, ...]) -> list[dict]:
    named, names = _name_params(sql, params)
    kwargs = {names[i]: params[i] for i in range(len(names))}
    last_exc: Optional[Exception] = None
    for attempt in (1, 2):
        conn = _connect()
        try:
            rows = conn.run(named, **kwargs)
        except _Pg8000InterfaceError as exc:
            # connection dropped (server restart, network blip): reconnect once
            log.warning("db connection lost on query (%s); reconnecting", str(exc)[:120])
            last_exc = exc
            _reset_connection()
            continue
        cols = list(conn.columns or [])
        # pg8000 >= 1.31 returns column descriptors (dicts with 'name'); older
        # versions return plain names. Normalize to names.
        cols = [c["name"] if isinstance(c, dict) else c for c in cols]
        return [dict(zip(cols, r)) for r in (rows or [])]
    raise last_exc  # type: ignore[misc]


def query_one(sql: str, params: Optional[Iterable[Any]] = None) -> Optional[dict]:
    rows = _run(sql, tuple(params or ()))
    return rows[0] if rows else None


def query_all(sql: str, params: Optional[Iterable[Any]] = None) -> list[dict]:
    return _run(sql, tuple(params or ()))


def execute(sql: str, params: Optional[Iterable[Any]] = None) -> int:
    conn = _connect()
    plist = list(params) if params is not None else []
    named, names = _name_params(sql, tuple(plist))
    kwargs = {names[i]: plist[i] for i in range(len(names))}
    conn.run(named, **kwargs)
    return _to_int(conn.row_count, "rowcount")


# ---------------------------------------------------------------------------
# domain helpers
# ---------------------------------------------------------------------------

def gallery_active() -> dict[int, list[list[float]]]:
    """profile_id -> list of active enrollment vectors (L2-normalized)."""
    rows = query_all(
        """
        SELECT profile_id, embedding
        FROM speaker_enrollments
        WHERE status = 'active'
        """
    )
    out: dict[int, list[list[float]]] = {}
    for r in rows:
        raw = r["embedding"]
        if raw is None:
            continue
        if isinstance(raw, str):
            import ast
            try:
                raw = ast.literal_eval(raw)
            except (SyntaxError, ValueError):
                continue
        try:
            vec = [float(x) for x in list(raw)]
        except (TypeError, ValueError) as exc:
            # dirty embedding value; skip rather than crash the whole gallery load
            log.warning("skipping malformed enrollment embedding: %s", exc)
            continue
        if not vec:
            continue
        norm = sum(x * x for x in vec) ** 0.5
        if norm == 0:
            continue
        out.setdefault(_to_int(r["profile_id"], "profile_id"), []).append(
            [x / norm for x in vec]
        )
    return out


def write_video_speaker(
    *,
    video_id: int,
    speaker_label: str,
    pipeline: str,
    speech_ratio: float,
    matched_profile_id: Optional[int],
    score_top1: Optional[float],
    score_top2: Optional[float],
    margin: Optional[float],
    confidence: str,
    model_version: str,
    status: str,
) -> int:
    rows = _run(
        """
        INSERT INTO video_speakers
            (video_id, speaker_label, pipeline, speech_ratio,
             matched_profile_id, score_top1, score_top2, margin,
             confidence, model_version, status)
        VALUES
            (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT DO NOTHING
        RETURNING id
        """,
        (
            video_id, speaker_label, pipeline, speech_ratio,
            matched_profile_id, score_top1, score_top2, margin,
            confidence, model_version, status,
        ),
    )
    if not rows:
        return 0
    return _to_int(rows[0]["id"], "speaker id")


def upsert_video_speaker(video_id: int, speaker_label: str, **kwargs) -> None:
    """Replace-or-insert the evidence row for (video, speaker_label)."""
    for key in kwargs:
        if key not in _UPDATABLE_VIDEO_SPEAKER_COLS:
            raise ValueError(f"unknown video_speakers column: {key}")
    existing = query_one(
        "SELECT id FROM video_speakers WHERE video_id = %s AND speaker_label = %s",
        (video_id, speaker_label),
    )
    if existing:
        sets = ", ".join(f"{k} = %s" for k in kwargs)
        execute(
            f"UPDATE video_speakers SET {sets} WHERE id = %s",
            (*kwargs.values(), _to_int(existing["id"], "speaker id")),
        )
    else:
        write_video_speaker(video_id=video_id, speaker_label=speaker_label, **kwargs)


_UPDATABLE_VIDEO_SPEAKER_COLS = {
    "pipeline", "speech_ratio", "matched_profile_id", "score_top1",
    "score_top2", "margin", "confidence", "model_version", "status",
}


def video_profile_ids(video_id: int) -> list[int]:
    rows = query_all(
        "SELECT profile_id FROM video_profiles WHERE video_id = %s", (video_id,)
    )
    return [_to_int(r["profile_id"], "profile_id") for r in rows]


def profile_by_id(profile_id: int) -> Optional[dict]:
    return query_one(
        "SELECT id, profile_key, name, name_slug FROM profiles WHERE id = %s",
        (profile_id,),
    )


def sample_videos_for_profile(profile_id: int, sample_size: int,
                              min_minutes: float = 15.0,
                              max_minutes: float = 300.0) -> list[dict]:
    """Pick sample videos for enrollment: primary-assignment videos, quality
    plausible, spread across time (one per date, newest first)."""
    rows = query_all(
        """
        SELECT v.id, v.vid_url, v.runtime_minutes, v.date
        FROM videos v
        JOIN video_profiles vp ON vp.video_id = v.id AND vp.is_primary
        WHERE vp.profile_id = %s
          AND v.runtime_minutes BETWEEN %s AND %s
        ORDER BY v.date DESC
        LIMIT %s
        """,
        (profile_id, min_minutes, max_minutes, sample_size * 2),
    )
    seen_dates: set[str] = set()
    out: list[dict] = []
    for r in rows:
        d = str(r["date"])[:10]
        if d in seen_dates:
            continue
        seen_dates.add(d)
        out.append(dict(r))
        if len(out) >= sample_size:
            break
    return out


def _pg_array_literal(values: list[float]) -> str:
    """Render a float list as a Postgres float8[] literal ({...} syntax).

    Postgres array literals use braces — Python's str(list) produces
    brackets and is rejected with 22P02.
    """
    parts: list[str] = []
    for v in values:
        try:
            parts.append(repr(float(v)))
        except (TypeError, ValueError) as exc:
            raise ValueError(f"non-numeric embedding value: {v!r}") from exc
    return "{" + ",".join(parts) + "}"


def propose_enrollment(
    *,
    profile_id: int,
    mean_embedding: list[float],
    source_video_ids: list[int],
    notes: str,
) -> int:
    """Create a pending enrollment with the proposed mean vector.

    The embedding is sent as a Postgres array literal string ({...} syntax)
    and cast client-side (::float8[]) to avoid pg8000 array OID negotiation.
    """
    literal = _pg_array_literal(mean_embedding)
    rows = _run(
        """
        INSERT INTO speaker_enrollments
            (profile_id, source_video_id, embedding, model_version, status, notes)
        VALUES (%s, NULL, %s::float8[], %s, 'pending', %s)
        RETURNING id
        """,
        (profile_id, literal, Config.MODEL_VERSION_TAG, notes),
    )
    if not rows:
        return 0
    return _to_int(rows[0]["id"], "enrollment id")
