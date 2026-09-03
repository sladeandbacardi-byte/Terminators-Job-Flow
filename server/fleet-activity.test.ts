import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
import { fleetActivityRows, readFleetActivity } from "./fleet-activity";
import { fleetActivityWorkbook } from "./fleet-activity-export";

const day = new Date("2026-03-26T12:00:00Z");
const source: any = {
  getVehicles: async () => [
    { id: "v1", departmentId: "div-1", registration: "ABC123EC" },
    { id: "v2", departmentId: "div-1", registration: "KTD136EC" },
  ],
  getKmLogs: async () => [
    { id: "km", vehicleId: "v1", workerId: "worker-2", logDate: day, startOdometer: 100, endOdometer: 120, totalKm: 20, businessKm: 20, privateKm: 0 },
    { id: "deleted", vehicleId: "v1", workerId: "worker-2", logDate: day, startOdometer: 120, endOdometer: 140, totalKm: 20, businessKm: 20, privateKm: 0, deletedAt: day },
    { id: "ktd", vehicleId: "v2", workerId: "worker-2", logDate: day, startOdometer: 1, endOdometer: 2, totalKm: 1, businessKm: 1, privateKm: 0 },
  ],
  getFuelFillups: async () => [
    { id: "fuel-a", vehicleId: "v1", workerId: "worker-2", fillDate: new Date("2026-03-20T12:00:00Z"), odometer: 100, litres: "10", cost: "200" },
    { id: "fuel-b", vehicleId: "v1", workerId: "worker-2", fillDate: day, odometer: 200, litres: "10", cost: "200" },
  ],
  getVehicleInspections: async () => [{ id: "inspection", vehicleId: "v1", workerId: "worker-2", inspectionDate: day, overallResult: "pass" }],
  getVehicleIssues: async () => [{ id: "issue", vehicleId: "v1", workerId: "worker-2", reportedAt: day, description: "Tyre", status: "open" }],
  getServiceRecords: async () => [{ id: "service", vehicleId: "v1", createdByWorkerId: "worker-2", serviceDate: day, workDone: "Service" }],
  getWorkshopJobs: async () => [{ id: "workshop", vehicleId: "v1", assignedDriverId: "worker-2", scheduledDate: day, description: "Repair" }],
};

test("consolidated fleet activity independently composes filters and scope", async () => {
  const activity = await readFleetActivity(source, { id: "worker-2" }, { workerId: "worker-2", vehicleId: "v1", from: "2026-03-01", to: "2026-03-31" }, [
    { id: "audit", entityId: "issue", entityType: "issue", createdAt: day, actorId: "worker-2" },
  ]);
  assert.equal(activity.kmLogs.length, 1);
  assert.equal(activity.fuelFillups[1].litresPer100Km, 10);
  assert.equal(activity.inspections.length, 1);
  assert.equal(activity.issues.length, 1);
  assert.equal(activity.serviceRecords.length, 1);
  assert.equal(activity.workshopJobs.length, 1);
  assert.equal(activity.audit.length, 1);
  assert.equal(activity.kmLogs.some((row: any) => row.id === "ktd"), false);
  assert.equal(activity.kmLogs.some((row: any) => row.id === "deleted"), false);
  assert.equal(activity.monthlyInspections[0].vehicleId, "v1");
  const withDeleted = await readFleetActivity(source, { id: "worker-2" }, { includeDeleted: true });
  assert.equal(withDeleted.kmLogs.some((row: any) => row.id === "deleted"), true);
});

test("consolidated export has every fleet category and no deleted/KTD records", async () => {
  const activity = await readFleetActivity(source, { id: "worker-2" });
  const workbook = XLSX.read(fleetActivityWorkbook(fleetActivityRows(activity)));
  assert.deepEqual(workbook.SheetNames, ["Fleet Activity"]);
  const categories = XLSX.utils.sheet_to_json<any>(workbook.Sheets["Fleet Activity"]).map(row => row.Category);
  for (const category of ["KM", "Fuel", "Daily Inspection", "Monthly Inspection", "Issue", "Workshop", "Service", "Achievement"]) {
    assert.ok(categories.includes(category), `${category} should be exported`);
  }
  assert.equal(XLSX.utils.sheet_to_json<any>(workbook.Sheets["Fleet Activity"]).some(row => row.ID === "deleted" || row.ID === "ktd"), false);
});