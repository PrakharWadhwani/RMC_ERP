from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import models, database, schemas, auth
from typing import List

sales_router = APIRouter(prefix="/sales", tags=["sales"])
transactions_router = APIRouter(prefix="/transactions", tags=["transactions"])
router = sales_router


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


@sales_router.post("/")
def create_sale(
    sale_data: schemas.TransactionCreate, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Handles sales. If stakeholder_id is missing, it defaults to 'Retail' (ID 1).
    """
    
    # 1. DEFAULT LOGIC: Use ID 1 if no customer is selected (Retail Sale)
    customer_id = sale_data.stakeholder_id if sale_data.stakeholder_id else 1
    
    customer = db.query(models.Stakeholder).filter(
        models.Stakeholder.id == customer_id
    ).first()
    
    if not customer:
        raise HTTPException(
            status_code=404, 
            detail="The Retail Customer record (ID 1) is missing from the database."
        )

    # 2. Create the Master Transaction Record
    new_transaction = models.Transaction(
        stakeholder_id=customer_id,
        user_id=current_user.id,
        type="SALE",
        total_amount=sale_data.total_amount,
        paid_amount=sale_data.paid_amount,
        payment_mode=sale_data.payment_mode,
    )
    db.add(new_transaction)
    db.flush() # Secure the ID before moving to items

    # 3. Process Items
    for item in sale_data.items:
        product = db.query(models.Product).filter(models.Product.id == item.product_id).first()
        
        if not product:
            db.rollback()
            raise HTTPException(status_code=404, detail=f"Product ID {item.product_id} not found")

        # A. Stock Check
        if product.current_stock < item.quantity:
            db.rollback()
            raise HTTPException(status_code=400, detail=f"Insufficient stock for {product.model_name}")

        # B. Loss Prevention Warning (Console only, doesn't stop the sale)
        if item.unit_price < product.min_selling_price:
            print(f"⚠️ LOSS WARNING: {product.model_name} sold below min price by {current_user.username}")

        # C. Update Stock Level
        product.current_stock -= item.quantity

        # D. Record Sale Item with cost snapshot for true profit calculation
        db.add(models.TransactionItem(
            transaction_id=new_transaction.id,
            product_id=item.product_id,
            quantity=item.quantity,
            unit_price=item.unit_price,
            cost_price_at_sale=product.cost_price 
        ))

        # E. Audit Trail (Stock Log)
        db.add(models.StockLog(
            product_id=item.product_id,
            change_amount=-item.quantity,
            reason=f"SALE: Bill #{new_transaction.id} to {customer.name}"
        ))

    # 4. Update Balance (Debt/Udhaar Logic)
    # Retail customers usually pay full, but if they don't, it tracks against ID 1
    balance_due = sale_data.total_amount - sale_data.paid_amount
    if balance_due > 0:
        customer.balance += balance_due

    # 5. Update System Balances (Cash/Bank)
    balance = db.query(models.SystemBalance).first()
    if not balance:
        balance = models.SystemBalance(cash_balance=0.0, bank_balance=0.0)
        db.add(balance)
        
    if sale_data.paid_amount > 0:
        if sale_data.payment_mode.upper() == "CASH":
            balance.cash_balance += sale_data.paid_amount
        elif sale_data.payment_mode.upper() == "ONLINE":
            balance.bank_balance += sale_data.paid_amount

    db.commit()
    return {"message": "Sale completed successfully", "invoice_id": new_transaction.id}


@sales_router.get("/history", response_model=List[schemas.TransactionHistoryResponse])
def get_sale_history(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Returns all sales recorded in the system."""
    transactions = db.query(models.Transaction).filter(models.Transaction.type == "SALE").order_by(models.Transaction.created_at.desc()).all()
    return [_build_transaction_payload(txn, db) for txn in transactions]


@transactions_router.post("/")
def create_transaction(
    sale_data: schemas.TransactionCreate, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    return create_sale(sale_data, db, current_user)


@transactions_router.get("/history", response_model=List[schemas.TransactionHistoryResponse])
def get_transaction_history(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    return get_sale_history(db, current_user)
