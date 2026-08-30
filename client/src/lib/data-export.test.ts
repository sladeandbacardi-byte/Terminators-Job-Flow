import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { exportLeads, exportTimeBalanceReport, exportToCSV } from "./data-export";

let lastBlob: Blob | undefined;
const originalDocument = (globalThis as any).document;
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

function mockDownload() {
  lastBlob = undefined;
  (globalThis as any).document = {
    createElement: () => ({
      setAttribute: () => {},
      style: {},
      click: () => {},
    }),
    body: {
      appendChild: () => {},
      removeChild: () => {},
    },
  };
  URL.createObjectURL = (blob: Blob) => {
    lastBlob = blob;
    return "blob:test";
  };
  URL.revokeObjectURL = () => {};
}

async function downloadedCSV(): Promise<string> {
  assert.ok(lastBlob, "export should create a Blob");
  return lastBlob.text();
}

afterEach(() => {
  (globalThis as any).document = originalDocument;
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
});

test("generic CSV exports neutralize formula prefixes without changing numbers", async () => {
  mockDownload();
  exportToCSV([
    {
      direct: '=HYPERLINK("https://attacker.example")',
      plus: "+CMD",
      minus: "-CMD",
      at: "@SUM(A1)",
      whitespace: " \t=HYPERLINK(\"https://attacker.example\")",
      quoted: '=SUM("A1"),\nnext line',
      number: -42,
    },
  ], "test");

  const csv = await downloadedCSV();
  assert.match(csv, /'=HYPERLINK/);
  assert.match(csv, /'\+CMD/);
  assert.match(csv, /'-CMD/);
  assert.match(csv, /'@SUM/);
  assert.match(csv, /' \t=HYPERLINK/);
  assert.match(csv, /"'=SUM\(""A1""\),\nnext line"/);
  assert.match(csv, /-42/);
  assert.doesNotMatch(csv, /,-CMD,/);
});

test("lead exports neutralize attacker-controlled quote fields", async () => {
  mockDownload();
  exportLeads([{
    id: "lead-1",
    quoteNumber: null,
    companyName: "=HYPERLINK(\"https://attacker.example\")",
    contactPerson: " \t=SUM(A1)",
    email: "lead@example.test",
    phone: "+27123456789",
    serviceType: "pest_control",
    status: "new",
    origination: "website",
    originationOther: null,
    preferredContactMethod: null,
    address: null,
    description: "normal",
    assignedTo: null,
    notes: null,
    quoteAmount: null,
    frequency: null,
    submittedAt: null,
    followUpDate: null,
    quoteSentAt: null,
  } as any]);

  const csv = await downloadedCSV();
  assert.match(csv, /'=HYPERLINK/);
  assert.match(csv, /' \t=SUM/);
});

test("time balance exports use the same formula protection", async () => {
  mockDownload();
  exportTimeBalanceReport({
    period: { from: "2026-08-01", to: "2026-08-31" },
    rows: [{
      employeeId: "worker-1",
      name: "\t=HYPERLINK(\"https://attacker.example\")",
      departmentName: "Service",
      approvedOvertimeMinutes: 0,
      approvedTimeOffMinutes: 0,
      pendingOvertimeMinutes: 0,
      pendingTimeOffMinutes: 0,
      netMinutes: 0,
    }],
    totals: {
      approvedOvertimeMinutes: 0,
      approvedTimeOffMinutes: 0,
      pendingOvertimeMinutes: 0,
      pendingTimeOffMinutes: 0,
      netMinutes: 0,
      employeesOver: 0,
      employeesUnder: 0,
      employeesBalanced: 1,
    },
    transactions: [{
      id: "entry-1",
      employeeName: "Normal employee",
      date: "2026-08-01",
      typeLabel: "Overtime",
      clientName: " \t=SUM(A1)",
      jobLabel: null,
      startTime: "08:00",
      finishTime: "09:00",
      minutes: 60,
      displayDuration: "1 hr",
      status: "approved",
      approver: null,
      approvalDate: null,
      reason: "normal",
      notes: "Normal note",
      runningBalanceMinutes: -60,
    }],
  });

  const csv = await downloadedCSV();
  assert.match(csv, /' \t=SUM/);
  assert.match(csv, /'\t=HYPERLINK/);
  assert.match(csv, /,-60$/m);
});