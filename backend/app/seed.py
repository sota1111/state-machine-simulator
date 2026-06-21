import uuid
from datetime import datetime, timezone

from .data.sample_state_machines import SAMPLE_STATE_MACHINES


def seed_firestore_samples():
    """Idempotently reconcile sample state machines into Firestore (production).

    Reconciles by name: only samples whose name is not yet present as a sample
    doc (is_sample == True) are written, so repeated startups do not duplicate
    them AND samples added after the first seed are still picked up later.
    Firestore errors are propagated to the caller, which is expected to wrap this
    call in try/except at startup.
    """
    from .repositories.firestore_repository import FirestoreStateMachineRepository

    repo = FirestoreStateMachineRepository()
    db = repo.db
    collection = db.collection(FirestoreStateMachineRepository.COLLECTION)

    existing_sample_names = {
        doc.to_dict().get("name")
        for doc in collection.where("is_sample", "==", True).stream()
    }

    added = 0
    now = datetime.now(timezone.utc)
    for sample in SAMPLE_STATE_MACHINES:
        if sample["name"] in existing_sample_names:
            continue
        machine_id = str(uuid.uuid4())
        states = [
            {
                "id": str(uuid.uuid4()),
                "name": s["name"],
                "description": s.get("description", ""),
                "is_terminal": s.get("is_terminal", False),
                "parent": s.get("parent"),
            }
            for s in sample["states"]
        ]
        transitions = [
            {
                "id": str(uuid.uuid4()),
                "from_state": t["from_state"],
                "to_state": t["to_state"],
                "event": t["event"],
            }
            for t in sample["transitions"]
        ]
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
        added += 1

    return added
