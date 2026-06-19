import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Boolean, ForeignKey, JSON
from sqlalchemy.orm import relationship
from .database import Base

def generate_uuid():
    return str(uuid.uuid4())

class StateMachine(Base):
    __tablename__ = "state_machines"

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(Text)
    initial_state = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_deleted = Column(Boolean, default=False)
    is_sample = Column(Boolean, default=False, nullable=False)

    states = relationship("State", back_populates="machine", cascade="all, delete-orphan")
    transitions = relationship("Transition", back_populates="machine", cascade="all, delete-orphan")
    simulation_histories = relationship("SimulationHistory", back_populates="machine", cascade="all, delete-orphan")

class State(Base):
    __tablename__ = "states"

    id = Column(String, primary_key=True, default=generate_uuid)
    machine_id = Column(String, ForeignKey("state_machines.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text)
    is_terminal = Column(Boolean, default=False)

    machine = relationship("StateMachine", back_populates="states")

class Transition(Base):
    __tablename__ = "transitions"

    id = Column(String, primary_key=True, default=generate_uuid)
    machine_id = Column(String, ForeignKey("state_machines.id"), nullable=False)
    from_state = Column(String, nullable=False)
    to_state = Column(String, nullable=False)
    event = Column(String, nullable=False)

    machine = relationship("StateMachine", back_populates="transitions")

class SimulationHistory(Base):
    __tablename__ = "simulation_histories"

    id = Column(String, primary_key=True, default=generate_uuid)
    machine_id = Column(String, ForeignKey("state_machines.id"), nullable=False)
    executed_at = Column(DateTime, default=datetime.utcnow)
    steps = Column(JSON)  # SQLite supports JSON

    machine = relationship("StateMachine", back_populates="simulation_histories")
