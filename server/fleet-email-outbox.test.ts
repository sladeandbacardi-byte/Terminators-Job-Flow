import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_FLEET_EMAIL_RECIPIENTS, failedInspectionEmail, fleetEmailRecipients, fleetFuelEmail, fleetMessageId, fleetWeeklySummaryEmail, retryDelaySeconds } from "./fleet-email-outbox";

test("fleet recipients default safely and accept valid configuration", () => {
  assert.deepEqual(DEFAULT_FLEET_EMAIL_RECIPIENTS, ["julien@terminators.co.za", "accounts@terminators.co.za"]);
  assert.deepEqual(fleetEmailRecipients("Julien@example.com, accounts@example.com;Julien@example.com"), ["julien@example.com", "accounts@example.com"]);
  assert.throws(() => fleetEmailRecipients("not-an-email"), /valid comma-separated/);
});

test("fuel template excludes station details", () => {
  const email = fleetFuelEmail({ id: "fuel-1", vehicleId: "vehicle-1", workerId: "worker-1", fillDate: new Date("2026-01-01T10:00:00Z"), odometer: 1200, litres: "40", cost: "900", fuelType: "Diesel" });
  assert.doesNotMatch(`${email.subject}\n${email.text}\n${email.html}`.toLowerCase(), /station/);
  assert.equal(email.eventKey, "fleet:fuel:fuel-1");
});

test("inspection event key deduplicates a failed inspection", () => {
  const email = failedInspectionEmail({ id: "inspection-1", vehicleId: "v", workerId: "w", inspectionDate: new Date(), itemsJson: "[]" });
  assert.equal(email.eventKey, "fleet:inspection-failed:inspection-1");
});

test("fleet retry delay exponentially backs off and caps", () => {
  assert.equal(retryDelaySeconds(1), 60);
  assert.equal(retryDelaySeconds(2), 120);
  assert.equal(retryDelaySeconds(99), 6 * 60 * 60);
});

test("weekly summary has a deterministic weekly deduplication key", () => {
  const summary = { subject: "Fleet summary", text: "text", html: "<p>html</p>" };
  assert.equal(
    fleetWeeklySummaryEmail(summary, new Date("2026-01-05T08:00:00Z")).eventKey,
    fleetWeeklySummaryEmail(summary, new Date("2026-01-06T08:00:00Z")).eventKey,
  );
});

test("retry delivery uses a deterministic Message-ID for provider-side deduplication", () => {
  assert.equal(fleetMessageId("fleet:fuel:one"), fleetMessageId("fleet:fuel:one"));
  assert.match(fleetMessageId("fleet:fuel:one"), /^<[-_A-Za-z0-9]+@jobflow-fleet>$/);
});