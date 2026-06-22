import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional

from .base import StateMachineRepository
from ..data.sample_reconcile import build_state_dicts, build_transition_dicts, sample_differs
from ..schemas import (
    StateMachineCreate, StateMachineResponse, StateResponse, TransitionResponse, AnalysisResponse,
    StateMachineVersionSummary, StateMachineVersion,
)


def _snapshot_states(machine_id: str, snapshot: dict) -> List[StateResponse]:
    return [
        StateResponse(
            id=s.get("id", str(uuid.uuid4())),
            machine_id=machine_id,
            name=s["name"],
            description=s.get("description", ""),
            is_terminal=s.get("is_terminal", False),
            parent=s.get("parent"),
        )
        for s in snapshot.get("states", [])
    ]


def _snapshot_transitions(machine_id: str, snapshot: dict) -> List[TransitionResponse]:
    return [
        TransitionResponse(
            id=t.get("id", str(uuid.uuid4())),
            machine_id=machine_id,
            from_state=t["from_state"],
            to_state=t["to_state"],
            event=t["event"],
        )
        for t in snapshot.get("transitions", [])
    ]


def build_version_snapshot(existing: dict, fallback_now: datetime) -> dict:
    """Capture the pre-update content of a machine doc as a numbered version snapshot."""
    versions = existing.get("versions", [])
    return {
        "version": len(versions) + 1,
        "saved_at": existing.get("updated_at") or fallback_now,
        "name": existing["name"],
        "description": existing.get("description", ""),
        "initial_state": existing["initial_state"],
        "states": existing.get("states", []),
        "transitions": existing.get("transitions", []),
    }


