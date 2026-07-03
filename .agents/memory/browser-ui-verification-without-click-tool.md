---
name: Verifying frontend fixes in the real browser without a click/interact tool
description: How to prove a UI fix works end-to-end (login + open dialog + click a control) when only a screenshot tool (no click/type) is available.
---

When a user insists on real in-browser proof (not just API/DB checks) but the only
available tool is a static screenshot (no click/type/interact capability), build a
tiny, clearly-marked temporary test harness directly in the app, gated by URL query
params, then remove it immediately after capturing proof:

- Auto-login: read a query param (e.g. `?e2eLogin=<id>`) in the auth hook and call the
  **real** login endpoint (not a fake bypass) to get a session, so the rest of the app
  behaves exactly as it would for a real user.
- Auto-open UI state: read another query param to flip the same state setter the "open"
  button would call (e.g. auto-open a modal), so the exact real component renders.
- Auto-click: add a `data-testid` to the target element and, after it renders, call
  `element.click()` on the real DOM node (not just calling the state setter directly) —
  this exercises the actual onClick wiring, not just the underlying logic.
- Radix UI primitives (Tabs, Select, etc.) often don't respond to a plain synthetic
  `.click()` — dispatch a full pointer sequence instead: `pointerdown`, `mousedown`,
  `pointerup`, `mouseup`, then `click`. Radix `Select` sometimes works with plain
  `.click()` alone, but Radix `Tabs` triggers reliably need the full sequence.
- Capture proof via the screenshot tool (visual state) plus `refresh_all_logs` /
  browser console output (via `console.log` in the harness) for a textual trail.

**Why:** An auto-login query param is a real authentication bypass if left in the
codebase — it lets anyone impersonate any user with no password. It must be treated as
a security-sensitive scaffold, not a convenience helper.

**How to apply:** Add all such hooks with a loud `TEMP E2E TEST HOOK — REMOVE AFTER
VERIFICATION` comment, capture the verification evidence, then delete every hook and
grep the codebase for the query-param names/log prefixes used to confirm zero residue
before finishing the task — never leave one "just in case."
