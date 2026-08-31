import assert from "node:assert/strict";
import test from "node:test";
import { calculateFleetOdometerLogs } from "./fleet-odometer-calculation";

const log = (id: string, vehicleId: string, workerId: string, day: string, am?: number, pm?: number) => ({
  id, vehicleId, workerId, logDate: `${day}T00:00:00Z`,
  startOdometer: am ?? 0, endOdometer: pm ?? am ?? 0,
  totalKm: 0, businessKm: 0, privateKm: 0,
  notes: JSON.stringify({ source: "FleetGuard", snapshots: [
    ...(am === undefined ? [] : [{ type: "AM", odometer: am, timestamp: `${day}T06:00:00Z` }]),
    ...(pm === undefined ? [] : [{ type: "PM", odometer: pm, timestamp: `${day}T16:00:00Z` }]),
  ] }),
});

test("uses preceding same-vehicle PM and same-day AM/PM across consecutive days", () => {
  const rows = calculateFleetOdometerLogs([log("a","v1","d1","2026-08-27",311671,311747), log("b","v1","d1","2026-08-28",311827,311900)]);
  assert.equal(rows[1].privateKm, 80);
  assert.equal(rows[1].businessKm, 73);
  assert.equal(rows[1].odometerCalculation.previousPmOdometer, 311747);
});

test("uses the most recent earlier PM across weekends and driver changes", () => {
  const rows = calculateFleetOdometerLogs([log("fri","v1","d1","2026-08-28",100,150), log("mon","v1","d2","2026-08-31",170,220)]);
  assert.equal(rows[1].privateKm, 20);
  assert.equal(rows[1].odometerCalculation.previousPmDate, "2026-08-28T16:00:00Z");
});

test("never uses another vehicle's PM", () => {
  const rows = calculateFleetOdometerLogs([log("other","v2","d1","2026-08-30",900,950), log("current","v1","d1","2026-08-31",1000,1050)]);
  assert.equal(rows[1].privateKm, null);
  assert.ok(rows[1].odometerCalculation.flags.includes("MISSING_PREVIOUS_PM"));
});

test("flags missing PM, duplicate readings and rollback instead of inventing distance", () => {
  const missing = calculateFleetOdometerLogs([log("prior","v1","d1","2026-08-30",100,150), log("current","v1","d1","2026-08-31",170)])[1];
  assert.equal(missing.businessKm, null);
  assert.ok(missing.odometerCalculation.flags.includes("MISSING_PM"));
  const duplicate = log("dup","v1","d1","2026-09-01",200,250);
  duplicate.notes = JSON.stringify({ snapshots: [
    {type:"AM",odometer:200,timestamp:"2026-09-01T06:00:00Z"},
    {type:"AM",odometer:201,timestamp:"2026-09-01T06:01:00Z"},
    {type:"PM",odometer:250,timestamp:"2026-09-01T16:00:00Z"},
  ]});
  assert.ok(calculateFleetOdometerLogs([duplicate])[0].odometerCalculation.flags.includes("DUPLICATE_AM"));
  const rollback = calculateFleetOdometerLogs([log("p","v1","d1","2026-09-01",300,350),log("r","v1","d1","2026-09-02",340,330)])[1];
  assert.equal(rollback.privateKm, null);
  assert.equal(rollback.businessKm, null);
  assert.ok(rollback.odometerCalculation.flags.includes("PRIVATE_ODOMETER_ROLLBACK"));
  assert.ok(rollback.odometerCalculation.flags.includes("BUSINESS_ODOMETER_ROLLBACK"));
});

test("does not use a PM from an invalid prior record", () => {
  const badPrior = log("bad","v1","d1","2026-09-01",500,450);
  const current = log("current","v1","d1","2026-09-02",520,550);
  const result = calculateFleetOdometerLogs([badPrior, current])[1];
  assert.equal(result.privateKm, null);
  assert.ok(result.odometerCalculation.flags.includes("MISSING_PREVIOUS_PM"));
});

test("manual backdated logs keep AM and PM on their declared date", () => {
  const rows = calculateFleetOdometerLogs([
    { ...log("prior","v1","d1","2026-08-28",100,150), notes: "manual" },
    { ...log("backdated","v1","d2","2026-08-31",170,220), notes: "manual", createdAt: "2026-09-05T12:00:00Z" },
  ]);
  assert.equal(rows[1].privateKm, 20);
  assert.equal(rows[1].businessKm, 50);
  assert.equal(rows[1].odometerCalculation.pmDate, "2026-08-31T16:00:00.000Z");
});

test("duplicate prior PM readings are not selected as a private-km anchor", () => {
  const a = log("a","v1","d1","2026-08-30",100,150);
  const b = log("b","v1","d2","2026-08-30",110,160);
  const current = log("current","v1","d3","2026-08-31",180,210);
  const result = calculateFleetOdometerLogs([a,b,current])[2];
  assert.equal(result.privateKm, null);
  assert.ok(result.odometerCalculation.flags.includes("DUPLICATE_PREVIOUS_PM"));
});

test("a PM timestamped before its own AM cannot anchor a later day", () => {
  const malformed = log("malformed","v1","d1","2026-08-30",100,150);
  malformed.notes = JSON.stringify({ snapshots: [
    {type:"PM",odometer:150,timestamp:"2026-08-30T05:00:00Z"},
    {type:"AM",odometer:100,timestamp:"2026-08-30T06:00:00Z"},
  ]});
  const current = log("current","v1","d2","2026-08-31",180,220);
  const result = calculateFleetOdometerLogs([malformed,current])[1];
  assert.equal(result.privateKm, null);
  assert.ok(result.odometerCalculation.flags.includes("MISSING_PREVIOUS_PM"));
});