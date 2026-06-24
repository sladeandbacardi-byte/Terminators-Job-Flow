import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is missing. Set it to a postgres:// or postgresql:// connection string.");
}

if (
  !connectionString.startsWith("postgres://") &&
  !connectionString.startsWith("postgresql://")
) {
  throw new Error(
    `Invalid DATABASE_URL. Expected postgres:// or postgresql://, received ${connectionString.slice(0, 10)}...`
  );
}

// Safe startup diagnostics — never prints password or full URL
try {
  const parsed = new URL(connectionString);
  console.log(`[db] Database URL protocol: ${parsed.protocol.replace(":", "")}`);
  console.log(`[db] Database URL host:     ${parsed.hostname}`);
} catch {
  console.log("[db] Database URL: present (could not parse host)");
}
console.log("[db] Database URL validation: passed");

export const pool = new Pool({
  connectionString,
  ssl: connectionString.includes("sslmode=require") || process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false,
});

export const db = drizzle(pool, { schema });
