import type { FuelFillup, InsertFuelFillup, InsertVehicleInspection, InsertVehicleIssue, VehicleInspection, VehicleIssue } from "@shared/schema";
import { pool } from "./db";
import { failedInspectionEmail, fleetEmailRecipients, fleetFaultEmail, fleetFuelEmail, type FleetEmail } from "./fleet-email-outbox";

type QueryClient = Pick<typeof pool, "query">;
type SubmissionKind = "fuel" | "inspection" | "issue";
const fuelColumns = `id, vehicle_id AS "vehicleId", worker_id AS "workerId", fill_date AS "fillDate", odometer, litres, cost, fuel_type AS "fuelType", receipt_photo AS "receiptPhoto", notes, submission_key AS "submissionKey", created_at AS "createdAt"`;
const inspectionColumns = `id, vehicle_id AS "vehicleId", worker_id AS "workerId", inspection_date AS "inspectionDate", overall_result AS "overallResult", items_json AS "itemsJson", comments, photo_url AS "photoUrl", fail_alert_sent AS "failAlertSent", reviewed_at AS "reviewedAt", reviewed_by AS "reviewedBy", submission_key AS "submissionKey", created_at AS "createdAt"`;
const issueColumns = `id, vehicle_id AS "vehicleId", worker_id AS "workerId", reported_at AS "reportedAt", category, description, urgency, status, photo_url AS "photoUrl", manager_notes AS "managerNotes", resolved_at AS "resolvedAt", service_record_id AS "serviceRecordId", submission_key AS "submissionKey", created_at AS "createdAt"`;

/**
 * The key belongs to a single client submission, rather than being derived from
 * its fields: two genuine fill-ups may otherwise look identical.
 */
export function fleetSubmissionKey(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9._:-]{16,200}$/.test(value.trim())) {
    throw new Error("A valid submission key is required. Refresh the form and try again.");
  }
  return value.trim();
}

export async function withFleetSubmissionTransaction<T>(
  client: QueryClient,
  work: () => Promise<T>,
): Promise<T> {
  await client.query("BEGIN");
  try {
    const result = await work();
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function submit<T>(
  kind: SubmissionKind,
  submissionKey: string,
  insert: (client: QueryClient) => Promise<T | undefined>,
  email: (record: T) => FleetEmail | undefined,
  findExisting: (client: QueryClient) => Promise<T>,
): Promise<{ record: T; created: boolean }> {
  const client = await pool.connect();
  try {
    return await withFleetSubmissionTransaction(client, async () => {
      const record = await insert(client);
      if (!record) return { record: await findExisting(client), created: false };
      const notification = email(record);
      if (notification) {
        await client.query(
          `INSERT INTO fleet_email_outbox (event_key, kind, recipients, subject, text_body, html_body)
           VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (event_key) DO NOTHING`,
          [notification.eventKey, notification.kind, fleetEmailRecipients(), notification.subject, notification.text, notification.html],
        );
      }
      return { record, created: true };
    });
  } finally {
    client.release();
  }
}

export function submitFuelFillup(data: InsertFuelFillup, key: string) {
  return submit<FuelFillup>("fuel", key,
    async client => (await client.query(
      `INSERT INTO fuel_fillups (id, vehicle_id, worker_id, fill_date, odometer, litres, cost, fuel_type, receipt_photo, notes, submission_key, created_at)
       VALUES (gen_random_uuid(), $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now())
       ON CONFLICT (submission_key) WHERE submission_key IS NOT NULL DO NOTHING RETURNING ${fuelColumns}`,
      [data.vehicleId, data.workerId, data.fillDate, data.odometer, data.litres, data.cost, data.fuelType, data.receiptPhoto, data.notes, key],
    )).rows[0],
    fleetFuelEmail,
    async client => (await client.query(`SELECT ${fuelColumns} FROM fuel_fillups WHERE submission_key = $1`, [key])).rows[0],
  );
}

export function submitVehicleInspection(data: InsertVehicleInspection, key: string) {
  return submit<VehicleInspection>("inspection", key,
    async client => (await client.query(
      `INSERT INTO vehicle_inspections (id, vehicle_id, worker_id, inspection_date, overall_result, items_json, comments, photo_url, fail_alert_sent, submission_key, created_at)
       VALUES (gen_random_uuid(), $1,$2,$3,$4,$5,$6,$7,$8,$9,now())
       ON CONFLICT (submission_key) WHERE submission_key IS NOT NULL DO NOTHING RETURNING ${inspectionColumns}`,
      [data.vehicleId, data.workerId, data.inspectionDate, data.overallResult, data.itemsJson, data.comments, data.photoUrl, data.overallResult === "fail", key],
    )).rows[0],
    record => record.overallResult === "fail" ? failedInspectionEmail(record) : undefined,
    async client => (await client.query(`SELECT ${inspectionColumns} FROM vehicle_inspections WHERE submission_key = $1`, [key])).rows[0],
  );
}

export function submitVehicleIssue(data: InsertVehicleIssue, key: string) {
  return submit<VehicleIssue>("issue", key,
    async client => (await client.query(
      `INSERT INTO vehicle_issues (id, vehicle_id, worker_id, reported_at, category, description, urgency, status, photo_url, manager_notes, resolved_at, service_record_id, submission_key, created_at)
       VALUES (gen_random_uuid(), $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now())
       ON CONFLICT (submission_key) WHERE submission_key IS NOT NULL DO NOTHING RETURNING ${issueColumns}`,
      [data.vehicleId, data.workerId, data.reportedAt, data.category, data.description, data.urgency, data.status, data.photoUrl, data.managerNotes, data.resolvedAt, data.serviceRecordId, key],
    )).rows[0],
    fleetFaultEmail,
    async client => (await client.query(`SELECT ${issueColumns} FROM vehicle_issues WHERE submission_key = $1`, [key])).rows[0],
  );
}