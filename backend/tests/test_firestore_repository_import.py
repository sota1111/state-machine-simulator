"""Regression for SOT-817 (production): `GET /api/models/` returned 500 with
`ModuleNotFoundError: No module named 'firestore_client'` because the deploy
Dockerfile only copies `backend/app/` and the module was imported from the
backend root via a sys.path hack. `firestore_client` now lives inside the
`app` package, so the import must resolve regardless of WORKDIR.
"""
import importlib

import pytest


def test_firestore_client_is_importable_from_app_package():
    module = importlib.import_module("app.firestore_client")
    assert hasattr(module, "get_firestore_client")


def test_firestore_repository_init_reaches_client(monkeypatch):
    # Without GCP_PROJECT_ID the client init raises RuntimeError. The point of
    # this assertion is that we get that RuntimeError (the import resolved),
    # NOT a ModuleNotFoundError (the production bug).
    monkeypatch.delenv("GCP_PROJECT_ID", raising=False)
    from app.repositories.firestore_repository import FirestoreStateMachineRepository

    with pytest.raises(RuntimeError):
        FirestoreStateMachineRepository()
