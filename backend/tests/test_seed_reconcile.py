"""Tests for the SQLite sample seed reconcile behavior (SOT-893).

The seed must be idempotent AND must pick up samples added after an environment
was first seeded — i.e. it reconciles by name rather than skipping entirely when
the table is non-empty.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models import StateMachine
from app.seed import seed_sample_data
from app.data.sample_state_machines import SAMPLE_STATE_MACHINES


def _make_session():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(engine)
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)()


def _sample_names(db):
    return {
        name
        for (name,) in db.query(StateMachine.name)
        .filter(StateMachine.is_sample == True)  # noqa: E712
        .all()
    }


def test_seed_inserts_all_samples_on_empty_db():
    db = _make_session()
    try:
        added = seed_sample_data(db)
        assert added == len(SAMPLE_STATE_MACHINES)
        assert _sample_names(db) == {s["name"] for s in SAMPLE_STATE_MACHINES}
    finally:
        db.close()


def test_seed_is_idempotent():
    db = _make_session()
    try:
        seed_sample_data(db)
        added_again = seed_sample_data(db)
        assert added_again == 0
        # No duplicates
        names = [
            name
            for (name,) in db.query(StateMachine.name)
            .filter(StateMachine.is_sample == True)  # noqa: E712
            .all()
        ]
        assert len(names) == len(set(names)) == len(SAMPLE_STATE_MACHINES)
    finally:
        db.close()


def test_seed_adds_missing_sample_to_already_seeded_db():
    """Regression for SOT-893: a sample added after first seed must still appear."""
    db = _make_session()
    try:
        # Simulate an environment that was seeded before one sample existed.
        skipped = SAMPLE_STATE_MACHINES[0]["name"]
        for sample in SAMPLE_STATE_MACHINES:
            if sample["name"] == skipped:
                continue
            db.add(
                StateMachine(
                    name=sample["name"],
                    description=sample["description"],
                    initial_state=sample["initial_state"],
                    is_sample=True,
                )
            )
        db.commit()
        assert skipped not in _sample_names(db)

        added = seed_sample_data(db)
        assert added == 1
        assert skipped in _sample_names(db)
        assert _sample_names(db) == {s["name"] for s in SAMPLE_STATE_MACHINES}
    finally:
        db.close()


def test_seed_preserves_user_machines():
    """User-created (non-sample) machines must never block or be touched by seed."""
    db = _make_session()
    try:
        db.add(
            StateMachine(
                name="My Machine",
                description="",
                initial_state="S1",
                is_sample=False,
            )
        )
        db.commit()

        added = seed_sample_data(db)
        assert added == len(SAMPLE_STATE_MACHINES)
        # user machine still present, untouched
        user = (
            db.query(StateMachine)
            .filter(StateMachine.is_sample == False)  # noqa: E712
            .all()
        )
        assert [m.name for m in user] == ["My Machine"]
    finally:
        db.close()
