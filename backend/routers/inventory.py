import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.orm import Session
import models, database, schemas, auth
from typing import List, Optional

router = APIRouter(prefix="/inventory", tags=["inventory"])

# Define the local directory where images will be physically saved
IMAGE_UPLOAD_DIR = "uploaded_images"
if not os.path.exists(IMAGE_UPLOAD_DIR):
    os.makedirs(IMAGE_UPLOAD_DIR)


def _save_uploaded_image(file: UploadFile, model_no: str) -> str:
    file_ext = file.filename.split(".")[-1]
    safe_filename = f"prod_{model_no.replace(' ', '_').replace('/', '_').replace('\\', '_')}.{file_ext}"
    saved_image_path = os.path.join(IMAGE_UPLOAD_DIR, safe_filename)

    with open(saved_image_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return f"/{saved_image_path.replace('\\', '/')}"


# --- CATEGORY MANAGEMENT ---

def serialize_category(cat):
    return {
        "id": cat.id,
        "name": cat.name,
        "subcategories": [serialize_category(s) for s in cat.subcategories]
    }

@router.post("/categories/", response_model=schemas.CategoryResponse)
def create_category(
    category: schemas.CategoryCreate, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if category.parent_id:
        parent = db.query(models.Category).filter(models.Category.id == category.parent_id).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent category not found")
    
    new_category = models.Category(name=category.name, parent_id=category.parent_id)
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

@router.delete("/categories/{category_id}")
def delete_category(
    category_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    cat = db.query(models.Category).filter(models.Category.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    
    products = db.query(models.Product).filter(models.Product.category_id == category_id).first()
    if products:
        raise HTTPException(status_code=400, detail="Cannot delete category. Products exist inside it.")
        
    db.delete(cat)
    db.commit()
    return {"message": "Category deleted"}

# --- PRODUCT MANAGEMENT & DIRECT MOBILE IMAGE UPLOADS ---

@router.post("/products/", response_model=schemas.ProductResponse)
def create_product(
    brand: Optional[str] = Form(None),
    model_name: str = Form(...),
    model_no: str = Form(...),
    category_id: int = Form(...),
    current_stock: Optional[int] = Form(0),
    cost_price: Optional[float] = Form(0.0),
    min_selling_price: Optional[float] = Form(0.0),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    existing = db.query(models.Product).filter(models.Product.model_no == model_no).first()
    if existing:
        raise HTTPException(status_code=400, detail="Model number already exists in system")

    # Fallbacks for Form data parameters
    stock_val = current_stock if current_stock is not None else 0
    cost_val = cost_price if cost_price is not None else 0.0
    min_sell_val = min_selling_price if min_selling_price is not None else 0.0

    image_url = None
    if file and file.filename:
        image_url = _save_uploaded_image(file, model_no)

    new_product = models.Product(
        brand=brand,
        model_name=model_name,
        model_no=model_no,
        category_id=category_id,
        current_stock=stock_val,
        cost_price=cost_val,
        min_selling_price=min_sell_val,
        image_url=image_url
    )
    db.add(new_product)
    db.flush()

    log_entry = models.StockLog(
        product_id=new_product.id,
        change_amount=stock_val,
        reason="INITIAL_STOCK_ENTRY"
    )
    db.add(log_entry)
    
    db.commit()
    db.refresh(new_product)
    return new_product

@router.get("/laser-search", response_model=List[schemas.ProductResponse])
def laser_search(
    q: str = Query(...), 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    search_query = f"%{q}%"
    results = db.query(models.Product).filter(
        (models.Product.model_no.ilike(search_query)) |
        (models.Product.brand.ilike(search_query)) |
        (models.Product.model_name.ilike(search_query))
    ).all()
    return results

@router.put("/products/{product_id}", response_model=schemas.ProductResponse)
def update_product_stock_or_price(
    product_id: int,
    brand: Optional[str] = Form(None),
    model_name: Optional[str] = Form(None),
    model_no: Optional[str] = Form(None),
    category_id: Optional[int] = Form(None),
    current_stock: Optional[int] = Form(None),
    cost_price: Optional[float] = Form(None),
    min_selling_price: Optional[float] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    if brand is not None: product.brand = brand
    if model_name is not None: product.model_name = model_name
    if model_no is not None: product.model_no = model_no
    if category_id is not None: product.category_id = category_id
    if current_stock is not None: product.current_stock = current_stock
    if cost_price is not None: product.cost_price = cost_price
    if min_selling_price is not None: product.min_selling_price = min_selling_price
    
    if file and file.filename:
        product.image_url = _save_uploaded_image(file, product.model_no)
    
    log = models.StockLog(
        product_id=product.id,
        change_amount=0,
        reason=f"Manual Correction by {current_user.username}"
    )
    db.add(log)
    db.commit()
    db.refresh(product)
    return product

@router.get("/products/by-model/{model_no}", response_model=schemas.ProductResponse)
def get_product_by_model(
    model_no: str, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    product = db.query(models.Product).filter(models.Product.model_no == model_no).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@router.delete("/products/{product_id}")
def delete_product(
    product_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    db.delete(product)
    db.commit()
    return {"message": "Product deleted"}

# --- STOCK UTILITIES ---

@router.get("/low-stock", response_model=List[schemas.ProductResponse])
def get_low_stock_alerts(
    threshold: int = Query(5), 
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

@router.get("/products/{product_id}/details")
def get_detailed_product_view(
    product_id: int, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    logs = db.query(models.StockLog).filter(
        models.StockLog.product_id == product_id
    ).order_by(models.StockLog.timestamp.desc()).all()
    
    return {
        "details": product,
        "movement_history": logs
    }