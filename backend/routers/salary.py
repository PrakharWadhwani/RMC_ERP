from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
import models, database, auth, schemas
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel

router = APIRouter(prefix="/salary", tags=["salary"])

class UserSalarySummary(BaseModel):
    user_id: int
    username: str
    base_salary: float
    total_advances: float
    net_payable: float

class AdminAdvanceResponse(BaseModel):
    id: int
    user_id: int
    username: str
    amount: float
    month: int
    year: int
    approved_by_admin: bool
    timestamp: datetime

    class Config:
        from_attributes = True

@router.get("/my-salary")
def get_my_salary(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Returns the current logged-in user's salary info and history of advances
    """
    advances = db.query(models.SalaryAdvance).filter(
        models.SalaryAdvance.user_id == current_user.id
    ).order_by(models.SalaryAdvance.timestamp.desc()).all()
    
    return {
        "base_salary": current_user.base_salary,
        "advances": [
            {
                "id": adv.id,
                "amount": adv.amount,
                "month": adv.month,
                "year": adv.year,
                "approved_by_admin": adv.approved_by_admin,
                "timestamp": adv.timestamp
            } for adv in advances
        ]
    }

@router.post("/advance", response_model=schemas.SalaryAdvanceResponse)
def request_advance(
    request_data: schemas.SalaryAdvanceCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Create a salary advance request for the current user
    """
    if current_user.status != "APPROVED":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is not approved yet. Cannot request advance."
        )

    # Check if request amount exceeds base salary
    if request_data.amount > current_user.base_salary:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Requested advance amount (₹{request_data.amount}) cannot exceed base salary (₹{current_user.base_salary})."
        )
    
    # Check if they already have a pending or approved advance for the same month and year
    existing = db.query(models.SalaryAdvance).filter(
        models.SalaryAdvance.user_id == current_user.id,
        models.SalaryAdvance.month == request_data.month,
        models.SalaryAdvance.year == request_data.year
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"You already have a salary advance entry for {request_data.month}/{request_data.year}."
        )
        
    new_advance = models.SalaryAdvance(
        user_id=current_user.id,
        amount=request_data.amount,
        month=request_data.month,
        year=request_data.year,
        approved_by_admin=False
    )
    db.add(new_advance)
    db.commit()
    db.refresh(new_advance)
    return new_advance

@router.get("/admin/summary", response_model=List[UserSalarySummary])
def get_admin_salary_summary(
    month: int = None,
    year: int = None,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Admin overview of all staff members, their base salaries, advances, and remaining pay
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Unauthorized: Admin access required.")
        
    now = datetime.now()
    sel_month = month or now.month
    sel_year = year or now.year
    
    users = db.query(models.User).filter(models.User.status == "APPROVED").all()
    summary = []
    
    for u in users:
        # Sum approved advances for this user in selected month/year
        total_advances = db.query(func.sum(models.SalaryAdvance.amount)).filter(
            models.SalaryAdvance.user_id == u.id,
            models.SalaryAdvance.month == sel_month,
            models.SalaryAdvance.year == sel_year,
            models.SalaryAdvance.approved_by_admin == True
        ).scalar() or 0.0
        
        summary.append(
            UserSalarySummary(
                user_id=u.id,
                username=u.username,
                base_salary=u.base_salary,
                total_advances=total_advances,
                net_payable=max(0.0, u.base_salary - total_advances)
            )
        )
        
    return summary

@router.get("/admin/requests", response_model=List[AdminAdvanceResponse])
def get_pending_advances(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    List all pending and approved advance requests for admin tracking
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Unauthorized: Admin access required.")
        
    advances = db.query(models.SalaryAdvance).join(models.User).order_by(
        models.SalaryAdvance.approved_by_admin.asc(),
        models.SalaryAdvance.timestamp.desc()
    ).all()
    
    return [
        AdminAdvanceResponse(
            id=adv.id,
            user_id=adv.user_id,
            username=adv.user.username,
            amount=adv.amount,
            month=adv.month,
            year=adv.year,
            approved_by_admin=adv.approved_by_admin,
            timestamp=adv.timestamp
        ) for adv in advances
    ]

@router.post("/admin/manage-advance/{advance_id}")
def manage_advance(
    advance_id: int,
    action: str, # "approve" or "reject"
    payment_mode: Optional[str] = "CASH", # "CASH" or "ONLINE"
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Admin approves or rejects a salary advance.
    If approved, it deducts from the cash or bank balance and creates an Expense record.
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Unauthorized: Admin access required.")
        
    advance = db.query(models.SalaryAdvance).filter(models.SalaryAdvance.id == advance_id).first()
    if not advance:
        raise HTTPException(status_code=404, detail="Advance request not found")
        
    if action == "approve":
        if advance.approved_by_admin:
            raise HTTPException(status_code=400, detail="Advance request is already approved.")
            
        advance.approved_by_admin = True
        
        # Deduct balance and add expense log
        balance = db.query(models.SystemBalance).first()
        if not balance:
            balance = models.SystemBalance(cash_balance=0.0, bank_balance=0.0)
            db.add(balance)
            
        mode = payment_mode.upper() if payment_mode else "CASH"
        if mode == "CASH":
            balance.cash_balance -= advance.amount
        elif mode == "ONLINE":
            balance.bank_balance -= advance.amount
            
        # Log as Expense to show up on unified ledger & finances dashboard
        new_expense = models.Expense(
            item=f"Salary Advance - {advance.user.username}",
            amount=advance.amount,
            payment_mode=mode,
            description=f"Approved salary advance for {advance.month}/{advance.year}"
        )
        db.add(new_expense)
        
    elif action == "reject":
        db.delete(advance)
        db.commit()
        return {"message": "Advance request rejected and deleted."}
        
    db.commit()
    return {"message": f"Advance request {action}d successfully."}
