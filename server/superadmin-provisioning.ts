import bcrypt from "bcryptjs";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "./db";
import { activityLogs, adminUsers, userSessions, workers } from "@shared/schema";
import { SOLE_SUPERADMIN } from "@shared/superadmin";
import {
  passwordHashNeedsReconciliation,
  normalizeDeploymentSecret,
  selectCanonicalSuperAdminTarget,
} from "./office-account-policy";

export async function ensureSoleSuperAdmin(): Promise<void> {
  await db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('jobflow-sole-superadmin'))`);
    const [worker] = await tx
      .select({
        id: workers.id,
        name: workers.name,
        email: workers.email,
        role: workers.role,
        isActive: workers.isActive,
        userType: workers.userType,
        mobileAccessEnabled: workers.mobileAccessEnabled,
      })
      .from(workers)
      .where(eq(workers.id, SOLE_SUPERADMIN.workerId))
      .limit(1);

    const isDesiredCanonicalWorker =
      worker?.name === SOLE_SUPERADMIN.name &&
      worker.role === "Operations Manager";
    const isLegacyCanonicalWorker =
      worker?.name === "Managing Member" &&
      worker.role === "Managing Member";

    if (
      !worker ||
      (!isDesiredCanonicalWorker && !isLegacyCanonicalWorker)
    ) {
      console.warn(
        `[superadmin] Skipped provisioning: ${SOLE_SUPERADMIN.workerId} does not match the current or known legacy canonical identity`,
      );
      return;
    }

    const configuredUsername = process.env.ADMIN_USERNAME?.trim() || SOLE_SUPERADMIN.username;
    const configuredEmail = process.env.ADMIN_EMAIL?.trim() || worker.email?.trim() || "worker-1@jobflow.local";
    const configuredPassword = process.env.ADMIN_PASSWORD
      ? normalizeDeploymentSecret(process.env.ADMIN_PASSWORD) || undefined
      : undefined;
    const existingAdmins = await tx.select().from(adminUsers);
    const target = selectCanonicalSuperAdminTarget(existingAdmins, configuredUsername);

    if (!target) {
      if (!configuredPassword) {
        const message = "[superadmin] ADMIN_PASSWORD is required to provision the office super administrator";
        if (process.env.NODE_ENV === "production") {
          throw new Error(`${message}; configure it in the deployment's secret variables`);
        }
        console.warn(`${message}; existing accounts were left unchanged in development`);
        return;
      }

      const desiredEmailIsTaken = existingAdmins.some(admin => admin.email === configuredEmail);
      const fallbackEmail = `${SOLE_SUPERADMIN.workerId}@jobflow.local`;
      const email = desiredEmailIsTaken ? fallbackEmail : configuredEmail;
      if (existingAdmins.some(admin => admin.email === email)) {
        throw new Error(`[superadmin] Cannot provision ${SOLE_SUPERADMIN.name}: canonical email is already in use`);
      }

      await tx.insert(adminUsers).values({
        id: SOLE_SUPERADMIN.workerId,
        username: configuredUsername,
        email,
        passwordHash: await bcrypt.hash(configuredPassword, 12),
        firstName: SOLE_SUPERADMIN.firstName,
        lastName: SOLE_SUPERADMIN.lastName,
        role: SOLE_SUPERADMIN.role,
        isActive: true,
      });
      await tx
        .update(adminUsers)
        .set({ isActive: false, updatedAt: new Date() })
        .where(
          and(
            ne(adminUsers.id, SOLE_SUPERADMIN.workerId),
            eq(adminUsers.role, SOLE_SUPERADMIN.role),
            eq(adminUsers.isActive, true),
          ),
        );
      console.log(`[superadmin] Provisioned ${SOLE_SUPERADMIN.name} from the existing administrator credential secret`);
      return;
    }

    const username =
      existingAdmins.some(admin => admin.id !== target.id && admin.username === configuredUsername)
        ? target.username
        : configuredUsername;
    const email =
      existingAdmins.some(admin => admin.id !== target.id && admin.email === configuredEmail)
        ? target.email
        : configuredEmail;

    const passwordChanged = configuredPassword
      ? await passwordHashNeedsReconciliation(configuredPassword, target.passwordHash)
      : false;
    if (!configuredPassword && process.env.NODE_ENV === "production") {
      throw new Error("[superadmin] ADMIN_PASSWORD is required to reconcile the office super administrator");
    }

    await tx
      .update(adminUsers)
      .set({
        username,
        email,
        firstName: SOLE_SUPERADMIN.firstName,
        lastName: SOLE_SUPERADMIN.lastName,
        role: SOLE_SUPERADMIN.role,
        isActive: true,
        ...(passwordChanged ? { passwordHash: await bcrypt.hash(configuredPassword!, 12) } : {}),
        updatedAt: new Date(),
      })
      .where(eq(adminUsers.id, target.id));

    if (passwordChanged) {
      await tx.delete(userSessions).where(eq(userSessions.userId, target.id));
      await tx.insert(activityLogs).values({
        userId: target.id,
        action: "credential_reconciled",
        resource: "admin_users",
        resourceId: target.id,
        details: JSON.stringify({
          reason: "ADMIN_PASSWORD changed",
          source: "startup_reconciliation",
        }),
      });
    }

    await tx
      .update(adminUsers)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(
          ne(adminUsers.id, target.id),
          eq(adminUsers.role, SOLE_SUPERADMIN.role),
          eq(adminUsers.isActive, true),
        ),
      );

    console.log(
      passwordChanged
        ? `[superadmin] Reconciled ${SOLE_SUPERADMIN.name}'s credential from the configured deployment secret`
        : `[superadmin] Confirmed ${SOLE_SUPERADMIN.name} as the sole active super administrator`,
    );
  });
}