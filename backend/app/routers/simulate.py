from fastapi import APIRouter, Depends, HTTPException
from typing import List
from ..dependencies import get_repository
from ..repositories.base import StateMachineRepository
from ..schemas import SimulateRequest, SimulateResponse, SimulationHistoryResponse
from ..services.simulator import simulate_step

router = APIRouter(prefix="/models", tags=["simulation"])

@router.post("/{id}/simulate", response_model=SimulateResponse)
def simulate(id: str, request: SimulateRequest, repo: StateMachineRepository = Depends(get_repository)):
    machine = repo.get(id)
    if not machine:
        raise HTTPException(status_code=404, detail="State Machine not found")
    
    success, next_state, message = simulate_step(
        request.current_state, 
        request.event, 
        machine.transitions
    )
    
    # Save to history
    history_data = {
        "current_state": request.current_state,
        "event": request.event,
        "next_state": next_state,
        "success": success,
        "message": message
    }
    repo.save_simulation_history(id, history_data)
    
    return SimulateResponse(
        success=success,
        next_state=next_state,
        message=message
    )

@router.get("/{id}/history", response_model=List[SimulationHistoryResponse])
def get_history(id: str, repo: StateMachineRepository = Depends(get_repository)):
    machine = repo.get(id)
    if not machine:
        raise HTTPException(status_code=404, detail="State Machine not found")
        
    return repo.get_simulation_history(id)
