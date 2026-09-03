import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { test } from "node:test";

export const fleetDesktopContracts = [
  "GET /api/fleet/activity",
  "GET /api/fleet/activity.xlsx",
  "POST /api/fleet/send-weekly-summary",
  "GET|POST /api/fleet/settings",
  "GET|POST /api/fleet/inspection-templates",
  "POST /api/fleet/inspection-templates/:id/archive",
  "POST /api/fleet/inspection-templates/:id/restore",
  "PATCH /api/fleet/inspection-templates/:templateId/items/:itemId",
  "PATCH /api/fleet/:kind/:id/correction",
  "POST /api/fleet/:kind/:id/soft-delete",
  "POST /api/fleet/:kind/:id/restore",
  "GET|POST /api/fleet/vehicles",
  "PATCH /api/fleet/issues/:id",
];

export const fleetDesktopCriticalLabels = [
  "Fleet Dashboard",
  "Fleet History",
  "Vehicles",
  "Report Issue",
  "More",
  "Fleet Settings",
  "Daily Inspections",
  "Monthly Inspections",
  "KM Logs",
  "Fuel Fill-ups",
  "Maintenance / Workshop",
  "Audit Trail",
  "Export Fleet Activity XLSX",
  "Queue Weekly Summary",
];

const workspace = readFileSync("client/src/components/fleet/FleetWorkspace.tsx", "utf8");
const dataHook = readFileSync("client/src/components/fleet/useFleetData.ts", "utf8");
const appRoutes = readFileSync("client/src/App.tsx", "utf8");

test("desktop Fleet wires every real API contract", () => {
  for (const endpoint of [
    "/api/fleet/activity", "/api/fleet/activity.xlsx", "/api/fleet/send-weekly-summary",
    "/api/fleet/settings", "/api/fleet/inspection-templates", "/api/fleet/vehicles",
    "/api/fleet/issues/",
  ]) {
    assert.ok(workspace.includes(endpoint) || dataHook.includes(endpoint), `Missing Fleet endpoint wiring: ${endpoint}`);
  }
  for (const action of ["/correction", "soft-delete", "restore", "archive"]) {
    assert.ok(workspace.includes(action), `Missing Fleet action wiring: ${action}`);
  }
});

test("desktop Fleet retains critical navigation and operational labels", () => {
  for (const label of fleetDesktopCriticalLabels) {
    assert.ok(workspace.includes(label), `Missing Fleet label: ${label}`);
  }
});

test("canonical and legacy Fleet routes resolve to the native workspace", () => {
  for (const route of [
    "/fleet/history", "/fleet/vehicles", "/fleet/settings", "/fleet/issues",
    "/operations/fleet", "/operations/fleet/vehicles", "/operations/fleet/inspections",
    "/operations/fleet/faults", "/operations/fleet/service-history", "/operations/fleet/reports",
  ]) {
    assert.ok(appRoutes.includes(`path="${route}"`), `Missing Fleet route: ${route}`);
  }
});