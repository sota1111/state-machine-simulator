from fastapi import APIRouter, Depends, HTTPException
from typing import List
from ..dependencies import get_repository
from ..repositories.base import StateMachineRepository
from ..schemas import (
    StateMachineCreate, StateMachineResponse, AnalysisResponse
)
from ..services.validation import validate_business_rules

router = APIRouter(prefix="/models", tags=["models"])

@router.get("/", response_model=List[StateMachineResponse])
def get_models(repo: StateMachineRepository = Depends(get_repository)):
    return repo.list()

@router.post("/", response_model=StateMachineResponse)
def create_model(data: StateMachineCreate, repo: StateMachineRepository = Depends(get_repository)):
    validate_business_rules(data)
    return repo.create(data)

@router.get("/{id}", response_model=StateMachineResponse)
def get_model(id: str, repo: StateMachineRepository = Depends(get_repository)):
    machine = repo.get(id)
    if not machine:
        raise HTTPException(status_code=404, detail="State Machine not found")
    return machine

@router.put("/{id}", response_model=StateMachineResponse)
def update_model(id: str, data: StateMachineCreate, repo: StateMachineRepository = Depends(get_repository)):
    validate_business_rules(data)
    machine = repo.update(id, data)
    if not machine:
        raise HTTPException(status_code=404, detail="State Machine not found")
    return machine

@router.delete("/{id}")
def delete_model(id: str, repo: StateMachineRepository = Depends(get_repository)):
    success = repo.delete(id)
    if not success:
        raise HTTPException(status_code=404, detail="State Machine not found")
    return {"message": "State Machine deleted"}

@router.get("/{id}/analysis", response_model=AnalysisResponse)
def get_analysis(id: str, repo: StateMachineRepository = Depends(get_repository)):
    analysis = repo.get_analysis(id)
    if not analysis:
        raise HTTPException(status_code=404, detail="State Machine not found")
    return analysis
