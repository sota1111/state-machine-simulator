"""Tests for the sample seed reconcile behavior (SOT-893, SOT-977).

The seed must be idempotent AND must pick up samples added after an environment
was first seeded — i.e. it reconciles by name rather than skipping entirely when
the store is non-empty. After SOT-977 the local/test persistence is the
in-memory repository (Firestore in production), so this exercises
`InMemoryStateMachineRepository.seed_samples`.
"""
from app.repositories.memory_repository import InMemoryStateMachineRepository
from app.data.sample_state_machines import SAMPLE_STATE_MACHINES


def _make_repo():
    return InMemoryStateMachineRepository(store={}, history={})


def _sample_names(repo):
    return {m.name for m in repo.list(is_sample=True)}


def test_seed_inserts_all_samples_on_empty_store():
    repo = _make_repo()
    added = repo.seed_samples(SAMPLE_STATE_MACHINES)
    assert added == len(SAMPLE_STATE_MACHINES)
    assert _sample_names(repo) == {s["name"] for s in SAMPLE_STATE_MACHINES}


def test_seed_is_idempotent():
    repo = _make_repo()
    repo.seed_samples(SAMPLE_STATE_MACHINES)
    added_again = repo.seed_samples(SAMPLE_STATE_MACHINES)
    assert added_again == 0
    # No duplicates
    names = [m.name for m in repo.list(is_sample=True)]
    assert len(names) == len(set(names)) == len(SAMPLE_STATE_MACHINES)


def test_seed_adds_missing_sample_to_already_seeded_store():
    """Regression for SOT-893: a sample added after first seed must still appear."""
    repo = _make_repo()
    # Simulate an environment that was seeded before one sample existed.
    skipped = SAMPLE_STATE_MACHINES[0]["name"]
    repo.seed_samples([s for s in SAMPLE_STATE_MACHINES if s["name"] != skipped])
    assert skipped not in _sample_names(repo)

    added = repo.seed_samples(SAMPLE_STATE_MACHINES)
    assert added == 1
    assert skipped in _sample_names(repo)
    assert _sample_names(repo) == {s["name"] for s in SAMPLE_STATE_MACHINES}


def test_seed_preserves_user_machines():
    """User-created (non-sample) machines must never block or be touched by seed."""
    from app.schemas import StateMachineCreate, StateCreate, TransitionCreate

    repo = _make_repo()
    repo.create(
        StateMachineCreate(
            name="My Machine",
            description="",
            initial_state="S1",
            states=[StateCreate(name="S1"), StateCreate(name="S2", is_terminal=True)],
            transitions=[TransitionCreate(from_state="S1", to_state="S2", event="go")],
        )
    )

    added = repo.seed_samples(SAMPLE_STATE_MACHINES)
    assert added == len(SAMPLE_STATE_MACHINES)
    # user machine still present, untouched
    user = repo.list(is_sample=False)
    assert [m.name for m in user] == ["My Machine"]
