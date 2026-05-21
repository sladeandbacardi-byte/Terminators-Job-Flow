---
name: Recurrence expander anchors
description: How to anchor stepped monthly recurrences (Every 2 months, Quarterly, Every 6 months) so cadence is stable across query windows.
---

When expanding stepped monthly recurrences into a date window, the cadence anchor must NOT default to the window start. If it does, the same contract produces different occurrences depending on which month the user views.

**Why:** Reviewing May shows the contract on May; reviewing June shows it on June; both look "correct" in isolation but the user expects a single deterministic stream from one anchor point.

**How to apply:**
- Make `startDate` required on the form for `Every 2 months`, `Quarterly`, `Every 6 months`, and `Annually` (so the anchor is captured at creation).
- In the expander, fall back to a fixed epoch (e.g. `new Date(1970, 0, 1)`) when `startDate` is missing for `Monthly`/`Twice a month` — never to the query window — so the step pattern is still deterministic.
- `weekOfMonth = 5` means "last weekday of month"; compute from the last day, not by adding 4 weeks.
- For `Twice a month`, the form must collect BOTH first and second `weekOfMonth` + `dayOfWeek` — easy to miss when wiring conditional fields.
