from sqlalchemy import Column, Integer, String, ForeignKey, Float, DateTime, Boolean
from sqlalchemy.orm import relationship, column_property
from sqlalchemy.sql import select
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
    # NEW: Safety feature to warn if selling too cheap
    min_selling_price = Column(Float, default=0.0)
    image_url = Column(String, nullable=True)

    stock_logs = relationship("StockLog", back_populates="product")

class StockLog(Base):
    __tablename__ = "stock_logs"
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"))
    change_amount = Column(Integer) # + for purchase/return, - for sale
    reason = Column(String) # e.g., "SALE #101", "INITIAL_STOCK", "VENDOR PURCHASE"
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    product = relationship("Product", back_populates="stock_logs")

# --- 2. STAKEHOLDERS MODULE (Split Logic) ---

class Stakeholder(Base):
    """
    Unified table for Vendors and Customers. 
    Divided by 'type' for cleaner frontend handling.
    """
    __tablename__ = "stakeholders"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    phone_no = Column(String, unique=True, index=True, nullable=True)
    type = Column(String) # 'CUSTOMER' or 'VENDOR'
    
    # Wholesale specific fields
    is_wholesale = Column(Boolean, default=False)
    balance = Column(Float, default=0.0) # (+) They owe you, (-) You owe vendor
    
    transactions = relationship("Transaction", back_populates="stakeholder")
    purchase_bills = relationship("PurchaseBill", back_populates="vendor")

# --- 3. AUTHENTICATION & STAFF MODULE ---

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    phone_no = Column(String, unique=True, index=True, nullable=True)
    hashed_password = Column(String)
    status = Column(String, default="PENDING") # PENDING, APPROVED, REJECTED
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    
    # NEW: Salary feature
    base_salary = Column(Float, default=0.0)
    
    transactions = relationship("Transaction", back_populates="staff")

# --- 4. PURCHASE BILLS (Vendor Invoice Storage) ---

class PurchaseBill(Base):
    __tablename__ = "purchase_bills"
    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, ForeignKey("stakeholders.id"))
    bill_no = Column(String, unique=True, index=True)
    total_amount = Column(Float)
    file_path = Column(String, nullable=True) # Digital copy path
    date = Column(DateTime, default=datetime.datetime.utcnow)
    transaction_id = Column(Integer, ForeignKey("transactions.id"), nullable=True)
    
    vendor = relationship("Stakeholder", back_populates="purchase_bills")
    transaction = relationship("Transaction")

# --- 5. TRANSACTION & FINANCIAL MODULE ---

class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True, index=True)
    stakeholder_id = Column(Integer, ForeignKey("stakeholders.id"))
    user_id = Column(Integer, ForeignKey("users.id")) # Staff who made the entry
    type = Column(String) # 'SALE', 'PURCHASE', 'RETURN'
    total_amount = Column(Float, nullable=False)
    paid_amount = Column(Float, default=0.0)
    payment_mode = Column(String) # 'CASH', 'ONLINE'
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    stakeholder = relationship("Stakeholder", back_populates="transactions")
    staff = relationship("User", back_populates="transactions")
    items = relationship("TransactionItem", back_populates="transaction")

    @property
    def cash_flow_direction(self):
        return "INWARD" if self.type == "SALE" else "OUTWARD"

class TransactionItem(Base):
    __tablename__ = "transaction_items"
    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(Integer, ForeignKey("transactions.id"))
    product_id = Column(Integer, ForeignKey("products.id"))
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Float, nullable=False)
    cost_price_at_sale = Column(Float, default=0.0)

    transaction = relationship("Transaction", back_populates="items")
    product = relationship("Product")

class Expense(Base):
    __tablename__ = "expenses"
    id = Column(Integer, primary_key=True, index=True)
    item = Column(String, nullable=False)
    description = Column(String)
    amount = Column(Float, nullable=False)
    payment_mode = Column(String, default="CASH")
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    @property
    def cash_flow_direction(self):
        return "OUTWARD"

# --- 6. CASH/BANK BALANCES & SYSTEM SETTINGS ---
class SystemBalance(Base):
    __tablename__ = "system_balances"
    id = Column(Integer, primary_key=True, index=True)
    cash_balance = Column(Float, default=0.0)
    bank_balance = Column(Float, default=0.0)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class SystemSettings(Base):
    __tablename__ = "system_settings"
    id = Column(Integer, primary_key=True, index=True)
    initial_cash_balance = Column(Float, default=0.0)
    initial_online_balance = Column(Float, default=0.0)
    low_stock_limit = Column(Integer, default=5)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

# --- 7. WORKER SALARY & ADVANCES ---
class SalaryAdvance(Base):
    __tablename__ = "salary_advances"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    amount = Column(Float, nullable=False)
    month = Column(Integer) # 1-12
    year = Column(Integer)
    approved_by_admin = Column(Boolean, default=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    @property
    def cash_flow_direction(self):
        return "OUTWARD"
    
    user = relationship("User")