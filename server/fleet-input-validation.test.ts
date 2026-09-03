import test from "node:test";
import assert from "node:assert/strict";
import { FLEET_INSPECTION_CHECKS } from "@shared/fleet";
import { assertNoOdometerRollback, validateFleetInspectionItems } from "./fleet-input-validation";

test("inspection validation requires an explicit result for every canonical check", () => {
  const complete = FLEET_INSPECTION_CHECKS.map(name => ({ name, result: "pass" }));
  assert.equal(validateFleetInspectionItems(complete).length, FLEET_INSPECTION_CHECKS.length);
  assert.throws(() => validateFleetInspectionItems(complete.slice(1)), /Complete every/);
  assert.throws(() => validateFleetInspectionItems([...complete, complete[0]]), /Complete every/);
  assert.throws(() => validateFleetInspectionItems(complete.map((item, index) => index ? item : { ...item, result: "" })), /Complete every/);
});

test("inspection results can be derived only from validated item results", () => {
  const complete = FLEET_INSPECTION_CHECKS.map(name => ({ name, result: "pass" }));
  const failed = validateFleetInspectionItems(complete.map((item, index) =>
    index === 0 ? { ...item, result: "fail" } : item));
  assert.equal(failed.some(item => item.result === "fail"), true);
});

test("odometer rollback flags are rejected before persistence", () => {
  assert.doesNotThrow(() => assertNoOdometerRollback(["MISSING_PREVIOUS_PM"]));
  assert.throws(() => assertNoOdometerRollback(["BUSINESS_ODOMETER_ROLLBACK"]), /Afternoon odometer/);
  assert.throws(() => assertNoOdometerRollback(["PRIVATE_ODOMETER_ROLLBACK"]), /Morning odometer/);
});
