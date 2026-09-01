import test from "node:test";
import assert from "node:assert/strict";
import {
  FORBIDDEN_REGISTRATION,
  buildReconciliationPlan,
  fleetGuardNativeId,
  fleetGuardKmDailyTargetId,
  groupFleetGuardKmEvents,
  nativeSourceFingerprint,
  normalizeName,
  normalizeRegistration,
  sanitizeFuelLog,
  sourceIdForRow,
  stripFuelStationData,
} from "./fleetguard-reconciliation";

test("normalizes registrations for stable matching", () => {
  assert.equal(normalizeRegistration("ktd 136 ec"), FORBIDDEN_REGISTRATION);
  assert.equal(normalizeRegistration(" KTZ-909 EC "), "KTZ909EC");
});

test("dry-run plan excludes forbidden vehicle children", () => {
  const plan = buildReconciliationPlan({
    vehicles: [
      { id: "allowed", registration: "KTZ909EC" },
      { id: "forbidden", registration: "KTD136EC" },
    ],
    km_logs: [
      { id: "allowed-km", vehicle_id: "allowed" },
      { id: "forbidden-km", vehicle_id: "forbidden" },
    ],
  });
  assert.equal(plan.counts.vehicles.excluded, 1);
  assert.equal(plan.counts.km_logs.excluded, 1);
  assert.equal(plan.counts.km_logs.imported, 1);
});

test("rerunning with an existing mapping is unchanged and adds no import", () => {
  const plan = buildReconciliationPlan(
    { audit_log: [{ id: "a1", action: "update" }] },
    new Set(["audit_log:a1"]),
  );
  assert.equal(plan.counts.audit_log.unchanged, 1);
  assert.equal(plan.counts.audit_log.imported, 0);
});

test("missing vehicle registration is quarantined", () => {
  const plan = buildReconciliationPlan({
    vehicles: [{ id: "missing-registration" }],
  });
  assert.equal(plan.counts.vehicles.conflicted, 1);
  assert.equal(plan.conflicts[0]?.reason, "MISSING_REGISTRATION");
});

test("driver name normalization is deterministic", () => {
  assert.equal(normalizeName("Re-Althon"), "re althon");
  assert.equal(normalizeName("  Re  Althon "), "re althon");
});

test("ID-less settings rows receive a deterministic source fingerprint", () => {
  const row = { email_enabled: true, recipients: ["owner@example.test"] };
  const first = sourceIdForRow("notification_settings", row);
  const second = sourceIdForRow("notification_settings", { recipients: ["owner@example.test"], email_enabled: true });
  assert.match(first, /^fingerprint-[a-f0-9]{64}$/);
  assert.equal(first, second);
});

test("native FleetGuard materialisation IDs are idempotent, source-isolated, and retain their type prefix", () => {
  const first = fleetGuardNativeId("fuel", "source-fuel-event-1");
  const second = fleetGuardNativeId("fuel", "source-fuel-event-1");
  assert.match(first, /^fg-fuel-[a-f0-9]{32}$/);
  assert.equal(first, second);
  assert.notEqual(first, fleetGuardNativeId("km", "source-fuel-event-1"));
});

test("forbidden daily-check child payloads are excluded before native materialisation", () => {
  const plan = buildReconciliationPlan({
    vehicles: [{ id: "forbidden-vehicle", registration: "KTD 136 EC" }],
    daily_checks: [{ id: "forbidden-check", vehicle_id: "forbidden-vehicle" }],
    daily_check_items: [{ id: "forbidden-item", daily_check_id: "forbidden-check" }],
  });
  assert.equal(plan.counts.daily_checks.excluded, 1);
  assert.equal(plan.counts.daily_check_items.excluded, 1);
  assert.equal(plan.counts.daily_check_items.imported, 0);
});

test("groups individual AM/PM source events into one ordered native daily target", () => {
  const events = [
    { id: "pm", vehicle_id: "vehicle-1", driver_id: "driver-1", date: "2026-02-10", log_type: "PM", odometer_km: 180, created_at: "2026-02-10T16:00:00Z" },
    { id: "am", vehicle_id: "vehicle-1", driver_id: "driver-1", date: "2026-02-10", log_type: "AM", odometer_km: 125, created_at: "2026-02-10T06:00:00Z" },
  ];
  const groups = groupFleetGuardKmEvents(events);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].map(row => row.id), ["am", "pm"]);
  assert.equal(
    fleetGuardKmDailyTargetId("vehicle-1", "2026-02-10"),
    fleetGuardKmDailyTargetId("vehicle-1", "2026-02-10T20:00:00Z"),
  );
});

