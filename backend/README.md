# Backend - State Machine Simulator

FastAPI backend with SQLAlchemy and Alembic.

## Database Management (Alembic)

We use [Alembic](https://alembic.sqlalchemy.org/) for database migrations (SQLite/SQLAlchemy).

### Migration Commands

Run these commands from the `backend/` directory.

- **Create a new migration (autogenerate):**
  ```bash
  .venv/bin/python -m alembic revision --autogenerate -m "description of changes"
  ```

- **Apply migrations to the latest version:**
  ```bash
  .venv/bin/python -m alembic upgrade head
  ```

- **Revert the last migration:**
  ```bash
  .venv/bin/python -m alembic downgrade -1
  ```

### Note on Local Development

For local development (`APP_ENV=local`), `app/main.py` automatically runs `Base.metadata.create_all()` which creates tables if they don't exist. This is convenient for quick starts.

However, for production or persistent environments, you should use `alembic upgrade head` to ensure the schema is correctly managed and migrated.

## Testing

Run tests using `pytest`:

```bash
APP_ENV=test .venv/bin/python -m pytest
```
