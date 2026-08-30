import bcrypt from "bcryptjs";
import type { AdminUser, Worker } from "@shared/schema";
import { SOLE_SUPERADMIN } from "@shared/superadmin";

const normalize = (value: string | null | undefined) =>
  String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();

export type OfficeDirectoryEntry = {
  id: string;
  name: string;
  username?: string;
  role: string;
  department: string;
  authMethod: "password";
  credentialStatus: "ready" | "missing";
};

export function selectCanonicalSuperAdminTarget(
  admins: AdminUser[],
  configuredUsername: string,
): AdminUser | undefined {
  return (
    admins.find(admin => admin.id === SOLE_SUPERADMIN.workerId) ||
    admins.find(admin =>
      admin.username === configuredUsername &&
      normalize(`${admin.firstName} ${admin.lastName}`) === normalize(SOLE_SUPERADMIN.name)
    )
  );
}

export function isEligibleOfficeWorker(worker: Pick<Worker, "id" | "role" | "isActive">): boolean {
  if (!worker.isActive) return false;
  if (worker.id === SOLE_SUPERADMIN.workerId) return true;
  const role = normalize(worker.role);
  return /\b(sales|service|finance|accounts?|management|managing|manager|admin|supervisor|pco(?:s)?|pest control operators?)\b/.test(role);
}

export function findWorkerForAdmin(
  admin: Pick<AdminUser, "id" | "email" | "firstName" | "lastName">,
  workers: Worker[],
): Worker | undefined {
  const email = normalize(admin.email);
  const name = normalize(`${admin.firstName} ${admin.lastName}`);
  const matches = workers.filter(worker =>
    worker.isActive && (
      worker.id === admin.id ||
      (email && normalize(worker.email) === email) ||
      (name && normalize(worker.name) === name)
    ),
  );
  return matches.length === 1 ? matches[0] : undefined;
}

export function buildOfficeLoginDirectory(
  workers: Worker[],
  admins: AdminUser[],
  departmentNames: Map<string, string>,
): OfficeDirectoryEntry[] {
  const activeWorkers = workers.filter(worker =>
    isEligibleOfficeWorker(worker) && normalize(worker.name) !== "administrator"
  );
  const activeAdmins = admins.filter(admin => admin.isActive);
  const matchedAdminIds = new Set<string>();
  const entries = activeWorkers.map(worker => {
    const matchingAdmins = activeAdmins.filter(admin => findWorkerForAdmin(admin, workers)?.id === worker.id);
    const admin = matchingAdmins.length === 1 ? matchingAdmins[0] : undefined;
    if (admin) matchedAdminIds.add(admin.id);
    return {
      id: worker.id,
      name: worker.name,
      username: admin?.username,
      role: worker.id === SOLE_SUPERADMIN.workerId ? SOLE_SUPERADMIN.roleLabel : worker.role || "Office User",
      department: departmentNames.get(worker.departmentId) || "Office",
      authMethod: "password" as const,
      credentialStatus: admin ? "ready" as const : "missing" as const,
    };
  });

  // Keep valid active credential rows visible if their worker match is temporarily
  // unavailable, but never resurrect the retired generic Administrator identity.
  for (const admin of activeAdmins) {
    if (matchedAdminIds.has(admin.id)) continue;
    const name = `${admin.firstName} ${admin.lastName}`.trim();
    if (normalize(name) === "administrator" || normalize(admin.username) === "administrator") continue;
    entries.push({
      id: admin.id,
      name,
      username: admin.username,
      role: admin.id === SOLE_SUPERADMIN.workerId ? SOLE_SUPERADMIN.roleLabel : "Office User",
      department: "Administration",
      authMethod: "password",
      credentialStatus: "ready",
    });
  }

  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

export async function passwordHashNeedsReconciliation(
  configuredPassword: string,
  storedHash: string,
): Promise<boolean> {
  return !(await bcrypt.compare(configuredPassword, storedHash));
}