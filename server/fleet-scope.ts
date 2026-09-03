import type { AccessIdentity } from "@shared/accessPolicy";
import { canAccessDepartment, canManageWorker, equivalentWorkerIds, getStaffAccessProfile, hasPermission, isCanonicalOwner } from "@shared/permissionMatrix";

export type FleetScopedRecord = { vehicleId?: string | null; workerId?: string | null; departmentId?: string | null };
export type FleetScopedVehicle = { id: string; departmentId?: string | null; registration?: string | null; deletedAt?: Date | string | null };
export const isKtdVehicle = (vehicle: Pick<FleetScopedVehicle, "registration"> | null | undefined) =>
  String(vehicle?.registration ?? "").replace(/[^a-z0-9]/gi, "").toUpperCase() === "KTD136EC";

/** Central record-level policy for all Fleet projections. */
export function canReadFleetRecord(identity: AccessIdentity, record: FleetScopedRecord, vehicles: Map<string, FleetScopedVehicle>): boolean {
  const vehicle = record.vehicleId ? vehicles.get(record.vehicleId) : undefined;
  if (isKtdVehicle(vehicle)) return false;
  if (isCanonicalOwner(identity)) return true;
  const profile = getStaffAccessProfile(identity);
  if (profile?.ownWorkOnly) {
    return Boolean(record.workerId && equivalentWorkerIds(identity.sourceWorkerId || identity.id || "").includes(record.workerId));
  }
  if (record.workerId && equivalentWorkerIds(identity.sourceWorkerId || identity.id || "").includes(record.workerId)) return true;
  if (record.workerId && canManageWorker(identity, record.workerId)) return true;
  return Boolean((record.departmentId && canAccessDepartment(identity, record.departmentId))
    || (vehicle?.departmentId && canAccessDepartment(identity, vehicle.departmentId)));
}

export function canWriteFleetRecord(identity: AccessIdentity, record: FleetScopedRecord, vehicles: Map<string, FleetScopedVehicle>): boolean {
  return hasPermission(identity, "fleet") && canReadFleetRecord(identity, record, vehicles);
}