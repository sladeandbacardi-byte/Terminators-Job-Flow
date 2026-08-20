---
name: Login card credential boundary
description: Keeps the card-based login experience compatible with the project's separate mobile and administrator authentication policies.
---

Login identity cards may help a person select the correct account, but selecting a card must never itself create an authenticated session. Administrators must still supply their password. Technician PIN verification is temporarily disabled at the user's request because the original PINs are unavailable; active mobile technicians currently sign in with their employee ID and receive the short-lived mobile token.

**Why:** The product wants a fast, visual role-and-user selector, while privileged office access needs auditable credential verification. The temporary technician exception keeps field work moving until a PIN reset process is available.

**How to apply:** When changing login discovery, routing, or card UI, expose only non-sensitive display data. Keep administrator token issuance behind password verification. Restore technician PIN verification once replacement PINs have been issued.