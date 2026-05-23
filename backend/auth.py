from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import text
from sqlalchemy.orm import Session

import models, database, schemas
from otp_service import consume_verification_session, create_otp_request, verify_otp_code

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


def ensure_user_phone_column():
    try:
        with database.engine.begin() as conn:
            columns = conn.execute(text("PRAGMA table_info(users)")).fetchall()
            if not any(row[1] == "phone_no" for row in columns):
                conn.execute(text("ALTER TABLE users ADD COLUMN phone_no VARCHAR"))
    except Exception as e:
        print(f"[AUTH] ensure_user_phone_column skipped: {e}")


def ensure_system_settings_columns():
    try:
        with database.engine.begin() as conn:
            columns = conn.execute(text("PRAGMA table_info(system_settings)")).fetchall()
            if not any(row[1] == "low_stock_limit" for row in columns):
                conn.execute(text("ALTER TABLE system_settings ADD COLUMN low_stock_limit INTEGER DEFAULT 5"))
            conn.execute(text("UPDATE system_settings SET low_stock_limit = 5 WHERE low_stock_limit IS NULL"))
    except Exception as e:
        print(f"[AUTH] ensure_system_settings_columns skipped: {e}")


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

@router.post("/register")
def register(user: schemas.UserRegister, db: Session = Depends(database.get_db)):
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")

    phone_user = db.query(models.User).filter(models.User.phone_no == user.phone_no).first()
    if phone_user:
        raise HTTPException(status_code=400, detail="Phone number already registered")

    # Robust first-admin logic:
    # If there are no APPROVED users yet, make this new user APPROVED and admin.
    approved_count = db.query(models.User).filter(models.User.status == "APPROVED").count()
    is_first_approved = approved_count == 0

    placeholder_email = f"{user.phone_no.replace(' ', '').replace('+', '')}@rainbow.local"

    new_user = models.User(
        username=user.username,
        email=placeholder_email,
        phone_no=user.phone_no,
        hashed_password=get_password_hash(user.password),
        status="APPROVED" if is_first_approved else "PENDING",
        is_admin=is_first_approved,
        base_salary=0.0
    )
    db.add(new_user)
    db.commit()

    # Debug info for troubleshooting persistent users
    print(f"[AUTH] register: total_users={db.query(models.User).count()}, approved_users={approved_count}, is_first_approved={is_first_approved}")

    if is_first_approved:
        return {"message": "First approved user registered and initialized as admin."}
    return {"message": "Registration request sent to admin."}

@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    credential = form_data.username.strip()
    user = db.query(models.User).filter(
        (models.User.phone_no == credential) | (models.User.username == credential)
    ).first()

    if not user or not pwd_context.verify(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if user.status != "APPROVED":
        raise HTTPException(
            status_code=403,
            detail="Access Denied: Pending owner approval."
        )

    access_token = create_access_token(data={"sub": user.username})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "username": user.username,
        "is_admin": user.is_admin,
    }


@router.get("/me", response_model=schemas.UserResponse)
def get_me(current_user: models.User = Depends(get_current_user)):
    return current_user


@router.post("/otp/request")
def request_otp(
    payload: schemas.OtpRequest,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user),
):
    target_phone = (payload.phone_no or current_user.phone_no or "").strip()
    if not target_phone:
        raise HTTPException(status_code=400, detail="Phone number is required to request a verification code")

    create_otp_request(current_user.id, target_phone)
    db.commit()
    return {"message": f"OTP sent to {target_phone}"}


@router.post("/otp/verify", response_model=schemas.OtpVerifyResponse)
def verify_otp(
    payload: schemas.OtpVerifyRequest,
    current_user: models.User = Depends(get_current_user),
):
    verification_token = verify_otp_code(current_user.id, payload.code)
    return {"verification_token": verification_token}


@router.put("/settings", response_model=schemas.UserResponse)
def update_settings(
    payload: schemas.UserSettingsUpdate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user),
):
    session = consume_verification_session(current_user.id, payload.otp_session)
    if not session:
        raise HTTPException(status_code=401, detail="OTP verification is invalid or has expired")

    if payload.phone_no is not None and session.get("target_phone") != payload.phone_no.strip():
        raise HTTPException(status_code=400, detail="OTP verification does not match the phone number being updated")

    has_email_change = payload.email is not None
    has_phone_change = payload.phone_no is not None
    has_password_change = payload.new_password is not None or payload.confirm_password is not None

    if not has_email_change and not has_phone_change and not has_password_change:
        raise HTTPException(status_code=400, detail="Provide at least one field to update")

    if payload.new_password is not None or payload.confirm_password is not None:
        if payload.new_password is None or payload.confirm_password is None:
            raise HTTPException(status_code=400, detail="Both password fields are required when changing the password")
        if payload.new_password != payload.confirm_password:
            raise HTTPException(status_code=400, detail="Passwords do not match")
        if payload.new_password == "":
            raise HTTPException(status_code=400, detail="Password cannot be empty")
        if len(payload.new_password) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters long")
        current_user.hashed_password = get_password_hash(payload.new_password)

    if has_email_change:
        existing_email = db.query(models.User).filter(
            models.User.email == payload.email,
            models.User.id != current_user.id,
        ).first()
        if existing_email:
            raise HTTPException(status_code=400, detail="Email already in use")
        current_user.email = payload.email

    if has_phone_change:
        normalized_phone = payload.phone_no.strip()
        if normalized_phone:
            existing_phone = db.query(models.User).filter(
                models.User.phone_no == normalized_phone,
                models.User.id != current_user.id,
            ).first()
            if existing_phone:
                raise HTTPException(status_code=400, detail="Phone number already in use")
            current_user.phone_no = normalized_phone
        else:
            current_user.phone_no = None

    db.commit()
    db.refresh(current_user)
    return current_user

# --- Admin Management Routes ---

@router.get("/pending-users")
def get_pending_users(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Unauthorized: Admin access required.")
        
    return db.query(models.User).filter(models.User.status == "PENDING").all()

@router.post("/manage-user/{user_id}")
def manage_user(
    user_id: int, 
    action: str, 
    salary: float = None, # Admin can set salary during approval
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required.")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if action == "approve":
        user.status = "APPROVED"
        if salary is not None:
            user.base_salary = salary
    elif action == "reject":
        user.status = "REJECTED"
    
    db.commit()
    return {"message": f"User {action}ed successfully"}