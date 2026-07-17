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
inner-card management UI. Stage 6A contains basic ordered outer-card review, Stage 6B
adds read-only inner content, and Stage 6C adds the persistent automatic-display
preference. Stage 7A adds the global ordered inner-card collection API, and Stage 7B
adds independent ordered inner-card review. Stage 8A adds seeded, URL-restorable outer
review shuffle, and Stage 8B applies the same complete-round model to inner review.
Stage 9 adds guarded ArrowLeft, ArrowRight, and Space shortcuts to both review pages.
Stage 11A adds persistent decks, assigns every outer card to exactly one deck, and keeps
deck frontend management and deck-scoped review outside that backend-only iteration.
Keep future changes narrowly aligned with the requested iteration.

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
- Outer review lives at `/review/outer` and `/review/outer/{outerCardId}`. React Router
  owns the selected card, TanStack Query owns the complete ordered deck, and component
  state owns presentation state such as flip side and display mode.
- Build the ordered outer-review source deck by fetching all outer-card list pages
  through the reported `total`; never silently treat one API page as the complete deck.
  Preserve the backend order as the ordered mode and only derive shuffled queues through
  the Stage 8A deterministic utility.
- Outer shuffled rounds use `?mode=shuffle&seed={seed}`. The URL owns mode and seed;
  TanStack Query continues to own only the complete backend-ordered deck. Derive one
  complete deterministic Fisher–Yates permutation from that deck and seed without
  mutating the source or caching the derived queue as server data.
- Directory links, Previous, and Next must preserve the active outer shuffled round.
  Selecting Shuffle while already shuffled keeps the current seed. A new shuffled round
  generates a different seed and starts at its first card. Switching to Ordered keeps
  the current card while removing shuffle parameters. Invalid parameters fall back to
  Ordered.
- Outer-card create, update, and delete mutations must invalidate
  `outerReviewKeys.orderedDeck()`. An active shuffled queue is always re-derived from the
  latest complete source deck and current seed, so deleted cards cannot survive in a
  standalone permutation.
- Changing the selected outer review card must reset flip mode to the front.
  Simultaneous display mode may persist across card navigation, but changing back to
  flip mode starts on the front.
- Review inner content uses a separate `outer-review` query key scoped by outer-card ID
  and fetches all inner-card pages through the reported `total`. It is lazy-loaded only
  after manual expansion and remains separate from the outer card's front/back fields.
- Expanded/collapsed inner-content state is local UI state keyed by outer-card ID.
  A newly selected card initializes from the automatic-display preference; with the
  preference off it begins collapsed. Changing display mode for the same card must not
  close the panel. Inner loading and errors remain local to the panel and must not
  replace the outer review interface.
- Store the automatic inner-content preference under the versioned browser key
  `layerlex.outerReview.autoShowInnerContent.v1`. Missing, invalid, or inaccessible
  storage defaults off. Manual Show/Hide is a per-card override and must not change the
  saved automatic preference; a newly selected card initializes from that preference.
- Inner-card create, update, and delete mutations must invalidate the affected
  `outerReviewKeys.innerContent(outerCardId)` query without invalidating unrelated
  parents. Deleting an outer card must remove its corresponding review-content query.
- Independent inner review lives at `/review/inner` and
  `/review/inner/{innerCardId}`. React Router owns the selected inner card, TanStack
  Query owns the complete ordered deck, and component state owns flip side and display
  mode.
- Build the independent inner-review deck from every page of the global
  `GET /api/v1/inner-cards` collection through its reported `total`. Preserve backend
  order, reject duplicate IDs, and fail if pagination returns an empty page before the
  total is reached. Do not sort the deck again in the browser.
- Resolve inner-review parent context by reusing the complete outer-review deck and an
  in-memory outer-card ID map. Never request one outer card per inner card. Missing or
  failed parent context must not block the inner deck and must use a safe fallback.
- Keep the ordered inner-review deck under a dedicated `inner-review` query key.
  Inner-card create, update, and delete mutations invalidate it; deleting an outer card
  removes it because cascade deletion changes the global collection. Preserve existing
  parent-scoped outer-review cache behavior.
- Inner shuffled rounds use `?mode=shuffle&seed={seed}` and the shared Stage 8A
  deterministic Fisher–Yates utility. React Router owns mode and seed, while TanStack
  Query owns only the complete backend-ordered inner source deck. Never duplicate the
  PRNG, mutate the source deck, or cache the derived permutation as server data.
