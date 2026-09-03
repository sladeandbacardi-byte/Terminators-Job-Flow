import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "crypto";
import { pool } from "./db";
import { selectMobileVehicle } from "./mobile-vehicle-selection";

const ids: string[] = [];
const vehicle = async (registration: string) => {
  const id = `mobile-selection-${randomUUID()}`; ids.push(id);
  await pool.query("INSERT INTO vehicles (id,name,registration,is_active,vehicle_status) VALUES ($1,$2,$3,true,'active')", [id, registration, registration]);
  return id;
};
const assignment = async (workerId: string, vehicleId: string, today = true, sourceSystem = "jobflow-mobile") =>
  pool.query(`INSERT INTO vehicle_assignments (id,worker_id,vehicle_id,is_active,assigned_at,source_system)
              VALUES ($1,$2,$3,true,${today ? "now()" : "now() - interval '1 day'"},$4)`, [randomUUID(), workerId, vehicleId, sourceSystem]);

after(async () => {
  if (!ids.length) return;
  await pool.query("DELETE FROM vehicle_assignments WHERE vehicle_id=ANY($1::text[])", [ids]);
  await pool.query("DELETE FROM vehicles WHERE id=ANY($1::text[])", [ids]);
});

test("mobile selection ends the old active assignment and retains assignment history", async () => {
  const oldVehicle = await vehicle(`MS-${randomUUID()}`);
  const target = await vehicle(`MS-${randomUUID()}`);
  const worker = `worker-${randomUUID()}`;
  await assignment(worker, oldVehicle);
  const result = await selectMobileVehicle({ workerId: worker, vehicleId: target });
  assert.equal(result.requiresConfirmation, false);
  const rows = await pool.query("SELECT vehicle_id,is_active,unassigned_at FROM vehicle_assignments WHERE worker_id=$1 ORDER BY assigned_at", [worker]);
  assert.equal(rows.rowCount, 2);
  assert.equal(rows.rows.filter(row => row.is_active).length, 1);
  assert.ok(rows.rows.find(row => row.vehicle_id === oldVehicle)?.unassigned_at);
});

test("today's occupant requires confirmation, then exchanges vehicles", async () => {
  const firstVehicle = await vehicle(`MS-${randomUUID()}`);
  const target = await vehicle(`MS-${randomUUID()}`);
  const firstWorker = `worker-${randomUUID()}`, secondWorker = `worker-${randomUUID()}`;
  await assignment(firstWorker, firstVehicle);
  await assignment(secondWorker, target);
  const pending = await selectMobileVehicle({ workerId: firstWorker, vehicleId: target });
  assert.equal(pending.requiresConfirmation, true);
  const changed = await selectMobileVehicle({ workerId: firstWorker, vehicleId: target, confirmed: true });
  assert.equal(changed.requiresConfirmation, false);
  assert.equal(changed.swapped, true);
  const active = await pool.query("SELECT worker_id,vehicle_id FROM vehicle_assignments WHERE is_active AND worker_id=ANY($1::text[]) ORDER BY worker_id", [[firstWorker, secondWorker]]);
  assert.deepEqual(active.rows.map(row => [row.worker_id, row.vehicle_id]).sort(), [[firstWorker, target], [secondWorker, firstVehicle]].sort());
});

test("confirmed selection transfers a vehicle when the chooser has no current vehicle", async () => {
  const target = await vehicle(`MS-${randomUUID()}`);
  const firstWorker = `worker-${randomUUID()}`, secondWorker = `worker-${randomUUID()}`;
  await assignment(firstWorker, target);
  const pending = await selectMobileVehicle({ workerId: secondWorker, vehicleId: target });
  assert.equal(pending.requiresConfirmation, true);
  const changed = await selectMobileVehicle({ workerId: secondWorker, vehicleId: target, confirmed: true });
  assert.equal(changed.requiresConfirmation, false);
  assert.equal(changed.swapped, false);
  const active = await pool.query("SELECT worker_id FROM vehicle_assignments WHERE vehicle_id=$1 AND is_active", [target]);
  assert.deepEqual(active.rows.map(row => row.worker_id), [secondWorker]);
});

