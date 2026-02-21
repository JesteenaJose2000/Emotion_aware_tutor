from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# SQLite database path; for production use a persistent path or external DB
SQLALCHEMY_DATABASE_URL = "sqlite:///./app.db"

# check_same_thread is needed for SQLite when used with FastAPI's async context
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency that yields a DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create database tables if they don't exist."""
    from . import models  # noqa: F401 - ensure models are imported so metadata is populated

    Base.metadata.create_all(bind=engine)


