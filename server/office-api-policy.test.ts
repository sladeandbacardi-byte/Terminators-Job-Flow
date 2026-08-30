import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import express from "express";
import { getOfficeApiAllowedRoles } from "../shared/officeApiPolicy";
import type { DashboardRole } from "../shared/dashboardRole";

test("restricted office roles cannot bypass client finance policy with direct requests", async () => {
  const app = express();
  app.use("/api", (req, res, next) => {
    const role = req.header("x-test-role") as DashboardRole;
    const pathname = req.originalUrl.split("?")[0];
    if (!getOfficeApiAllowedRoles(req.method, pathname).includes(role)) {
      return res.status(403).json({ error: "forbidden" });
    }
    next();
  });
  app.get("/api/clients/:id", (_req, res) => res.sendStatus(200));
  app.get("/api/clients/:id/payments", (_req, res) => res.sendStatus(200));
  app.post("/api/clients/:id/payments", (_req, res) => res.sendStatus(201));

  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  const request = (method: string, path: string, role: DashboardRole) =>
    fetch(`http://127.0.0.1:${address.port}${path}`, { method, headers: { "x-test-role": role } });

  try {
    assert.equal((await request("GET", "/api/clients/client-1", "sales")).status, 200);
    assert.equal((await request("GET", "/api/clients/client-1/payments", "sales")).status, 403);
    assert.equal((await request("POST", "/api/clients/client-1/payments", "service")).status, 403);
    assert.equal((await request("POST", "/api/clients/client-1/payments", "accounts")).status, 201);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});