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

export function fleetInspectionLabel(type: "daily" | "monthly"): string {
  return type === "monthly" ? "Monthly Inspection" : "Daily Vehicle Check";
}