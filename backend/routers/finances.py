from collections import defaultdict
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

import models, database, auth, schemas
from otp_service import consume_verification_session

router = APIRouter(prefix="/finances", tags=["finances"])


def _get_or_init_system_settings(db: Session):
    settings = db.query(models.SystemSettings).first()
    if not settings:
        settings = models.SystemSettings(low_stock_limit=5)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    if settings.low_stock_limit is None:
        settings.low_stock_limit = 5
        db.commit()
        db.refresh(settings)
    return settings


def _get_or_init_system_balance(db: Session):
    balance = db.query(models.SystemBalance).first()
    settings = _get_or_init_system_settings(db)
    if not balance:
        balance = models.SystemBalance(
            cash_balance=settings.initial_cash_balance,
            bank_balance=settings.initial_online_balance,
        )
        db.add(balance)
        db.commit()
        db.refresh(balance)
    return balance


def _cash_flow_direction_for_transaction(transaction: models.Transaction):
    if transaction.type == "SALE":
        return "INWARD"
    return "OUTWARD"


def _build_report_buckets(period: str):
    current = datetime.utcnow()
    buckets = []

    if period == "monthly":
        for offset in range(11, -1, -1):
            year = current.year
            month = current.month - offset
            while month <= 0:
                year -= 1
                month += 12
            buckets.append(f"{year}-{month:02d}")
    else:
        for offset in range(4, -1, -1):
            buckets.append(str(current.year - offset))

    return buckets


def _get_bucket_label(value: datetime, period: str):
    if period == "monthly":
        return value.strftime("%Y-%m")
    return value.strftime("%Y")


def _build_profit_report(period: str, db: Session):
    buckets = _build_report_buckets(period)
    sale_totals = defaultdict(lambda: {"revenue": 0.0, "gross_profit": 0.0})
    expense_totals = defaultdict(float)

    sale_items = (
        db.query(models.TransactionItem)
        .join(models.Transaction, models.TransactionItem.transaction_id == models.Transaction.id)
        .filter(models.Transaction.type == "SALE")
        .all()
    )

    for item in sale_items:
        if not item.transaction or not item.transaction.created_at:
            continue
        bucket = _get_bucket_label(item.transaction.created_at, period)
        if bucket not in buckets:
            continue
        sale_totals[bucket]["revenue"] += item.unit_price * item.quantity
        sale_totals[bucket]["gross_profit"] += (item.unit_price - item.cost_price_at_sale) * item.quantity

    expenses = db.query(models.Expense).all()
    for expense in expenses:
        if not expense.timestamp:
            continue
        bucket = _get_bucket_label(expense.timestamp, period)
        if bucket not in buckets:
            continue
        expense_totals[bucket] += expense.amount

    data = []
    for bucket in buckets:
        revenue = sale_totals[bucket]["revenue"]
        gross_profit = sale_totals[bucket]["gross_profit"]
        expenses_total = expense_totals[bucket]
        data.append(
            {
                "label": bucket,
                "revenue": round(revenue, 2),
                "gross_profit": round(gross_profit, 2),
                "expenses": round(expenses_total, 2),
                "net_profit": round(gross_profit - expenses_total, 2),
            }
        )

    return {
        "period": period,
        "data": data,
    }


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
    # Update System Balances (Cash/Bank)
    balance = _get_or_init_system_balance(db)

    if mode.upper() == "CASH":
        balance.cash_balance -= amount
    elif mode.upper() == "ONLINE":
        balance.bank_balance -= amount

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

# --- CASH & BANK BALANCES ---

