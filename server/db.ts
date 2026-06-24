import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

if (connectionString.startsWith("wss://") || connectionString.startsWith("ws://")) {
  throw new Error(
    `Invalid DATABASE_URL: expected postgres:// or postgresql://, ` +
    `received ${connectionString.split("/")[0]}//... ` +
    `Set DATABASE_URL to the standard Postgres connection string in Railway service variables.`
  );
}

export const pool = new Pool({
  connectionString,
  ssl: connectionString.includes("sslmode=require") || process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false,
});

export const db = drizzle(pool, { schema });
