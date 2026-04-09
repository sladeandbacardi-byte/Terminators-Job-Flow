export type DashboardRole = "admin" | "manager" | "sales" | "service" | "accounts";

export function getDashboardRole(user: { departmentId?: string | null; role?: string | null }): DashboardRole {
  const dept = user.departmentId ?? "";
  const role = (user.role ?? "").toLowerCase();

  // Department-based routing (most reliable)
  if (dept === "div-5") return "sales";
  if (dept === "div-6") return "manager";
  if (["div-1", "div-2", "div-3", "div-4"].includes(dept)) return "service";

  // Role string fallback
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

  // Owner/director default
  return "admin";
}

export const dashboardRoleLabels: Record<DashboardRole, string> = {
  admin: "Admin",
  manager: "Manager",
  sales: "Sales",
  service: "Service",
  accounts: "Accounts",
};

export const dashboardRoleColors: Record<DashboardRole, string> = {
  admin: "bg-indigo-600",
  manager: "bg-teal-600",
  sales: "bg-pink-600",
  service: "bg-green-600",
  accounts: "bg-amber-600",
};
