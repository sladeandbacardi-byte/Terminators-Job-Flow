import type { AccessIdentity } from "./accessPolicy";
import { SOLE_SUPERADMIN } from "./superadmin";

export type Permission =
  | "dashboard"
  | "clients:view"
  | "clients:manage"
  | "sales"
  | "jobs"
  | "calendar"
  | "service-contracts"
  | "operational-reports"
  | "staff"
  | "teams"
  | "time:self"
  | "time:manage"
  | "fleet"
  | "stock"
  | "treatment-reports"
  | "finance"
  | "hr"
  | "company-profit"
  | "system-admin"
  | "growth-capital";

export type StaffAccessProfile = {
  workerId: string;
  name: string;
  jobTitle: string;
  team: string;
  departmentIds: readonly string[];
  permissions: readonly Permission[];
  ownWorkOnly?: boolean;
};

const ALL_PERMISSIONS: readonly Permission[] = [
  "dashboard", "clients:view", "clients:manage", "sales", "jobs", "calendar",
  "service-contracts", "operational-reports", "staff", "teams", "time:self",
  "time:manage", "fleet", "stock", "treatment-reports", "finance", "hr",
  "company-profit", "system-admin", "growth-capital",
];

const MANAGER_OPERATIONS: readonly Permission[] = [
  "dashboard", "clients:view", "jobs", "calendar", "service-contracts",
  "operational-reports", "staff", "teams", "time:self", "time:manage", "stock",
];
const FIELD_SELF: readonly Permission[] = ["dashboard", "jobs", "calendar", "time:self", "fleet"];

const profiles: readonly StaffAccessProfile[] = [
  { workerId: "worker-1", name: "Julien Botha", jobTitle: "Managing Member", team: "Executive", departmentIds: [], permissions: ALL_PERMISSIONS },
  { workerId: "worker-2", name: "Maryka Venter", jobTitle: "Pest Control Services Manager", team: "Pest Control", departmentIds: ["div-1"], permissions: [...MANAGER_OPERATIONS, "treatment-reports"] },
  { workerId: "worker-3", name: "Mariette Koekemoer", jobTitle: "Hygiene Services Manager", team: "Hygiene Services", departmentIds: ["div-2", "div-3", "div-4"], permissions: MANAGER_OPERATIONS },
  { workerId: "worker-4", name: "Juli Holtshausen", jobTitle: "Finance & HR Manager", team: "Finance / HR", departmentIds: ["div-7"], permissions: ["dashboard", "clients:view", "jobs", "calendar", "staff", "time:self", "time:manage", "finance", "hr"] },
  { workerId: "worker-5", name: "Sheryl-Lyn Lee", jobTitle: "Existing Clients Sales & Admin", team: "Marketing & Sales", departmentIds: ["div-5"], permissions: ["dashboard", "clients:view", "clients:manage", "sales", "calendar", "time:self"] },
  { workerId: "worker-6", name: "Anzel Marais", jobTitle: "Sales Representative", team: "Marketing & Sales", departmentIds: ["div-5"], permissions: ["dashboard", "clients:view", "clients:manage", "sales", "calendar", "time:self"] },

  { workerId: "mobile-tech-01", name: "Re-Althon", jobTitle: "Sanitary Bin Service A Team Supervisor", team: "Sanitary Bin Service A Team", departmentIds: ["div-2"], permissions: [...FIELD_SELF, "teams"], ownWorkOnly: true },
  { workerId: "mobile-tech-04", name: "Jackie Roelfse", jobTitle: "Sanitary Bin Service B Team Supervisor", team: "Sanitary Bin Service B Team", departmentIds: ["div-2"], permissions: [...FIELD_SELF, "teams"], ownWorkOnly: true },
  { workerId: "mobile-tech-06", name: "Zain Abdol", jobTitle: "Washroom Services Supervisor", team: "Washroom Services", departmentIds: ["div-3"], permissions: [...FIELD_SELF, "teams"], ownWorkOnly: true },
  { workerId: "mobile-tech-10", name: "Zuki Sandi", jobTitle: "Ablution Deep Cleaning Supervisor", team: "Ablution Deep Cleaning", departmentIds: ["div-4"], permissions: [...FIELD_SELF, "teams"], ownWorkOnly: true },
  { workerId: "mobile-tech-09", name: "Reece Ebrahim", jobTitle: "Pest Control Operator", team: "Pest Control Team", departmentIds: ["div-1"], permissions: FIELD_SELF, ownWorkOnly: true },
  { workerId: "mobile-tech-03", name: "Garth du Preez", jobTitle: "Pest Control Operator", team: "Pest Control Team", departmentIds: ["div-1"], permissions: FIELD_SELF, ownWorkOnly: true },
  { workerId: "mobile-tech-07", name: "Michael Meyer", jobTitle: "Pest Control Operator", team: "Pest Control Team", departmentIds: ["div-1"], permissions: FIELD_SELF, ownWorkOnly: true },
  { workerId: "mobile-tech-08", name: "Xolani Ndzotoyi", jobTitle: "Pest Control Operator", team: "Pest Control Team", departmentIds: ["div-1"], permissions: FIELD_SELF, ownWorkOnly: true },
  { workerId: "mobile-tech-02", name: "Leon Coltman", jobTitle: "Pest Control Assistant", team: "Pest Control Team", departmentIds: ["div-1"], permissions: FIELD_SELF, ownWorkOnly: true },
];

