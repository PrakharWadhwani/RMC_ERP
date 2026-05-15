from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
import models, database, auth # Added auth

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@router.get("/summary")
def get_dashboard_summary(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user) # Protected: Only logged-in users see the dashboard
):
    # 1. Total Money Customers Owe Us (Receivables)
    total_receivable = db.query(func.sum(models.Entity.balance)).filter(
        models.Entity.entity_type == 'CUSTOMER', 
        models.Entity.balance > 0
    ).scalar() or 0
    
    # 2. Total Money We Owe Vendors (Payables)
    total_payable = db.query(func.sum(models.Entity.balance)).filter(
        models.Entity.entity_type == 'VENDOR', 
        models.Entity.balance < 0
    ).scalar() or 0
    
    # 3. Low Stock Alert
    low_stock_items = db.query(models.Product).filter(models.Product.current_stock < 5).all()

    return {
        "customers_owe_you": total_receivable,
        "you_owe_vendors": abs(total_payable),
        "low_stock_count": len(low_stock_items),
        "reminders": "You have debt to collect!" if total_receivable > 0 else "All clear",
        "viewed_by": current_user.username # Added for tracking
    }