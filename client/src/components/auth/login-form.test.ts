import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

const source = fs.readFileSync(new URL("./login-form.tsx", import.meta.url), "utf8");
const mobileSource = fs.readFileSync(new URL("../mobile/mobile-login.tsx", import.meta.url), "utf8");

test("office selector expands only its own state at desktop breakpoints", () => {
  assert.match(source, /max-w-md md:max-w-4xl xl:max-w-6xl/);
  assert.match(source, /max-h-\[64vh\] overflow-y-auto md:max-h-none md:overflow-visible/);
  assert.doesNotMatch(source, /<p className=.*truncate.*>\{user\.(name|role)\}/);
});

test("staff login retains the narrow max-width branch", () => {
  assert.match(
    source,
    /step === "admin-list" \? "max-w-md md:max-w-4xl xl:max-w-6xl" : "max-w-md"/,
  );
  assert.match(source, /step === "staff-list"\s*\?\s*mobileStaffGroups\.map/);
});

test("both selector cards expose complete identity metadata and staff roster uses grouped department headings", () => {
  assert.match(source, /aria-label=\{`\$\{user\.name\}, \$\{user\.role\}, \$\{user\.department\}`\}/);
  assert.match(source, /MOBILE_STAFF_TEAM_GROUPS\.map/);
  assert.match(source, /group\.department/);
  assert.match(source, /group\.teams/);
  assert.match(source, /group\.team/);
  assert.match(source, /className="break-words font-semibold text-gray-900"/);
  assert.match(source, /className="mt-0\.5 break-words text-sm text-gray-600"/);
  assert.doesNotMatch(source, /<p className=.*truncate.*>\{user\.(name|role)\}/);
});

test("staff profile login never asks for or sends a PIN", () => {
  assert.doesNotMatch(source, /\bpin\b|Mobile PIN|4-digit PIN/i);
  assert.doesNotMatch(mobileSource, /\bpin\b|Mobile PIN|4-digit PIN/i);
  assert.match(source, /loginMutation\.mutate\(\{ mode: "mobile", workerId: technician\.id \}\)/);
  assert.match(mobileSource, /JSON\.stringify\(\{ workerId: profile\.id \}\)/);
});