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
  const normalizedRole = normalize(role);
  return (
    /\badmin\b/.test(normalizedRole) ||
    /\bsupervisor\b/.test(normalizedRole) ||
    /\bpco(?:s)?\b/.test(normalizedRole) ||
    /\bpest control operators?\b/.test(normalizedRole)
  );
}

export function hasUnrestrictedAccess(identity: AccessIdentity): boolean {
  if (
    identity.id === SOLE_SUPERADMIN.workerId ||
    ("sourceWorkerId" in identity && identity.sourceWorkerId === SOLE_SUPERADMIN.workerId)
  ) {
    return true;
  }

  // Password-authenticated office accounts derive organogram access from their
  // linked worker. A generic role in admin_users is a credential class, not an
  // authoritative job title.
  if (identity.authenticationMethod === "password") {
    return roleQualifiesForUnrestrictedAccess(identity.sourceWorkerRole);
  }

  return roleQualifiesForUnrestrictedAccess(identity.sourceWorkerRole ?? identity.role);
}