---
name: Time submission audit boundary
description: Reliability boundary between field time submissions, audit logging, and required production schema.
---

Mobile overtime and authorised Time Off submissions must remain saved when a secondary audit-log write fails. Log the audit failure prominently, but do not turn a valid field submission into a failed request.

**Why:** Railway production can have schema drift from development. Coupling the primary insert and audit insert in one transaction caused a missing or unhealthy audit relation to roll back valid technician submissions while the same flow worked in Replit.

**How to apply:** Keep concurrency controls around the primary Time Off conflict check and insert. Treat the core overtime tables and columns as startup-critical migrations so a deployment cannot advertise itself as healthy with unusable time-entry storage.