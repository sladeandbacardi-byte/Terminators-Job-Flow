import bcrypt from "bcryptjs";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "./db";
import { adminUsers, workers } from "@shared/schema";
import { SOLE_SUPERADMIN } from "@shared/superadmin";

export async function ensureSoleSuperAdmin(): Promise<void> {
  const [worker] = await db
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

  if (
    !worker ||
    worker.name !== SOLE_SUPERADMIN.name ||
    worker.role !== "Operations Manager" ||
    !worker.isActive ||
    String(worker.userType ?? "").trim().toLowerCase() !== "staff" ||
    worker.mobileAccessEnabled === true
  ) {
    console.warn(
      `[superadmin] Skipped provisioning: ${SOLE_SUPERADMIN.workerId} must be the active Staff worker ${SOLE_SUPERADMIN.name}, Operations Manager, with mobile access disabled`,
    );
    return;
  }

  const configuredUsername = process.env.ADMIN_USERNAME?.trim() || SOLE_SUPERADMIN.username;
  const configuredEmail = process.env.ADMIN_EMAIL?.trim() || worker.email?.trim() || "worker-1@jobflow.local";
  const configuredPassword = process.env.ADMIN_PASSWORD;

  await db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('jobflow-sole-superadmin'))`);
    const existingAdmins = await tx.select().from(adminUsers);
    const target =
      existingAdmins.find(admin => admin.id === SOLE_SUPERADMIN.workerId) ||
      existingAdmins.find(admin => admin.username === configuredUsername);

    if (!target) {
      if (!configuredPassword) {
        const message = "[superadmin] ADMIN_PASSWORD is required to provision the office super administrator";
        console.warn(`${message}; existing accounts were left unchanged and office login was not provisioned`);
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
        .where(and(ne(adminUsers.id, SOLE_SUPERADMIN.workerId), eq(adminUsers.isActive, true)));
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

    await tx
      .update(adminUsers)
      .set({
        username,
        email,
        firstName: SOLE_SUPERADMIN.firstName,
        lastName: SOLE_SUPERADMIN.lastName,
        role: SOLE_SUPERADMIN.role,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(adminUsers.id, target.id));

    await tx
      .update(adminUsers)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(ne(adminUsers.id, target.id), eq(adminUsers.isActive, true)));

    console.log(`[superadmin] Confirmed ${SOLE_SUPERADMIN.name} as the sole active super administrator`);
  });
}