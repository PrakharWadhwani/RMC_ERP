from sqlalchemy import Column, Integer, String, ForeignKey, Float, DateTime, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
import datetime

Base = declarative_base()

# 1. Recursive Categories
class Category(Base):
    __tablename__ = "categories"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    parent_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    
    # Relationship to allow sub-categories
    subcategories = relationship("Category", backref="parent", remote_side=[id])

# 2. Products
class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("categories.id"))
    brand = Column(String)
    model_name = Column(String)
    model_no = Column(String, unique=True, index=True)
    current_stock = Column(Integer, default=0)
    cost_price = Column(Float, default=0.0)

# 3. Entities (Parties & Customers)
class Entity(Base):
    __tablename__ = "entities"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    phone_no = Column(String, unique=True, index=True)
    entity_type = Column(String) # 'VENDOR' or 'CUSTOMER'
    balance = Column(Float, default=0.0) # (+) Customer owes us, (-) We owe Vendor

# 4. Transactions (The Ledger)
class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True, index=True)
    entity_id = Column(Integer, ForeignKey("entities.id"))
    type = Column(String) # 'PURCHASE', 'SALE', 'RETURN'
    total_amount = Column(Float)
    paid_amount = Column(Float)
    payment_mode = Column(String) # 'CASH', 'ONLINE'
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Logic for "Pay Later" is basically (total_amount - paid_amount)