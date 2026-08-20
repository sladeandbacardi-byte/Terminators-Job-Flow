---
name: Startup provisioning order
description: How to safely provision data that depends on a newly migrated database column.
---

Run data provisioning that writes newly added columns only after the startup migration runner completes, not from `DbStorage.initialize`.

**Why:** The storage singleton is constructed during module loading and its initialization can race ahead of the migration runner. Writing through a newer Drizzle schema before the physical column exists causes a startup-time database error.

**How to apply:** Keep schema creation in startup migrations, then invoke the idempotent provisioning method from the server startup sequence immediately after migrations. The provisioning method must be safe to rerun.