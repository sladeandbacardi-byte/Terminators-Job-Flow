import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import bcrypt from "bcryptjs";
import { createPasswordLoginHandler, createPasswordlessOfficeLoginHandler } from "./office-auth-http";
import { enforceOfficeApiAccess } from "./office-access-middleware";
import type { AuthenticatedUser } from "./auth-service";
import { normalizeDeploymentSecret } from "./office-account-policy";

const officeUser = (id: string, role: string, departmentId: string): AuthenticatedUser => ({
  id,
  username: `${id}@example.test`,
  email: `${id}@example.test`,
  passwordHash: "must-never-be-returned",
  firstName: "Office",
  lastName: "User",
  role,
  isActive: true,
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  sourceWorkerId: id,
  sourceWorkerName: "Office User",
  sourceWorkerRole: role,
  sourceWorkerDepartmentId: departmentId,
  authenticationMethod: "passwordless_office",
});

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

test("office login request rejects Julien, creates a safe restricted session response, and rate limits attempts", async () => {
  const app = express();
  app.use(express.json());
  let requests = 0;
  app.post("/api/auth/office-login", createPasswordlessOfficeLoginHandler({
    authenticate: async workerId => workerId === "worker-6"
      ? { user: officeUser(workerId, "Sales Rep", "div-5"), token: "revocable-session-token" }
      : null,
    rateLimit: () => (++requests > 2
      ? { allowed: false, retryAfterSeconds: 60 }
      : { allowed: true, retryAfterSeconds: 0 }),
    clientKey: () => "test-client",
    logLogin: async () => {},
  }));

  await withServer(app, async baseUrl => {
    const julien = await fetch(`${baseUrl}/api/auth/office-login`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workerId: "worker-1" }),
    });
    assert.equal(julien.status, 401);

    const sales = await fetch(`${baseUrl}/api/auth/office-login`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workerId: "worker-6" }),
    });
    assert.equal(sales.status, 200);
    const body = await sales.json() as any;
    assert.equal(body.user.authenticationMethod, "passwordless_office");
    assert.equal("passwordHash" in body.user, false);

    const limited = await fetch(`${baseUrl}/api/auth/office-login`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workerId: "worker-6" }),
    });
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get("retry-after"), "60");
  });
});

test("office login rejects malformed worker IDs before aggregate rate-limit keys are constructed", async () => {
  const app = express();
  app.use(express.json());
  let limiterCalls = 0;
  app.post("/api/auth/office-login", createPasswordlessOfficeLoginHandler({
    authenticate: async () => null,
    rateLimit: () => {
      limiterCalls++;
      return { allowed: true, retryAfterSeconds: 0 };
    },
    clientKey: () => "2001:db8::1",
    logLogin: async () => {},
  }));
  await withServer(app, async baseUrl => {
    for (const workerId of ["worker-7", "worker-2:forged", "random-worker"]) {
      const response = await fetch(`${baseUrl}/api/auth/office-login`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workerId }),
      });
      assert.equal(response.status, 400);
    }
    assert.equal(limiterCalls, 0);
  });
});

test("selecting Julien follows the password route and accepts the normalized leading-hash deployment secret only", async () => {
  const storedHash = await bcrypt.hash(normalizeDeploymentSecret('  "#release-password"  '), 4);
  const julien = officeUser("worker-1", "Operations Manager", "div-6");
  const app = express();
  app.use(express.json());
  app.get("/api/auth/staff", (_req, res) => res.json({
    staff: [],
    admins: [{ id: "worker-1", name: "Julien Botha", username: "admin", role: "Super Administrator", department: "Admin", authMethod: "password" }],
  }));
  app.post("/api/auth/admin-login", createPasswordLoginHandler({
    authenticate: async (username, password) =>
      username === "admin" && await bcrypt.compare(password, storedHash)
        ? { user: julien, token: "julien-session-token" }
        : null,
  }));

  await withServer(app, async baseUrl => {
    const directory = await fetch(`${baseUrl}/api/auth/staff`).then(response => response.json()) as any;
    const selected = directory.admins.find((admin: any) => admin.name === "Julien Botha");
    assert.equal(selected.authMethod, "password");

    const valid = await fetch(`${baseUrl}/api/auth/admin-login`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: selected.username, password: "#release-password" }),
    });
    assert.equal(valid.status, 200);
    assert.equal("passwordHash" in await valid.json().then((body: any) => body.user), false);

    const wrong = await fetch(`${baseUrl}/api/auth/admin-login`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: selected.username, password: "#release-wrong" }),
    });
    assert.equal(wrong.status, 401);
  });
});

test("department managers can reach their operations API but cannot reach admin, finance or profit APIs", async () => {
  const app = express();
  app.use((req: any, _res, next) => {
    req.user = officeUser("worker-3", "Hygiene Services Manager", "div-6");
    req.user.sourceWorkerId = "worker-3";
    req.user.sourceWorkerName = "Mariette Koekemoer";
    next();
  });
  app.get("/api/backup/logs", enforceOfficeApiAccess, (_req, res) => res.json({ ok: true }));
  app.get("/api/invoices", enforceOfficeApiAccess, (_req, res) => res.json({ ok: true }));
  app.get("/api/dashboard/revenue-chart", enforceOfficeApiAccess, (_req, res) => res.json({ ok: true }));
  app.get("/api/jobs", enforceOfficeApiAccess, (_req, res) => res.json([
    { id: "hygiene", departmentId: "div-2" },
    { id: "pest", departmentId: "div-1" },
  ]));

  await withServer(app, async baseUrl => {
    assert.equal((await fetch(`${baseUrl}/api/backup/logs`)).status, 403);
    assert.equal((await fetch(`${baseUrl}/api/invoices`)).status, 403);
    assert.equal((await fetch(`${baseUrl}/api/dashboard/revenue-chart`)).status, 403);
    const jobs = await fetch(`${baseUrl}/api/jobs`);
    assert.equal(jobs.status, 200);
    assert.deepEqual(await jobs.json(), [{ id: "hygiene", departmentId: "div-2" }]);
    assert.equal((await fetch(`${baseUrl}/api/jobs?departmentId=div-1`)).status, 403);
    assert.equal((await fetch(`${baseUrl}/api/jobs?departmentId=div-2`)).status, 200);
  });
});