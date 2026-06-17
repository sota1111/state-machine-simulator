from fastapi import HTTPException, status
from ..schemas import StateMachineCreate

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
