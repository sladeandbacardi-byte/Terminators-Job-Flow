import type { DashboardRole } from "./dashboardRole";

const ALL_OFFICE_ROLES: DashboardRole[] = ["admin", "manager", "sales", "service", "accounts", "coordinator"];
const ADMIN: DashboardRole[] = ["admin"];
const MANAGEMENT: DashboardRole[] = ["admin", "manager"];
const SALES: DashboardRole[] = ["admin", "manager", "sales"];
const FINANCE: DashboardRole[] = ["admin", "manager", "accounts"];
const SERVICE: DashboardRole[] = ["admin", "manager", "coordinator", "service"];
const STAFF_ADMIN: DashboardRole[] = ["admin", "manager", "coordinator", "accounts"];
const STOCK: DashboardRole[] = ["admin", "manager", "coordinator", "accounts", "service"];
const JOBS: DashboardRole[] = ["admin", "manager", "coordinator", "accounts", "service"];
const REPORTS: DashboardRole[] = ["admin", "manager", "coordinator", "accounts"];

const hasPrefix = (path: string, prefix: string) =>
  path === `/api/${prefix}` || path.startsWith(`/api/${prefix}/`);

export function getOfficeApiAllowedRoles(method: string, path: string): DashboardRole[] {
  const write = method.toUpperCase() !== "GET";

  if (hasPrefix(path, "clients")) {
    if (/^\/api\/clients\/[^/]+\/(?:payments|financial-summary)(?:\/|$)/.test(path)) return FINANCE;
    if (/^\/api\/clients\/[^/]+\/opportunities(?:\/|$)/.test(path)) return SALES;
    if (/^\/api\/clients\/[^/]+\/service-wallet(?:\/|$)/.test(path)) return SERVICE;
    return write ? SALES : ALL_OFFICE_ROLES;
  }

  if (hasPrefix(path, "legal-entities")) return write ? ADMIN : ALL_OFFICE_ROLES;
  if (hasPrefix(path, "departments")) return write ? MANAGEMENT : ALL_OFFICE_ROLES;

  const policies: Array<{ prefixes: string[]; roles: DashboardRole[] }> = [
    { prefixes: ["auth/me", "auth/logout", "dashboard", "calendar", "notifications", "search", "communication-notes"], roles: ALL_OFFICE_ROLES },
    { prefixes: ["overtime", "time-off", "time"], roles: ALL_OFFICE_ROLES },
    { prefixes: ["admin", "backup", "settings", "pricing-library", "custom-reports", "auth/activity-logs", "auth/cleanup-sessions"], roles: ADMIN },
    { prefixes: ["quote-submissions", "sales-appointments", "sales-follow-ups", "accepted-workflows", "opportunities", "email-templates", "email-logs", "send-customer-email", "whatsapp"], roles: SALES },
    { prefixes: ["invoices", "invoice-items", "expenses", "sage", "sage-export", "client-payments", "payments"], roles: FINANCE },
    { prefixes: ["fleet", "treatment-reports", "pest-control-products", "field-diaries", "equipment-checklists"], roles: SERVICE },
    { prefixes: ["workers", "attendance"], roles: STAFF_ADMIN },
    { prefixes: ["teams", "team-members"], roles: MANAGEMENT },
    { prefixes: ["inventory", "job-inventory", "stock-checks", "stock-locations", "stock-movements", "stock-transfers", "stock-balances", "picking-lists", "suppliers", "purchase-orders"], roles: STOCK },
    { prefixes: ["jobs"], roles: JOBS },
    { prefixes: ["contracts", "contract-items", "department-defaults"], roles: SALES },
    { prefixes: ["service-contracts", "service-schedule", "contract-occurrence-exceptions"], roles: ["admin", "manager", "coordinator"] },
    { prefixes: ["reports"], roles: REPORTS },
  ];

  // Every authenticated office API not explicitly classified fails closed.
  return policies.find(policy => policy.prefixes.some(prefix => hasPrefix(path, prefix)))?.roles ?? ADMIN;
}