const internalWorkerAliases: Record<string, string> = {
  "worker-7": "mobile-tech-10",
  "worker-8": "mobile-tech-09",
  "worker-9": "mobile-tech-03",
  "worker-10": "mobile-tech-07",
  "worker-11": "mobile-tech-08",
  "worker-12": "mobile-tech-06",
  "worker-13": "mobile-tech-02",
  "worker-14": "mobile-tech-04",
  "worker-15": "mobile-tech-01",
};

export const NAMED_STAFF_ACCESS_PROFILES = profiles;

export function accessWorkerId(identity: AccessIdentity): string {
  const id = identity.sourceWorkerId || identity.id || "";
  return internalWorkerAliases[id] || id;
}

export function getStaffAccessProfile(identity: AccessIdentity): StaffAccessProfile | undefined {
  const id = accessWorkerId(identity);
  return profiles.find(profile => profile.workerId === id);
}

export function hasPermission(identity: AccessIdentity, permission: Permission): boolean {
  return getStaffAccessProfile(identity)?.permissions.includes(permission) ?? false;
}

export function isCanonicalOwner(identity: AccessIdentity): boolean {
  return accessWorkerId(identity) === SOLE_SUPERADMIN.workerId;
}

export function scopedDepartmentIds(identity: AccessIdentity): readonly string[] {
  return getStaffAccessProfile(identity)?.departmentIds ?? [];
}

export function hasOperationalDepartmentScope(identity: AccessIdentity): boolean {
  return ["worker-2", "worker-3"].includes(accessWorkerId(identity));
}

export function canAccessDepartment(identity: AccessIdentity, departmentId: string | null | undefined): boolean {
  if (isCanonicalOwner(identity)) return true;
  if (!departmentId) return false;
  return scopedDepartmentIds(identity).includes(departmentId);
}

export function canManageWorker(identity: AccessIdentity, targetWorkerId: string | null | undefined): boolean {
  if (isCanonicalOwner(identity) || hasPermission(identity, "hr")) return true;
  if (!targetWorkerId) return false;
  const target = getStaffAccessProfile({ id: targetWorkerId });
  if (!target) return false;
  return target.departmentIds.some(departmentId => canAccessDepartment(identity, departmentId));
}

export function canExpandMobileTeamJobs(workerId: string): boolean {
  const profile = getStaffAccessProfile({ id: workerId });
  return profile?.ownWorkOnly === true && profile.permissions.includes("teams");
}

const recordDepartment = (value: Record<string, unknown>): string | undefined =>
  [value.departmentId, value.department_id].find(item => typeof item === "string") as string | undefined;

const recordWorker = (value: Record<string, unknown>): string | undefined =>
  [
    value.employeeId, value.workerId, value.technicianId, value.assignedTechnicianId,
    value.assignedWorkerId, value.assignedUserId,
    value.supervisorId, value.assignedDriverId,
  ].find(item => typeof item === "string") as string | undefined;

export function filterOperationalPayload(identity: AccessIdentity, payload: unknown): unknown {
  if (!hasOperationalDepartmentScope(identity)) return payload;
  if (Array.isArray(payload)) {
    return payload
      .filter(item => {
        if (!item || typeof item !== "object") return true;
        const record = item as Record<string, unknown>;
        const departmentId = recordDepartment(record);
        if (departmentId) return canAccessDepartment(identity, departmentId);
        const workerId = recordWorker(record);
        if (workerId) return canManageWorker(identity, workerId);
        return true;
      })
      .map(item => filterOperationalPayload(identity, item));
  }
  if (payload && typeof payload === "object") {
    return Object.fromEntries(Object.entries(payload as Record<string, unknown>).map(([key, value]) => [
      key,
      Array.isArray(value) ? filterOperationalPayload(identity, value) : value,
    ]));
  }
  return payload;
}

