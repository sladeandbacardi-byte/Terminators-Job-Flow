import assert from "node:assert/strict";
import test from "node:test";
import { getDashboardRole } from "./dashboardRole";
import { hasUnrestrictedAccess, roleQualifiesForUnrestrictedAccess } from "./accessPolicy";
import { getOfficeApiAllowedRoles } from "./officeApiPolicy";

const unrestrictedWorkers = [
  ["Sheryl-Lyn Lee", "Existing Clients Sales & Admin"],
  ["Jackie Roelfse", "Sanitary Bin B Team Supervisor"],
  ["Re-Althon", "Sanitary Bin A Team Supervisor"],
  ["Zain Abdol", "Washroom Supervisor"],
  ["Zuki Sandi", "Ablution Deep Cleaning Supervisor"],
  ["Reece Ebrahim", "Pest Control Operator"],
  ["Garth du Preez", "Pest Control Operator"],
  ["Michael Meyer", "Pest Control Operator"],
  ["Xolani Ndzotoyi", "Pest Control Operator"],
] as const;

test("authoritative Admin, Supervisor, and PCO roles receive unrestricted access", () => {
  for (const [name, role] of unrestrictedWorkers) {
    assert.equal(roleQualifiesForUnrestrictedAccess(role), true, `${name} should qualify`);
    assert.equal(getDashboardRole({ name, role, departmentId: "div-1" }), "admin");
  }
});

test("Julien qualifies by canonical identity, not the generic Manager title", () => {
  assert.equal(hasUnrestrictedAccess({ id: "worker-1", name: "Julien Botha", role: "Operations Manager" }), true);
  assert.equal(hasUnrestrictedAccess({ sourceWorkerId: "worker-1", name: "Julien Botha", role: "superadmin", authenticationMethod: "password" }), true);
  assert.equal(hasUnrestrictedAccess({ name: "Julien Botha", role: "Operations Manager" }), false);
  assert.equal(hasUnrestrictedAccess({ name: "Another Person", role: "Operations Manager" }), false);
});

test("generic Manager and Technician roles remain restricted", () => {
  assert.equal(roleQualifiesForUnrestrictedAccess("Manager"), false);
  assert.equal(roleQualifiesForUnrestrictedAccess("Technician"), false);
  assert.equal(getDashboardRole({ name: "Service Manager", role: "Manager", departmentId: "div-6" }), "manager");
  assert.equal(getDashboardRole({ name: "Field Worker", role: "Technician", departmentId: "div-1" }), "service");
});

test("generic credential roles cannot override a linked worker's organogram role", () => {
  assert.equal(hasUnrestrictedAccess({
    firstName: "Ordinary",
    lastName: "Manager",
    role: "admin",
    sourceWorkerRole: "Finance Manager",
    authenticationMethod: "password",
  }), false);
  assert.equal(hasUnrestrictedAccess({
    firstName: "Team",
    lastName: "Supervisor",
    role: "admin",
    sourceWorkerRole: "Washroom Supervisor",
    authenticationMethod: "password",
  }), true);
});

test("client finance and mutation APIs enforce their module tiers", () => {
  assert.deepEqual(getOfficeApiAllowedRoles("GET", "/api/clients/client-1"), ["admin", "manager", "sales", "service", "accounts", "coordinator"]);
  assert.deepEqual(getOfficeApiAllowedRoles("POST", "/api/clients"), ["admin", "manager", "sales"]);
  assert.deepEqual(getOfficeApiAllowedRoles("POST", "/api/clients/client-1/payments"), ["admin", "manager", "accounts"]);
  assert.deepEqual(getOfficeApiAllowedRoles("GET", "/api/clients/client-1/financial-summary"), ["admin", "manager", "accounts"]);
  assert.equal(getOfficeApiAllowedRoles("POST", "/api/clients/client-1/payments").includes("service"), false);
  assert.equal(getOfficeApiAllowedRoles("POST", "/api/clients/client-1/payments").includes("sales"), false);
});

test("unclassified office APIs fail closed to unrestricted users", () => {
  assert.deepEqual(getOfficeApiAllowedRoles("GET", "/api/future-sensitive-module"), ["admin"]);
});