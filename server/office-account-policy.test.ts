import assert from "node:assert/strict";
import test from "node:test";
import bcrypt from "bcryptjs";
import type { AdminUser, Worker } from "@shared/schema";
import {
  buildOfficeLoginDirectory,
  isEligibleOfficeWorker,
  passwordHashNeedsReconciliation,
  selectCanonicalSuperAdminTarget,
} from "./office-account-policy";

const worker = (id: string, name: string, role: string, departmentId = "office"): Worker => ({
  id, name, role, departmentId, email: `${id}@example.test`, phone: null,
  isActive: true, userType: "staff", mobileAccessEnabled: false, createdAt: new Date(),
} as Worker);

const admin = (id: string, name: string, username: string, email = `${id}@example.test`): AdminUser => {
  const [firstName, ...rest] = name.split(" ");
  return {
    id, username, email, passwordHash: "not-returned-by-directory",
    firstName, lastName: rest.join(" "), role: id === "worker-1" ? "superadmin" : "admin",
    isActive: true, lastLoginAt: null, createdAt: new Date(), updatedAt: new Date(),
  };
};

test("password reconciliation detects a changed deployment secret without exposing either value", async () => {
  const storedHash = await bcrypt.hash("previous-secret", 4);
  assert.equal(await passwordHashNeedsReconciliation("previous-secret", storedHash), false);
  assert.equal(await passwordHashNeedsReconciliation("replacement-secret", storedHash), true);
});

test("startup reconciliation never repurposes an unrelated account that owns the configured username", () => {
  const unrelated = admin("other-id", "Another Person", "admin");
  const legacyJulien = admin("legacy-id", "Julien Botha", "admin");
  assert.equal(selectCanonicalSuperAdminTarget([unrelated], "admin"), undefined);
  assert.equal(selectCanonicalSuperAdminTarget([unrelated, legacyJulien], "admin")?.id, "legacy-id");
  assert.equal(
    selectCanonicalSuperAdminTarget([admin("worker-1", "Old Display", "old-admin")], "admin")?.id,
    "worker-1",
  );
});

test("office selector includes eligible roles and marks missing credentials without inventing them", () => {
  const workers = [
    worker("worker-1", "Julien Botha", "Operations Manager"),
    worker("sales-1", "Sales Person", "Sales Consultant"),
    worker("service-1", "Service Person", "Service Manager"),
    worker("finance-1", "Finance Person", "Finance & HR Manager"),
    worker("supervisor-1", "Team Lead", "Washroom Supervisor"),
    worker("pco-1", "Pest Operator", "Pest Control Operator"),
    worker("tech-1", "Field Tech", "Technician"),
    worker("generic-admin", "Administrator", "Admin"),
  ];
  const directory = buildOfficeLoginDirectory(
    workers,
    [
      admin("worker-1", "Julien Botha", "admin"),
      admin("sales-1", "Sales Person", "sales"),
      admin("legacy", "Administrator", "administrator"),
    ],
    new Map([["office", "Office"]]),
  );
  assert.deepEqual(directory.map(entry => entry.name), [
    "Finance Person", "Julien Botha", "Pest Operator", "Sales Person", "Service Person", "Team Lead",
  ]);
  assert.equal(directory.find(entry => entry.name === "Sales Person")?.credentialStatus, "ready");
  assert.equal(directory.find(entry => entry.name === "Finance Person")?.credentialStatus, "missing");
  assert.equal(directory.some(entry => entry.name === "Field Tech"), false);
  assert.equal(directory.some(entry => entry.name === "Administrator"), false);
});

test("office role eligibility does not make generic technicians office accounts", () => {
  assert.equal(isEligibleOfficeWorker(worker("a", "A", "Existing Clients Sales & Admin")), true);
  assert.equal(isEligibleOfficeWorker(worker("b", "B", "Service Coordinator")), true);
  assert.equal(isEligibleOfficeWorker(worker("c", "C", "Finance Manager")), true);
  assert.equal(isEligibleOfficeWorker(worker("d", "D", "Pest Control Operator")), true);
  assert.equal(isEligibleOfficeWorker(worker("e", "E", "Technician")), false);
});