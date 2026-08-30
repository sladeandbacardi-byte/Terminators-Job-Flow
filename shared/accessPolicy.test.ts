import assert from "node:assert/strict";
import test from "node:test";
import { getDashboardRole } from "./dashboardRole";
import { hasUnrestrictedAccess, roleQualifiesForUnrestrictedAccess } from "./accessPolicy";
import {
  NAMED_STAFF_ACCESS_PROFILES,
  canAccessOfficeApi,
  canAccessUiPath,
  canExpandMobileTeamJobs,
  filterOperationalPayload,
  getStaffAccessProfile,
  hasPermission,
} from "./permissionMatrix";

const identity = (workerId: string) => ({
  id: workerId,
  sourceWorkerId: workerId,
  sourceWorkerName: getStaffAccessProfile({ id: workerId })?.name,
  sourceWorkerRole: getStaffAccessProfile({ id: workerId })?.jobTitle,
  authenticationMethod: "passwordless_office",
});

test("Julien alone has unrestricted access regardless of generic role words", () => {
  assert.equal(hasUnrestrictedAccess(identity("worker-1")), true);
  for (const workerId of ["worker-2", "worker-3", "worker-4", "worker-5", "worker-6", "mobile-tech-01", "mobile-tech-09"]) {
    assert.equal(hasUnrestrictedAccess(identity(workerId)), false, workerId);
  }
  for (const role of ["Admin", "Supervisor", "Pest Control Operator", "PCO", "Manager", "Technician"]) {
    assert.equal(roleQualifiesForUnrestrictedAccess(role), false, role);
  }
});

test("named department managers are peers with operational scope and explicit finance denials", () => {
  const maryka = identity("worker-2");
  const mariette = identity("worker-3");
  assert.deepEqual(getStaffAccessProfile(maryka)?.departmentIds, ["div-1"]);
  assert.deepEqual(getStaffAccessProfile(mariette)?.departmentIds, ["div-2", "div-3", "div-4"]);
  for (const manager of [maryka, mariette]) {
    assert.equal(hasPermission(manager, "jobs"), true);
    assert.equal(hasPermission(manager, "calendar"), true);
    assert.equal(hasPermission(manager, "time:manage"), true);
    assert.equal(hasPermission(manager, "finance"), false);
    assert.equal(hasPermission(manager, "fleet"), false);
    assert.equal(hasPermission(manager, "company-profit"), false);
    assert.equal(hasPermission(manager, "growth-capital"), false);
    assert.equal(hasPermission(manager, "system-admin"), false);
    assert.equal(canAccessUiPath(manager, "/finance-dashboard"), false);
    assert.equal(canAccessOfficeApi(manager, "GET", "/api/dashboard/revenue-chart"), false);
    assert.equal(canAccessOfficeApi(manager, "GET", "/api/invoices"), false);
    assert.equal(canAccessOfficeApi(manager, "GET", "/api/jobs"), true);
  }
  assert.equal(hasPermission(maryka, "treatment-reports"), true);
  assert.equal(hasPermission(mariette, "treatment-reports"), false);
});

test("Juli receives Finance and HR access while Sales staff receive customer access only", () => {
  const juli = identity("worker-4");
  assert.equal(hasPermission(juli, "finance"), true);
  assert.equal(hasPermission(juli, "hr"), true);
  assert.equal(hasPermission(juli, "system-admin"), false);
  assert.equal(hasPermission(juli, "growth-capital"), false);
  for (const workerId of ["worker-5", "worker-6"]) {
    const salesperson = identity(workerId);
    assert.equal(hasPermission(salesperson, "sales"), true);
    assert.equal(hasPermission(salesperson, "clients:manage"), true);
    assert.equal(hasPermission(salesperson, "finance"), false);
    assert.equal(hasPermission(salesperson, "company-profit"), false);
    assert.equal(hasPermission(salesperson, "system-admin"), false);
  }
});