test("prior-day and default assignments do not block today's choice, and KTD136EC stays excluded", async () => {
  const oldVehicle = await vehicle(`MS-${randomUUID()}`);
  const target = await vehicle(`MS-${randomUUID()}`);
  const defaultTarget = await vehicle(`MS-${randomUUID()}`);
  const forbidden = await vehicle("KTD 136 EC");
  const oldWorker = `worker-${randomUUID()}`, defaultWorker = `worker-${randomUUID()}`, worker = `worker-${randomUUID()}`;
  await assignment(oldWorker, target, false);
  await assignment(defaultWorker, defaultTarget, true, "fleetguard");
  const result = await selectMobileVehicle({ workerId: worker, vehicleId: target });
  assert.equal(result.requiresConfirmation, false);
  const defaultResult = await selectMobileVehicle({ workerId: worker, vehicleId: defaultTarget });
  assert.equal(defaultResult.requiresConfirmation, false);
  await assert.rejects(() => selectMobileVehicle({ workerId: worker, vehicleId: forbidden }), /not available/);
  await pool.query("DELETE FROM vehicle_assignments WHERE worker_id=ANY($1::text[])", [[oldWorker, defaultWorker]]);
  void oldVehicle;
});

test("vehicle swaps preserve KM, fuel, checks and faults on their original vehicles", async () => {
  const firstVehicle = await vehicle(`MS-${randomUUID()}`);
  const secondVehicle = await vehicle(`MS-${randomUUID()}`);
  const firstWorker = `worker-${randomUUID()}`, secondWorker = `worker-${randomUUID()}`;
  await assignment(firstWorker, firstVehicle);
  await assignment(secondWorker, secondVehicle);
  const kmId = randomUUID(), fuelId = randomUUID(), inspectionId = randomUUID(), faultId = randomUUID();
  await pool.query(`INSERT INTO km_logs (id,vehicle_id,worker_id,log_date,start_odometer,end_odometer,total_km,business_km,private_km)
    VALUES ($1,$2,$3,now(),100,120,20,20,0)`, [kmId, firstVehicle, firstWorker]);
  await pool.query(`INSERT INTO fuel_fillups (id,vehicle_id,worker_id,fill_date,odometer,litres,cost,fuel_type,receipt_photo)
    VALUES ($1,$2,$3,now(),120,10,200,'Diesel','fixture')`, [fuelId, firstVehicle, firstWorker]);
  await pool.query(`INSERT INTO vehicle_inspections (id,vehicle_id,worker_id,inspection_date,overall_result)
    VALUES ($1,$2,$3,now(),'pass')`, [inspectionId, firstVehicle, firstWorker]);
  await pool.query(`INSERT INTO vehicle_issues (id,vehicle_id,worker_id,reported_at,category,description)
    VALUES ($1,$2,$3,now(),'other','fixture fault')`, [faultId, firstVehicle, firstWorker]);
  try {
    await selectMobileVehicle({ workerId: firstWorker, vehicleId: secondVehicle, confirmed: true });
    for (const [table, id] of [["km_logs", kmId], ["fuel_fillups", fuelId], ["vehicle_inspections", inspectionId], ["vehicle_issues", faultId]]) {
      const row = await pool.query(`SELECT vehicle_id FROM ${table} WHERE id=$1`, [id]);
      assert.equal(row.rows[0].vehicle_id, firstVehicle);
    }
  } finally {
    await pool.query("DELETE FROM vehicle_issues WHERE id=$1", [faultId]);
    await pool.query("DELETE FROM vehicle_inspections WHERE id=$1", [inspectionId]);
    await pool.query("DELETE FROM fuel_fillups WHERE id=$1", [fuelId]);
    await pool.query("DELETE FROM km_logs WHERE id=$1", [kmId]);
  }
});

test("concurrent claims leave exactly one active owner for a vehicle", async () => {
  const target = await vehicle(`MS-${randomUUID()}`);
  const first = `worker-${randomUUID()}`, second = `worker-${randomUUID()}`;
  const results = await Promise.all([
    selectMobileVehicle({ workerId: first, vehicleId: target }),
    selectMobileVehicle({ workerId: second, vehicleId: target }),
  ]);
  assert.equal(results.filter(result => !result.requiresConfirmation).length, 1);
  assert.equal(results.filter(result => result.requiresConfirmation).length, 1);
  const active = await pool.query("SELECT worker_id FROM vehicle_assignments WHERE vehicle_id=$1 AND is_active", [target]);
  assert.equal(active.rowCount, 1);
});