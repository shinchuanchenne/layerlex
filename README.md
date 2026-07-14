# LayerLex

LayerLex is a dual-layer vocabulary flashcard application. An outer card teaches a
word; its inner cards teach natural usage through collocations, phrases, patterns, and
examples.

This repository currently contains the project foundation plus the outer and inner card
database models. It includes a React health page, a FastAPI health API, intentional
SQLite file storage, Alembic migrations, and development tooling. It does not yet
contain flashcard CRUD APIs, management pages, or review features.

## Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, TanStack Query, React Router, Vitest,
  and React Testing Library
- Backend: Python 3.12, FastAPI, SQLModel, Alembic, Pydantic, and Pytest
- Storage: SQLite for the single-user MVP, with a future migration path to PostgreSQL

See [docs/architecture.md](docs/architecture.md) for the main technical decisions and
MVP assumptions.

## Repository layout

```text
layerlex/
├── frontend/            React single-page application
├── backend/             FastAPI application and Alembic migrations
├── docs/                Architecture and product notes
├── .env.example         Safe local configuration template
└── AGENTS.md            Persistent engineering rules
```

## Prerequisites

- Node.js 22 LTS
- npm
- Python 3.12
- Git

The `.nvmrc` and `backend/.python-version` files document the expected runtime versions.

## First-time setup

1. Create local environment variables:

   ```bash
   cp .env.example .env
   ```

   The default SQLite URL stores local data in `backend/data/layerlex.db`. Both `.env`
   and the database file are ignored by Git.

2. Set up the backend:

   ```bash
   cd backend
   python3.12 -m venv .venv
   source .venv/bin/activate
   python -m pip install --upgrade pip
   python -m pip install -e '.[dev]'
   alembic upgrade head
   uvicorn app.main:app --reload --port 8000
   ```

3. In another terminal, set up the frontend:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

Open <http://localhost:5173>. The dedicated frontend health page is at
<http://localhost:5173/health>. FastAPI documentation is at
<http://localhost:8000/docs>.

## Environment variables

| Variable | Purpose | Example |
| --- | --- | --- |
| `DATABASE_URL` | SQLAlchemy/SQLModel connection URL | `sqlite:///./data/layerlex.db` |
| `CORS_ORIGINS` | Comma-separated browser origins | `http://localhost:5173` |
| `BACKEND_PORT` | Documented backend port | `8000` |
| `FRONTEND_PORT` | Documented frontend port | `5173` |
| `VITE_API_URL` | API base URL compiled into the frontend | `http://localhost:8000` |

Vite only exposes frontend variables prefixed with `VITE_`. Do not put secrets in any
`VITE_` variable.

## Database schema

Alembic revision `20260714_0002` adds two tables:

- `outer_cards`: the vocabulary term, optional reading and metadata, meaning, display
  order, UUID identifier, and UTC timestamps.
- `inner_cards`: a collocation, phrase, pattern, or example belonging to exactly one
  outer card, with its own display order, UUID identifier, and UTC timestamps.

Deleting an outer card deletes its inner cards at both the ORM and database levels.
`outer_cards.sort_order` has a non-unique index, and
`inner_cards(outer_card_id, sort_order)` has a non-unique composite index.

SQLite does not provide a native UUID column. SQLAlchemy's portable `Uuid` type stores
UUIDs as `CHAR(32)` in SQLite and exposes them as Python `UUID` objects. This keeps their
application representation suitable for a possible later PostgreSQL migration.

## SQLite connection behavior

Every application and Alembic connection is configured with:

```sql
PRAGMA foreign_keys=ON;
PRAGMA journal_mode=WAL;
PRAGMA busy_timeout=5000;
```

- Foreign-key enforcement is required for `ON DELETE CASCADE` because SQLite does not
  enable foreign keys on every connection by default.
- WAL allows readers to continue while the single application writer commits.
- The busy timeout waits up to five seconds for a database lock rather than failing
  immediately.

WAL produces temporary `-wal` and `-shm` files beside the database. They are runtime
data and are ignored by Git. The database and all WAL-related files must remain on the
same local EBS-backed filesystem in production.

## Validation

Frontend:

```bash
cd frontend
npm run lint
npm run format:check
npm run test
npm run build
```

Backend:

```bash
cd backend
python -m ruff check .
python -m ruff format --check .
python -m pytest
```

Database and migrations:

```bash
cd backend
alembic upgrade head
alembic current
test -f data/layerlex.db
```

Health endpoints:

- `GET http://localhost:8000/health` for infrastructure liveness
- `GET http://localhost:8000/api/v1/health` for the versioned API contract

## Common commands

```bash
# Apply new migrations
cd backend && alembic upgrade head

# Create a migration after adding SQLModel metadata
cd backend && alembic revision --autogenerate -m "describe change"
```

## Single-instance EC2 storage

SQLite is an intentional MVP architecture decision. The initial production deployment
uses one FastAPI backend deployment on one EC2 instance. Store the database on an
EBS-backed path outside the application release directory, for example:

```dotenv
DATABASE_URL=sqlite:////var/lib/layerlex/layerlex.db
```

The EC2 service user must have read and write access to that directory. Start with one
backend worker. Do not store the database inside a container writable layer, temporary
directory, or replaceable deployment folder. If Docker is introduced later, use
`sqlite:////app/data/layerlex.db` and persist `/app/data` on the EC2 EBS filesystem.

Do not place or share the SQLite database through EFS, NFS, or another shared network
filesystem. Multiple backend instances and horizontal scaling are outside the MVP.

Use SQLite's online backup operation for production backups, for example while the
backend remains available:

```bash
sqlite3 /var/lib/layerlex/layerlex.db ".backup '/var/lib/layerlex/layerlex-backup.db'"
```

Schedule these backups and EBS snapshots, and periodically verify that a backup can be
restored. Do not treat a plain copy of only `layerlex.db` during active writes as a safe
backup, because WAL data may also be active.

Move to PostgreSQL on Amazon RDS before adding multiple backend instances, horizontal
autoscaling, or many concurrent writers. Keeping `DATABASE_URL`, SQLModel, and Alembic
as the persistence boundaries makes that later migration manageable.
