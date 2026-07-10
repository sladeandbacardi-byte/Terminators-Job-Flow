---
name: Calendar permission enforcement must be server-side, not just UI
description: Shared canMoveCalendarEvent policy must be re-checked on every write route that moves/reassigns a calendar-backed entity, not only used to hide the drag handle client-side.
---

When a calendar/diary view uses a shared drag-permission policy (e.g. `canMoveCalendarEvent(role, userId, event)`), every backend route that can move/reassign that entity must call the same policy function itself. Hiding the drag handle client-side is not sufficient — a direct API call bypasses it.

**Why:** During diary standardization, the new `POST /api/contract-occurrence-exceptions` route correctly re-checked `canMoveCalendarEvent` server-side, but the pre-existing `PATCH /api/jobs/:id` route had (and still has) no auth/permission check at all — a technician's client is prevented from dragging a job, but nothing stops a raw PATCH call from moving it. This gap pre-dated the standardization work and was left as a flagged follow-up rather than fixed inline, to avoid scope creep into unrelated job-flow endpoints.

**How to apply:** When adding or auditing any route that mutates a calendar-backed record's time/date/assignee (jobs, appointments, contract occurrences, fleet tasks, etc.), confirm it imports and enforces the same permission function used for the UI's drag/drop gating. If it doesn't, treat it as a gap worth fixing or explicitly flagging, not something to assume is covered because the UI blocks it.
