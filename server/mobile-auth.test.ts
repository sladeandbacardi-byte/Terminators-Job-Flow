import assert from "node:assert/strict";
import test from "node:test";
import bcrypt from "bcryptjs";
import { AuthService } from "./auth-service";

test("mobile PIN authentication accepts only a matching four-digit bcrypt credential", async () => {
  const worker = { pin: await bcrypt.hash("2468", 4) } as any;
  assert.equal(await AuthService.verifyMobileWorkerPin(worker, "2468"), true);
  assert.equal(await AuthService.verifyMobileWorkerPin(worker, "1357"), false);
  assert.equal(await AuthService.verifyMobileWorkerPin(worker, "24680"), false);
});

test("mobile PIN authentication fails closed for missing and legacy plaintext credentials", async () => {
  assert.equal(await AuthService.verifyMobileWorkerPin({ pin: null } as any, "2468"), false);
  assert.equal(await AuthService.verifyMobileWorkerPin({ pin: "2468" } as any, "2468"), false);
});