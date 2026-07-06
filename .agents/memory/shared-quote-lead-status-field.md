---
name: Shared quote/lead status field
description: quote_submissions.status drives both the leads board and the quotes list — there is no separate quote entity/status column.
---

The `quote_submissions` table has a single `status` column that is read by both the Leads board (`client/src/pages/leads.tsx`) and the Quotes page (`client/src/pages/quotes.tsx`). There is no separate "quote status" field — a quote IS a quote_submissions row.

**Why:** Any status value written from the Quotes UI (e.g. a status dropdown, a decline/accept action) must be one of the 7 canonical `LEAD_STATUSES` values (`new`, `contacted`, `appointment_booked`, `quote_required`, `quoted`, `lost`, `converted`) defined in `shared/schema.ts`. Writing a quote-only vocabulary value (e.g. legacy `draft`, `sent`, `declined`, `accepted`) causes `normalizeLeadStatus()` to bucket the lead into the "Needs Review" fallback column on the Leads board — the same disappearing-lead bug the canonical-status rework was meant to fix.

**How to apply:** When adding/editing any UI or backend code that writes `quote_submissions.status`, check it against `LEAD_STATUSES` in `shared/schema.ts` first. `normalizeLeadStatus()` also maps legacy strings (`declined`→`lost`, `accepted`→`converted`, `site_done`/`quote_needed`→`quote_required`, etc.) as a safety net, but new code should emit canonical values directly rather than relying on that fallback.
