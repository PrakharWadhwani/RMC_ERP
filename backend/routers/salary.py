from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
import models, database, auth, schemas
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel

router = APIRouter(prefix="/salary", tags=["salary"])

# ============================================================================
# Local response models (kept here to avoid circular imports)
# ============================================================================

class UserSalarySummary(BaseModel):
    employee_id: int
    employee_name: str
    role: str
    base_salary: float
    total_advances: float
    net_payable: float

class AdminAdvanceResponse(BaseModel):
    id: int
    employee_id: Optional[int] = None
    employee_name: str
    amount: float
    month: int
    year: int
    approved_by_admin: bool
    timestamp: datetime

    class Config:
        from_attributes = True


# ============================================================================
# EMPLOYEE CRUD — Admin-controlled
# ============================================================================

@router.post("/admin/employees", response_model=schemas.EmployeeResponse)
def create_employee(
    data: schemas.EmployeeCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Admin creates a new employee."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Unauthorized: Admin access required.")

    employee = models.Employee(
        name=data.name,
        phone_no=data.phone_no,
        role=data.role,
        base_salary=data.base_salary,
        user_id=data.user_id,
    )
    db.add(employee)
    db.commit()
    db.refresh(employee)

    # Build response with optional linked username
    linked_username = None
    if employee.user_id:
        linked_user = db.query(models.User).filter(models.User.id == employee.user_id).first()
        if linked_user:
            linked_username = linked_user.username

    return schemas.EmployeeResponse(
        id=employee.id,
        name=employee.name,
        phone_no=employee.phone_no,
        role=employee.role,
        base_salary=employee.base_salary,
        is_active=employee.is_active,
        user_id=employee.user_id,
        created_at=employee.created_at,
        linked_username=linked_username,
    )


@router.get("/admin/employees", response_model=List[schemas.EmployeeResponse])
def list_employees(
    include_inactive: bool = False,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """List all employees. Active only by default."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Unauthorized: Admin access required.")

    query = db.query(models.Employee)
    if not include_inactive:
        query = query.filter(models.Employee.is_active == True)
    
    employees = query.order_by(models.Employee.name).all()
    result = []
    for emp in employees:
        linked_username = None
        if emp.user_id:
            linked_user = db.query(models.User).filter(models.User.id == emp.user_id).first()
            if linked_user:
                linked_username = linked_user.username
        result.append(schemas.EmployeeResponse(
            id=emp.id,
            name=emp.name,
            phone_no=emp.phone_no,
            role=emp.role,
            base_salary=emp.base_salary,
            is_active=emp.is_active,
            user_id=emp.user_id,
            created_at=emp.created_at,
            linked_username=linked_username,
        ))
    return result


@router.put("/admin/employees/{employee_id}", response_model=schemas.EmployeeResponse)
def update_employee(
    employee_id: int,
    data: schemas.EmployeeUpdate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Update employee details. If base_salary changes, a SalaryLog is created."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Unauthorized: Admin access required.")

    employee = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found.")

    # Track salary change for audit log
    if data.base_salary is not None and data.base_salary != employee.base_salary:
        salary_log = models.SalaryLog(
            employee_id=employee.id,
            old_salary=employee.base_salary,
            new_salary=data.base_salary,
            changed_by=current_user.username,
        )
        db.add(salary_log)
        employee.base_salary = data.base_salary

    if data.name is not None:
        employee.name = data.name
    if data.phone_no is not None:
        employee.phone_no = data.phone_no
    if data.role is not None:
        employee.role = data.role
    if data.is_active is not None:
        employee.is_active = data.is_active
    if data.user_id is not None:
        employee.user_id = data.user_id

    db.commit()
    db.refresh(employee)

    linked_username = None
    if employee.user_id:
        linked_user = db.query(models.User).filter(models.User.id == employee.user_id).first()
        if linked_user:
            linked_username = linked_user.username

    return schemas.EmployeeResponse(
        id=employee.id,
        name=employee.name,
        phone_no=employee.phone_no,
        role=employee.role,
        base_salary=employee.base_salary,
        is_active=employee.is_active,
        user_id=employee.user_id,
        created_at=employee.created_at,
        linked_username=linked_username,
    )


@router.put("/admin/update-salary/{employee_id}")
def update_salary(
    employee_id: int,
    data: schemas.SalaryUpdateRequest,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Dedicated salary update endpoint with full audit trail."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Unauthorized: Admin access required.")

    employee = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found.")

    if data.new_salary < 0:
        raise HTTPException(status_code=400, detail="Salary cannot be negative.")

    old_salary = employee.base_salary

    # Create audit log
    salary_log = models.SalaryLog(
        employee_id=employee.id,
        old_salary=old_salary,
        new_salary=data.new_salary,
        changed_by=current_user.username,
    )
    db.add(salary_log)

    employee.base_salary = data.new_salary
    db.commit()

    return {
        "message": f"Salary updated from ₹{old_salary} to ₹{data.new_salary}",
        "employee_id": employee.id,
        "old_salary": old_salary,
        "new_salary": data.new_salary,
    }


@router.get("/admin/salary-history/{employee_id}", response_model=List[schemas.SalaryLogResponse])
def get_salary_history(
    employee_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Get salary change history for a specific employee."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Unauthorized: Admin access required.")

    employee = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found.")

    logs = db.query(models.SalaryLog).filter(
        models.SalaryLog.employee_id == employee_id
    ).order_by(models.SalaryLog.timestamp.desc()).all()

    return logs


@router.delete("/admin/employees/{employee_id}")
def deactivate_employee(
    employee_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Soft-deactivate an employee (does not delete data)."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Unauthorized: Admin access required.")

    employee = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found.")

    employee.is_active = False
    db.commit()
    return {"message": f"Employee '{employee.name}' has been deactivated."}


# ============================================================================
# SALARY OVERVIEW — Monthly Summary (from Employee table)
# ============================================================================

@router.get("/admin/summary", response_model=List[UserSalarySummary])
def get_admin_salary_summary(
    month: int = None,
    year: int = None,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Admin overview: all active employees, their base salaries, advances, and remaining pay."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Unauthorized: Admin access required.")
        
    now = datetime.now()
    sel_month = month or now.month
    sel_year = year or now.year
    
    employees = db.query(models.Employee).filter(models.Employee.is_active == True).all()
    summary = []
    
    for emp in employees:
        # Sum approved advances for this employee in selected month/year
        total_advances = db.query(func.sum(models.SalaryAdvance.amount)).filter(
            models.SalaryAdvance.employee_id == emp.id,
            models.SalaryAdvance.month == sel_month,
            models.SalaryAdvance.year == sel_year,
            models.SalaryAdvance.approved_by_admin == True
        ).scalar() or 0.0
        
        summary.append(
            UserSalarySummary(
                employee_id=emp.id,
                employee_name=emp.name,
                role=emp.role,
                base_salary=emp.base_salary,
                total_advances=total_advances,
                net_payable=max(0.0, emp.base_salary - total_advances)
            )
        )
        
    return summary


# ============================================================================
# ADVANCE MANAGEMENT — Admin creates and manages advances for employees
# ============================================================================

@router.post("/admin/advance", response_model=schemas.SalaryAdvanceResponse)
def create_advance_for_employee(
    data: schemas.SalaryAdvanceCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Admin creates a salary advance entry for an employee."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Unauthorized: Admin access required.")

    employee = db.query(models.Employee).filter(models.Employee.id == data.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found.")

    if data.amount > employee.base_salary:
        raise HTTPException(
            status_code=400,
            detail=f"Advance amount (₹{data.amount}) cannot exceed base salary (₹{employee.base_salary})."
        )

    # Check duplicate for same month/year
    existing = db.query(models.SalaryAdvance).filter(
        models.SalaryAdvance.employee_id == data.employee_id,
        models.SalaryAdvance.month == data.month,
        models.SalaryAdvance.year == data.year,
    ).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"An advance entry already exists for {data.month}/{data.year}."
        )

    new_advance = models.SalaryAdvance(
        employee_id=data.employee_id,
        amount=data.amount,
        month=data.month,
        year=data.year,
        approved_by_admin=False,
    )
    db.add(new_advance)
    db.commit()
    db.refresh(new_advance)
    return new_advance


@router.get("/admin/requests", response_model=List[AdminAdvanceResponse])
def get_advance_requests(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """List all advance requests (pending + approved) across all employees."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Unauthorized: Admin access required.")
        
    advances = db.query(models.SalaryAdvance).order_by(
        models.SalaryAdvance.approved_by_admin.asc(),
        models.SalaryAdvance.timestamp.desc()
    ).all()
    
    result = []
    for adv in advances:
        # Get employee name (prefer employee, fallback to user)
        emp_name = "Unknown"
        if adv.employee_id:
            emp = db.query(models.Employee).filter(models.Employee.id == adv.employee_id).first()
            if emp:
                emp_name = emp.name
        elif adv.user_id:
            user = db.query(models.User).filter(models.User.id == adv.user_id).first()
            if user:
                emp_name = user.username

        result.append(AdminAdvanceResponse(
            id=adv.id,
            employee_id=adv.employee_id,
            employee_name=emp_name,
            amount=adv.amount,
            month=adv.month,
            year=adv.year,
            approved_by_admin=adv.approved_by_admin,
            timestamp=adv.timestamp,
        ))

    return result


