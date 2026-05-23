from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import models, database, schemas, auth
from typing import List

router = APIRouter(prefix="/customers", tags=["customers"])


def _build_transaction_payload(transaction: models.Transaction, db: Session):
    item_rows = (
        db.query(models.TransactionItem, models.Product.model_name)
        .outerjoin(models.Product, models.Product.id == models.TransactionItem.product_id)
        .filter(models.TransactionItem.transaction_id == transaction.id)
        .all()
    )

    items = []
    for item, product_name in item_rows:
        items.append({
            "product_id": item.product_id,
            "product_name": product_name,
            "quantity": item.quantity,
            "unit_price": item.unit_price,
        })

    return {
        "id": transaction.id,
        "stakeholder_id": transaction.stakeholder_id,
        "user_id": transaction.user_id,
        "type": transaction.type,
        "total_amount": transaction.total_amount,
        "paid_amount": transaction.paid_amount,
        "payment_mode": transaction.payment_mode,
        "created_at": transaction.created_at,
        "items": items,
    }


@router.post("/", response_model=schemas.StakeholderResponse)
def create_customer(
    customer: schemas.StakeholderCreate, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Registers a new Customer. 
    Use this for Wholesale buyers or regulars you want to track.
    """
    # Force type to CUSTOMER regardless of what's sent in schema
    customer_data = customer.dict()
    customer_data["type"] = "CUSTOMER"

    # Prevent duplicate phone numbers for saved customers
    if customer.phone_no:
        existing = db.query(models.Stakeholder).filter(
            models.Stakeholder.phone_no == customer.phone_no
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Customer with this phone number already exists")
    
    new_customer = models.Stakeholder(**customer_data)
    db.add(new_customer)
    db.commit()
    db.refresh(new_customer)
    return new_customer

@router.get("/search", response_model=List[schemas.StakeholderResponse])
def search_customers(
    q: str = "",
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Returns customers matching a name fragment for quick cashier lookup."""
    if not q:
        return []
    return db.query(models.Stakeholder).filter(
        models.Stakeholder.type == "CUSTOMER",
        models.Stakeholder.name.ilike(f"%{q}%")
    ).all()


@router.get("/", response_model=List[schemas.StakeholderResponse])
def list_customers(
    wholesale_only: bool = False,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Lists all registered customers, with an optional wholesale filter."""
    query = db.query(models.Stakeholder).filter(models.Stakeholder.type == "CUSTOMER")
    if wholesale_only:
        query = query.filter(models.Stakeholder.is_wholesale == True)
    return query.all()

@router.get("/debtors", response_model=List[schemas.StakeholderResponse])
def get_debtors(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Laser Focus: Specifically shows customers who owe your father money (Balance > 0)."""
    return db.query(models.Stakeholder).filter(
        models.Stakeholder.type == "CUSTOMER",
        models.Stakeholder.balance > 0
    ).all()

@router.get("/{customer_id}/history")
def get_customer_history(
    customer_id: int, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Fetches every transaction associated with this specific customer."""
    customer = db.query(models.Stakeholder).filter(
        models.Stakeholder.id == customer_id,
        models.Stakeholder.type == "CUSTOMER"
    ).first()
    
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    transactions = db.query(models.Transaction).filter(
        models.Transaction.stakeholder_id == customer_id
    ).order_by(models.Transaction.created_at.desc()).all()

    return {
        "profile": customer,
        "history": [_build_transaction_payload(txn, db) for txn in transactions]
    }