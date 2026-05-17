export type DashboardRole = "admin" | "manager" | "sales" | "service" | "accounts";

export function getDashboardRole(user: { departmentId?: string | null; role?: string | null }): DashboardRole {
  const dept = user.departmentId ?? "";
  const role = (user.role ?? "").toLowerCase();

  // Owner/director keywords take priority over department (e.g. Julien Botha in div-6 with role "Managing Member")
  if (
    role.includes("managing member") ||
    role.includes("owner") ||
    role.includes("director") ||
    role === "md" ||
    role === "ceo" ||
    role === "coo"
  ) return "admin";

  // Department-based routing
  if (dept === "div-5") return "sales";
  if (dept === "div-7") return "accounts";
  if (["div-1", "div-2", "div-3", "div-4"].includes(dept)) return "service";

  // div-6: differentiate manager vs admin by role string
  if (dept === "div-6") {
    if (role.includes("manager") || role.includes("operational") || role.includes("operations")) return "manager";
    return "admin"; // fallback for unrecognised div-6 roles
  }

  // Role string fallback (no department match)
  if (role.includes("finance") || role.includes("accounts") || role.includes("accountant")) return "accounts";
  if (role.includes("sales") || role.includes("consultant")) return "sales";
  if (role.includes("coordinator")) return "service";
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

  // Default: owner/admin
  return "admin";
}

export const dashboardRoleLabels: Record<DashboardRole, string> = {
  admin:    "Managing Member",
  manager:  "Service Manager",
  sales:    "Sales",
  service:  "Field Technician",
  accounts: "Finance",
};

export const dashboardRoleColors: Record<DashboardRole, string> = {
  admin:    "bg-indigo-600",
  manager:  "bg-teal-600",
  sales:    "bg-pink-600",
  service:  "bg-green-600",
  accounts: "bg-amber-600",
};
