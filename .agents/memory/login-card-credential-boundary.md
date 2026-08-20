---
name: Login card credential boundary
description: Keeps the card-based login experience compatible with the project's separate mobile and administrator authentication policies.
---

Login identity cards may help a person select the correct account, but selecting a card must never itself create an authenticated session. Technicians must still supply their employee PIN to receive the short-lived mobile token, and administrators must still supply their password.

**Why:** The product wants a fast, visual role-and-user selector, while privileged office access and technician job/fleet data need auditable credential verification.

**How to apply:** When changing login discovery, routing, or card UI, expose only non-sensitive display data and keep token issuance exclusively behind the existing credential-verification endpoints.