@router.get("/balances", response_model=schemas.SystemBalanceResponse)
def get_system_balances(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    return _get_or_init_system_balance(db)

@router.put("/balances", response_model=schemas.SystemBalanceResponse)
def update_system_balances(
    update_data: schemas.SystemBalanceUpdate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.status != "APPROVED":
        raise HTTPException(status_code=403, detail="Not authorized to edit balances.")

    balance = _get_or_init_system_balance(db)

    if update_data.cash_balance is not None:
        balance.cash_balance = update_data.cash_balance
    if update_data.bank_balance is not None:
        balance.bank_balance = update_data.bank_balance

    db.commit()
    db.refresh(balance)
    return balance

@router.post("/initial-balance", response_model=schemas.SystemSettingsResponse)
def set_initial_balance(
    initial_data: schemas.SystemSettingsCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if not current_user.is_admin:
        raise HTTPException(
            status_code=403,
            detail="CRITICAL: Unauthorized. Only the Administrator can modify the starting ledger balances."
        )

    settings = _get_or_init_system_settings(db)
    settings.initial_cash_balance = initial_data.initial_cash_balance
    settings.initial_online_balance = initial_data.initial_online_balance

    balance = db.query(models.SystemBalance).first()
    if not balance:
        balance = models.SystemBalance(
            cash_balance=initial_data.initial_cash_balance,
            bank_balance=initial_data.initial_online_balance
        )
    else:
        balance.cash_balance = initial_data.initial_cash_balance
        balance.bank_balance = initial_data.initial_online_balance
    db.add(balance)

    db.commit()
    db.refresh(settings)
    return settings


@router.get("/system-settings", response_model=schemas.SystemSettingsResponse)
def get_system_settings(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required.")

    return _get_or_init_system_settings(db)


@router.put("/system-settings", response_model=schemas.SystemSettingsResponse)
def update_system_settings(
    payload: schemas.SystemSettingsUpdate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required.")

    if payload.low_stock_limit is None:
        return _get_or_init_system_settings(db)

    if payload.low_stock_limit < 0:
        raise HTTPException(status_code=400, detail="Low stock limit cannot be negative.")

    if payload.otp_session is None:
        raise HTTPException(status_code=400, detail="OTP verification is required to update the low stock threshold.")

    session = consume_verification_session(current_user.id, payload.otp_session)
    if not session:
        raise HTTPException(status_code=401, detail="OTP verification is invalid or has expired")

    settings = _get_or_init_system_settings(db)
    settings.low_stock_limit = payload.low_stock_limit
    db.commit()
    db.refresh(settings)
    return settings

# --- PROFIT REPORT ---

@router.get("/profit-report")
def get_profit_report(
    period: str = "monthly",
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    period = period.lower()
    if period not in {"monthly", "yearly"}:
        raise HTTPException(status_code=400, detail="period must be either 'monthly' or 'yearly'")

    return _build_profit_report(period, db)

# --- GLOBAL LEDGER ---

@router.get("/ledger")
def get_global_ledger(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    transactions = (
        db.query(models.Transaction)
        .options(joinedload(models.Transaction.items), joinedload(models.Transaction.stakeholder))
        .order_by(models.Transaction.created_at.desc())
        .limit(100)
        .all()
    )
    expenses = db.query(models.Expense).order_by(models.Expense.timestamp.desc()).limit(50).all()
    
    ledger_entries = []
    for t in transactions:
        direction = _cash_flow_direction_for_transaction(t)
        ledger_entries.append({
            "id": f"txn_{t.id}",
            "type": t.type,
            "amount": t.total_amount,
            "net_amount": t.total_amount if direction == "INWARD" else -t.total_amount,
            "direction": direction,
            "paid": t.paid_amount,
            "mode": t.payment_mode,
            "date": t.created_at,
            "description": f"{t.type} {'from' if direction == 'INWARD' else 'to'} {t.stakeholder.name if t.stakeholder else 'Unknown Stakeholder'}"
        })
    for e in expenses:
        ledger_entries.append({
            "id": f"exp_{e.id}",
            "type": "EXPENSE",
            "amount": e.amount,
            "net_amount": -e.amount,
            "direction": "OUTWARD",
            "paid": e.amount,
            "mode": e.payment_mode,
            "date": e.timestamp,
            "description": e.item
        })
        
    ledger_entries.sort(key=lambda x: x["date"], reverse=True)
    return ledger_entries