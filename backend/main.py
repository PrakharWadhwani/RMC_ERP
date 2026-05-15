from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base, SessionLocal
from routers import inventory, sales, purchase, dashboard, stakeholders, finances
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
import auth
import models

# Create all tables at once
Base.metadata.create_all(bind=engine)

# --- Seed a default admin user so the system is usable on first launch ---
def seed_default_user():
    db = SessionLocal()
    try:
        # Check for 'leo' since that is the username you want to use
        existing = db.query(models.User).filter(models.User.username == "leo").first()
        if not existing:
            # 1. Put the password in quotes "leosphinx"
            # 2. Use the auth helper to hash it properly
            hashed = auth.get_password_hash("leosphinx") 
            
            admin = models.User(
                username="leo",
                email="23053143@kiit.ac.in",
                hashed_password=hashed, # Use the hashed variable here
                is_active=True,
                status="APPROVED"
            )
            db.add(admin)
            db.commit()
            print("✅ Default admin user 'leo' created successfully")
        else:
            print("✅ Admin user 'leo' already exists")
    except Exception as e:
        print(f"⚠️ Seed error: {e}")
        db.rollback()
    finally:
        db.close()

seed_default_user()

app = FastAPI(title="Rainbow ERP - Master")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, replace with your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all logic modules
app.include_router(inventory.router)
app.include_router(sales.router)
app.include_router(purchase.router)
app.include_router(dashboard.router)
app.include_router(stakeholders.router)
app.include_router(finances.router)
app.include_router(auth.router)

@app.get("/")
def check_health():
    return {"status": "Complete", "engine": "FastAPI", "database": "Postgres Connected"}