---
name: Login card credential boundary
description: Keeps the card-based login experience compatible with the project's separate mobile and administrator authentication policies.
---

The login chooser runs in `quickLogin` mode: selecting an active mobile technician or eligible office profile immediately creates the appropriate signed session. Staff passwords and PINs are removed by product decision; only Julien's protected administrator account remains password-gated. Sheryl-Lyn Lee is intentionally an office/sales profile, not a separate mobile technician login.

**Why:** The product wants one-click access for day-to-day staff and office profiles, while the protected administrator account still needs credential verification. This makes mobile profile selection an identity choice rather than a credential check, so it is appropriate only where the device and staff directory are trusted. Keeping Sheryl-Lyn out of the technician list avoids a duplicate identity with the wrong dashboard.

**How to apply:** When changing login discovery, routing, or card UI, expose only non-sensitive display data. Keep Julien's administrator token issuance behind password verification. Do not add password/PIN reset paths for staff or add Sheryl-Lyn to the mobile technician directory without an explicit role change.