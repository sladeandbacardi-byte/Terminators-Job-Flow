---
name: Dual auth token formats
description: Two incompatible login/token systems coexist; requireAuth must accept both or admin-gated routes silently 401 for real users.
---

The app supports both worker-profile sessions and admin-account sessions. Worker job titles are free text, while the dashboard derives a simplified display role from them.

**Rule:** Authorization decisions must retain the original worker title and use a finite, reviewed allowlist for privileged roles. Never use the dashboard-role default as an authorization fallback.

**Why:** The display-role mapper intentionally treats unknown titles as an administrator so the UI has a usable default. Applying that mapper to a security decision silently turns a malformed or newly added title into elevated access.

**How to apply:** Preserve source worker identity and title throughout session resolution. Use the normalized dashboard role only for UI presentation; deny unknown source roles for privileged server actions. Worker sessions must be signed with a configured secret. The profile-picker login intentionally has no PIN and must never authorize management/admin actions or render a management dashboard; administrator accounts sign in separately with username/password. Mobile employee-ID PINs are bcrypt-verified; a legacy plaintext PIN is upgraded to a hash only after its first successful login.

Mobile employee-ID sessions use a separate `mobile_worker` token and are intentionally not accepted by generic office routes.

**Why:** Sending a mobile technician from the field app to a desktop page can silently fail authentication, while broadening generic authentication would expose office data outside the mobile route allowlist.

**How to apply:** Build mobile-specific route handlers under the explicit mobile protected-route list and render a mobile-aware page for shared URLs such as overtime; keep the office page on its normal authenticated path.
