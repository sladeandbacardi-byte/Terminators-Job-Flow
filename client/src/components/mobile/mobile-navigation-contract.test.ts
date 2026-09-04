import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getStaffAccessProfile } from "../../../../shared/permissionMatrix";
import {
  allowedMobileNavigation,
  canAccessMobileScreen,
  isMobileViewport,
  MOBILE_NAVIGATION,
} from "./mobile-navigation-contract";

test("mobile navigation only exposes areas granted to the technician", () => {
  assert.deepEqual(
    allowedMobileNavigation(["dashboard", "jobs", "calendar", "time:self", "fleet"]).map(item => item.id),
    ["home", "jobs", "my-time", "my-day", "calendar", "opportunities", "fleet"],
  );
  assert.deepEqual(
    allowedMobileNavigation(["dashboard", "jobs"]).map(item => item.id),
    ["home", "jobs", "opportunities"],
  );
});

test("crafted mobile screen URLs cannot bypass the same permission contract", () => {
  assert.equal(canAccessMobileScreen("fleet", ["dashboard", "jobs"]), false);
  assert.equal(canAccessMobileScreen("fleet", ["dashboard", "fleet"]), true);
  assert.equal(canAccessMobileScreen("fuel", ["dashboard", "fleet"]), true);
  assert.equal(canAccessMobileScreen("opportunities", ["dashboard", "jobs"]), true);
  assert.equal(canAccessMobileScreen("unknown-admin-screen", ["system-admin"]), false);
});

test("normal supervisors and Julien receive only permission-derived mobile areas", () => {
  const supervisor = getStaffAccessProfile({ id: "mobile-tech-01" });
  const julien = getStaffAccessProfile({ id: "worker-1" });
  assert.ok(supervisor);
  assert.ok(julien);
  assert.deepEqual(
    allowedMobileNavigation(supervisor.permissions).map(item => item.id),
    ["home", "jobs", "my-time", "my-day", "calendar", "opportunities", "fleet"],
  );
  assert.deepEqual(
    allowedMobileNavigation(julien.permissions).map(item => item.id),
    ["home", "jobs", "my-time", "my-day", "calendar", "opportunities", "fleet"],
  );
  assert.equal(MOBILE_NAVIGATION.some(item =>
    item.href?.startsWith("/finance") || item.href?.startsWith("/sales") || item.href?.startsWith("/admin")
  ), false);
});

test("responsive contract treats phone widths as mobile and tablet widths as desktop", () => {
  assert.equal(isMobileViewport(767), true);
  assert.equal(isMobileViewport(768), false);
});

test("mobile shell preserves the Fleet launcher and accessible dismissal contracts", () => {
  const source = readFileSync(new URL("./mobile-shell.tsx", import.meta.url), "utf8");
  assert.match(source, /hideHeader &&/);
  assert.match(source, /data-testid="mobile-menu-toggle"/);
  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /event\.key === "Escape"/);
  assert.match(source, /addEventListener\("popstate"/);
  assert.match(source, /document\.body\.style\.overflow = "hidden"/);
});