import test from "node:test";
import assert from "node:assert/strict";
import { clearAllAuth, readMobileSession, storeMobileSession } from "./mobile-auth";

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

const session = { workerId: "worker-a", token: "token-a", worker: { id: "worker-a", role: "Technician", name: "A" } };

test("switching mobile users clears prior identity before storing the new session", () => {
  const storage = new MemoryStorage();
  storeMobileSession(session, storage);
  storage.setItem("auth_token", "office-token");
  storeMobileSession({ ...session, workerId: "worker-b", token: "token-b", worker: { id: "worker-b" } }, storage);
  assert.equal(storage.getItem("auth_token"), null);
  assert.equal(readMobileSession(storage)?.workerId, "worker-b");
});

test("mixed office and mobile local state is rejected and cleared", () => {
  const storage = new MemoryStorage();
  storeMobileSession(session, storage);
  storage.setItem("auth_user", "{}");
  assert.equal(readMobileSession(storage), null);
  assert.equal(storage.values.size, 0);
});

test("malformed or incomplete mobile state is rejected and cleared", () => {
  const storage = new MemoryStorage();
  storage.setItem("mobile_worker_id", "worker-a");
  storage.setItem("mobile_session_token", "token-a");
  storage.setItem("mobile_worker_data", "{not-json");
  assert.equal(readMobileSession(storage), null);
  assert.equal(storage.values.size, 0);
  storage.setItem("mobile_worker_id", "worker-a");
  assert.equal(readMobileSession(storage), null);
  assert.equal(storage.values.size, 0);
});

test("clearAllAuth clears both auth namespaces", () => {
  const storage = new MemoryStorage();
  storeMobileSession(session, storage);
  storage.setItem("auth_token", "office-token");
  storage.setItem("selected_login_mode", "mobile");
  clearAllAuth(storage);
  assert.equal(storage.values.size, 0);
});