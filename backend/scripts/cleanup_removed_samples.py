#!/usr/bin/env python3
"""Hard-delete removed sample state machines from Firestore.

This one-time cleanup is intentionally scoped to two exact document IDs that
were removed from source sample data but still existed in production Firestore.
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from dataclasses import dataclass
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from app.firestore_client import get_firestore_client  # noqa: E402


COLLECTION = "state_machines"
TARGETS = {
    "303943d4-83b4-4f8f-ab52-c21481cf0a67": "ai-dev-control-plane Issue実行パイプライン",
    "9f241261-7b47-47e3-a0d8-52a79cdaaff1": "ai-dev-control-plane アプリ配備・認証状態",
}


@dataclass(frozen=True)
class CleanupResult:
    target_id: str
    expected_name: str
    status: str
    reason: str | None = None

    def format(self) -> str:
        if self.reason:
            return f"{self.target_id} ({self.expected_name}): {self.status}({self.reason})"
        return f"{self.target_id} ({self.expected_name}): {self.status}"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Delete the two removed ai-dev-control-plane sample state machines from Firestore."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show matching documents that would be deleted without deleting them.",
    )
    return parser.parse_args()


def ensure_project_env() -> None:
    if os.getenv("GCP_PROJECT_ID"):
        return

    google_cloud_project = os.getenv("GOOGLE_CLOUD_PROJECT")
    if google_cloud_project:
        os.environ["GCP_PROJECT_ID"] = google_cloud_project


def cleanup_target(db, target_id: str, expected_name: str, *, dry_run: bool) -> CleanupResult:
    doc_ref = db.collection(COLLECTION).document(target_id)
    snapshot = doc_ref.get()

    if not snapshot.exists:
        return CleanupResult(target_id, expected_name, "already-absent")

    data = snapshot.to_dict() or {}

    if snapshot.id != target_id:
        reason = f"doc id mismatch: {snapshot.id}"
        logging.warning("Skipping %s: %s", target_id, reason)
        return CleanupResult(target_id, expected_name, "skipped", reason)

    stored_name = data.get("name")
    if stored_name != expected_name:
        reason = f"name mismatch: {stored_name!r}"
        logging.warning("Skipping %s: %s", target_id, reason)
        return CleanupResult(target_id, expected_name, "skipped", reason)

    is_sample = data.get("is_sample")
    if is_sample is not True:
        reason = f"is_sample is not True: {is_sample!r}"
        logging.warning("Skipping %s: %s", target_id, reason)
        return CleanupResult(target_id, expected_name, "skipped", reason)

    if dry_run:
        return CleanupResult(target_id, expected_name, "would-delete")

    doc_ref.delete()
    return CleanupResult(target_id, expected_name, "deleted")


def main() -> int:
    args = parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    ensure_project_env()

    db = get_firestore_client()
    project_id = os.getenv("GCP_PROJECT_ID")
    mode = "DRY RUN" if args.dry_run else "REAL RUN"
    print(f"{mode}: cleanup target collection={COLLECTION} project={project_id}")

    results = [
        cleanup_target(db, target_id, expected_name, dry_run=args.dry_run)
        for target_id, expected_name in TARGETS.items()
    ]

    print("Summary:")
    for result in results:
        print(f"- {result.format()}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
