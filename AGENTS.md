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

Stages 3 and 4 contain both CRUD APIs. Stages 5A and 5B contain the outer-card and
inner-card management UI. Review behavior is not implemented yet. Keep future changes
narrowly aligned with the requested iteration.

## Architecture conventions

- Keep browser code in `frontend/` and API/database code in `backend/`.
- Use React function components and TypeScript with strict checking.
- Use TanStack Query for server state. Prefer component state or a small context for
  local UI state; do not introduce a global state library without a demonstrated need.
- Keep route-level UI in `frontend/src/pages/`, shared UI in `frontend/src/components/`,
  and API access in `frontend/src/lib/`.
- Outer-card management lives at `/cards` and `/cards/{outerCardId}`. Keep the selected
  outer card in the URL; use React Router for navigation and TanStack Query for server
  state rather than duplicating either in global state.
- Inner-card selection lives at `/cards/{outerCardId}/inner/{innerCardId}`. Inner lists
  must be scoped by outer-card ID in both the request and query key. Never request inner
  cards without a selected outer card, and never display an inner detail whose returned
  `outer_card_id` differs from the route parent.
- Key parent-scoped inner management state by outer-card ID so changing parents resets
  inner search, pagination, forms, and selection. Deleting an outer card must remove its
  inner list caches and any loaded inner details belonging to it.
- Keep typed resource API clients and query-key factories under `frontend/src/lib/`.
  List query keys must include server search and pagination parameters. Mutations must
  update or invalidate both affected detail and list caches.
- Local frontend development uses the Vite `/api` proxy to port 8000. Use
  `VITE_API_BASE_URL` only when an explicit API origin is required; Vite reads the
  repository-root `.env` through `envDir`.
- Expose backend application routes under `/api/v1`. Keep `/health` unversioned for
  infrastructure liveness checks.
- Outer-card CRUD routes live at `/api/v1/outer-cards`. Keep API request/response schemas
  separate from SQLModel table models, and never include inner-card content in the
  outer-card list or retrieve responses unless a later contract explicitly requests it.
- Create and list inner cards at
  `/api/v1/outer-cards/{outer_card_id}/inner-cards`. Retrieve, update, and delete a
  known inner card at `/api/v1/inner-cards/{inner_card_id}`. The parent relationship is
  chosen at creation and must not be mutable through the inner-card update contract.
- Normalize API strings at the schema boundary: trim all strings, reject blank required
  values, and convert blank optional strings to `null`.
- Outer-card lists use stable ordering by `sort_order`, `created_at`, then `id`.
- Inner-card lists are always scoped to one existing outer card and use stable ordering
  by `sort_order`, `created_at`, then `id`.
- Organize FastAPI endpoints by resource under `backend/app/api/routes/`.
- Put settings and database wiring under `backend/app/core/`.
- Use SQLModel models for persistence and Pydantic response/request models at API
  boundaries. Do not expose database models directly when an API-specific schema is
  clearer.
- All schema changes require an Alembic migration. Never rely on `create_all()` in the
  application startup path.
- Use SQLite file storage for the single-user MVP. The local database belongs at
  `backend/data/layerlex.db` and must never be committed.
- Configure every SQLite connection with `PRAGMA foreign_keys=ON`,
  `PRAGMA journal_mode=WAL`, and `PRAGMA busy_timeout=5000`. Do not create an engine that
  bypasses `create_database_engine()`.
- UUID primary keys use SQLAlchemy's portable `Uuid` type. SQLite stores them as
  `CHAR(32)` values; SQLite does not have a native UUID type.
- Store application timestamps in UTC and return timezone-aware UTC values. The
  `updated_at` value is maintained by the ORM when a model is updated.
- `OuterCard.inner_cards` requires ORM delete-orphan cascade, and
  `InnerCard.outer_card_id` requires database `ON DELETE CASCADE`. Do not weaken either
  side without a new requirement and migration.
- Keep SQLModel types, constraints, and migrations portable where practical so a future
  move to PostgreSQL on Amazon RDS remains possible.
- The initial AWS target is one backend deployment on one EC2 instance, with the SQLite
  file stored outside the release directory on persistent EBS-backed storage. Do not
  share the SQLite file through EFS, NFS, or another network filesystem.
- Multiple backend instances and horizontal scaling are outside the MVP. Consider
  PostgreSQL only if those requirements or many concurrent writers are introduced.
- Production backups must use SQLite's online backup operation (for example, the
  `sqlite3` `.backup` command) and scheduled EBS snapshots. Copying only the main `.db`
  file while the application is writing is not an accepted backup procedure.
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
python -m alembic upgrade head
test -f data/layerlex.db
```

For an API smoke test while the backend is running:

```bash
curl --fail http://localhost:8000/health
curl --fail http://localhost:8000/api/v1/health
```

## Change discipline

- Add or update tests with behavior changes.
- Database and migration tests must use temporary SQLite files. Never downgrade, delete,
  or recreate `backend/data/layerlex.db` from an automated test.
- Keep API contracts typed on both sides.
- Frontend tests must mock the API client or network and must never depend on the real
  backend process or SQLite database.
- Maintain keyboard accessibility for interactive review controls.
- A shuffled review round must be a precomputed permutation, never a fresh random choice
  on each navigation action.
- Persistent UI switches belong in browser storage unless a future requirement calls for
  cross-device persistence.
- Update `README.md`, `.env.example`, and this file when setup, commands, boundaries, or
  conventions change.
