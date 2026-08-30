import assert from "node:assert/strict";
import test from "node:test";
import { getOfficeOrganogramBranch } from "./officeOrganogram";
import { hasUnrestrictedAccess } from "./accessPolicy";

const person = (role: string, department = "Office") => ({ id: role, name: role, role, department });

test("desktop office hierarchy places authoritative roles under their correct branches", () => {
  assert.equal(getOfficeOrganogramBranch(person("Finance & HR Manager")), "Finance / HR");
  assert.equal(getOfficeOrganogramBranch(person("Sales Rep")), "Marketing & Sales");
  assert.equal(getOfficeOrganogramBranch(person("Hygiene Services Manager")), "Administration Team");
  assert.equal(getOfficeOrganogramBranch(person("Pest Control Services Manager")), "Administration Team");
});

test("office role authorization remains independent from organogram placement", () => {
  assert.equal(hasUnrestrictedAccess({ sourceWorkerId: "worker-5", sourceWorkerRole: "Existing Clients Sales & Admin" }), false);
  assert.equal(hasUnrestrictedAccess({ sourceWorkerId: "worker-6", sourceWorkerRole: "Sales Rep" }), false);
});