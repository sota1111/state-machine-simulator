from sqlalchemy.orm import Session
from .models import StateMachine, State, Transition
from .data.sample_state_machines import SAMPLE_STATE_MACHINES

def seed_sample_data(db: Session):
    if db.query(StateMachine).count() > 0:
        return

    for sample in SAMPLE_STATE_MACHINES:
        machine = StateMachine(
            name=sample["name"],
            description=sample["description"],
            initial_state=sample["initial_state"]
        )
        db.add(machine)
        db.flush()

        states = [
            State(
                machine_id=machine.id,
                name=s["name"],
                description=s.get("description", ""),
                is_terminal=s.get("is_terminal", False)
            )
            for s in sample["states"]
        ]
        db.add_all(states)

        transitions = [
            Transition(
                machine_id=machine.id,
                from_state=t["from_state"],
                to_state=t["to_state"],
                event=t["event"]
            )
            for t in sample["transitions"]
        ]
        db.add_all(transitions)

    db.commit()
