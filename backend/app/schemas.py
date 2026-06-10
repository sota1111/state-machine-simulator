from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import List, Optional, Dict, Any

# State schemas
class StateBase(BaseModel):
    name: str
    description: str = ""
    is_terminal: bool = False

class StateCreate(StateBase):
    pass

class StateResponse(StateBase):
    id: str
    machine_id: str
    model_config = ConfigDict(from_attributes=True)

# Transition schemas
class TransitionBase(BaseModel):
    from_state: str
    to_state: str
    event: str

class TransitionCreate(TransitionBase):
    pass

class TransitionResponse(TransitionBase):
    id: str
    machine_id: str
    model_config = ConfigDict(from_attributes=True)

# StateMachine schemas
class StateMachineCreate(BaseModel):
    name: str
    description: str = ""
    initial_state: str
    states: List[StateCreate]
    transitions: List[TransitionCreate]

class StateMachineUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    initial_state: Optional[str] = None
    states: Optional[List[StateCreate]] = None
    transitions: Optional[List[TransitionCreate]] = None

class StateMachineResponse(BaseModel):
    id: str
    name: str
    description: str
    initial_state: str
    created_at: datetime
    updated_at: datetime
    states: List[StateResponse]
    transitions: List[TransitionResponse]
    model_config = ConfigDict(from_attributes=True)

# Simulation schemas
class SimulateRequest(BaseModel):
    current_state: str
    event: str

class SimulateResponse(BaseModel):
    success: bool
    next_state: Optional[str]
    message: str

class SimulationHistoryResponse(BaseModel):
    id: str
    machine_id: str
    executed_at: datetime
    steps: List[Dict[str, Any]]
    model_config = ConfigDict(from_attributes=True)

# Analysis schema
class AnalysisResponse(BaseModel):
    unreachable_states: List[str]
    terminal_states: List[str]
    undefined_events: List[str]
    state_count: int
    transition_count: int
    simulation_run_count: int
