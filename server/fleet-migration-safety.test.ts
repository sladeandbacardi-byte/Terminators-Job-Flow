import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("KTD cleanup requires FleetGuard mapping provenance", () => {
  const source = readFileSync(new URL("./startup-migrations.ts", import.meta.url), "utf8");
  const block = source.slice(source.indexOf('"remove historical KTD136EC'), source.indexOf("console.log(\"[migrations] Startup"));
  assert.match(block, /JOIN fleetguard_record_mappings m/);
  assert.match(block, /m\.source_system='fleetguard'/);
  assert.match(block, /EXISTS \(SELECT 1 FROM fleetguard_record_mappings m WHERE m\.source_system='fleetguard'/);
  assert.doesNotMatch(block, /DELETE FROM (fuel_fillups|km_logs|vehicle_inspections|service_records) WHERE vehicle_id/);
  assert.match(block, /m\.target_table='vehicle_assignments' AND m\.target_id=a\.id/);
  assert.match(block, /DELETE FROM vehicle_assignments WHERE id = ANY\(ktd_assignment_ids\)/);
  assert.match(block, /WHERE source_system='fleetguard' AND target_table='vehicle_assignments'/);
  // There must be no registration/vehicle-wide assignment delete: unmatched
  // native assignments survive because only the collected mapped IDs are used.
  assert.doesNotMatch(block, /DELETE FROM vehicle_assignments WHERE vehicle_id/);
});