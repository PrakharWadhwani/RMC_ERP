import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base, Session as SessionClass

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DB_DIR = os.path.join(BASE_DIR, "db_storage")
DB_FILE = os.path.join(DB_DIR, "rainbow_erp.db")

os.makedirs(DB_DIR, exist_ok=True)

SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_FILE}"

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(class_=SessionClass, autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        try:
            from db_sync import sync_db_to_csv
            sync_db_to_csv(db)
        except Exception as e:
            print(f"[SYNC ENGINE LOG] Post-route backup skipped: {e}")
        db.close()
