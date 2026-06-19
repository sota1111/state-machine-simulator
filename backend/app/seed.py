import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session
from .models import StateMachine, State, Transition
from .data.sample_state_machines import SAMPLE_STATE_MACHINES

def seed_sample_data(db: Session):
    if db.query(StateMachine).count() > 0:
        return

    for sample in SAMPLE_STATE_MACHINES:
        machine = StateMachine(
            name=sample["name"],
            description=sample["description"],
            initial_state=sample["initial_state"],
            is_sample=True
        )
        db.add(machine)
        db.flush()

        states = [
            State(
                machine_id=machine.id,
                name=s["name"],
                description=s.get("description", ""),
                is_terminal=s.get("is_terminal", False)
            )
            for s in sample["states"]
        ]
        db.add_all(states)

        transitions = [
            Transition(
                machine_id=machine.id,
                from_state=t["from_state"],
                to_state=t["to_state"],
                event=t["event"]
            )
            for t in sample["transitions"]
        ]
        db.add_all(transitions)

    db.commit()


def seed_firestore_samples():
    """Idempotently seed sample state machines into Firestore (production).

    Samples are written only if no sample doc (is_sample == True) exists yet, so
    repeated startups do not duplicate them. Firestore errors are propagated to the
    caller, which is expected to wrap this call in try/except at startup.
    """
    from .repositories.firestore_repository import FirestoreStateMachineRepository

    repo = FirestoreStateMachineRepository()
    db = repo.db
    collection = db.collection(FirestoreStateMachineRepository.COLLECTION)

    existing = list(collection.where("is_sample", "==", True).limit(1).stream())
    if existing:
        return 0

    now = datetime.now(timezone.utc)
    for sample in SAMPLE_STATE_MACHINES:
        machine_id = str(uuid.uuid4())
        states = [
            {
                "id": str(uuid.uuid4()),
                "name": s["name"],
                "description": s.get("description", ""),
                "is_terminal": s.get("is_terminal", False),
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

    return len(SAMPLE_STATE_MACHINES)
