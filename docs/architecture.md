# LayerLex foundation architecture

## System shape

LayerLex uses a deliberately simple local architecture:

```text
React/Vite browser app  ->  FastAPI JSON API  ->  SQLite file
     localhost:5173          localhost:8000       backend/data/layerlex.db
```

The frontend and backend are separately installable applications in one repository.
SQLite runs in the backend process and requires no database server or Docker service.
This is an intentional architecture decision for the single-user MVP, not a temporary
test substitute.

## Technical decisions

### API layout

Product endpoints will live under `/api/v1`. An unversioned `/health` endpoint is kept
for infrastructure checks, while `/api/v1/health` proves that versioned routing is
wired correctly. FastAPI's generated OpenAPI document is the source of truth for the
HTTP contract.

### Server and client state

TanStack Query will own data fetched from the API, including cache invalidation after
future mutations. Ephemeral interaction state such as whether a card is flipped stays
inside React components. User-only display preferences may use `localStorage` in the
MVP. No global state library is needed initially.

### Persistence

SQLModel provides typed persistence models and database access. Alembic owns every
schema transition; application startup will not create tables implicitly. SQLite keeps
the single-user MVP easy to run while retaining relational constraints, transactions,
indexes, and a conventional migration path.

The database URL remains environment-driven. Models and migrations should avoid
unnecessary SQLite-specific behavior so the application can later move to PostgreSQL on
Amazon RDS if its concurrency or availability requirements grow.

Every SQLite engine is created through `create_database_engine()` and configures each
connection with foreign-key enforcement, WAL journal mode, and a 5000 ms busy timeout.
Foreign-key enforcement makes database cascades active, WAL improves read/write
coexistence for the single application deployment, and the timeout handles short write
lock contention without immediately failing.

UUID identifiers use SQLAlchemy's portable `Uuid` representation. SQLite stores these
as 32-character values rather than a native UUID type. Application timestamps are
normalized to UTC; SQLite stores a timezone-free UTC value and the application restores
UTC timezone information when reading it.

### EC2 persistence boundary

The first AWS target is one backend process on one EC2 instance. Its SQLite file must
live on an EBS-backed directory outside the application release path, such as
`/var/lib/layerlex/layerlex.db`. The deployment must preserve that path across releases,
run safe SQLite online backups, and take scheduled EBS snapshots. If the backend is ever
containerized, `/app/data` must be persisted on that same EBS-backed filesystem instead
of remaining in the container writable layer.

The database must not be shared over EFS, NFS, or another network filesystem. The MVP
has no shared database filesystem and no second backend instance.

SQLite is no longer an appropriate deployment database once LayerLex needs multiple
backend instances, horizontal autoscaling, high availability, or meaningful concurrent
writes. That is the trigger to migrate to PostgreSQL on Amazon RDS.

### Testing boundaries

- Frontend component tests use Vitest, jsdom, and React Testing Library.
- Backend API tests use Pytest and FastAPI's test client.
- Database tests should use isolated temporary SQLite files for constraints, cascading
  behavior, ordering, and migrations.

## Reasonable MVP defaults

The source product notes leave a few details open. These defaults allow progress without
locking the product into unnecessary complexity:

- Use generated UUID identifiers for outer and inner cards once models are introduced.
- Preserve explicit integer sort positions for user-controlled ordering.
- Treat deleting an outer card as deleting its inner cards, but require UI confirmation.
- Search outer cards by their primary written form initially; broader search can follow.
- Store the automatic inner-content display switch and simultaneous-front/back switch
  in browser storage.
- Build shuffle as a complete array of card IDs created at round start. Outer and inner
  modes keep separate queues.
- Reset review progress when the underlying selected deck changes.

## Risks to resolve during domain design

- The exact vocabulary fields and which are required, especially for languages other
  than Japanese.
- Whether tags are free-form strings or normalized records.
- Whether inner-card ordering is global or only within each outer card (the default is
  within each outer card).
- Whether review state must survive browser restarts beyond UI preferences.
- Concurrent editing and horizontal scaling are explicitly outside the single-user
  SQLite deployment boundary.

These questions should be resolved while designing the first outer/inner card data
model, not by adding speculative foundation abstractions.
