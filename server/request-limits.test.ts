import assert from "node:assert/strict";
import test from "node:test";
import { createMemoryRateLimiter } from "./request-limits";

test("rate limiter rejects requests beyond the configured window allowance", () => {
  const limit = createMemoryRateLimiter({ windowMs: 60_000, maxRequests: 2 });

  assert.deepEqual(limit("client", 1_000), { allowed: true, retryAfterSeconds: 0 });
  assert.deepEqual(limit("client", 2_000), { allowed: true, retryAfterSeconds: 0 });
  assert.deepEqual(limit("client", 3_000), { allowed: false, retryAfterSeconds: 58 });
});

test("rate limiter permits a new window after the previous bucket expires", () => {
  const limit = createMemoryRateLimiter({ windowMs: 1_000, maxRequests: 1 });

  assert.equal(limit("client", 1_000).allowed, true);
  assert.equal(limit("client", 1_500).allowed, false);
  assert.equal(limit("client", 2_000).allowed, true);
});

test("rate limiter refuses new identities when its bounded key store is full", () => {
  const limit = createMemoryRateLimiter({
    windowMs: 60_000,
    maxRequests: 5,
    maxKeys: 1,
  });

  assert.equal(limit("first-client", 1_000).allowed, true);
  assert.deepEqual(limit("second-client", 2_000), {
    allowed: false,
    retryAfterSeconds: 59,
  });
  assert.equal(limit("first-client", 2_000).allowed, true);
});