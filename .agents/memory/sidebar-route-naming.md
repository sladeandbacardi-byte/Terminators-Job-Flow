---
name: Sidebar route naming — Contracts vs Rental Contracts
description: Two distinct features both want the word "Contracts" in the menu.
---

There are two unrelated "contracts" concepts in the sidebar:

- **Sales › Rental Contracts** at `/contracts` — backed by `rentalContracts` schema; financial/contractual records for rented hygiene equipment.
- **Service › Contracts** at `/service-contracts` — backed by `serviceContracts` schema; recurring service jobs (Outlook-style scheduling) that the calendar auto-expands.

**Why:** The user wanted the Service menu entry called simply "Contracts" but the `/contracts` URL was already in use by Sales. Renaming the existing route would break Sales links and bookmarks.

**How to apply:** Keep the URL paths distinct (`/contracts` vs `/service-contracts`) even though the visible menu label for the Service one is just "Contracts". Don't merge the two tables.
