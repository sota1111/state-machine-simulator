import uuid
from datetime import datetime, timezone

from .data.sample_state_machines import SAMPLE_STATE_MACHINES
from .data.sample_reconcile import build_state_dicts, build_transition_dicts, sample_differs


def seed_firestore_samples():
    """Idempotently reconcile sample state machines into Firestore (production).

    Reconciles by name:
    - A sample whose name is not yet present as a sample doc (is_sample == True)
      is inserted, so samples added after the first seed are still picked up.
    - An existing sample doc whose stored definition differs from the source is
      refreshed IN PLACE (keeping its document id and created_at), so definition
      changes — e.g. added `parent` grouping — reach an environment seeded before
      those fields existed. An identical reseed makes no writes.

    User (non-sample) machines are never touched. Firestore errors are propagated
    to the caller, which is expected to wrap this call in try/except at startup.
    Returns the number of inserted + updated samples.
    """
    from .repositories.firestore_repository import FirestoreStateMachineRepository

    repo = FirestoreStateMachineRepository()
    db = repo.db
    collection = db.collection(FirestoreStateMachineRepository.COLLECTION)

    existing_by_name = {}
    for doc in collection.where("is_sample", "==", True).stream():
        data = doc.to_dict() or {}
        existing_by_name[data.get("name")] = (doc.id, data)

    changed = 0
    now = datetime.now(timezone.utc)
    for sample in SAMPLE_STATE_MACHINES:
        existing = existing_by_name.get(sample["name"])
        states = build_state_dicts(sample)
        transitions = build_transition_dicts(sample)

        if existing is not None:
            existing_id, existing_data = existing
            if not sample_differs(existing_data, sample):
                continue
            doc_data = {
                **existing_data,
                "id": existing_id,
                "name": sample["name"],
                "description": sample["description"],
                "initial_state": sample["initial_state"],
                "states": states,
                "transitions": transitions,
                "updated_at": now,
                "is_deleted": False,
                "is_sample": True,
            }
            doc_data.setdefault("created_at", now)
            collection.document(existing_id).set(doc_data)
            changed += 1
            continue

        machine_id = str(uuid.uuid4())
        doc_data = {
            "id": machine_id,
            "name": sample["name"],
            "description": sample["description"],
            "initial_state": sample["initial_state"],
            "states": states,
            "transitions": transitions,
            "created_at": now,
            "updated_at": now,
            "is_deleted": False,
            "is_sample": True,
        }
        collection.document(machine_id).set(doc_data)
        changed += 1

    return changed
