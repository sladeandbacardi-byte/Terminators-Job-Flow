import assert from "node:assert/strict";
import test from "node:test";
import { getCanonicalWorkerName, MOBILE_STAFF_ROSTER, OFFICE_ORGANOGRAM_WORKER_IDS } from "./organogram";

test("worker-6 keeps the authoritative Anzel Marais name", () => {
  assert.equal(getCanonicalWorkerName("worker-6"), "Anzel Marais");
  assert.notEqual(getCanonicalWorkerName("worker-6"), "Sales 2");
});

test("2026 selector rosters preserve the authoritative six office and nine mobile split", () => {
  assert.equal(OFFICE_ORGANOGRAM_WORKER_IDS.length, 6);
  assert.equal(OFFICE_ORGANOGRAM_WORKER_IDS[0], "worker-1");
  assert.equal(OFFICE_ORGANOGRAM_WORKER_IDS[5], "worker-6");
  assert.deepEqual(MOBILE_STAFF_ROSTER.map(worker => worker.name).sort(), [
    "Garth du Preez", "Jackie Roelfse", "Leon Coltman", "Michael Meyer",
    "Re-Althon", "Reece Ebrahim", "Xolani Ndzotoyi", "Zain Abdol", "Zuki Sandi",
  ].sort());
  assert.equal(new Set(MOBILE_STAFF_ROSTER.map(worker => worker.id)).size, 9);
  assert.deepEqual(
    MOBILE_STAFF_ROSTER.reduce<Record<string, string[]>>((groups, worker) => {
      (groups[worker.team] ??= []).push(worker.name);
      return groups;
    }, {}),
    {
      "Sanitary Bin Service A Team": ["Re-Althon"],
      "Sanitary Bin Service B Team": ["Jackie Roelfse"],
      "Washroom Services": ["Zain Abdol"],
      "Ablution Deep Cleaning": ["Zuki Sandi"],
      "Pest Control Team": ["Reece Ebrahim", "Garth du Preez", "Michael Meyer", "Xolani Ndzotoyi", "Leon Coltman"],
    },
  );
  const officeNames = new Set([
    "Julien Botha", "Juli Holtshausen", "Mariette Koekemoer",
    "Maryka Venter", "Anzel Marais", "Sheryl-Lyn Lee",
  ]);
  assert.equal(MOBILE_STAFF_ROSTER.some(worker => officeNames.has(worker.name)), false);
});