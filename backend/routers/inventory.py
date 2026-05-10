from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas, database

router = APIRouter(prefix="/inventory", tags=["inventory"])

@router.post("/categories/")
def create_category(name: str, parent_id: int = None, db: Session = Depends(database.get_db)):
    # Check if parent exists if parent_id is provided
    if parent_id:
        parent = db.query(models.Category).filter(models.Category.id == parent_id).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent category not found")
    
    new_category = models.Category(name=name, parent_id=parent_id)
    db.add(new_category)
    db.commit()
    db.refresh(new_category)
    return new_category

@router.get("/categories/tree")
def get_category_tree(db: Session = Depends(database.get_db)):
    # This fetches top-level categories; SQLAlchemy 'subcategories' 
    # relationship will handle the rest of the nesting.
    return db.query(models.Category).filter(models.Category.parent_id == None).all()