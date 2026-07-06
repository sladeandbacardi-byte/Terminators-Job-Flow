---
name: DB auto-seed gating covers only 4 core tables
description: Why a new table can end up permanently empty in production even though seeding code exists for it
---

`DbStorage.initialize()` only decides whether to run the bulk `seedDatabase()` based on whether `clients`, `jobs`, `invoices`, or `workers` are empty. Any newer table (e.g. `legalEntities`) that isn't part of that check will never get seeded on an existing database, because once the four core tables have rows, `seedDatabase()` is skipped entirely — even if the new table itself is empty.

**Why:** production reported the "Issuing Entity" dropdown always falling back to hardcoded values. The client-side fallback logic, the schema, the storage methods, and the routes were all already correct — the actual cause was that `legal_entities` was never seeded in an existing (already-seeded) database, because it wasn't part of the four-table gate.

**How to apply:** when adding a new table that needs default rows, don't just add insert statements inside `seedDatabase()` — also add an independent, unconditionally-run "ensure seeded" check (query `limit(1)`, seed only if empty) called from `initialize()` outside the four-table gate. Otherwise it silently never seeds on any database that predates the new table.
