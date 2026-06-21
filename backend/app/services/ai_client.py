"""Shared Gemini / Vertex AI client factory (google-genai SDK).

Prefers Vertex AI mode (Cloud Run service-account ADC) when
``GOOGLE_GENAI_USE_VERTEXAI`` is truthy; otherwise falls back to API-key mode for
local development. The older AI Studio SDK path is no longer used.

This module is concerned only with AI client construction. Firestore persistence
is unaffected and continues to use ``GCP_PROJECT_ID`` in ``app.firestore_client``.

Environment variables:
- ``GOOGLE_GENAI_USE_VERTEXAI`` — truthy → Vertex AI mode (no API key needed).
- ``GOOGLE_CLOUD_PROJECT``     — Vertex project (falls back to ``GCP_PROJECT_ID``,
  then ``gen-lang-client-0243034020``).
- ``GOOGLE_CLOUD_LOCATION``    — default ``us-central1``.
- ``GEMINI_MODEL``             — default ``gemini-2.5-flash``.
- ``GEMINI_API_KEY`` / ``GOOGLE_API_KEY`` — only used in local API-key fallback.
"""

import logging
import os

logger = logging.getLogger(__name__)

DEFAULT_PROJECT = "gen-lang-client-0243034020"
DEFAULT_LOCATION = "us-central1"
DEFAULT_MODEL = "gemini-2.5-flash"

_logged_init = False


def use_vertex() -> bool:
    """Whether Vertex AI mode is enabled via ``GOOGLE_GENAI_USE_VERTEXAI``."""
    return os.getenv("GOOGLE_GENAI_USE_VERTEXAI", "").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )


def get_model_name() -> str:
    """Resolve the generative model name (``GEMINI_MODEL`` preferred)."""
    return os.getenv("GEMINI_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL


def _api_key():
    return os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")


def gemini_available() -> bool:
    """True when an AI client can be constructed (Vertex on, or an API key set)."""
    return use_vertex() or bool(_api_key())


def _log_init(vertex: bool, project: str, location: str, model: str) -> None:
    global _logged_init
    if _logged_init:
        return
    _logged_init = True
    if vertex:
        logger.info(
            "AI client: Vertex AI mode ENABLED (project=%s, location=%s, model=%s)",
            project,
            location,
            model,
        )
    else:
        logger.warning(
            "AI client: Vertex AI DISABLED, falling back to API-key mode (model=%s)",
            model,
        )


def get_genai_client():
    """Return a configured ``google.genai`` Client.

    Vertex mode uses Application Default Credentials (Cloud Run service account);
    no API key is read or logged. Otherwise an API-key client is built for local
    dev. Raises ``RuntimeError`` when neither is available.
    """
    from google import genai  # lazy import so importing this module never fails

    project = (
        os.getenv("GOOGLE_CLOUD_PROJECT")
        or os.getenv("GCP_PROJECT_ID")
        or DEFAULT_PROJECT
    )
    location = os.getenv("GOOGLE_CLOUD_LOCATION", DEFAULT_LOCATION)
    model = get_model_name()

    if use_vertex():
        _log_init(True, project, location, model)
        return genai.Client(vertexai=True, project=project, location=location)

    key = _api_key()
    if key:
        _log_init(False, project, location, model)
        return genai.Client(api_key=key)

    raise RuntimeError(
        "No AI client available: set GOOGLE_GENAI_USE_VERTEXAI=true to use Vertex AI "
        "(Cloud Run service account), or GEMINI_API_KEY for local API-key mode."
    )
