# Backend - State Machine Simulator

FastAPI backend. Persistence has no file DB dependency.

## Persistence

- **Production (`APP_ENV=production`):** Google Cloud Firestore
  (`app/repositories/firestore_repository.py`). Collections: `state_machines`,
  `simulation_history`. Samples are reconciled into Firestore on startup.
- **Local / tests (any other `APP_ENV`):** a process-local in-memory repository
  (`app/repositories/memory_repository.py`). No SQLite, no migrations, no data
  directory. Samples are seeded into the in-memory store on startup.

There is no SQLAlchemy/Alembic and no `DATABASE_URL`. The repository is selected
in `app/dependencies.py:get_repository`.

## Testing

Run tests using `pytest`:

```bash
APP_ENV=test .venv/bin/python -m pytest
```
