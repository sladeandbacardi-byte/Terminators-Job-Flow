---
name: Dual auth token formats
description: Office and mobile authentication are deliberately separate even though non-owner staff use passwordless profile selection.
---

Julien authenticates through the sole password-backed administrator account. Eligible office staff and mobile technicians use separate passwordless profile-selection flows.

**Rule:** Authorization decisions must retain the original worker title and use a finite, reviewed allowlist for privileged roles. Never use the dashboard-role default as an authorization fallback.

**Why:** The display-role mapper intentionally treats unknown titles as an administrator so the UI has a usable default. Applying that mapper to a security decision silently turns a malformed or newly added title into elevated access.

**How to apply:** Use the normalized dashboard role only for UI presentation; deny unknown source roles for privileged server actions. Administrator accounts sign in with username/password. Eligible office and mobile staff use their separate passwordless selectors and persisted, revocable session stores.

Mobile sessions use a separate versioned token backed by a server-side session row and are intentionally not accepted by generic office routes. Logout and user switching must revoke the stored session; bump the token type when immediate invalidation of all older mobile credentials is required.

**Why:** Sending a mobile technician from the field app to a desktop page can silently fail authentication, while broadening generic authentication would expose office data outside the mobile route allowlist.

**How to apply:** Build mobile-specific route handlers under the explicit mobile protected-route list, validate both token claims and the stored session on every request, and clear both office/mobile client identity namespaces during switching. Keep office pages on normal authenticated paths.
