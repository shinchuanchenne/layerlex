# LayerLex

LayerLex is a dual-layer vocabulary flashcard application. An outer card teaches a
word; its inner cards teach natural usage through collocations, phrases, patterns, and
examples.

This repository currently contains the project foundation, outer and inner card database
models, CRUD APIs and management pages for both card layers, and the basic ordered outer
and inner flashcard review interfaces. It includes intentional SQLite file storage,
Alembic migrations, and development tooling.

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
| `GET` | `/api/v1/inner-cards` | List, search, and paginate all inner cards globally |
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
update API. Parent-scoped inner-card lists include only the selected outer card and use
stable ordering by `sort_order`, `created_at`, then `id`. Deleting one inner card
preserves its parent and siblings; deleting an outer card still cascades to all of its
inner cards.

### Global inner-card collection

`GET /api/v1/inner-cards` is the ordered data source for the independent inner-card
review mode. Unlike the parent-scoped endpoint, it returns inner cards across
all outer cards without requiring an outer-card ID.

```bash
curl 'http://localhost:8000/api/v1/inner-cards'
curl 'http://localhost:8000/api/v1/inner-cards?offset=50&limit=50'
curl 'http://localhost:8000/api/v1/inner-cards?search=経験'
```

Query parameters are `offset` (default `0`, minimum `0`), `limit` (default `50`, range
`1`–`200`), and optional `search`. Search trims surrounding whitespace and matches
`expression`, `reading`, `meaning`, and `usage_note` before count and pagination.

The global collection is grouped and deterministically ordered by:

1. outer-card `sort_order`, `created_at`, and `id`;
2. inner-card `sort_order`, `created_at`, and `id` within each parent.

Filtering, ordering, counting, and pagination are performed by the database. Outer cards
without inner cards do not create placeholder items, and each result continues to carry
its own `outer_card_id`. The existing parent-scoped endpoint remains the appropriate API
when only one outer card's usage content is needed.

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

## Basic outer-card review

Open <http://localhost:5173/review/outer>, or select **Start outer review** from the
card-management directory. When the ordered deck is available, the route redirects to
`/review/outer/{outerCardId}` so the current review card survives refresh, browser
history, direct navigation, and shared URLs.

The review interface provides:

- a directory containing the complete ordered outer-card deck;
- front/back flip mode using either the card or an explicit button;
- a simultaneous mode that displays the prompt and answer together;
- a manual control for showing or hiding the selected word's inner usage content;
- ordered Previous and Next controls that stop at the deck boundaries;
- progress based on the selected card's actual position, such as `3 / 25`;
- links back to card management and to the selected card's edit page.

The frontend follows the API's stable `sort_order`, `created_at`, and `id` order. It
fetches every API page needed to reach `total`, rather than treating the 200-card page
limit as the full deck. Changing cards resets flip mode to the front. Simultaneous mode
remains active while navigating, and returning to flip mode starts on the front.

Select **Show inner content** to lazy-load every inner card belonging to the current
outer card. The separate read-only usage panel preserves the backend's stable order and
shows each expression, meaning, and available reading, usage note, and notes. Closing
the panel hides the content; reopening it may reuse fresh TanStack Query cache data.

The **Automatically show inner content** switch is off by default. When enabled, it
immediately opens the current panel and every newly selected outer card begins expanded.
The choice survives a page reload in browser storage under:

```text
layerlex.outerReview.autoShowInnerContent.v1
```

Only the strings `true` and `false` are written. Missing, invalid, or inaccessible
storage safely defaults to off. The manual Show/Hide control remains available: hiding
one card does not disable automatic mode, and the next selected card still opens.
Manually expanding while automatic mode is off does not enable the preference. The
automatic switch is independent from Flip mode and Show both.

Loading and API errors stay inside the usage panel, so the outer card and its navigation
remain usable. The error state can retry only that outer card's inner content. An empty
panel links to `/cards/{outerCardId}` to add or manage inner cards; review mode itself
does not contain create, edit, or delete actions. Inner-card create, update, and delete
operations invalidate the affected parent’s aggregated review-content query, while
deleting an outer card removes only that parent’s review-content cache.

Shuffle, global keyboard shortcuts, ratings, spaced repetition, and review history are
not implemented yet.

Run the focused review tests with:

```bash
cd frontend
npm run test -- src/lib/outerReview.test.ts
npm run test -- src/pages/OuterReviewPage.test.tsx
```

## Independent inner-card review

Open <http://localhost:5173/review/inner>, or select **Start inner review** from card
management or **Inner review** from the outer-review directory. After the complete deck
loads, the route redirects to `/review/inner/{innerCardId}`. The selected inner card is
therefore restored by refresh, browser history, direct navigation, or a shared URL.

The inner-review interface provides:

- an ordered directory containing every inner card exactly once;
- front/back flip mode through the card or an explicit Show answer button;
- Show both mode, which remains active while moving between cards;
- ordered Previous and Next controls with no wrapping;
- progress based on the current card's position in the complete deck;
- the parent outer-card term and optional reading as secondary context; and
- local loading, retry, empty-deck, unknown-card, and missing-parent states.

The frontend loads `GET /api/v1/inner-cards` in pages of 200 until the reported `total`
is reached. It preserves the backend order without sorting again. An empty page before
`total` or a duplicate card ID fails clearly instead of silently truncating or repeating
the deck.

Parent context does not change inner-review order. The existing complete outer-review
deck query is loaded once and converted to an in-memory map keyed by outer-card ID, so
the interface never makes one parent request per inner card. Parent-context loading or
failure does not block the inner deck; an unavailable parent receives a safe fallback.

The ordered inner-review deck uses its own TanStack Query key, separate from management
and outer-review content. Inner-card create, update, and delete operations invalidate
this deck. Deleting an outer card removes it because database cascade deletion changes
the global inner-card collection. Existing parent-scoped outer-review invalidation
remains unchanged.

Changing cards resets flip mode to the front. Show both persists across card changes,
and returning to Flip mode starts on the front. These controls are independent of the
outer-review automatic-inner-content browser preference. Inner review remains read-only:
editing is available through the management link rather than inside the review card.

Shuffle, keyboard review shortcuts, ratings, spaced repetition, and review history are
explicitly outside Stage 7B.

Run the focused inner-review tests with:

```bash
cd frontend
npm run test -- src/lib/innerReview.test.ts
npm run test -- src/pages/InnerReviewPage.test.tsx
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
