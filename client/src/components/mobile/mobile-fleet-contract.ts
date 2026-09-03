export const MOBILE_FLEET_ACTIONS = [
  { id: "kmMorning", label: "Log Morning KMs", tone: "blue" },
  { id: "kmAfternoon", label: "Log Afternoon KMs", tone: "blue" },
  { id: "inspection", label: "Daily Vehicle Check", tone: "green" },
  { id: "monthlyInspection", label: "Monthly Inspection", tone: "neutral" },
  { id: "fuel", label: "Log Fuel", tone: "orange" },
  { id: "issue", label: "Report Fault", tone: "red" },
] as const;

export const MOBILE_FLEET_BOTTOM_NAV = [
  { id: "log", label: "Log" },
  { id: "admin", label: "Admin" },
] as const;

export const MOBILE_FLEET_OVERVIEW_LAYOUT = {
  hideGenericShell: true,
  statusRows: "stacked",
  showRecentActivity: false,
} as const;

/** The current vehicle is selectable until today's choice is explicitly recorded. */
export function canSelectFleetVehicle(isCurrent: boolean, selectedToday: boolean): boolean {
  return !isCurrent || !selectedToday;
}

/** Preserve the API's three-state answer: only an explicit false blocks entry. */
export function fleetTodayVehicleConfirmed(values: {
  todayVehicleConfirmed?: unknown;
  selectedToday?: unknown;
  vehicle?: { selectedToday?: unknown } | null;
}): boolean | null {
  const candidates = [values.todayVehicleConfirmed, values.selectedToday, values.vehicle?.selectedToday];
  const answer = candidates.find(value => typeof value === "boolean");
  return typeof answer === "boolean" ? answer : null;
}

export type FleetInspectionApiItem = {
  id: string;
  label: string;
  position?: number | null;
  templateId?: string | null;
};

export type FleetInspectionEntry = {
  id: string;
  label: string;
  templateId: string;
};

/** Converts the mobile API snapshot into deterministic form entries. */
export function normalizeFleetInspectionItems(
  items: FleetInspectionApiItem[],
  fallback: { templateId: string; labels: readonly string[] } | null = null,
): FleetInspectionEntry[] {
  if (!items.length) {
    return fallback ? fallback.labels.map((label, position) => ({
      id: `${fallback.templateId}:${position}`, label, templateId: fallback.templateId,
    })) : [];
  }
  return [...items]
    .filter(item => Boolean(item.id && item.label && item.templateId))
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.id.localeCompare(b.id))
    .map(item => ({ id: item.id, label: item.label, templateId: item.templateId! }));
}

export function buildFleetInspectionSubmission(
  entries: FleetInspectionEntry[],
  results: Record<string, "pass" | "fail">,
  notes: Record<string, string | undefined>,
  inspectionType: "daily" | "monthly",
) {
  const templateId = entries[0]?.templateId;
  return {
    templateId,
    inspectionType,
    overallResult: entries.some(item => results[item.id] === "fail") ? "fail" : "pass",
    items: entries.map(item => ({ id: item.id, name: item.label, result: results[item.id], comments: notes[item.id] || undefined, type: inspectionType })),
  };
}

export function fleetInspectionLabel(type: "daily" | "monthly"): string {
  return type === "monthly" ? "Monthly Inspection" : "Daily Vehicle Check";
}