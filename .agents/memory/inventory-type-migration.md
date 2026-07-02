---
name: Inventory type migration
description: Inventory item type values changed from snake_case to display strings; migration runs at startup
---

The inventoryItems.type column changed from "product"/"rental_equipment" to 7 new display values:
- Consumable, Equipment / Rental Item, Chemical, Tool, PPE, Service Item, Other

**Why:** Users needed meaningful labels in the UI; old values were internal DB strings.

**How to apply:**
- runDataMigrations() in db-storage.ts patches "product"→"Consumable" and "rental_equipment"→"Equipment / Rental Item" at every server startup (idempotent)
- Frontend type filter and form dropdowns use the new string values exactly (case-sensitive match)
- inventoryItemToLineType() in unified-contract-form.tsx maps new types to contract line types using toLowerCase() + includes() for forward-compat
- sku is now nullable/optional; auto-generated as PREFIX-TIMESTAMP if blank
