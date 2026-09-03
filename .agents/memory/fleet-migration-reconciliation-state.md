---
name: Fleet migration reconciliation state
description: How to interpret resumable FleetGuard migration state and avoid template-item collisions or false unresolved-conflict counts.
---

Inspection template items must reuse an existing row at the same template and position before upserting the source mapping. Older imports may have created that logical item under a different deterministic ID.

**Why:** Upserting only by ID can collide with the database's unique template-position constraint during a resume, even though the logical item already exists.

**How to apply:** Resolve the existing template-position row first, map the source record to that row, and then update it idempotently.

Per-run reconciliation counts can represent only the high-water-mark delta, while old conflict rows can remain marked open after the same source records later receive successful mappings.

**Why:** Treating one run's source count as the full migration total, or counting every open historical conflict as unresolved, produces false incompleteness.

**How to apply:** Verify completion using aggregate source mappings and count conflicts without a successful mapping separately. Preserve genuinely ambiguous current assignments instead of forcing them.