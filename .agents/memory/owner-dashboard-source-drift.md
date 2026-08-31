---
name: Owner dashboard source drift
description: Availability rule for private owner dashboards that aggregate many independently evolving operational sources.
---

The private owner cockpit must isolate failures per queried source and return available private/editor data with explicit empty states when an unrelated operational dataset is temporarily unavailable.

**Why:** Railway production schema can lag development for one source table; one rejected aggregate query previously made the entire confidential dashboard return 500 even though its private records and editor schema were healthy.

**How to apply:** Wrap independent dashboard source reads separately, log the unavailable source, and preserve strict failures for direct CRUD writes so mutations never pretend to succeed.