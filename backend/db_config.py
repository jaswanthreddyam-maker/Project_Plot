import os
from sqlalchemy import create_engine, Column, String, DateTime
from sqlalchemy.orm import sessionmaker, declarative_base
from contextlib import contextmanager
from datetime import datetime

# SQLite WAL Configuration
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "db", "flow_state.db")
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

DATABASE_URL = f"sqlite:///{DB_PATH}"

# Configure SQLAlchemy Engine with WAL mode and strict timeouts
# WAL mode prevents "database is locked" errors under concurrent gevent worker reads/writes
engine = create_engine(
    DATABASE_URL,
    connect_args={
        "check_same_thread": False,
        "timeout": 15,
    },
    isolation_level="IMMEDIATE" 
)

# Apply WAL pragmas upon engine connection
from sqlalchemy import event

@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.execute("PRAGMA busy_timeout=30000") # 30 seconds
    cursor.execute("PRAGMA temp_store=MEMORY")
    cursor.execute("PRAGMA mmap_size=30000000000")
    cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@contextmanager
def get_db_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()

# For custom persistence adapters
def get_engine():
    return engine

# ── ORM Base & Models ────────────────────────────────────────
Base = declarative_base()

class LLMConnection(Base):
    __tablename__ = "llm_connections"

    id = Column(String, primary_key=True)
    provider = Column(String, nullable=False)
    alias = Column(String, nullable=True)
    api_key_encrypted = Column(String, nullable=False)  # base64 encoded
    created_at = Column(DateTime, default=datetime.utcnow)

class IntegrationToken(Base):
    __tablename__ = "integration_tokens"

    id = Column(String, primary_key=True)
    provider = Column(String, nullable=False, unique=True) # e.g., 'github', 'asana', 'enterprise-auth'
    token_encrypted = Column(String, nullable=False)  # base64 encoded
    created_at = Column(DateTime, default=datetime.utcnow)

class ScheduledFlow(Base):
    __tablename__ = "scheduled_flows"

    id = Column(String, primary_key=True)
    cron_expression = Column(String, nullable=False) # e.g. 'every_hour', 'daily_9am'
    payload_json = Column(String, nullable=False) # Store the arguments for PlotAutonomousFlow

# Auto-create all tables
Base.metadata.create_all(engine)
