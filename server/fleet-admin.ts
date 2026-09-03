import { pool } from "./db";

const TABLES: Record<string, { table: string; id: string }> = {
  "km-logs": { table: "km_logs", id: "id" },
  "fuel-fillups": { table: "fuel_fillups", id: "id" },
  inspections: { table: "vehicle_inspections", id: "id" },
};

export function fleetCorrectionReason(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 1000) {
    throw new Error("A correction reason is required.");
  }
  return value.trim();
}

export async function correctFleetRecord(
  kind: keyof typeof TABLES, id: string, patch: Record<string, unknown>, actorId: string, reason: unknown,
): Promise<Record<string, unknown>> {
  const target = TABLES[kind];
  if (!target) throw new Error("Unsupported fleet record.");
  const correctionReason = fleetCorrectionReason(reason);
  const allowed = kind === "km-logs"
    ? ["log_date", "start_odometer", "end_odometer", "total_km", "business_km", "private_km", "notes"]
    : kind === "fuel-fillups"
      ? ["fill_date", "odometer", "litres", "cost", "fuel_type", "receipt_photo", "notes"]
      : ["inspection_date", "overall_result", "items_json", "comments", "photo_url", "evidence_json"];
  const values = Object.entries(patch).filter(([key]) => allowed.includes(key));
  if (!values.length) throw new Error("No permitted fleet fields were supplied.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const before = await client.query(`SELECT * FROM ${target.table} WHERE ${target.id}=$1 FOR UPDATE`, [id]);
    if (!before.rowCount) throw new Error("Fleet record not found.");
    const set = values.map(([key], index) => `${key}=$${index + 2}`).join(",");
    const after = await client.query(
      `UPDATE ${target.table} SET ${set} WHERE ${target.id}=$1 RETURNING *`,
      [id, ...values.map(([, value]) => value)],
    );
    await client.query(
      `INSERT INTO fleet_audit_entries(entity_type,entity_id,action,actor_id,reason,before_json,after_json)
       VALUES($1,$2,'correct',$3,$4,$5::jsonb,$6::jsonb)`,
      [kind, id, actorId, correctionReason, JSON.stringify(before.rows[0]), JSON.stringify(after.rows[0])],
    );
    await client.query("COMMIT");
    return after.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

export async function setFleetRecordDeleted(
  kind: keyof typeof TABLES, id: string, deleted: boolean, actorId: string, reason: unknown,
): Promise<Record<string, unknown>> {
  const target = TABLES[kind];
  if (!target) throw new Error("Unsupported fleet record.");
  const correctionReason = fleetCorrectionReason(reason);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const before = await client.query(`SELECT * FROM ${target.table} WHERE id=$1 FOR UPDATE`, [id]);
    if (!before.rowCount) throw new Error("Fleet record not found.");
    const after = await client.query(
      `UPDATE ${target.table} SET deleted_at=${deleted ? "now()" : "NULL"},deleted_by=$2,delete_reason=$3 WHERE id=$1 RETURNING *`,
      [id, actorId, correctionReason],
    );
    await client.query(
      `INSERT INTO fleet_audit_entries(entity_type,entity_id,action,actor_id,reason,before_json,after_json)
       VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)`,
      [kind, id, deleted ? "soft-delete" : "restore", actorId, correctionReason, JSON.stringify(before.rows[0]), JSON.stringify(after.rows[0])],
    );
    await client.query("COMMIT");
    return after.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}