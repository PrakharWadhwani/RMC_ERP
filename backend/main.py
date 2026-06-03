from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from database import engine, Base, SessionLocal
from db_sync import sync_csv_to_db
# Correct imports for your separated structure
from routers import inventory, sales, purchase, dashboard, customers, vendors, finances, salary, search
import auth

# Ensure tables exist (do NOT drop existing data in SQLite mode)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="RMC ERP - Master")

# Standard Global CORS configuration
origins = [
    "https://rmc-erp.vercel.app",  # Your production Vercel frontend
    "http://localhost:3000",       # Local development frontend if you use it
    "http://127.0.0.1:3000"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,          # FIXED: Swapped "*" for explicit trusted domains
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"], # Explicitly call out methods
    allow_headers=["Content-Type", "Authorization", "Accept", "Origin"], # Standard web headers
    expose_headers=["*"] 
)

@app.get("/")
def health_check():
    return {"status": "RMC ERP Backend is Running"}

# Serve uploaded product images
_IMAGES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploaded_images")
os.makedirs(_IMAGES_DIR, exist_ok=True)
app.mount("/uploaded_images", StaticFiles(directory=_IMAGES_DIR), name="uploaded_images")

# Serve uploaded purchase bills
_BILLS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploaded_bills")
os.makedirs(_BILLS_DIR, exist_ok=True)
app.mount("/uploaded_bills", StaticFiles(directory=_BILLS_DIR), name="uploaded_bills")

# Register all logic modules
app.include_router(inventory.router)
app.include_router(sales.router)
app.include_router(sales.transactions_router)
app.include_router(purchase.router)
app.include_router(dashboard.router)
app.include_router(customers.router)
app.include_router(vendors.router)
app.include_router(finances.router)
app.include_router(search.router)
app.include_router(auth.router)
app.include_router(salary.router)


@app.on_event("startup")
def startup_restore_from_csv():
    auth.ensure_user_phone_column()
    auth.ensure_system_settings_columns()

    # Ensure salary_advances has the employee_id column (migration for existing DBs)
    try:
        from sqlalchemy import text
        with engine.begin() as conn:
            columns = conn.execute(text("PRAGMA table_info(salary_advances)")).fetchall()
            if not any(row[1] == "employee_id" for row in columns):
                conn.execute(text("ALTER TABLE salary_advances ADD COLUMN employee_id INTEGER"))
                print("[STARTUP] Added employee_id column to salary_advances table")
    except Exception as e:
        print(f"[STARTUP] salary_advances migration skipped: {e}")

    db = SessionLocal()
    try:
        sync_csv_to_db(db)
    except Exception as e:
        print(f"[SYNC ENGINE LOG] Startup restore skipped: {e}")
    finally:
        db.close()