import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import type { Worker } from "@shared/schema";

// auth-service reads this while it is dynamically imported below. Keep the
// signing secret local to this test process so expiry cases use real JWTs.
process.env.JWT_SECRET = "mobile-auth-regression-test-secret";

const canonicalWorker = (id: string, overrides: Partial<Worker> = {}): Worker => ({
  id,
  name: id,
  email: `${id}@example.test`,
  phone: null,
  role: "Technician",
  departmentId: "field",
  isActive: true,
  mobileAccessEnabled: true,
  userType: "staff",
  createdAt: new Date(),
  ...overrides,
} as Worker);

async function withServer(app: express.Express, run: (baseUrl: string) => Promise<void>) {
  const server: Server = await new Promise(resolve => {
    const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
  });
  try {
    const { port } = server.address() as AddressInfo;
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

test("mobile JWTs are isolated from office authentication and honor current worker eligibility", async t => {
  const [{ AuthService, requireAuth, requireMobileTechnician }, { storage }] = await Promise.all([
    import("./auth-service"),
    import("./storage"),
  ]);
  const workers = new Map<string, Worker>([
    ["mobile-tech-01", canonicalWorker("mobile-tech-01")],
    ["mobile-tech-02", canonicalWorker("mobile-tech-02")],
  ]);
  const originalGetWorker = storage.getWorker;
  storage.getWorker = async id => workers.get(id);

  const app = express();
  app.get("/mobile", requireMobileTechnician, (req, res) => res.json({ workerId: req.mobileWorker!.id }));
  app.get("/office", requireAuth, (_req, res) => res.sendStatus(204));

  try {
    await t.test("accepts a persisted canonical technician session", async () => {
      await withServer(app, async baseUrl => {
        const authenticated = await AuthService.authenticatePasswordlessMobileWorker("mobile-tech-01");
        assert.ok(authenticated);
        const token = authenticated.token;
        const response = await fetch(`${baseUrl}/mobile`, { headers: { authorization: `Bearer ${token}` } });
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { workerId: "mobile-tech-01" });
        await AuthService.revokeMobileWorkerSession(token);
        assert.equal(
          (await fetch(`${baseUrl}/mobile`, { headers: { authorization: `Bearer ${token}` } })).status,
          401,
        );
      });
    });

    await t.test("rejects expired, office, and ordinary admin tokens", async () => {
      await withServer(app, async baseUrl => {
        const expired = jwt.sign(
          { workerId: "mobile-tech-01", sessionId: "expired", tokenType: "mobile_worker_v3" },
          process.env.JWT_SECRET!,
          { expiresIn: -1 },
        );
        const office = jwt.sign(
          { workerId: "worker-2", tokenType: "office_worker_v1" },
          process.env.JWT_SECRET!,
          { expiresIn: "1h" },
        );
        const admin = AuthService.generateToken("worker-1");
        for (const token of [expired, office, admin]) {
          assert.equal(
            (await fetch(`${baseUrl}/mobile`, { headers: { authorization: `Bearer ${token}` } })).status,
            401,
          );
        }

        const authenticated = await AuthService.authenticatePasswordlessMobileWorker("mobile-tech-01");
        assert.ok(authenticated);
        const mobile = authenticated.token;
        assert.equal(
          (await fetch(`${baseUrl}/office`, { headers: { authorization: `Bearer ${mobile}` } })).status,
          401,
        );
        await AuthService.revokeMobileWorkerSession(mobile);
      });
    });

    await t.test("rejects a token when its technician is revoked", async () => {
      await withServer(app, async baseUrl => {
        const authenticated = await AuthService.authenticatePasswordlessMobileWorker("mobile-tech-01");
        assert.ok(authenticated);
        const token = authenticated.token;
        workers.set("mobile-tech-01", canonicalWorker("mobile-tech-01", { isActive: false }));
        assert.equal(
          (await fetch(`${baseUrl}/mobile`, { headers: { authorization: `Bearer ${token}` } })).status,
          401,
        );
        await AuthService.revokeMobileWorkerSession(token);
      });
      workers.set("mobile-tech-01", canonicalWorker("mobile-tech-01"));
    });

    await t.test("keeps a prior worker token scoped to its original worker after switching", async () => {
      await withServer(app, async baseUrl => {
        const first = await AuthService.authenticatePasswordlessMobileWorker("mobile-tech-01");
        assert.ok(first);
        await AuthService.revokeMobileWorkerSession(first.token);
        const second = await AuthService.authenticatePasswordlessMobileWorker("mobile-tech-02");
        assert.ok(second);
        assert.equal((await fetch(`${baseUrl}/mobile`, { headers: { authorization: `Bearer ${first.token}` } })).status, 401);
        const response = await fetch(`${baseUrl}/mobile`, { headers: { authorization: `Bearer ${second.token}` } });
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { workerId: "mobile-tech-02" });
        await AuthService.revokeMobileWorkerSession(second.token);
      });
    });
  } finally {
    storage.getWorker = originalGetWorker;
  }
});

test("mobile route classification keeps mobile session endpoints out of office auth", async () => {
  const { isMobileProtectedRoute } = await import("./routes");
  for (const [method, path] of [
    ["GET", "/api/mobile/fleet/overview"],
    ["GET", "/api/auth/mobile-session"],
    ["POST", "/api/auth/mobile-logout"],
  ] as const) {
    assert.equal(isMobileProtectedRoute(method, path), true, `${method} ${path}`);
  }
});