class InMemoryStateMachineRepository(StateMachineRepository):
    """Process-local in-memory persistence for local dev and tests.

    Documents are stored in the same shape as the Firestore repository
    (`state_machines` docs + `simulation_history` docs) so that filtering,
    soft-delete and response conversion behave identically to production. No
    file DB is touched, so the app starts on Cloud Run without SQLite.

    A module-level singleton (see `get_memory_repository`) is shared across
    requests within a process. Tests can construct an isolated instance with
    its own backing store via `InMemoryStateMachineRepository(store={}, history={})`.
    """

    def __init__(self, store: Optional[Dict[str, dict]] = None, history: Optional[Dict[str, dict]] = None):
        self._store: Dict[str, dict] = store if store is not None else {}
        self._history: Dict[str, dict] = history if history is not None else {}

    def _doc_to_response(self, data: dict) -> StateMachineResponse:
        states = [
            StateResponse(
                id=s.get("id", str(uuid.uuid4())),
                machine_id=data["id"],
                name=s["name"],
                description=s.get("description", ""),
                is_terminal=s.get("is_terminal", False),
                parent=s.get("parent"),
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
            created_at=data.get("created_at") or datetime.now(timezone.utc),
            updated_at=data.get("updated_at") or datetime.now(timezone.utc),
            states=states,
            transitions=transitions,
        )

    def list(self, is_sample: Optional[bool] = None) -> List[StateMachineResponse]:
        results = []
        for data in self._store.values():
            if data.get("is_deleted"):
                continue
            if is_sample is not None and data.get("is_sample", False) != is_sample:
                continue
            results.append(self._doc_to_response(data))
        return results

    def get(self, id: str) -> Optional[StateMachineResponse]:
        data = self._store.get(id)
        if not data or data.get("is_deleted"):
            return None
        return self._doc_to_response(data)

    def create(self, data: StateMachineCreate) -> StateMachineResponse:
        now = datetime.now(timezone.utc)
        machine_id = str(uuid.uuid4())

        states = [
            {"id": str(uuid.uuid4()), "name": s.name, "description": s.description, "is_terminal": s.is_terminal, "parent": s.parent}
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
        self._store[machine_id] = doc_data
        return self._doc_to_response(doc_data)

    def update(self, id: str, data: StateMachineCreate) -> Optional[StateMachineResponse]:
        existing = self._store.get(id)
        if not existing or existing.get("is_deleted"):
            return None

        now = datetime.now(timezone.utc)
        states = [
            {"id": str(uuid.uuid4()), "name": s.name, "description": s.description, "is_terminal": s.is_terminal, "parent": s.parent}
            for s in data.states
        ]
        transitions = [
            {"id": str(uuid.uuid4()), "from_state": t.from_state, "to_state": t.to_state, "event": t.event}
            for t in data.transitions
        ]

        # Snapshot the pre-update content into the version history (SOT-1102).
        version_snapshot = build_version_snapshot(existing, now)
        versions = [*existing.get("versions", []), version_snapshot]

        updated = {
            **existing,
            "name": data.name,
            "description": data.description,
            "initial_state": data.initial_state,
            "states": states,
            "transitions": transitions,
            "updated_at": now,
            "versions": versions,
        }
        self._store[id] = updated
        return self._doc_to_response(updated)

    def delete(self, id: str) -> bool:
        existing = self._store.get(id)
        if not existing:
            return False
        existing["is_deleted"] = True
        return True

    def get_analysis(self, id: str) -> Optional[AnalysisResponse]:
        machine = self.get(id)
        if not machine:
            return None

        sim_count = sum(1 for h in self._history.values() if h.get("machine_id") == id)

        from ..services.analyzer import analyze_state_machine
        return analyze_state_machine(machine, machine.states, machine.transitions, sim_count)

    def save_simulation_history(self, id: str, history_data: dict) -> None:
        history_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        self._history[history_id] = {
            "id": history_id,
            "machine_id": id,
            "steps": [history_data],
            "executed_at": now,
        }

    def get_simulation_history(self, id: str) -> List[dict]:
        rows = [h for h in self._history.values() if h.get("machine_id") == id]
        rows.sort(key=lambda h: h.get("executed_at") or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
        return rows

    def list_versions(self, id: str) -> Optional[List[StateMachineVersionSummary]]:
        data = self._store.get(id)
        if not data or data.get("is_deleted"):
            return None
        versions = data.get("versions", [])
        summaries = [
            StateMachineVersionSummary(version=v["version"], saved_at=v["saved_at"])
            for v in versions
        ]
        summaries.sort(key=lambda s: s.version, reverse=True)
        return summaries

    def get_version(self, id: str, version: int) -> Optional[StateMachineVersion]:
        data = self._store.get(id)
        if not data or data.get("is_deleted"):
            return None
        snapshot = next((v for v in data.get("versions", []) if v["version"] == version), None)
        if snapshot is None:
            return None
        return StateMachineVersion(
            version=snapshot["version"],
            saved_at=snapshot["saved_at"],
            name=snapshot["name"],
            description=snapshot.get("description", ""),
            initial_state=snapshot["initial_state"],
            states=_snapshot_states(id, snapshot),
            transitions=_snapshot_transitions(id, snapshot),
        )

    def seed_samples(self, samples) -> int:
        """Idempotently reconcile sample state machines into the store by name.

        Mirrors the Firestore seed reconcile: a sample whose name is not yet
        present as a sample (is_sample == True) is inserted, and an existing
        sample whose stored definition differs from the source is refreshed in
        place (keeping its id). This lets definition changes — e.g. added
        `parent` grouping — reach an environment that was seeded earlier, while
        an identical reseed makes no changes. User (non-sample) machines are
        never touched. Returns the number of inserted + updated samples.
        """
        existing_by_name = {
            d.get("name"): d for d in self._store.values() if d.get("is_sample")
        }
        changed = 0
        now = datetime.now(timezone.utc)
        for sample in samples:
            existing = existing_by_name.get(sample["name"])
            if existing is not None:
                if not sample_differs(existing, sample):
                    continue
                existing.update(
                    {
                        "description": sample["description"],
                        "initial_state": sample["initial_state"],
                        "states": build_state_dicts(sample),
                        "transitions": build_transition_dicts(sample),
                        "updated_at": now,
                        "is_deleted": False,
                    }
                )
                changed += 1
                continue
            machine_id = str(uuid.uuid4())
            self._store[machine_id] = {
                "id": machine_id,
                "name": sample["name"],
                "description": sample["description"],
                "initial_state": sample["initial_state"],
                "states": build_state_dicts(sample),
                "transitions": build_transition_dicts(sample),
                "created_at": now,
                "updated_at": now,
                "is_deleted": False,
                "is_sample": True,
            }
            changed += 1
        return changed


_singleton: Optional[InMemoryStateMachineRepository] = None


def get_memory_repository() -> InMemoryStateMachineRepository:
    """Return the process-wide in-memory repository singleton."""
    global _singleton
    if _singleton is None:
        _singleton = InMemoryStateMachineRepository()
    return _singleton