test("native fingerprints are stable for reordered source keys and change with a source event", () => {
  const first = { id: "am", vehicle_id: "vehicle-1", log_type: "AM", odometer_km: 100 };
  const reordered = { odometer_km: 100, log_type: "AM", vehicle_id: "vehicle-1", id: "am" };
  const changed = { ...first, odometer_km: 101 };
  assert.equal(nativeSourceFingerprint(first), nativeSourceFingerprint(reordered));
  assert.notEqual(nativeSourceFingerprint(first), nativeSourceFingerprint(changed));
});

test("fuel station keys are recursively stripped, including JSON notes and metadata", () => {
  const cleaned = stripFuelStationData({
    id: "fuel-1",
    station_name: "Do not retain",
    nested: [{ fuelStation: "Do not retain", litres: 42 }],
    notes: JSON.stringify({ station: "Do not retain", receipt: { fuel_station: "Do not retain", valid: true } }),
    metadata: { STATION: "Do not retain", fuelType: "diesel" },
  });
  assert.deepEqual(cleaned, {
    id: "fuel-1",
    nested: [{ litres: 42 }],
    notes: JSON.stringify({ receipt: { valid: true } }),
    metadata: { fuelType: "diesel" },
  });
});

test("import planning and fingerprints cannot retain fuel station data", () => {
  const source = {
    vehicles: [{ id: "missing-registration", station: "Do not retain", nested: { Station_Name: "Do not retain" } }],
  };
  const plan = buildReconciliationPlan(source);
  assert.equal(JSON.stringify(plan).toLowerCase().includes("station"), false);
  assert.equal(
    nativeSourceFingerprint({ id: "fuel-1", station_name: "old station", litres: 10 }),
    nativeSourceFingerprint({ id: "fuel-1", litres: 10 }),
  );
  assert.equal(
    sourceIdForRow("fuel_logs", { litres: 10, fuel_station: "old station" }),
    sourceIdForRow("fuel_logs", { litres: 10 }),
  );
});

test("fuel-log persistence sanitizer is a strict allowlist and removes station and OCR payloads", () => {
  const sanitized = sanitizeFuelLog({
    id: "fuel-1",
    vehicle_id: "vehicle-1",
    driver_id: "driver-1",
    fill_date: "2026-02-10T08:00:00Z",
    litres: 42,
    amount: 1234.5,
    odometer_km: 10123,
    fuelType: "Diesel",
    receipt_photo: "https://files.example/receipt.jpg",
    station_name: "Must never persist",
    ocr_text: "Must never persist",
    metadata: { station: "Must never persist", ocr: { text: "Must never persist" } },
    notes: "untrusted free-form source text",
  });
  assert.deepEqual(sanitized, {
    id: "fuel-1",
    vehicle_id: "vehicle-1",
    driver_id: "driver-1",
    fill_date: "2026-02-10T08:00:00Z",
    litres: 42,
    amount: 1234.5,
    odometer_km: 10123,
    fuelType: "Diesel",
    receipt_photo: "https://files.example/receipt.jpg",
  });
  assert.equal(JSON.stringify(sanitized).toLowerCase().includes("station"), false);
  assert.equal(JSON.stringify(sanitized).toLowerCase().includes("ocr"), false);
});

test("fuel fingerprints use the strict sanitized payload", () => {
  const nativeFields = {
    id: "fuel-1", vehicle_id: "vehicle-1", driver_id: "driver-1",
    litres: 42, amount: 1234.5, odometer_km: 10123,
    fuel_type: "Diesel", receipt_photo: "https://files.example/receipt.jpg",
  };
  const contaminated = {
    ...nativeFields, station: "Do not retain", ocr_data: { text: "Do not retain" },
    notes: "untrusted OCR transcript",
  };
  assert.equal(nativeSourceFingerprint(sanitizeFuelLog(contaminated)), nativeSourceFingerprint(sanitizeFuelLog(nativeFields)));
});