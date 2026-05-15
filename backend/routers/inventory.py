from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import models, database, schemas, auth
from typing import List

router = APIRouter(prefix="/inventory", tags=["inventory"])

# --- CATEGORY MANAGEMENT ---

def serialize_category(cat):
    return {
        "id": cat.id,
        "name": cat.name,
        "subcategories": [serialize_category(s) for s in cat.subcategories]
    }

@router.post("/categories/")
def create_category(
    name: str, 
    parent_id: int = None, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
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
def get_category_tree(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    roots = db.query(models.Category).filter(models.Category.parent_id == None).all()
    return [serialize_category(c) for c in roots]

# --- PRODUCT MANAGEMENT ---

@router.post("/products/")
def create_product(
    brand: str, 
    model_name: str, 
    model_no: str, 
    category_id: int, 
    cost_price: float, 
    initial_stock: int = 0,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    existing = db.query(models.Product).filter(models.Product.model_no == model_no).first()
    if existing:
        raise HTTPException(status_code=400, detail="Model number already exists")

    new_product = models.Product(
        brand=brand,
        model_name=model_name,
        model_no=model_no,
        category_id=category_id,
        current_stock=initial_stock,
        cost_price=cost_price
    )
    db.add(new_product)
    db.flush()

    log_entry = models.StockLog(
        product_id=new_product.id,
        change_amount=initial_stock,
        reason="INITIAL_STOCK"
    )
    db.add(log_entry)
    
    db.commit()
    db.refresh(new_product)
    return new_product

@router.get("/products/search/{model_no}")
def get_product_by_model(
    model_no: str, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    product = db.query(models.Product).filter(models.Product.model_no == model_no).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

# --- STOCK UTILITIES ---

@router.get("/low-stock")
def get_low_stock_alerts(
    threshold: int = 5, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    return db.query(models.Product).filter(models.Product.current_stock <= threshold).all()

@router.get("/stock-history/{product_id}")
def get_stock_history(
    product_id: int, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    return db.query(models.StockLog).filter(models.StockLog.product_id == product_id).all()

@router.get("/products/{product_id}/laser")
def get_product_laser_focus(
    product_id: int, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    logs = db.query(models.StockLog).filter(
        models.StockLog.product_id == product_id
    ).order_by(models.StockLog.timestamp.desc()).all()
    
    return {
        "details": product,
        "movement_history": logs
    }