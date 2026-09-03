import type { AccessIdentity } from "@shared/accessPolicy";
import { calculateFleetAchievements, calculateFuelConsumption, consumptionSummary, monthlyCheckStatus } from "./fleet-domain";
import { calculateFleetOdometerLogs } from "./fleet-odometer-calculation";
import { canReadFleetRecord, type FleetScopedVehicle } from "./fleet-scope";

type Dated = { id: string; vehicleId?: string | null; workerId?: string | null; deletedAt?: Date | string | null; createdAt?: Date | string; [key: string]: any };
export type FleetActivityFilters = { workerId?: string; vehicleId?: string; from?: string; to?: string; includeDeleted?: boolean };
export type FleetAuditEntry = { id: string; entityId: string; entityType: string; createdAt: Date | string; [key: string]: any };

export type FleetActivitySource = {
  getVehicles(): Promise<FleetScopedVehicle[]>;
  getKmLogs(): Promise<Dated[]>;
  getFuelFillups(): Promise<Dated[]>;
  getVehicleInspections(): Promise<Dated[]>;
  getVehicleIssues(): Promise<Dated[]>;
  getServiceRecords(): Promise<Dated[]>;
  getWorkshopJobs(): Promise<Dated[]>;
};

const timestamp = (value: Date | string | undefined) => {
  const result = new Date(value ?? 0).getTime();
  if (Number.isNaN(result)) throw new Error("Invalid fleet activity date");
  return result;
};

const recordDate = (kind: string, row: Dated) => {
  if (kind === "km") return row.logDate;
  if (kind === "fuel") return row.fillDate;
  if (kind === "inspection") return row.inspectionDate;
  if (kind === "issue") return row.reportedAt;
  if (kind === "service") return row.serviceDate;
  return row.scheduledDate ?? row.completedAt ?? row.createdAt;
};

/**
 * The consolidated Fleet read model.  Keeping filtering here makes the JSON
 * view and spreadsheet export impossible to drift from one another.
 */
