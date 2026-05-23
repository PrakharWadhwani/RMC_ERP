from fastapi import FastAPI
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

# Global CORS to allow local & external origins (Handles PUT/DELETE Preflights seamlessly)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allows both localhost:3000 and production links
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"], # Explicitly names standard methods
    allow_headers=["*"], # Allows headers like Authorization, Content-Type, etc.
)

# Create the folder locally if it doesn't exist yet so mounting doesn't throw errors
IMAGE_UPLOAD_DIR = "uploaded_images"
if not os.path.exists(IMAGE_UPLOAD_DIR):
    os.makedirs(IMAGE_UPLOAD_DIR)

# Mount local image folder to serve static image files to your frontend table/view components
app.mount("/uploaded_images", StaticFiles(directory=IMAGE_UPLOAD_DIR), name="uploaded_images")

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
    db = SessionLocal()
    try:
        sync_csv_to_db(db)
    except Exception as e:
        print(f"[SYNC ENGINE LOG] Startup restore skipped: {e}")
    finally:
        db.close()