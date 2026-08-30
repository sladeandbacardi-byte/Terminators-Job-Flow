---
name: Login card credential boundary
description: Keeps the card-based login experience compatible with the project's separate mobile and administrator authentication policies.
---

The login chooser runs in `quickLogin` mode: selecting an active mobile technician or office profile immediately creates the appropriate signed session. Mobile technician PIN authentication is disabled by product decision; the protected administrator account remains password-gated. Sheryl-Lyn Lee is intentionally an office/sales profile, not a separate mobile technician login.

**Why:** The product wants one-click access for day-to-day staff and office profiles, while the protected administrator account still needs credential verification. This makes mobile profile selection an identity choice rather than a credential check, so it is appropriate only where the device and staff directory are trusted. Keeping Sheryl-Lyn out of the technician list avoids a duplicate identity with the wrong dashboard.

**How to apply:** When changing login discovery, routing, or card UI, expose only non-sensitive display data. Keep protected administrator token issuance behind password verification. Do not add Sheryl-Lyn to the mobile technician directory without an explicit role change. Legacy worker PIN hashes may remain stored but must not be read or edited by the application.