# LayerLex

LayerLex is a dual-layer vocabulary flashcard application. An outer card teaches a
word; its inner cards teach natural usage through collocations, phrases, patterns, and
examples.

This repository currently contains the project foundation, outer and inner card database
models, CRUD APIs for both card layers, and management pages for both card layers. It
includes
intentional SQLite file storage, Alembic migrations, and development tooling. It does
not yet contain review-mode features.

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
   python -m alembic upgrade head
   python -m uvicorn app.main:app --reload --port 8000
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
| `VITE_API_BASE_URL` | Optional API origin compiled into the frontend; blank uses the development proxy | blank |

Vite only exposes frontend variables prefixed with `VITE_`. Do not put secrets in any
`VITE_` variable. Vite reads the repository-root `.env` because this monorepo sets
`envDir` explicitly.

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

## Outer-card API

The outer-card endpoints are available under `/api/v1/outer-cards`:

| Method | Path | Result |
| --- | --- | --- |
| `POST` | `/api/v1/outer-cards` | Create a card and return HTTP 201 |
| `GET` | `/api/v1/outer-cards` | List, search, and paginate cards |
| `GET` | `/api/v1/outer-cards/{id}` | Retrieve one card |
| `PATCH` | `/api/v1/outer-cards/{id}` | Partially update one card |
| `DELETE` | `/api/v1/outer-cards/{id}` | Delete one card and return HTTP 204 |

Create a card:

```bash
curl --request POST http://localhost:8000/api/v1/outer-cards \
  --header 'Content-Type: application/json' \
  --data '{
    "term": "スケジュール",
    "reading": "スケジュール",
    "part_of_speech": "名詞",
    "meaning": "行程、計畫",
    "jlpt_level": "N4",
    "sort_order": 0
  }'
```

List or search cards:

```bash
curl 'http://localhost:8000/api/v1/outer-cards?offset=0&limit=50'
curl 'http://localhost:8000/api/v1/outer-cards?search=スケジュール'
```

Update and delete a card by replacing `{id}` with its UUID:

```bash
curl --request PATCH http://localhost:8000/api/v1/outer-cards/{id} \
  --header 'Content-Type: application/json' \
  --data '{"meaning":"日程"}'

curl --request DELETE http://localhost:8000/api/v1/outer-cards/{id}
```

All string inputs are trimmed. Blank required fields are rejected, while blank optional
strings become `null`. List results are ordered by `sort_order`, `created_at`, then `id`.
The list and retrieve responses intentionally omit inner-card content. Interactive API
documentation and request schemas are available at <http://localhost:8000/docs>.

## Inner-card API

Create and list inner cards through their outer-card relationship. Retrieve, update,
and delete a known inner card directly:

| Method | Path | Result |
| --- | --- | --- |
| `POST` | `/api/v1/outer-cards/{outer_id}/inner-cards` | Create an inner card and return HTTP 201 |
| `GET` | `/api/v1/outer-cards/{outer_id}/inner-cards` | List, search, and paginate one outer card's inner cards |
| `GET` | `/api/v1/inner-cards/{inner_id}` | Retrieve one inner card |
| `PATCH` | `/api/v1/inner-cards/{inner_id}` | Partially update one inner card |
| `DELETE` | `/api/v1/inner-cards/{inner_id}` | Delete one inner card and return HTTP 204 |

Create an inner card by replacing `{outer_id}` with an existing outer-card UUID:

```bash
curl --request POST \
  http://localhost:8000/api/v1/outer-cards/{outer_id}/inner-cards \
  --header 'Content-Type: application/json' \
  --data '{
    "expression": "経験を積む",
    "reading": "けいけんをつむ",
    "meaning": "累積經驗",
    "usage_note": "常用搭配",
    "sort_order": 0
  }'
```

List all inner cards for that outer card, or search their expression, reading, meaning,
and usage note:

```bash
curl 'http://localhost:8000/api/v1/outer-cards/{outer_id}/inner-cards?offset=0&limit=50'
curl 'http://localhost:8000/api/v1/outer-cards/{outer_id}/inner-cards?search=経験'
```

Update or delete an inner card by replacing `{inner_id}` with its UUID:

```bash
curl --request PATCH http://localhost:8000/api/v1/inner-cards/{inner_id} \
  --header 'Content-Type: application/json' \
  --data '{"meaning":"增加經驗"}'

curl --request DELETE http://localhost:8000/api/v1/inner-cards/{inner_id}
```

The outer-card relationship is set by the create URL and cannot be changed through the
update API. Inner-card lists include only the selected outer card and use stable
ordering by `sort_order`, `created_at`, then `id`. Deleting one inner card preserves
its parent and siblings; deleting an outer card still cascades to all of its inner
cards.

## Outer-card management page

Start the backend on port 8000 and the frontend on port 5173, then open
<http://localhost:5173/cards>. The selected outer card is stored in the URL as
`/cards/{outerCardId}`, so refreshing or sharing the address preserves that selection.

The responsive management page provides:

- a searchable, paginated outer-card directory;
- selected outer-card details with a nested inner-card management section;
- create and edit forms with client and FastAPI validation feedback;
- confirmed deletion with the existing backend cascade behavior;
- loading, error, retry, empty-database, and empty-search states.

During local development, browser requests to `/api` are proxied by Vite to
`http://localhost:8000`. Leave `VITE_API_BASE_URL` blank to use this proxy. Set it to
an explicit origin only when the frontend and API are served from different origins.
Changing a Vite environment variable requires restarting the frontend development
server.

## Inner-card management

Select an outer card at `/cards/{outerCardId}` to load only that card's inner-card
directory. Selecting an inner card changes the route to
`/cards/{outerCardId}/inner/{innerCardId}`. Both IDs are therefore restored by direct
navigation, refresh, browser history, or a shared URL.

The inner-card section provides server-side search and pagination, full create, edit,
retrieve, and delete management, parent mismatch protection, and loading, empty,
error, and retry states. Creating and editing never accepts an editable parent ID;
the parent comes from the selected outer-card route. Deleting an inner card preserves
its outer card and sibling inner cards, while deleting an outer card clears its
associated frontend inner-card caches.

Stage 5B is a management interface only. It does not implement card flipping, review
navigation, review queues, shuffle, keyboard review controls, or automatic inner
content preferences.

Use the same local startup commands above, then open <http://localhost:5173/cards>.
Run focused frontend management tests with:

```bash
cd frontend
npm run test -- src/pages/InnerCardsManagement.test.tsx
npm run test -- src/lib/innerCards.test.ts
```

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

Run only one card layer's API tests:

```bash
cd backend
python -m pytest tests/test_outer_cards_api.py
python -m pytest tests/test_inner_cards_api.py
```

Database and migrations:

```bash
cd backend
python -m alembic upgrade head
python -m alembic current
test -f data/layerlex.db
```

Health endpoints:

- `GET http://localhost:8000/health` for infrastructure liveness
- `GET http://localhost:8000/api/v1/health` for the versioned API contract

## Common commands

```bash
# Apply new migrations
cd backend && python -m alembic upgrade head

# Create a migration after adding SQLModel metadata
cd backend && python -m alembic revision --autogenerate -m "describe change"
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
