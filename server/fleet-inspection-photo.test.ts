import assert from "node:assert/strict";
import { randomUUID } from "crypto";
import test from "node:test";
import { pool } from "./db";
import { submitFuelFillup, submitVehicleInspection } from "./fleet-submissions";

const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB";

test("inspection photos round-trip while legacy, monthly and fuel evidence remain compatible", async () => {
  const vehicleId = `photo-test-${randomUUID()}`;
  const workerId = `photo-worker-${randomUUID()}`;
  const dailyKey = `photo:daily:${randomUUID()}`;
  const monthlyKey = `photo:monthly:${randomUUID()}`;
  const fuelKey = `photo:fuel:${randomUUID()}`;
  const legacyId = `photo-legacy-${randomUUID()}`;
  const createdIds: string[] = [];
  try {
    await pool.query("INSERT INTO vehicles (id,name,registration,is_active,vehicle_status) VALUES ($1,$2,$3,true,'active')", [vehicleId, "Photo test", `PT-${randomUUID()}`]);
    const daily = await submitVehicleInspection({
      vehicleId, workerId, inspectionDate: new Date(), overallResult: "pass",
      itemsJson: "[]", comments: null, photoUrl: png,
    }, dailyKey);
    createdIds.push(daily.record.id);
    assert.equal(daily.record.photoUrl, png);
    const refreshed = await pool.query("SELECT photo_url FROM vehicle_inspections WHERE id=$1", [daily.record.id]);
    assert.equal(refreshed.rows[0].photo_url, png);

    await pool.query(
      "INSERT INTO vehicle_inspections (id,vehicle_id,worker_id,inspection_date,overall_result,items_json,photo_url) VALUES ($1,$2,$3,now()-interval '1 day','pass','[]',NULL)",
      [legacyId, vehicleId, workerId],
    );
    createdIds.push(legacyId);
    const legacy = await pool.query("SELECT photo_url FROM vehicle_inspections WHERE id=$1", [legacyId]);
    assert.equal(legacy.rows[0].photo_url, null);

    const monthly = await submitVehicleInspection({
      vehicleId, workerId, inspectionDate: new Date(), overallResult: "pass",
      itemsJson: JSON.stringify([{ name: "Monthly", result: "pass", type: "monthly" }]),
      comments: null, photoUrl: null,
    }, monthlyKey);
    createdIds.push(monthly.record.id);
    assert.equal(monthly.record.photoUrl, null);

    const fuel = await submitFuelFillup({
      vehicleId, workerId, fillDate: new Date(), odometer: 100,
      litres: "10", cost: "200", fuelType: "Diesel 50 ppm", receiptPhoto: png, notes: null,
    }, fuelKey);
    assert.equal(fuel.record.receiptPhoto, png);
    await pool.query("DELETE FROM fleet_email_outbox WHERE event_key=$1", [`fleet:fuel:${fuel.record.id}`]);
    await pool.query("DELETE FROM fuel_fillups WHERE id=$1", [fuel.record.id]);
  } finally {
    await pool.query("DELETE FROM fleet_email_outbox WHERE event_key LIKE 'fleet:inspection:%' AND text_body LIKE $1", [`%${vehicleId}%`]);
    await pool.query("DELETE FROM vehicle_inspections WHERE id=ANY($1::varchar[])", [createdIds]);
    await pool.query("DELETE FROM vehicles WHERE id=$1", [vehicleId]);
  }
});