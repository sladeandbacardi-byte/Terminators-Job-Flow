import bcrypt from "bcryptjs";
import type { AdminUser, Worker } from "@shared/schema";
import { SOLE_SUPERADMIN } from "@shared/superadmin";
import { OFFICE_ORGANOGRAM_WORKER_IDS } from "@shared/organogram";

const normalize = (value: string | null | undefined) =>
  String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();

export type OfficeDirectoryEntry = {
  id: string;
  name: string;
  username?: string;
  role: string;
  department: string;
  authMethod: "password" | "passwordless";
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

export function isPasswordlessOfficeWorker(
  worker: Pick<Worker, "id" | "name" | "role" | "isActive" | "mobileAccessEnabled">,
): boolean {
  return (
    (OFFICE_ORGANOGRAM_WORKER_IDS as readonly string[]).includes(worker.id) &&
    worker.id !== SOLE_SUPERADMIN.workerId &&
    normalize(worker.name) !== "administrator" &&
    normalize(worker.role) !== "administrator" &&
    worker.mobileAccessEnabled !== true &&
    worker.isActive
  );
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
    worker.id === SOLE_SUPERADMIN.workerId || isPasswordlessOfficeWorker(worker)
  );
  const activeAdmins = admins.filter(admin => admin.isActive);
  const entries = activeWorkers.map(worker => {
    const matchingAdmins = activeAdmins.filter(admin => findWorkerForAdmin(admin, workers)?.id === worker.id);
    const admin = matchingAdmins.length === 1 ? matchingAdmins[0] : undefined;
    return {
      id: worker.id,
      name: worker.name,
      username: worker.id === SOLE_SUPERADMIN.workerId ? admin?.username : undefined,
      role: worker.id === SOLE_SUPERADMIN.workerId ? SOLE_SUPERADMIN.roleLabel : worker.role || "Office User",
      department: departmentNames.get(worker.departmentId) || "Office",
      authMethod: worker.id === SOLE_SUPERADMIN.workerId ? "password" as const : "passwordless" as const,
    };
  });

  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

export async function passwordHashNeedsReconciliation(
  configuredPassword: string,
  storedHash: string,
): Promise<boolean> {
  return !(await bcrypt.compare(configuredPassword, storedHash));
}

/**
 * Railway variable editors can preserve one pair of quote characters copied
 * from a dotenv-style value. Remove only one matching surrounding pair; quote
 * characters inside a real password remain significant.
 */
export function normalizeDeploymentSecret(value: string): string {
  const trimmed = value.trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}