// ============================================================
// Rainbow ERP — Strict TypeScript Types for all API responses
// Maps 1:1 to the FastAPI backend models & schemas
// ============================================================

// --- INVENTORY MODULE ---

export interface Product {
  id: number;
  category_id: number;
  brand: string;
  model_name: string;
  model_no: string;
  current_stock: number;
  cost_price: number;
}

export interface Category {
  id: number;
  name: string;
  parent_id: number | null;
  subcategories: Category[];
}

export interface StockLog {
  id: number;
  product_id: number;
  change_amount: number;
  reason: string;
  timestamp: string;
}

// --- STAKEHOLDERS MODULE ---

export interface Entity {
  id: number;
  name: string;
  phone_no: string;
  entity_type: "CUSTOMER" | "VENDOR";
  balance: number;
}

// --- AUTH MODULE ---

export interface User {
  id: number;
  username: string;
  email: string;
  is_active: boolean;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

// --- TRANSACTION MODULE ---

export interface Transaction {
  id: number;
  entity_id: number;
  user_id: number;
  type: "SALE" | "PURCHASE" | "RETURN";
  total_amount: number;
  paid_amount: number;
  payment_mode: "CASH" | "ONLINE";
  created_at: string;
}

export interface TransactionItem {
  id: number;
  transaction_id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  cost_price_at_sale: number;
}

// --- SALE PAYLOAD (matches schemas.py SaleCreate) ---

export interface SaleItem {
  product_id: number;
  quantity: number;
  unit_price: number;
  cost_price_at_sale?: number;
}

export interface SalePayload {
  entity_id: number;
  items: SaleItem[];
  total_amount: number;
  paid_amount: number;
  payment_mode: string;
}

// --- PURCHASE PAYLOAD (matches schemas.py PurchaseCreate) ---

export interface PurchaseItem {
  product_id: number;
  quantity: number;
  unit_cost: number;
}

export interface PurchasePayload {
  entity_id: number;
  items: PurchaseItem[];
  total_amount: number;
  paid_amount: number;
  payment_mode: string;
}

// --- DASHBOARD & FINANCES ---

export interface DashboardSummary {
  customers_owe_you: number;
  you_owe_vendors: number;
  low_stock_count: number;
  reminders: string;
  viewed_by: string;
}

export interface DailySummary {
  date: string;
  revenue: number;
  gross_profit: number;
  expenses: number;
  net_profit: number;
  checked_by: string;
}

export interface Expense {
  id: number;
  item: string;
  description: string | null;
  amount: number;
  payment_mode: string;
  timestamp: string;
}

// --- LASER FOCUS RESPONSES ---

export interface EntityLaserFocus {
  profile: Entity;
  transaction_count: number;
  history: Transaction[];
}

export interface ProductLaserFocus {
  details: Product;
  movement_history: StockLog[];
}
