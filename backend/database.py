from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
import os
import time

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://admin:password123@db:5432/inventory_management")

# Retry logic: Wait for the database to be ready before creating the engine
def create_engine_with_retry(url, max_retries=10, delay=2):
    for attempt in range(max_retries):
        try:
            eng = create_engine(url)
            # Test the connection
            with eng.connect() as conn:
                conn.execute(text("SELECT 1"))
            print(f"✅ Database connected on attempt {attempt + 1}")
            return eng
        except Exception as e:
            if attempt < max_retries - 1:
                print(f"⏳ Database not ready (attempt {attempt + 1}/{max_retries}): {e}")
                time.sleep(delay)
            else:
                print(f"❌ Could not connect to database after {max_retries} attempts")
                raise

engine = create_engine_with_retry(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()