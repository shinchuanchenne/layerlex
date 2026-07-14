from collections.abc import Generator
from typing import Any

from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlalchemy.engine.url import make_url
from sqlmodel import Session, create_engine

from app.core.config import get_settings


def create_database_engine(database_url: str) -> Engine:
    is_sqlite = make_url(database_url).get_backend_name() == "sqlite"
    connect_args = {"check_same_thread": False, "timeout": 5.0} if is_sqlite else {}
    database_engine = create_engine(
        database_url,
        connect_args=connect_args,
        pool_pre_ping=True,
    )

    if is_sqlite:
        event.listen(database_engine, "connect", _configure_sqlite_connection)

    return database_engine


def _configure_sqlite_connection(
    dbapi_connection: Any,
    _connection_record: Any,
) -> None:
    """Apply safety and contention settings to every SQLite connection.

    Foreign keys are disabled by default per SQLite connection. WAL allows readers to
    continue while the single application writer commits, and the busy timeout waits
    briefly for a lock instead of failing immediately.
    """

    cursor = dbapi_connection.cursor()
    try:
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=5000")
    finally:
        cursor.close()


engine = create_database_engine(get_settings().database_url)


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        try:
            yield session
        except Exception:
            session.rollback()
            raise
