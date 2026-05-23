from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
import models, database, auth

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _get_or_create_settings(db: Session):
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


@router.get("/summary")
def get_dashboard_summary(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    total_receivable = db.query(func.sum(models.Stakeholder.balance)).filter(
        models.Stakeholder.type == 'CUSTOMER',
        models.Stakeholder.balance > 0
    ).scalar() or 0

    total_payable = db.query(func.sum(models.Stakeholder.balance)).filter(
        models.Stakeholder.type == 'VENDOR',
        models.Stakeholder.balance < 0
    ).scalar() or 0

    settings = _get_or_create_settings(db)
    low_stock_limit = settings.low_stock_limit or 5
    low_stock_items = db.query(models.Product).filter(models.Product.current_stock <= low_stock_limit).all()

    notification_items = []
    if total_receivable > 0:
        notification_items.append(f"Collect ₹{total_receivable:,.2f} from customers who still owe you.")
    if total_payable < 0:
        notification_items.append(f"Pay ₹{abs(total_payable):,.2f} to vendors to clear outstanding payables.")
    if low_stock_items:
        stock_names = ", ".join(
            f"{item.brand or 'Item'} {item.model_name} ({item.current_stock} left)"
            for item in low_stock_items[:5]
        )
        suffix = "" if len(low_stock_items) <= 5 else f" and {len(low_stock_items) - 5} more"
        notification_items.append(f"Low stock alert: {len(low_stock_items)} items are at or below {low_stock_limit} units{suffix}. {stock_names}")

    if not notification_items:
        notification_items.append("All systems are healthy. No urgent notifications right now.")

    return {
        "customers_owe_you": total_receivable,
        "you_owe_vendors": abs(total_payable),
        "low_stock_count": len(low_stock_items),
        "low_stock_limit": low_stock_limit,
        "reminders": " • ".join(notification_items),
        "notification_items": notification_items,
        "viewed_by": current_user.username
    }