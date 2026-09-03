import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MOBILE_FLEET_ACTIONS,
  MOBILE_FLEET_BOTTOM_NAV,
  MOBILE_FLEET_OVERVIEW_LAYOUT,
  canSelectFleetVehicle,
  fleetTodayVehicleConfirmed,
  buildFleetInspectionSubmission,
  normalizeFleetInspectionItems,
  fleetInspectionLabel,
} from "./mobile-fleet-contract";

test("Fleet primary actions keep the reference hierarchy and colour roles", () => {
  assert.deepEqual(
    MOBILE_FLEET_ACTIONS.map(action => [action.id, action.tone]),
    [
      ["kmMorning", "blue"],
      ["kmAfternoon", "blue"],
      ["inspection", "green"],
      ["monthlyInspection", "neutral"],
      ["fuel", "orange"],
      ["issue", "red"],
    ],
  );
});

test("Fleet footer keeps Log and Admin in the reference order", () => {
  assert.deepEqual(MOBILE_FLEET_BOTTOM_NAV.map(item => item.label), ["Log", "Admin"]);
});

test("Fleet Log overview hides the generic shell and keeps history off the primary dashboard", () => {
  assert.deepEqual(MOBILE_FLEET_OVERVIEW_LAYOUT, {
    hideGenericShell: true,
    statusRows: "stacked",
    showRecentActivity: false,
  });
});

test("Fleet inspection labels distinguish daily and monthly checks", () => {
  assert.equal(fleetInspectionLabel("daily"), "Daily Vehicle Check");
  assert.equal(fleetInspectionLabel("monthly"), "Monthly Inspection");
});

test("Fleet vehicle picker keeps occupied vehicles actionable, but locks today's current choice", () => {
  assert.equal(canSelectFleetVehicle(false, true), true);
  assert.equal(canSelectFleetVehicle(false, false), true);
  assert.equal(canSelectFleetVehicle(true, false), true);
  assert.equal(canSelectFleetVehicle(true, true), false);
});

test("Fleet confirmation honours all server overview contract locations", () => {
  assert.equal(fleetTodayVehicleConfirmed({ todayVehicleConfirmed: false, selectedToday: true }), false);
  assert.equal(fleetTodayVehicleConfirmed({ selectedToday: true }), true);
  assert.equal(fleetTodayVehicleConfirmed({ vehicle: { selectedToday: false } }), false);
  assert.equal(fleetTodayVehicleConfirmed({}), null);
});

test("inspection API items normalize in position order and create a template-aware submission", () => {
  const entries = normalizeFleetInspectionItems([
    { id: "brakes", label: "Brakes", position: 2, templateId: "daily-v4" },
    { id: "tyres", label: "Tyres", position: 1, templateId: "daily-v4" },
  ]);
  assert.deepEqual(entries.map(item => [item.id, item.label]), [["tyres", "Tyres"], ["brakes", "Brakes"]]);
  assert.deepEqual(buildFleetInspectionSubmission(entries, { tyres: "pass", brakes: "fail" }, { brakes: "Worn pad" }, "daily"), {
    templateId: "daily-v4", inspectionType: "daily", overallResult: "fail",
    items: [
      { id: "tyres", name: "Tyres", result: "pass", comments: undefined, type: "daily" },
      { id: "brakes", name: "Brakes", result: "fail", comments: "Worn pad", type: "daily" },
    ],
  });
});

test("real overview checklist fields support a custom template and an explicit canonical fallback", () => {
  const overview = {
    dailyInspectionTemplateId: "custom-daily-9",
    dailyInspectionItems: [{ id: "custom-lights", label: "Beacon light", position: 1, templateId: "custom-daily-9" }],
    monthlyInspectionTemplateId: "canonical-monthly",
    monthlyInspectionItems: [],
  };
  const custom = normalizeFleetInspectionItems(overview.dailyInspectionItems.map(item => ({
    ...item, templateId: item.templateId ?? overview.dailyInspectionTemplateId,
  })));
  const canonical = normalizeFleetInspectionItems(overview.monthlyInspectionItems, {
    templateId: overview.monthlyInspectionTemplateId, labels: ["Tyres", "Brakes"],
  });
  assert.deepEqual(custom, [{ id: "custom-lights", label: "Beacon light", templateId: "custom-daily-9" }]);
  assert.deepEqual(buildFleetInspectionSubmission(canonical, {
    "canonical-monthly:0": "pass", "canonical-monthly:1": "pass",
  }, {}, "monthly"), {
    templateId: "canonical-monthly", inspectionType: "monthly", overallResult: "pass",
    items: [
      { id: "canonical-monthly:0", name: "Tyres", result: "pass", comments: undefined, type: "monthly" },
      { id: "canonical-monthly:1", name: "Brakes", result: "pass", comments: undefined, type: "monthly" },
    ],
  });
});