- Inner-review directory links, Previous, and Next must preserve the active seed and
  use the same derived queue as progress. Selecting Shuffle during a shuffled round
  keeps it; New shuffled round generates a different seed and begins at position one;
  switching to Ordered keeps the current card and removes the query parameters.
- Parent context remains an independent complete outer-deck query and ID map in both
  inner order modes. Source-deck invalidation must re-derive the active queue from the
  latest inner cards so deleted cards cannot survive and new cards can join the round.
  Invalid round parameters canonically fall back to Ordered, including for an empty
  source deck.
- Changing the selected inner review card resets flip mode to the front. Simultaneous
  display may persist across navigation, but switching back to flip mode starts on the
  front. Inner-review display state is independent of the outer-review automatic-inner
  preference.
- Both review card components use the shared `useReviewKeyboardShortcuts` hook.
  ArrowLeft and ArrowRight call page-owned active-queue navigation without wrapping;
  Space toggles the card component's existing flip state only in Flip mode. Keyboard,
  card click, and explicit Show answer/Show front controls must share that one state.
- Review shortcuts are mounted only while a valid current review card is rendered.
  Ignore modified or already-prevented events and every shortcut from editable targets.
  Also ignore Space from buttons, links, switches, and other interactive controls so
  native activation cannot double-toggle. Prevent default only when an available review
  action runs. Ordered and shuffled URLs, seeds, inner-content behavior, and parent
  context remain page-owned and unchanged by the hook.
- Keep visible, boundary-aware keyboard help on both review pages. Shortcuts supplement
  the existing buttons and must never be the only way to perform an action. Do not add
  review shortcuts to management or other application pages.
- Local frontend development uses the Vite `/api` proxy to port 8000. Use
  `VITE_API_BASE_URL` only when an explicit API origin is required; Vite reads the
  repository-root `.env` through `envDir`.
- Expose backend application routes under `/api/v1`. Keep `/health` unversioned for
  infrastructure liveness checks.
- Deck CRUD routes live at `/api/v1/decks`. A deck contains zero or more outer cards;
  every outer card belongs to exactly one deck, while inner cards inherit that
  membership and must not receive a separate `deck_id`.
- Deck lists use stable ordering by `sort_order`, `created_at`, then `id`. Deck names are
  required after trimming, blank optional descriptions become `null`, and non-empty
  decks return HTTP 409 on deletion. Never cascade deck deletion to outer cards.
- Outer-card CRUD routes live at `/api/v1/outer-cards`. Keep API request/response schemas
  separate from SQLModel table models, and never include inner-card content in the
  outer-card list or retrieve responses unless a later contract explicitly requests it.
- Outer-card creation requires a valid `deck_id`, read responses include it, and PATCH
  may move an outer card between decks without changing any inner-card parent IDs.
  `GET /api/v1/outer-cards` accepts an optional `deck_id` filter; omitting it preserves
  the global collection and its existing order.
- Create and list inner cards at
  `/api/v1/outer-cards/{outer_card_id}/inner-cards`. Retrieve, update, and delete a
  known inner card at `/api/v1/inner-cards/{inner_card_id}`. The parent relationship is
  chosen at creation and must not be mutable through the inner-card update contract.
- Normalize API strings at the schema boundary: trim all strings, reject blank required
  values, and convert blank optional strings to `null`.
- Outer-card lists use stable ordering by `sort_order`, `created_at`, then `id`.
- Keep both the global outer-card `sort_order` index and the non-unique
  `(deck_id, sort_order)` index used by deck-scoped lists. Do not make `sort_order`
  unique.
- Parent-scoped inner-card lists use stable ordering by inner-card `sort_order`,
  `created_at`, then `id`.
- The global `GET /api/v1/inner-cards` collection groups and orders by outer-card
  `sort_order`, `created_at`, and `id`, then inner-card `sort_order`, `created_at`, and
  `id`. Apply search before count, and apply this complete order in SQL before
  pagination; do not sort a paginated result in Python.
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
- `OuterCard.deck_id` requires database `ON DELETE RESTRICT`. The Stage 11A migration
  must preserve existing outer and inner cards by assigning them to the
  `Uncategorized` deck before making `deck_id` non-nullable.
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
