---
name: Fleet KM same-day history
description: Why KM idempotency cannot rely on one database row per worker, vehicle, and day.
---

Legacy FleetGuard history can contain separate AM and PM records for the same worker, vehicle, and calendar day. Do not enforce a simple unique constraint on that day tuple or collapse rows without an explicit, backed-up normalization migration.

**Why:** Production contains many legitimate same-day pairs. A unique-day migration would either fail deployment or destroy the distinction between historical source readings.

**How to apply:** Implement mobile KM concurrency with transactional submission receipts or another event-level idempotency design. Preserve legacy rows and prove normalization with a reversible ledger before changing them.