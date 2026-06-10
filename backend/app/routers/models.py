from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..models import StateMachine, State, Transition, SimulationHistory
from ..schemas import (
    StateMachineCreate, StateMachineResponse, StateMachineUpdate, AnalysisResponse
)
from ..services.analyzer import analyze_state_machine

router = APIRouter(prefix="/models", tags=["models"])

def validate_business_rules(data: StateMachineCreate):
    state_names = [s.name for s in data.states]
    
    # 1. State names must be unique within the model
    if len(state_names) != len(set(state_names)):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="State names must be unique within the model"
        )
    
    # 2. initial_state must exist in the provided states list
    if data.initial_state not in state_names:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"initial_state '{data.initial_state}' must exist in the provided states list"
        )
    
    # 3. Each transition's from_state and to_state must exist in the provided states list
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
def get_models(db: Session = Depends(get_db)):
    return db.query(StateMachine).filter(StateMachine.is_deleted == False).all()

@router.post("/", response_model=StateMachineResponse)
def create_model(data: StateMachineCreate, db: Session = Depends(get_db)):
    validate_business_rules(data)
    
    db_machine = StateMachine(
        name=data.name,
        description=data.description,
        initial_state=data.initial_state
    )
    db.add(db_machine)
    db.flush() # Get ID
    
    for s in data.states:
        db_state = State(
            machine_id=db_machine.id,
            name=s.name,
            description=s.description,
            is_terminal=s.is_terminal
        )
        db.add(db_state)
        
    for t in data.transitions:
        db_transition = Transition(
            machine_id=db_machine.id,
            from_state=t.from_state,
            to_state=t.to_state,
            event=t.event
        )
        db.add(db_transition)
        
    db.commit()
    db.refresh(db_machine)
    return db_machine

@router.get("/{id}", response_model=StateMachineResponse)
def get_model(id: str, db: Session = Depends(get_db)):
    machine = db.query(StateMachine).filter(StateMachine.id == id, StateMachine.is_deleted == False).first()
    if not machine:
        raise HTTPException(status_code=404, detail="State Machine not found")
    return machine

@router.put("/{id}", response_model=StateMachineResponse)
def update_model(id: str, data: StateMachineCreate, db: Session = Depends(get_db)):
    # The prompt says: PUT /api/models/{id} → update StateMachine (replace states/transitions)
    # And mentions business rule validations in POST/PUT.
    # Note: StateMachineUpdate schema exists but PUT usually replaces the whole resource.
    # I'll use StateMachineCreate for simplicity if it replaces states/transitions.
    
    validate_business_rules(data)
    
    db_machine = db.query(StateMachine).filter(StateMachine.id == id, StateMachine.is_deleted == False).first()
    if not db_machine:
        raise HTTPException(status_code=404, detail="State Machine not found")
    
    db_machine.name = data.name
    db_machine.description = data.description
    db_machine.initial_state = data.initial_state
    
    # Replace states and transitions
    db.query(State).filter(State.machine_id == id).delete()
    db.query(Transition).filter(Transition.machine_id == id).delete()
    
    for s in data.states:
        db_state = State(
            machine_id=db_machine.id,
            name=s.name,
            description=s.description,
            is_terminal=s.is_terminal
        )
        db.add(db_state)
        
    for t in data.transitions:
        db_transition = Transition(
            machine_id=db_machine.id,
            from_state=t.from_state,
            to_state=t.to_state,
            event=t.event
        )
        db.add(db_transition)
        
    db.commit()
    db.refresh(db_machine)
    return db_machine

@router.delete("/{id}")
def delete_model(id: str, db: Session = Depends(get_db)):
    db_machine = db.query(StateMachine).filter(StateMachine.id == id).first()
    if not db_machine:
        raise HTTPException(status_code=404, detail="State Machine not found")
    
    db_machine.is_deleted = True
    db.commit()
    return {"message": "State Machine deleted"}

@router.get("/{id}/analysis", response_model=AnalysisResponse)
def get_analysis(id: str, db: Session = Depends(get_db)):
    machine = db.query(StateMachine).filter(StateMachine.id == id, StateMachine.is_deleted == False).first()
    if not machine:
        raise HTTPException(status_code=404, detail="State Machine not found")
    
    sim_count = db.query(SimulationHistory).filter(SimulationHistory.machine_id == id).count()
    
    return analyze_state_machine(machine, machine.states, machine.transitions, sim_count)