test("every named supervisor, PCO and assistant is limited to field work", () => {
  const supervisors = ["mobile-tech-01", "mobile-tech-04", "mobile-tech-06", "mobile-tech-10"];
  const pcos = ["mobile-tech-09", "mobile-tech-03", "mobile-tech-07", "mobile-tech-08"];
  const assistants = ["mobile-tech-02"];
  for (const workerId of [...supervisors, ...pcos, ...assistants]) {
    const person = identity(workerId);
    assert.equal(hasPermission(person, "jobs"), true, workerId);
    assert.equal(hasPermission(person, "time:self"), true, workerId);
    assert.equal(getStaffAccessProfile(person)?.ownWorkOnly, true, workerId);
    for (const denied of ["finance", "company-profit", "growth-capital", "system-admin", "time:manage"] as const) {
      assert.equal(hasPermission(person, denied), false, `${workerId} ${denied}`);
    }
  }
  for (const workerId of supervisors) assert.equal(hasPermission(identity(workerId), "teams"), true, workerId);
  for (const workerId of [...pcos, ...assistants]) assert.equal(hasPermission(identity(workerId), "teams"), false, workerId);
  assert.equal(getStaffAccessProfile(identity("mobile-tech-02"))?.jobTitle, "Pest Control Assistant");
});

test("all required named people have a complete explicit profile", () => {
  assert.equal(NAMED_STAFF_ACCESS_PROFILES.length, 15);
  for (const profile of NAMED_STAFF_ACCESS_PROFILES) {
    assert.ok(profile.name);
    assert.ok(profile.jobTitle);
    assert.ok(profile.team);
    assert.ok(profile.permissions.length > 0);
  }
});

test("dashboard role compatibility no longer promotes title substrings to admin", () => {
  assert.equal(getDashboardRole({ id: "worker-1", role: "Operations Manager" }), "admin");
  assert.equal(getDashboardRole({ id: "worker-5", role: "Existing Clients Sales & Admin", departmentId: "div-5" }), "sales");
  assert.equal(getDashboardRole({ id: "worker-8", role: "Pest Control Operator", departmentId: "div-1" }), "service");
  assert.equal(getDashboardRole({ id: "worker-3", role: "Hygiene Services Manager", departmentId: "div-6" }), "manager");
});

test("unclassified direct routes and APIs fail closed for non-owner users", () => {
  const manager = identity("worker-3");
  assert.equal(canAccessUiPath(manager, "/future-sensitive-page"), false);
  assert.equal(canAccessOfficeApi(manager, "GET", "/api/future-sensitive-module"), false);
  assert.equal(canAccessOfficeApi(identity("worker-1"), "GET", "/api/future-sensitive-module"), true);
});

test("manager API collections are filtered to assigned departments and workers", () => {
  const mariette = identity("worker-3");
  const filtered = filterOperationalPayload(mariette, {
    jobs: [
      { id: "bin", departmentId: "div-2" },
      { id: "pest", departmentId: "div-1" },
    ],
    entries: [
      { id: "zain", employeeId: "worker-12" },
      { id: "reece", employeeId: "worker-8" },
    ],
  });
  assert.deepEqual(filtered, {
    jobs: [{ id: "bin", departmentId: "div-2" }],
    entries: [{ id: "zain", employeeId: "worker-12" }],
  });
});

test("only the four named supervisors may expand mobile work to their team", () => {
  for (const workerId of ["mobile-tech-01", "mobile-tech-04", "mobile-tech-06", "mobile-tech-10"]) {
    assert.equal(canExpandMobileTeamJobs(workerId), true, workerId);
  }
  for (const workerId of ["mobile-tech-09", "mobile-tech-03", "mobile-tech-07", "mobile-tech-08", "mobile-tech-02"]) {
    assert.equal(canExpandMobileTeamJobs(workerId), false, workerId);
  }
});