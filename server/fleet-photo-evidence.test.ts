import assert from "node:assert/strict";
import test from "node:test";
import { fleetPhotoEvidence, FLEET_PHOTO_MAX_BYTES } from "./fleet-photo-evidence";

const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB";
const jpeg = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ";
const webp = "data:image/webp;base64,UklGRgQAAABXRUJQ";

test("Fleet evidence accepts supported image data URLs and preserves exact bytes", () => {
  for (const value of [png, jpeg, webp]) assert.equal(fleetPhotoEvidence(value, { required: true, label: "Daily vehicle-check photo" }), value);
});

test("daily evidence is required while optional monthly evidence may remain absent", () => {
  assert.throws(() => fleetPhotoEvidence(null, { required: true, label: "Daily vehicle-check photo" }), /required/);
  assert.equal(fleetPhotoEvidence(null, { required: false, label: "Monthly inspection photo" }), null);
});

test("Fleet evidence rejects unsupported, malformed, mismatched and oversized images", () => {
  const options = { required: true, label: "Daily vehicle-check photo" };
  assert.throws(() => fleetPhotoEvidence("data:image/gif;base64,R0lGODlh", options), /JPG/);
  assert.throws(() => fleetPhotoEvidence("data:image/png;base64,not base64", options), /JPG/);
  assert.throws(() => fleetPhotoEvidence("data:image/png;base64,/9j/4AAQSkZJRgABAQ", options), /JPG/);
  const oversized = `data:image/jpeg;base64,${Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(FLEET_PHOTO_MAX_BYTES)]).toString("base64")}`;
  assert.throws(() => fleetPhotoEvidence(oversized, options), /2 MB/);
});