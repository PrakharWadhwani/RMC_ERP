import os
import shutil
import json
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List
import models, database, auth, schemas

# NOTICE: To easily display files in the frontend, remember to mount this local directory
# in your main app file (e.g. main.py) using the following line:
# app.mount("/static/bills", StaticFiles(directory="uploaded_bills"), name="bills")

router = APIRouter(prefix="/purchases", tags=["purchases"])

UPLOAD_DIR = "uploaded_bills"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

@router.post("/")
def make_bulk_purchase(
    vendor_id: int = Form(...),
    bill_no: str = Form(...),
    total_amount: float = Form(...),
    paid_amount: float = Form(...),
    payment_mode: str = Form(...),
    items_json: str = Form(...), # Sent as a JSON string from frontend
    file: UploadFile = File(None), # Optional digital copy
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # 1. Prevent duplicate Bill Numbers
    existing_bill = db.query(models.PurchaseBill).filter(models.PurchaseBill.bill_no == bill_no).first()
    if existing_bill:
        raise HTTPException(status_code=400, detail="This Bill Number is already recorded.")

    # 2. Handle File Upload
    saved_path = None
    if file:
        file_ext = file.filename.split(".")[-1]
        file_name = f"vendor_{vendor_id}_bill_{bill_no}.{file_ext}"
        saved_path = os.path.join(UPLOAD_DIR, file_name)
        with open(saved_path, "wb+") as buffer:
            shutil.copyfileobj(file.file, buffer)

    # 3. Create Master Transaction
    new_transaction = models.Transaction(
        stakeholder_id=vendor_id,
        type="PURCHASE",
        total_amount=total_amount,
        paid_amount=paid_amount,
        payment_mode=payment_mode,
        user_id=current_user.id
    )
    db.add(new_transaction)
    db.flush()

    # 4. Create the Physical Bill Record linked with Transaction
    new_bill = models.PurchaseBill(
        vendor_id=vendor_id,
        bill_no=bill_no,
        total_amount=total_amount,
        file_path=saved_path,
        transaction_id=new_transaction.id
    )
    db.add(new_bill)

    # 5. Process Stock Items
    items = json.loads(items_json)
    for item in items:
        product = db.query(models.Product).filter(models.Product.id == item['product_id']).first()
        if not product: continue

        product.current_stock += item['quantity']
        product.cost_price = item['unit_cost']

        db.add(models.TransactionItem(
            transaction_id=new_transaction.id,
            product_id=product.id,
            quantity=item['quantity'],
            unit_price=item['unit_cost']
        ))

        db.add(models.StockLog(
            product_id=product.id,
            change_amount=item['quantity'],
            reason=f"PURCHASE: Bill {bill_no}"
        ))

    # 6. Update Vendor Udhaar (Balance)
    debt = total_amount - paid_amount
    vendor = db.query(models.Stakeholder).filter(models.Stakeholder.id == vendor_id).first()
    if vendor:
        vendor.balance -= debt

    # 7. Update System Balances (Cash/Bank)
    balance = db.query(models.SystemBalance).first()
    if not balance:
        balance = models.SystemBalance(cash_balance=0.0, bank_balance=0.0)
        db.add(balance)
        
    if paid_amount > 0:
        if payment_mode.upper() == "CASH":
            balance.cash_balance -= paid_amount
        elif payment_mode.upper() == "ONLINE":
            balance.bank_balance -= paid_amount

    db.commit()
    return {"message": "Stock and Bill successfully recorded", "bill_id": new_bill.id}


@router.get("/", response_model=List[schemas.PurchaseBillResponse])
def get_all_purchase_bills(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Fetches all registered vendor purchase bills and packages them 
    with their vendor details and attached inventory list items.
    """
    bills = db.query(models.PurchaseBill).order_by(models.PurchaseBill.date.desc()).all()
    response_list = []

    for bill in bills:
        # Build list items array matching schemas.BillItemResponse
        item_details = []
        if bill.transaction and bill.transaction.items:
            for item in bill.transaction.items:
                prod = item.product
                item_details.append({
                    "product_id": item.product_id,
                    "brand": prod.brand if prod else None,
                    "model_name": prod.model_name if prod else "Unknown",
                    "model_no": prod.model_no if prod else "N/A",
                    "quantity": item.quantity,
                    "unit_price": item.unit_price,
                    "total_price": item.quantity * item.unit_price
                })

        # Remap system local path string to a readable web image URL structure
        web_file_path = None
        if bill.file_path:
            filename = os.path.basename(bill.file_path)
            web_file_path = f"/static/bills/{filename}"

        response_list.append({
            "id": bill.id,
            "vendor_id": bill.vendor_id,
            "vendor_name": bill.vendor.name if bill.vendor else "Unknown Vendor",
            "bill_no": bill.bill_no,
            "total_amount": bill.total_amount,
            "file_path": web_file_path,
            "date": bill.date,
            "items": item_details
        })

    return response_list


@router.get("/{bill_id}/download")
def download_purchase_bill(
    bill_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    bill = db.query(models.PurchaseBill).filter(models.PurchaseBill.id == bill_id).first()
    if not bill or not bill.file_path:
        raise HTTPException(status_code=404, detail="Bill file not found")

    path = os.path.normpath(bill.file_path)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Uploaded bill file is missing")

    return FileResponse(path, media_type="application/octet-stream", filename=os.path.basename(path))