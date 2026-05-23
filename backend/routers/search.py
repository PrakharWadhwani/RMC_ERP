from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import or_, String, cast
import models, database, auth

router = APIRouter(prefix="/search", tags=["search"])


def _stakeholder_payload(stakeholder: models.Stakeholder):
    return {
        "id": stakeholder.id,
        "name": stakeholder.name,
        "phone_no": stakeholder.phone_no,
        "type": stakeholder.type,
        "is_wholesale": stakeholder.is_wholesale,
        "balance": stakeholder.balance,
    }


def _transaction_payload(transaction: models.Transaction):
    return {
        "id": transaction.id,
        "stakeholder_id": transaction.stakeholder_id,
        "stakeholder_name": transaction.stakeholder.name if transaction.stakeholder else None,
        "user_id": transaction.user_id,
        "type": transaction.type,
        "total_amount": transaction.total_amount,
        "paid_amount": transaction.paid_amount,
        "payment_mode": transaction.payment_mode,
        "cash_flow_direction": transaction.cash_flow_direction,
        "created_at": transaction.created_at.isoformat() if transaction.created_at else None,
    }


def _serialize_bill_items(transaction_id: int, db: Session):
    rows = (
        db.query(models.TransactionItem, models.Product.brand, models.Product.model_name, models.Product.model_no)
        .join(models.Product, models.TransactionItem.product_id == models.Product.id)
        .filter(models.TransactionItem.transaction_id == transaction_id)
        .all()
    )

    items = []
    for item, brand, model_name, model_no in rows:
        items.append({
            "product_id": item.product_id,
            "product_name": f"{brand} {model_name} {model_no}",
            "quantity": item.quantity,
            "unit_price": item.unit_price,
        })
    return items


def _purchase_bill_payload(bill: models.PurchaseBill, db: Session):
    transaction = (
        db.query(models.Transaction)
        .filter(
            models.Transaction.stakeholder_id == bill.vendor_id,
            models.Transaction.type == "PURCHASE",
            models.Transaction.total_amount == bill.total_amount
        )
        .order_by(models.Transaction.created_at.desc())
        .first()
    )

    items = []
    if transaction:
        items = _serialize_bill_items(transaction.id, db)

    return {
        "id": bill.id,
        "vendor_id": bill.vendor_id,
        "vendor_name": bill.vendor.name if bill.vendor else None,
        "bill_no": bill.bill_no,
        "total_amount": bill.total_amount,
        "file_path": bill.file_path,
        "date": bill.date.isoformat() if bill.date else None,
        "items": items,
    }


@router.get("/global")
def global_search(
    query: str = "",
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if not query:
        return {"stakeholders": [], "transactions": [], "purchase_bills": []}

    search_term = f"%{query}%"

    stakeholders = db.query(models.Stakeholder).filter(
        models.Stakeholder.name.ilike(search_term)
    ).all()

    transactions = (
        db.query(models.Transaction)
        .join(models.Stakeholder, models.Transaction.stakeholder)
        .filter(
            or_(
                models.Transaction.type.ilike(search_term),
                models.Transaction.payment_mode.ilike(search_term),
                cast(models.Transaction.total_amount, String).ilike(search_term),
                cast(models.Transaction.paid_amount, String).ilike(search_term),
                models.Stakeholder.name.ilike(search_term),
            )
        )
        .all()
    )

    purchase_bills = (
        db.query(models.PurchaseBill)
        .join(models.Stakeholder, models.PurchaseBill.vendor)
        .filter(
            or_(
                models.PurchaseBill.bill_no.ilike(search_term),
                models.Stakeholder.name.ilike(search_term),
            )
        )
        .all()
    )

    return {
        "stakeholders": [_stakeholder_payload(item) for item in stakeholders],
        "transactions": [_transaction_payload(txn) for txn in transactions],
        "purchase_bills": [_purchase_bill_payload(pb, db) for pb in purchase_bills],
    }
