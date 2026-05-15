# Rainbow ERP Frontend — Walkthrough

## Summary

Built the complete frontend for the Rainbow ERP Retail Inventory & Sales application on top of the existing `client/` Next.js project. All pages are functional, typed, and build-verified.

---

## Changes Made

### New Files Created (7)

| File | Purpose |
|------|---------|
| [types.ts](file:///c:/Users/KIIT0001/Downloads/Rainbow_erp/client/src/lib/types.ts) | 15 TypeScript interfaces mapping 1:1 to backend models |
| [useAuthStore.ts](file:///c:/Users/KIIT0001/Downloads/Rainbow_erp/client/src/store/useAuthStore.ts) | Zustand auth store with OAuth2 form-encoded login |
| [login/layout.tsx](file:///c:/Users/KIIT0001/Downloads/Rainbow_erp/client/src/app/login/layout.tsx) | Sidebar-stripped layout for login page |
| [login/page.tsx](file:///c:/Users/KIIT0001/Downloads/Rainbow_erp/client/src/app/login/page.tsx) | Full-screen login with dark gradient + ambient glow effects |
| [useLaserFocus.ts](file:///c:/Users/KIIT0001/Downloads/Rainbow_erp/client/src/hooks/useLaserFocus.ts) | Reusable hook for entity/product history fetching |
| 6 Shadcn components | tabs, badge, select, separator, label, skeleton (installed via CLI) |

### Files Modified (8)

| File | What Changed |
|------|-------------|
| [globals.css](file:///c:/Users/KIIT0001/Downloads/Rainbow_erp/client/src/app/globals.css) | Added `--sidebar-width`, `--primary-green`, `--success/warning/danger` vars, `.metric-card` hover effects |
| [useCartStore.ts](file:///c:/Users/KIIT0001/Downloads/Rainbow_erp/client/src/store/useCartStore.ts) | Added `cost_price` field to `CartItem` for `cost_price_at_sale` snapshot |
| [page.tsx (Dashboard)](file:///c:/Users/KIIT0001/Downloads/Rainbow_erp/client/src/app/page.tsx) | **Full rewrite** — 7 metric cards fetching from `/dashboard/summary` + `/finances/daily-summary` |
| [sales/page.tsx](file:///c:/Users/KIIT0001/Downloads/Rainbow_erp/client/src/app/sales/page.tsx) | **Wired `updateItem`** for price+qty editing, added payment mode toggle, paid amount input, new customer dialog, `cost_price_at_sale` in payload |
| [inventory/page.tsx](file:///c:/Users/KIIT0001/Downloads/Rainbow_erp/client/src/app/inventory/page.tsx) | Added cost_price + initial_stock fields, **fixed API to use query params**, category creation dialog, stock badges |
| [stakeholders/page.tsx](file:///c:/Users/KIIT0001/Downloads/Rainbow_erp/client/src/app/stakeholders/page.tsx) | **Full build** — Search, create entity dialog, debtors tab with balance coloring |
| [stakeholders/[id]/page.tsx](file:///c:/Users/KIIT0001/Downloads/Rainbow_erp/client/src/app/stakeholders/%5Bid%5D/page.tsx) | **Laser Focus** — Profile card + transaction timeline with type icons and due badges |
| [finances/page.tsx](file:///c:/Users/KIIT0001/Downloads/Rainbow_erp/client/src/app/finances/page.tsx) | **Full build** — Daily summary cards + expense creation form using query params |

---

## Critical Bug Fixes

> [!WARNING]
> **Query Params vs JSON Body**: The original `inventory/page.tsx` sent a JSON body to `POST /inventory/products/` but the FastAPI backend expects **query parameters**. This was silently failing. Fixed across all POST endpoints (inventory, stakeholders, finances).

> [!IMPORTANT]
> **Shadcn Import Paths**: The `npx shadcn@latest add` CLI generated imports as `"src/lib/utils"` instead of `"@/lib/utils"`. Fixed in all 6 newly installed components.

---

## Key Architecture Decisions

1. **`updateItem` is wired** — Price and quantity are both editable `<Input>` fields in the sales table, calling `useCartStore.updateItem(id, { price/qty })`
2. **`cost_price_at_sale`** — Captured from the product's cost_price when added to cart and sent in the sale payload
3. **Payment flexibility** — CASH/ONLINE toggle + partial payment support (shows DUE badge when paid < total)
4. **Auth flow** — OAuth2 `application/x-www-form-urlencoded` POST matching FastAPI's `OAuth2PasswordRequestForm`
5. **Laser Focus hook** — Generic `useLaserFocus({ type, id })` works for both entities and products

---

## Build Verification

```
▲ Next.js 16.2.6 (Turbopack)
✓ Compiled successfully in 3.4s
✓ TypeScript — 0 errors
✓ 9/9 static pages generated

Routes:
○ /              Dashboard
○ /login         Authentication
○ /sales         POS Billing
○ /inventory     Stock Management
○ /stakeholders  Customer/Vendor List
ƒ /stakeholders/[id]  Laser Focus Detail
○ /finances      Daily P&L + Expenses
```

---

## How to Run

```bash
cd client
npm run dev
# Opens on http://localhost:3000
# Backend must be running on http://localhost:8000
```
