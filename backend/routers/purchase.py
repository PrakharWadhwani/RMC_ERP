from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import models, database, schemas, auth # Added auth

router = APIRouter(prefix="/purchases", tags=["purchases"])

@router.post("/")
def make_bulk_purchase(
    purchase_data: schemas.PurchaseCreate, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user) # Logic: Only logged-in users can purchase
):
    # 1. Create the Master Transaction Record
    new_transaction = models.Transaction(
        entity_id=purchase_data.entity_id,
        type="PURCHASE",
        total_amount=purchase_data.total_amount,
        paid_amount=purchase_data.paid_amount,
        payment_mode=purchase_data.payment_mode,
        user_id=current_user.id # NEW: Track which user recorded this purchase
    )
    db.add(new_transaction)
    db.flush() #

    # 2. Process each item in the purchase
    for item in purchase_data.items:
        product = db.query(models.Product).filter(models.Product.id == item.product_id).first()
        if not product:
            continue # Or raise error

        # Update Stock & Cost Price (Blueprint Req: tracking last_cost_price)
        product.current_stock += item.quantity
        product.cost_price = item.unit_cost

        # Create Transaction Item entry
        bill_item = models.TransactionItem(
            transaction_id=new_transaction.id,
            product_id=item.product_id,
            quantity=item.quantity,
            unit_price=item.unit_cost
        )
        db.add(bill_item)

        # Create Stock Log (Audit Trail)
        log_entry = models.StockLog(
            product_id=item.product_id,
            change_amount=item.quantity, # Positive for Purchase
            reason=f"PURCHASE (Invoice #{new_transaction.id}) by {current_user.username}" # Updated reason
        )
        db.add(log_entry)

    # 3. Update Vendor Ledger (Pay Later logic)
    # Debt increases if we pay less than the total. 
    # Blueprint: Balance is (-) for what we owe.
    debt_to_vendor = purchase_data.total_amount - purchase_data.paid_amount
    vendor = db.query(models.Entity).filter(models.Entity.id == purchase_data.entity_id).first()
    if vendor:
        vendor.balance -= debt_to_vendor

    db.commit()
    return {
        "message": "Stock-In Complete", 
        "invoice_id": new_transaction.id, 
        "vendor_balance": vendor.balance if vendor else 0,
        "recorded_by": current_user.username
    }