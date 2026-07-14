# LayerLex Agent Guide

These rules apply to the entire repository.

## Product boundary

LayerLex is a two-layer vocabulary flashcard application. Outer cards represent
words; inner cards represent collocations, phrases, usage patterns, or example
sentences belonging to one outer card.

The initial MVP may eventually include outer and inner card CRUD, review modes,
keyboard navigation, persistent display preferences, directories, ordered and
complete-queue shuffled review, and progress display. Do not add authentication,
cloud deployment, AI-generated vocabulary, spaced repetition, Redux, Firebase,
Supabase, Next.js, or a component library unless the user explicitly expands scope.

The current foundation iteration contains no flashcard domain features. Keep future
changes narrowly aligned with the requested iteration.

## Architecture conventions

- Keep browser code in `frontend/` and API/database code in `backend/`.
- Use React function components and TypeScript with strict checking.
- Use TanStack Query for server state. Prefer component state or a small context for
  local UI state; do not introduce a global state library without a demonstrated need.
- Keep route-level UI in `frontend/src/pages/`, shared UI in `frontend/src/components/`,
  and API access in `frontend/src/lib/`.
- Expose backend application routes under `/api/v1`. Keep `/health` unversioned for
  infrastructure liveness checks.
- Organize FastAPI endpoints by resource under `backend/app/api/routes/`.
- Put settings and database wiring under `backend/app/core/`.
- Use SQLModel models for persistence and Pydantic response/request models at API
  boundaries. Do not expose database models directly when an API-specific schema is
  clearer.
- All schema changes require an Alembic migration. Never rely on `create_all()` in the
  application startup path.
- Use SQLite file storage for the single-user MVP. The local database belongs at
  `backend/data/layerlex.db` and must never be committed.
- Keep SQLModel types, constraints, and migrations portable where practical so a future
  move to PostgreSQL on Amazon RDS remains possible.
- The initial AWS target is one application process on one EC2 instance, with the SQLite
  file stored outside the release directory on persistent EBS-backed storage.
- Read configuration from environment variables. Commit only `.env.example`, never
  `.env` or credentials.
- Prefer direct, readable code over premature helpers, repositories, services, or base
  classes. Add an abstraction only after it removes concrete duplication or clarifies a
  boundary.

## Runtime requirements

- Node.js 22 LTS and npm.
- Python 3.12.
- SQLite through Python's standard library. Docker is not required for the MVP.

## Validation commands

Run commands from the repository root unless a command starts with `cd`.

```bash
cd frontend
npm run lint
npm run format:check
npm run test
npm run build

cd ../backend
python -m ruff check .
python -m ruff format --check .
python -m pytest
alembic upgrade head
test -f data/layerlex.db
```

For an API smoke test while the backend is running:

```bash
curl --fail http://localhost:8000/health
curl --fail http://localhost:8000/api/v1/health
```

## Change discipline

- Add or update tests with behavior changes.
- Keep API contracts typed on both sides.
- Maintain keyboard accessibility for interactive review controls.
- A shuffled review round must be a precomputed permutation, never a fresh random choice
  on each navigation action.
- Persistent UI switches belong in browser storage unless a future requirement calls for
  cross-device persistence.
- Update `README.md`, `.env.example`, and this file when setup, commands, boundaries, or
  conventions change.
