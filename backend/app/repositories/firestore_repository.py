import uuid
from datetime import datetime, timezone
from typing import List, Optional
from .base import StateMachineRepository
from ..schemas import (
    StateMachineCreate, StateMachineResponse, StateResponse, TransitionResponse, AnalysisResponse
)

class FirestoreStateMachineRepository(StateMachineRepository):
    COLLECTION = "state_machines"
    HISTORY_COLLECTION = "simulation_history"

    def __init__(self):
        # firestore_client lives inside the app package so it is always shipped
        # with `COPY app/` in the Docker image (regardless of WORKDIR).
        from ..firestore_client import get_firestore_client
        self.db = get_firestore_client()

    def _doc_to_response(self, data: dict) -> StateMachineResponse:
        created_at = data.get("created_at")
        updated_at = data.get("updated_at")
        
        if hasattr(created_at, 'seconds'):
            created_at = datetime.fromtimestamp(created_at.seconds, tz=timezone.utc)
        if hasattr(updated_at, 'seconds'):
            updated_at = datetime.fromtimestamp(updated_at.seconds, tz=timezone.utc)

        states = [
            StateResponse(
                id=s.get("id", str(uuid.uuid4())),
                machine_id=data["id"],
                name=s["name"],
                description=s.get("description", ""),
                is_terminal=s.get("is_terminal", False),
            )
            for s in data.get("states", [])
        ]

        transitions = [
            TransitionResponse(
                id=t.get("id", str(uuid.uuid4())),
                machine_id=data["id"],
                from_state=t["from_state"],
                to_state=t["to_state"],
                event=t["event"],
            )
            for t in data.get("transitions", [])
        ]

        return StateMachineResponse(
            id=data["id"],
            name=data["name"],
            description=data.get("description", ""),
            initial_state=data["initial_state"],
            is_sample=data.get("is_sample", False),
            created_at=created_at or datetime.now(timezone.utc),
            updated_at=updated_at or datetime.now(timezone.utc),
            states=states,
            transitions=transitions,
        )

    def list(self, is_sample: Optional[bool] = None) -> List[StateMachineResponse]:
        query = self.db.collection(self.COLLECTION).where("is_deleted", "==", False)
        if is_sample is not None:
            query = query.where("is_sample", "==", is_sample)
        docs = query.stream()
        return [self._doc_to_response(doc.to_dict()) for doc in docs]

    def get(self, id: str) -> Optional[StateMachineResponse]:
        doc = self.db.collection(self.COLLECTION).document(id).get()
        if not doc.exists:
            return None
        data = doc.to_dict()
        if data.get("is_deleted"):
            return None
        return self._doc_to_response(data)

    def create(self, data: StateMachineCreate) -> StateMachineResponse:
        now = datetime.now(timezone.utc)
        machine_id = str(uuid.uuid4())

        states = [
            {"id": str(uuid.uuid4()), "name": s.name, "description": s.description, "is_terminal": s.is_terminal}
            for s in data.states
        ]
        transitions = [
            {"id": str(uuid.uuid4()), "from_state": t.from_state, "to_state": t.to_state, "event": t.event}
            for t in data.transitions
        ]

        doc_data = {
            "id": machine_id,
            "name": data.name,
            "description": data.description,
            "initial_state": data.initial_state,
            "states": states,
            "transitions": transitions,
            "created_at": now,
            "updated_at": now,
            "is_deleted": False,
            "is_sample": False,
        }

        self.db.collection(self.COLLECTION).document(machine_id).set(doc_data)
        return self._doc_to_response(doc_data)

    def update(self, id: str, data: StateMachineCreate) -> StateMachineResponse:
        doc_ref = self.db.collection(self.COLLECTION).document(id)
        doc = doc_ref.get()
        if not doc.exists or doc.to_dict().get("is_deleted"):
            return None

        now = datetime.now(timezone.utc)
        existing = doc.to_dict()

        states = [
            {"id": str(uuid.uuid4()), "name": s.name, "description": s.description, "is_terminal": s.is_terminal}
            for s in data.states
        ]
        transitions = [
            {"id": str(uuid.uuid4()), "from_state": t.from_state, "to_state": t.to_state, "event": t.event}
            for t in data.transitions
        ]

        updated = {
            **existing,
            "name": data.name,
            "description": data.description,
            "initial_state": data.initial_state,
            "states": states,
            "transitions": transitions,
            "updated_at": now,
        }

        doc_ref.set(updated)
        return self._doc_to_response(updated)

    def delete(self, id: str) -> bool:
        doc_ref = self.db.collection(self.COLLECTION).document(id)
        doc = doc_ref.get()
        if not doc.exists:
            return False
        doc_ref.update({"is_deleted": True})
        return True

    def get_analysis(self, id: str) -> AnalysisResponse:
        machine = self.get(id)
        if not machine:
            return None
        
        # Count simulations in Firestore
        sim_docs = self.db.collection(self.HISTORY_COLLECTION).where("machine_id", "==", id).stream()
        sim_count = sum(1 for _ in sim_docs)
        
        from ..services.analyzer import analyze_state_machine
        return analyze_state_machine(machine, machine.states, machine.transitions, sim_count)

    def save_simulation_history(self, id: str, history_data: dict) -> None:
        history_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        
        doc_data = {
            "id": history_id,
            "machine_id": id,
            "steps": [history_data],
            "executed_at": now
        }
        self.db.collection(self.HISTORY_COLLECTION).document(history_id).set(doc_data)

    def get_simulation_history(self, id: str) -> List[dict]:
        docs = self.db.collection(self.HISTORY_COLLECTION)\
            .where("machine_id", "==", id)\
            .order_by("executed_at", direction="DESCENDING")\
            .stream()
        
        results = []
        for doc in docs:
            data = doc.to_dict()
            executed_at = data.get("executed_at")
            if hasattr(executed_at, 'seconds'):
                data["executed_at"] = datetime.fromtimestamp(executed_at.seconds, tz=timezone.utc)
            results.append(data)
        return results
