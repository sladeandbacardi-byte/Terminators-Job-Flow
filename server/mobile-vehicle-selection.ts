import { randomUUID } from "crypto";
import type { Pool } from "pg";
import { pool } from "./db";

export type MobileVehicleSelection =
  | { requiresConfirmation: true; targetVehicleId: string; currentVehicleId: string | null; occupiedBy: { workerId: string; name: string }; willSwap: boolean }
  | { requiresConfirmation: false; assignment: { id: string; vehicleId: string; workerId: string }; swapped: boolean };

const KTD136EC = "KTD136EC";
const JOBFLOW_MOBILE_SOURCE = "jobflow-mobile";
const registrationKey = (registration: string | null) => (registration || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

async function transaction<T>(database: Pool, work: (client: any) => Promise<T>): Promise<T> {
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Makes the mobile choice authoritative without altering any fleet activity
 * records. Assignment rows are append-only history: an old current row is
 * ended, never repurposed.
 */
export async function selectMobileVehicle(
  input: { workerId: string; vehicleId: string; confirmed?: boolean },
  database: Pool = pool,
): Promise<MobileVehicleSelection> {
  return transaction(database, async client => {
    // The vehicle lock serialises competing claims; the worker lock serialises
    // a technician changing vehicles on two mobile devices.
    const initialLocks = [
      `jobflow-mobile-vehicle:${input.vehicleId}`,
      `jobflow-mobile-worker:${input.workerId}`,
    ].sort();
    for (const lock of initialLocks) {
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [lock]);
    }
    const targetResult = await client.query(
      `SELECT id, registration FROM vehicles WHERE id=$1 AND is_active=true FOR UPDATE`,
      [input.vehicleId],
    );
    const target = targetResult.rows[0];
    if (!target || registrationKey(target.registration) === KTD136EC) {
      throw new Error("That vehicle is not available for mobile selection.");
    }

    const activeRows = await client.query(
       `SELECT a.id, a.vehicle_id, a.worker_id, a.assigned_at,
               (a.source_system=$3
                AND (a.assigned_at AT TIME ZONE 'Africa/Johannesburg')::date
                  = (now() AT TIME ZONE 'Africa/Johannesburg')::date) AS selected_today,
              w.name AS worker_name
         FROM vehicle_assignments a
         LEFT JOIN workers w ON w.id=a.worker_id
        WHERE a.is_active AND (a.worker_id=$1 OR a.vehicle_id=$2)
         FOR UPDATE OF a`,
      [input.workerId, input.vehicleId, JOBFLOW_MOBILE_SOURCE],
    );
    const mine = activeRows.rows.find((row: any) => row.worker_id === input.workerId);
    const occupant = activeRows.rows.find((row: any) => row.vehicle_id === input.vehicleId && row.worker_id !== input.workerId);
    if (mine?.vehicle_id === input.vehicleId) {
      return { requiresConfirmation: false, assignment: { id: mine.id, vehicleId: input.vehicleId, workerId: input.workerId }, swapped: false };
    }

    // A standing/default assignment is not a selection made today and must not
    // prevent today's worker from choosing the vehicle.
    const occupiedToday = occupant?.selected_today === true;
    if (occupiedToday && !input.confirmed) {
      return {
        requiresConfirmation: true,
        targetVehicleId: input.vehicleId,
        currentVehicleId: mine?.vehicle_id ?? null,
        occupiedBy: { workerId: occupant.worker_id, name: occupant.worker_name || "another worker" },
        willSwap: Boolean(mine?.vehicle_id),
      };
    }

    if (occupant) {
      // Lock the occupant before changing its row. This complements the target
      // lock above and prevents a confirmed exchange from producing two active
      // vehicles for either worker.
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`jobflow-mobile-worker:${occupant.worker_id}`]);
    }
    await client.query(
      `UPDATE vehicle_assignments SET is_active=false, unassigned_at=now()
        WHERE is_active AND (worker_id=$1 OR vehicle_id=$2)`,
      [input.workerId, input.vehicleId],
    );
    if (occupant && mine?.vehicle_id) {
      await client.query(
        `UPDATE vehicle_assignments SET is_active=false, unassigned_at=now()
          WHERE is_active AND (worker_id=$1 OR vehicle_id=$2)`,
        [occupant.worker_id, mine.vehicle_id],
      );
      await client.query(
         `INSERT INTO vehicle_assignments (id, vehicle_id, worker_id, is_active, notes, assigned_at, source_system)
          VALUES ($1,$2,$3,true,$4,now(),$5)`,
        [randomUUID(), mine.vehicle_id, occupant.worker_id, JSON.stringify({ source: "JobFlowMobile", action: "swap" }), JOBFLOW_MOBILE_SOURCE],
      );
    }
    const id = randomUUID();
    await client.query(
      `INSERT INTO vehicle_assignments (id, vehicle_id, worker_id, is_active, notes, assigned_at, source_system)
       VALUES ($1,$2,$3,true,$4,now(),$5)`,
      [id, input.vehicleId, input.workerId, JSON.stringify({ source: "JobFlowMobile", action: occupant ? "transfer" : "select" }), JOBFLOW_MOBILE_SOURCE],
    );
    return { requiresConfirmation: false, assignment: { id, vehicleId: input.vehicleId, workerId: input.workerId }, swapped: Boolean(occupant && mine?.vehicle_id) };
  });
}