from collections.abc import Generator

from sqlalchemy.engine import Engine
from sqlmodel import Session, create_engine

from app.core.config import get_settings


def create_database_engine(database_url: str) -> Engine:
    connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}
    return create_engine(database_url, connect_args=connect_args, pool_pre_ping=True)


engine = create_database_engine(get_settings().database_url)


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
