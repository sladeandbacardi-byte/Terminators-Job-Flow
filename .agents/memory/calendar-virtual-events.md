---
name: Calendar virtual events
description: Handling non-persisted events (recurring-contract occurrences) on the calendar without breaking job interactions.
---

The calendar merges three event sources: `/api/calendar/events` (appointments), `/api/jobs` (real jobs), and `/api/service-contracts/occurrences` (virtual recurring events expanded server-side from contracts).

Virtual occurrence IDs are prefixed `occ-` and have no row in `jobs`. If you tag them with `type: 'job'` and merge them naively:

- `handleEventClick` will run `jobs.find(j => j.id === event.id)` → no match → silent no-op.
- Drag/drop will call `PATCH /api/jobs/:id` → 404 (job not found).

**Why:** Persisting every occurrence up-front (what the old "generate" button did) is what the simplification explicitly removed; the calendar shows them on-the-fly instead.

**How to apply:** Detect the `occ-` prefix at the top of `handleEventClick` and `handleDragStart` and either no-op with a toast or route the user to the Contracts editor. The same prefix lets the rest of the calendar (rendering, filtering by department/assignee) keep treating them as jobs.
