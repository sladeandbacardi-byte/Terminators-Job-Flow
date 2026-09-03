import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MOBILE_FLEET_ACTIONS,
  MOBILE_FLEET_BOTTOM_NAV,
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

test("Fleet inspection labels distinguish daily and monthly checks", () => {
  assert.equal(fleetInspectionLabel("daily"), "Daily Vehicle Check");
  assert.equal(fleetInspectionLabel("monthly"), "Monthly Inspection");
});