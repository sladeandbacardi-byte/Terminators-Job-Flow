export type DashboardRole = "admin" | "manager" | "sales" | "service" | "accounts" | "coordinator";

export function getDashboardRole(user: { departmentId?: string | null; role?: string | null; authenticationMethod?: string | null }): DashboardRole {
  const dept = user.departmentId ?? "";
  const role = (user.role ?? "").toLowerCase();

  // Profile-picker sign-in intentionally grants staff-level access only. Its
  // display role must not expose management dashboards based on a selected name.
  if (user.authenticationMethod === "profile_picker") {
    if (dept === "div-5") return "sales";
    if (dept === "div-7") return "accounts";
    return "service";
  }

  // Owner/director keywords take priority over department
  if (
    role.includes("managing member") ||
    role.includes("operations manager") ||
    role.includes("owner") ||
    role.includes("director") ||
    role === "md" ||
    role === "ceo" ||
    role === "coo"
  ) return "admin";

  // Coordinator — must be checked BEFORE department routing so div-1/2/3/4 coordinators don't fall into "service"
  if (role.includes("coordinator")) return "coordinator";

  // Department-based routing
  if (dept === "div-5") return "sales";
  if (dept === "div-7") return "accounts";
  if (["div-1", "div-2", "div-3", "div-4"].includes(dept)) return "service";

  // div-6: differentiate manager vs admin by role string
  if (dept === "div-6") {
    if (role.includes("manager") || role.includes("operational") || role.includes("operations")) return "manager";
    return "admin";
  }

  // Role string fallback (no department match)
  if (role.includes("finance") || role.includes("accounts") || role.includes("accountant")) return "accounts";
  if (role.includes("sales") || role.includes("consultant")) return "sales";
  if (role.includes("manager") || role.includes("operational")) return "manager";
  if (
    role === "pco" ||
    role.includes("technician") ||
    role.includes("supervisor") ||
    role.includes("assistant") ||
    role.includes("cleaning") ||
    role.includes("washroom") ||
    role.includes("sanitary") ||
    role.includes("pest")
  ) return "service";

  return "admin";
}

export const dashboardRoleLabels: Record<DashboardRole, string> = {
  admin:       "Operations Manager",
  manager:     "Service Manager",
  sales:       "Sales",
  service:     "Technician",
  accounts:    "Finance",
  coordinator: "Coordinator",
};

/**
 * Returns the URL the user should land on after login / clicking Dashboard.
 * Never returns "/" to avoid a redirect loop with the RoleDashboard guard.
 */
export function getDefaultDashboardRoute(user: { departmentId?: string | null; role?: string | null; authenticationMethod?: string | null }): string {
  const role = getDashboardRole(user);
  switch (role) {
    case "sales":    return "/sales-dashboard";
    case "accounts": return "/finance-dashboard";
    // admin, manager, service, coordinator all use the polymorphic Dashboard page
    default:         return "/dashboard";
  }
}

export const dashboardRoleColors: Record<DashboardRole, string> = {
  admin:       "bg-indigo-600",
  manager:     "bg-teal-600",
  sales:       "bg-pink-600",
  service:     "bg-green-600",
  accounts:    "bg-amber-600",
  coordinator: "bg-cyan-700",
};

/**
 * Minimal shape of a calendar event needed for permission checks — deliberately
 * decoupled from shared/calendar-types.ts to avoid a circular import; any object
 * matching this shape (including a full CalendarEvent) works.
 */
export interface CalendarPermissionEvent {
  sourceType: string;
  assignedUserId?: string | null;
  assignedTeamId?: string | null;
}

/**
 * Central permission policy for dragging/resizing/reassigning entries on any
 * OutlookDiaryCalendar instance. Used identically on the client (to decide
 * whether an event renders as draggable) and the server (to authorize writes).
 *
 * Rules (per the diary standardisation spec):
 * - Admin / Manager: can move all events.
 * - Sales Rep: can move only their own sales appointments / follow-ups / quote visits.
 * - Service Manager (coordinator): can move service jobs and contract occurrences,
 *   and reassign technician/team.
 * - Technician (service): view only — can start/complete jobs elsewhere in the UI,
 *   but cannot drag/reschedule/reassign on the calendar.
 * - Finance (accounts): view only.
 */
export function canMoveCalendarEvent(
  role: DashboardRole,
  currentWorkerId: string | null | undefined,
  event: CalendarPermissionEvent,
): boolean {
  if (role === "admin" || role === "manager") return true;

  const SALES_SOURCE_TYPES = new Set(["salesAppointment", "followUp", "quoteVisit"]);
  const SERVICE_SOURCE_TYPES = new Set([
    "onceOffJob", "serviceContractOccurrence", "rentalContractOccurrence",
    "treatmentReport", "fleetTask", "inspection", "other",
  ]);

  if (role === "sales") {
    return SALES_SOURCE_TYPES.has(event.sourceType) && !!currentWorkerId && event.assignedUserId === currentWorkerId;
  }

  if (role === "coordinator") {
    return SERVICE_SOURCE_TYPES.has(event.sourceType);
  }

  // service (technician) and accounts (finance) are read-only on the calendar
  return false;
}
