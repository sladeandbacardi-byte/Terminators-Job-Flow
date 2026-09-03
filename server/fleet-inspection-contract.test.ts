import assert from "node:assert/strict";
import test from "node:test";
import { buildMobileInspectionConfiguration, validateInspectionItemsForTemplate } from "./fleet-configuration";
import { FLEET_INSPECTION_CHECKS } from "@shared/fleet";

test("custom DB template DTO and submission contract use exact ordered active items", () => {
  const configuration = buildMobileInspectionConfiguration([{
    id: "daily-custom", name: "Driver Daily", version: 3,
    items: [
      { id: "second", label: "Custom second", position: 1 },
      { id: "first", label: "Custom first", position: 0 },
    ],
  }]);
  assert.equal(configuration.dailyInspectionTemplateId, "daily-custom");
  assert.deepEqual(configuration.dailyInspectionItems, [
    { id: "first", label: "Custom first", position: 0, templateId: "daily-custom" },
    { id: "second", label: "Custom second", position: 1, templateId: "daily-custom" },
  ]);
  assert.deepEqual(validateInspectionItemsForTemplate("daily-custom", configuration.dailyInspectionItems, [
    { name: "Custom first", result: "pass" }, { name: "Custom second", result: "fail" },
  ]).map(item => item.result), ["pass", "fail"]);
  assert.throws(() => validateInspectionItemsForTemplate("daily-custom", configuration.dailyInspectionItems, [
    { name: FLEET_INSPECTION_CHECKS[0], result: "pass" },
  ]), /Complete|match/);
});

test("canonical fallback DTO IDs are server-recognized and validate canonical labels", () => {
  const configuration = buildMobileInspectionConfiguration([]);
  assert.equal(configuration.dailyInspectionTemplateId, "canonical-daily-v1");
  assert.equal(configuration.monthlyInspectionTemplateId, "canonical-monthly-v1");
  assert.ok(configuration.dailyInspectionItems.every(item => item.templateId === "canonical-daily-v1"));
  const submitted = FLEET_INSPECTION_CHECKS.map(name => ({ name, result: "pass" as const }));
  assert.equal(validateInspectionItemsForTemplate(
    configuration.dailyInspectionTemplateId, configuration.dailyInspectionItems, submitted,
  ).length, FLEET_INSPECTION_CHECKS.length);
});