export async function readFleetActivity(
  source: FleetActivitySource,
  identity: AccessIdentity,
  filters: FleetActivityFilters = {},
  audits: FleetAuditEntry[] = [],
) {
  const [vehicles, rawKmLogs, rawFuelFillups, rawInspections, rawIssues, rawServiceRecords, rawWorkshopJobs] = await Promise.all([
    source.getVehicles(), source.getKmLogs(), source.getFuelFillups(), source.getVehicleInspections(),
    source.getVehicleIssues(), source.getServiceRecords(), source.getWorkshopJobs(),
  ]);
  const vehiclesById = new Map(vehicles.map(vehicle => [vehicle.id, vehicle]));
  const from = filters.from ? timestamp(filters.from) : undefined;
  const to = filters.to ? timestamp(`${filters.to}T23:59:59.999Z`) : undefined;
  const permitted = (kind: string, row: Dated, workerId = row.workerId) => {
    const at = timestamp(recordDate(kind, row));
    return canReadFleetRecord(identity, { ...row, workerId }, vehiclesById)
      && (!filters.workerId || workerId === filters.workerId)
      && (!filters.vehicleId || row.vehicleId === filters.vehicleId)
      && (from === undefined || at >= from)
      && (to === undefined || at <= to)
      && (filters.includeDeleted || !row.deletedAt);
  };

  const kmLogs = calculateFleetOdometerLogs(rawKmLogs as any).filter(row => permitted("km", row as any));
  const fuelFillups = rawFuelFillups.filter(row => permitted("fuel", row));
  const inspections = rawInspections.filter(row => permitted("inspection", row));
  const issues = rawIssues.filter(row => permitted("issue", row));
  const serviceRecords = rawServiceRecords.filter(row => permitted("service", row, row.createdByWorkerId));
  const workshopJobs = rawWorkshopJobs.filter(row => permitted("workshop", row, row.assignedDriverId ?? row.reportedByWorkerId));
  const consumption = calculateFuelConsumption(fuelFillups.map(row => ({
    id: row.id, vehicleId: row.vehicleId!, workerId: row.workerId, date: row.fillDate, odometer: row.odometer, litres: row.litres,
  })));
  const l100ByFillupId = new Map(consumption.map(reading => [reading.fillupId, reading.litresPer100Km]));
  const fuelFillupsWithConsumption = fuelFillups.map(row => ({
    ...row, litresPer100Km: l100ByFillupId.get(row.id) ?? null,
  }));

  const accessibleIds = new Set([
    ...kmLogs, ...fuelFillups, ...inspections, ...issues, ...serviceRecords, ...workshopJobs,
  ].map(row => row.id));
  const audit = audits.filter(row => accessibleIds.has(row.entityId)
    && (from === undefined || timestamp(row.createdAt) >= from)
    && (to === undefined || timestamp(row.createdAt) <= to));

  // Monthly checks are a status projection over the same inspection evidence,
  // one per vehicle visible in this request, not a duplicate unscoped feed.
  const monthlyAt = filters.to ? `${filters.to}T12:00:00Z` : new Date();
  const monthlyAtTime = timestamp(monthlyAt);
  const monthlyInspections = vehicles
    .filter(vehicle => canReadFleetRecord(identity, { vehicleId: vehicle.id, workerId: filters.workerId }, vehiclesById)
      && (!filters.vehicleId || vehicle.id === filters.vehicleId)
      && (from === undefined || monthlyAtTime >= from) && (to === undefined || monthlyAtTime <= to))
    .map(vehicle => ({
      vehicleId: vehicle.id, workerId: filters.workerId ?? null,
      ...monthlyCheckStatus(monthlyAt, rawInspections.map(row => ({
        vehicleId: row.vehicleId!, workerId: row.workerId, date: row.inspectionDate, deletedAt: row.deletedAt,
      })), { vehicleId: vehicle.id, workerId: filters.workerId }),
    }));

  return {
    filters: { workerId: filters.workerId ?? null, vehicleId: filters.vehicleId ?? null, from: filters.from ?? null, to: filters.to ?? null, includeDeleted: Boolean(filters.includeDeleted) },
    kmLogs, fuelFillups: fuelFillupsWithConsumption, inspections, dailyInspections: inspections,
    monthlyInspections, monthlyChecks: monthlyInspections, issues, workshopJobs, maintenance: workshopJobs,
    serviceRecords, audit, auditEntries: audit,
    consumption: { readings: consumption, ...consumptionSummary(consumption) },
    achievements: calculateFleetAchievements({ inspections: inspections as any, kmLogs, consumption }),
  };
}

/** Flat, stable rows for the one-sheet Fleet Activity workbook. */
export function fleetActivityRows(activity: Awaited<ReturnType<typeof readFleetActivity>>) {
  const l100 = new Map(activity.consumption.readings.map(reading => [reading.fillupId, reading.litresPer100Km]));
  const row = (category: string, record: any, date: any, workerId = record.workerId) => ({
    Category: category, Date: date ?? "", ID: record.id ?? "", Vehicle: record.vehicleId ?? "",
    Worker: workerId ?? "", Status: record.status ?? record.overallResult ?? "",
    "Business KM": record.businessKm ?? "", "Private KM": record.privateKm ?? "", "Total KM": record.totalKm ?? "",
    Litres: record.litres ?? "", Cost: record.cost ?? "", "L/100 KM": l100.get(record.id) ?? "",
    Details: record.description ?? record.workDone ?? record.comments ?? record.notes ?? "",
  });
  return [
    ...activity.kmLogs.map(record => row("KM", record, record.logDate)),
    ...activity.fuelFillups.map((record: any) => row("Fuel", record, record.fillDate)),
    ...activity.inspections.map(record => row("Daily Inspection", record, record.inspectionDate)),
    ...activity.monthlyInspections.map(record => row("Monthly Inspection", record, record.month, record.workerId)),
    ...activity.issues.map(record => row("Issue", record, record.reportedAt)),
    ...activity.workshopJobs.map(record => row("Workshop", record, record.scheduledDate ?? record.completedAt ?? record.createdAt, record.assignedDriverId ?? record.reportedByWorkerId)),
    ...activity.serviceRecords.map(record => row("Service", record, record.serviceDate, record.createdByWorkerId)),
    ...activity.audit.map(record => row("Audit", record, record.createdAt, record.actorId)),
    ...activity.achievements.map(record => row("Achievement", record, record.earnedAt)),
  ];
}