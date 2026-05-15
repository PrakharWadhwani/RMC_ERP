from sqlalchemy import Column, Integer, String, ForeignKey, Float, DateTime, Boolean
from sqlalchemy.orm import relationship
from database import Base
import datetime

# --- 1. INVENTORY MODULE ---

class Category(Base):
    __tablename__ = "categories"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    parent_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    subcategories = relationship("Category", back_populates="parent", foreign_keys=[parent_id])
    parent = relationship("Category", back_populates="subcategories", remote_side=[id])

class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("categories.id"))
    brand = Column(String)
    model_name = Column(String)
    model_no = Column(String, unique=True, index=True)
    current_stock = Column(Integer, default=0)
    cost_price = Column(Float, default=0.0)

class StockLog(Base):
    __tablename__ = "stock_logs"
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"))
    change_amount = Column(Integer) # + for purchase/return, - for sale
    reason = Column(String) # e.g., "SALE #101", "INITIAL_STOCK"
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

# --- 2. STAKEHOLDERS MODULE ---

class Entity(Base):
    __tablename__ = "entities"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    phone_no = Column(String, unique=True, index=True)
    entity_type = Column(String) # 'CUSTOMER' or 'VENDOR'
    balance = Column(Float, default=0.0) # (+) Customer owes you, (-) You owe vendor

# --- 3. AUTHENTICATION MODULE ---

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    status = Column(String, default="PENDING") # PENDING, APPROVED, REJECTED
    is_active = Column(Boolean, default=True)

# --- 4. TRANSACTION & FINANCIAL MODULE ---

class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True, index=True)
    entity_id = Column(Integer, ForeignKey("entities.id"))
    user_id = Column(Integer, ForeignKey("users.id")) # Tracks which staff did this
    type = Column(String) # 'SALE', 'PURCHASE', 'RETURN'
    total_amount = Column(Float, nullable=False)
    paid_amount = Column(Float, default=0.0)
    payment_mode = Column(String) # 'CASH', 'ONLINE'
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class TransactionItem(Base):
    __tablename__ = "transaction_items"
    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(Integer, ForeignKey("transactions.id"))
    product_id = Column(Integer, ForeignKey("products.id"))
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Float, nullable=False)
    cost_price_at_sale = Column(Float, default=0.0)

class Expense(Base):
    __tablename__ = "expenses"
    id = Column(Integer, primary_key=True, index=True)
    item = Column(String, nullable=False)
    description = Column(String)
    amount = Column(Float, nullable=False)
    payment_mode = Column(String) # 'CASH', 'ONLINE'
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)