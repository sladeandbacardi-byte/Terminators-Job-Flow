import assert from "node:assert/strict";
import test from "node:test";
import bcrypt from "bcryptjs";
import type { AdminUser, Worker } from "@shared/schema";
import {
  buildOfficeLoginDirectory,
  isEligibleOfficeWorker,
  isPasswordlessMobileWorker,
  isPasswordlessOfficeWorker,
  passwordHashNeedsReconciliation,
  normalizeDeploymentSecret,
  isSolePasswordAdministrator,
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

test("deployment secret normalization preserves a leading hash and removes only one matching outer quote pair", async () => {
  const variants = [' #release-password', '  "#release-password"  ', "  '#release-password'  "];
  for (const variant of variants) {
    assert.equal(normalizeDeploymentSecret(variant), "#release-password");
    const storedHash = await bcrypt.hash("#release-password", 4);
    assert.equal(await passwordHashNeedsReconciliation(normalizeDeploymentSecret(variant), storedHash), false);
  }
  assert.equal(normalizeDeploymentSecret('"#release-password\''), '"#release-password\'');
  assert.equal(normalizeDeploymentSecret('##release-password'), '##release-password');
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

test("only Julien's canonical administrator record is eligible for password authentication", () => {
  assert.equal(isSolePasswordAdministrator(admin("worker-1", "Julien Botha", "admin")), true);
  assert.equal(isSolePasswordAdministrator(admin("legacy-julien", "Julien Botha", "admin")), true);
  assert.equal(isSolePasswordAdministrator(admin("worker-1", "Another Person", "admin")), false);
  assert.equal(isSolePasswordAdministrator(admin("worker-2", "Juli Holtshausen", "juli")), false);
  assert.equal(isSolePasswordAdministrator({ ...admin("worker-1", "Julien Botha", "admin"), isActive: false }), false);
});

test("office selector gives canonical non-Julien workers passwordless access without inventing credentials", () => {
  const workers = [
    worker("worker-1", "Julien Botha", "Operations Manager"),
    worker("worker-2", "Maryka Venter", "Pest Control Services Manager"),
    worker("worker-3", "Mariette Koekemoer", "Hygiene Services Manager"),
    worker("worker-4", "Juli Holtshausen", "Finance & HR Manager"),
    worker("worker-5", "Sheryl-Lyn Lee", "Existing Clients Sales & Admin"),
    worker("worker-6", "Anzel Marais", "Sales Rep"),
    worker("tech-1", "Field Tech", "Technician"),
    worker("generic-admin", "Administrator", "Admin"),
  ];
  const directory = buildOfficeLoginDirectory(
    workers,
    [
      admin("worker-1", "Julien Botha", "admin"),
      admin("worker-5", "Sheryl-Lyn Lee", "sales"),
      admin("legacy", "Administrator", "administrator"),
    ],
    new Map([["office", "Office"]]),
  );
  assert.deepEqual(directory.map(entry => entry.name), [
    "Anzel Marais", "Juli Holtshausen", "Julien Botha", "Mariette Koekemoer", "Maryka Venter", "Sheryl-Lyn Lee",
  ]);
  assert.equal(directory.find(entry => entry.name === "Julien Botha")?.authMethod, "password");
  assert.equal(directory.find(entry => entry.name === "Sheryl-Lyn Lee")?.authMethod, "passwordless");
  assert.equal(directory.find(entry => entry.name === "Juli Holtshausen")?.authMethod, "passwordless");
  assert.equal(directory.find(entry => entry.name === "Juli Holtshausen")?.username, undefined);
  assert.equal(directory.some(entry => entry.name === "Field Tech"), false);
  assert.equal(directory.some(entry => entry.name === "Administrator"), false);
});

test("passwordless office eligibility rejects Julien, inactive, mobile, generic Administrator and field-only workers", () => {
  assert.equal(isPasswordlessOfficeWorker(worker("worker-5", "Sales Person", "Sales Consultant")), true);
  assert.equal(isPasswordlessOfficeWorker(worker("worker-1", "Julien Botha", "Operations Manager")), false);
  assert.equal(isPasswordlessOfficeWorker({ ...worker("inactive", "Inactive", "Sales"), isActive: false }), false);
  assert.equal(isPasswordlessOfficeWorker({ ...worker("mobile", "Mobile", "Sales"), mobileAccessEnabled: true }), false);
  assert.equal(isPasswordlessOfficeWorker(worker("generic", "Someone", "Administrator")), false);
  assert.equal(isPasswordlessOfficeWorker(worker("worker-6", "Anzel Marais", "Sales Rep")), true);
  assert.equal(isPasswordlessOfficeWorker(worker("worker-23", "Field Tech", "Technician")), false);
  assert.equal(isPasswordlessOfficeWorker(worker("tech", "Field Tech", "Technician")), false);
});

test("each of the nine named field profiles is eligible only for passwordless mobile selection", () => {
  const mobileProfiles = [
    ["mobile-tech-01", "Re-Althon"], ["mobile-tech-04", "Jackie Roelfse"],
    ["mobile-tech-06", "Zain Abdol"], ["mobile-tech-10", "Zuki Sandi"],
    ["mobile-tech-09", "Reece Ebrahim"], ["mobile-tech-03", "Garth du Preez"],
    ["mobile-tech-07", "Michael Meyer"], ["mobile-tech-08", "Xolani Ndzotoyi"],
    ["mobile-tech-02", "Leon Coltman"],
  ] as const;

  for (const [id, name] of mobileProfiles) {
    const profile = worker(id, name, "Technician");
    assert.equal(isPasswordlessMobileWorker({ ...profile, mobileAccessEnabled: true }), true, name);
    assert.equal(isPasswordlessOfficeWorker({ ...profile, mobileAccessEnabled: true }), false, name);
  }
});

test("mobile profile selection rejects every office profile and disabled or non-technician workers", () => {
  assert.equal(isPasswordlessMobileWorker({ ...worker("mobile-tech-01", "Re-Althon", "Technician"), mobileAccessEnabled: false }), false);
  assert.equal(isPasswordlessMobileWorker({ ...worker("mobile-tech-01", "Re-Althon", "Supervisor"), mobileAccessEnabled: true }), false);
  assert.equal(isPasswordlessMobileWorker({ ...worker("mobile-tech-01", "Re-Althon", "Technician"), mobileAccessEnabled: true, isActive: false }), false);
  for (const id of ["worker-1", "worker-2", "worker-3", "worker-4", "worker-5", "worker-6"]) {
    assert.equal(isPasswordlessMobileWorker({ ...worker(id, "Office User", "Technician"), mobileAccessEnabled: true }), false, id);
  }
});

test("desktop office directory contains each of the six canonical admin organogram people exactly once", () => {
  const names = [
    "Julien Botha", "Juli Holtshausen", "Mariette Koekemoer",
    "Maryka Venter", "Anzel Marais", "Sheryl-Lyn Lee",
  ];
  const workers = names.map((name, index) =>
    worker(`worker-${index + 1}`, name, index === 0 ? "Operations Manager" : index === 9 ? "Sanitary Bin B Team Supervisor" : index === 18 ? "Pest Control Operator" : index === 22 ? "Pest Control Assistant" : "Office User"),
  );
  const directory = buildOfficeLoginDirectory(workers, [admin("worker-1", "Julien Botha", "admin")], new Map([
    ["div-6", "Admin"], ["div-7", "Accounts"], ["div-5", "Sales"], ["div-1", "Pest Control"],
  ]));
  assert.deepEqual(directory.map(entry => entry.name).sort(), names.slice().sort());
  assert.equal(new Set(directory.map(entry => entry.name)).size, 6);
  assert.equal(directory.find(entry => entry.name === "Julien Botha")?.authMethod, "password");
  assert.equal(directory.filter(entry => entry.authMethod === "passwordless").length, 5);
  for (const name of names) {
    const entry = directory.find(candidate => candidate.name === name);
    assert.ok(entry, `${name} must have an office selection`);
    assert.equal(entry.authMethod, name === "Julien Botha" ? "password" : "passwordless", name);
  }
});

test("office role eligibility does not make generic technicians office accounts", () => {
  assert.equal(isEligibleOfficeWorker(worker("a", "A", "Existing Clients Sales & Admin")), true);
  assert.equal(isEligibleOfficeWorker(worker("b", "B", "Service Coordinator")), true);
  assert.equal(isEligibleOfficeWorker(worker("c", "C", "Finance Manager")), true);
  assert.equal(isEligibleOfficeWorker(worker("d", "D", "Pest Control Operator")), true);
  assert.equal(isEligibleOfficeWorker(worker("e", "E", "Technician")), false);
});