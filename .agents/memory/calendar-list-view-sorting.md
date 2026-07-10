---
name: Calendar/diary list views need explicit sort comparators
description: FullCalendar (and similar calendar libs) list/agenda views don't tie-break same-time events by domain fields like route sequence — you must supply your own comparator.
---

When a diary/calendar spec requires ordering entries by more than start time alone (e.g. "sort by time, then route sequence, then client name" for a daily field-service list), the calendar library's default list rendering will NOT do this — it only sorts by start time, leaving same-time entries in arbitrary/insertion order.

**Why:** Found this gap only after the initial migration passed all other diary standardization checks — the Daily Diaries list view looked plausible but silently ignored route sequence, which matters operationally (route order determines drive sequence for field techs).

**How to apply:** For any shared diary/calendar component, expose an explicit `eventOrder`/comparator prop (time → domain tie-break fields → name fallback) rather than relying on the library's default, whenever the spec calls out a specific multi-field sort order for list-style views.
