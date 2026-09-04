import assert from "node:assert/strict";
import test from "node:test";
import { canReadFleetRecord, isKtdVehicle } from "./fleet-scope";

const vehicles = new Map([
  ["pest", { id: "pest", departmentId: "div-1", registration: "ABC 123" }],
  ["ktd", { id: "ktd", departmentId: "div-1", registration: "KTD136EC" }],
]);
test("fleet scope prevents IDOR and always excludes KTD136EC", () => {
  assert.equal(canReadFleetRecord({ id: "mobile-tech-03" }, { vehicleId: "pest", workerId: "mobile-tech-03" }, vehicles), true);
  assert.equal(canReadFleetRecord({ id: "mobile-tech-03" }, { vehicleId: "pest", workerId: "mobile-tech-09" }, vehicles), false);
  assert.equal(canReadFleetRecord({ id: "worker-2" }, { vehicleId: "pest", workerId: "mobile-tech-09" }, vehicles), true);
  assert.equal(canReadFleetRecord({ id: "worker-1" }, { vehicleId: "ktd", workerId: "worker-1" }, vehicles), false);
  assert.equal(isKtdVehicle(vehicles.get("ktd")), true);
});

test("inspection evidence inherits the record authorization boundary", () => {
  const inspectionWithPhoto = {
    vehicleId: "pest", workerId: "mobile-tech-03",
    photoUrl: "data:image/png;base64,private-evidence",
  };
  assert.equal(canReadFleetRecord({ id: "mobile-tech-03" }, inspectionWithPhoto, vehicles), true);
  assert.equal(canReadFleetRecord({ id: "mobile-tech-09" }, inspectionWithPhoto, vehicles), false);
  assert.equal(canReadFleetRecord({ id: "worker-1" }, inspectionWithPhoto, vehicles), true);
});