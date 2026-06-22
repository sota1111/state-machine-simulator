from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from ..dependencies import get_repository
from ..repositories.base import StateMachineRepository
from ..schemas import (
    StateMachineCreate, StateMachineResponse, AnalysisResponse,
    StateMachineVersionSummary, StateMachineVersion,
)
from ..services.validation import validate_business_rules

router = APIRouter(prefix="/models", tags=["models"])

@router.get("/", response_model=List[StateMachineResponse])
def get_models(
    is_sample: Optional[bool] = None,
    repo: StateMachineRepository = Depends(get_repository),
):
    return repo.list(is_sample=is_sample)

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

@router.get("/{id}/versions", response_model=List[StateMachineVersionSummary])
def list_versions(id: str, repo: StateMachineRepository = Depends(get_repository)):
    versions = repo.list_versions(id)
    if versions is None:
        raise HTTPException(status_code=404, detail="State Machine not found")
    return versions

@router.get("/{id}/versions/{version}", response_model=StateMachineVersion)
def get_version(id: str, version: int, repo: StateMachineRepository = Depends(get_repository)):
    snapshot = repo.get_version(id, version)
    if snapshot is None:
        raise HTTPException(status_code=404, detail="Version not found")
    return snapshot
