---
name: Treatment report evidence model
description: Durable rules for the structured Pest Control treatment-report workflow.
---

Digital Pest Control treatment reports extend the existing report record rather than replacing it. Store repeatable evidence (areas, pests, equipment, products, photos, follow-ups, and audits) as child records, while keeping legacy summary fields populated for existing client-history views.

**Why:** Existing records and desktop views rely on the legacy report shape, but compliance evidence needs multiple entries per report and an audit trail.

**How to apply:** Derive client, job, technician, contract, and PCO context from the authorised job/worker on every mobile write. Mobile staff may save drafts only for their assigned/team jobs and may never alter a completed report; authorised office corrections must create audit records.