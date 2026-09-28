from pydantic import BaseModel, EmailStr, validator
from typing import List, Optional
from datetime import datetime

# --- BASE CONFIG ---
class ORMBase(BaseModel):
    class Config:
        from_attributes = True

# --- 1. CATEGORY & PRODUCT SCHEMAS ---

class CategoryBase(BaseModel):
    name: str
    parent_id: Optional[int] = None

class CategoryCreate(CategoryBase):
    pass

class CategoryResponse(CategoryBase, ORMBase):
    id: int

class ProductBase(BaseModel):
    brand: Optional[str] = None
    model_name: str
    model_no: str
    category_id: int
    current_stock: int = 0
    cost_price: float = 0.0
    min_selling_price: float = 0.0 # Safety feature
    image_url: Optional[str] = None

    @validator("image_url", pre=True, always=True)
    def normalize_image_url(cls, value):
        if value is None:
            return value
        return str(value).replace("\\", "/")

class ProductCreate(ProductBase):
    pass

class ProductUpdate(BaseModel):
    # All fields optional for partial updates (editing stock/prices)
    brand: Optional[str] = None
    model_name: Optional[str] = None
    model_no: Optional[str] = None
    category_id: Optional[int] = None
    current_stock: Optional[int] = None
    cost_price: Optional[float] = None
    min_selling_price: Optional[float] = None
    image_url: Optional[str] = None

class ProductResponse(ProductBase, ORMBase):
    id: int

# --- 2. STAKEHOLDER SCHEMAS (VENDORS & CUSTOMERS) ---

class StakeholderBase(BaseModel):
    name: str
    phone_no: Optional[str] = None
    type: str # 'CUSTOMER' or 'VENDOR'
    is_wholesale: bool = False
    balance: float = 0.0

class StakeholderCreate(StakeholderBase):
    pass

class StakeholderResponse(StakeholderBase, ORMBase):
    id: int

# --- 3. PURCHASE BILLS (VENDOR INVOICE STORAGE) ---

class BillItemResponse(BaseModel):
    product_id: int
    brand: Optional[str] = None
    model_name: str
    model_no: str
    quantity: int
    unit_price: float
    total_price: float

    class Config:
        from_attributes = True

class PurchaseBillCreate(BaseModel):
    vendor_id: int
    bill_no: str
    total_amount: float
    file_path: Optional[str] = None

class PurchaseBillResponse(PurchaseBillCreate, ORMBase):
    id: int
    date: datetime
    vendor_name: Optional[str] = None
    items: List[BillItemResponse] = []

# --- 4. AUTH & STAFF SCHEMAS ---

class UserRegister(BaseModel):
    username: str
    phone_no: str
    password: str

class UserProfileUpdate(BaseModel):
    email: Optional[EmailStr] = None
    phone_no: Optional[str] = None
    current_password: str

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str

class ForgotPasswordRequest(BaseModel):
    phone_no: str

class ForgotPasswordVerify(BaseModel):
    phone_no: str
    code: str
    new_password: str
    confirm_password: str

class OtpRequest(BaseModel):
    phone_no: Optional[str] = None

class OtpVerifyRequest(BaseModel):
    code: str

class UserSettingsUpdate(BaseModel):
    email: Optional[EmailStr] = None
    phone_no: Optional[str] = None
    new_password: Optional[str] = None
    confirm_password: Optional[str] = None
    otp_session: str

class OtpVerifyResponse(BaseModel):
    verification_token: str

class UserResponse(ORMBase):
    id: int
    username: str
    email: EmailStr
    phone_no: Optional[str] = None
    status: str
    is_active: bool
    is_admin: bool
    base_salary: float # For salary management

# --- 5. TRANSACTION SCHEMAS ---

class TransactionItemBase(BaseModel):
    product_id: int
    quantity: int
    unit_price: float

class TransactionItemCreate(BaseModel):
    product_id: int
    quantity: int
    unit_price: float

class TransactionCreate(BaseModel):
    # Change: stakeholder_id is now Optional. 
    # If it is None, the system will treat it as a 'Walk-in'
    stakeholder_id: Optional[int] = None 
    items: List[TransactionItemCreate]
    total_amount: float
    paid_amount: float
    payment_mode: str # 'CASH', 'ONLINE', etc.

class TransactionItemResponse(BaseModel):
    product_id: int
    product_name: Optional[str] = None
    quantity: int
    unit_price: float

class TransactionResponse(ORMBase):
    id: int
    stakeholder_id: Optional[int]
    user_id: int
    type: str
    total_amount: float
    paid_amount: float
    payment_mode: str
    cash_flow_direction: Optional[str] = None
    created_at: datetime

class TransactionHistoryResponse(TransactionResponse):
    items: List[TransactionItemResponse]

# --- 6. CASH/BANK BALANCES & SETTINGS ---

class SystemBalanceResponse(ORMBase):
    cash_balance: float
    bank_balance: float
    updated_at: datetime

class SystemBalanceUpdate(BaseModel):
    cash_balance: Optional[float] = None
    bank_balance: Optional[float] = None

class SystemSettingsCreate(BaseModel):
    initial_cash_balance: float
    initial_online_balance: float

class SystemSettingsUpdate(BaseModel):
    low_stock_limit: Optional[int] = None
    otp_session: Optional[str] = None

class SystemSettingsResponse(ORMBase):
    id: int
    initial_cash_balance: float
    initial_online_balance: float
    low_stock_limit: int
    updated_at: datetime

# --- 7. EMPLOYEE MANAGEMENT (Admin-controlled) ---

class EmployeeCreate(BaseModel):
    name: str
    phone_no: Optional[str] = None
    role: str = "Staff"
    base_salary: float = 0.0
    user_id: Optional[int] = None

class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    phone_no: Optional[str] = None
    role: Optional[str] = None
    base_salary: Optional[float] = None
    is_active: Optional[bool] = None
    user_id: Optional[int] = None

class EmployeeResponse(ORMBase):
    id: int
    name: str
    phone_no: Optional[str] = None
    role: str
    base_salary: float
    is_active: bool
    user_id: Optional[int] = None
    created_at: datetime
    linked_username: Optional[str] = None

class SalaryUpdateRequest(BaseModel):
    new_salary: float

class SalaryLogResponse(ORMBase):
    id: int
    employee_id: int
    old_salary: float
    new_salary: float
    changed_by: str
    timestamp: datetime

# --- 8. WORKER SALARY & ADVANCES ---

class SalaryAdvanceCreate(BaseModel):
    employee_id: int
    amount: float
    month: int
    year: int

class SalaryAdvanceResponse(ORMBase):
    id: int
    employee_id: Optional[int] = None
    user_id: Optional[int] = None
    amount: float
    month: int
    year: int
    approved_by_admin: bool
    timestamp: datetime