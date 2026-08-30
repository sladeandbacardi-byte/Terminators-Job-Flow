---
name: Railway production deployment (not Replit)
description: This project's production runs on Railway (deploys from GitHub), not Replit Publishing — schema and deploy verification must account for that.
---

Production for this app is Railway (`sladeandbacardi-byte/Terminators-Job-Flow` on GitHub), not a Replit deployment. Consequences:

- Never use Replit Publishing for this project — pushing to `main` on GitHub is what ships to Railway.
- The Replit sandbox's git remote to GitHub is read-only in practice (fetch/ls-remote work, `git push` hangs/has no write credential) — the user must push via Replit's Git/Version Control pane themselves when a commit needs to reach GitHub/Railway.
- Railway's production database is a separate Postgres instance from the Replit dev DATABASE_URL. Schema drift between dev and Railway prod is real and has happened (a whole table was missing in prod while dev had it).
- Per platform policy, never run `drizzle-kit push`/`npm run db:push` directly against a production connection string from this environment, even if given the credential — the user must run it themselves (Railway CLI/dashboard shell) or trigger a purpose-built in-app admin action.
- To unblock non-technical users who can't use Railway's CLI, a temporary admin-only route+button was added (`POST /api/admin/run-db-push`, `requireAuth`+`requireAdmin`, in `server/routes.ts` / `DbPushSection` in `client/src/pages/data-integrity.tsx`) that runs `npx drizzle-kit push --force` on-demand from inside the running server (so it always uses whatever `DATABASE_URL` that deployment already has). It does not run automatically on startup — remove it once prod schema is confirmed stable, or keep it as a maintained admin utility if the user prefers.
- An attached Railway MCP connection does not guarantee reachable tools or database-query access; verify that callable Railway tools are mounted before treating it as a production inspection path.

**Why:** The integration can report `added` while the provider transport is unavailable, and its generic `DATABASE_URL` reference does not identify the Railway database.

**How to apply:** before trusting "the fix is live," verify against the actual Railway URL (curl/API checks + screenshot), not just Replit's preview — the two environments can be out of sync in both code (unpushed commits) and schema (unmigrated DB).
