// ── DESTRUCTIVE — manual setup/reset tool only ──────────────────────────────
// This script drops and recreates the entire `public` schema, permanently
// deleting ALL data and tables in the database that DATABASE_URL points to.
//
// It is intentionally NOT wired into `dev`, `build`, or `start`. It must
// only ever be run by hand, e.g. when bootstrapping a brand new (or
// partially-broken) database before the first `pnpm run db:push`.
//
// Usage:
//   pnpm run db:reset -- --yes
//
// The `--yes` flag (or CONFIRM_RESET=YES_I_AM_SURE in the environment) is
// required — running `pnpm run db:reset` with no confirmation only prints
// what it WOULD do and exits without touching the database.

import pg from "pg";

const { Pool } = pg;

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("[db:reset] DATABASE_URL is not set. Aborting.");
    process.exit(1);
  }

  const confirmed =
    process.argv.includes("--yes") ||
    process.env.CONFIRM_RESET === "YES_I_AM_SURE";

  let host = "(unknown)";
  try {
    host = new URL(connectionString).hostname;
  } catch {
    // ignore parse errors, host stays "(unknown)"
  }

  console.log("──────────────────────────────────────────────────────────");
  console.log("  DATABASE RESET — DESTRUCTIVE OPERATION");
  console.log("──────────────────────────────────────────────────────────");
  console.log(`  Target host: ${host}`);
  console.log("  This will PERMANENTLY DELETE every table and all data");
  console.log("  in the 'public' schema of the database above.");
  console.log("──────────────────────────────────────────────────────────");

  if (!confirmed) {
    console.log(
      "  Nothing was done. Re-run with `--yes` (e.g. `pnpm run db:reset -- --yes`)\n" +
      "  or set CONFIRM_RESET=YES_I_AM_SURE to actually perform the reset."
    );
    process.exit(0);
  }

  const pool = new Pool({
    connectionString,
    ssl: connectionString.includes("sslmode=require") || process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
  });

  try {
    console.log("[db:reset] Dropping and recreating schema `public`...");
    await pool.query("DROP SCHEMA public CASCADE;");
    await pool.query("CREATE SCHEMA public;");
    await pool.query("GRANT ALL ON SCHEMA public TO public;");
    console.log("[db:reset] Done. The database is now empty.");
    console.log("[db:reset] Next steps: `pnpm run db:push` then `pnpm run db:seed`.");
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error("[db:reset] Failed:", err);
  process.exit(1);
});
