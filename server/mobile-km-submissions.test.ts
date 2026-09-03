import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "crypto";
import { pool } from "./db";
import { mergeMobileSnapshot, mobileSnapshotRows, submitMobileKmSnapshot } from "./mobile-km-submissions";

const fixtureWorkers: string[] = [];
after(async () => {
  if (!fixtureWorkers.length) return;
  await pool.query(`DELETE FROM fleet_km_submission_receipts WHERE worker_id = ANY($1::text[])`, [fixtureWorkers]);
  await pool.query(`DELETE FROM km_logs WHERE worker_id = ANY($1::text[])`, [fixtureWorkers]);
});

test("legacy same-day AM and PM rows are not mistaken for a mobile aggregate", () => {
  assert.deepEqual(
    mobileSnapshotRows([
      { id: "fleetguard-am", notes: JSON.stringify({ source: "FleetGuard", snapshots: [{ type: "AM", odometer: 100, timestamp: "2026-09-03T06:00:00.000Z" }] }) },
      { id: "fleetguard-pm", notes: JSON.stringify({ source: "FleetGuard", snapshots: [{ type: "PM", odometer: 140, timestamp: "2026-09-03T16:00:00.000Z" }] }) },
    ]),
    [],
  );
});

test("AM then PM snapshots merge into one mobile aggregate without changing history", () => {
  const am = { type: "AM" as const, odometer: 100, timestamp: "2026-09-03T06:00:00.000Z" };
  const pm = { type: "PM" as const, odometer: 140, timestamp: "2026-09-03T16:00:00.000Z" };
  const afterAm = mergeMobileSnapshot([], am);
  const afterPm = mergeMobileSnapshot(afterAm.snapshots, pm);
  assert.equal(afterAm.duplicate, false);
  assert.equal(afterPm.duplicate, false);
  assert.deepEqual(afterPm.snapshots, [am, pm]);
});

test("simultaneous duplicate submissions resolve as one logical snapshot", async () => {
  const workerId = `test-km-worker-${randomUUID()}`;
  const vehicleId = `test-km-vehicle-${randomUUID()}`;
  const submissionKey = `test-km-${randomUUID()}`;
  fixtureWorkers.push(workerId);
  const request = { workerId, vehicleId, day: "2099-01-01", logType: "AM" as const, odometer: 100, submissionKey };
  const results = await Promise.all([submitMobileKmSnapshot(request), submitMobileKmSnapshot(request)]);
  assert.equal(new Set(results.map(result => result.record.id)).size, 1);
  assert.equal(results.filter(result => result.created).length, 1);
  const rows = await pool.query(`SELECT id FROM km_logs WHERE worker_id=$1 AND vehicle_id=$2`, [workerId, vehicleId]);
  const receipts = await pool.query(`SELECT submission_key FROM fleet_km_submission_receipts WHERE worker_id=$1`, [workerId]);
  assert.equal(rows.rowCount, 1);
  assert.equal(receipts.rowCount, 1);
});

test("simultaneous AM and PM submissions serialize into one mobile row", async () => {
  const workerId = `test-km-worker-${randomUUID()}`;
  const vehicleId = `test-km-vehicle-${randomUUID()}`;
  fixtureWorkers.push(workerId);
  await Promise.all([
    submitMobileKmSnapshot({ workerId, vehicleId, day: "2099-01-02", logType: "AM", odometer: 200, submissionKey: `test-km-${randomUUID()}` }),
    submitMobileKmSnapshot({ workerId, vehicleId, day: "2099-01-02", logType: "PM", odometer: 240, submissionKey: `test-km-${randomUUID()}` }),
  ]);
  const rows = await pool.query(`SELECT notes FROM km_logs WHERE worker_id=$1 AND vehicle_id=$2`, [workerId, vehicleId]);
  assert.equal(rows.rowCount, 1);
  const parsed = JSON.parse(rows.rows[0].notes);
  assert.equal(parsed.source, "JobFlowMobile");
  assert.deepEqual(parsed.snapshots.map((item: any) => item.type).sort(), ["AM", "PM"]);
});

test("mobile submissions preserve FleetGuard snapshot rows byte-for-byte", async () => {
  const workerId = `test-km-worker-${randomUUID()}`;
  const vehicleId = `test-km-vehicle-${randomUUID()}`;
  const sourceId = `test-fleetguard-km-${randomUUID()}`;
  const sourceNotes = JSON.stringify({
    source: "FleetGuard",
    snapshots: [{ type: "AM", odometer: 300, timestamp: "2099-01-03T06:00:00.000Z" }],
  });
  fixtureWorkers.push(workerId);
  await pool.query(
    `INSERT INTO km_logs
      (id,vehicle_id,worker_id,log_date,start_odometer,end_odometer,total_km,business_km,private_km,notes,created_at)
     VALUES ($1,$2,$3,'2099-01-03',300,300,0,0,0,$4,now())`,
    [sourceId, vehicleId, workerId, sourceNotes],
  );
  await submitMobileKmSnapshot({
    workerId, vehicleId, day: "2099-01-03", logType: "PM", odometer: 340,
    submissionKey: `test-km-${randomUUID()}`,
  });
  const source = await pool.query(`SELECT notes FROM km_logs WHERE id=$1`, [sourceId]);
  const rows = await pool.query(`SELECT id FROM km_logs WHERE worker_id=$1 AND vehicle_id=$2`, [workerId, vehicleId]);
  assert.equal(source.rows[0].notes, sourceNotes);
  assert.equal(rows.rowCount, 2);
});
