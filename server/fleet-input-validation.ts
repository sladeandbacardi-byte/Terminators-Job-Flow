import { FLEET_INSPECTION_CHECKS } from "@shared/fleet";

type InspectionItem = { name?: unknown; result?: unknown; comments?: unknown; type?: unknown };

export function validateFleetInspectionItems(value: unknown): InspectionItem[] {
  if (!Array.isArray(value)) throw new Error("Complete every vehicle safety check before submitting.");
  const expected = new Set<string>(FLEET_INSPECTION_CHECKS);
  const seen = new Set<string>();
  for (const item of value as InspectionItem[]) {
    if (!item || typeof item !== "object" || typeof item.name !== "string"
      || !expected.has(item.name) || seen.has(item.name)
      || (item.result !== "pass" && item.result !== "fail")) {
      throw new Error("Complete every vehicle safety check before submitting.");
    }
    seen.add(item.name);
  }
  if (seen.size !== expected.size) throw new Error("Complete every vehicle safety check before submitting.");
  return value as InspectionItem[];
}

export function assertNoOdometerRollback(flags: string[]): void {
  if (flags.includes("BUSINESS_ODOMETER_ROLLBACK")) {
    throw new Error("Afternoon odometer cannot be lower than the morning reading.");
  }
  if (flags.includes("PRIVATE_ODOMETER_ROLLBACK")) {
    throw new Error("Morning odometer cannot be lower than the previous valid afternoon reading.");
  }
}
