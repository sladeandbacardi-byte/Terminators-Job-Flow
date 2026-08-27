---
name: Post-merge package manager
description: The package-manager requirement for reliable automatic setup after task merges.
---

Automatic post-merge setup must use the package manager declared by the repository, including its lockfile and non-interactive install mode. In this project that is pnpm; npm cannot resolve the workspace-style dependencies and fails with `EUNSUPPORTEDPROTOCOL` for `workspace:*`.

**Why:** A merged task previously triggered the setup script with `npm install`, which failed before database setup and caused the automatic post-merge process to time out.

**How to apply:** Keep the post-merge script on `pnpm install --frozen-lockfile` followed by the existing schema setup command, and give dependency installation a bounded timeout with enough buffer for a clean environment.