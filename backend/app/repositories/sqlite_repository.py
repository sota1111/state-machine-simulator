from typing import List, Optional
from sqlalchemy.orm import Session
from .base import StateMachineRepository
from ..models import StateMachine, State, Transition, SimulationHistory
from ..schemas import StateMachineCreate, StateMachineResponse, AnalysisResponse
from ..services.analyzer import analyze_state_machine

class SQLiteStateMachineRepository(StateMachineRepository):
    def __init__(self, db: Session):
        self.db = db

    def list(self, is_sample: Optional[bool] = None) -> List[StateMachineResponse]:
        query = self.db.query(StateMachine).filter(StateMachine.is_deleted == False)
        if is_sample is not None:
            query = query.filter(StateMachine.is_sample == is_sample)
        return query.all()

    def get(self, id: str) -> Optional[StateMachineResponse]:
        return self.db.query(StateMachine).filter(StateMachine.id == id, StateMachine.is_deleted == False).first()

    def create(self, data: StateMachineCreate) -> StateMachineResponse:
        db_machine = StateMachine(
            name=data.name,
            description=data.description,
            initial_state=data.initial_state
        )
        self.db.add(db_machine)
        self.db.flush()
        
        for s in data.states:
            db_state = State(
                machine_id=db_machine.id,
                name=s.name,
                description=s.description,
                is_terminal=s.is_terminal
            )
            self.db.add(db_state)
            
        for t in data.transitions:
            db_transition = Transition(
                machine_id=db_machine.id,
                from_state=t.from_state,
                to_state=t.to_state,
                event=t.event
            )
            self.db.add(db_transition)
            
        self.db.commit()
        self.db.refresh(db_machine)
        return db_machine

    def update(self, id: str, data: StateMachineCreate) -> StateMachineResponse:
        db_machine = self.db.query(StateMachine).filter(StateMachine.id == id, StateMachine.is_deleted == False).first()
        if not db_machine:
            return None
        
        db_machine.name = data.name
        db_machine.description = data.description
        db_machine.initial_state = data.initial_state
        
        # Replace states and transitions
        self.db.query(State).filter(State.machine_id == id).delete()
        self.db.query(Transition).filter(Transition.machine_id == id).delete()
        
        for s in data.states:
            db_state = State(
                machine_id=db_machine.id,
                name=s.name,
                description=s.description,
                is_terminal=s.is_terminal
            )
            self.db.add(db_state)
            
        for t in data.transitions:
            db_transition = Transition(
                machine_id=db_machine.id,
                from_state=t.from_state,
                to_state=t.to_state,
                event=t.event
            )
            self.db.add(db_transition)
            
        self.db.commit()
        self.db.refresh(db_machine)
        return db_machine

    def delete(self, id: str) -> bool:
        db_machine = self.db.query(StateMachine).filter(StateMachine.id == id).first()
        if not db_machine:
            return False
        
        db_machine.is_deleted = True
        self.db.commit()
        return True

    def get_analysis(self, id: str) -> AnalysisResponse:
        machine = self.db.query(StateMachine).filter(StateMachine.id == id, StateMachine.is_deleted == False).first()
        if not machine:
            return None
        
        sim_count = self.db.query(SimulationHistory).filter(SimulationHistory.machine_id == id).count()
        return analyze_state_machine(machine, machine.states, machine.transitions, sim_count)

    def save_simulation_history(self, id: str, history_data: dict) -> None:
        history = SimulationHistory(
            machine_id=id,
            steps=[history_data]
        )
        self.db.add(history)
        self.db.commit()

    def get_simulation_history(self, id: str) -> List[dict]:
        return self.db.query(SimulationHistory).filter(SimulationHistory.machine_id == id).order_by(SimulationHistory.executed_at.desc()).all()
