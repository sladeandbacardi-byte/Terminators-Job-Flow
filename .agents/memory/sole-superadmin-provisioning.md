---
name: Sole superadmin provisioning
description: Safety rules for reconciling one credential-backed office super administrator during startup.
---

Serialize sole-superadmin reconciliation with a database transaction lock. Reconcile the deployment-secret password in place only when the credential row has the canonical worker ID or is already the exact canonical person with the configured username; username ownership alone is never enough.

**Why:** Concurrent starts can race inserts, and username-only selection can transfer another person's account plus its live sessions to the superadmin identity. Secret rotation must update the hash without logging it and leave sessions/business data intact.

**How to apply:** Treat workers as read-only. Compare the configured secret to the stored hash, rotate only on mismatch, write a non-sensitive audit event transactionally, deactivate only competing superadmins, and require the secret in production.