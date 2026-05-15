from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from typing import List

import models, database, schemas

# Configuration (Ensure these match your main config)
SECRET_KEY = "rainbow_erp_2930"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

router = APIRouter(prefix="/auth", tags=["auth"])

# --- Helper Functions ---

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(database.get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(models.User).filter(models.User.username == username).first()
    if user is None:
        raise credentials_exception
    return user

# --- Auth Routes ---

@router.post("/register", status_code=201)
def register(user_data: schemas.UserRegister, db: Session = Depends(database.get_db)):
    user_exists = db.query(models.User).filter(models.User.username == user_data.username).first()
    if user_exists:
        raise HTTPException(status_code=400, detail="Username already taken")
    
    new_user = models.User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=get_password_hash(user_data.password),
        status="PENDING"
    )
    db.add(new_user)
    db.commit()
    return {"message": "Registration submitted. Wait for admin approval."}

@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    
    if not user or not pwd_context.verify(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if user.status != "APPROVED":
        raise HTTPException(
            status_code=403, 
            detail="Access Denied: Pending owner approval."
        )
    
    access_token = create_access_token(data={"sub": user.username})
    # Updated response to include username for frontend UI logic
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "username": user.username 
    }

# --- Admin Management Routes ---

@router.get("/pending-users")
def get_pending_users(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Security: Hardcoded check for your admin username
    if current_user.username != "leo":
        raise HTTPException(status_code=403, detail="Unauthorized: Admin access required.")
        
    return db.query(models.User).filter(models.User.status == "PENDING").all()

@router.post("/manage-user/{user_id}")
def manage_user(
    user_id: int, 
    action: str, # Expecting 'approve' or 'reject'
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.username != "leo":
        raise HTTPException(status_code=403, detail="Unauthorized: Admin access required.")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if action == "approve":
        user.status = "APPROVED"
    elif action == "reject":
        user.status = "REJECTED"
    else:
        raise HTTPException(status_code=400, detail="Invalid action")

    db.commit()
    return {"message": f"User {user.username} has been {user.status}"}