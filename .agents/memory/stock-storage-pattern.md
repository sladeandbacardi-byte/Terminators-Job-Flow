---
name: Stock management storage pattern
description: How the stock management system is wired — routes cast storage, movement creation auto-updates balances, locations are seeded.
---

# Stock Management Storage Pattern

## Rule
New stock tables (stock_locations, stock_balances, stock_movements, picking_lists, picking_list_items, stock_checks, stock_check_items) have methods only on `DbStorage`, not declared in `IStorage`. Routes access them via `(storage as any).methodName()`.

**Why:** Adding to `IStorage` requires also implementing on `MemStorage` (stub). The cast pattern was already in use for companySettings and field-diaries.

## Key behaviours
- `createStockMovement` automatically calls `upsertStockBalance` for both `fromLocationId` (deduct) and `toLocationId` (add). No need to call balance update separately.
- `seedDefaultStockLocations` is called once at route registration time (guarded by count check). It creates 7 default locations: Main Store, Pest Control Vehicle 1/2, Washroom Vehicle, Sanitary Bin Vehicle, Dustmat Team, Deep Cleaning Team.
- `issuePickingList` creates one StockMovement per picking list item (type "Issued to Technician") then marks the list "Issued".
- `approveStockCheck` creates "Stock Check Correction" movements for every item with a variance ≠ 0.
- `upsertStockBalance` clamps quantity to 0 (never negative).

## How to apply
- When adding more stock-aware actions (e.g. job completion deducts stock), call `createStockMovement` — it handles balance updates automatically.
- If adding new stock methods, follow the same `(storage as any)` cast in routes and add the method to `DbStorage` only.
