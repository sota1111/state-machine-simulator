from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..models import StateMachine, SimulationHistory
from ..schemas import SimulateRequest, SimulateResponse, SimulationHistoryResponse
from ..services.simulator import simulate_step

router = APIRouter(prefix="/models", tags=["simulation"])

@router.post("/{id}/simulate", response_model=SimulateResponse)
def simulate(id: str, request: SimulateRequest, db: Session = Depends(get_db)):
    machine = db.query(StateMachine).filter(StateMachine.id == id, StateMachine.is_deleted == False).first()
    if not machine:
        raise HTTPException(status_code=404, detail="State Machine not found")
    
    success, next_state, message = simulate_step(
        request.current_state, 
        request.event, 
        machine.transitions
    )
    
    # Save to history
    history = SimulationHistory(
        machine_id=id,
        steps=[{
            "current_state": request.current_state,
            "event": request.event,
            "next_state": next_state,
            "success": success,
            "message": message
        }]
    )
    db.add(history)
    db.commit()
    
    return SimulateResponse(
        success=success,
        next_state=next_state,
        message=message
    )

@router.get("/{id}/history", response_model=List[SimulationHistoryResponse])
def get_history(id: str, db: Session = Depends(get_db)):
    machine = db.query(StateMachine).filter(StateMachine.id == id, StateMachine.is_deleted == False).first()
    if not machine:
        raise HTTPException(status_code=404, detail="State Machine not found")
        
    return db.query(SimulationHistory).filter(SimulationHistory.machine_id == id).order_by(SimulationHistory.executed_at.desc()).all()