@router.post("/admin/manage-advance/{advance_id}")
def manage_advance(
    advance_id: int,
    action: str,  # "approve" or "reject"
    payment_mode: Optional[str] = "CASH",
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

        # Determine employee name for the expense log
        emp_name = "Unknown"
        if advance.employee_id:
            emp = db.query(models.Employee).filter(models.Employee.id == advance.employee_id).first()
            if emp:
                emp_name = emp.name
        elif advance.user_id:
            user = db.query(models.User).filter(models.User.id == advance.user_id).first()
            if user:
                emp_name = user.username

        # Log as Expense to show up on unified ledger & finances dashboard
        new_expense = models.Expense(
            item=f"Salary Advance - {emp_name}",
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


# ============================================================================
# EMPLOYEE SELF-SERVICE — Read-only salary view for linked users
# ============================================================================

@router.get("/my-salary")
def get_my_salary(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Returns the current logged-in user's salary info (read-only).
    Looks up the Employee record linked to this user.
    Falls back to User.base_salary for backward compatibility.
    """
    # Try to find an employee record linked to this user
    employee = db.query(models.Employee).filter(
        models.Employee.user_id == current_user.id
    ).first()

    if employee:
        advances = db.query(models.SalaryAdvance).filter(
            models.SalaryAdvance.employee_id == employee.id
        ).order_by(models.SalaryAdvance.timestamp.desc()).all()

        return {
            "employee_name": employee.name,
            "role": employee.role,
            "base_salary": employee.base_salary,
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

    # Backward compatibility: fall back to User.base_salary
    advances = db.query(models.SalaryAdvance).filter(
        models.SalaryAdvance.user_id == current_user.id
    ).order_by(models.SalaryAdvance.timestamp.desc()).all()
    
    return {
        "employee_name": current_user.username,
        "role": "Staff",
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
