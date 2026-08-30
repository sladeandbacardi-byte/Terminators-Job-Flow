---
name: Organogram unrestricted access
description: The authoritative worker-role rule that separates unrestricted JobFlow access from ordinary role-based access.
---

Grant unrestricted JobFlow access only to the canonical Julien worker identity and active workers whose authoritative role explicitly contains Admin or Supervisor, or identifies a Pest Control Operator/PCO. Generic Manager and Technician roles remain restricted.

**Why:** Credential-table roles describe office authentication, not the authoritative organogram. Trusting generic admin/manager credentials or broad title/department heuristics grants more access than the approved 2026 organogram allows.

**How to apply:** Enrich password-authenticated office sessions from one deterministic active worker match, then use the worker ID/title classifier for server gates, API modules, client routes, and navigation. Keep mobile tokens separate and never edit worker roles to make an identity qualify.