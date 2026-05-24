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
  min_selling_price: number;
  image_url?: string | null;
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

export interface Stakeholder {
  id: number;
  name: string;
  phone_no: string;
  type: "CUSTOMER" | "VENDOR";
  is_wholesale: boolean;
  balance: number;
}

export type SearchStakeholder = Stakeholder;

export interface SearchTransaction {
  id: number;
  stakeholder_id: number | null;
  stakeholder_name: string | null;
  user_id: number;
  type: "SALE" | "PURCHASE" | "RETURN" | string;
  total_amount: number;
  paid_amount: number;
  payment_mode: "CASH" | "ONLINE" | string;
  cash_flow_direction?: "IN" | "OUT" | string | null;
  created_at: string;
  items?: BillOverlayItem[];
}

export interface PurchaseBillItem {
  product_id: number;
  product_name: string;
  model_no?: string | null;
  quantity: number;
  unit_price: number;
  total_price?: number;
}

export interface SearchPurchaseBill {
  id: number;
  vendor_id: number;
  vendor_name: string | null;
  bill_no: string;
  total_amount: number;
  file_path: string | null;
  date: string | null;
  items: PurchaseBillItem[];
}

export interface SearchResponse {
  stakeholders: SearchStakeholder[];
  transactions: SearchTransaction[];
  purchase_bills: SearchPurchaseBill[];
}

export type TransactionHistoryResponse = SearchTransaction;

export interface VendorFullProfile {
  profile: Stakeholder;
  digital_bills: SearchPurchaseBill[];
  transaction_history: TransactionHistoryResponse[];
}

// --- AUTH MODULE ---

export interface User {
  id: number;
  username: string;
  email: string;
  phone_no: string | null;
  status: string;
  is_active: boolean;
  is_admin: boolean;
  base_salary: number;
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
  items?: Array<{
    product_id: number;
    product_name?: string | null;
    quantity: number;
    unit_price: number;
    total_price?: number;
  }>;
}

export interface TransactionItem {
  id: number;
  transaction_id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  cost_price_at_sale: number;
  product_name?: string | null;
}

// --- SALE PAYLOAD (matches schemas.py SaleCreate) ---

export interface SaleItem {
  product_id: number;
  quantity: number;
  unit_price: number;
  cost_price_at_sale?: number;
}

export interface SalePayload {
  stakeholder_id?: number | null;
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
  stakeholder_id?: number | null;
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
  low_stock_limit: number;
  reminders: string;
  notification_items: string[];
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

export interface ProfitReportPoint {
  label: string;
  revenue: number;
  gross_profit: number;
  expenses: number;
  net_profit: number;
}

export interface ProfitReportResponse {
  period: "monthly" | "yearly";
  data: ProfitReportPoint[];
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

export interface StakeholderLaserFocus {
  profile: Stakeholder;
  transaction_count: number;
  history: Transaction[];
}

export interface ProductLaserFocus {
  details: Product;
  movement_history: StockLog[];
}

export interface ProductDetailResponse {
  details: Product;
  movement_history: StockLog[];
}

export interface BillOverlayItem {
  product_id: number;
  product_name: string;
  model_no?: string | null;
  quantity: number;
  unit_price: number;
  total_price?: number;
}

export interface BillOverlayData {
  id: number;
  type: string;
  date: string;
  stakeholder_name: string;
  total_amount: number;
  paid_amount: number;
  payment_mode: string;
  description?: string | null;
  file_path?: string | null;
  items: BillOverlayItem[];
}

export interface SystemBalance {
  cash_balance: number;
  bank_balance: number;
  updated_at: string;
}
