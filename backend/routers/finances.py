from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Optional, List

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


# --- STOCK VALUATION & MOVEMENT REPORT ---

def _parse_period_bounds(period: str, period_key: str):
    if period == "day":
        try:
            start_dt = datetime.strptime(period_key, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format for day period. Expected YYYY-MM-DD.")
        end_dt = start_dt + timedelta(days=1)
    elif period == "month":
        try:
            parts = period_key.split("-")
            year, month = int(parts[0]), int(parts[1])
            start_dt = datetime(year, month, 1)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid date format for month period. Expected YYYY-MM.")
        if month == 12:
            end_dt = datetime(year + 1, 1, 1)
        else:
            end_dt = datetime(year, month + 1, 1)
    elif period == "year":
        try:
            year = int(period_key)
            start_dt = datetime(year, 1, 1)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid date format for year period. Expected YYYY.")
        end_dt = datetime(year + 1, 1, 1)
    else:
        raise HTTPException(status_code=400, detail="period must be one of: 'day', 'month', 'year'")
    return start_dt, end_dt


def _prune_stock_cache(db: Session):
    limits = {"day": 50, "month": 5, "year": 2}
    for p_type, max_limit in limits.items():
        rows = (
            db.query(models.StockValueCache)
            .filter(models.StockValueCache.period_type == p_type)
            .order_by(models.StockValueCache.period_key.desc())
            .all()
        )
        if len(rows) > max_limit:
            for old_row in rows[max_limit:]:
                db.delete(old_row)


def _compute_stock_metrics_for_period(period: str, period_key: str, db: Session):
    start_dt, end_dt = _parse_period_bounds(period, period_key)

    # Current stock live
    prod_stats = db.query(
        func.sum(models.Product.cost_price * models.Product.current_stock),
        func.sum(models.Product.current_stock)
    ).first()
    curr_val = round(float(prod_stats[0] or 0.0), 2)
    curr_units = int(prod_stats[1] or 0)

    # Sold in range
    sold_stats = (
        db.query(
            func.sum(models.TransactionItem.quantity * models.TransactionItem.unit_price),
            func.sum(models.TransactionItem.quantity)
        )
        .join(models.Transaction, models.TransactionItem.transaction_id == models.Transaction.id)
        .filter(
            models.Transaction.type == "SALE",
            models.Transaction.created_at >= start_dt,
            models.Transaction.created_at < end_dt
        )
        .first()
    )
    sold_val = round(float(sold_stats[0] or 0.0), 2)
    sold_units = int(sold_stats[1] or 0)

    # Bought in range
    bought_stats = (
        db.query(
            func.sum(models.TransactionItem.quantity * models.TransactionItem.unit_price),
            func.sum(models.TransactionItem.quantity)
        )
        .join(models.Transaction, models.TransactionItem.transaction_id == models.Transaction.id)
        .filter(
            models.Transaction.type == "PURCHASE",
            models.Transaction.created_at >= start_dt,
            models.Transaction.created_at < end_dt
        )
        .first()
    )
    bought_val = round(float(bought_stats[0] or 0.0), 2)
    bought_units = int(bought_stats[1] or 0)

    return {
        "current_stock_value": curr_val,
        "current_stock_units": curr_units,
        "stock_sold_value": sold_val,
        "units_sold": sold_units,
        "stock_bought_value": bought_val,
        "units_bought": bought_units,
    }


def refresh_stock_value_cache(db: Session):
    try:
        now = datetime.utcnow()
        today_key = now.strftime("%Y-%m-%d")
        month_key = now.strftime("%Y-%m")
        year_key = now.strftime("%Y")

        for p_type, p_key in [("day", today_key), ("month", month_key), ("year", year_key)]:
            data = _compute_stock_metrics_for_period(p_type, p_key, db)
            cache_entry = db.query(models.StockValueCache).filter(
                models.StockValueCache.period_key == p_key
            ).first()
            if not cache_entry:
                cache_entry = models.StockValueCache(
                    period_type=p_type,
                    period_key=p_key
                )
                db.add(cache_entry)

            cache_entry.total_value = data["current_stock_value"]
            cache_entry.total_units = data["current_stock_units"]
            cache_entry.stock_sold_value = data["stock_sold_value"]
            cache_entry.stock_bought_value = data["stock_bought_value"]
            cache_entry.units_sold = data["units_sold"]
            cache_entry.units_bought = data["units_bought"]
            cache_entry.recorded_at = now

        _prune_stock_cache(db)
        db.commit()
    except Exception as e:
        print(f"[STOCK_CACHE] Error refreshing cache: {e}")
        db.rollback()


@router.get("/stock-report")
def get_stock_report(
    period: str = "day",
    date: Optional[str] = None,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    period = period.lower()
    if period not in {"day", "month", "year"}:
        raise HTTPException(status_code=400, detail="Period must be 'day', 'month', or 'year'")

    now = datetime.utcnow()
    current_keys = {
        "day": now.strftime("%Y-%m-%d"),
        "month": now.strftime("%Y-%m"),
        "year": now.strftime("%Y"),
    }
    target_key = date or current_keys[period]
    is_current = (target_key == current_keys[period])

    if is_current:
        metrics = _compute_stock_metrics_for_period(period, target_key, db)
        cache_entry = db.query(models.StockValueCache).filter(
            models.StockValueCache.period_key == target_key
        ).first()
        if not cache_entry:
            cache_entry = models.StockValueCache(period_type=period, period_key=target_key)
            db.add(cache_entry)
        cache_entry.total_value = metrics["current_stock_value"]
        cache_entry.total_units = metrics["current_stock_units"]
        cache_entry.stock_sold_value = metrics["stock_sold_value"]
        cache_entry.stock_bought_value = metrics["stock_bought_value"]
        cache_entry.units_sold = metrics["units_sold"]
        cache_entry.units_bought = metrics["units_bought"]
        cache_entry.recorded_at = now
        try:
            _prune_stock_cache(db)
            db.commit()
        except Exception:
            db.rollback()

        return {
            "period": period,
            "date": target_key,
            "current_stock_value": metrics["current_stock_value"],
            "current_stock_units": metrics["current_stock_units"],
            "stock_sold_value": metrics["stock_sold_value"],
            "stock_bought_value": metrics["stock_bought_value"],
            "units_sold": metrics["units_sold"],
            "units_bought": metrics["units_bought"],
            "is_cached": True,
            "is_current": True,
            "historical_stock_available": True
        }

    # Historical lookup
    cache_entry = db.query(models.StockValueCache).filter(
        models.StockValueCache.period_key == target_key
    ).first()

    if cache_entry:
        return {
            "period": period,
            "date": target_key,
            "current_stock_value": cache_entry.total_value,
            "current_stock_units": cache_entry.total_units,
            "stock_sold_value": cache_entry.stock_sold_value,
            "stock_bought_value": cache_entry.stock_bought_value,
            "units_sold": cache_entry.units_sold,
            "units_bought": cache_entry.units_bought,
            "is_cached": True,
            "is_current": False,
            "historical_stock_available": True
        }

    # Past date not in cache: compute sold/bought movement on the fly
    movement = _compute_stock_metrics_for_period(period, target_key, db)
    return {
        "period": period,
        "date": target_key,
        "current_stock_value": None,
        "current_stock_units": None,
        "stock_sold_value": movement["stock_sold_value"],
        "stock_bought_value": movement["stock_bought_value"],
        "units_sold": movement["units_sold"],
        "units_bought": movement["units_bought"],
        "is_cached": False,
        "is_current": False,
        "historical_stock_available": False
    }


@router.get("/stock-report/calendar")
def get_stock_report_calendar(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    entries = db.query(models.StockValueCache.period_type, models.StockValueCache.period_key).all()
    result = {"day": [], "month": [], "year": []}
    for p_type, p_key in entries:
        if p_type in result:
            result[p_type].append(p_key)
    return result