import { pool } from "./db";

export type MobileFleetSelectionStatus = {
  assignmentId: string;
  vehicleId: string;
  workerId: string;
  selectedToday: boolean;
};

/** PostgreSQL evaluates "today" in Johannesburg, independent of host timezone. */
export async function getMobileFleetSelectionStatus(workerId: string): Promise<MobileFleetSelectionStatus | null> {
  const result = await pool.query(
    `SELECT a.id AS "assignmentId",a.vehicle_id AS "vehicleId",a.worker_id AS "workerId",
       (a.source_system='jobflow-mobile' AND
        (a.assigned_at AT TIME ZONE 'Africa/Johannesburg')::date =
        (now() AT TIME ZONE 'Africa/Johannesburg')::date) AS "selectedToday"
     FROM vehicle_assignments a JOIN vehicles v ON v.id=a.vehicle_id
     WHERE a.worker_id=$1 AND a.is_active AND v.is_active
       AND v.deleted_at IS NULL
       AND regexp_replace(upper(COALESCE(v.registration,'')),'[^A-Z0-9]','','g') <> 'KTD136EC'
     LIMIT 1`,
    [workerId],
  );
  return result.rows[0] ?? null;
}