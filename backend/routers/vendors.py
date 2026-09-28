from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import models, database, schemas, auth
from typing import List

router = APIRouter(prefix="/vendors", tags=["vendors"])


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
def create_vendor(
    vendor: schemas.StakeholderCreate, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Registers a new Vendor/Supplier."""
    vendor_data = vendor.dict()
    vendor_data["type"] = "VENDOR"
    vendor_data["is_wholesale"] = False # Vendors aren't wholesale customers

    new_vendor = models.Stakeholder(**vendor_data)
    db.add(new_vendor)
    db.commit()
    db.refresh(new_vendor)
    return new_vendor

@router.get("/search", response_model=List[schemas.StakeholderResponse])
def search_vendors(
    q: str = "",
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Returns vendors matching a name fragment for quick cashier lookup."""
    if not q:
        return []
    return db.query(models.Stakeholder).filter(
        models.Stakeholder.type == "VENDOR",
        models.Stakeholder.name.ilike(f"%{q}%")
    ).all()


@router.get("/", response_model=List[schemas.StakeholderResponse])
def list_vendors(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Lists all suppliers your father buys from."""
    return db.query(models.Stakeholder).filter(models.Stakeholder.type == "VENDOR").all()

@router.get("/creditors", response_model=List[schemas.StakeholderResponse])
def list_creditors(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Lists all vendors that the business currently owes money to (negative balance)."""
    return db.query(models.Stakeholder).filter(
        models.Stakeholder.type == "VENDOR",
        models.Stakeholder.balance < 0
    ).all()

@router.get("/{vendor_id}/full-profile")
def get_vendor_profile(
    vendor_id: int, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Shows vendor details, all purchase transactions, 
    and the separate digital bills (PDFs/Images) your father stores.
    """
    vendor = db.query(models.Stakeholder).filter(
        models.Stakeholder.id == vendor_id,
        models.Stakeholder.type == "VENDOR"
    ).first()
    
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    # Get digital bill uploads
    bills = db.query(models.PurchaseBill).filter(
        models.PurchaseBill.vendor_id == vendor_id
    ).all()

    def serialize_bill(bill: models.PurchaseBill):
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
            item_rows = (
                db.query(models.TransactionItem, models.Product.brand, models.Product.model_name, models.Product.model_no)
                .join(models.Product, models.TransactionItem.product_id == models.Product.id)
                .filter(models.TransactionItem.transaction_id == transaction.id)
                .all()
            )
            for item, brand, model_name, model_no in item_rows:
                items.append({
                    "product_id": item.product_id,
                    "product_name": f"{brand} {model_name} {model_no}",
                    "quantity": item.quantity,
                    "unit_price": item.unit_price,
                })

        return {
            "id": bill.id,
            "vendor_id": bill.vendor_id,
            "bill_no": bill.bill_no,
            "total_amount": bill.total_amount,
            "file_path": bill.file_path,
            "date": bill.date.isoformat() if bill.date else None,
            "items": items,
        }

    # Get transaction history
    transactions = db.query(models.Transaction).filter(
        models.Transaction.stakeholder_id == vendor_id
    ).order_by(models.Transaction.created_at.desc()).all()

    return {
        "profile": vendor,
        "digital_bills": [serialize_bill(b) for b in bills],
        "transaction_history": [_build_transaction_payload(txn, db) for txn in transactions]
    }