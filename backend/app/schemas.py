from pydantic import BaseModel, ConfigDict, field_validator
from datetime import datetime
from typing import List, Optional, Dict, Any


def _none_to_empty(value: Optional[str]) -> str:
    """Coerce a NULL/None description (e.g. from nullable DB columns) to "".

    Stored state machines and states may have a NULL `description` column, which
    must not break response serialization for non-optional `str` fields.
    """
    return value if value is not None else ""

# State schemas
class StateBase(BaseModel):
    name: str
    description: str = ""
    is_terminal: bool = False
    # Optional parent/super state grouping this state belongs to (hierarchical display).
    parent: Optional[str] = None

    @field_validator("description", mode="before")
    @classmethod
    def _coerce_description(cls, value: Optional[str]) -> str:
        return _none_to_empty(value)

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
    is_sample: bool = False
    created_at: datetime
    updated_at: datetime
    states: List[StateResponse]
    transitions: List[TransitionResponse]
    model_config = ConfigDict(from_attributes=True)

    @field_validator("description", mode="before")
    @classmethod
    def _coerce_description(cls, value: Optional[str]) -> str:
        return _none_to_empty(value)

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

# Design-review schemas (SOT-1096)
class ReviewRequest(BaseModel):
    initial_state: str
    states: List[StateCreate]
    transitions: List[TransitionCreate]
    # Original natural-language specification, used to enrich AI-assisted findings.
    spec_text: Optional[str] = None

class ReviewFinding(BaseModel):
    # type: unreachable_state | undefined_event | non_terminating | missing_error_handling
    #     | missing_cancel | missing_timeout | ambiguous_condition
    type: str
    # severity: error | warning | info
    severity: str
    # The state name / event / transition the finding refers to (may be empty for
    # machine-wide findings).
    target: str = ""
    reason: str
    suggestion: str

class ReviewResponse(BaseModel):
    findings: List[ReviewFinding]
    # True when AI augmentation contributed findings (false in deterministic-only fallback).
    ai_used: bool = False

# Test-case generation schemas (SOT-1097)
class TestCaseRequest(BaseModel):
    initial_state: str
    states: List[StateCreate]
    transitions: List[TransitionCreate]

class TestCaseStep(BaseModel):
    from_state: str
    event: str
    to_state: str

class TestCase(BaseModel):
    # category: normal | abnormal | cancel | timeout
    category: str
    title: str
    steps: List[TestCaseStep]
    expected: str

class TestCaseResponse(BaseModel):
    cases: List[TestCase]
