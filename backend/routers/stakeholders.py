from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import models, database, auth # Added auth

router = APIRouter(prefix="/stakeholders", tags=["stakeholders"])

@router.post("/entities/")
def create_entity(
    name: str, 
    phone_no: str, 
    entity_type: str, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user) # Protected
):
    # Check if phone number already exists
    existing = db.query(models.Entity).filter(models.Entity.phone_no == phone_no).first()
    if existing:
        raise HTTPException(status_code=400, detail="Phone number already registered")
    
    new_entity = models.Entity(name=name, phone_no=phone_no, entity_type=entity_type.upper())
    db.add(new_entity)
    db.commit()
    db.refresh(new_entity)
    return new_entity

@router.get("/search/{phone_no}")
def search_by_phone(
    phone_no: str, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user) # Protected
):
    # Blueprint requirement: Auto-fill if old customer
    entity = db.query(models.Entity).filter(models.Entity.phone_no == phone_no).first()
    if not entity:
        raise HTTPException(status_code=404, detail="No record found")
    return entity

@router.get("/debtors/")
def get_pay_later_list(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user) # Protected
):
    # Blueprint requirement: Who needs to pay him
    return db.query(models.Entity).filter(models.Entity.balance > 0).all()

@router.get("/entities/{entity_id}/history")
def get_entity_laser_focus(
    entity_id: int, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    entity = db.query(models.Entity).filter(models.Entity.id == entity_id).first()
    # Pull all bills (Sales/Purchases) linked to this person
    transactions = db.query(models.Transaction).filter(
        models.Transaction.entity_id == entity_id
    ).order_by(models.Transaction.created_at.desc()).all()
    
    return {
        "profile": entity,
        "transaction_count": len(transactions),
        "history": transactions
    }