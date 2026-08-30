---
name: Sole superadmin provisioning
description: Safety rules for reconciling one credential-backed office super administrator during startup.
---

Serialize sole-superadmin reconciliation with a database transaction lock. Preserve an existing password hash and session foreign-key identity only when the credential row matches a deterministic canonical ID or configured username; never choose an arbitrary active administrator.

**Why:** Concurrent application starts can otherwise race inserts, while heuristic account selection can silently transfer another person's credential to the superadmin identity.

**How to apply:** Treat the canonical worker as a read-only prerequisite, leave accounts unchanged when the worker or credential source is missing, update the selected admin row in place, and deactivate competitors in the same locked transaction.