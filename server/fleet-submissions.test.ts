import assert from "node:assert/strict";
import test from "node:test";
import { fleetSubmissionKey, withFleetSubmissionTransaction } from "./fleet-submissions";

test("fleet submission keys preserve valid client retry IDs and reject invalid values", () => {
  assert.equal(fleetSubmissionKey("mobile:fuel:01JABCDEF1234567"), "mobile:fuel:01JABCDEF1234567");
  assert.throws(() => fleetSubmissionKey("too short"), /valid submission key/);
  assert.throws(() => fleetSubmissionKey(undefined), /valid submission key/);
});

test("fleet submission transaction commits only after domain and outbox work succeeds", async () => {
  const calls: string[] = [];
  const client = { query: async (statement: string) => { calls.push(statement); return { rows: [] }; } };
  const result = await withFleetSubmissionTransaction(client as any, async () => {
    calls.push("domain");
    calls.push("outbox");
    return "saved";
  });
  assert.equal(result, "saved");
  assert.deepEqual(calls, ["BEGIN", "domain", "outbox", "COMMIT"]);
});

test("fleet submission transaction rolls both writes back when outbox work fails", async () => {
  const calls: string[] = [];
  const client = { query: async (statement: string) => { calls.push(statement); return { rows: [] }; } };
  await assert.rejects(() => withFleetSubmissionTransaction(client as any, async () => {
    calls.push("domain");
    throw new Error("outbox insert failed");
  }), /outbox insert failed/);
  assert.deepEqual(calls, ["BEGIN", "domain", "ROLLBACK"]);
});