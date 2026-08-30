// ── Manual production/setup seed — safe to run multiple times ──────────────
// Seeds the minimum default data a fresh database needs to be usable:
//   - Legal entities (issuing entities for quotes/invoices)
//   - Departments
//   - A handful of default/demo login users covering each dashboard role
//
// This is intentionally NOT wired into `dev`, `build`, or `start` — it is a
// manual command (`pnpm run db:seed`) run after `pnpm run db:push`.
//
// Idempotent: every insert checks for an existing row first (or uses
// ON CONFLICT DO NOTHING keyed on a fixed id), so running this against a
// database that already has data is a safe no-op for anything that exists.

import { eq } from "drizzle-orm";
import { db, pool } from "./db";
import { legalEntities, departments, workers } from "@shared/schema";

async function seedLegalEntities() {
  const existing = await db.select({ id: legalEntities.id }).from(legalEntities).limit(1);
  if (existing.length > 0) {
    console.log("[seed] Legal entities already present — skipping.");
    return;
  }
  const rows = [
    { id: "terminators_cc", name: "Terminators CC", isActive: true, isDefault: true },
    { id: "terminators_pty_ltd", name: "Terminators Pty Ltd", isActive: true, isDefault: false },
  ];
  for (const row of rows) {
    await db.insert(legalEntities).values(row).onConflictDoNothing();
  }
  console.log(`[seed] Seeded ${rows.length} legal entities.`);
}

async function seedDepartments() {
  const rows = [
    { id: "div-1", name: "Pest Control",  colorCode: "#22c55e", description: "Pest control and extermination services" },
    { id: "div-2", name: "Sanitary Bins", colorCode: "#8b5cf6", description: "Sanitary waste collection and disposal services" },
    { id: "div-3", name: "Washroom",      colorCode: "#3b82f6", description: "Washroom maintenance and hygiene services" },
    { id: "div-4", name: "Deep Cleaning", colorCode: "#f59e0b", description: "Deep cleaning and specialized cleaning services" },
    { id: "div-5", name: "Sales",         colorCode: "#ec4899", description: "Sales and customer service administration" },
    { id: "div-6", name: "Operations",    colorCode: "#6366f1", description: "Operations management" },
    { id: "div-7", name: "Finance",       colorCode: "#eab308", description: "Finance, billing and accounts" },
    { id: "div-8", name: "Admin",         colorCode: "#64748b", description: "General administration" },
  ];
  let inserted = 0;
  for (const row of rows) {
    const existing = await db.select({ id: departments.id }).from(departments).where(eq(departments.id, row.id)).limit(1);
    if (existing.length > 0) continue;
    await db.insert(departments).values(row).onConflictDoNothing();
    inserted++;
  }
  console.log(`[seed] Departments: ${inserted} inserted, ${rows.length - inserted} already present.`);
}

async function seedDefaultUsers() {
  // IDs match the login screen's HARDCODED_STAFF allowlist in server/routes.ts
  // (worker-1..worker-6) so these accounts show up in the profile picker.
  const rows = [
    { id: "worker-1", name: "Julien Botha", email: "managing.member@terminators.local", phone: "+27 00 000 0001", departmentId: "div-6", role: "Operations Manager" },
    { id: "worker-2", name: "Sales Rep",       email: "sales.rep@terminators.local",        phone: "+27 00 000 0002", departmentId: "div-5", role: "Sales Rep" },
    { id: "worker-3", name: "Service Manager", email: "service.manager@terminators.local",  phone: "+27 00 000 0003", departmentId: "div-6", role: "Service Manager" },
    { id: "worker-4", name: "Finance User",    email: "finance.user@terminators.local",     phone: "+27 00 000 0004", departmentId: "div-7", role: "Finance User" },
    { id: "worker-5", name: "Technician",      email: "technician@terminators.local",       phone: "+27 00 000 0005", departmentId: "div-1", role: "Technician" },
    { id: "worker-6", name: "Admin",           email: "admin@terminators.local",            phone: "+27 00 000 0006", departmentId: "div-8", role: "Admin" },
  ];
  let inserted = 0;
  for (const row of rows) {
    const existing = await db.select({ id: workers.id }).from(workers).where(eq(workers.id, row.id)).limit(1);
    if (existing.length > 0) continue;
    await db.insert(workers).values({ ...row, isActive: true }).onConflictDoNothing();
    inserted++;
  }
  console.log(`[seed] Default users: ${inserted} inserted, ${rows.length - inserted} already present.`);
}

async function main() {
  console.log("[seed] Starting seed...");
  await seedLegalEntities();
  await seedDepartments();
  await seedDefaultUsers();
  console.log("[seed] Done.");
}

main()
  .then(() => pool.end())
  .catch(err => {
    console.error("[seed] Failed:", err);
    pool.end().finally(() => process.exit(1));
  });
