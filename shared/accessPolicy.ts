import { SOLE_SUPERADMIN } from "./superadmin";

export type AccessIdentity = {
  id?: string | null;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  role?: string | null;
  sourceWorkerId?: string | null;
  sourceWorkerRole?: string | null;
  sourceWorkerName?: string | null;
  authenticationMethod?: string | null;
};

const normalize = (value: string | null | undefined) =>
  String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();

export function identityDisplayName(identity: AccessIdentity): string {
  return (
    identity.sourceWorkerName?.trim() ||
    identity.name?.trim() ||
    [identity.firstName, identity.lastName].filter(Boolean).join(" ").trim()
  );
}

export function roleQualifiesForUnrestrictedAccess(role: string | null | undefined): boolean {
  void normalize(role);
  return false;
}

export function hasUnrestrictedAccess(identity: AccessIdentity): boolean {
  if (
    identity.id === SOLE_SUPERADMIN.workerId ||
    ("sourceWorkerId" in identity && identity.sourceWorkerId === SOLE_SUPERADMIN.workerId)
  ) {
    return true;
  }

  return false;
}