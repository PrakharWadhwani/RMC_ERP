from pydantic import BaseModel, EmailStr
from typing import List, Optional

# --- AUTH SCHEMAS ---

class UserRegister(BaseModel):
    username: str
    email: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    status: str

    class Config:
        from_attributes = True

# --- INVENTORY & SALES SCHEMAS ---
# (Keeping your existing Sale and Purchase schemas)
class SaleItemCreate(BaseModel):
    product_id: int
    quantity: int
    unit_price: float
    cost_price_at_sale: float = 0.0 

class SaleCreate(BaseModel):
    entity_id: int
    items: List[SaleItemCreate]
    total_amount: float
    paid_amount: float
    payment_mode: str 

class PurchaseItemCreate(BaseModel):
    product_id: int
    quantity: int
    unit_cost: float 

class PurchaseCreate(BaseModel):
    entity_id: int
    items: List[PurchaseItemCreate]
    total_amount: float
    paid_amount: float
    payment_mode: str