const uiRules: Array<{ prefixes: string[]; permission: Permission }> = [
  { prefixes: ["/growth-capital"], permission: "growth-capital" },
  { prefixes: ["/backup", "/users-roles", "/permissions", "/settings", "/system-logs", "/data-integrity", "/pricing-library", "/testing-checklist", "/custom-reports"], permission: "system-admin" },
  { prefixes: ["/finance-dashboard", "/invoices", "/receipts", "/expenses", "/debtors", "/statements", "/creditors", "/supplier-payments", "/sage-export", "/finance-reports"], permission: "finance" },
  { prefixes: ["/leads", "/quotes", "/accepted-work", "/sales-dashboard", "/opportunities", "/follow-ups", "/sales-reports", "/commission-reports", "/emails", "/contracts"], permission: "sales" },
  { prefixes: ["/treatment-reports"], permission: "treatment-reports" },
  { prefixes: ["/service-contracts", "/contracts-pending"], permission: "service-contracts" },
  { prefixes: ["/reports"], permission: "operational-reports" },
  { prefixes: ["/workers", "/attendance"], permission: "staff" },
  { prefixes: ["/team-management"], permission: "teams" },
  { prefixes: ["/overtime-approval", "/time-balance"], permission: "time:manage" },
  { prefixes: ["/overtime-time-off", "/my-overtime"], permission: "time:self" },
  { prefixes: ["/fleet", "/operations/fleet"], permission: "fleet" },
  { prefixes: ["/inventory", "/stock-", "/suppliers", "/purchase-orders"], permission: "stock" },
  { prefixes: ["/jobs", "/once-off-jobs", "/contract-jobs", "/daily-department-card", "/service-scheduling", "/equipment-checklists"], permission: "jobs" },
  { prefixes: ["/calendar", "/field-diaries", "/sales-diary"], permission: "calendar" },
  { prefixes: ["/clients"], permission: "clients:view" },
  { prefixes: ["/hr-dashboard"], permission: "hr" },
  { prefixes: ["/dashboard", "/"], permission: "dashboard" },
];

const matchesPrefix = (path: string, prefix: string) =>
  prefix === "/" ? path === "/" : path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`);

export function canAccessUiPath(identity: AccessIdentity, path: string): boolean {
  if (isCanonicalOwner(identity)) return true;
  const cleanPath = path.split("?")[0];
  const rule = uiRules.find(item => item.prefixes.some(prefix => matchesPrefix(cleanPath, prefix)));
  return rule ? hasPermission(identity, rule.permission) : false;
}

export function requiredApiPermission(method: string, path: string): Permission | null {
  const cleanPath = path.split("?")[0];
  const write = method.toUpperCase() !== "GET";
  const hasApiPrefix = (prefix: string) =>
    cleanPath === `/api/${prefix}` || cleanPath.startsWith(`/api/${prefix}/`);

  if (hasApiPrefix("auth/me") || hasApiPrefix("auth/logout") || hasApiPrefix("notifications")) return "dashboard";
  if (hasApiPrefix("growth-capital")) return "growth-capital";
  if (["admin", "backup", "settings", "pricing-library", "custom-reports", "auth/activity-logs", "auth/cleanup-sessions"].some(hasApiPrefix)) return "system-admin";
  if (hasApiPrefix("dashboard/revenue-chart")) return "company-profit";
  if (hasApiPrefix("dashboard/analytics")) return "company-profit";
  if (hasApiPrefix("dashboard")) return "dashboard";
  if (hasApiPrefix("clients")) {
    if (/\/(?:payments|financial-summary)(?:\/|$)/.test(cleanPath)) return "finance";
    if (/\/opportunities(?:\/|$)/.test(cleanPath)) return "sales";
    return write ? "clients:manage" : "clients:view";
  }
  if (["invoices", "invoice-items", "expenses", "sage", "sage-export", "client-payments", "payments"].some(hasApiPrefix)) return "finance";
  if (["quote-submissions", "sales-appointments", "sales-follow-ups", "accepted-workflows", "opportunities", "email-templates", "email-logs", "send-customer-email", "whatsapp", "contracts", "contract-items"].some(hasApiPrefix)) return "sales";
  if (["treatment-reports", "pest-control-products"].some(hasApiPrefix)) return "treatment-reports";
  if (["service-contracts", "service-schedule", "contract-occurrence-exceptions"].some(hasApiPrefix)) return "service-contracts";
  if (["fleet"].some(hasApiPrefix)) return "fleet";
  if (["workers", "attendance"].some(hasApiPrefix)) return "staff";
  if (["teams", "team-members"].some(hasApiPrefix)) return "teams";
  if (["overtime", "time-off", "time"].some(hasApiPrefix)) return write || !/\/my$/.test(cleanPath) ? "time:manage" : "time:self";
  if (["inventory", "job-inventory", "stock-checks", "stock-locations", "stock-movements", "stock-transfers", "stock-balances", "picking-lists", "suppliers", "purchase-orders"].some(hasApiPrefix)) return "stock";
  if (["jobs", "equipment-checklists"].some(hasApiPrefix)) return "jobs";
  if (["calendar", "field-diaries"].some(hasApiPrefix)) return "calendar";
  if (hasApiPrefix("reports/time-balance")) return "time:manage";
  if (hasApiPrefix("reports")) return "operational-reports";
  if (hasApiPrefix("legal-entities") || hasApiPrefix("departments")) return write ? "system-admin" : "dashboard";
  if (["search", "communication-notes"].some(hasApiPrefix)) return "dashboard";
  return null;
}

export function canAccessOfficeApi(identity: AccessIdentity, method: string, path: string): boolean {
  if (isCanonicalOwner(identity)) return true;
  const permission = requiredApiPermission(method, path);
  return permission !== null && hasPermission(identity, permission);
}