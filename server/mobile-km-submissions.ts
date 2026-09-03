import { randomUUID } from "crypto";
import { calculateFleetOdometerLogs, type OdometerSourceLog } from "./fleet-odometer-calculation";
import { pool } from "./db";
import { assertNoOdometerRollback } from "./fleet-input-validation";

export type MobileKmSnapshot = {
  type: "AM" | "PM";
  odometer: number;
  timestamp: string;
};

type StoredKmRow = OdometerSourceLog & { workerId: string; createdAt: Date };
type SubmissionInput = {
  vehicleId: string;
  workerId: string;
  day: string;
  logType: "AM" | "PM";
  odometer: number;
  submissionKey: string;
};

const kmColumns = `
  id, vehicle_id AS "vehicleId", worker_id AS "workerId", log_date AS "logDate",
  start_odometer AS "startOdometer", end_odometer AS "endOdometer",
  total_km AS "totalKm", business_km AS "businessKm", private_km AS "privateKm",
  notes, created_at AS "createdAt"
`;

function snapshotsFromNotes(notes: string | null | undefined): MobileKmSnapshot[] {
  try {
    const parsed = JSON.parse(notes || "{}");
    return Array.isArray(parsed.snapshots)
      ? parsed.snapshots.filter((item: any) => (item?.type === "AM" || item?.type === "PM") && Number.isInteger(item?.odometer))
      : [];
  } catch {
    return [];
  }
}

function isJobFlowMobileAggregate(notes: string | null | undefined): boolean {
  try {
    const parsed = JSON.parse(notes || "{}");
    return parsed?.source === "JobFlowMobile" && Array.isArray(parsed.snapshots);
  } catch {
    return false;
  }
}

export function mobileSnapshotRows(rows: Array<{ id: string; notes?: string | null }>): Array<{ id: string; snapshots: MobileKmSnapshot[] }> {
  return rows
    .filter(row => isJobFlowMobileAggregate(row.notes))
    .map(row => ({ id: row.id, snapshots: snapshotsFromNotes(row.notes) }));
}

export function mergeMobileSnapshot(
  existing: MobileKmSnapshot[],
  incoming: MobileKmSnapshot,
): { snapshots: MobileKmSnapshot[]; duplicate: boolean } {
  if (existing.some(snapshot => snapshot.type === incoming.type)) {
    return { snapshots: existing, duplicate: true };
  }
  return { snapshots: [...existing, incoming], duplicate: false };
}

function normalizeRow(row: any): StoredKmRow {
  return {
    ...row,
    logDate: row.logDate instanceof Date ? row.logDate : new Date(row.logDate),
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
  };
}

export async function submitMobileKmSnapshot(input: SubmissionInput): Promise<{
  created: boolean;
  duplicate: boolean;
  record: StoredKmRow;
  calculated: ReturnType<typeof calculateFleetOdometerLogs>[number]["odometerCalculation"];
}> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      [`mobile-km:${input.workerId}:${input.vehicleId}:${input.day}`],
    );

    const receipt = await client.query(
      `SELECT km_log_id FROM fleet_km_submission_receipts WHERE submission_key = $1`,
      [input.submissionKey],
    );
    if (receipt.rows[0]) {
      const existing = await client.query(`SELECT ${kmColumns} FROM km_logs WHERE id = $1`, [receipt.rows[0].km_log_id]);
      if (!existing.rows[0]) throw new Error("The original kilometre submission is no longer available.");
      const record = normalizeRow(existing.rows[0]);
      const allRows = await client.query(`SELECT ${kmColumns} FROM km_logs`);
      const calculated = calculateFleetOdometerLogs(allRows.rows.map(normalizeRow))
        .find(row => row.id === record.id)!.odometerCalculation;
      await client.query("COMMIT");
      return { created: false, duplicate: false, record, calculated };
    }

    const sameDayResult = await client.query(
      `SELECT ${kmColumns} FROM km_logs
       WHERE vehicle_id = $1 AND worker_id = $2 AND log_date::date = $3::date
       ORDER BY created_at, id
       FOR UPDATE`,
      [input.vehicleId, input.workerId, input.day],
    );
    const sameDay = sameDayResult.rows.map(normalizeRow);
    const mobileAggregate = sameDay.find(row => isJobFlowMobileAggregate(row.notes));
    const incoming: MobileKmSnapshot = {
      type: input.logType,
      odometer: input.odometer,
      timestamp: `${input.day}T${input.logType === "AM" ? "06:00:00" : "16:00:00"}.000Z`,
    };
    const merged = mergeMobileSnapshot(snapshotsFromNotes(mobileAggregate?.notes), incoming);
    if (merged.duplicate) {
      const record = mobileAggregate!;
      await client.query("COMMIT");
      const calculated = calculateFleetOdometerLogs([record]).find(row => row.id === record.id)!.odometerCalculation;
      return { created: false, duplicate: true, record, calculated };
    }

    const id = mobileAggregate?.id ?? `mobile-km-${randomUUID()}`;
    const candidate: StoredKmRow = {
      id,
      vehicleId: input.vehicleId,
      workerId: input.workerId,
      logDate: new Date(`${input.day}T12:00:00.000Z`),
      startOdometer: merged.snapshots.find(snapshot => snapshot.type === "AM")?.odometer ?? input.odometer,
      endOdometer: merged.snapshots.find(snapshot => snapshot.type === "PM")?.odometer ?? input.odometer,
      totalKm: 0,
      businessKm: 0,
      privateKm: 0,
      notes: JSON.stringify({ source: "JobFlowMobile", snapshots: merged.snapshots }),
      createdAt: mobileAggregate?.createdAt ?? new Date(),
    };
    const allRowsResult = await client.query(`SELECT ${kmColumns} FROM km_logs`);
    const calculated = calculateFleetOdometerLogs([
      ...allRowsResult.rows.map(normalizeRow).filter(row => row.id !== id),
      candidate,
    ]).find(row => row.id === id)!;
    assertNoOdometerRollback(calculated.odometerCalculation.flags);

    if (mobileAggregate) {
      await client.query(
        `UPDATE km_logs SET start_odometer=$2,end_odometer=$3,total_km=$4,business_km=$5,private_km=$6,notes=$7
         WHERE id=$1`,
        [id, candidate.startOdometer, candidate.endOdometer, calculated.totalKm ?? 0,
          calculated.businessKm ?? 0, calculated.privateKm ?? 0, candidate.notes],
      );
    } else {
      await client.query(
        `INSERT INTO km_logs
          (id,vehicle_id,worker_id,log_date,start_odometer,end_odometer,total_km,business_km,private_km,notes,created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [id, candidate.vehicleId, candidate.workerId, candidate.logDate, candidate.startOdometer,
          candidate.endOdometer, calculated.totalKm ?? 0, calculated.businessKm ?? 0,
          calculated.privateKm ?? 0, candidate.notes, candidate.createdAt],
      );
    }
    await client.query(
      `INSERT INTO fleet_km_submission_receipts
        (submission_key,vehicle_id,worker_id,log_date,log_type,km_log_id,odometer)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [input.submissionKey, input.vehicleId, input.workerId, input.day, input.logType, id, input.odometer],
    );
    await client.query("COMMIT");
    return { created: !mobileAggregate, duplicate: false, record: candidate, calculated: calculated.odometerCalculation };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
