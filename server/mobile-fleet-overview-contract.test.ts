import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("mobile overview publishes confirmed vehicle and inspection configuration contract", () => {
  const routes = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
  const start = routes.indexOf('app.get("/api/mobile/fleet/overview"');
  const end = routes.indexOf('app.post("/api/mobile/fleet/km-logs"', start);
  const handler = routes.slice(start, end);
  for (const key of [
    "todayVehicleConfirmed", "selectedToday", "mobileInspectionConfiguration",
    "dailyInspectionItems", "monthlyInspectionItems", "templateId",
  ]) assert.match(handler + readFileSync(new URL("./fleet-configuration.ts", import.meta.url), "utf8"), new RegExp(key));
  assert.match(handler, /vehicle: vehicle \? \{ \.\.\.vehicle, selectedToday: true \}/);
});

test("all mobile Fleet creates resolve the today-confirmed vehicle", () => {
  const routes = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
  for (const endpoint of ["km-logs", "fuel-fillups", "inspections", "issues"]) {
    const start = routes.indexOf(`app.post("/api/mobile/fleet/${endpoint}"`);
    assert.notEqual(start, -1);
    assert.match(routes.slice(start, start + 900), /getMobileVehicle\(/);
  }
  assert.match(routes, /prepareInspectionSubmission\(templateId, req\.body\.items\)/);
  assert.match(routes, /writeInspectionSnapshot\(result\.record\.id, prepared\.snapshot\)/);
  const configuration = readFileSync(new URL("./fleet-configuration.ts", import.meta.url), "utf8");
  assert.match(configuration, /const templateId = `canonical-\$\{type\}-v1`/);
  assert.match(configuration, /templateId: template\.id/);
  assert.match(configuration, /\/\^canonical-\(daily\|monthly\)-v1\$\/\.test\(templateId\)/);
});

test("daily photo create and read routes retain authentication and server-derived template enforcement", () => {
  const routes = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
  const mobileStart = routes.indexOf('app.post("/api/mobile/fleet/inspections"');
  const mobileHandler = routes.slice(mobileStart, routes.indexOf('app.post("/api/mobile/fleet/issues"', mobileStart));
  assert.match(mobileHandler, /requireMobileTechnician/);
  assert.match(mobileHandler, /prepared\.inspectionType !== requestedInspectionType/);
  assert.match(mobileHandler, /required: inspectionType === "daily"/);
  const officeStart = routes.indexOf('app.get("/api/fleet/inspections"');
  const officeHandlers = routes.slice(officeStart, routes.indexOf('app.patch("/api/fleet/inspections', officeStart));
  assert.match(officeHandlers, /requireAuth/);
  assert.match(officeHandlers, /required: true, label: "Daily vehicle-check photo"/);
  assert.match(routes, /app\.use\("\/api\/fleet", requireAuth/);
  assert.match(routes, /canReadFleetRecord/);
});