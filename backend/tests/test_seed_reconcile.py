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


def _find_sample(repo, name):
    return next(m for m in repo.list(is_sample=True) if m.name == name)


def test_seed_refreshes_existing_sample_when_definition_changed():
    """SOT-976: a sample seeded before `parent` grouping existed must be refreshed.

    Simulates a stale environment by first seeding a flat copy (parent stripped)
    of a real sample, then reseeding with the real definitions. The stored sample
    must gain its parent grouping, without creating a duplicate doc.
    """
    repo = _make_repo()
    target = next(
        s for s in SAMPLE_STATE_MACHINES if any(st.get("parent") for st in s["states"])
    )
    flat = {
        **target,
        "states": [
            {k: v for k, v in st.items() if k != "parent"} for st in target["states"]
        ],
    }

    # Seed the stale, flat version first.
    repo.seed_samples([flat])
    before = _find_sample(repo, target["name"])
    assert all(st.parent is None for st in before.states)

    # Reseed with the real definitions: the existing sample is refreshed in place.
    changed = repo.seed_samples(SAMPLE_STATE_MACHINES)
    assert changed >= 1

    after = _find_sample(repo, target["name"])
    assert any(st.parent for st in after.states)
    # No duplicate sample doc was created.
    names = [m.name for m in repo.list(is_sample=True)]
    assert names.count(target["name"]) == 1

    # A second identical reseed is a no-op.
    assert repo.seed_samples(SAMPLE_STATE_MACHINES) == 0


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
