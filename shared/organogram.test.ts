import assert from "node:assert/strict";
import test from "node:test";
import { getCanonicalWorkerName } from "./organogram";

test("worker-6 keeps the authoritative Anzel Marais name", () => {
  assert.equal(getCanonicalWorkerName("worker-6"), "Anzel Marais");
  assert.notEqual(getCanonicalWorkerName("worker-6"), "Sales 2");
});