---
name: Organogram unrestricted access
description: The authoritative worker-role rule that separates unrestricted JobFlow access from ordinary role-based access.
---

Grant unrestricted JobFlow access only to the canonical Julien worker identity. Titles containing Admin or Supervisor, Pest Control Operators/PCOs, Managers, and Technicians never imply unrestricted access. Every other named identity receives explicit module permissions and, where relevant, department/team/own-work scope. Unclassified UI and API namespaces fail closed.

**Why:** Credential-table roles and job-title words describe authentication or duties, not authority. Broad title/department heuristics granted cross-department, finance, payroll, scheduling, and administration access beyond the approved organogram.

**How to apply:** Resolve the canonical worker identity, then use the centralized named permission profile for navigation, direct routes, APIs, search, reports, and exports. For every direct-record endpoint, load the resource and derive its department/worker/team before reading or mutating it; never trust caller-supplied scope or response filtering alone. Keep mobile tokens separate and enforce own-work versus supervisor team expansion explicitly.