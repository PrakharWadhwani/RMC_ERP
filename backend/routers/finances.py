from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
import models, database, auth
from datetime import date

router = APIRouter(prefix="/finances", tags=["finances"])

@router.post("/expenses/")
def add_expense(
    item: str, 
    amount: float, 
    mode: str, 
    description: str = None, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user) # Protected
):
    # Track payment_mode (CASH/ONLINE)
    new_expense = models.Expense(
        item=item, 
        amount=amount, 
        payment_mode=mode.upper(), 
        description=description
    )
    db.add(new_expense)
    db.commit()
    return new_expense

@router.get("/daily-summary")
def get_daily_profit(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user) # Protected
):
    today = date.today()

    # Pull all SALE TransactionItems for today via a join
    sale_items_today = (
        db.query(models.TransactionItem)
        .join(models.Transaction, models.TransactionItem.transaction_id == models.Transaction.id)
        .filter(
            models.Transaction.type == "SALE",
            func.date(models.Transaction.created_at) == today
        )
        .all()
    )

    # Gross Profit: sum of (unit_price - cost_price_at_sale) * quantity per line item
    gross_profit = sum(
        (item.unit_price - item.cost_price_at_sale) * item.quantity
        for item in sale_items_today
    )

    # Total Revenue: sum of unit_price * quantity (what customer paid per item)
    total_revenue = sum(
        item.unit_price * item.quantity
        for item in sale_items_today
    )

    # Total Expenses today
    total_expenses = db.query(func.sum(models.Expense.amount)).filter(
        func.date(models.Expense.timestamp) == today
    ).scalar() or 0

    net_profit = gross_profit - total_expenses

    return {
        "date": today,
        "revenue": round(total_revenue, 2),
        "gross_profit": round(gross_profit, 2),
        "expenses": round(total_expenses, 2),
        "net_profit": round(net_profit, 2),
        "checked_by": current_user.username
    }