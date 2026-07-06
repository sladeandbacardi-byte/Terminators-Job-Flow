---
name: DB reset/seed workflow and login-picker allowlist
description: Manual db:reset + db:seed scripts for bootstrapping a fresh (e.g. new Railway) database, and a login-picker gotcha they must account for.
---

Added `db:reset` (drops/recreates the `public` schema, gated behind a `--yes`/`CONFIRM_RESET` confirmation) and `db:seed` (idempotent: legal entities, departments, 6 default login users) as manual-only pnpm scripts — never wired into `dev`/`build`/`start`.

The seed script intentionally seeds a lean, generic production baseline (department names, 6 role-labeled demo users) rather than reusing `DbStorage`'s rich dev-demo `seedDatabase()` (24 real-named staff, fake PE clients/jobs/invoices) — the two are different tools for different environments (fresh prod bootstrap vs. local dev fixtures).

**Why:** `GET /api/auth/staff` in `server/routes.ts` filters real DB workers through a `HARDCODED_STAFF` allowlist of fixed IDs (`worker-1`..`worker-6`) — a worker row that exists in the DB but isn't in that allowlist will never appear in the login picker, even though the endpoint "works." The seed script's demo users deliberately reuse those exact IDs so they surface automatically without touching routes.ts, and are idempotent (skip-if-exists) so they never clobber an existing dev/prod roster occupying those same IDs.

**How to apply:** when adding any new "should show up at login" worker, either give it one of the allowlisted IDs or extend `HARDCODED_STAFF` — otherwise it silently won't appear in the picker despite existing in the database.
