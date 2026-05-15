from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import models, database, schemas, auth

router = APIRouter(prefix="/sales", tags=["sales"])

@router.post("/")
def make_bulk_sale(
    sale_data: schemas.SaleCreate, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # 1. Master Record with User ID
    new_transaction = models.Transaction(
        entity_id=sale_data.entity_id,
        type="SALE",
        total_amount=sale_data.total_amount,
        paid_amount=sale_data.paid_amount,
        payment_mode=sale_data.payment_mode,
        user_id=current_user.id 
    )
    db.add(new_transaction)
    db.flush()

    for item in sale_data.items:
        product = db.query(models.Product).filter(models.Product.id == item.product_id).first()
        
        # Stock Check logic preserved
        if not product or product.current_stock < item.quantity:
            db.rollback()
            raise HTTPException(status_code=400, detail=f"Insufficient stock for ID {item.product_id}")

        product.current_stock -= item.quantity

        # NEW: Snapshot cost_price at the moment of sale
        # Uses value from request if provided, otherwise pulls from product record
        cost_at_sale = item.cost_price_at_sale if item.cost_price_at_sale else product.cost_price

        bill_item = models.TransactionItem(
            transaction_id=new_transaction.id,
            product_id=item.product_id,
            quantity=item.quantity,
            unit_price=item.unit_price,
            cost_price_at_sale=cost_at_sale  # NEW: Locked in here
        )
        db.add(bill_item)

        # Audit Trail preserved
        log_entry = models.StockLog(
            product_id=item.product_id,
            change_amount=-item.quantity,
            reason=f"SALE (Bill #{new_transaction.id}) by {current_user.username}"
        )
        db.add(log_entry)

    # Debt Logic preserved
    balance_due = sale_data.total_amount - sale_data.paid_amount
    customer = db.query(models.Entity).filter(models.Entity.id == sale_data.entity_id).first()
    if customer:
        customer.balance += balance_due

    db.commit()
    return {"message": "Sale Authorized", "bill_id": new_transaction.id}