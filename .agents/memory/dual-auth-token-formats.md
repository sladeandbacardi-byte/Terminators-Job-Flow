---
name: Dual auth token formats
description: Office and mobile authentication are deliberately separate even though non-owner staff use passwordless profile selection.
---

Julien authenticates through the sole password-backed administrator account. Eligible office staff and mobile technicians use separate passwordless profile-selection flows.

**Rule:** Authorization decisions must retain the original worker title and use a finite, reviewed allowlist for privileged roles. Never use the dashboard-role default as an authorization fallback.

**Why:** The display-role mapper intentionally treats unknown titles as an administrator so the UI has a usable default. Applying that mapper to a security decision silently turns a malformed or newly added title into elevated access.

**How to apply:** Use the normalized dashboard role only for UI presentation; deny unknown source roles for privileged server actions. Never mint office sessions from a selected worker ID. Administrator accounts sign in with username/password and persisted revocable sessions. Mobile PINs are bcrypt-verified; a legacy plaintext PIN is upgraded to a hash only after its first successful login.

Mobile sessions use a separate versioned mobile token and are intentionally not accepted by generic office routes. Bump the token type when a credential-bypass incident requires immediate invalidation of all existing mobile sessions.

**Why:** Sending a mobile technician from the field app to a desktop page can silently fail authentication, while broadening generic authentication would expose office data outside the mobile route allowlist.

**How to apply:** Build mobile-specific route handlers under the explicit mobile protected-route list and render a mobile-aware page for shared URLs such as overtime; keep the office page on its normal authenticated path.
