---
name: Dual auth token formats
description: Two incompatible login/token systems coexist; requireAuth must accept both or admin-gated routes silently 401 for real users.
---

The app has two parallel, previously-disconnected auth systems:

1. **Real UI login** ("choose your profile" screen, `POST /api/auth/login` with `{userId}`): issues a plain, non-JWT token shaped `token_<workerId>_<issuedAtMs>`, with no row ever written to `user_sessions`. This is what every actual user in the app uses. The `role` on a worker is a free-text job title (e.g. "Operations Manager"), not an enum.
2. **JWT admin login** (`AuthService.authenticateUser`, backed by the separate `admin_users` table + `user_sessions`): fully wired on the backend (`requireAuth`/`requireAdmin`) but has no reachable login form in the actual app UI.

**Why this matters:** `requireAuth` originally only validated system (2), so any admin-gated route (`/api/admin/...`, `/api/backup/...`) always returned 401 for every real logged-in user — a latent bug that went unnoticed because the frontend `ProtectedRoute` gate is purely client-side (computes a `DashboardRole` from job title/department, see `shared/dashboardRole.ts`) and doesn't depend on the backend session being valid.

**How to apply:** `requireAuth` (server/auth-service.ts) now tries to resolve `token_<workerId>_<ts>` tokens first (looks up the worker, computes the effective dashboard role via `shared/dashboardRole.ts`, treats it as the `AdminUser.role`) before falling back to the JWT/session path. `requireAdmin` still only allows role `admin`/`superadmin`, so only workers whose computed dashboard role is "admin" pass — same threshold the UI already uses to show admin-only pages. If a new admin-gated route 401s for a real logged-in user, check this bridge first before assuming a token/header bug on the frontend.

Also: `activity_logs.user_id` has no FK constraint (removed one to `admin_users`) since it must record IDs from either user system.
