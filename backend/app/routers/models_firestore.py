import os
import uuid
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, HTTPException, status
from ..schemas import (
    StateMachineCreate, StateMachineResponse, StateResponse, TransitionResponse
)
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))
from firestore_client import get_firestore_client
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/models", tags=["models"])

COLLECTION = "state_machines"


def _doc_to_response(data: dict) -> dict:
    """Convert Firestore document dict to StateMachineResponse-compatible dict."""
    created_at = data.get("created_at")
    updated_at = data.get("updated_at")
    
    # Handle Firestore DatetimeWithNanoseconds or regular datetime
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
        created_at=created_at or datetime.now(timezone.utc),
        updated_at=updated_at or datetime.now(timezone.utc),
        states=states,
        transitions=transitions,
    )


def _validate_business_rules(data: StateMachineCreate):
    state_names = [s.name for s in data.states]
    if len(state_names) != len(set(state_names)):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="State names must be unique within the model"
        )
    if data.initial_state not in state_names:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"initial_state '{data.initial_state}' must exist in the provided states list"
        )
    for t in data.transitions:
        if t.from_state not in state_names:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Transition from_state '{t.from_state}' must exist in the provided states list"
            )
        if t.to_state not in state_names:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Transition to_state '{t.to_state}' must exist in the provided states list"
            )


@router.get("/", response_model=List[StateMachineResponse])
def get_models():
    db = get_firestore_client()
    docs = db.collection(COLLECTION).where("is_deleted", "==", False).stream()
    return [_doc_to_response(doc.to_dict()) for doc in docs]


@router.post("/", response_model=StateMachineResponse)
def create_model(data: StateMachineCreate):
    _validate_business_rules(data)
    db = get_firestore_client()

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
    }

    db.collection(COLLECTION).document(machine_id).set(doc_data)
    logger.info(f"Created state machine: {machine_id}")
    return _doc_to_response(doc_data)


@router.get("/{id}", response_model=StateMachineResponse)
def get_model(id: str):
    db = get_firestore_client()
    doc = db.collection(COLLECTION).document(id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="State Machine not found")
    data = doc.to_dict()
    if data.get("is_deleted"):
        raise HTTPException(status_code=404, detail="State Machine not found")
    return _doc_to_response(data)


@router.put("/{id}", response_model=StateMachineResponse)
def update_model(id: str, data: StateMachineCreate):
    _validate_business_rules(data)
    db = get_firestore_client()

    doc_ref = db.collection(COLLECTION).document(id)
    doc = doc_ref.get()
    if not doc.exists or doc.to_dict().get("is_deleted"):
        raise HTTPException(status_code=404, detail="State Machine not found")

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
    logger.info(f"Updated state machine: {id}")
    return _doc_to_response(updated)


@router.delete("/{id}")
def delete_model(id: str):
    db = get_firestore_client()
    doc_ref = db.collection(COLLECTION).document(id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="State Machine not found")
    doc_ref.update({"is_deleted": True})
    logger.info(f"Deleted state machine: {id}")
    return {"message": "State Machine deleted"}


@router.get("/{id}/analysis")
def get_analysis(id: str):
    db = get_firestore_client()
    doc = db.collection(COLLECTION).document(id).get()
    if not doc.exists or doc.to_dict().get("is_deleted"):
        raise HTTPException(status_code=404, detail="State Machine not found")
    data = doc.to_dict()

    # Simple analysis (same logic as SQLite version)
    states = data.get("states", [])
    transitions = data.get("transitions", [])

    return {
        "machine_id": id,
        "state_count": len(states),
        "transition_count": len(transitions),
        "terminal_state_count": sum(1 for s in states if s.get("is_terminal")),
        "simulation_count": 0,
        "unreachable_states": [],
        "dead_end_states": [s["name"] for s in states if s.get("is_terminal")],
    }
