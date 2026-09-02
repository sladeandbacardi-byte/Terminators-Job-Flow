---
name: FleetGuard assignment history
description: How to reconcile current FleetGuard driver/vehicle links without inventing source assignment history.
---

FleetGuard exposes current assignment references on both driver and vehicle rows, but no assignment-history table or assignment-start timestamp. `session_started_at` is a login/session field and must not be used as assignment provenance.

**Why:** Session timestamps change independently of vehicle ownership. Using them in assignment IDs creates a new apparent assignment on each login and invents history the source does not contain.

**How to apply:** Require driver-side and vehicle-side references to agree, key an imported current assignment by the stable source driver+vehicle pair, preserve an exact existing JobFlow start time, and close/create JobFlow rows only when that pair changes. Quarantine disagreements.