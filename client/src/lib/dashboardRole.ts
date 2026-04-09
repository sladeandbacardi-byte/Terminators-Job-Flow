export type DashboardRole = "admin" | "sales" | "service" | "accounts";

export function getDashboardRole(user: { departmentId?: string | null; role?: string | null }): DashboardRole {
  const dept = user.departmentId ?? "";
  const role = (user.role ?? "").toLowerCase();

  // Department-based routing (most reliable)
  if (dept === "div-5") return "sales";
  if (["div-1", "div-2", "div-3", "div-4"].includes(dept)) return "service";

  // Role string fallback (covers cases where departmentId is missing)
  if (role.includes("finance") || role.includes("accounts") || role.includes("accountant")) return "accounts";
  if (role.includes("sales") || role.includes("consultant")) return "sales";
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

  // Admin/management default
  return "admin";
}

export const dashboardRoleLabels: Record<DashboardRole, string> = {
  admin: "Admin",
  sales: "Sales",
  service: "Service",
  accounts: "Accounts",
};

export const dashboardRoleColors: Record<DashboardRole, string> = {
  admin: "bg-indigo-600",
  sales: "bg-pink-600",
  service: "bg-green-600",
  accounts: "bg-amber-600",
};
