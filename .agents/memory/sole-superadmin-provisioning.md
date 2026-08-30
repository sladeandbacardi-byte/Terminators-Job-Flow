---
name: Sole superadmin provisioning
description: Safety rules for reconciling one credential-backed office super administrator during startup.
---

Serialize sole-superadmin reconciliation with a database transaction lock. Preserve an existing password hash and session foreign-key identity only when the credential row matches a deterministic canonical ID or configured username; never choose an arbitrary active administrator.

**Why:** Concurrent application starts can otherwise race inserts, while heuristic account selection can silently transfer another person's credential to the superadmin identity. “Sole superadmin” must not disable ordinary office administrators.

**How to apply:** Treat workers as read-only. Recognize only the desired canonical worker or an exact known legacy seed identity, update the selected admin row in place, deactivate only competing superadmins, and require a deployment secret when no credential row exists.