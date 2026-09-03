import assert from "node:assert/strict";
import test from "node:test";
import {
  allowanceFeedback, allowanceForDate, calculateFuelConsumption, consumptionSummary,
  calculateFleetAchievements, johannesburgDay, monthlyCheckStatus,
} from "./fleet-domain";

test("allowance uses Johannesburg calendar days rather than server UTC", () => {
  assert.equal(johannesburgDay("2026-02-27T23:30:00.000Z"), "2026-02-28");
  assert.equal(allowanceForDate("2026-02-27T23:30:00.000Z"), 100);
  assert.equal(allowanceForDate("2026-02-26T12:00:00.000Z"), 50);
  assert.equal(allowanceFeedback("2026-02-28T12:00:00.000Z"), "Weekend allowance: R100.");
});

test("achievements are positive recognitions only", () => {
  const achievements = calculateFleetAchievements({
    now: "2026-02-27T12:00:00Z",
    inspections: [{ inspectionDate: "2026-02-23T12:00:00Z", overallResult: "pass" }],
    kmLogs: [{ logDate: "2026-02-23T12:00:00Z", businessKm: 10 }],
    consumption: [],
  });
  assert.deepEqual(achievements.map(item => item.code), ["checks-submitted", "zero-fault-check", "low-business-km"]);
});

test("monthly checks are due only from the 25th and only once per scoped month", () => {
  assert.equal(monthlyCheckStatus("2026-02-24T12:00:00Z", [], { vehicleId: "v" }).due, false);
  assert.equal(monthlyCheckStatus("2026-02-25T12:00:00Z", [], { vehicleId: "v" }).due, true);
  assert.equal(monthlyCheckStatus("2026-02-25T12:00:00Z", [
    { vehicleId: "v", workerId: "w", date: "2026-02-01T12:00:00Z" },
  ], { vehicleId: "v" }).due, false);
  assert.equal(monthlyCheckStatus("2026-02-25T12:00:00Z", [
    { vehicleId: "v", date: "2026-02-01T12:00:00Z", deletedAt: "2026-02-02T12:00:00Z" },
  ], { vehicleId: "v" }).due, true);
});

test("fuel consumption is consecutive and same-vehicle only", () => {
  const values = calculateFuelConsumption([
    { id: "a", vehicleId: "v1", date: "2026-01-01T10:00:00Z", odometer: 1000, litres: 40 },
    { id: "other", vehicleId: "v2", date: "2026-01-02T10:00:00Z", odometer: 2000, litres: 10 },
    { id: "b", vehicleId: "v1", date: "2026-01-05T10:00:00Z", odometer: 1500, litres: "50" },
    { id: "rollback", vehicleId: "v1", date: "2026-01-06T10:00:00Z", odometer: 1400, litres: 10 },
    { id: "c", vehicleId: "v1", date: "2026-01-07T10:00:00Z", odometer: 1700, litres: 30 },
  ]);
  // A pair is valid when its own adjacent readings increase.  A rejected
  // rollback pair does not cause later legitimate adjacent fill-ups to vanish.
  assert.equal(values.length, 2);
  assert.equal(values[0].previousFillupId, "a");
  assert.equal(values[0].litresPer100Km, 10);
  assert.equal(values[1].previousFillupId, "rollback");
  assert.deepEqual(consumptionSummary(values), { averageLPer100Km: 10, bestLPer100Km: 10, worstLPer100Km: 10 });
});