import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { sql, and, desc, eq, inArray, ne } from "drizzle-orm";
import { runDailyBackupEmail, getBackupEmailConfig, sendBackupFailureAlert } from "./email-backup";
import { sendBrevoTestEmail } from "./smtp-service";
import { 
  insertDepartmentSchema, insertWorkerSchema, insertClientSchema,
  insertInventoryItemSchema, insertRentalContractSchema, insertJobSchema,
  insertInvoiceSchema, insertInvoiceItemSchema,
  insertNotificationSchema, insertEmailTemplateSchema, insertEmailLogSchema,
  insertJobInventoryItemSchema, insertSupplierSchema,
  insertPurchaseOrderSchema, insertPurchaseOrderItemSchema,
  insertCalendarEventSchema, insertCustomReportSchema,
  insertQuoteSubmissionSchema,
  insertVehicleSchema,
  insertVehicleAssignmentSchema,
  insertKmLogSchema,
  insertFuelFillupSchema,
  insertVehicleInspectionSchema,
  insertVehicleIssueSchema,
  insertServiceRecordSchema,
  insertWorkshopJobSchema,
  insertServiceScheduleEntrySchema,
  insertTreatmentReportSchema,
  insertCommunicationNoteSchema,
  insertLegalEntitySchema,
  normalizeLeadStatus,
  LEAD_STATUS_LABELS,
  overtimeEntries,
  overtimeAuditEntries,
} from "@shared/schema";
import { z } from "zod";
import { sendEmail, generatePurchaseOrderEmail, generateApprovalNotificationEmail } from "./email-service";
import { createSageService } from "./sage-integration";
import { AuthService, requireAuth, logActivity, type AuthenticatedRequest } from "./auth-service";
import multer from "multer";
import * as XLSX from "xlsx";
import { getDashboardRole } from "@shared/dashboardRole";
import { calculateOvertimeMinutes } from "@shared/overtime";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function registerRoutes(app: Express): Promise<Server> {

  // Hardcoded staff list — used as fallback when DB is empty (e.g. fresh Railway deploy)
  const HARDCODED_STAFF = [
    { id: "worker-1", name: "Julien Botha",       role: "Operations Manager",             departmentId: "div-6" },
    { id: "worker-2", name: "Maryka Venter",      role: "Pest Control Services Manager",  departmentId: "div-6" },
    { id: "worker-3", name: "Mariette Koekemoer", role: "Hygiene Services Manager",       departmentId: "div-6" },
    { id: "worker-4", name: "Juli Holtshausen",   role: "Finance & HR Manager",           departmentId: "div-7" },
    { id: "worker-5", name: "Sheryl-Lyn Lee",     role: "Existing Clients Sales & Admin", departmentId: "div-5" },
    { id: "worker-6", name: "Sales 2",             role: "Sales Rep",                      departmentId: "div-5" },
  ];

  const overtimeEntryInput = z.object({
    workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid work date"),
    clientId: z.string().min(1, "Select a client"),
    jobId: z.string().trim().min(1).optional().nullable(),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "Enter a valid start time"),
    finishTime: z.string().regex(/^\d{2}:\d{2}$/, "Enter a valid finish time"),
    notes: z.string().trim().min(1, "Enter an overtime reason"),
  });

  const isOvertimeApprover = (req: AuthenticatedRequest) => {
    if (req.user?.authenticationMethod === "profile_picker") {
      return false;
    }

    const sourceRole = req.user?.sourceWorkerRole;
    if (sourceRole !== undefined) {
      const rawRole = sourceRole.trim().toLowerCase();
      // Worker profiles carry source role data. Do not use getDashboardRole
      // here: it deliberately defaults unknown roles to admin for UI routing.
      const approvedWorkerRoles = new Set([
        "managing member",
        "managing director",
        "operations manager",
        "service manager",
        "pest control services manager",
        "hygiene services manager",
        "owner",
        "director",
        "md",
        "ceo",
        "coo",
      ]);
      return approvedWorkerRoles.has(rawRole);
    }

    // Password/JWT admin accounts use their stored role directly.
    const storedRole = String(req.user?.role ?? "").trim().toLowerCase();
    return storedRole === "admin" || storedRole === "manager" || storedRole === "superadmin";
  };

  const overtimeActorName = (req: AuthenticatedRequest) =>
    req.user?.username || [req.user?.firstName, req.user?.lastName].filter(Boolean).join(" ") || "Unknown user";

  const logOvertimeAudit = async (
    overtimeEntryId: string,
    req: AuthenticatedRequest,
    action: "submitted" | "edited" | "approved" | "rejected" | "reopened",
    details?: Record<string, unknown>,
    executor: any = db,
  ) => {
    await executor.insert(overtimeAuditEntries).values({
      overtimeEntryId,
      actorId: req.user!.id,
      actorName: overtimeActorName(req),
      action,
      details: details ? JSON.stringify(details) : null,
    });
  };

  const enrichOvertimeEntries = async (entries: (typeof overtimeEntries.$inferSelect)[]) => {
    const [workers, clients, jobs] = await Promise.all([
      storage.getWorkers(),
      storage.getClients(),
      storage.getJobs(),
    ]);
    const workersById = new Map(workers.map(worker => [worker.id, worker]));
    const clientsById = new Map(clients.map(client => [client.id, client]));
    const jobsById = new Map(jobs.map(job => [job.id, job]));

    return entries.map(entry => {
      const employee = workersById.get(entry.employeeId);
      const client = clientsById.get(entry.clientId);
      const job = entry.jobId ? jobsById.get(entry.jobId) : undefined;
      return {
        ...entry,
        employeeName: employee?.name ?? "Unknown employee",
        clientName: client?.name ?? "Unknown client",
        jobLabel: job ? (job.jobNumber || job.title) : null,
      };
    });
  };

  const ensureOvertimeRelations = async (clientId: string, jobId?: string | null) => {
    const client = await storage.getClient(clientId);
    if (!client) throw new Error("Selected client was not found");
    if (jobId) {
      const job = await storage.getJob(jobId);
      if (!job) throw new Error("Selected job was not found");
      if (job.clientId !== clientId) throw new Error("The selected job does not belong to this client");
    }
  };

  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }

      // Get the worker/user by ID — fall back to hardcoded list if DB is empty or throws
      let worker: any = null;
      try {
        worker = await storage.getWorker(userId);
      } catch (dbErr) {
        console.warn("DB unavailable during login, using hardcoded fallback:", dbErr);
      }

      if (!worker) {
        const fallback = HARDCODED_STAFF.find(s => s.id === userId);
        if (fallback) {
          worker = { ...fallback, email: null, phone: null, isActive: true, createdAt: new Date(), employeeId: null };
        }
      }

      if (!worker) {
        return res.status(401).json({ message: "User not found" });
      }
      if (worker.isActive === false) {
        return res.status(403).json({ message: "This profile is inactive" });
      }

      const token = AuthService.generateWorkerToken(worker.id);

      // Log successful login using worker info
      const activityLog = {
        userId: worker.id,
        action: "login" as const,
        details: "User logged in successfully",
        ipAddress: req.ip || req.connection.remoteAddress || null,
        userAgent: req.headers['user-agent'] || null,
        timestamp: new Date()
      };

      // Store the activity log (simplified version)
      console.log("Login activity:", activityLog);

      res.json({
        token: token,
        user: {
          id: worker.id,
          username: worker.name,
          email: worker.email,
          firstName: worker.name.split(' ')[0],
          lastName: worker.name.split(' ').slice(1).join(' '),
          role: worker.role || 'worker',
          departmentId: worker.departmentId,
        }
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Mobile authentication routes
  app.post("/api/auth/mobile-login", async (req, res) => {
    try {
      const { employeeId, pin } = req.body;
      
      if (!employeeId || !pin) {
        return res.status(400).json({ message: "Employee ID and PIN are required" });
      }

      const worker = await storage.getWorkerByEmployeeId(employeeId.trim());
      
      if (!worker || !worker.pin) {
        return res.status(401).json({ message: "Invalid employee ID or PIN" });
      }

      // For demo purposes, check PIN directly (in production, should be hashed)
      if (worker.pin !== pin.trim()) {
        return res.status(401).json({ message: "Invalid employee ID or PIN" });
      }

      if (!worker.isActive) {
        return res.status(401).json({ message: "Account is inactive" });
      }

      // Generate simple token for mobile session
      const token = `mobile_${worker.id}_${Date.now()}`;

      res.json({
        token,
        worker: {
          id: worker.id,
          name: worker.name,
          email: worker.email,
          phone: worker.phone,
          departmentId: worker.departmentId,
          role: worker.role,
          employeeId: worker.employeeId,
        }
      });
    } catch (error) {
      console.error("Mobile login error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/mobile/work-orders/:workerId", async (req, res) => {
    try {
      const { workerId } = req.params;
      console.log("Fetching work orders for worker:", workerId);
      
      // Get today's and upcoming jobs for the worker
      const jobs = await storage.getJobsForWorker(workerId);
      console.log("Found jobs:", jobs.length);
      
      res.json(jobs);
    } catch (error) {
      console.error("Error fetching work orders:", error);
      res.status(500).json({ message: "Failed to fetch work orders" });
    }
  });

  // ── Equipment Checklists ────────────────────────────────────────────────────
  app.get("/api/equipment-checklists", async (req, res) => {
    const { date, workerId } = req.query as any;
    const list = await storage.getEquipmentChecklists(date, workerId);
    res.json(list);
  });

  app.get("/api/equipment-checklists/stats/today", async (req, res) => {
    const today = new Date().toISOString().slice(0, 10);
    const all = await storage.getEquipmentChecklists(today);
    res.json({
      total: all.length,
      passed: all.filter(c => c.status === "passed").length,
      passedWithNotes: all.filter(c => c.status === "passed_with_notes").length,
      failed: all.filter(c => c.status === "failed").length,
      pending: all.filter(c => c.status === "pending").length,
      criticalMissing: all.filter(c => c.hasCriticalMissing).length,
    });
  });

  app.get("/api/equipment-checklists/:id", async (req, res) => {
    const c = await storage.getEquipmentChecklist(req.params.id);
    if (!c) return res.status(404).json({ error: "Not found" });
    res.json(c);
  });

  app.post("/api/equipment-checklists", async (req, res) => {
    const c = await storage.createEquipmentChecklist(req.body);
    res.status(201).json(c);
  });

  app.patch("/api/equipment-checklists/:id", async (req, res) => {
    const c = await storage.updateEquipmentChecklist(req.params.id, req.body);
    res.json(c);
  });

  app.get("/api/equipment-checklists/:id/items", async (req, res) => {
    const items = await storage.getEquipmentChecklistItems(req.params.id);
    res.json(items);
  });

  app.post("/api/equipment-checklists/:id/items", async (req, res) => {
    const items = await storage.replaceEquipmentChecklistItems(req.params.id, req.body);
    res.json(items);
  });

  app.patch("/api/mobile/jobs/:jobId/status", async (req, res) => {
    try {
      const { jobId } = req.params;
      const { status } = req.body;
      console.log("Updating job status:", jobId, "to", status);
      
      if (!status) {
        return res.status(400).json({ message: "Status is required" });
      }
      
      const updatedJob = await storage.updateJobStatus(jobId, status);
      console.log("Job status updated successfully");
      
      res.json(updatedJob);
    } catch (error) {
      console.error("Error updating job status:", error);
      res.status(500).json({ message: "Failed to update job status" });
    }
  });

  // Public endpoint — lists staff for login screen (no auth required).
  // Falls back to hardcoded list if DB is empty or unavailable (e.g. fresh Railway deploy).
  app.get("/api/auth/staff", async (_req, res) => {
    try {
      const allWorkers = await storage.getWorkers();
      const dbStaff = allWorkers
        .filter(w => HARDCODED_STAFF.some(h => h.id === w.id))
        .map(w => ({ id: w.id, name: w.name, role: w.role, departmentId: w.departmentId }));
      res.json(dbStaff.length > 0 ? dbStaff : HARDCODED_STAFF);
    } catch (err) {
      console.error("[auth/staff] DB error, using hardcoded fallback:", err);
      res.json(HARDCODED_STAFF);
    }
  });

  app.post("/api/auth/logout", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
      
      if (token) {
        await AuthService.logoutUser(token);
        
        // Log logout activity
        if (req.user) {
          await AuthService.logActivity({
            userId: req.user.id,
            action: "logout",
            details: "User logged out",
            ipAddress: req.ip || req.connection.remoteAddress || null,
            userAgent: req.headers['user-agent'] || null,
          });
        }
      }
      
      res.json({ message: "Logged out successfully" });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/auth/me", requireAuth, async (req: AuthenticatedRequest, res) => {
    res.json({
      id: req.user!.id,
      username: req.user!.username,
      email: req.user!.email,
      firstName: req.user!.firstName,
      lastName: req.user!.lastName,
      role: req.user!.role,
    });
  });

  // Activity logs - admin only access
  app.get("/api/auth/activity-logs", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const logs = await storage.getActivityLogs();
      res.json(logs);
    } catch (error) {
      console.error("Error fetching activity logs:", error);
      res.status(500).json({ error: "Failed to fetch activity logs" });
    }
  });
  
  // Clean expired sessions (can be called by a scheduled job)
  app.post("/api/auth/cleanup-sessions", async (req, res) => {
    try {
      await AuthService.cleanExpiredSessions();
      res.json({ message: "Session cleanup completed" });
    } catch (error) {
      console.error("Session cleanup error:", error);
      res.status(500).json({ message: "Session cleanup failed" });
    }
  });

  // ── Overtime ────────────────────────────────────────────────────────────────
  app.get("/api/overtime/my", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const entries = await db.select().from(overtimeEntries)
        .where(eq(overtimeEntries.employeeId, req.user!.id))
        .orderBy(desc(overtimeEntries.workDate), desc(overtimeEntries.createdAt));
      const enriched = await enrichOvertimeEntries(entries);
      const pendingMinutes = entries
        .filter(entry => entry.status === "pending")
        .reduce((total, entry) => total + entry.overtimeMinutes, 0);
      const approvedMinutes = entries
        .filter(entry => entry.status === "approved")
        .reduce((total, entry) => total + entry.overtimeMinutes, 0);
      res.json({ entries: enriched, summary: { pendingMinutes, approvedMinutes } });
    } catch (error) {
      console.error("Could not load employee overtime:", error);
      res.status(500).json({ error: "Could not load overtime entries" });
    }
  });

  app.get("/api/overtime", requireAuth, async (req: AuthenticatedRequest, res) => {
    if (!isOvertimeApprover(req)) return res.status(403).json({ error: "Only administrators and managers can review overtime" });
    try {
      const { employeeId, status, from, to } = req.query as Record<string, string | undefined>;
      const entries = await db.select().from(overtimeEntries)
        .orderBy(desc(overtimeEntries.workDate), desc(overtimeEntries.createdAt));
      const filtered = entries.filter(entry =>
        (!employeeId || entry.employeeId === employeeId) &&
        (!status || status === "all" || entry.status === status) &&
        (!from || entry.workDate >= from) &&
        (!to || entry.workDate <= to),
      );
      const enriched = await enrichOvertimeEntries(filtered);
      const pendingMinutes = filtered
        .filter(entry => entry.status === "pending")
        .reduce((total, entry) => total + entry.overtimeMinutes, 0);
      const approvedMinutes = filtered
        .filter(entry => entry.status === "approved")
        .reduce((total, entry) => total + entry.overtimeMinutes, 0);
      res.json({ entries: enriched, summary: { pendingMinutes, approvedMinutes } });
    } catch (error) {
      console.error("Could not load overtime approvals:", error);
      res.status(500).json({ error: "Could not load overtime entries" });
    }
  });

  app.get("/api/overtime/prefill/:jobId", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const job = await storage.getJob(req.params.jobId);
      if (!job) return res.status(404).json({ error: "Job not found" });
      res.json({
        clientId: job.clientId,
        jobId: job.id,
        workDate: new Date(job.scheduledDate).toISOString().slice(0, 10),
      });
    } catch (error) {
      console.error("Could not prepare overtime entry:", error);
      res.status(500).json({ error: "Could not prepare overtime entry" });
    }
  });

  app.post("/api/overtime", requireAuth, async (req: AuthenticatedRequest, res) => {
    const parsed = overtimeEntryInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid overtime entry" });
    const data = parsed.data;
    const overtimeMinutes = calculateOvertimeMinutes(data.startTime, data.finishTime);
    if (overtimeMinutes === null) return res.status(400).json({ error: "Finish time must be later than start time on the same day" });
    if (overtimeMinutes === 0) {
      return res.status(400).json({ error: "No overtime detected. Normal working hours are 08:00 to 16:00." });
    }

    try {
      await ensureOvertimeRelations(data.clientId, data.jobId);
      const entry = await db.transaction(async (tx) => {
        const [created] = await tx.insert(overtimeEntries).values({
          employeeId: req.user!.id,
          workDate: data.workDate,
          clientId: data.clientId,
          jobId: data.jobId || null,
          startTime: data.startTime,
          finishTime: data.finishTime,
          notes: data.notes,
          overtimeMinutes,
          status: "pending",
          updatedAt: new Date(),
        }).returning();
        await logOvertimeAudit(created.id, req, "submitted", {
          workDate: created.workDate,
          overtimeMinutes: created.overtimeMinutes,
        }, tx);
        return created;
      });
      res.status(201).json((await enrichOvertimeEntries([entry]))[0]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not submit overtime";
      console.error("Could not submit overtime:", error);
      res.status(400).json({ error: message });
    }
  });

  app.patch("/api/overtime/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    const parsed = overtimeEntryInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid overtime entry" });
    const data = parsed.data;
    const overtimeMinutes = calculateOvertimeMinutes(data.startTime, data.finishTime);
    if (overtimeMinutes === null) return res.status(400).json({ error: "Finish time must be later than start time on the same day" });
    if (overtimeMinutes === 0) {
      return res.status(400).json({ error: "No overtime detected. Normal working hours are 08:00 to 16:00." });
    }

    try {
      const [existing] = await db.select().from(overtimeEntries)
        .where(eq(overtimeEntries.id, req.params.id))
        .limit(1);
      if (!existing) return res.status(404).json({ error: "Overtime entry not found" });
      if (existing.employeeId !== req.user!.id) return res.status(403).json({ error: "You can only edit your own overtime" });
      if (existing.status !== "pending") return res.status(409).json({ error: "Only pending overtime entries can be edited" });

      await ensureOvertimeRelations(data.clientId, data.jobId);
      const entry = await db.transaction(async (tx) => {
        const [updated] = await tx.update(overtimeEntries).set({
          workDate: data.workDate,
          clientId: data.clientId,
          jobId: data.jobId || null,
          startTime: data.startTime,
          finishTime: data.finishTime,
          notes: data.notes,
          overtimeMinutes,
          updatedAt: new Date(),
        }).where(and(
          eq(overtimeEntries.id, existing.id),
          eq(overtimeEntries.employeeId, req.user!.id),
          eq(overtimeEntries.status, "pending"),
        )).returning();
        if (!updated) return null;
        await logOvertimeAudit(updated.id, req, "edited", {
          workDate: updated.workDate,
          overtimeMinutes: updated.overtimeMinutes,
        }, tx);
        return updated;
      });
      if (!entry) return res.status(409).json({ error: "Only pending overtime entries can be edited" });
      res.json((await enrichOvertimeEntries([entry]))[0]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not update overtime";
      console.error("Could not update overtime:", error);
      res.status(400).json({ error: message });
    }
  });

  app.get("/api/overtime/:id/audit", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const [entry] = await db.select().from(overtimeEntries)
        .where(eq(overtimeEntries.id, req.params.id))
        .limit(1);
      if (!entry) return res.status(404).json({ error: "Overtime entry not found" });
      if (entry.employeeId !== req.user!.id && !isOvertimeApprover(req)) {
        return res.status(403).json({ error: "You cannot view this audit history" });
      }
      const audit = await db.select().from(overtimeAuditEntries)
        .where(eq(overtimeAuditEntries.overtimeEntryId, entry.id))
        .orderBy(desc(overtimeAuditEntries.createdAt));
      res.json(audit);
    } catch (error) {
      console.error("Could not load overtime audit history:", error);
      res.status(500).json({ error: "Could not load audit history" });
    }
  });

  app.post("/api/overtime/:id/approve", requireAuth, async (req: AuthenticatedRequest, res) => {
    if (!isOvertimeApprover(req)) return res.status(403).json({ error: "Only administrators and managers can approve overtime" });
    try {
      const [target] = await db.select({ employeeId: overtimeEntries.employeeId })
        .from(overtimeEntries)
        .where(eq(overtimeEntries.id, req.params.id))
        .limit(1);
      if (target?.employeeId === req.user!.id) {
        return res.status(403).json({ error: "You cannot approve your own overtime entry" });
      }
      const entry = await db.transaction(async (tx) => {
        const approvedAt = new Date();
        const [updated] = await tx.update(overtimeEntries).set({
          status: "approved",
          approvedById: req.user!.id,
          approvedByName: overtimeActorName(req),
          approvalTimestamp: approvedAt,
          rejectionReason: null,
          updatedAt: approvedAt,
        }).where(and(
          eq(overtimeEntries.id, req.params.id),
          eq(overtimeEntries.status, "pending"),
          ne(overtimeEntries.employeeId, req.user!.id),
        )).returning();
        if (!updated) return null;
        await logOvertimeAudit(updated.id, req, "approved", { overtimeMinutes: updated.overtimeMinutes }, tx);
        return updated;
      });
      if (!entry) return res.status(409).json({ error: "Only pending overtime entries can be approved" });
      res.json((await enrichOvertimeEntries([entry]))[0]);
    } catch (error) {
      console.error("Could not approve overtime:", error);
      res.status(500).json({ error: "Could not approve overtime" });
    }
  });

  app.post("/api/overtime/:id/reject", requireAuth, async (req: AuthenticatedRequest, res) => {
    if (!isOvertimeApprover(req)) return res.status(403).json({ error: "Only administrators and managers can reject overtime" });
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
    try {
      const entry = await db.transaction(async (tx) => {
        const rejectedAt = new Date();
        const [updated] = await tx.update(overtimeEntries).set({
          status: "rejected",
          approvedById: req.user!.id,
          approvedByName: overtimeActorName(req),
          approvalTimestamp: rejectedAt,
          rejectionReason: reason || null,
          updatedAt: rejectedAt,
        }).where(and(eq(overtimeEntries.id, req.params.id), eq(overtimeEntries.status, "pending"))).returning();
        if (!updated) return null;
        await logOvertimeAudit(updated.id, req, "rejected", reason ? { reason } : undefined, tx);
        return updated;
      });
      if (!entry) return res.status(409).json({ error: "Only pending overtime entries can be rejected" });
      res.json((await enrichOvertimeEntries([entry]))[0]);
    } catch (error) {
      console.error("Could not reject overtime:", error);
      res.status(500).json({ error: "Could not reject overtime" });
    }
  });

  app.post("/api/overtime/:id/reopen", requireAuth, async (req: AuthenticatedRequest, res) => {
    if (!isOvertimeApprover(req)) return res.status(403).json({ error: "Only administrators and managers can reopen overtime" });
    try {
      const entry = await db.transaction(async (tx) => {
        const [updated] = await tx.update(overtimeEntries).set({
          status: "pending",
          approvedById: null,
          approvedByName: null,
          approvalTimestamp: null,
          rejectionReason: null,
          updatedAt: new Date(),
        }).where(and(eq(overtimeEntries.id, req.params.id), inArray(overtimeEntries.status, ["approved", "rejected"]))).returning();
        if (!updated) return null;
        await logOvertimeAudit(updated.id, req, "reopened", undefined, tx);
        return updated;
      });
      if (!entry) return res.status(409).json({ error: "Only approved or rejected overtime entries can be reopened" });
      res.json((await enrichOvertimeEntries([entry]))[0]);
    } catch (error) {
      console.error("Could not reopen overtime:", error);
      res.status(500).json({ error: "Could not reopen overtime" });
    }
  });

  app.post("/api/overtime/bulk-approve", requireAuth, async (req: AuthenticatedRequest, res) => {
    if (!isOvertimeApprover(req)) return res.status(403).json({ error: "Only administrators and managers can approve overtime" });
    const ids = Array.isArray(req.body?.ids)
      ? [...new Set(req.body.ids.filter((id: unknown) => typeof id === "string" && id.length > 0))]
      : [];
    if (ids.length === 0) return res.status(400).json({ error: "Select at least one pending overtime entry" });
    try {
      const selectedEntries = await db.select({ employeeId: overtimeEntries.employeeId })
        .from(overtimeEntries)
        .where(inArray(overtimeEntries.id, ids));
      if (selectedEntries.some(entry => entry.employeeId === req.user!.id)) {
        return res.status(403).json({ error: "Remove your own overtime entries before bulk approval" });
      }
      const approved = await db.transaction(async (tx) => {
        const approvedAt = new Date();
        const updated = await tx.update(overtimeEntries).set({
          status: "approved",
          approvedById: req.user!.id,
          approvedByName: overtimeActorName(req),
          approvalTimestamp: approvedAt,
          rejectionReason: null,
          updatedAt: approvedAt,
        }).where(and(
          inArray(overtimeEntries.id, ids),
          eq(overtimeEntries.status, "pending"),
          ne(overtimeEntries.employeeId, req.user!.id),
        )).returning();
        for (const entry of updated) {
          await logOvertimeAudit(entry.id, req, "approved", {
            overtimeMinutes: entry.overtimeMinutes,
            bulk: true,
          }, tx);
        }
        return updated;
      });
      res.json({ approvedCount: approved.length, entries: await enrichOvertimeEntries(approved) });
    } catch (error) {
      console.error("Could not bulk approve overtime:", error);
      res.status(500).json({ error: "Could not bulk approve overtime" });
    }
  });
  
  // ── Global Search ──────────────────────────────────────────────────────────
  app.get("/api/search", requireAuth, async (req: AuthenticatedRequest, res) => {
    const q = ((req.query.q as string) || "").trim();
    if (q.length < 2) return res.json({ results: [] });

    const pattern = `%${q}%`;
    const role = getDashboardRole({
      departmentId: (req.user as any)?.departmentId as string | undefined,
      role: req.user?.role,
    });
    const canSeeLeads    = ["admin","manager","sales"].includes(role);
    const canSeeQuotes   = ["admin","manager","sales"].includes(role);
    const canSeeInvoices = ["admin","accounts","manager"].includes(role);
    const canSeeContracts  = ["admin","manager","coordinator","accounts"].includes(role);
    const canSeeFieldDiary = ["admin","manager","coordinator","service"].includes(role);
    const canSeeStaff    = ["admin","manager","coordinator","accounts"].includes(role);

    try {
      const [cRows, jRows, qRows, iRows, scRows, rcRows, fdRows, wRows] = await Promise.all([
        db.execute(sql`
          SELECT id, name, trading_name, contact_person, phone, email
          FROM clients
          WHERE name ILIKE ${pattern}
             OR trading_name ILIKE ${pattern}
             OR contact_person ILIKE ${pattern}
             OR phone ILIKE ${pattern}
             OR email ILIKE ${pattern}
          ORDER BY name LIMIT 5
        `),
        db.execute(sql`
          SELECT j.id, j.job_number, j.title, j.status, c.name AS client_name
          FROM jobs j
          LEFT JOIN clients c ON c.id = j.client_id
          WHERE j.job_number ILIKE ${pattern}
             OR j.title ILIKE ${pattern}
             OR c.name ILIKE ${pattern}
          ORDER BY j.created_at DESC LIMIT 5
        `),
        db.execute(sql`
          SELECT id, quote_number, company_name, contact_person, phone, email, status
          FROM quote_submissions
          WHERE quote_number ILIKE ${pattern}
             OR company_name ILIKE ${pattern}
             OR contact_person ILIKE ${pattern}
             OR phone ILIKE ${pattern}
             OR email ILIKE ${pattern}
          ORDER BY submitted_at DESC LIMIT 5
        `),
        db.execute(sql`
          SELECT i.id, i.invoice_number, i.status, i.total, c.name AS client_name
          FROM invoices i
          LEFT JOIN clients c ON c.id = i.client_id
          WHERE i.invoice_number ILIKE ${pattern}
             OR c.name ILIKE ${pattern}
          ORDER BY i.created_at DESC LIMIT 5
        `),
        db.execute(sql`
          SELECT id, contract_number, customer_name, active_status
          FROM service_contracts
          WHERE contract_number ILIKE ${pattern}
             OR customer_name ILIKE ${pattern}
          ORDER BY created_at DESC LIMIT 5
        `),
        db.execute(sql`
          SELECT id, contract_number, customer_name, is_active
          FROM rental_contracts
          WHERE contract_number ILIKE ${pattern}
             OR customer_name ILIKE ${pattern}
          ORDER BY created_at DESC LIMIT 5
        `),
        db.execute(sql`
          SELECT id, diary_number, client_name, job_number, worker_name
          FROM field_diaries
          WHERE diary_number ILIKE ${pattern}
             OR client_name ILIKE ${pattern}
             OR job_number ILIKE ${pattern}
             OR worker_name ILIKE ${pattern}
          ORDER BY created_at DESC LIMIT 5
        `),
        db.execute(sql`
          SELECT id, name, role, email, phone
          FROM workers
          WHERE name ILIKE ${pattern}
             OR email ILIKE ${pattern}
             OR phone ILIKE ${pattern}
          ORDER BY name LIMIT 5
        `),
      ]);

      const results: any[] = [];
      const QUOTE_STATUSES = new Set(["quoted", "converted", "lost"]);

      for (const r of cRows.rows as any[]) {
        results.push({
          type: "client",
          id: r.id,
          label: r.trading_name ? `${r.name} (${r.trading_name})` : r.name,
          sublabel: [r.contact_person, r.phone].filter(Boolean).join(" · "),
          url: `/clients/${r.id}`,
        });
      }
      for (const r of jRows.rows as any[]) {
        const jobLabel = r.job_number || r.title;
        const jobSub = [r.job_number && r.title !== r.job_number ? r.title : null, r.client_name, r.status]
          .filter(Boolean).join(" · ");
        results.push({ type: "job", id: r.id, label: jobLabel, sublabel: jobSub, url: `/jobs?open=${r.id}` });
      }
      for (const r of qRows.rows as any[]) {
        if (QUOTE_STATUSES.has(r.status)) {
          if (canSeeQuotes) results.push({
            type: "quote",
            id: r.id,
            label: r.quote_number || r.company_name,
            sublabel: [r.company_name, r.contact_person, r.status].filter(Boolean).join(" · "),
            url: `/quotes?open=${r.id}`,
          });
        } else {
          if (canSeeLeads) results.push({
            type: "lead",
            id: r.id,
            label: r.quote_number || r.company_name,
            sublabel: [r.company_name, r.contact_person, r.status].filter(Boolean).join(" · "),
            url: `/leads?open=${r.id}`,
          });
        }
      }
      if (canSeeInvoices) for (const r of iRows.rows as any[]) {
        const amt = r.total ? `R ${parseFloat(r.total).toFixed(2)}` : null;
        results.push({
          type: "invoice",
          id: r.id,
          label: r.invoice_number,
          sublabel: [r.client_name, r.status, amt].filter(Boolean).join(" · "),
          url: `/invoices?open=${r.id}`,
        });
      }
      if (canSeeContracts) for (const r of scRows.rows as any[]) {
        results.push({
          type: "service_contract",
          id: r.id,
          label: r.contract_number || "Contract",
          sublabel: [r.customer_name, r.active_status ? "Active" : "Inactive"].filter(Boolean).join(" · "),
          url: `/contracts?open=${r.id}&kind=service`,
        });
      }
      if (canSeeContracts) for (const r of rcRows.rows as any[]) {
        results.push({
          type: "rental_contract",
          id: r.id,
          label: r.contract_number || "Rental",
          sublabel: [r.customer_name, r.is_active ? "Active" : "Inactive"].filter(Boolean).join(" · "),
          url: `/contracts?open=${r.id}&kind=rental`,
        });
      }
      if (canSeeFieldDiary) for (const r of fdRows.rows as any[]) {
        results.push({
          type: "field_diary",
          id: r.id,
          label: r.diary_number,
          sublabel: [r.client_name, r.job_number, r.worker_name].filter(Boolean).join(" · "),
          url: `/field-diaries?open=${r.id}`,
        });
      }
      if (canSeeStaff) for (const r of wRows.rows as any[]) {
        results.push({
          type: "staff",
          id: r.id,
          label: r.name,
          sublabel: [r.role, r.email].filter(Boolean).join(" · "),
          url: `/workers?open=${r.id}`,
        });
      }

      res.json({ results });
    } catch (error) {
      console.error("Search error:", error);
      res.status(500).json({ error: "Search failed", results: [] });
    }
  });

  // Divisions
  app.get("/api/departments", async (req, res) => {
    const departments = await storage.getDepartments();
    res.json(departments);
  });

  app.get("/api/departments/:id", async (req, res) => {
    const division = await storage.getDepartment(req.params.id);
    if (!division) {
      return res.status(404).json({ error: "Division not found" });
    }
    res.json(division);
  });

  app.post("/api/departments", async (req, res) => {
    try {
      const division = insertDepartmentSchema.parse(req.body);
      const created = await storage.createDepartment(division);
      res.status(201).json(created);
    } catch (error) {
      res.status(400).json({ error: "Invalid division data" });
    }
  });

  // Workers
  app.get("/api/workers", async (req, res) => {
    const { departmentId } = req.query;
    if (departmentId) {
      const workers = await storage.getWorkersByDepartment(departmentId as string);
      res.json(workers.map(({ pin: _pin, ...worker }) => worker));
    } else {
      const workers = await storage.getWorkers();
      res.json(workers.map(({ pin: _pin, ...worker }) => worker));
    }
  });

  app.get("/api/workers/:id", async (req, res) => {
    const worker = await storage.getWorker(req.params.id);
    if (!worker) {
      return res.status(404).json({ error: "Worker not found" });
    }
    const { pin: _pin, ...safeWorker } = worker;
    res.json(safeWorker);
  });

  app.post("/api/workers", requireAuth, async (req: AuthenticatedRequest, res) => {
    if (!isOvertimeApprover(req)) return res.status(403).json({ error: "Only administrators and managers can create staff profiles" });
    try {
      const worker = insertWorkerSchema.parse(req.body);
      if (worker.pin) worker.pin = await AuthService.hashPassword(worker.pin);
      const created = await storage.createWorker(worker);
      res.status(201).json(created);
    } catch (error) {
      res.status(400).json({ error: "Invalid worker data" });
    }
  });

  app.put("/api/workers/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    if (!isOvertimeApprover(req)) return res.status(403).json({ error: "Only administrators and managers can update staff profiles" });
    try {
      const updateData = insertWorkerSchema.partial().parse(req.body);
      if (updateData.pin) updateData.pin = await AuthService.hashPassword(updateData.pin);
      const updated = await storage.updateWorker(req.params.id, updateData);
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Invalid worker data" });
    }
  });

  app.delete("/api/workers/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    if (!isOvertimeApprover(req)) return res.status(403).json({ error: "Only administrators and managers can delete staff profiles" });
    const deleted = await storage.deleteWorker(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Worker not found" });
    }
    res.status(204).send();
  });

  // Clients
  app.get("/api/clients", async (req, res) => {
    const clients = await storage.getClients();
    res.json(clients);
  });

  app.get("/api/clients/:id", async (req, res) => {
    const client = await storage.getClient(req.params.id);
    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }
    res.json(client);
  });

  app.post("/api/clients", async (req, res) => {
    try {
      console.log("Creating client with data:", JSON.stringify(req.body));
      const client = insertClientSchema.parse(req.body);
      const created = await storage.createClient(client);
      res.status(201).json(created);
    } catch (error) {
      console.error("Client creation error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') 
        });
      }
      res.status(400).json({ error: "Invalid client data", details: error instanceof Error ? error.message : String(error) });
    }
  });

  // Support both PUT and PATCH for updating a client. The frontend uses PATCH;
  // PUT is kept for backwards compatibility with older integrations.
  const updateClientHandler = async (req: any, res: any) => {
    try {
      console.log(`Updating client ${req.params.id} with data:`, JSON.stringify(req.body));
      const updateData = insertClientSchema.partial().parse(req.body);
      const updated = await storage.updateClient(req.params.id, updateData);
      res.json(updated);
    } catch (error) {
      console.error("Client update error:", error);
      res.status(400).json({ error: "Invalid client data", details: error instanceof Error ? error.message : String(error) });
    }
  };
  app.put("/api/clients/:id", updateClientHandler);
  app.patch("/api/clients/:id", updateClientHandler);

  app.patch("/api/clients/:id/status", async (req, res) => {
    try {
      const { status } = req.body;
      if (!["active", "inactive", "suspended"].includes(status)) {
        return res.status(400).json({ error: "Invalid status. Must be active, inactive, or suspended." });
      }
      const updated = await storage.updateClient(req.params.id, { status });
      if (!updated) return res.status(404).json({ error: "Client not found" });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update client status" });
    }
  });

  app.delete("/api/clients", async (req, res) => {
    const count = await storage.deleteAllClients();
    res.json({ deleted: count });
  });

  app.delete("/api/clients/:id", async (req, res) => {
    const deleted = await storage.deleteClient(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Client not found" });
    }
    res.status(204).send();
  });

  // ── Client Contacts ──────────────────────────────────────────────────────────
  app.get("/api/clients/:clientId/contacts", async (req, res) => {
    const list = await storage.getClientContacts(req.params.clientId);
    res.json(list);
  });

  app.post("/api/clients/:clientId/contacts", async (req, res) => {
    try {
      const { insertClientContactSchema } = await import("@shared/schema");
      const data = insertClientContactSchema.parse({ ...req.body, clientId: req.params.clientId });
      const created = await storage.createClientContact(data);
      res.status(201).json(created);
    } catch (error) {
      res.status(400).json({ error: "Invalid contact data", details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.patch("/api/client-contacts/:id", async (req, res) => {
    try {
      const { insertClientContactSchema } = await import("@shared/schema");
      const data = insertClientContactSchema.partial().parse(req.body);
      const updated = await storage.updateClientContact(req.params.id, data);
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Invalid contact data", details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.delete("/api/client-contacts/:id", async (req, res) => {
    const deleted = await storage.deleteClientContact(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Contact not found" });
    res.status(204).send();
  });

  // ── Client Sites ─────────────────────────────────────────────────────────────
  app.get("/api/clients/:clientId/sites", async (req, res) => {
    const list = await storage.getClientSites(req.params.clientId);
    res.json(list);
  });

  app.post("/api/clients/:clientId/sites", async (req, res) => {
    try {
      const { insertClientSiteSchema } = await import("@shared/schema");
      const data = insertClientSiteSchema.parse({ ...req.body, clientId: req.params.clientId });
      const created = await storage.createClientSite(data);
      res.status(201).json(created);
    } catch (error) {
      res.status(400).json({ error: "Invalid site data", details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.patch("/api/client-sites/:id", async (req, res) => {
    try {
      const { insertClientSiteSchema } = await import("@shared/schema");
      const data = insertClientSiteSchema.partial().parse(req.body);
      const updated = await storage.updateClientSite(req.params.id, data);
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Invalid site data", details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.delete("/api/client-sites/:id", async (req, res) => {
    const deleted = await storage.deleteClientSite(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Site not found" });
    res.status(204).send();
  });

  // ── Client Payments ──────────────────────────────────────────────────────────
  app.get("/api/clients/:clientId/payments", async (req, res) => {
    const list = await storage.getClientPayments(req.params.clientId);
    res.json(list);
  });

  app.post("/api/clients/:clientId/payments", async (req, res) => {
    try {
      const { insertClientPaymentSchema } = await import("@shared/schema");
      const data = insertClientPaymentSchema.parse({ ...req.body, clientId: req.params.clientId });
      const created = await storage.createClientPayment(data);
      res.status(201).json(created);
    } catch (error) {
      res.status(400).json({ error: "Invalid payment data", details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.patch("/api/client-payments/:id", async (req, res) => {
    try {
      const { insertClientPaymentSchema } = await import("@shared/schema");
      const data = insertClientPaymentSchema.partial().parse(req.body);
      const updated = await storage.updateClientPayment(req.params.id, data);
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Invalid payment data", details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.delete("/api/client-payments/:id", async (req, res) => {
    const deleted = await storage.deleteClientPayment(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Payment not found" });
    res.status(204).send();
  });

  // ── Nested PATCH/DELETE for contacts under /api/clients/:clientId/contacts/:id ──
  app.patch("/api/clients/:clientId/contacts/:id", async (req, res) => {
    try {
      const { insertClientContactSchema } = await import("@shared/schema");
      const data = insertClientContactSchema.partial().parse(req.body);
      const updated = await storage.updateClientContact(req.params.id, data);
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Invalid contact data", details: error instanceof Error ? error.message : String(error) });
    }
  });
  app.delete("/api/clients/:clientId/contacts/:id", async (req, res) => {
    const deleted = await storage.deleteClientContact(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Contact not found" });
    res.status(204).send();
  });

  // ── Nested PATCH/DELETE for sites under /api/clients/:clientId/sites/:id ──────
  app.patch("/api/clients/:clientId/sites/:id", async (req, res) => {
    try {
      const { insertClientSiteSchema } = await import("@shared/schema");
      const data = insertClientSiteSchema.partial().parse(req.body);
      const updated = await storage.updateClientSite(req.params.id, data);
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Invalid site data", details: error instanceof Error ? error.message : String(error) });
    }
  });
  app.delete("/api/clients/:clientId/sites/:id", async (req, res) => {
    const deleted = await storage.deleteClientSite(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Site not found" });
    res.status(204).send();
  });

  // ── Global /api/payments endpoint ─────────────────────────────────────────────
  app.get("/api/payments", async (req, res) => {
    const { clientId } = req.query;
    if (clientId) {
      const list = await storage.getClientPayments(clientId as string);
      return res.json(list);
    }
    // Return all payments (admin view) — reuse per-client method isn't available globally
    // so we call the storage method with a special flag; for now fall back to empty
    res.json([]);
  });
  app.post("/api/payments", async (req, res) => {
    try {
      const { insertClientPaymentSchema } = await import("@shared/schema");
      const data = insertClientPaymentSchema.parse(req.body);
      const created = await storage.createClientPayment(data);
      res.status(201).json(created);
    } catch (error) {
      res.status(400).json({ error: "Invalid payment data", details: error instanceof Error ? error.message : String(error) });
    }
  });
  app.delete("/api/payments/:id", async (req, res) => {
    const deleted = await storage.deleteClientPayment(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Payment not found" });
    res.status(204).send();
  });

  // ── Client activity log endpoint ───────────────────────────────────────────────
  app.get("/api/clients/:clientId/activity", async (req, res) => {
    try {
      const logs = await storage.getActivityLogsByClient(req.params.clientId);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch activity logs" });
    }
  });

  // ── Client Financial Summary (both URLs: /summary and /financial-summary) ─────
  app.get("/api/clients/:clientId/summary", async (req, res) => {
    req.params.clientId = req.params.clientId;
    // forward to same handler as financial-summary
    const clientId = req.params.clientId;
    try {
      const [invoices, payments] = await Promise.all([
        storage.getInvoicesByClient(clientId),
        storage.getClientPayments(clientId),
      ]);
      const totalBilled = invoices.reduce((s, i) => s + Number(i.total ?? 0), 0);
      const totalPaid   = payments.reduce((s, p) => s + Number(p.amount ?? 0), 0);
      const invoiceAllocated = new Map<string, number>();
      for (const p of payments) {
        if (p.invoiceId) invoiceAllocated.set(p.invoiceId, (invoiceAllocated.get(p.invoiceId) ?? 0) + Number(p.amount ?? 0));
      }
      const unpaidInvoices = invoices.filter(i => i.status !== "paid" && i.status !== "cancelled");
      const outstanding = unpaidInvoices.reduce((s, i) => {
        const allocated = invoiceAllocated.get(i.id) ?? 0;
        return s + Math.max(0, Number(i.total ?? 0) - allocated);
      }, 0);
      const now = Date.now();
      const overdue = unpaidInvoices.filter(i => i.status === "overdue" || new Date(i.dueDate) < new Date())
        .reduce((s, i) => s + Math.max(0, Number(i.total ?? 0) - (invoiceAllocated.get(i.id) ?? 0)), 0);
      const aging = { current: 0, days30: 0, days60: 0, days90plus: 0 };
      for (const inv of unpaidInvoices) {
        const daysOld = Math.floor((now - new Date(inv.dueDate).getTime()) / 86400000);
        const net = Math.max(0, Number(inv.total ?? 0) - (invoiceAllocated.get(inv.id) ?? 0));
        if (daysOld <= 0) aging.current += net;
        else if (daysOld <= 30) aging.days30 += net;
        else if (daysOld <= 60) aging.days60 += net;
        else aging.days90plus += net;
      }
      // Per-invoice paid amounts for UI balance columns
      const invoiceBalances: Record<string, number> = {};
      for (const inv of invoices) {
        invoiceBalances[inv.id] = invoiceAllocated.get(inv.id) ?? 0;
      }
      res.json({ totalBilled, totalPaid, outstanding, overdue, aging, invoiceCount: invoices.length, paymentCount: payments.length, invoiceBalances });
    } catch (error) {
      res.status(500).json({ error: "Failed to compute financial summary" });
    }
  });

  app.get("/api/clients/:clientId/financial-summary", async (req, res) => {
    try {
      const clientId = req.params.clientId;
      const [invoices, payments] = await Promise.all([
        storage.getInvoicesByClient(clientId),
        storage.getClientPayments(clientId),
      ]);
      const totalBilled = invoices.reduce((s, i) => s + Number(i.total ?? 0), 0);
      const totalPaid   = payments.reduce((s, p) => s + Number(p.amount ?? 0), 0);

      // Build per-invoice allocated payment map to handle partial payments
      const invoiceAllocated = new Map<string, number>();
      for (const p of payments) {
        if (p.invoiceId) {
          invoiceAllocated.set(p.invoiceId, (invoiceAllocated.get(p.invoiceId) ?? 0) + Number(p.amount ?? 0));
        }
      }

      const unpaidInvoices = invoices.filter(i => i.status !== "paid" && i.status !== "cancelled");

      // Outstanding = sum of (invoice net of allocated payments), floored at 0 per invoice
      const outstanding = unpaidInvoices.reduce((s, i) => {
        const allocated = invoiceAllocated.get(i.id) ?? 0;
        return s + Math.max(0, Number(i.total ?? 0) - allocated);
      }, 0);

      const now = Date.now();
      const overdue = unpaidInvoices
        .filter(i => i.status === "overdue" || new Date(i.dueDate) < new Date())
        .reduce((s, i) => {
          const allocated = invoiceAllocated.get(i.id) ?? 0;
          return s + Math.max(0, Number(i.total ?? 0) - allocated);
        }, 0);

      // Aging buckets based on due date, using net-of-payments amounts
      const aging = { current: 0, days30: 0, days60: 0, days90plus: 0 };
      for (const inv of unpaidInvoices) {
        const daysOld = Math.floor((now - new Date(inv.dueDate).getTime()) / 86400000);
        const allocated = invoiceAllocated.get(inv.id) ?? 0;
        const net = Math.max(0, Number(inv.total ?? 0) - allocated);
        if (daysOld <= 0)       aging.current    += net;
        else if (daysOld <= 30) aging.days30     += net;
        else if (daysOld <= 60) aging.days60     += net;
        else                    aging.days90plus += net;
      }
      res.json({ totalBilled, totalPaid, outstanding, overdue, aging, invoiceCount: invoices.length, paymentCount: payments.length });
    } catch (error) {
      res.status(500).json({ error: "Failed to compute financial summary" });
    }
  });

  // Inventory Items
  app.get("/api/inventory", async (req, res) => {
    const { type, departmentId } = req.query;
    let items;
    
    if (type) {
      items = await storage.getInventoryItemsByType(type as string);
    } else if (departmentId) {
      items = await storage.getInventoryItemsByDepartment(departmentId as string);
    } else {
      items = await storage.getInventoryItems();
    }
    
    res.json(items);
  });

  app.get("/api/inventory/:id", async (req, res) => {
    const item = await storage.getInventoryItem(req.params.id);
    if (!item) {
      return res.status(404).json({ error: "Inventory item not found" });
    }
    res.json(item);
  });

  app.post("/api/inventory", async (req, res) => {
    try {
      const body = { ...req.body };
      // Sanitise departmentId — "__none__" means "no department"
      if (body.departmentId === "__none__" || body.departmentId === "") body.departmentId = null;
      // Auto-generate SKU when caller leaves it blank
      if (!body.sku || body.sku.trim() === "") {
        const prefix = (body.name ?? "ITEM").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "ITEM";
        body.sku = `${prefix}-${Date.now().toString(36).toUpperCase()}`;
      }
      const item = insertInventoryItemSchema.parse(body);
      const created = await storage.createInventoryItem(item);
      res.status(201).json(created);
    } catch (error: any) {
      console.error("[POST /api/inventory] error:", error?.message ?? error);
      const msg = error?.errors
        ? error.errors.map((e: any) => `${e.path.join(".")}: ${e.message}`).join("; ")
        : error?.message ?? "Unknown error";
      res.status(400).json({ error: msg });
    }
  });

  app.put("/api/inventory/:id", async (req, res) => {
    try {
      const body = { ...req.body };
      if (body.departmentId === "__none__" || body.departmentId === "") body.departmentId = null;
      const updateData = insertInventoryItemSchema.partial().parse(body);
      const updated = await storage.updateInventoryItem(req.params.id, updateData);
      res.json(updated);
    } catch (error: any) {
      console.error("[PUT /api/inventory] error:", error?.message ?? error);
      res.status(400).json({ error: error?.message ?? "Invalid inventory item data" });
    }
  });

  app.delete("/api/inventory", async (req, res) => {
    const count = await storage.deleteAllInventoryItems();
    res.json({ deleted: count });
  });

  app.delete("/api/inventory/:id", async (req, res) => {
    const deleted = await storage.deleteInventoryItem(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Inventory item not found" });
    }
    res.status(204).send();
  });

  // Stock alerts and management
  app.get("/api/inventory/alerts/stock", async (req, res) => {
    const alerts = await storage.getStockAlerts();
    res.json(alerts);
  });

  app.get("/api/inventory/alerts/low-stock", async (req, res) => {
    const lowStockItems = await storage.getLowStockItems();
    res.json(lowStockItems);
  });

  app.get("/api/inventory/alerts/reorder", async (req, res) => {
    const reorderItems = await storage.getReorderRequiredItems();
    res.json(reorderItems);
  });

  app.put("/api/inventory/:id/quantity", async (req, res) => {
    try {
      const { quantity, note } = req.body;
      if (typeof quantity !== 'number' || quantity < 0) {
        return res.status(400).json({ error: "Invalid quantity" });
      }
      const updated = await storage.updateInventoryQuantity(req.params.id, quantity, note);
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Failed to update inventory quantity" });
    }
  });

  // Excel Import for Inventory
  const upload = multer({ storage: multer.memoryStorage() });
  
  app.post("/api/inventory/import", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Parse Excel file
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

      const results = {
        total: data.length,
        successful: 0,
        failed: 0,
        errors: [] as any[]
      };

      // Process each row
      for (let i = 0; i < data.length; i++) {
        const row: any = data[i];
        
        try {
          // Normalize column names to lowercase for flexible matching
          const normalizedRow: any = {};
          Object.keys(row).forEach(key => {
            normalizedRow[key.toLowerCase().replace(/\s+/g, '_')] = row[key];
          });

          // Map Excel columns to inventory item schema with flexible column matching
          const itemData = {
            name: normalizedRow.name || row.name || row.Name || '',
            type: normalizedRow.type || row.type || row.Type || 'product',
            sku: normalizedRow.sku || row.sku || row.SKU || '',
            quantity: Number(normalizedRow.quantity || row.quantity || row.Quantity || 0),
            minStockLevel: Number(normalizedRow.min_stock_level || normalizedRow.minstocklevel || row.minStockLevel || row['Min Stock Level'] || 10),
            maxStockLevel: Number(normalizedRow.max_stock_level || normalizedRow.maxstocklevel || row.maxStockLevel || row['Max Stock Level'] || 100),
            reorderPoint: Number(normalizedRow.reorder_point || normalizedRow.reorderpoint || row.reorderPoint || row['Reorder Point'] || 20),
            unitPrice: parseFloat(normalizedRow.unit_price || normalizedRow.unitprice || row.unitPrice || row['Unit Price'] || '0') || 0,
            description: normalizedRow.description || row.description || row.Description || '',
            departmentId: normalizedRow.department_id || normalizedRow.departmentid || row.departmentId || row['Department ID'] || null,
            location: normalizedRow.location || row.location || row.Location || '',
            supplier: normalizedRow.supplier || row.supplier || row.Supplier || ''
          };

          // Validate and create item
          const validatedItem = insertInventoryItemSchema.parse(itemData);
          await storage.createInventoryItem(validatedItem);
          results.successful++;
        } catch (error) {
          results.failed++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          results.errors.push({
            row: i + 2, // +2 because Excel is 1-indexed and has header row
            name: row.name || row.Name || 'Unknown',
            sku: row.sku || row.SKU || 'N/A',
            error: errorMessage
          });
        }
      }

      res.json({
        success: true,
        message: `Imported ${results.successful} of ${results.total} items`,
        results
      });
    } catch (error) {
      console.error("Excel import error:", error);
      res.status(500).json({ 
        error: "Failed to import Excel file",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Rental Contracts
  app.get("/api/contracts", async (req, res) => {
    const { active, expiring } = req.query;
    let contracts;
    
    if (active === "true") {
      contracts = await storage.getActiveRentalContracts();
    } else if (expiring) {
      const days = parseInt(expiring as string) || 30;
      contracts = await storage.getExpiringContracts(days);
    } else {
      contracts = await storage.getRentalContracts();
    }
    
    res.json(contracts);
  });

  app.get("/api/contracts/deletion-history", async (_req, res) => {
    const history = await storage.getContractDeletionHistory();
    res.json(history);
  });

  app.get("/api/contracts/:id", async (req, res) => {
    const contract = await storage.getRentalContract(req.params.id);
    if (!contract) {
      return res.status(404).json({ error: "Rental contract not found" });
    }
    res.json(contract);
  });

  app.post("/api/contracts", async (req, res) => {
    try {
      // Block suspended clients
      if (req.body.clientId) {
        const client = await storage.getClient(req.body.clientId);
        if (client && client.status === "suspended") {
          return res.status(403).json({ error: "Cannot create a contract for a suspended client. Contact Accounts to reinstate the client first." });
        }
      }

      const data = {
        ...req.body,
        startDate:            req.body.startDate            ? new Date(req.body.startDate)            : undefined,
        endDate:              req.body.endDate              ? new Date(req.body.endDate)              : undefined,
        lastPriceIncrease:    req.body.lastPriceIncrease    ? new Date(req.body.lastPriceIncrease)    : undefined,
        lastPriceIncreaseDate:req.body.lastPriceIncreaseDate? new Date(req.body.lastPriceIncreaseDate): undefined,
        nextIncreaseDate:     req.body.nextIncreaseDate     ? new Date(req.body.nextIncreaseDate)     : undefined,
        // inventoryItemId is now optional
        inventoryItemId: req.body.inventoryItemId || null,
      };
      const contract = insertRentalContractSchema.parse(data);
      const created = await storage.createRentalContract(contract);

      // Save line items if provided
      const items: any[] = req.body.items ?? [];
      for (const item of items) {
        if (!item.itemName) continue;
        await storage.createRentalContractItem({
          rentalContractId: created.id,
          clientId: created.clientId,
          itemName: item.itemName,
          refillRule: item.refillRule ?? "Not Applicable",
          quantity: Number(item.quantity) || 1,
          unitPrice: item.unitPrice ?? null,
          totalPrice: item.totalPrice ?? null,
          notes: item.notes ?? null,
        });
      }

      res.status(201).json(created);
    } catch (error: any) {
      console.error("Contract creation error:", error);
      res.status(400).json({ error: "Invalid rental contract data", details: error?.message });
    }
  });

  app.put("/api/contracts/:id", async (req, res) => {
    try {
      const data = {
        ...req.body,
        startDate:            req.body.startDate            ? new Date(req.body.startDate)            : undefined,
        endDate:              req.body.endDate              ? new Date(req.body.endDate)              : undefined,
        lastPriceIncrease:    req.body.lastPriceIncrease    ? new Date(req.body.lastPriceIncrease)    : undefined,
        lastPriceIncreaseDate:req.body.lastPriceIncreaseDate? new Date(req.body.lastPriceIncreaseDate): undefined,
        nextIncreaseDate:     req.body.nextIncreaseDate     ? new Date(req.body.nextIncreaseDate)     : undefined,
        inventoryItemId: req.body.inventoryItemId || null,
      };
      const updateData = insertRentalContractSchema.partial().parse(data);
      const updated = await storage.updateRentalContract(req.params.id, updateData);

      // Replace line items if provided
      if (Array.isArray(req.body.items)) {
        await storage.deleteRentalContractItemsByContract(req.params.id);
        for (const item of req.body.items) {
          if (!item.itemName) continue;
          await storage.createRentalContractItem({
            rentalContractId: req.params.id,
            clientId: updated.clientId,
            itemName: item.itemName,
            refillRule: item.refillRule ?? "Not Applicable",
            quantity: Number(item.quantity) || 1,
            unitPrice: item.unitPrice ?? null,
            totalPrice: item.totalPrice ?? null,
            notes: item.notes ?? null,
          });
        }
      }

      res.json(updated);
    } catch (error: any) {
      console.error("Contract update error:", error);
      res.status(400).json({ error: "Invalid rental contract data", details: error?.message });
    }
  });

  // Rental contract items
  app.get("/api/contracts/:id/items", requireAuth, async (req, res) => {
    try { res.json(await storage.getRentalContractItems(req.params.id)); }
    catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.post("/api/contracts/:id/items", requireAuth, async (req, res) => {
    try {
      const contract = await storage.getRentalContract(req.params.id);
      if (!contract) return res.status(404).json({ error: "Contract not found" });
      const item = await storage.createRentalContractItem({ ...req.body, rentalContractId: req.params.id, clientId: contract.clientId });
      res.status(201).json(item);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.delete("/api/contract-items/:itemId", requireAuth, async (req, res) => {
    try { res.json({ success: await storage.deleteRentalContractItem(req.params.itemId) }); }
    catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.delete("/api/contracts/:id", async (req, res) => {
    const contract = await storage.getRentalContract(req.params.id);
    if (!contract) {
      return res.status(404).json({ error: "Rental contract not found" });
    }
    const { reason, deletedBy, clientName, itemName } = req.body ?? {};
    const deleted = await storage.deleteRentalContract(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Rental contract not found" });
    }
    if (reason) {
      await storage.logContractDeletion({
        contractId: req.params.id,
        contractNumber: contract.contractNumber ?? null,
        clientName: clientName ?? "Unknown",
        itemName: itemName ?? "Unknown",
        monthlyPrice: contract.monthlyPrice ?? contract.calculatedTotal ?? null,
        startDate: contract.startDate ?? null,
        endDate: contract.endDate ?? null,
        reason,
        deletedBy: deletedBy ?? null,
        notes: contract.notes ?? null,
      });
    }
    res.status(204).send();
  });

  // Jobs
  app.get("/api/jobs", async (req, res) => {
    const { workerId, departmentId, status, date, today } = req.query;
    let jobs;
    
    if (today === "true") {
      jobs = await storage.getTodaysJobs();
    } else if (workerId) {
      jobs = await storage.getJobsByWorker(workerId as string);
    } else if (departmentId) {
      jobs = await storage.getJobsByDepartment(departmentId as string);
    } else if (status) {
      jobs = await storage.getJobsByStatus(status as string);
    } else if (date) {
      const targetDate = new Date(date as string);
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);
      jobs = await storage.getJobsByDateRange(targetDate, nextDay);
    } else {
      jobs = await storage.getJobs();
    }
    
    res.json(jobs);
  });

  app.get("/api/jobs/:id", async (req, res) => {
    const job = await storage.getJob(req.params.id);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    res.json(job);
  });

  app.post("/api/jobs", async (req, res) => {
    try {
      // Block suspended clients
      if (req.body.clientId) {
        const client = await storage.getClient(req.body.clientId);
        if (client && client.status === "suspended") {
          return res.status(403).json({ error: "Cannot create a job for a suspended client. Contact Accounts to reinstate the client first." });
        }
      }

      // Convert date strings to Date objects
      const jobData = {
        ...req.body,
        scheduledDate: req.body.scheduledDate ? new Date(req.body.scheduledDate) : undefined,
        startTime: req.body.startTime ? new Date(req.body.startTime) : undefined,
        endTime: req.body.endTime ? new Date(req.body.endTime) : undefined,
      };
      
      const job = insertJobSchema.parse(jobData);
      const created = await storage.createJob(job);
      res.status(201).json(created);
    } catch (error) {
      console.error("Job creation error:", error);
      res.status(400).json({ error: "Invalid job data", details: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.put("/api/jobs/:id", async (req, res) => {
    try {
      // Convert date strings to Date objects
      const jobData = {
        ...req.body,
        scheduledDate: req.body.scheduledDate ? new Date(req.body.scheduledDate) : undefined,
        startTime: req.body.startTime ? new Date(req.body.startTime) : undefined,
        endTime: req.body.endTime ? new Date(req.body.endTime) : undefined,
      };
      
      const updateData = insertJobSchema.partial().parse(jobData);
      const updated = await storage.updateJob(req.params.id, updateData);
      res.json(updated);
    } catch (error) {
      console.error("Job update error:", error);
      res.status(400).json({ error: "Invalid job data", details: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // PATCH route for calendar drag and drop
  app.patch("/api/jobs/:id", async (req, res) => {
    try {
      // Convert date strings to Date objects
      const jobData = {
        ...req.body,
        scheduledDate: req.body.scheduledDate ? new Date(req.body.scheduledDate) : undefined,
        startTime: req.body.startTime ? new Date(req.body.startTime) : undefined,
        endTime: req.body.endTime ? new Date(req.body.endTime) : undefined,
      };
      
      const updateData = insertJobSchema.partial().parse(jobData);
      const updated = await storage.updateJob(req.params.id, updateData);
      res.json(updated);
    } catch (error) {
      console.error("Job patch error:", error);
      res.status(400).json({ error: "Invalid job data", details: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.get("/api/jobs/:id/card", async (req, res) => {
    try {
      const jobCardData = await storage.getJobCardData(req.params.id);
      if (!jobCardData) {
        return res.status(404).json({ error: "Job not found" });
      }
      res.json(jobCardData);
    } catch (error) {
      console.error("Job card data error:", error);
      res.status(500).json({ error: "Failed to fetch job card data" });
    }
  });

  app.get("/api/jobs/daily/:departmentId/:date", async (req, res) => {
    try {
      const { departmentId, date } = req.params;
      
      // Parse the date and get start/end of day
      const targetDate = new Date(date + 'T00:00:00');
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);
      
      // Get all jobs for the division on this date
      const jobs = await storage.getJobsByDepartmentAndDateRange(departmentId, targetDate, nextDay);
      
      res.json(jobs);
    } catch (error) {
      console.error("Error fetching daily division jobs:", error);
      res.status(500).json({ message: "Failed to fetch daily division jobs" });
    }
  });

  app.delete("/api/jobs/:id", async (req, res) => {
    const deleted = await storage.deleteJob(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Job not found" });
    }
    res.status(204).send();
  });

  // Invoices
  app.get("/api/invoices", async (req, res) => {
    const { clientId, status, overdue } = req.query;
    let invoices;
    
    if (overdue === "true") {
      invoices = await storage.getOverdueInvoices();
    } else if (clientId) {
      invoices = await storage.getInvoicesByClient(clientId as string);
    } else if (status) {
      invoices = await storage.getInvoicesByStatus(status as string);
    } else {
      invoices = await storage.getInvoices();
    }
    
    res.json(invoices);
  });

  app.get("/api/invoices/:id", async (req, res) => {
    const invoice = await storage.getInvoice(req.params.id);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    res.json(invoice);
  });

  app.get("/api/invoices/:id/items", async (req, res) => {
    const items = await storage.getInvoiceItems(req.params.id);
    res.json(items);
  });

  // Create an invoice directly from a completed job — copies client/price/notes forward
  // and links the new invoice back to the job (and its quote, if any).
  app.post("/api/jobs/:id/create-invoice", async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) return res.status(404).json({ error: "Job not found" });

      // Prefer the entity snapshotted on the job (set at quote→job conversion),
      // fall back to re-reading the linked quote for legacy jobs converted before
      // this snapshot was introduced.
      let legalEntityId: string | null = (job as any).legalEntityId ?? null;
      let legalEntityName: string | null = (job as any).legalEntityName ?? null;
      if (!legalEntityId) {
        const linkedQuoteId = (job as any).linkedQuoteId;
        if (linkedQuoteId) {
          try {
            const linkedQuote = await storage.getQuoteSubmission(linkedQuoteId);
            legalEntityId = (linkedQuote as any)?.legalEntityId ?? null;
            legalEntityName = (linkedQuote as any)?.legalEntityName ?? null;
          } catch { /* non-fatal — invoice can still be created without entity info */ }
        }
      }

      const priceNum = Number((job as any).price ?? 0);
      const subtotal = Number.isFinite(priceNum) ? priceNum : 0;
      const taxRate = 0.15; // 15% VAT
      const taxAmount = +(subtotal * taxRate).toFixed(2);
      const total = +(subtotal + taxAmount).toFixed(2);

      const now = new Date();
      const due = new Date(now); due.setDate(due.getDate() + 30);

      const created = await storage.createInvoice({
        clientId: job.clientId,
        status: "draft",
        issueDate: now,
        dueDate: due,
        subtotal: subtotal.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        total: total.toFixed(2),
        paidAmount: "0",
        notes: [job.title, job.description].filter(Boolean).join(" — ") || null,
        terms: "Payment due within 30 days.",
        linkedJobId: job.id,
        linkedQuoteId: (job as any).linkedQuoteId ?? null,
        linkedContractId: (job as any).linkedContractId ?? null,
        legalEntityId,
        legalEntityName,
      } as any);

      // Seed a single line item from the job
      try {
        await storage.createInvoiceItem({
          invoiceId: created.id,
          description: `${job.title}${job.serviceType ? ` — ${job.serviceType}` : ""}`,
          quantity: "1",
          unitPrice: subtotal.toFixed(2),
          total: subtotal.toFixed(2),
          jobId: job.id,
        } as any);
      } catch (e) { /* item failure shouldn't block invoice */ }

      await storage.updateJob(job.id, { invoiceStatus: "invoiced" } as any);

      res.status(201).json(created);
    } catch (error) {
      console.error("Create-invoice-from-job error:", error);
      res.status(400).json({ error: "Could not create invoice from job", details: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // Mark a job as ready to invoice (Finance queue)
  app.post("/api/jobs/:id/mark-ready-to-invoice", async (req, res) => {
    try {
      const updated = await storage.updateJob(req.params.id, { invoiceStatus: "ready_to_invoice" } as any);
      if (!updated) return res.status(404).json({ error: "Job not found" });
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Could not update job" });
    }
  });

  app.post("/api/invoices", async (req, res) => {
    try {
      // Convert date strings to Date objects
      const invoiceData = {
        ...req.body,
        issueDate: req.body.issueDate ? new Date(req.body.issueDate) : undefined,
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
        paymentDate: req.body.paymentDate ? new Date(req.body.paymentDate) : undefined,
      };
      
      const invoice = insertInvoiceSchema.parse(invoiceData);
      const created = await storage.createInvoice(invoice);
      res.status(201).json(created);
    } catch (error) {
      console.error("Invoice creation error:", error);
      res.status(400).json({ error: "Invalid invoice data", details: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.put("/api/invoices/:id", async (req, res) => {
    try {
      // Coerce date strings to Date objects before zod validation (timestamp columns reject strings)
      const body = { ...req.body };
      for (const f of ["issueDate", "dueDate", "paymentDate", "sentDate"]) {
        if (typeof body[f] === "string" && body[f]) body[f] = new Date(body[f]);
      }
      const updateData = insertInvoiceSchema.partial().parse(body);
      const updated = await storage.updateInvoice(req.params.id, updateData);
      res.json(updated);
    } catch (error) {
      console.error("Invoice update error:", error);
      res.status(400).json({ error: "Invalid invoice data", details: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.delete("/api/invoices/:id", async (req, res) => {
    const deleted = await storage.deleteInvoice(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    res.status(204).send();
  });

  app.post("/api/invoices/:id/items", async (req, res) => {
    try {
      const item = insertInvoiceItemSchema.parse({
        ...req.body,
        invoiceId: req.params.id
      });
      const created = await storage.createInvoiceItem(item);
      res.status(201).json(created);
    } catch (error) {
      res.status(400).json({ error: "Invalid invoice item data" });
    }
  });

  app.put("/api/invoice-items/:id", async (req, res) => {
    try {
      const updateData = insertInvoiceItemSchema.partial().parse(req.body);
      const updated = await storage.updateInvoiceItem(req.params.id, updateData);
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Invalid invoice item data" });
    }
  });

  app.delete("/api/invoice-items/:id", async (req, res) => {
    const deleted = await storage.deleteInvoiceItem(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Invoice item not found" });
    }
    res.status(204).send();
  });

  // Invoice CSV Export for Sage Import
  app.get("/api/invoices/export/csv", async (req, res) => {
    try {
      const { status, fromDate, toDate } = req.query;
      let invoices;
      
      if (status) {
        invoices = await storage.getInvoicesByStatus(status as string);
      } else {
        invoices = await storage.getInvoices();
      }
      
      // Filter by date range if provided
      if (fromDate || toDate) {
        invoices = invoices.filter(invoice => {
          const invoiceDate = new Date(invoice.issueDate);
          if (fromDate && invoiceDate < new Date(fromDate as string)) return false;
          if (toDate && invoiceDate > new Date(toDate as string)) return false;
          return true;
        });
      }
      
      // Get client details for each invoice
      const csvRows = [];
      csvRows.push([
        'Invoice Number',
        'Client Name', 
        'Client Email',
        'Issue Date',
        'Due Date',
        'Subtotal',
        'Tax Amount',
        'Total Amount',
        'Status',
        'Notes',
        'Payment Terms'
      ]);
      
      for (const invoice of invoices) {
        const client = await storage.getClient(invoice.clientId);
        csvRows.push([
          invoice.invoiceNumber,
          client?.name || '',
          client?.email || '',
          invoice.issueDate.toISOString().split('T')[0],
          invoice.dueDate.toISOString().split('T')[0],
          invoice.subtotal,
          invoice.taxAmount,
          invoice.total,
          invoice.status || 'pending',
          invoice.notes || '',
          invoice.terms || ''
        ]);
      }
      
      // Convert to CSV format
      const csvContent = csvRows.map(row => 
        row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
      ).join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="invoices_export.csv"');
      res.send(csvContent);
    } catch (error) {
      console.error('CSV export error:', error);
      res.status(500).json({ error: 'Failed to export invoices' });
    }
  });

  // Notifications
  app.get("/api/notifications", async (req, res) => {
    const { unread } = req.query;
    let notifications;
    
    if (unread === "true") {
      notifications = await storage.getUnreadNotifications();
    } else {
      notifications = await storage.getNotifications();
    }
    
    res.json(notifications);
  });

  app.post("/api/notifications", async (req, res) => {
    try {
      const notification = insertNotificationSchema.parse(req.body);
      const created = await storage.createNotification(notification);
      res.status(201).json(created);
    } catch (error) {
      res.status(400).json({ error: "Invalid notification data" });
    }
  });

  app.put("/api/notifications/:id/read", async (req, res) => {
    const marked = await storage.markNotificationAsRead(req.params.id);
    if (!marked) {
      return res.status(404).json({ error: "Notification not found" });
    }
    res.status(204).send();
  });

  app.delete("/api/notifications/:id", async (req, res) => {
    const deleted = await storage.deleteNotification(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Notification not found" });
    }
    res.status(204).send();
  });

  // Calendar Events Routes
  app.get("/api/calendar/events/:month?", async (req, res) => {
    try {
      // Return existing calendar events from storage
      const calendarEvents = await storage.getCalendarEvents();
      res.json(calendarEvents);
    } catch (error) {
      console.error("Error fetching calendar events:", error);
      res.status(500).json({ message: "Failed to fetch calendar events" });
    }
  });

  app.post("/api/calendar/events", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const eventData = req.body;
      const event = await storage.createCalendarEvent(eventData);
      
      await AuthService.logActivity({
        userId: req.user!.id,
        action: "create_calendar_event",
        details: `Created calendar event: ${eventData.title}`,
      });

      res.json(event);
    } catch (error) {
      console.error("Error creating calendar event:", error);
      res.status(500).json({ message: "Failed to create calendar event" });
    }
  });

  app.patch("/api/calendar/events/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const event = await storage.updateCalendarEvent(id, updateData);
      
      await AuthService.logActivity({
        userId: req.user!.id,
        action: "update_calendar_event",
        details: `Updated calendar event: ${id}`,
      });

      res.json(event);
    } catch (error) {
      console.error("Error updating calendar event:", error);
      res.status(500).json({ message: "Failed to update calendar event" });
    }
  });

  // Dashboard Analytics
  app.get("/api/dashboard/metrics", async (req, res) => {
    try {
      const [activeJobs, allWorkers, expiringContracts, allJobs, departments] = await Promise.all([
        storage.getJobsByStatus('in_progress'),
        storage.getWorkers(),
        storage.getExpiringContracts(30),
        storage.getJobs(),
        storage.getDepartments()
      ]);

      const activeWorkers = allWorkers.filter(w => w.isActive);
      const completedJobsThisMonth = allJobs.filter(job => {
        const jobDate = new Date(job.createdAt);
        const now = new Date();
        return job.status === 'completed' && 
               jobDate.getMonth() === now.getMonth() &&
               jobDate.getFullYear() === now.getFullYear();
      });

      // Calculate department performance
      const departmentStats = await Promise.all(departments.map(async (department) => {
        const [todayJobs, workers] = await Promise.all([
          storage.getJobsByDepartment(department.id),
          storage.getWorkersByDepartment(department.id)
        ]);

        const todayJobsFiltered = todayJobs.filter(job => {
          const jobDate = new Date(job.scheduledDate);
          const today = new Date();
          return jobDate.toDateString() === today.toDateString();
        });

        return {
          department: department,
          activeWorkers: workers.filter(w => w.isActive).length,
          jobsToday: todayJobsFiltered.length,
          completed: todayJobsFiltered.filter(j => j.status === 'completed').length,
          inProgress: todayJobsFiltered.filter(j => j.status === 'in_progress').length,
          pending: todayJobsFiltered.filter(j => j.status === 'pending').length
        };
      }));

      const metrics = {
        activeJobs: activeJobs.length,
        activeWorkers: activeWorkers.length,
        expiringContracts: expiringContracts.length,
        monthlyRevenue: 45680, // This would be calculated from contracts
        completedJobsThisMonth: completedJobsThisMonth.length,
        departments: departmentStats
      };

      res.json(metrics);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dashboard metrics" });
    }
  });

  // Enhanced dashboard analytics
  app.get("/api/dashboard/analytics", async (req, res) => {
    try {
      const { period = 'today' } = req.query;
      const analytics = await storage.getDashboardAnalytics(period as 'today' | 'week' | 'month');
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching dashboard analytics:", error);
      res.status(500).json({ error: "Failed to fetch dashboard analytics" });
    }
  });

  app.get("/api/dashboard/revenue-chart", async (req, res) => {
    try {
      const { period = 'daily', days = '30' } = req.query;
      const revenueData = await storage.getRevenueByPeriod(
        period as 'daily' | 'weekly' | 'monthly', 
        parseInt(days as string)
      );
      res.json(revenueData);
    } catch (error) {
      console.error("Error fetching revenue chart data:", error);
      res.status(500).json({ error: "Failed to fetch revenue chart data" });
    }
  });

  // Email Templates
  app.get("/api/email-templates", async (req, res) => {
    const { type } = req.query;
    let templates;
    
    if (type) {
      templates = await storage.getEmailTemplatesByType(type as string);
    } else {
      templates = await storage.getEmailTemplates();
    }
    
    res.json(templates);
  });

  app.post("/api/email-templates", async (req, res) => {
    try {
      const template = insertEmailTemplateSchema.parse(req.body);
      const created = await storage.createEmailTemplate(template);
      res.status(201).json(created);
    } catch (error) {
      res.status(400).json({ error: "Invalid email template data" });
    }
  });

  app.put("/api/email-templates/:id", async (req, res) => {
    try {
      const template = insertEmailTemplateSchema.parse(req.body);
      const updated = await storage.updateEmailTemplate(req.params.id, template);
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Invalid email template data or template not found" });
    }
  });

  app.delete("/api/email-templates/:id", async (req, res) => {
    const deleted = await storage.deleteEmailTemplate(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Email template not found" });
    }
    res.status(204).send();
  });

  // Email Logs
  app.get("/api/email-logs", async (req, res) => {
    const { status } = req.query;
    let logs;
    
    if (status) {
      logs = await storage.getEmailLogsByStatus(status as string);
    } else {
      logs = await storage.getEmailLogs();
    }
    
    res.json(logs);
  });

  // Send Invoice Email
  app.post("/api/invoices/:id/send-email", async (req, res) => {
    try {
      const invoiceId = req.params.id;
      const { email, username, password } = req.body;

      // Get invoice and client data
      const invoice = await storage.getInvoice(invoiceId);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      const client = await storage.getClient(invoice.clientId);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

      const recipientEmail = email || client.email;
      if (!recipientEmail) {
        return res.status(400).json({ error: "No email address provided" });
      }

      // Use simple SendGrid email service
      const emailSent = await sendEmail({
        to: recipientEmail,
        from: "noreply@terminators.co.za",
        subject: `Invoice ${invoice.invoiceNumber} from The Terminators`,
        html: `
          <h2>Invoice ${invoice.invoiceNumber}</h2>
          <p>Dear ${client.name},</p>
          <p>Please find your invoice details below:</p>
          <p><strong>Total Amount:</strong> R ${parseFloat(invoice.total).toFixed(2)}</p>
          <p><strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString()}</p>
          <p>Thank you for your business!</p>
          <br>
          <p>Best regards,<br>The Terminators Team</p>
        `
      });



      // Log the email attempt
      await storage.createEmailLog({
        toEmail: recipientEmail,
        subject: `Invoice ${invoice.invoiceNumber} from The Terminators`,
        status: emailSent ? 'sent' : 'failed',
        errorMessage: emailSent ? undefined : 'Failed to send email',
        sentAt: emailSent ? new Date() : undefined,
        relatedEntityId: invoiceId,
        relatedEntityType: 'invoice'
      });

      if (emailSent) {
        res.json({ message: "Invoice email sent successfully", recipient: recipientEmail });
      } else {
        res.status(500).json({ error: "Failed to send invoice email" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to send invoice email" });
    }
  });

  // Send Custom Email to Customer
  app.post("/api/send-customer-email", async (req, res) => {
    try {
      const { clientId, subject, message, username, password } = req.body;

      // Get client data
      const client = await storage.getClient(clientId);
      if (!client || !client.email) {
        return res.status(400).json({ error: "Client not found or has no email address" });
      }

      // Use simple SendGrid email service instead of Outlook
      const emailSent = await sendEmail({
        to: client.email,
        from: "noreply@terminators.co.za",
        subject: subject,
        html: `
          <h2>${subject}</h2>
          <p>Dear ${client.name},</p>
          <p>${message}</p>
          <br>
          <p>Best regards,<br>The Terminators Team</p>
        `
      });

      // Log the email attempt
      await storage.createEmailLog({
        toEmail: client.email,
        subject: subject,
        status: emailSent ? 'sent' : 'failed',
        errorMessage: emailSent ? undefined : 'Failed to send email',
        sentAt: emailSent ? new Date() : undefined,
        relatedEntityId: clientId,
        relatedEntityType: 'client'
      });

      if (emailSent) {
        res.json({ message: "Email sent successfully", recipient: client.email });
      } else {
        res.status(500).json({ error: "Failed to send email" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to send email" });
    }
  });

  // Keep the old code but comment it out
  /*
      const OutlookEmailService = (await import("./email-service")).default;
      const emailService = new OutlookEmailService({
        clientId: process.env.MICROSOFT_CLIENT_ID || "your-client-id",
        authority: "https://login.microsoftonline.com/common",
        redirectUri: "http://localhost:5000"
      });

      // Authenticate and send email
      const authenticated = await emailService.authenticate(username, password);
      if (!authenticated) {
        return res.status(401).json({ error: "Email authentication failed" });
      }

      const emailTemplate = emailService.generateCustomerEmailTemplate(subject, message, client.name);
      const emailSent = await emailService.sendEmail({
        to: client.email,
        subject: emailTemplate.subject,
        htmlContent: emailTemplate.htmlContent,
        textContent: emailTemplate.textContent
      });

      // Log the email attempt
      await storage.createEmailLog({
        toEmail: client.email,
        subject: emailTemplate.subject,
        status: emailSent ? 'sent' : 'failed',
        errorMessage: emailSent ? undefined : 'Failed to send email',
        sentAt: emailSent ? new Date() : undefined,
        relatedEntityId: clientId,
        relatedEntityType: 'client'
      });

      if (emailSent) {
        res.json({ message: "Email sent successfully", recipient: client.email });
      } else {
        res.status(500).json({ error: "Failed to send email" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to send email" });
    }
  });
  */

  // Job Inventory Items
  app.get("/api/job-inventory", async (req, res) => {
    const { jobId } = req.query;
    if (jobId) {
      const items = await storage.getJobInventoryItemsByJob(jobId as string);
      res.json(items);
    } else {
      const items = await storage.getJobInventoryItems();
      res.json(items);
    }
  });

  app.post("/api/job-inventory", async (req, res) => {
    try {
      const item = insertJobInventoryItemSchema.parse(req.body);
      const created = await storage.createJobInventoryItem(item);
      res.status(201).json(created);
    } catch (error) {
      res.status(400).json({ error: "Invalid job inventory item data" });
    }
  });

  app.put("/api/job-inventory/:id", async (req, res) => {
    try {
      const updateData = insertJobInventoryItemSchema.partial().parse(req.body);
      const updated = await storage.updateJobInventoryItem(req.params.id, updateData);
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Invalid job inventory item data" });
    }
  });

  app.delete("/api/job-inventory/:id", async (req, res) => {
    const deleted = await storage.deleteJobInventoryItem(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Job inventory item not found" });
    }
    res.status(204).send();
  });

  // Staff Performance Analytics
  app.get("/api/reports/staff-performance/:workerId", async (req, res) => {
    const { workerId } = req.params;
    const { startDate, endDate } = req.query;

    try {
      // Get worker jobs within date range
      const jobs = await storage.getJobs();
      const jobInventoryItems = await storage.getJobInventoryItems();
      
      const filteredJobs = jobs.filter(job => {
        const jobDate = new Date(job.scheduledDate);
        const matchesWorker = job.workerId === workerId;
        let matchesDateRange = true;
        
        if (startDate && endDate) {
          const start = new Date(startDate as string);
          const end = new Date(endDate as string);
          matchesDateRange = jobDate >= start && jobDate <= end;
        }
        
        return matchesWorker && matchesDateRange;
      });

      // Calculate sales figures from job inventory items
      let totalSales = 0;
      const jobIds = filteredJobs.map(job => job.id);
      
      const relatedInventoryItems = jobInventoryItems.filter(item => 
        jobIds.includes(item.jobId)
      );

      for (const item of relatedInventoryItems) {
        const quantity = parseFloat(item.quantity);
        const unitPrice = parseFloat(item.unitPrice || "0");
        totalSales += quantity * unitPrice;
      }

      const performance = {
        workerId,
        dateRange: { startDate, endDate },
        totalJobs: filteredJobs.length,
        completedJobs: filteredJobs.filter(j => j.status === 'completed').length,
        pendingJobs: filteredJobs.filter(j => j.status === 'pending').length,
        inProgressJobs: filteredJobs.filter(j => j.status === 'in_progress').length,
        cancelledJobs: filteredJobs.filter(j => j.status === 'cancelled').length,
        totalSales: totalSales.toFixed(2),
        averageSalesPerJob: filteredJobs.length > 0 ? (totalSales / filteredJobs.length).toFixed(2) : "0.00",
        completionRate: filteredJobs.length > 0 ? 
          Math.round((filteredJobs.filter(j => j.status === 'completed').length / filteredJobs.length) * 100) : 0,
        jobs: filteredJobs,
        inventoryItems: relatedInventoryItems
      };

      res.json(performance);
    } catch (error) {
      console.error("Staff performance error:", error);
      res.status(500).json({ error: "Failed to fetch staff performance data" });
    }
  });

  // Suppliers
  app.get("/api/suppliers", async (req, res) => {
    const { category, activeOnly } = req.query;
    let suppliers;
    
    if (category) {
      suppliers = await storage.getSuppliersByCategory(category as string);
    } else if (activeOnly === 'true') {
      suppliers = await storage.getActiveSuppliers();
    } else {
      suppliers = await storage.getSuppliers();
    }
    
    res.json(suppliers);
  });

  app.get("/api/suppliers/:id", async (req, res) => {
    const supplier = await storage.getSupplier(req.params.id);
    if (!supplier) {
      return res.status(404).json({ error: "Supplier not found" });
    }
    res.json(supplier);
  });

  app.post("/api/suppliers", async (req, res) => {
    try {
      const supplier = insertSupplierSchema.parse(req.body);
      const created = await storage.createSupplier(supplier);
      res.status(201).json(created);
    } catch (error) {
      res.status(400).json({ error: "Invalid supplier data" });
    }
  });

  app.patch("/api/suppliers/:id", async (req, res) => {
    try {
      const supplier = insertSupplierSchema.partial().parse(req.body);
      const updated = await storage.updateSupplier(req.params.id, supplier);
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Invalid supplier data" });
    }
  });

  app.delete("/api/suppliers/:id", async (req, res) => {
    const deleted = await storage.deleteSupplier(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Supplier not found" });
    }
    res.status(204).send();
  });

  // Purchase Orders
  app.get("/api/purchase-orders", async (req, res) => {
    const { status } = req.query;
    let purchaseOrders;
    
    if (status) {
      purchaseOrders = await storage.getPurchaseOrdersByStatus(status as string);
    } else {
      purchaseOrders = await storage.getPurchaseOrders();
    }
    
    res.json(purchaseOrders);
  });

  app.get("/api/purchase-orders/pending", async (req, res) => {
    const pendingOrders = await storage.getPendingPurchaseOrders();
    res.json(pendingOrders);
  });

  app.get("/api/purchase-orders/:id", async (req, res) => {
    const purchaseOrder = await storage.getPurchaseOrder(req.params.id);
    if (!purchaseOrder) {
      return res.status(404).json({ error: "Purchase order not found" });
    }
    res.json(purchaseOrder);
  });

  app.get("/api/purchase-orders/:id/items", async (req, res) => {
    const items = await storage.getPurchaseOrderItems(req.params.id);
    res.json(items);
  });

  app.post("/api/purchase-orders", async (req, res) => {
    try {
      const purchaseOrder = insertPurchaseOrderSchema.parse(req.body);
      const created = await storage.createPurchaseOrder(purchaseOrder);
      
      // Send approval notification email to management
      const supplier = await storage.getSupplier(created.supplierId);
      if (supplier) {
        const approvalEmail = generateApprovalNotificationEmail(
          created,
          supplier,
          "management@terminators.co.za"
        );
        await sendEmail(approvalEmail);
      }
      
      res.status(201).json(created);
    } catch (error) {
      res.status(400).json({ error: "Invalid purchase order data" });
    }
  });

  app.post("/api/purchase-orders/:id/items", async (req, res) => {
    try {
      const item = insertPurchaseOrderItemSchema.parse({
        ...req.body,
        purchaseOrderId: req.params.id
      });
      const created = await storage.createPurchaseOrderItem(item);
      res.status(201).json(created);
    } catch (error) {
      res.status(400).json({ error: "Invalid purchase order item data" });
    }
  });

  app.patch("/api/purchase-orders/:id", async (req, res) => {
    try {
      const purchaseOrder = insertPurchaseOrderSchema.partial().parse(req.body);
      const updated = await storage.updatePurchaseOrder(req.params.id, purchaseOrder);
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Invalid purchase order data" });
    }
  });

  app.post("/api/purchase-orders/:id/approve", async (req, res) => {
    try {
      const { approvedById } = req.body;
      if (!approvedById) {
        return res.status(400).json({ error: "Approved by ID is required" });
      }
      const approved = await storage.approvePurchaseOrder(req.params.id, approvedById);
      res.json(approved);
    } catch (error) {
      res.status(400).json({ error: "Failed to approve purchase order" });
    }
  });

  app.post("/api/purchase-orders/:id/reject", async (req, res) => {
    try {
      const { rejectionReason } = req.body;
      if (!rejectionReason) {
        return res.status(400).json({ error: "Rejection reason is required" });
      }
      const rejected = await storage.rejectPurchaseOrder(req.params.id, rejectionReason);
      res.json(rejected);
    } catch (error) {
      res.status(400).json({ error: "Failed to reject purchase order" });
    }
  });

  app.delete("/api/purchase-orders/:id", async (req, res) => {
    const deleted = await storage.deletePurchaseOrder(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Purchase order not found" });
    }
    res.status(204).send();
  });

  app.post("/api/purchase-orders/:id/send", async (req, res) => {
    try {
      const po = await storage.getPurchaseOrder(req.params.id);
      if (!po) {
        return res.status(404).json({ error: "Purchase order not found" });
      }

      if (po.status !== "approved") {
        return res.status(400).json({ error: "Purchase order must be approved before sending" });
      }

      // Get related data
      const supplier = await storage.getSupplier(po.supplierId);
      const items = await storage.getPurchaseOrderItems(po.id);
      const inventoryItems = await storage.getInventoryItems();

      if (!supplier) {
        return res.status(400).json({ error: "Supplier not found" });
      }

      // Generate and send email
      const emailData = generatePurchaseOrderEmail(po, supplier, items, inventoryItems);
      const emailSent = await sendEmail(emailData);

      if (emailSent) {
        // Update PO status to sent
        const updated = await storage.updatePurchaseOrder(po.id, {
          status: "sent",
          sentDate: new Date(),
        });
        res.json(updated);
      } else {
        res.status(500).json({ error: "Failed to send email to supplier" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to send purchase order" });
    }
  });

  app.delete("/api/purchase-orders/:id/items/:itemId", async (req, res) => {
    const deleted = await storage.deletePurchaseOrderItem(req.params.itemId);
    if (!deleted) {
      return res.status(404).json({ error: "Purchase order item not found" });
    }
    res.status(204).send();
  });

  // Sage Accounting Integration
  app.post("/api/sage/test-connection", async (req, res) => {
    try {
      const sageService = createSageService();
      const result = await sageService.testConnection();
      res.json(result);
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to test Sage connection' 
      });
    }
  });

  app.post("/api/sage/send-invoice/:id", async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      const invoiceItems = await storage.getInvoiceItems(invoice.id);
      const client = await storage.getClient(invoice.clientId);
      
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

      const sageService = createSageService();
      const sageInvoice = await sageService.sendInvoice(invoice, invoiceItems, client);
      
      res.json({
        success: true,
        message: `Invoice ${invoice.invoiceNumber} sent to Sage successfully`,
        sageInvoiceId: sageInvoice.id,
        sageInvoiceNumber: sageInvoice.invoice_number
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to send invoice to Sage' 
      });
    }
  });

  app.post("/api/sage/send-invoices-bulk", async (req, res) => {
    try {
      const { invoiceIds } = req.body;
      
      if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) {
        return res.status(400).json({ error: "Invoice IDs array is required" });
      }

      const invoiceData = [];
      
      for (const invoiceId of invoiceIds) {
        const invoice = await storage.getInvoice(invoiceId);
        if (!invoice) continue;
        
        const invoiceItems = await storage.getInvoiceItems(invoice.id);
        const client = await storage.getClient(invoice.clientId);
        
        if (client) {
          invoiceData.push({ invoice, invoiceItems, client });
        }
      }

      const sageService = createSageService();
      const results = await sageService.sendMultipleInvoices(invoiceData);
      
      res.json({
        success: true,
        message: `Processed ${results.length} invoices`,
        results
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to send invoices to Sage' 
      });
    }
  });

  app.get("/api/sage/invoice-status/:sageInvoiceId", async (req, res) => {
    try {
      const sageService = createSageService();
      const status = await sageService.getInvoiceStatus(req.params.sageInvoiceId);
      res.json(status);
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to get invoice status from Sage' 
      });
    }
  });

  // Custom Reports Routes
  app.get("/api/custom-reports", async (req, res) => {
    try {
      const { type } = req.query;
      let reports;
      
      if (type) {
        reports = await storage.getCustomReportsByType(type as string);
      } else {
        reports = await storage.getCustomReports();
      }
      
      res.json(reports);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch custom reports" });
    }
  });

  app.get("/api/custom-reports/:id", async (req, res) => {
    try {
      const report = await storage.getCustomReport(req.params.id);
      if (!report) {
        return res.status(404).json({ error: "Custom report not found" });
      }
      res.json(report);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch custom report" });
    }
  });

  app.post("/api/custom-reports", async (req, res) => {
    try {
      const reportData = insertCustomReportSchema.parse(req.body);
      const report = await storage.createCustomReport(reportData);
      res.status(201).json(report);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid report data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create custom report" });
    }
  });

  app.put("/api/custom-reports/:id", async (req, res) => {
    try {
      const reportData = insertCustomReportSchema.partial().parse(req.body);
      const report = await storage.updateCustomReport(req.params.id, reportData);
      res.json(report);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid report data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update custom report" });
    }
  });

  app.delete("/api/custom-reports/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteCustomReport(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Custom report not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete custom report" });
    }
  });

  app.post("/api/custom-reports/:id/run", async (req, res) => {
    try {
      const reportData = await storage.runCustomReport(req.params.id);
      res.json(reportData);
    } catch (error) {
      if (error instanceof Error && error.message === "Custom report not found") {
        return res.status(404).json({ error: "Custom report not found" });
      }
      res.status(500).json({ error: "Failed to run custom report" });
    }
  });

  // Quote Submission Routes (public-facing)
  app.post("/api/quote-submissions", async (req, res) => {
    try {
      const submissionData = insertQuoteSubmissionSchema.parse({
        email: "",
        phone: "",
        contactPerson: "",
        ...req.body,
        origination: req.body?.origination ?? "other",
      });
      const submission = await storage.createQuoteSubmission(submissionData);
      res.status(201).json(submission);
    } catch (error: any) {
      console.error("[POST /api/quote-submissions] validation error:", error.message);
      // Parse Zod errors into a human-readable message
      let details = error.message;
      try {
        const zodErrors = JSON.parse(error.message);
        if (Array.isArray(zodErrors)) {
          details = zodErrors.map((e: any) => `${e.path?.join(".") || "field"}: ${e.message}`).join("; ");
        }
      } catch {}
      res.status(400).json({ error: "Failed to create lead", details });
    }
  });

  app.get("/api/quote-submissions", async (req, res) => {
    try {
      const { status } = req.query;
      let submissions;
      
      if (status) {
        submissions = await storage.getQuoteSubmissionsByStatus(status as string);
      } else {
        submissions = await storage.getQuoteSubmissions();
      }
      
      res.json(submissions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch quote submissions" });
    }
  });

  app.get("/api/quote-submissions/:id", async (req, res) => {
    try {
      const submission = await storage.getQuoteSubmission(req.params.id);
      if (!submission) {
        return res.status(404).json({ error: "Quote submission not found" });
      }
      res.json(submission);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch quote submission" });
    }
  });

  // Public endpoint for quote submission (no auth required)
  app.post("/api/public/quote-request", async (req, res) => {
    try {
      const submissionData = insertQuoteSubmissionSchema.parse({ ...req.body, origination: req.body?.origination ?? "website" });
      const submission = await storage.createQuoteSubmission(submissionData);
      
      // Send email notification to admin/sales team
      const serviceTypes: Record<string, string> = {
        pest_control: "Pest Control",
        sanitary_bins: "Sanitary Bins",
        washroom: "Washroom Services",
        deep_cleaning: "Deep Cleaning"
      };
      
      const emailData = {
        to: "quotes@theterminators.co.za", // Update with your actual email
        from: "noreply@theterminators.co.za",
        subject: `New Quote Request - ${serviceTypes[submission.serviceType]}`,
        html: `
          <h2>New Quote Request Received</h2>
          <p><strong>Company:</strong> ${submission.companyName}</p>
          <p><strong>Contact Person:</strong> ${submission.contactPerson}</p>
          <p><strong>Email:</strong> ${submission.email}</p>
          <p><strong>Phone:</strong> ${submission.phone}</p>
          <p><strong>Service Type:</strong> ${serviceTypes[submission.serviceType]}</p>
          <p><strong>Preferred Contact:</strong> ${submission.preferredContactMethod}</p>
          ${submission.address ? `<p><strong>Address:</strong> ${submission.address}</p>` : ''}
          <p><strong>Description:</strong></p>
          <p>${submission.description}</p>
          <p><strong>Submitted:</strong> ${submission.submittedAt.toLocaleString()}</p>
          <hr>
          <p>Login to your dashboard to view and respond to this quote request.</p>
        `
      };
      
      await sendEmail(emailData);
      
      res.status(201).json({ 
        success: true, 
        message: "Quote request submitted successfully. We'll contact you soon!",
        id: submission.id 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid submission data", details: error.errors });
      }
      console.error("Quote submission error:", error);
      res.status(500).json({ error: "Failed to submit quote request" });
    }
  });

  app.patch("/api/quote-submissions/:id", async (req, res) => {
    try {
      const existing = await storage.getQuoteSubmission(req.params.id);
      if (!existing) return res.status(404).json({ error: "Quote submission not found" });

      const body: Record<string, any> = { ...req.body };
      if (typeof body.status === "string" && body.status.trim()) {
        body.status = normalizeLeadStatus(body.status, body.stage ?? (existing as any).stage);
      }

      const updateData = insertQuoteSubmissionSchema.partial().parse(body);
      const updated = await storage.updateQuoteSubmission(req.params.id, updateData);

      // "Mark Site Visit Done" — explicit activity text called out in spec,
      // logged in addition to the generic status-change activity below.
      if (updateData.siteVisitDone === true && !(existing as any).siteVisitDone) {
        await storage.createLeadActivity({
          leadId: updated.id,
          type: "site_visit_done",
          description: "Site visit completed",
        });
      }

      // Log a lead activity + fire side-effects whenever status actually changes
      if (updateData.status && updateData.status !== existing.status) {
        const fromLabel = LEAD_STATUS_LABELS[existing.status] ?? existing.status;
        const toLabel = LEAD_STATUS_LABELS[updateData.status] ?? updateData.status;
        await storage.createLeadActivity({
          leadId: updated.id,
          type: "status_change",
          description: `Status changed from ${fromLabel} to ${toLabel}`,
        });

        // Moving a lead to "converted" means the quote was accepted — create
        // the accepted-workflow record server-side (idempotent) so job/contract
        // creation can happen as a separate follow-up step.
        if (updateData.status === "converted") {
          const existingWorkflow = await storage.getAcceptedWorkflowByQuote(updated.id);
          if (!existingWorkflow) {
            await storage.createAcceptedWorkflow({
              quoteId: updated.id,
              quoteNumber: updated.quoteNumber ?? null,
              companyName: updated.companyName,
              contactPerson: updated.contactPerson ?? null,
              serviceType: updated.serviceType ?? null,
              quoteAmount: updated.quoteAmount ?? null,
              monthlyRecurring: updated.monthlyRecurring ?? null,
              installationCost: updated.installationCost ?? null,
              frequency: updated.frequency ?? null,
              address: updated.address ?? null,
              specialInstructions: updated.specialInstructions ?? null,
              salesRepId: updated.assignedTo ?? null,
              afterHoursRequired: updated.afterHoursRequired ?? null,
              existingCompetitorContract: updated.existingCompetitorContract ?? null,
              competitorName: updated.competitorName ?? null,
              cancellationNoticeRequired: updated.cancellationNoticeRequired ?? null,
              noticePeriod: updated.noticePeriod ?? null,
              departmentId: updated.departmentId ?? null,
              workflowStatus: "pending_registration",
            } as any);
          }
        }
      }

      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid update data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update quote submission" });
    }
  });

  // Activity timeline for a lead
  app.get("/api/quote-submissions/:id/activities", async (req, res) => {
    try {
      const activities = await storage.getLeadActivities(req.params.id);
      res.json(activities);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch lead activities" });
    }
  });

  // ── Convert a lead directly to a client (manual "Convert to Client" action) ──
  app.post("/api/quote-submissions/:id/convert-to-client", async (req, res) => {
    try {
      const lead = await storage.getQuoteSubmission(req.params.id);
      if (!lead) return res.status(404).json({ error: "Lead not found" });

      const { linkToExistingId, forceCreate } = req.body as any;

      // If lead is already linked to a client, just confirm
      if (lead.clientId && !linkToExistingId) {
        return res.json({ clientId: lead.clientId, alreadyLinked: true });
      }

      // Link to an existing client the user chose
      if (linkToExistingId) {
        const updated = await storage.updateQuoteSubmission(lead.id, { clientId: linkToExistingId } as any);
        await storage.createLeadActivity({
          leadId: lead.id,
          type: "client_profile_linked",
          description: "Lead linked to existing client profile",
        });
        return res.json({ ...updated, clientId: linkToExistingId });
      }

      // Duplicate check (skipped if forceCreate === true)
      if (!forceCreate) {
        const allClients = await storage.getClients();
        const normName  = (s: string) => (s || "").toLowerCase().trim();
        const normPhone = (s: string) => (s || "").replace(/\D/g, "");
        const duplicates = allClients.filter(c => {
          const nameMatch  = normName(c.name) === normName(lead.companyName);
          const emailMatch = lead.email && c.email && c.email.toLowerCase() === lead.email.toLowerCase();
          const ph = normPhone(lead.phone ?? "");
          const phoneMatch = ph.length >= 7 && normPhone(c.phone ?? "") === ph;
          return nameMatch || emailMatch || phoneMatch;
        });
        if (duplicates.length > 0) {
          return res.status(409).json({
            code: "DUPLICATE_FOUND",
            message: "Possible duplicate client found",
            duplicates: duplicates.map(c => ({ id: c.id, name: c.name, email: c.email, phone: c.phone })),
          });
        }
      }

      // Create new client from lead details
      const client = await storage.createClient({
        name: lead.companyName,
        tradingName: (lead as any).tradingName ?? null,
        email: lead.email || null,
        phone: lead.phone || null,
        address: lead.address ?? null,
        contactPerson: lead.contactPerson ?? null,
        departmentId: (lead as any).departmentId ?? null,
        notes: lead.notes ?? null,
        status: "active",
      } as any);

      // Link the lead to the new client — do NOT change the lead status
      const updated = await storage.updateQuoteSubmission(lead.id, { clientId: client.id } as any);

      await storage.createLeadActivity({
        leadId: lead.id,
        type: "client_profile_created",
        description: "Client profile created from lead",
      });

      res.json({ ...updated, clientId: client.id, newClientId: client.id });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create client profile", details: error?.message });
    }
  });

  // ── Convert quote to a job (atomic: create job + mark quote "converted") ──
  app.post("/api/quote-submissions/:id/convert-to-job", async (req, res) => {
    try {
      const quote = await storage.getQuoteSubmission(req.params.id);
      if (!quote) return res.status(404).json({ error: "Quote not found" });
      const existingJobs = await storage.getJobs();
      if (existingJobs.some(j => (j as any).linkedQuoteId === quote.id)) {
        return res.status(409).json({ error: "Quote has already been converted to a job" });
      }

      const { clientId, workerId, departmentId, scheduledDate, scheduledTime, address,
              notes, estimatedValue, frequency, specialInstructions, salespersonId } = req.body;

      if (!clientId) return res.status(400).json({ error: "clientId is required to convert to a job" });
      if (!departmentId) return res.status(400).json({ error: "departmentId is required" });
      if (!scheduledDate) return res.status(400).json({ error: "scheduledDate is required" });

      const client = await storage.getClient(clientId);
      if (!client) return res.status(400).json({ error: "Client not found" });

      const workers = await storage.getWorkers();
      const salesperson = salespersonId ? workers.find(w => w.id === salespersonId) : null;

      const SERVICE_LABELS: Record<string, string> = {
        pest_control: "Pest Control", sanitary_bins: "Sanitary Bins",
        washroom: "Washroom Services", deep_cleaning: "Deep Cleaning",
      };

      const jobNumber = await storage.generateJobNumber();
      const job = await storage.createJob({
        title: `${SERVICE_LABELS[quote.serviceType] ?? quote.serviceType} — ${quote.companyName}`,
        description: quote.description || "",
        clientId,
        workerId: workerId || null,
        departmentId,
        serviceType: quote.serviceType,
        status: "scheduled",
        scheduledDate: new Date(`${scheduledDate}T${scheduledTime || "08:00"}:00`),
        scheduledTime: scheduledTime || "08:00",
        location: address || quote.address || "",
        notes: notes || "",
        price: estimatedValue || quote.quoteAmount || null,
        salesperson: salesperson?.name ?? "",
        priority: "medium",
        linkedQuoteId: quote.id,
        specialInstructions: specialInstructions || null,
        isRecurring: !!(frequency && frequency !== "once_off"),
        recurringPattern: frequency && frequency !== "once_off" ? frequency : null,
        service: SERVICE_LABELS[quote.serviceType] ?? quote.serviceType,
        jobNumber,
        legalEntityId: (quote as any).legalEntityId ?? null,
        legalEntityName: (quote as any).legalEntityName ?? null,
      } as any);

      await storage.updateQuoteSubmission(quote.id, { status: "converted", clientId });
      res.status(201).json({ job });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to convert quote to job", details: error.message });
    }
  });

  // ── Convert quote to a service contract (atomic: create contract + mark quote "converted") ──
  app.post("/api/quote-submissions/:id/convert-to-contract", async (req, res) => {
    try {
      const quote = await storage.getQuoteSubmission(req.params.id);
      if (!quote) return res.status(404).json({ error: "Quote not found" });
      const existingContracts = await storage.getRentalContracts();
      if (existingContracts.some(c => (c as any).linkedQuoteId === quote.id)) {
        return res.status(409).json({ error: "Quote has already been converted to a contract" });
      }

      const { clientId, departmentId, serviceType, frequency, contractPrice, startDate, notes } = req.body;

      if (!clientId) return res.status(400).json({ error: "clientId is required to convert to a contract" });
      if (!departmentId) return res.status(400).json({ error: "departmentId is required" });
      if (!serviceType) return res.status(400).json({ error: "serviceType is required" });
      if (!frequency) return res.status(400).json({ error: "frequency is required" });

      const client = await storage.getClient(clientId);
      if (!client) return res.status(400).json({ error: "Client not found" });

      const contractNumber = await storage.generateContractNumber();
      const contract = await storage.createRentalContract({
        contractNumber,
        clientId: clientId,
        customerName: client.name,
        departmentId,
        serviceType,
        frequency,
        contractPrice: contractPrice || null,
        startDate: startDate ? new Date(startDate) : new Date(),
        notes: notes || null,
        isServiceContract: true,
        activeStatus: true,
        linkedQuoteId: quote.id,
      } as any);

      await storage.updateQuoteSubmission(quote.id, { status: "converted", clientId });
      res.status(201).json({ contract });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to convert quote to contract", details: error.message });
    }
  });

  // Send a quote to a lead via email
  app.post("/api/quote-submissions/:id/send-quote", async (req, res) => {
    try {
      const lead = await storage.getQuoteSubmission(req.params.id);
      if (!lead) return res.status(404).json({ error: "Lead not found" });

      const { amount, validityDays = 30, message } = req.body;
      if (!amount) return res.status(400).json({ error: "Quote amount is required" });

      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + Number(validityDays));
      const validUntilStr = validUntil.toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });

      const SERVICE_LABELS: Record<string, string> = {
        pest_control: "Pest Control",
        sanitary_bins: "Sanitary Bins / Hygiene Services",
        washroom: "Washroom Services",
        deep_cleaning: "Deep Cleaning Services",
      };

      const serviceLabel = SERVICE_LABELS[lead.serviceType] ?? lead.serviceType;
      const amountNum = parseFloat(amount);
      const vatAmt = amountNum * 0.15;
      const totalAmt = amountNum + vatAmt;

      const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 0; background: #f4f4f4; }
  .wrap { max-width: 620px; margin: 32px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
  .header { background: #16a34a; padding: 28px 32px; }
  .header h1 { color: #fff; margin: 0; font-size: 22px; }
  .header p { color: rgba(255,255,255,0.85); margin: 4px 0 0; font-size: 14px; }
  .body { padding: 28px 32px; }
  .section { margin-bottom: 20px; }
  .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; margin-bottom: 4px; }
  .value { font-size: 15px; color: #111; }
  table.pricing { width: 100%; border-collapse: collapse; margin-top: 8px; }
  table.pricing td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
  table.pricing .total-row td { font-weight: bold; font-size: 16px; background: #f0fdf4; color: #15803d; }
  .validity { background: #fefce8; border: 1px solid #fde047; border-radius: 6px; padding: 12px 16px; font-size: 13px; color: #713f12; margin-top: 16px; }
  .message-box { background: #f8fafc; border-left: 3px solid #16a34a; padding: 14px 16px; font-size: 14px; color: #374151; margin-bottom: 20px; border-radius: 0 6px 6px 0; }
  .footer { background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 18px 32px; font-size: 12px; color: #6b7280; }
</style></head>
<body>
<div class="wrap">
  <div class="header">
    <h1>The Terminators — Service Quotation</h1>
    <p>Quote prepared for ${lead.companyName}</p>
  </div>
  <div class="body">
    <p style="font-size:15px;color:#374151">Dear ${lead.contactPerson},</p>
    <p style="font-size:14px;color:#4b5563">Thank you for your interest in our services. Please find your quotation below.</p>

    ${message ? `<div class="message-box">${message}</div>` : ""}

    <div class="section">
      <div class="label">Service Required</div>
      <div class="value" style="font-weight:600">${serviceLabel}</div>
    </div>

    ${lead.description ? `<div class="section">
      <div class="label">Scope of Work</div>
      <div class="value" style="font-size:14px;color:#4b5563">${lead.description}</div>
    </div>` : ""}

    ${lead.address ? `<div class="section">
      <div class="label">Service Address</div>
      <div class="value">${lead.address}</div>
    </div>` : ""}

    <div class="section">
      <div class="label">Pricing</div>
      <table class="pricing">
        <tr><td>${serviceLabel}</td><td style="text-align:right">R ${amountNum.toFixed(2)}</td></tr>
        <tr><td style="color:#6b7280">VAT (15%)</td><td style="text-align:right;color:#6b7280">R ${vatAmt.toFixed(2)}</td></tr>
        <tr class="total-row"><td>Total (incl. VAT)</td><td style="text-align:right">R ${totalAmt.toFixed(2)}</td></tr>
      </table>
    </div>

    <div class="validity">⏳ This quotation is valid until <strong>${validUntilStr}</strong>. To accept this quote, please reply to this email or contact us directly.</div>
  </div>
  <div class="footer">
    The Terminators Pest Control &amp; Hygiene Services<br>
    Tel: 041 123 4567 | info@theterminators.co.za<br>
    <em>All prices are subject to site inspection. VAT reg. no. included on invoice.</em>
  </div>
</div>
</body></html>`;

      await sendEmail({
        to: lead.email,
        from: "quotes@theterminators.co.za",
        subject: `Quotation for ${serviceLabel} — ${lead.companyName}`,
        html,
        text: `Dear ${lead.contactPerson},\n\nPlease find your quotation for ${serviceLabel}.\n\nAmount (excl. VAT): R ${amountNum.toFixed(2)}\nVAT (15%): R ${vatAmt.toFixed(2)}\nTotal (incl. VAT): R ${totalAmt.toFixed(2)}\n\nValid until: ${validUntilStr}\n\n${message ?? ""}\n\nThank you,\nThe Terminators`,
      });

      const updated = await storage.updateQuoteSubmission(lead.id, {
        status: "quoted",
        quoteAmount: amount,
        quoteSentAt: new Date(),
      } as any);

      if (lead.status !== "quoted") {
        await storage.createLeadActivity({
          leadId: lead.id,
          type: "quote_created",
          description: `Quote created and sent (R ${amountNum.toFixed(2)})`,
        });
      }

      res.json({ success: true, lead: updated });
    } catch (error) {
      console.error("Send quote error:", error);
      res.status(500).json({ error: "Failed to send quote" });
    }
  });

  app.delete("/api/quote-submissions/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteQuoteSubmission(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Quote submission not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete quote submission" });
    }
  });

  // ── Pricing Library ──────────────────────────────────────────────────────

  app.get("/api/pricing-library", async (req, res) => {
    try {
      const items = await storage.getPricingLibrary();
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch pricing library" });
    }
  });

  app.post("/api/pricing-library", async (req, res) => {
    try {
      const item = await storage.createPricingLibraryItem(req.body);
      res.status(201).json(item);
    } catch (error) {
      res.status(500).json({ error: "Failed to create pricing library item" });
    }
  });

  app.put("/api/pricing-library/:id", async (req, res) => {
    try {
      const item = await storage.updatePricingLibraryItem(req.params.id, req.body);
      if (!item) return res.status(404).json({ error: "Item not found" });
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: "Failed to update pricing library item" });
    }
  });

  app.delete("/api/pricing-library/:id", async (req, res) => {
    try {
      const deleted = await storage.deletePricingLibraryItem(req.params.id);
      if (!deleted) return res.status(404).json({ error: "Item not found" });
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete pricing library item" });
    }
  });

  // ── Sales Follow-ups ─────────────────────────────────────────────────────

  app.get("/api/sales-follow-ups", async (req, res) => {
    try {
      const followUps = await storage.getSalesFollowUps();
      res.json(followUps);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch follow-ups" });
    }
  });

  app.get("/api/sales-follow-ups/lead/:leadId", async (req, res) => {
    try {
      const followUps = await storage.getSalesFollowUpsByLead(req.params.leadId);
      res.json(followUps);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch follow-ups for lead" });
    }
  });

  app.post("/api/sales-follow-ups", async (req, res) => {
    try {
      const followUp = await storage.createSalesFollowUp(req.body);
      res.status(201).json(followUp);
    } catch (error) {
      res.status(500).json({ error: "Failed to create follow-up" });
    }
  });

  app.put("/api/sales-follow-ups/:id", async (req, res) => {
    try {
      const followUp = await storage.updateSalesFollowUp(req.params.id, req.body);
      if (!followUp) return res.status(404).json({ error: "Follow-up not found" });
      res.json(followUp);
    } catch (error) {
      res.status(500).json({ error: "Failed to update follow-up" });
    }
  });

  app.delete("/api/sales-follow-ups/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteSalesFollowUp(req.params.id);
      if (!deleted) return res.status(404).json({ error: "Follow-up not found" });
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete follow-up" });
    }
  });

  // WhatsApp messaging endpoint
  app.post("/api/whatsapp/send", async (req, res) => {
    try {
      const { to, message } = req.body;

      const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
      const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

      if (!phoneNumberId || !accessToken) {
        return res.status(500).json({ error: "WhatsApp is not configured. Missing API credentials." });
      }

      if (!to || !message) {
        return res.status(400).json({ error: "Phone number and message are required." });
      }

      // Normalise phone number: strip spaces/dashes, ensure it starts with country code
      const cleaned = to.replace(/[\s\-\(\)]/g, "");
      const phone = cleaned.startsWith("+") ? cleaned.slice(1) : cleaned;

      const response = await fetch(
        `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: phone,
            type: "text",
            text: { body: message },
          }),
        }
      );

      const data = await response.json() as any;

      if (!response.ok) {
        console.error("WhatsApp API error:", data);
        const errMsg = data?.error?.message ?? "Failed to send WhatsApp message";
        return res.status(response.status).json({ error: errMsg });
      }

      res.json({ success: true, messageId: data?.messages?.[0]?.id });
    } catch (error: any) {
      console.error("WhatsApp send error:", error);
      res.status(500).json({ error: error.message ?? "Failed to send WhatsApp message" });
    }
  });

  // WhatsApp template message endpoint
  app.post("/api/whatsapp/send-template", async (req, res) => {
    try {
      const { to, templateName, language = "en", parameters = [] } = req.body;

      const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
      const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

      if (!phoneNumberId || !accessToken) {
        return res.status(500).json({ error: "WhatsApp is not configured. Missing API credentials." });
      }

      if (!to || !templateName) {
        return res.status(400).json({ error: "Phone number and template name are required." });
      }

      const cleaned = to.replace(/[\s\-\(\)]/g, "");
      const phone = cleaned.startsWith("+") ? cleaned.slice(1) : cleaned;

      const components: any[] = [];
      if (parameters.length > 0) {
        components.push({
          type: "body",
          parameters: parameters.map((p: string) => ({ type: "text", text: p })),
        });
      }

      const response = await fetch(
        `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: phone,
            type: "template",
            template: {
              name: templateName,
              language: { code: language },
              ...(components.length > 0 ? { components } : {}),
            },
          }),
        }
      );

      const data = await response.json() as any;

      if (!response.ok) {
        console.error("WhatsApp template API error:", data);
        const errMsg = data?.error?.message ?? "Failed to send WhatsApp template message";
        return res.status(response.status).json({ error: errMsg });
      }

      res.json({ success: true, messageId: data?.messages?.[0]?.id });
    } catch (error: any) {
      console.error("WhatsApp template send error:", error);
      res.status(500).json({ error: error.message ?? "Failed to send WhatsApp template message" });
    }
  });

  // ── Sage Export ──────────────────────────────────────────────────────────

  // Query jobs eligible for Sage export
  // Helper: treat all "done" variants as completed
  const isCompletedStatus = (s: string | null | undefined) => {
    if (!s) return false;
    return ["completed", "complete", "done", "finished"].includes(s.toLowerCase().trim());
  };

  // Helper: map a raw job + lookups to the export row shape
  const toExportRow = (j: any, clientMap: Map<string,any>, workerMap: Map<string,any>, deptMap: Map<string,any>) => {
    const client  = clientMap.get(j.clientId) as any;
    const worker  = workerMap.get(j.workerId) as any;
    const dept    = deptMap.get(j.departmentId) as any;
    const priceEx = parseFloat(String(j.price ?? j.pricePerUnit ?? 0)) || 0;
    const qty     = 1;
    const vat     = 0.15;
    const vatAmt  = priceEx * qty * vat;
    const total   = priceEx * qty + vatAmt;
    return {
      id:           j.id,
      jobNumber:    j.jobNumber ?? j.id,
      jobDate:      j.scheduledDate,
      clientName:   client?.name ?? "",
      sageCode:     client?.sageCustomerCode ?? "",
      department:   dept?.name ?? "",
      technician:   worker?.name ?? "",
      description:  j.title ?? j.service ?? j.serviceType ?? "",
      quantity:     qty,
      unitPriceEx:  priceEx,
      vatPct:       15,
      vatAmount:    vatAmt,
      totalIncl:    total,
      invoiceNotes: j.notes ?? j.completionNotes ?? "",
      invoiceStatus: j.invoiceStatus ?? "not_invoiced",
      rawStatus:    j.status,
    };
  };

  app.get("/api/sage-export/jobs", async (req, res) => {
    try {
      const { from, to, departmentId, workerId, clientId, includeExported } = req.query as Record<string, string>;
      const allJobs    = await storage.getJobs();
      const allClients = await storage.getClients();
      const allWorkers = await storage.getWorkers();
      const allDepts   = await storage.getDepartments();

      const clientMap = new Map(allClients.map((c: any) => [c.id, c]));
      const workerMap = new Map(allWorkers.map((w: any) => [w.id, w]));
      const deptMap   = new Map(allDepts.map((d: any) => [d.id, d]));

      // Step 1: only completed + not fully invoiced
      let jobs = allJobs.filter((j: any) => {
        if (!isCompletedStatus(j.status)) return false;
        const inv = (j.invoiceStatus ?? "not_invoiced").toLowerCase().trim();
        if (inv === "invoiced") return false;
        if (inv === "exported" && includeExported !== "true") return false;
        return true;
      });

      // Step 2: date range (applied AFTER status so debug counts are accurate)
      if (from) { const d = new Date(from); jobs = jobs.filter((j: any) => new Date(j.scheduledDate) >= d); }
      if (to)   { const d = new Date(to); d.setHours(23,59,59,999); jobs = jobs.filter((j: any) => new Date(j.scheduledDate) <= d); }

      // Step 3: optional filters
      if (departmentId && departmentId !== "all") jobs = jobs.filter((j: any) => j.departmentId === departmentId);
      if (workerId     && workerId     !== "all") jobs = jobs.filter((j: any) => j.workerId === workerId);
      if (clientId     && clientId     !== "all") jobs = jobs.filter((j: any) => j.clientId === clientId);

      res.json(jobs.map((j: any) => toExportRow(j, clientMap, workerMap, deptMap)));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Debug summary + recent completed jobs
  app.get("/api/sage-export/summary", async (req, res) => {
    try {
      const { from, to } = req.query as Record<string, string>;
      const allJobs    = await storage.getJobs();
      const allClients = await storage.getClients();
      const allWorkers = await storage.getWorkers();
      const allDepts   = await storage.getDepartments();

      const clientMap = new Map(allClients.map((c: any) => [c.id, c]));
      const workerMap = new Map(allWorkers.map((w: any) => [w.id, w]));
      const deptMap   = new Map(allDepts.map((d: any) => [d.id, d]));

      const totalJobs = allJobs.length;

      // Jobs in date range (all statuses)
      let inRange = allJobs;
      if (from) { const d = new Date(from); inRange = inRange.filter((j: any) => new Date(j.scheduledDate) >= d); }
      if (to)   { const d = new Date(to); d.setHours(23,59,59,999); inRange = inRange.filter((j: any) => new Date(j.scheduledDate) <= d); }

      const completedInRange = inRange.filter((j: any) => isCompletedStatus(j.status));
      const alreadyInvoiced  = completedInRange.filter((j: any) => (j.invoiceStatus ?? "").toLowerCase() === "invoiced");
      const alreadyExported  = completedInRange.filter((j: any) => (j.invoiceStatus ?? "").toLowerCase() === "exported");
      const availableForExport = completedInRange.filter((j: any) => {
        const inv = (j.invoiceStatus ?? "not_invoiced").toLowerCase();
        return inv !== "invoiced";
      });

      // All completed jobs, sorted newest first, last 10
      const allCompleted = allJobs
        .filter((j: any) => isCompletedStatus(j.status))
        .sort((a: any, b: any) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime())
        .slice(0, 10);

      res.json({
        totalJobs,
        inDateRange:      inRange.length,
        completedInRange: completedInRange.length,
        alreadyInvoiced:  alreadyInvoiced.length,
        alreadyExported:  alreadyExported.length,
        availableForExport: availableForExport.length,
        recentCompleted:  allCompleted.map((j: any) => toExportRow(j, clientMap, workerMap, deptMap)),
      });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Bulk mark jobs as exported / invoiced
  app.post("/api/sage-export/mark", async (req, res) => {
    try {
      const { jobIds, status } = req.body as { jobIds: string[]; status: "exported" | "invoiced" };
      if (!Array.isArray(jobIds) || !status) return res.status(400).json({ error: "jobIds array and status required" });
      for (const id of jobIds) {
        await storage.updateJob(id, { invoiceStatus: status } as any);
      }
      res.json({ updated: jobIds.length });
    } catch (err: any) { res.status(400).json({ error: err.message }); }
  });

  // Generate Excel download for Sage export
  app.post("/api/sage-export/download", async (req, res) => {
    try {
      const XLSX = await import("xlsx");
      const { jobs } = req.body as { jobs: any[] };
      if (!Array.isArray(jobs)) return res.status(400).json({ error: "jobs array required" });

      const fmt = (d: any) => d ? new Date(d).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" }) : "";

      const rows = [
        ["Job Date", "Job Number", "Customer Name", "Sage Customer Code", "Department", "Technician",
         "Service Description", "Quantity", "Unit Price Ex VAT", "VAT %", "VAT Amount", "Total Incl VAT",
         "Invoice Notes", "Internal Job ID"],
        ...jobs.map((j: any) => [
          fmt(j.jobDate),
          j.jobNumber,
          j.clientName,
          j.sageCode,
          j.department,
          j.technician,
          j.description,
          j.quantity,
          parseFloat(j.unitPriceEx).toFixed(2),
          j.vatPct,
          parseFloat(j.vatAmount).toFixed(2),
          parseFloat(j.totalIncl).toFixed(2),
          j.invoiceNotes,
          j.id,
        ]),
      ];

      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Sage Export");

      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      const filename = `sage-export-${new Date().toISOString().split("T")[0]}.xlsx`;
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (err: any) {
      console.error("Sage Excel error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Inline admin-role guard (used by backup schedule and data-integrity endpoints)
  const requireAdmin = (req: AuthenticatedRequest, res: any, next: any) => {
    const role = (req.user as any)?.role ?? "";
    if (req.user?.authenticationMethod === "profile_picker" || !["admin", "superadmin"].includes(role)) {
      return res.status(403).json({ error: "Admin access required" });
    }
    next();
  };

  // Backup & Restore
  app.get("/api/backup/export", async (req, res) => {
    try {
      const data = await storage.exportBackup();
      const filename = `job-flow-restore-backup-${new Date().toISOString().split("T")[0]}.json`;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message ?? "Failed to export backup" });
    }
  });

  app.get("/api/backup/export-excel", async (req, res) => {
    try {
      const XLSX = await import("xlsx");
      const dateStr = (d: any) => d ? new Date(d).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" }) : "";
      const zar = (v: any) => v !== null && v !== undefined && v !== "" ? `ZAR ${parseFloat(String(v)).toFixed(2)}` : "";

      // Gather all data
      const backup = await storage.exportBackup();
      const [vehicles, fuelFillups, inspections, vehicleIssues, serviceRecords, workshopJobs, teams, attendanceRecords, allMemberRecords] = await Promise.all([
        storage.getVehicles(),
        storage.getFuelFillups(),
        storage.getVehicleInspections(),
        storage.getVehicleIssues(),
        storage.getServiceRecords(),
        storage.getWorkshopJobs(),
        storage.getTeams(),
        storage.getAttendanceRecords(),
        storage.getAllAttendanceMemberRecords(),
      ]);

      // Lookup helpers
      const clientMap = new Map((backup.clients as any[]).map((c: any) => [c.id, c.name]));
      const workerMap = new Map((backup.workers as any[]).map((w: any) => [w.id, w.name]));
      const deptMap   = new Map((backup.departments as any[]).map((d: any) => [d.id, d.name]));
      const itemMap   = new Map((backup.inventoryItems as any[]).map((i: any) => [i.id, i.name]));
      const supplierMap = new Map((backup.suppliers as any[]).map((s: any) => [s.id, s.name]));
      const vehicleMap = new Map(vehicles.map((v: any) => [v.id, v.registrationNumber ?? v.registration ?? v.id]));
      const teamMap    = new Map(teams.map((t: any) => [t.id, t.name]));
      const attMap     = new Map(attendanceRecords.map((a: any) => [a.id, a]));

      // Team members per team
      const teamMembersMap = new Map<string, string[]>();
      for (const t of teams) {
        const members = await storage.getTeamMembers(t.id);
        teamMembersMap.set(t.id, members.map((m: any) => workerMap.get(m.workerId) ?? m.workerId));
      }

      const wb = XLSX.utils.book_new();

      const addSheet = (name: string, rows: any[][]) => {
        const ws = XLSX.utils.aoa_to_sheet(rows);
        // Bold header row
        const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
        for (let c = range.s.c; c <= range.e.c; c++) {
          const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
          if (cell) cell.s = { font: { bold: true } };
        }
        XLSX.utils.book_append_sheet(wb, ws, name);
      };

      // ── 1. Clients ─────────────────────────────────────────────────────────
      addSheet("Clients", [
        ["Name", "Phone", "Email", "Business Type", "Address", "Status", "Payment Terms", "Credit Limit (ZAR)", "Tax Number", "Contact Person", "Notes"],
        ...(backup.clients as any[]).map((c: any) => [
          c.name, c.phone, c.email, c.businessType, c.address, c.status,
          c.paymentTerms, zar(c.creditLimit), c.taxNumber ?? "", c.contactPerson ?? "", c.notes ?? "",
        ]),
      ]);

      // ── 2. Jobs ─────────────────────────────────────────────────────────────
      addSheet("Jobs", [
        ["Job #", "Date", "Scheduled Time", "Client", "Worker", "Department", "Status", "Job Type", "Priority", "Notes"],
        ...(backup.jobs as any[]).map((j: any) => [
          j.jobNumber ?? j.id,
          dateStr(j.scheduledDate ?? j.date),
          j.scheduledTime ?? "",
          clientMap.get(j.clientId) ?? j.clientId,
          workerMap.get(j.workerId) ?? (j.workerId ?? "Unassigned"),
          deptMap.get(j.departmentId ?? j.divisionId) ?? "",
          j.status, j.jobType ?? "", j.priority ?? "",
          j.notes ?? "",
        ]),
      ]);

      // ── 3. Contracts ────────────────────────────────────────────────────────
      const unifiedContractsData: any[] = await (storage as any).getUnifiedContracts();
      const allLineItemsData: any[] = await (storage as any).getAllContractLineItems();
      addSheet("Contracts", [
        ["Contract #", "Client", "Department", "Frequency", "Start Date", "End Date", "Active", "Assigned Team", "Assigned Technician", "Invoice Rule", "Special Instructions"],
        ...unifiedContractsData.map((c: any) => [
          c.contractNumber ?? c.id,
          clientMap.get(c.clientId) ?? c.clientId,
          c.department ?? "",
          c.frequency ?? "",
          dateStr(c.contractStartDate),
          dateStr(c.contractEndDate),
          c.activeStatus ? "Yes" : "No",
          c.assignedTeamName ?? "",
          c.assignedTechnicianName ?? "",
          c.invoiceRule ?? "",
          c.specialInstructions ?? "",
        ]),
      ]);
      addSheet("Contract Line Items", [
        ["Contract #", "Client", "Line Type", "Item / Service", "Category", "Qty", "Unit Price (ZAR)", "Total Price (ZAR)", "Refill Rule", "Stock Tracking", "Notes"],
        ...allLineItemsData.map((li: any) => {
          const contract = unifiedContractsData.find((c: any) => c.id === li.contractId);
          return [
            contract?.contractNumber ?? li.contractId,
            clientMap.get(li.clientId) ?? li.clientId,
            li.lineType ?? "",
            li.itemServiceName ?? "",
            li.serviceCategory ?? "",
            li.quantity ?? "",
            zar(li.unitPrice),
            zar(li.totalPrice),
            li.refillRule ?? "",
            li.stockTrackingRequired ? "Yes" : "No",
            li.notes ?? "",
          ];
        }),
      ]);

      // ── 4. Quotes ───────────────────────────────────────────────────────────
      addSheet("Quotes", [
        ["Quote #", "Company", "Contact Name", "Phone", "Email", "Services Requested", "Status", "Received Date", "Message"],
        ...(backup.quoteSubmissions as any[]).map((q: any) => [
          q.quoteNumber ?? q.id,
          q.companyName ?? "", q.contactName ?? q.name ?? "",
          q.phone ?? "", q.email ?? "",
          Array.isArray(q.servicesRequested) ? q.servicesRequested.join(", ") : (q.servicesRequested ?? ""),
          q.status ?? "", dateStr(q.createdAt),
          q.message ?? "",
        ]),
      ]);

      // ── 4. Invoices ─────────────────────────────────────────────────────────
      addSheet("Invoices", [
        ["Invoice #", "Issue Date", "Due Date", "Client", "Subtotal (ZAR)", "Tax (ZAR)", "Total (ZAR)", "Status", "Notes"],
        ...(backup.invoices as any[]).map((inv: any) => [
          inv.invoiceNumber ?? inv.id,
          dateStr(inv.issueDate ?? inv.date),
          dateStr(inv.dueDate),
          clientMap.get(inv.clientId) ?? inv.clientId,
          zar(inv.subtotal ?? inv.amount),
          zar(inv.tax ?? inv.taxAmount),
          zar(inv.totalAmount ?? inv.total ?? inv.amount),
          inv.status ?? "", inv.notes ?? "",
        ]),
      ]);

      // ── 5. Rental Contracts ─────────────────────────────────────────────────
      addSheet("Rental Contracts", [
        ["Contract #", "Client", "Item", "Start Date", "End Date", "Monthly Rate (ZAR)", "Status", "Notes"],
        ...(backup.rentalContracts as any[]).map((rc: any) => [
          rc.contractNumber ?? rc.id,
          clientMap.get(rc.clientId) ?? rc.clientId,
          itemMap.get(rc.inventoryItemId) ?? rc.inventoryItemId,
          dateStr(rc.startDate), dateStr(rc.endDate),
          zar(rc.monthlyRate ?? rc.rentalRate),
          rc.status ?? "", rc.notes ?? "",
        ]),
      ]);

      // ── 6. Stock ─────────────────────────────────────────────────────────────
      addSheet("Stock", [
        ["SKU", "Name", "Type", "Qty", "Min Stock", "Max Stock", "Unit Price (ZAR)", "Supplier", "Department", "Location"],
        ...(backup.inventoryItems as any[]).map((i: any) => [
          i.sku ?? "", i.name, i.type ?? "",
          i.quantity ?? 0, i.minStockLevel ?? "", i.maxStockLevel ?? "",
          zar(i.unitPrice ?? i.price),
          i.supplier ?? "", deptMap.get(i.departmentId ?? i.divisionId) ?? "", i.location ?? "",
        ]),
      ]);

      // ── 7. Staff ─────────────────────────────────────────────────────────────
      addSheet("Staff", [
        ["Name", "Role", "Email", "Phone", "Department", "Active"],
        ...(backup.workers as any[]).map((w: any) => [
          w.name, w.role ?? "", w.email ?? "", w.phone ?? "",
          deptMap.get(w.departmentId) ?? "", w.isActive ? "Yes" : "No",
        ]),
      ]);

      // ── 8. Teams ─────────────────────────────────────────────────────────────
      addSheet("Teams", [
        ["Team Name", "Department", "Supervisor", "Active", "Members", "Notes"],
        ...teams.map((t: any) => [
          t.name,
          deptMap.get(t.departmentId) ?? "",
          workerMap.get(t.supervisorId) ?? "",
          t.isActive ? "Yes" : "No",
          (teamMembersMap.get(t.id) ?? []).join(", "),
          t.notes ?? "",
        ]),
      ]);

      // ── 9. Attendance ────────────────────────────────────────────────────────
      addSheet("Attendance", [
        ["Team", "Date", "Status", "Submitted By", "Submitted At"],
        ...attendanceRecords.map((a: any) => [
          teamMap.get(a.teamId) ?? a.teamId,
          dateStr(a.date), a.status ?? "",
          a.submittedBy ?? "", dateStr(a.submittedAt),
        ]),
      ]);

      // ── 10. Attendance Members ───────────────────────────────────────────────
      addSheet("Attendance Members", [
        ["Team", "Date", "Employee", "Role", "Status", "Absence Reason", "Notes"],
        ...allMemberRecords.map((m: any) => {
          const att = attMap.get(m.attendanceId);
          return [
            att ? (teamMap.get(att.teamId) ?? att.teamId) : "",
            att ? dateStr(att.date) : "",
            m.employeeName ?? workerMap.get(m.workerId) ?? m.workerId,
            m.role ?? "", m.status ?? "",
            m.absenceReason ?? "", m.notes ?? "",
          ];
        }),
      ]);

      // ── 11. Vehicles ─────────────────────────────────────────────────────────
      addSheet("Vehicles", [
        ["Registration", "Make", "Model", "Year", "Type", "Status", "Odometer (km)", "Notes"],
        ...vehicles.map((v: any) => [
          v.registrationNumber ?? v.registration ?? "",
          v.make ?? "", v.model ?? "", v.year ?? "",
          v.vehicleType ?? v.type ?? "", v.status ?? "",
          v.currentOdometer ?? v.odometer ?? "",
          v.notes ?? "",
        ]),
      ]);

      // ── 12. Fuel Fill-ups ────────────────────────────────────────────────────
      addSheet("Fuel Fill-ups", [
        ["Date", "Vehicle", "Driver", "Station", "Litres", "Total Cost (ZAR)", "Odometer (km)", "Full Tank"],
        ...fuelFillups.map((f: any) => [
          dateStr(f.fillupDate ?? f.date),
          vehicleMap.get(f.vehicleId) ?? f.vehicleId,
          workerMap.get(f.workerId) ?? (f.workerId ?? ""),
          f.station ?? f.fuelStation ?? "",
          f.litres ?? f.liters ?? f.quantity ?? "",
          zar(f.totalCost ?? f.cost ?? f.amount),
          f.odometer ?? f.odometerReading ?? "",
          f.fullTank ? "Yes" : "No",
        ]),
      ]);

      // ── 13. Vehicle Inspections ──────────────────────────────────────────────
      addSheet("Vehicle Inspections", [
        ["Date", "Vehicle", "Inspector", "Overall Status", "Odometer (km)", "Notes"],
        ...inspections.map((i: any) => [
          dateStr(i.inspectionDate ?? i.date),
          vehicleMap.get(i.vehicleId) ?? i.vehicleId,
          workerMap.get(i.inspectedBy ?? i.workerId) ?? "",
          i.overallStatus ?? i.status ?? "",
          i.odometerReading ?? i.odometer ?? "",
          i.notes ?? "",
        ]),
      ]);

      // ── 14. Maintenance (Service Records) ────────────────────────────────────
      addSheet("Maintenance", [
        ["Date", "Vehicle", "Service Type", "Cost (ZAR)", "Odometer (km)", "Performed By", "Next Service (km)", "Notes"],
        ...serviceRecords.map((s: any) => [
          dateStr(s.serviceDate ?? s.date),
          vehicleMap.get(s.vehicleId) ?? s.vehicleId,
          s.serviceType ?? s.type ?? "",
          zar(s.cost ?? s.totalCost),
          s.odometerReading ?? s.odometer ?? "",
          s.performedBy ?? s.technician ?? "",
          s.nextServiceOdometer ?? "",
          s.notes ?? "",
        ]),
      ]);

      // ── 15. Reported Issues ──────────────────────────────────────────────────
      addSheet("Reported Issues", [
        ["Date Reported", "Vehicle", "Issue Type", "Severity", "Description", "Status", "Reported By", "Resolved Date"],
        ...vehicleIssues.map((i: any) => [
          dateStr(i.reportedDate ?? i.createdAt ?? i.date),
          vehicleMap.get(i.vehicleId) ?? i.vehicleId,
          i.issueType ?? i.type ?? "",
          i.severity ?? "",
          i.description ?? "",
          i.status ?? "",
          workerMap.get(i.reportedBy ?? i.workerId) ?? "",
          dateStr(i.resolvedDate ?? i.resolvedAt),
        ]),
      ]);

      // ── 16. Purchase Orders ──────────────────────────────────────────────────
      addSheet("Purchase Orders", [
        ["PO #", "Supplier", "Order Date", "Required Date", "Total (ZAR)", "Status", "Notes"],
        ...(backup.purchaseOrders as any[]).map((po: any) => [
          po.poNumber ?? po.id,
          supplierMap.get(po.supplierId) ?? po.supplierId,
          dateStr(po.orderDate ?? po.createdAt),
          dateStr(po.requiredDate ?? po.dueDate),
          zar(po.totalAmount ?? po.total),
          po.status ?? "", po.notes ?? "",
        ]),
      ]);

      // ── 17. Suppliers ────────────────────────────────────────────────────────
      addSheet("Suppliers", [
        ["Name", "Contact Person", "Phone", "Email", "Address", "Payment Terms", "Notes"],
        ...(backup.suppliers as any[]).map((s: any) => [
          s.name, s.contactPerson ?? s.contact ?? "",
          s.phone ?? "", s.email ?? "",
          s.address ?? "", s.paymentTerms ?? "", s.notes ?? "",
        ]),
      ]);

      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      const filename = `job-flow-excel-backup-${new Date().toISOString().split("T")[0]}.xlsx`;
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (error: any) {
      console.error("Excel export error:", error);
      res.status(500).json({ error: error.message ?? "Failed to export Excel backup" });
    }
  });

  app.post("/api/backup/restore", async (req, res) => {
    try {
      const data = req.body;
      if (!data || typeof data !== "object") {
        return res.status(400).json({ error: "Invalid backup file" });
      }
      await storage.restoreBackup(data);
      res.json({ success: true, message: "Database restored successfully" });
    } catch (error: any) {
      res.status(500).json({ error: error.message ?? "Failed to restore backup" });
    }
  });

  app.get("/api/backup/logs", async (_req, res) => {
    try {
      const logs = await storage.getBackupLogs();
      res.json(logs);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/backup/email-config", async (_req, res) => {
    res.json(getBackupEmailConfig());
  });

  app.post("/api/backup/email-send", async (_req, res) => {
    try {
      const result = await runDailyBackupEmail("manual");
      const logs = await storage.getBackupLogs();
      const latest = logs[0] ?? null;
      if (result.status === "failed") {
        return res.status(500).json({ error: result.errorMessage ?? "Email backup failed", log: latest, result });
      }
      res.json({ success: true, log: latest, result });
    } catch (e: any) {
      const logs = await storage.getBackupLogs().catch(() => []);
      res.status(500).json({ error: e.message, log: logs[0] ?? null });
    }
  });

  app.post("/api/backup/smtp-test", async (_req, res) => {
    try {
      const result = await sendBrevoTestEmail();
      if (!result.success) return res.status(500).json(result);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ success: false, recipient: "", message: e?.message ?? "SMTP test crashed" });
    }
  });

  app.post("/api/backup/email-test", async (_req, res) => {
    try {
      // Recipient override is intentionally not supported here to prevent
      // backup data exfiltration to arbitrary addresses. Test always sends
      // to the configured BACKUP_EMAIL_TO (default info@terminators.co.za).
      const result = await runDailyBackupEmail("test");
      const logs = await storage.getBackupLogs();
      const latest = logs[0] ?? null;
      if (result.status === "failed") {
        return res.status(500).json({ error: result.errorMessage ?? "Test email failed", log: latest, result });
      }
      res.json({ success: true, log: latest, result });
    } catch (e: any) {
      const logs = await storage.getBackupLogs().catch(() => []);
      res.status(500).json({ error: e.message, log: logs[0] ?? null });
    }
  });

  app.get("/api/backup/schedule", requireAuth, requireAdmin, async (_req, res) => {
    try {
      const schedule = await storage.getBackupSchedule();
      res.json(schedule);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/backup/schedule", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { enabled, frequency, dayOfWeek, hourUTC, minuteUTC, recipientEmail } = req.body;
      if (typeof enabled !== "boolean") return res.status(400).json({ error: "enabled must be boolean" });
      if (!["daily", "weekly"].includes(frequency)) return res.status(400).json({ error: "frequency must be daily or weekly" });
      if (typeof hourUTC !== "number" || hourUTC < 0 || hourUTC > 23) return res.status(400).json({ error: "hourUTC must be 0-23" });
      if (typeof minuteUTC !== "number" || minuteUTC < 0 || minuteUTC > 59) return res.status(400).json({ error: "minuteUTC must be 0-59" });
      if (typeof dayOfWeek !== "number" || dayOfWeek < 0 || dayOfWeek > 6) return res.status(400).json({ error: "dayOfWeek must be 0-6" });
      if (typeof recipientEmail !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) return res.status(400).json({ error: "recipientEmail must be a valid email address" });
      const saved = await storage.setBackupSchedule({ enabled, frequency, dayOfWeek, hourUTC, minuteUTC, recipientEmail });
      res.json(saved);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── FLEET ROUTES ─────────────────────────────────────────────────────────

  app.get("/api/fleet/vehicles", async (req, res) => {
    try { res.json(await storage.getVehicles()); } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/fleet/vehicles/:id", async (req, res) => {
    const v = await storage.getVehicle(req.params.id);
    if (!v) return res.status(404).json({ error: "Vehicle not found" });
    res.json(v);
  });

  app.post("/api/fleet/vehicles", async (req, res) => {
    try {
      const data = insertVehicleSchema.parse(req.body);
      const vehicle = await storage.createVehicle(data);
      res.status(201).json(vehicle);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.patch("/api/fleet/vehicles/:id", async (req, res) => {
    try {
      const data = insertVehicleSchema.partial().parse(req.body);
      const vehicle = await storage.updateVehicle(req.params.id, data);
      res.json(vehicle);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.delete("/api/fleet/vehicles/:id", async (req, res) => {
    const ok = await storage.deleteVehicle(req.params.id);
    if (!ok) return res.status(404).json({ error: "Vehicle not found" });
    res.status(204).send();
  });

  app.get("/api/fleet/assignments", async (req, res) => {
    try {
      const { workerId, vehicleId } = req.query;
      if (workerId) {
        const a = await storage.getActiveAssignmentForWorker(workerId as string);
        return res.json(a ? [a] : []);
      }
      if (vehicleId) return res.json(await storage.getAssignmentsForVehicle(vehicleId as string));
      res.json(await storage.getVehicleAssignments());
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/fleet/assignments", async (req, res) => {
    try {
      const data = insertVehicleAssignmentSchema.parse(req.body);
      const a = await storage.createVehicleAssignment(data);
      res.status(201).json(a);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.patch("/api/fleet/assignments/:id", async (req, res) => {
    try {
      const data = insertVehicleAssignmentSchema.partial().parse(req.body);
      const a = await storage.updateVehicleAssignment(req.params.id, data);
      res.json(a);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.get("/api/fleet/km-logs", async (req, res) => {
    try {
      const { workerId, vehicleId } = req.query;
      if (workerId) return res.json(await storage.getKmLogsByWorker(workerId as string));
      if (vehicleId) return res.json(await storage.getKmLogsByVehicle(vehicleId as string));
      res.json(await storage.getKmLogs());
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/fleet/km-logs", async (req, res) => {
    try {
      const body = {
        ...req.body,
        logDate: req.body.logDate ? new Date(req.body.logDate) : new Date(),
      };
      const data = insertKmLogSchema.parse(body);
      const log = await storage.createKmLog(data);
      res.status(201).json(log);
    } catch (e: any) { res.status(400).json({ error: e.message, details: String(e) }); }
  });

  app.delete("/api/fleet/km-logs/:id", async (req, res) => {
    const ok = await storage.deleteKmLog(req.params.id);
    if (!ok) return res.status(404).json({ error: "KM log not found" });
    res.status(204).send();
  });

  app.get("/api/fleet/fuel-fillups", async (req, res) => {
    try {
      const { workerId, vehicleId } = req.query;
      if (workerId) return res.json(await storage.getFuelFillupsByWorker(workerId as string));
      if (vehicleId) return res.json(await storage.getFuelFillupsByVehicle(vehicleId as string));
      res.json(await storage.getFuelFillups());
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/fleet/fuel-fillups", async (req, res) => {
    try {
      const body = {
        ...req.body,
        fillDate: req.body.fillDate ? new Date(req.body.fillDate) : new Date(),
      };
      const data = insertFuelFillupSchema.parse(body);
      const fillup = await storage.createFuelFillup(data);
      res.status(201).json(fillup);
    } catch (e: any) { res.status(400).json({ error: e.message, details: String(e) }); }
  });

  app.delete("/api/fleet/fuel-fillups/:id", async (req, res) => {
    const ok = await storage.deleteFuelFillup(req.params.id);
    if (!ok) return res.status(404).json({ error: "Fuel fillup not found" });
    res.status(204).send();
  });

  app.get("/api/fleet/inspections", async (req, res) => {
    try {
      const { workerId, vehicleId, result } = req.query;
      if (workerId) return res.json(await storage.getVehicleInspectionsByWorker(workerId as string));
      if (vehicleId) return res.json(await storage.getVehicleInspectionsByVehicle(vehicleId as string));
      if (result === "fail") return res.json(await storage.getFailedInspections());
      res.json(await storage.getVehicleInspections());
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/fleet/inspections", async (req, res) => {
    try {
      const body = {
        ...req.body,
        inspectionDate: req.body.inspectionDate ? new Date(req.body.inspectionDate) : new Date(),
      };
      const data = insertVehicleInspectionSchema.parse(body);
      const inspection = await storage.createVehicleInspection(data);

      // Send fail alert email if any items failed
      if (inspection.overallResult === "fail") {
        try {
          const items = inspection.itemsJson ? JSON.parse(inspection.itemsJson) : [];
          const failedItems = items.filter((i: any) => i.result === "fail");
          const failList = failedItems.map((i: any) => `• ${i.name}${i.comments ? ": " + i.comments : ""}`).join("\n");
          await sendEmail({
            to: "admin@terminators.co.za",
            subject: `⚠️ FLEET FAIL ALERT — Vehicle ${inspection.vehicleId} — ${new Date().toLocaleDateString("en-ZA")}`,
            html: `<h2 style="color:#dc2626">Vehicle Inspection — FAIL</h2>
<p><strong>Vehicle ID:</strong> ${inspection.vehicleId}</p>
<p><strong>Driver:</strong> ${inspection.workerId}</p>
<p><strong>Date:</strong> ${new Date(inspection.inspectionDate).toLocaleString("en-ZA")}</p>
<h3>Failed Items:</h3>
<ul>${failedItems.map((i: any) => `<li><strong>${i.name}</strong>${i.comments ? ": " + i.comments : ""}</li>`).join("")}</ul>
${inspection.comments ? `<p><strong>Comments:</strong> ${inspection.comments}</p>` : ""}
<p style="color:#6b7280;font-size:12px">Sent automatically by The Terminators Fleet System</p>`,
            text: `VEHICLE INSPECTION — FAIL\n\nVehicle: ${inspection.vehicleId}\nDriver: ${inspection.workerId}\nDate: ${new Date(inspection.inspectionDate).toLocaleString("en-ZA")}\n\nFailed items:\n${failList}\n\n${inspection.comments ? "Comments: " + inspection.comments : ""}`,
          });
          await storage.updateVehicleInspection(inspection.id, { failAlertSent: true } as any);
        } catch (emailErr) {
          console.error("Failed to send inspection fail alert:", emailErr);
        }
      }

      res.status(201).json(inspection);
    } catch (e: any) { res.status(400).json({ error: e.message, details: String(e) }); }
  });

  app.patch("/api/fleet/inspections/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const body: any = { ...req.body };
      if (body.reviewedAt) body.reviewedAt = new Date(body.reviewedAt);
      const updated = await storage.updateVehicleInspection(req.params.id, body);
      res.json(updated);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.delete("/api/fleet/inspections/:id", async (req, res) => {
    const ok = await storage.deleteVehicleInspection(req.params.id);
    if (!ok) return res.status(404).json({ error: "Inspection not found" });
    res.status(204).send();
  });

  app.get("/api/fleet/dashboard", async (req, res) => {
    try {
      const { workerId } = req.query;
      const data = await storage.getFleetDashboardData(workerId as string | undefined);
      res.json(data);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── FLEET MAINTENANCE — ISSUES ──────────────────────────────────────────────
  app.get("/api/fleet/issues", async (req, res) => {
    try {
      const { vehicleId, workerId, status, urgency } = req.query as Record<string, string>;
      let issues = await storage.getVehicleIssues();
      if (vehicleId) issues = issues.filter(i => i.vehicleId === vehicleId);
      if (workerId) issues = issues.filter(i => i.workerId === workerId);
      if (status) issues = issues.filter(i => i.status === status);
      if (urgency) issues = issues.filter(i => i.urgency === urgency);
      res.json(issues);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/fleet/issues/open", async (_req, res) => {
    try { res.json(await storage.getOpenVehicleIssues()); }
    catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/fleet/issues/not-safe", async (_req, res) => {
    try { res.json(await storage.getNotSafeVehicleIssues()); }
    catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/fleet/issues/:id", async (req, res) => {
    try {
      const issue = await storage.getVehicleIssue(req.params.id);
      if (!issue) return res.status(404).json({ error: "Issue not found" });
      res.json(issue);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/fleet/issues", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const body = req.body;
      if (body.reportedAt) body.reportedAt = new Date(body.reportedAt);
      const parsed = insertVehicleIssueSchema.safeParse(body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
      const issue = await storage.createVehicleIssue(parsed.data);
      res.status(201).json(issue);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.patch("/api/fleet/issues/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const issue = await storage.updateVehicleIssue(req.params.id, req.body);
      res.json(issue);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.delete("/api/fleet/issues/:id", requireAuth, async (_req, res) => {
    try {
      await storage.deleteVehicleIssue((_req as any).params.id);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── FLEET MAINTENANCE — SERVICE RECORDS ─────────────────────────────────────
  app.get("/api/fleet/service-records", async (req, res) => {
    try {
      const { vehicleId } = req.query as Record<string, string>;
      if (vehicleId) return res.json(await storage.getServiceRecordsByVehicle(vehicleId));
      res.json(await storage.getServiceRecords());
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/fleet/service-records/:id", async (req, res) => {
    try {
      const rec = await storage.getServiceRecord(req.params.id);
      if (!rec) return res.status(404).json({ error: "Service record not found" });
      res.json(rec);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/fleet/service-records", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const body = req.body;
      if (body.serviceDate) body.serviceDate = new Date(body.serviceDate);
      if (body.nextServiceDate) body.nextServiceDate = new Date(body.nextServiceDate);
      const parsed = insertServiceRecordSchema.safeParse(body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
      const rec = await storage.createServiceRecord(parsed.data);
      res.status(201).json(rec);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.patch("/api/fleet/service-records/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const body = req.body;
      if (body.serviceDate) body.serviceDate = new Date(body.serviceDate);
      if (body.nextServiceDate) body.nextServiceDate = new Date(body.nextServiceDate);
      const rec = await storage.updateServiceRecord(req.params.id, body);
      res.json(rec);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.delete("/api/fleet/service-records/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      await storage.deleteServiceRecord(req.params.id);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/fleet/maintenance-dashboard", requireAuth, async (_req, res) => {
    try { res.json(await storage.getMaintenanceDashboardData()); }
    catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── FLEET — WORKSHOP JOBS ───────────────────────────────────────────────────
  app.get("/api/fleet/workshop-jobs", async (req, res) => {
    try {
      const { vehicleId } = req.query as Record<string, string>;
      if (vehicleId) return res.json(await storage.getWorkshopJobsByVehicle(vehicleId));
      res.json(await storage.getWorkshopJobs());
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/fleet/workshop-jobs/:id", async (req, res) => {
    try {
      const job = await storage.getWorkshopJob(req.params.id);
      if (!job) return res.status(404).json({ error: "Workshop job not found" });
      res.json(job);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/fleet/workshop-jobs", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const body: any = { ...req.body };
      if (body.scheduledDate) body.scheduledDate = new Date(body.scheduledDate);
      if (body.completedAt) body.completedAt = new Date(body.completedAt);
      const parsed = insertWorkshopJobSchema.safeParse(body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
      const job = await storage.createWorkshopJob(parsed.data);
      res.status(201).json(job);
    } catch (err: any) { res.status(400).json({ error: err.message }); }
  });

  app.patch("/api/fleet/workshop-jobs/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const body: any = { ...req.body };
      if (body.scheduledDate) body.scheduledDate = new Date(body.scheduledDate);
      if (body.completedAt) body.completedAt = new Date(body.completedAt);
      const job = await storage.updateWorkshopJob(req.params.id, body);
      res.json(job);
    } catch (err: any) { res.status(400).json({ error: err.message }); }
  });

  app.delete("/api/fleet/workshop-jobs/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      await storage.deleteWorkshopJob(req.params.id);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── FLEET — WEEKLY SUMMARY EMAIL ────────────────────────────────────────────
  app.post("/api/fleet/send-weekly-summary", async (_req, res) => {
    try {
      const { generateWeeklyFleetSummaryEmail, sendEmail } = await import("./email-service");
      const params = await generateWeeklyFleetSummaryEmail(storage);
      if (!params) return res.status(500).json({ error: "Could not generate summary" });
      await sendEmail(params);
      res.json({ success: true, message: `Weekly fleet summary sent to ${params.to}` });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── FLEET — NOTIFICATIONS ───────────────────────────────────────────────────
  app.get("/api/fleet/notifications", async (_req, res) => {
    try { res.json(await storage.getFleetNotifications()); }
    catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── TEAMS ──────────────────────────────────────────────────────────────────

  app.get("/api/teams", async (_req, res) => {
    try { res.json(await storage.getTeams()); }
    catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/team-members", async (_req, res) => {
    try {
      const teams = await storage.getTeams();
      const all = (await Promise.all(teams.map(t => storage.getTeamMembers(t.id)))).flat();
      res.json(all);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/teams/:id", async (req, res) => {
    try {
      const team = await storage.getTeam(req.params.id);
      if (!team) return res.status(404).json({ error: "Team not found" });
      res.json(team);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/teams", async (req, res) => {
    try {
      const team = await storage.createTeam(req.body);
      res.status(201).json(team);
    } catch (err: any) { res.status(400).json({ error: err.message }); }
  });

  app.patch("/api/teams/:id", async (req, res) => {
    try {
      const team = await storage.updateTeam(req.params.id, req.body);
      res.json(team);
    } catch (err: any) { res.status(400).json({ error: err.message }); }
  });

  app.delete("/api/teams/:id", async (req, res) => {
    try {
      await storage.deleteTeam(req.params.id);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/teams/:id/members", async (req, res) => {
    try { res.json(await storage.getTeamMembers(req.params.id)); }
    catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/teams/:id/members", async (req, res) => {
    try {
      const member = await storage.addTeamMember({ teamId: req.params.id, workerId: req.body.workerId });
      res.status(201).json(member);
    } catch (err: any) { res.status(400).json({ error: err.message }); }
  });

  app.delete("/api/teams/:id/members/:workerId", async (req, res) => {
    try {
      await storage.removeTeamMember(req.params.id, req.params.workerId);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/teams/by-worker/:workerId", async (req, res) => {
    try { res.json(await storage.getTeamsForWorker(req.params.workerId)); }
    catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/teams/by-supervisor/:supervisorId", async (req, res) => {
    try { res.json(await storage.getTeamsForSupervisor(req.params.supervisorId)); }
    catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── ATTENDANCE ─────────────────────────────────────────────────────────────

  app.get("/api/attendance", async (req, res) => {
    try {
      const { date, teamId, departmentId } = req.query as Record<string, string>;
      res.json(await storage.getAttendanceRecords({ date, teamId, departmentId }));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/attendance/:id", async (req, res) => {
    try {
      const record = await storage.getAttendanceRecord(req.params.id);
      if (!record) return res.status(404).json({ error: "Attendance record not found" });
      res.json(record);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/attendance/:id/members", async (req, res) => {
    try { res.json(await storage.getAttendanceMemberRecords(req.params.id)); }
    catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Get or create attendance for a team on a specific date
  app.post("/api/attendance/open", async (req, res) => {
    try {
      const { teamId, date } = req.body;
      if (!teamId || !date) return res.status(400).json({ error: "teamId and date required" });
      const record = await storage.getOrCreateAttendance(teamId, date);
      res.json(record);
    } catch (err: any) { res.status(400).json({ error: err.message }); }
  });

  // Update a single member's status
  app.patch("/api/attendance/:id/member", async (req, res) => {
    try {
      const { workerId, employeeName, role, status, absenceReason, notes } = req.body;
      const updated = await storage.upsertAttendanceMemberRecord({
        attendanceId: req.params.id,
        workerId,
        employeeName,
        role,
        status,
        absenceReason: absenceReason ?? null,
        notes: notes ?? null,
      });
      res.json(updated);
    } catch (err: any) { res.status(400).json({ error: err.message }); }
  });

  // Submit attendance
  app.post("/api/attendance/:id/submit", async (req, res) => {
    try {
      const submittedBy = req.body.submittedBy ?? "supervisor";
      const record = await storage.submitAttendance(req.params.id, submittedBy);
      res.json(record);
    } catch (err: any) { res.status(400).json({ error: err.message }); }
  });

  // ─── Service Contracts (recurring jobs, Outlook-style) ──────────────────
  app.get("/api/service-contracts", async (_req, res) => {
    res.json(await storage.getServiceContracts());
  });

  app.post("/api/service-contracts", async (req, res) => {
    try {
      const { insertServiceContractSchema } = await import("@shared/schema");
      const data = insertServiceContractSchema.parse(req.body);
      const created = await storage.createServiceContract(data);
      res.status(201).json(created);
    } catch (err: any) {
      console.error("Contract create error:", err);
      res.status(400).json({ error: "Invalid contract data", details: err?.message });
    }
  });

  app.put("/api/service-contracts/:id", async (req, res) => {
    try {
      const { insertServiceContractSchema } = await import("@shared/schema");
      const data = insertServiceContractSchema.partial().parse(req.body);
      const updated = await storage.updateServiceContract(req.params.id, data);
      if (!updated) return res.status(404).json({ error: "Contract not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: "Invalid contract data", details: err?.message });
    }
  });

  app.delete("/api/service-contracts/:id", async (req, res) => {
    const ok = await storage.deleteServiceContract(req.params.id);
    if (!ok) return res.status(404).json({ error: "Contract not found" });
    res.status(204).send();
  });

  // Expand contracts into virtual calendar occurrences for a date range
  app.get("/api/service-contracts/occurrences", async (req, res) => {
    try {
      const start = req.query.start ? new Date(String(req.query.start)) : null;
      const end = req.query.end ? new Date(String(req.query.end)) : null;
      if (!start || !end || isNaN(+start) || isNaN(+end)) {
        return res.status(400).json({ error: "start and end query params (ISO dates) are required" });
      }
      const occ = await storage.getContractOccurrences(start, end, {
        departmentId: req.query.departmentId ? String(req.query.departmentId) : undefined,
        technicianId: req.query.technicianId ? String(req.query.technicianId) : undefined,
        teamId: req.query.teamId ? String(req.query.teamId) : undefined,
      });
      res.json(occ);
    } catch (err: any) {
      console.error("Occurrences error:", err);
      res.status(400).json({ error: "Failed to compute occurrences", details: err?.message });
    }
  });

  // Per-occurrence overrides for recurring contract occurrences (reschedule / reassign /
  // cancel a single instance without touching the master contract's recurrence rule).
  app.get("/api/contract-occurrence-exceptions", async (req, res) => {
    try {
      const contractId = req.query.contractId ? String(req.query.contractId) : undefined;
      const rows = await storage.getContractOccurrenceExceptions(contractId);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to fetch contract occurrence exceptions", details: err?.message });
    }
  });

  app.post("/api/contract-occurrence-exceptions", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { insertContractOccurrenceExceptionSchema } = await import("@shared/schema");
      const { canMoveCalendarEvent } = await import("@shared/dashboardRole");
      const data = insertContractOccurrenceExceptionSchema.parse(req.body);
      const role = req.user!.role as any;
      const sourceType = data.contractKind === "rental" ? "rentalContractOccurrence" : "serviceContractOccurrence";
      const allowed = canMoveCalendarEvent(role, req.user!.id, {
        sourceType,
        assignedUserId: data.assignedTechnicianId ?? undefined,
        assignedTeamId: data.assignedTeamId ?? undefined,
      });
      if (!allowed) return res.status(403).json({ error: "Not permitted to modify this occurrence" });
      const row = await storage.upsertContractOccurrenceException(data);
      res.json(row);
    } catch (err: any) {
      res.status(400).json({ error: "Invalid contract occurrence exception data", details: err?.message });
    }
  });

  app.delete("/api/contract-occurrence-exceptions/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const role = req.user!.role as any;
      if (role !== "admin" && role !== "manager" && role !== "coordinator") {
        return res.status(403).json({ error: "Not permitted to remove this occurrence override" });
      }
      const ok = await storage.deleteContractOccurrenceException(req.params.id);
      if (!ok) return res.status(404).json({ error: "Exception not found" });
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ error: "Failed to delete contract occurrence exception", details: err?.message });
    }
  });

  // ─── Sales Appointments (Diary) ────────────────────────────────────────────
  app.get("/api/sales-appointments", async (_req, res) => {
    try {
      const appts = await storage.getSalesAppointments();
      res.json(appts);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to fetch appointments", details: err.message });
    }
  });

  app.get("/api/sales-appointments/:id", async (req, res) => {
    const appt = await storage.getSalesAppointment(req.params.id);
    if (!appt) return res.status(404).json({ error: "Appointment not found" });
    res.json(appt);
  });

  app.get("/api/sales-appointments/by-lead/:leadId", async (req, res) => {
    const appts = await storage.getSalesAppointmentsByLead(req.params.leadId);
    res.json(appts);
  });

  app.post("/api/sales-appointments", async (req, res) => {
    try {
      const { insertSalesAppointmentSchema } = await import("@shared/schema");

      // Sanitise incoming body: convert empty strings / placeholder values to
      // null so FK constraints and Zod validations don't fire on them.
      const body = { ...req.body };
      if (!body.assignedToId || body.assignedToId === "unassigned") body.assignedToId = null;
      if (!body.leadId) body.leadId = null;
      if (!body.quoteId) body.quoteId = null;
      if (!body.departmentId) body.departmentId = null;
      if (body.estimatedDuration === "" || body.estimatedDuration === undefined) body.estimatedDuration = null;

      // Explicit pre-check before parsing so the error message is clear
      if (!body.assignedToId && !body.title && !body.clientName) {
        return res.status(400).json({ success: false, message: "Could not save appointment", details: "assigned sales rep is required" });
      }

      const data = insertSalesAppointmentSchema.parse(body);
      const appt = await storage.createSalesAppointment(data);

      // Booking an appointment against a lead advances it to "Appointment Booked"
      // (unless it's already further along the pipeline than that).
      if (appt.leadId) {
        const lead = await storage.getQuoteSubmission(appt.leadId);
        if (lead) {
          const EARLY_STATUSES = new Set(["new", "contacted"]);
          await storage.createLeadActivity({
            leadId: lead.id,
            type: "appointment_booked",
            description: `Appointment booked: ${appt.title} on ${appt.date} at ${appt.startTime}`,
          });
          if (EARLY_STATUSES.has(normalizeLeadStatus(lead.status, (lead as any).stage))) {
            await storage.updateQuoteSubmission(lead.id, { status: "appointment_booked" } as any);
          }
        }
      }

      res.status(201).json(appt);
    } catch (err: any) {
      res.status(400).json({ error: "Failed to create appointment", details: err.message });
    }
  });

  app.patch("/api/sales-appointments/:id", async (req, res) => {
    try {
      const before = await storage.getSalesAppointment(req.params.id);

      // Strip read-only / auto-generated fields that must not be passed to .set()
      // (Drizzle throws "value.toISOString is not a function" when createdAt is
      // sent as a date string instead of a real Date object, and id must never
      // change).  Apply the same null-sanitisation as the POST route so empty-
      // string FK values don't violate constraints.
      const { id: _id, createdAt: _ca, ...rest } = req.body as Record<string, any>;
      const body: Record<string, any> = { ...rest };
      // Only normalise a field if it was actually sent — partial updates (e.g.
      // just { status: "rescheduled" }) must NOT touch fields they don't include.
      if ("assignedToId" in body && (!body.assignedToId || body.assignedToId === "unassigned")) body.assignedToId = null;
      if ("leadId"       in body && !body.leadId)       body.leadId       = null;
      if ("quoteId"      in body && !body.quoteId)      body.quoteId      = null;
      if ("departmentId" in body && !body.departmentId) body.departmentId = null;
      if ("estimatedDuration" in body && body.estimatedDuration === "") body.estimatedDuration = null;

      // Validate time ordering when both times are present in this update
      if (body.startTime && body.endTime) {
        const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); };
        if (toMin(body.endTime) <= toMin(body.startTime)) {
          return res.status(400).json({ error: "Failed to update appointment", details: "end time must be after start time" });
        }
        // Auto-recalculate estimatedDuration when both times are provided
        body.estimatedDuration = toMin(body.endTime) - toMin(body.startTime);
      } else if (body.endTime && !body.startTime) {
        // Resize-only update: fetch current appointment to validate against saved startTime
        if (!before) return res.status(404).json({ error: "Failed to update appointment", details: "appointment not found" });
        const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); };
        if (toMin(body.endTime) <= toMin(before.startTime)) {
          return res.status(400).json({ error: "Failed to update appointment", details: "end time must be after start time" });
        }
        body.estimatedDuration = toMin(body.endTime) - toMin(before.startTime);
      }

      const appt = await storage.updateSalesAppointment(req.params.id, body);

      // Completing a site-visit appointment marks the lead's site visit done
      // and advances it to "Quote Required" — this is the fix for leads that
      // used to silently vanish from the board on "Site Done".
      const justCompleted = req.body?.status === "completed" && before?.status !== "completed";
      if (justCompleted && appt.leadId) {
        const lead = await storage.getQuoteSubmission(appt.leadId);
        if (lead) {
          await storage.createLeadActivity({
            leadId: lead.id,
            type: "appointment_completed",
            description: `Appointment completed: ${appt.title}${appt.completionNote ? ` — ${appt.completionNote}` : ""}`,
          });
          if (appt.appointmentType === "site_visit") {
            const currentStatus = normalizeLeadStatus(lead.status, (lead as any).stage);
            const NOT_YET_QUOTED = new Set(["new", "contacted", "appointment_booked"]);
            await storage.updateQuoteSubmission(lead.id, {
              siteVisitDone: true,
              ...(NOT_YET_QUOTED.has(currentStatus) ? { status: "quote_required" } : {}),
            } as any);
            await storage.createLeadActivity({
              leadId: lead.id,
              type: "site_visit_done",
              description: "Site visit marked done — lead ready for quoting",
            });
          }
        }
      }

      res.json(appt);
    } catch (err: any) {
      res.status(400).json({ error: "Failed to update appointment", details: err.message });
    }
  });

  app.delete("/api/sales-appointments/:id", async (req, res) => {
    const ok = await storage.deleteSalesAppointment(req.params.id);
    if (!ok) return res.status(404).json({ error: "Appointment not found" });
    res.status(204).send();
  });

  // ── Expenses ──────────────────────────────────────────────────────────────
  app.get("/api/expenses", async (_req, res) => {
    res.json(await storage.getExpenses());
  });

  app.get("/api/expenses/:id", async (req, res) => {
    const e = await storage.getExpense(req.params.id);
    if (!e) return res.status(404).json({ error: "Expense not found" });
    res.json(e);
  });

  app.post("/api/expenses", async (req, res) => {
    try {
      const created = await storage.createExpense(req.body);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(400).json({ error: "Failed to create expense", details: err.message });
    }
  });

  app.put("/api/expenses/:id", async (req, res) => {
    try {
      const updated = await storage.updateExpense(req.params.id, req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: "Failed to update expense", details: err.message });
    }
  });

  app.delete("/api/expenses/:id", async (req, res) => {
    const ok = await storage.deleteExpense(req.params.id);
    if (!ok) return res.status(404).json({ error: "Expense not found" });
    res.status(204).send();
  });

  // ── Service Schedule ────────────────────────────────────────────────────
  app.get("/api/service-schedule", async (_req, res) => {
    res.json(await storage.getServiceScheduleEntries());
  });

  app.get("/api/service-schedule/:id", async (req, res) => {
    const e = await storage.getServiceScheduleEntry(req.params.id);
    if (!e) return res.status(404).json({ error: "Entry not found" });
    res.json(e);
  });

  app.post("/api/service-schedule", async (req, res) => {
    try {
      const parsed = insertServiceScheduleEntrySchema.parse(req.body);
      res.status(201).json(await storage.createServiceScheduleEntry(parsed));
    } catch (err: any) {
      res.status(400).json({ error: "Validation failed", details: err.message });
    }
  });

  app.put("/api/service-schedule/:id", async (req, res) => {
    try {
      const updated = await storage.updateServiceScheduleEntry(req.params.id, req.body);
      if (!updated) return res.status(404).json({ error: "Entry not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: "Failed to update", details: err.message });
    }
  });

  app.delete("/api/service-schedule/:id", async (req, res) => {
    const ok = await storage.deleteServiceScheduleEntry(req.params.id);
    if (!ok) return res.status(404).json({ error: "Entry not found" });
    res.status(204).send();
  });

  // ── Data Integrity (admin-only) ───────────────────────────────────────────
  // requireAdmin is defined earlier in this function (before the Backup section)

  // GET /api/admin/data-integrity/orphans
  app.get("/api/admin/data-integrity/orphans", requireAuth, requireAdmin, async (req, res) => {
    try {
      const [clients, jobs, invoices, contracts, quotes, serviceContracts] = await Promise.all([
        storage.getClients(),
        storage.getJobs(),
        storage.getInvoices(),
        storage.getRentalContracts(),
        storage.getQuoteSubmissions(),
        storage.getServiceContracts(),
      ]);
      const validClientIds = new Set(clients.map(c => c.id));

      const orphans: { type: string; id: string; label: string; clientId: string | null }[] = [];

      const isOrphan = (cid: string | null | undefined) => !cid || !validClientIds.has(cid);

      for (const j of jobs) {
        if (isOrphan(j.clientId)) {
          orphans.push({ type: "job", id: j.id, label: j.title ?? j.jobNumber ?? j.id, clientId: j.clientId ?? null });
        }
      }
      for (const inv of invoices) {
        if (isOrphan(inv.clientId)) {
          orphans.push({ type: "invoice", id: inv.id, label: inv.invoiceNumber ?? inv.id, clientId: inv.clientId ?? null });
        }
      }
      for (const c of contracts) {
        if (isOrphan(c.clientId)) {
          orphans.push({ type: "rentalContract", id: c.id, label: c.contractNumber ?? c.id, clientId: c.clientId ?? null });
        }
      }
      for (const q of quotes) {
        const cid = (q as any).clientId ?? null;
        // Quotes with no clientId are new leads — not broken records.
        // Only flag if a clientId is present but points to a missing client.
        if (cid !== null && !validClientIds.has(cid)) {
          orphans.push({ type: "quote", id: q.id, label: (q as any).quoteNumber ?? q.id, clientId: cid });
        }
      }
      for (const sc of serviceContracts) {
        const cid = (sc as any).clientId ?? null;
        if (isOrphan(cid)) {
          orphans.push({ type: "serviceContract", id: sc.id, label: (sc as any).title ?? sc.id, clientId: cid });
        }
      }

      const user = (req as any).user;
      await storage.addIntegrityScan({
        scannedAt: new Date().toISOString(),
        triggeredBy: user?.username ?? "admin",
        orphanCount: orphans.length,
        duplicateGroupCount: -1,
      }).catch(() => {});

      res.json({ orphans, totalClients: clients.length });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to scan orphans", details: err.message });
    }
  });

  // GET /api/admin/data-integrity/duplicates
  app.get("/api/admin/data-integrity/duplicates", requireAuth, requireAdmin, async (req, res) => {
    try {
      const clients = await storage.getClients();
      const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[\s\-.()+]/g, "");

      const byPhone: Record<string, typeof clients> = {};
      const byEmail: Record<string, typeof clients> = {};
      const byName:  Record<string, typeof clients> = {};

      for (const c of clients) {
        const phone = norm(c.phone);
        const email = norm(c.email);
        const name  = norm(c.name);
        if (phone.length > 4) { (byPhone[phone] ??= []).push(c); }
        if (email.length > 3) { (byEmail[email] ??= []).push(c); }
        if (name.length  > 2) { (byName[name]   ??= []).push(c); }
      }

      const groups: { field: string; value: string; clients: typeof clients }[] = [];
      for (const [k, v] of Object.entries(byPhone)) { if (v.length > 1) groups.push({ field: "phone", value: k, clients: v }); }
      for (const [k, v] of Object.entries(byEmail)) { if (v.length > 1) groups.push({ field: "email", value: k, clients: v }); }
      for (const [k, v] of Object.entries(byName))  { if (v.length > 1) groups.push({ field: "name",  value: k, clients: v }); }

      const user = (req as any).user;
      await storage.addIntegrityScan({
        scannedAt: new Date().toISOString(),
        triggeredBy: user?.username ?? "admin",
        orphanCount: -1,
        duplicateGroupCount: groups.length,
      }).catch(() => {});

      res.json({ groups, totalClients: clients.length });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to scan duplicates", details: err.message });
    }
  });

  // GET /api/admin/data-integrity/scan-history
  app.get("/api/admin/data-integrity/scan-history", requireAuth, requireAdmin, async (_req, res) => {
    try {
      const scans = await storage.getIntegrityScans();
      res.json(scans.slice(0, 10));
    } catch (err: any) {
      res.status(500).json({ error: "Failed to fetch scan history", details: err.message });
    }
  });

  // GET /api/admin/data-integrity/sources
  app.get("/api/admin/data-integrity/sources", requireAuth, requireAdmin, async (_req, res) => {
    try {
      const [
        clients, workers, jobs, invoices, contracts, quotes, serviceContracts,
        inventoryItems, suppliers, purchaseOrders, vehicles, expenses, calendarEvents,
      ] = await Promise.all([
        storage.getClients(),
        storage.getWorkers(),
        storage.getJobs(),
        storage.getInvoices(),
        storage.getRentalContracts(),
        storage.getQuoteSubmissions(),
        storage.getServiceContracts(),
        storage.getInventoryItems(),
        storage.getSuppliers(),
        storage.getPurchaseOrders(),
        storage.getVehicles(),
        storage.getExpenses(),
        storage.getCalendarEvents(),
      ]);

      res.json([
        { module: "Clients",           source: "clients",           count: clients.length },
        { module: "Workers / Staff",   source: "workers",           count: workers.length },
        { module: "Jobs",              source: "jobs",              count: jobs.length },
        { module: "Invoices",          source: "invoices",          count: invoices.length },
        { module: "Rental Contracts",  source: "rental_contracts",  count: contracts.length },
        { module: "Quotes / Leads",    source: "quote_submissions", count: quotes.length },
        { module: "Service Contracts", source: "service_contracts", count: serviceContracts.length },
        { module: "Inventory Items",   source: "inventory_items",   count: inventoryItems.length },
        { module: "Suppliers",         source: "suppliers",         count: suppliers.length },
        { module: "Purchase Orders",   source: "purchase_orders",   count: purchaseOrders.length },
        { module: "Vehicles",          source: "vehicles",          count: vehicles.length },
        { module: "Expenses",          source: "expenses",          count: expenses.length },
        { module: "Calendar Events",   source: "calendar_events",   count: calendarEvents.length },
      ]);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to fetch data sources", details: err.message });
    }
  });

  // PATCH /api/admin/data-integrity/fix-orphan
  app.patch("/api/admin/data-integrity/fix-orphan", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { type, id, clientId } = req.body as { type: string; id: string; clientId: string };
      if (!type || !id || !clientId) {
        return res.status(400).json({ error: "type, id, and clientId are required" });
      }
      const client = await storage.getClient(clientId);
      if (!client) return res.status(404).json({ error: "Target client not found" });

      switch (type) {
        case "job":
          await storage.updateJob(id, { clientId });
          break;
        case "invoice":
          await storage.updateInvoice(id, { clientId });
          break;
        case "rentalContract":
          await storage.updateRentalContract(id, { clientId });
          break;
        case "quote":
          await storage.updateQuoteSubmission(id, { clientId } as any);
          break;
        case "serviceContract":
          await storage.updateServiceContract(id, { clientId } as any);
          break;
        default:
          return res.status(400).json({ error: `Unsupported type: ${type}` });
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to fix orphan", details: err.message });
    }
  });

  // GET /api/admin/data-integrity/backup/csv
  app.get("/api/admin/data-integrity/backup/csv", requireAuth, requireAdmin, async (_req, res) => {
    try {
      const clients = await storage.getClients();
      const headers = ["id","name","email","phone","address","businessType","status","createdAt"];
      const escape  = (v: any) => {
        const s = String(v ?? "").replace(/"/g, '""');
        return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s;
      };
      const rows = clients.map(c =>
        [c.id, c.name, c.email, c.phone, c.address, (c as any).businessType, c.status, c.createdAt].map(escape).join(",")
      );
      const csv = [headers.join(","), ...rows].join("\n");
      const filename = `clients-backup-${new Date().toISOString().split("T")[0]}.csv`;
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to export CSV", details: err.message });
    }
  });

  // GET /api/admin/data-integrity/backup/summary
  // Returns record counts + export timestamp for the Backup tab UI.
  app.get("/api/admin/data-integrity/backup/summary", requireAuth, requireAdmin, async (_req, res) => {
    try {
      const [clients, jobs, rentalContracts, serviceContracts, invoices, quotes, workers] = await Promise.all([
        storage.getClients(),
        storage.getJobs(),
        storage.getRentalContracts(),
        storage.getServiceContracts(),
        storage.getInvoices(),
        storage.getQuoteSubmissions(),
        storage.getWorkers(),
      ]);
      res.json({
        exportedAt: new Date().toISOString(),
        counts: {
          clients:          clients.length,
          jobs:             jobs.length,
          rentalContracts:  rentalContracts.length,
          serviceContracts: serviceContracts.length,
          invoices:         invoices.length,
          quotes:           quotes.length,
          workers:          workers.length,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to fetch backup summary", details: err.message });
    }
  });

  // GET /api/admin/data-integrity/backup/json
  // Admin-protected full system backup with summary metadata block.
  app.get("/api/admin/data-integrity/backup/json", requireAuth, requireAdmin, async (_req, res) => {
    try {
      const [data, clients, jobs, rentalContracts, serviceContracts, invoices, quotes, workers] = await Promise.all([
        storage.exportBackup(),
        storage.getClients(),
        storage.getJobs(),
        storage.getRentalContracts(),
        storage.getServiceContracts(),
        storage.getInvoices(),
        storage.getQuoteSubmissions(),
        storage.getWorkers(),
      ]);

      const payload = {
        _meta: {
          exportedAt: new Date().toISOString(),
          appVersion: "1.0.0",
          counts: {
            clients:          clients.length,
            jobs:             jobs.length,
            rentalContracts:  rentalContracts.length,
            serviceContracts: serviceContracts.length,
            invoices:         invoices.length,
            quotes:           quotes.length,
            workers:          workers.length,
          },
        },
        ...data,
      };

      const filename = `terminators-backup-${new Date().toISOString().split("T")[0]}.json`;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.json(payload);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to export backup", details: err.message });
    }
  });

  // ── Save/Search Workflow Test ─────────────────────────────────────────────
  // Creates test records, verifies each appears in its real list/filter
  // queries, reports per-screen pass/fail, then cleans up.
  app.get("/api/admin/data-integrity/save-search-test", async (_req, res) => {
    type ScreenResult = { screen: string; found: boolean };
    type RecordResult = {
      recordType: string;
      id: string;
      clientId: string;
      status: "passed" | "failed";
      screens: ScreenResult[];
      failureReason?: string;
    };

    const results: RecordResult[] = [];
    const toDelete: { type: string; id: string }[] = [];
    let testClientId = "";

    const pass = (screen: string): ScreenResult => ({ screen, found: true });
    const fail = (screen: string): ScreenResult => ({ screen, found: false });

    try {
      // ── 1. Create test client ────────────────────────────────────────────
      const testClient = await storage.createClient({
        name: `SYSCHECK-${Date.now()}`,
        email: `syscheck-${Date.now()}@test.local`,
        phone: "000-000-0000",
        address: "1 Test Street",
        city: "Port Elizabeth",
        departmentId: "div-3",
        status: "active",
      });
      testClientId = testClient.id;
      toDelete.push({ type: "client", id: testClient.id });

      // ── 2. Quote ─────────────────────────────────────────────────────────
      {
        const quote = await storage.createQuoteSubmission({
          companyName: testClient.name,
          contactPerson: "Test Contact",
          email: testClient.email!,
          phone: testClient.phone!,
          serviceType: "washroom",
          description: "SYSCHECK automated test quote",
          preferredContactMethod: "email",
          status: "new",
          origination: "other",
          clientId: testClient.id,
        });
        toDelete.push({ type: "quote", id: quote.id });

        const allQuotes = await storage.getQuoteSubmissions();
        const inList = allQuotes.some(q => q.id === quote.id);
        const inClient = allQuotes.some(q => q.id === quote.id && (q.clientId === testClientId || q.companyName === testClient.name));

        const screens: ScreenResult[] = [
          inList ? pass("Sales › Quotes / Leads list") : fail("Sales › Quotes / Leads list"),
          inClient ? pass("Client Profile › Quotes tab") : fail("Client Profile › Quotes tab"),
        ];
        results.push({
          recordType: "Quote",
          id: quote.id,
          clientId: testClientId,
          status: screens.every(s => s.found) ? "passed" : "failed",
          screens,
        });
      }

      // ── 3. Job ───────────────────────────────────────────────────────────
      {
        const scheduledDate = new Date();
        const job = await storage.createJob({
          clientId: testClient.id,
          workerId: "worker-12",
          departmentId: "div-3",
          serviceType: "washroom",
          title: "SYSCHECK-JOB",
          status: "scheduled",
          priority: "medium",
          scheduledDate,
          estimatedDuration: 60,
          location: "1 Test Street",
          isRecurring: false,
          isContract: false,
          isFixed: false,
        });
        toDelete.push({ type: "job", id: job.id });

        const allJobs = await storage.getJobs();
        const inList = allJobs.some(j => j.id === job.id);
        const inClient = allJobs.some(j => j.id === job.id && j.clientId === testClientId);
        const dayStart = new Date(scheduledDate); dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(scheduledDate); dayEnd.setHours(23, 59, 59, 999);
        const inCalendar = allJobs.some(j => {
          if (j.id !== job.id) return false;
          const d = new Date(j.scheduledDate);
          return d >= dayStart && d <= dayEnd;
        });

        const screens: ScreenResult[] = [
          inList ? pass("Service › Jobs list") : fail("Service › Jobs list"),
          inClient ? pass("Client Profile › Jobs tab") : fail("Client Profile › Jobs tab"),
          inCalendar ? pass("Calendar (scheduled date)") : fail("Calendar (scheduled date)"),
        ];
        results.push({
          recordType: "Job",
          id: job.id,
          clientId: testClientId,
          status: screens.every(s => s.found) ? "passed" : "failed",
          screens,
        });
      }

      // ── 4. Service Contract ───────────────────────────────────────────────
      {
        const sc = await storage.createServiceContract({
          clientId: testClient.id,
          customerName: testClient.name,
          departmentId: "div-3",
          serviceType: "washroom",
          frequency: "Weekly",
          dayOfWeek: "Wednesday",
          startTime: "09:00",
          estimatedDuration: 60,
          contractPrice: "500.00",
          notes: "SYSCHECK test contract",
          isActive: true,
        });
        toDelete.push({ type: "serviceContract", id: sc.id });

        const allSC = await storage.getServiceContracts();
        const inList = allSC.some(c => c.id === sc.id);
        const inClient = allSC.some(c => c.id === sc.id && c.clientId === testClientId);

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        const occurrences = await storage.getContractOccurrences(monthStart, monthEnd, {});
        const inCalendar = occurrences.some(o => o.id.includes(sc.id));

        const screens: ScreenResult[] = [
          inList ? pass("Service › Contracts list") : fail("Service › Contracts list"),
          inClient ? pass("Client Profile › Contracts tab") : fail("Client Profile › Contracts tab"),
          inCalendar ? pass("Calendar occurrences (this month)") : fail("Calendar occurrences (this month)"),
        ];
        results.push({
          recordType: "Service Contract",
          id: sc.id,
          clientId: testClientId,
          status: screens.every(s => s.found) ? "passed" : "failed",
          screens,
        });
      }

      // ── 5. Rental Contract ────────────────────────────────────────────────
      {
        const invItems = await storage.getInventoryItems();
        const invItem = invItems[0];
        if (!invItem) throw new Error("No inventory items found — cannot test rental contract");

        const rc = await storage.createRentalContract({
          clientId: testClient.id,
          inventoryItemId: invItem.id,
          startDate: new Date(),
          isActive: true,
          quantity: 1,
          billingFrequency: "monthly",
          monthlyPrice: "100.00",
        });
        toDelete.push({ type: "rentalContract", id: rc.id });

        const allRC = await storage.getRentalContracts();
        const inList = allRC.some(c => c.id === rc.id);
        const inClient = allRC.some(c => c.id === rc.id && c.clientId === testClientId);

        const screens: ScreenResult[] = [
          inList ? pass("Sales › Rental Contracts list") : fail("Sales › Rental Contracts list"),
          inClient ? pass("Client Profile › Contracts tab") : fail("Client Profile › Contracts tab"),
        ];
        results.push({
          recordType: "Rental Contract",
          id: rc.id,
          clientId: testClientId,
          status: screens.every(s => s.found) ? "passed" : "failed",
          screens,
        });
      }

      // ── 6. Invoice ────────────────────────────────────────────────────────
      {
        const inv = await storage.createInvoice({
          clientId: testClient.id,
          invoiceNumber: `SYSCHECK-${Date.now()}`,
          status: "draft",
          issueDate: new Date(),
          dueDate: new Date(),
          subtotal: "100.00",
          taxAmount: "15.00",
          total: "115.00",
          paidAmount: "0.00",
        });
        toDelete.push({ type: "invoice", id: inv.id });

        const allInv = await storage.getInvoices();
        const inList = allInv.some(i => i.id === inv.id);
        const inClient = allInv.some(i => i.id === inv.id && i.clientId === testClientId);
        const byClient = await storage.getInvoicesByClient(testClientId);
        const inClientQuery = byClient.some(i => i.id === inv.id);

        const screens: ScreenResult[] = [
          inList ? pass("Finance › Invoices list") : fail("Finance › Invoices list"),
          inClient ? pass("Client Profile › Invoices tab") : fail("Client Profile › Invoices tab"),
          inClientQuery ? pass("getInvoicesByClient query") : fail("getInvoicesByClient query"),
        ];
        results.push({
          recordType: "Invoice",
          id: inv.id,
          clientId: testClientId,
          status: screens.every(s => s.found) ? "passed" : "failed",
          screens,
        });
      }

      // ── 7. Unified Contract + Line Items ──────────────────────────────────
      {
        const contract = await (storage as any).createUnifiedContract({
          clientId: testClient.id,
          department: "Sanitary Bins",
          frequency: "Monthly",
          activeStatus: true,
          invoiceRule: "Invoice monthly contract",
        });
        toDelete.push({ type: "unifiedContract", id: contract.id });

        const lineItem = await (storage as any).createContractLineItem({
          contractId: contract.id,
          clientId: testClient.id,
          lineType: "Service",
          itemServiceName: "Sanitary Bin Service / Exchange",
          quantity: "1",
          unitPrice: "50",
          totalPrice: "50",
          refillRule: "Not Applicable",
          stockTrackingRequired: false,
          notes: "SYSCHECK test line",
        });
        toDelete.push({ type: "contractLineItem", id: lineItem.id });

        const allContracts     = await (storage as any).getUnifiedContracts();
        const clientContracts  = await (storage as any).getUnifiedContractsByClient(testClientId);
        const savedLineItems   = await (storage as any).getContractLineItems(contract.id);

        const inList           = allContracts.some((c: any) => c.id === contract.id);
        const inClientProfile  = clientContracts.some((c: any) => c.id === contract.id);
        const lineItemSaved    = savedLineItems.some((li: any) => li.id === lineItem.id);
        const contractNumberOk = !!contract.contractNumber;

        const screens: ScreenResult[] = [
          inList          ? pass("Service › Contracts list")             : fail("Service › Contracts list"),
          inClientProfile ? pass("Client Profile › Contracts tab")       : fail("Client Profile › Contracts tab"),
          lineItemSaved   ? pass("Contract line item saved to PostgreSQL") : fail("Contract line item saved to PostgreSQL"),
          contractNumberOk? pass(`Contract number generated (${contract.contractNumber})`) : fail("Contract number generated"),
        ];
        results.push({
          recordType: "Unified Contract",
          id: contract.id,
          clientId: testClientId,
          status: screens.every(s => s.found) ? "passed" : "failed",
          screens,
        });
      }

    } catch (err: any) {
      results.push({
        recordType: "TEST ERROR",
        id: "-",
        clientId: testClientId,
        status: "failed",
        screens: [],
        failureReason: err?.message ?? String(err),
      });
    } finally {
      // ── Cleanup ─────────────────────────────────────────────────────────
      for (const item of toDelete.reverse()) {
        try {
          if (item.type === "invoice")          await storage.deleteInvoice(item.id);
          else if (item.type === "job")          await storage.deleteJob(item.id);
          else if (item.type === "serviceContract") await storage.deleteServiceContract(item.id);
          else if (item.type === "rentalContract")  await storage.deleteRentalContract(item.id);
          else if (item.type === "quote")        await storage.deleteQuoteSubmission(item.id);
          else if (item.type === "contractLineItem") await (storage as any).deleteContractLineItem(item.id);
          else if (item.type === "unifiedContract")  await (storage as any).deleteUnifiedContract(item.id);
          else if (item.type === "client")       await storage.deleteClient(item.id);
        } catch (_) { /* best-effort cleanup */ }
      }
    }

    const overall = results.length > 0 && results.every(r => r.status === "passed") ? "passed" : "failed";
    res.json({ overall, results });
  });

  // ── Database Status ──────────────────────────────────────────────────────
  // PostgreSQL is the production source of truth.
  // Do not add new fields to API writes unless the Drizzle schema AND
  // PostgreSQL table columns are updated together. Previous bugs occurred
  // when Drizzle tried to write fields that did not exist in the database.
  app.get("/api/admin/data-integrity/db-status", requireAuth, requireAdmin, async (_req, res) => {
    try {
      // Verify connection with a lightweight query
      const connCheck = await db.execute(sql`SELECT NOW() as now`);
      const checkedAt = (connCheck.rows[0] as any)?.now ?? new Date();

      const [
        clients, workers, jobs, invoices, quotes,
        serviceContracts, rentalContracts, purchaseOrders,
        activityLogs, backupLogs, unifiedContracts, contractLineItems,
      ] = await Promise.all([
        storage.getClients(),
        storage.getWorkers(),
        storage.getJobs(),
        storage.getInvoices(),
        storage.getQuoteSubmissions(),
        storage.getServiceContracts(),
        storage.getRentalContracts(),
        storage.getPurchaseOrders(),
        storage.getActivityLogs(),
        storage.getBackupLogs(),
        (storage as any).getUnifiedContracts(),
        (storage as any).getAllContractLineItems(),
      ]);

      res.json({
        storageType: "PostgreSQL",
        memStorageDisabled: true,
        checkedAt: new Date(checkedAt).toISOString(),
        counts: {
          clients:           clients.length,
          workers:           workers.length,
          jobs:              jobs.length,
          invoices:          invoices.length,
          quotes:            quotes.length,
          serviceContracts:  serviceContracts.length,
          rentalContracts:   rentalContracts.length,
          unifiedContracts:  unifiedContracts.length,
          contractLineItems: contractLineItems.length,
          purchaseOrders:    purchaseOrders.length,
          activityLogs:      activityLogs.length,
          backupLogs:        backupLogs.length,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to fetch database status", details: err.message });
    }
  });

  // ── Database Health Check ────────────────────────────────────────────────
  app.get("/api/admin/data-integrity/health-check", requireAuth, requireAdmin, async (_req, res) => {
    type CheckResult = {
      name: string;
      status: "passed" | "failed" | "warning";
      details: string;
      error?: string;
    };
    const checks: CheckResult[] = [];
    const pass  = (name: string, details: string): CheckResult => ({ name, status: "passed",  details });
    const fail  = (name: string, details: string, error?: string): CheckResult => ({ name, status: "failed",  details, error });
    const warn  = (name: string, details: string): CheckResult => ({ name, status: "warning", details });

    // 1. PostgreSQL connection
    try {
      const r = await db.execute(sql`SELECT NOW() as now`);
      checks.push(pass("PostgreSQL Connection", `Connected — server time: ${new Date((r.rows[0] as any)?.now).toISOString()}`));
    } catch (e: any) {
      checks.push(fail("PostgreSQL Connection", "Could not connect to PostgreSQL", e.message));
    }

    // 2 & 3. All main tables queryable + counts return correctly
    let clients: any[] = [], workers: any[] = [], jobs: any[] = [], invoices: any[] = [],
        quotes: any[] = [], serviceContracts: any[] = [], rentalContracts: any[] = [],
        purchaseOrders: any[] = [];
    try {
      [clients, workers, jobs, invoices, quotes, serviceContracts, rentalContracts, purchaseOrders] =
        await Promise.all([
          storage.getClients(),        storage.getWorkers(),
          storage.getJobs(),           storage.getInvoices(),
          storage.getQuoteSubmissions(), storage.getServiceContracts(),
          storage.getRentalContracts(), storage.getPurchaseOrders(),
        ]);
      checks.push(pass(
        "All Main Tables Queryable",
        `clients:${clients.length} workers:${workers.length} jobs:${jobs.length} invoices:${invoices.length} quotes:${quotes.length} service_contracts:${serviceContracts.length} rental_contracts:${rentalContracts.length} purchase_orders:${purchaseOrders.length}`,
      ));
    } catch (e: any) {
      checks.push(fail("All Main Tables Queryable", "One or more tables failed to query", e.message));
    }

    // 4. Orphan jobs
    try {
      const validIds = new Set(clients.map((c: any) => c.id));
      const orphanJobs = jobs.filter((j: any) => j.clientId && !validIds.has(j.clientId));
      if (orphanJobs.length === 0) checks.push(pass("No Orphan Jobs", `All ${jobs.length} jobs have valid client references`));
      else checks.push(warn("No Orphan Jobs", `${orphanJobs.length} job(s) reference a missing client`));
    } catch (e: any) { checks.push(fail("No Orphan Jobs", "Could not check", e.message)); }

    // 5. Orphan quotes
    try {
      const validIds = new Set(clients.map((c: any) => c.id));
      const orphanQuotes = quotes.filter((q: any) => q.clientId && !validIds.has(q.clientId));
      if (orphanQuotes.length === 0) checks.push(pass("No Orphan Quotes", `All linked quotes point to valid clients`));
      else checks.push(warn("No Orphan Quotes", `${orphanQuotes.length} quote(s) reference a missing client`));
    } catch (e: any) { checks.push(fail("No Orphan Quotes", "Could not check", e.message)); }

    // 6. Orphan invoices
    try {
      const validIds = new Set(clients.map((c: any) => c.id));
      const orphanInv = invoices.filter((i: any) => i.clientId && !validIds.has(i.clientId));
      if (orphanInv.length === 0) checks.push(pass("No Orphan Invoices", `All ${invoices.length} invoices have valid client references`));
      else checks.push(warn("No Orphan Invoices", `${orphanInv.length} invoice(s) reference a missing client`));
    } catch (e: any) { checks.push(fail("No Orphan Invoices", "Could not check", e.message)); }

    // 7. Orphan service contracts
    try {
      const validIds = new Set(clients.map((c: any) => c.id));
      const orphanSC = serviceContracts.filter((sc: any) => sc.clientId && !validIds.has(sc.clientId));
      if (orphanSC.length === 0) checks.push(pass("No Orphan Service Contracts", `All ${serviceContracts.length} service contracts have valid client references`));
      else checks.push(warn("No Orphan Service Contracts", `${orphanSC.length} service contract(s) reference a missing client`));
    } catch (e: any) { checks.push(fail("No Orphan Service Contracts", "Could not check", e.message)); }

    // 8. Orphan rental contracts
    try {
      const validIds = new Set(clients.map((c: any) => c.id));
      const orphanRC = rentalContracts.filter((rc: any) => rc.clientId && !validIds.has(rc.clientId));
      if (orphanRC.length === 0) checks.push(pass("No Orphan Rental Contracts", `All ${rentalContracts.length} rental contracts have valid client references`));
      else checks.push(warn("No Orphan Rental Contracts", `${orphanRC.length} rental contract(s) reference a missing client`));
    } catch (e: any) { checks.push(fail("No Orphan Rental Contracts", "Could not check", e.message)); }

    // 9a. Unified contract tables queryable
    let unifiedContractsAll: any[] = [], contractLineItemsAll: any[] = [];
    try {
      [unifiedContractsAll, contractLineItemsAll] = await Promise.all([
        (storage as any).getUnifiedContracts(),
        (storage as any).getAllContractLineItems(),
      ]);
      checks.push(pass("Unified Contracts Tables Queryable", `unified_contracts: ${unifiedContractsAll.length} rows  |  contract_line_items: ${contractLineItemsAll.length} rows`));
    } catch (e: any) {
      checks.push(fail("Unified Contracts Tables Queryable", "Could not query unified contract tables", e.message));
    }

    // 9b. Contracts missing clientId
    try {
      const validClientIds = new Set(clients.map((c: any) => c.id));
      const missingClient   = unifiedContractsAll.filter((c: any) => !c.clientId);
      const orphanContracts = unifiedContractsAll.filter((c: any) => c.clientId && !validClientIds.has(c.clientId));
      if (missingClient.length === 0 && orphanContracts.length === 0) {
        checks.push(pass("No Orphan Contracts", `All ${unifiedContractsAll.length} contracts have valid clientId references`));
      } else {
        const msgs: string[] = [];
        if (missingClient.length)   msgs.push(`${missingClient.length} contract(s) missing clientId`);
        if (orphanContracts.length) msgs.push(`${orphanContracts.length} contract(s) reference a deleted client`);
        checks.push(orphanContracts.length ? warn("No Orphan Contracts", msgs.join("; ")) : fail("No Orphan Contracts", msgs.join("; ")));
      }
    } catch (e: any) { checks.push(fail("No Orphan Contracts", "Could not check", e.message)); }

    // 9c. Contract line items integrity
    try {
      const contractIds   = new Set(unifiedContractsAll.map((c: any) => c.id));
      const validClientIds = new Set(clients.map((c: any) => c.id));
      const missingContractId = contractLineItemsAll.filter((li: any) => !li.contractId);
      const missingClientId   = contractLineItemsAll.filter((li: any) => !li.clientId);
      const orphanLines       = contractLineItemsAll.filter((li: any) => li.contractId && !contractIds.has(li.contractId));
      if (missingContractId.length === 0 && missingClientId.length === 0 && orphanLines.length === 0) {
        checks.push(pass("Contract Line Items Integrity", `All ${contractLineItemsAll.length} line items have valid contractId and clientId`));
      } else {
        const msgs: string[] = [];
        if (missingContractId.length) msgs.push(`${missingContractId.length} line item(s) missing contractId`);
        if (missingClientId.length)   msgs.push(`${missingClientId.length} line item(s) missing clientId`);
        if (orphanLines.length)       msgs.push(`${orphanLines.length} orphan line item(s) (contractId not found)`);
        checks.push(missingContractId.length ? fail("Contract Line Items Integrity", msgs.join("; ")) : warn("Contract Line Items Integrity", msgs.join("; ")));
      }
    } catch (e: any) { checks.push(fail("Contract Line Items Integrity", "Could not check", e.message)); }

    // 9d. stockItemId cross-reference integrity
    try {
      const allInvIds = new Set((await storage.getInventoryItems()).map((i: any) => i.id));
      const trackingNoStock  = contractLineItemsAll.filter((li: any) => li.stockTrackingRequired && !li.stockItemId);
      const badStockRef      = contractLineItemsAll.filter((li: any) => li.stockItemId && !allInvIds.has(li.stockItemId));
      if (trackingNoStock.length === 0 && badStockRef.length === 0) {
        const linked = contractLineItemsAll.filter((li: any) => li.stockItemId).length;
        checks.push(pass("Stock Item References", `${linked} line item(s) linked to inventory; all references valid`));
      } else {
        const msgs: string[] = [];
        if (trackingNoStock.length) msgs.push(`${trackingNoStock.length} line item(s) have stock tracking enabled but no stockItemId`);
        if (badStockRef.length)     msgs.push(`${badStockRef.length} line item(s) reference a stockItemId that does not exist in inventory`);
        checks.push(warn("Stock Item References", msgs.join("; ")));
      }
    } catch (e: any) { checks.push(fail("Stock Item References", "Could not check", e.message)); }

    // 10. No missing required columns (spot-check critical columns added during migration)
    try {
      const criticalChecks: { table: string; column: string }[] = [
        { table: "jobs",              column: "job_number" },
        { table: "jobs",              column: "linked_quote_id" },
        { table: "jobs",              column: "invoice_status" },
        { table: "invoices",          column: "linked_job_id" },
        { table: "invoices",          column: "linked_quote_id" },
        { table: "clients",           column: "sage_customer_code" },
        { table: "quote_submissions", column: "origination" },
        { table: "quote_submissions", column: "stage" },
        { table: "rental_contracts",  column: "contract_number" },
        { table: "rental_contracts",  column: "unit_price" },
        { table: "unified_contracts",   column: "contract_number" },
        { table: "unified_contracts",   column: "client_id" },
        { table: "unified_contracts",   column: "department" },
        { table: "contract_line_items", column: "contract_id" },
        { table: "contract_line_items", column: "item_service_name" },
        { table: "contract_line_items", column: "stock_item_id" },
      ];
      const colResult = await db.execute(sql`
        SELECT table_name, column_name FROM information_schema.columns
        WHERE table_schema = 'public'
          AND (table_name, column_name) IN (
            ${sql.raw(criticalChecks.map(c => `('${c.table}','${c.column}')`).join(","))}
          )
      `);
      const found = new Set(colResult.rows.map((r: any) => `${r.table_name}.${r.column_name}`));
      const missing = criticalChecks.filter(c => !found.has(`${c.table}.${c.column}`));
      if (missing.length === 0) {
        checks.push(pass("Required Columns Present", `All ${criticalChecks.length} critical columns verified in PostgreSQL`));
      } else {
        checks.push(fail("Required Columns Present",
          `${missing.length} column(s) missing: ${missing.map(c => `${c.table}.${c.column}`).join(", ")}`,
        ));
      }
    } catch (e: any) { checks.push(fail("Required Columns Present", "Could not query information_schema", e.message)); }

    // 10. Schema integrity — all key tables exist
    try {
      const requiredTables = [
        "clients", "workers", "jobs", "invoices", "invoice_items",
        "rental_contracts", "service_contracts", "quote_submissions",
        "purchase_orders", "inventory_items", "suppliers", "departments",
        "expenses", "calendar_events", "notifications",
        "unified_contracts", "contract_line_items",
      ];
      const tableResult = await db.execute(sql`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      `);
      const existingTables = new Set(tableResult.rows.map((r: any) => r.table_name));
      const missingTables = requiredTables.filter(t => !existingTables.has(t));
      if (missingTables.length === 0) {
        checks.push(pass("Schema Integrity", `All ${requiredTables.length} required tables exist in PostgreSQL`));
      } else {
        checks.push(fail("Schema Integrity",
          `${missingTables.length} table(s) missing: ${missingTables.join(", ")}`,
        ));
      }
    } catch (e: any) { checks.push(fail("Schema Integrity", "Could not query information_schema tables", e.message)); }

    // 11. Inventory / Stock Management checks
    try {
      const allInv = await storage.getInventoryItems();
      // 11a. inventory_items table has data
      if (allInv.length > 0) {
        checks.push(pass("Inventory Items Exist", `${allInv.length} stock item(s) in inventory_items table`));
      } else {
        checks.push(warn("Inventory Items Exist", "No stock items found in inventory_items table"));
      }
      // 11b. No items missing name
      const missingName = allInv.filter(i => !i.name || !i.name.trim());
      if (missingName.length === 0) {
        checks.push(pass("Inventory Names", `All ${allInv.length} items have a name`));
      } else {
        checks.push(fail("Inventory Names", `${missingName.length} item(s) missing itemName`));
      }
      // 11c. No items missing type
      const missingType = allInv.filter(i => !i.type);
      if (missingType.length === 0) {
        checks.push(pass("Inventory Types", `All items have a type value`));
      } else {
        checks.push(warn("Inventory Types", `${missingType.length} item(s) missing type`));
      }
      // 11d. Items with legacy type values (old snake_case — should be zero after migration)
      const legacyTypes = allInv.filter(i => i.type === "product" || i.type === "rental_equipment");
      if (legacyTypes.length === 0) {
        checks.push(pass("Inventory Type Values", "No legacy type values (product/rental_equipment) found"));
      } else {
        checks.push(warn("Inventory Type Values", `${legacyTypes.length} item(s) still use legacy type values — startup migration will fix on next restart`));
      }
      // 11e. Items with invalid selling price (negative)
      const badPrice = allInv.filter(i => i.sellingPrice !== null && i.sellingPrice !== undefined && Number(i.sellingPrice) < 0);
      if (badPrice.length === 0) {
        checks.push(pass("Inventory Prices", "No items with negative selling price"));
      } else {
        checks.push(warn("Inventory Prices", `${badPrice.length} item(s) have negative selling price`));
      }
      // 11f. Items with invalid quantity (negative)
      const badQty = allInv.filter(i => i.quantity < 0);
      if (badQty.length === 0) {
        checks.push(pass("Inventory Quantities", "No items with negative quantity"));
      } else {
        checks.push(warn("Inventory Quantities", `${badQty.length} item(s) have negative quantity`));
      }
    } catch (e: any) { checks.push(fail("Inventory Health", "Could not query inventory_items", e.message)); }

    const overall = checks.every(c => c.status === "passed") ? "passed"
      : checks.some(c => c.status === "failed") ? "failed"
      : "warning";

    res.json({ overall, checkedAt: new Date().toISOString(), checks });
  });

  // ── TEMPORARY: One-time production schema sync ──────────────────────────
  // Runs `drizzle-kit push` (the same command as `npm run db:push`) against
  // whatever DATABASE_URL this server is currently running with. This is a
  // manual, admin-triggered, one-time utility to bring a production database
  // schema in sync with shared/schema.ts. It does NOT run automatically on
  // startup. Remove this route once the schema has been confirmed in sync.
  // ── Normalize lead statuses — maps every legacy status value in quote_submissions
  //    to the 7 canonical LEAD_STATUSES (new/contacted/appointment_booked/
  //    quote_required/quoted/lost/converted). Safe to re-run on production.
  app.post("/api/admin/normalize-lead-statuses", requireAuth, requireAdmin, async (_req, res) => {
    try {
      const MAPPINGS: Array<{ from: string[]; to: string }> = [
        { from: ["appointment_scheduled", "appointment_set"],                to: "appointment_booked" },
        { from: ["site_assessment_done", "assessment_done", "site_done", "quote_needed"], to: "quote_required" },
        { from: ["quote_sent", "follow_up_due"],                            to: "quoted" },
        { from: ["declined"],                                               to: "lost" },
        { from: ["accepted", "won", "contract_pending", "client_registration_pending",
                 "installation_scheduled", "invoiced", "after_sales_followup",
                 "after_sales_follow_up_due", "complete", "converted_contract", "converted_job"], to: "converted" },
      ];

      let totalUpdated = 0;
      const details: string[] = [];

      for (const mapping of MAPPINGS) {
        for (const fromStatus of mapping.from) {
          const result = await db.execute(
            sql`UPDATE quote_submissions SET status = ${mapping.to} WHERE status = ${fromStatus}`
          );
          const count = (result as any).rowCount ?? (result as any).count ?? 0;
          if (count > 0) {
            details.push(`${fromStatus} → ${mapping.to}: ${count} row(s)`);
            totalUpdated += count;
          }
        }
      }

      // Report remaining non-canonical statuses (shown as Needs Review on board)
      const canonical = ["new", "contacted", "appointment_booked", "quote_required", "quoted", "lost", "converted"];
      const unknownResult = await db.execute(
        sql`SELECT status, count(*) FROM quote_submissions WHERE status NOT IN (${sql.join(canonical.map(s => sql`${s}`), sql`, `)}) GROUP BY status ORDER BY count(*) DESC`
      );
      const unknownRows = (unknownResult as any).rows ?? unknownResult;

      res.json({
        success: true,
        totalUpdated,
        details,
        unknownStatuses: unknownRows,
        message: totalUpdated === 0 && unknownRows.length === 0
          ? "All statuses are already canonical — no changes needed."
          : `Updated ${totalUpdated} row(s). ${unknownRows.length > 0 ? `${unknownRows.length} unknown status value(s) remain (shown as Needs Review).` : "All rows now use canonical statuses."}`,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/admin/run-db-push", requireAuth, requireAdmin, logActivity("admin_db_push", "database"), async (req: AuthenticatedRequest, res) => {
    try {
      const { stdout, stderr } = await execAsync("npx drizzle-kit push --force", {
        cwd: process.cwd(),
        timeout: 120_000,
        maxBuffer: 10 * 1024 * 1024,
        env: process.env,
      });
      res.json({ success: true, output: [stdout, stderr].filter(Boolean).join("\n") });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err.message,
        output: [err.stdout, err.stderr].filter(Boolean).join("\n"),
      });
    }
  });

  // ── Treatment Reports ─────────────────────────────────────────────────────

  app.get("/api/treatment-reports", async (req, res) => {
    try {
      const { clientId, jobId } = req.query;
      if (clientId) return res.json(await storage.getTreatmentReportsByClient(clientId as string));
      if (jobId)    return res.json(await storage.getTreatmentReportsByJob(jobId as string));
      return res.json(await storage.getTreatmentReports());
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/treatment-reports/:id", async (req, res) => {
    try {
      const r = await storage.getTreatmentReport(req.params.id);
      if (!r) return res.status(404).json({ message: "Not found" });
      res.json(r);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/treatment-reports", async (req, res) => {
    try {
      const parsed = insertTreatmentReportSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.errors });
      const r = await storage.createTreatmentReport(parsed.data);
      res.status(201).json(r);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.put("/api/treatment-reports/:id", async (req, res) => {
    try {
      const r = await storage.updateTreatmentReport(req.params.id, req.body);
      res.json(r);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.delete("/api/treatment-reports/:id", async (req, res) => {
    try {
      const ok = await storage.deleteTreatmentReport(req.params.id);
      ok ? res.json({ success: true }) : res.status(404).json({ message: "Not found" });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Communication Notes ───────────────────────────────────────────────────

  app.get("/api/communication-notes", async (req, res) => {
    try {
      const { clientId } = req.query;
      if (clientId) return res.json(await storage.getCommunicationNotesByClient(clientId as string));
      return res.json(await storage.getCommunicationNotes());
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/communication-notes/:id", async (req, res) => {
    try {
      const r = await storage.getCommunicationNote(req.params.id);
      if (!r) return res.status(404).json({ message: "Not found" });
      res.json(r);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/communication-notes", async (req, res) => {
    try {
      const parsed = insertCommunicationNoteSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.errors });
      const r = await storage.createCommunicationNote(parsed.data);
      res.status(201).json(r);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.put("/api/communication-notes/:id", async (req, res) => {
    try {
      const r = await storage.updateCommunicationNote(req.params.id, req.body);
      res.json(r);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.delete("/api/communication-notes/:id", async (req, res) => {
    try {
      const ok = await storage.deleteCommunicationNote(req.params.id);
      ok ? res.json({ success: true }) : res.status(404).json({ message: "Not found" });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── Accepted Quote Workflows ────────────────────────────────────────────

  app.get("/api/accepted-workflows", async (_req, res) => {
    try { res.json(await storage.getAcceptedWorkflows()); }
    catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/accepted-workflows/by-quote/:quoteId", async (req, res) => {
    try {
      const w = await storage.getAcceptedWorkflowByQuote(req.params.quoteId);
      w ? res.json(w) : res.status(404).json({ message: "Not found" });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/accepted-workflows/:id", async (req, res) => {
    try {
      const w = await storage.getAcceptedWorkflow(req.params.id);
      w ? res.json(w) : res.status(404).json({ message: "Not found" });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/accepted-workflows", async (req, res) => {
    try {
      const data = req.body as any;
      // Idempotent: don't create duplicate workflow for same quoteId
      if (data.quoteId) {
        const existing = await storage.getAcceptedWorkflowByQuote(data.quoteId);
        if (existing) { return res.json(existing); }
      }
      const w = await storage.createAcceptedWorkflow(data);
      res.status(201).json(w);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.patch("/api/accepted-workflows/:id", async (req, res) => {
    try {
      const w = await storage.updateAcceptedWorkflow(req.params.id, req.body);
      res.json(w);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.delete("/api/accepted-workflows/:id", async (req, res) => {
    try {
      const ok = await storage.deleteAcceptedWorkflow(req.params.id);
      ok ? res.json({ success: true }) : res.status(404).json({ message: "Not found" });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });


  // POST /api/admin/data-integrity/merge-clients
  app.post("/api/admin/data-integrity/merge-clients", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { masterId, duplicateIds } = req.body as { masterId: string; duplicateIds: string[] };
      if (!masterId || !Array.isArray(duplicateIds) || duplicateIds.length === 0) {
        return res.status(400).json({ error: "masterId and duplicateIds[] are required" });
      }

      const master = await storage.getClient(masterId);
      if (!master) return res.status(404).json({ error: "Master client not found" });

      const dupSet = new Set(duplicateIds);

      const [allJobs, allInvoices, allContracts, allQuotes, allServiceContracts] = await Promise.all([
        storage.getJobs(),
        storage.getInvoices(),
        storage.getRentalContracts(),
        storage.getQuoteSubmissions(),
        storage.getServiceContracts(),
      ]);

      const jobsToMove     = allJobs.filter(j  => dupSet.has(j.clientId ?? ""));
      const invoicesToMove = allInvoices.filter(i => dupSet.has(i.clientId ?? ""));
      const contractsToMove = allContracts.filter(c => dupSet.has(c.clientId ?? ""));
      const quotesToMove   = allQuotes.filter(q  => dupSet.has(q.clientId ?? ""));
      const serviceContractsToMove = allServiceContracts.filter(sc => dupSet.has(sc.clientId ?? ""));

      await Promise.all([
        ...jobsToMove.map(j  => storage.updateJob(j.id, { clientId: masterId })),
        ...invoicesToMove.map(i => storage.updateInvoice(i.id, { clientId: masterId })),
        ...contractsToMove.map(c => storage.updateRentalContract(c.id, { clientId: masterId })),
        ...quotesToMove.map(q  => storage.updateQuoteSubmission(q.id, { clientId: masterId } as any)),
        ...serviceContractsToMove.map(sc => storage.updateServiceContract(sc.id, { clientId: masterId } as any)),
      ]);

      for (const dupId of duplicateIds) {
        await storage.deleteClient(dupId);
      }

      res.json({
        success: true,
        masterId,
        masterName: master.name,
        deleted: duplicateIds.length,
        reassigned: {
          jobs:             jobsToMove.length,
          invoices:         invoicesToMove.length,
          contracts:        contractsToMove.length,
          quotes:           quotesToMove.length,
          serviceContracts: serviceContractsToMove.length,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to merge clients", details: err.message });
    }
  });

  // ── Field Diaries ─────────────────────────────────────────────────────────
  app.get("/api/field-diaries", requireAuth, async (_req, res) => {
    try { res.json(await storage.getFieldDiaries()); }
    catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.get("/api/field-diaries/job/:jobId", requireAuth, async (req, res) => {
    try { res.json(await storage.getFieldDiariesByJob(req.params.jobId)); }
    catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.get("/api/field-diaries/worker/:workerId", requireAuth, async (req, res) => {
    try { res.json(await storage.getFieldDiariesByWorker(req.params.workerId)); }
    catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.get("/api/field-diaries/:id", requireAuth, async (req, res) => {
    try {
      const d = await storage.getFieldDiary(req.params.id);
      if (!d) return res.status(404).json({ error: "Not found" });
      res.json(d);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.post("/api/field-diaries", requireAuth, async (req, res) => {
    try {
      const diaryNumber = await storage.generateFieldDiaryNumber();
      const diary = await storage.createFieldDiary({ ...req.body, diaryNumber });
      res.status(201).json(diary);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.patch("/api/field-diaries/:id", requireAuth, async (req, res) => {
    try { res.json(await storage.updateFieldDiary(req.params.id, req.body)); }
    catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.delete("/api/field-diaries/:id", requireAuth, async (req, res) => {
    try { res.json({ success: await storage.deleteFieldDiary(req.params.id) }); }
    catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── Company Settings ──────────────────────────────────────────────────────
  app.get("/api/settings/company", requireAuth, async (_req, res) => {
    try { res.json(await storage.getCompanySettings()); }
    catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.patch("/api/settings/company", requireAuth, async (req, res) => {
    try { res.json(await storage.updateCompanySettings(req.body)); }
    catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  const httpServer = createServer(app);

  // ── Backup Scheduler ─────────────────────────────────────────────────────
  // Tracks the last minute the auto-backup fired to avoid double-triggering.
  let lastScheduledRunMinute = "";

  setInterval(async () => {
    try {
      const schedule = await storage.getBackupSchedule();
      if (!schedule.enabled) return;

      const now = new Date();
      const currentHourUTC = now.getUTCHours();
      const currentMinuteUTC = now.getUTCMinutes();
      const currentDayUTC = now.getUTCDay();

      if (currentHourUTC !== schedule.hourUTC || currentMinuteUTC !== schedule.minuteUTC) return;

      const runKey = `${now.toISOString().slice(0, 16)}`; // YYYY-MM-DDTHH:MM
      if (lastScheduledRunMinute === runKey) return;

      if (schedule.frequency === "weekly" && currentDayUTC !== schedule.dayOfWeek) return;

      lastScheduledRunMinute = runKey;
      console.log(`[Backup Scheduler] Running scheduled backup at ${runKey} UTC`);
      const result = await runDailyBackupEmail("auto", schedule.recipientEmail);
      if (result.status === "failed") {
        const errMsg = result.errorMessage ?? "Unknown error";
        console.warn(`[Backup Scheduler] Backup failed — sending alert email. Error: ${errMsg}`);
        const alertResult = await sendBackupFailureAlert(errMsg);
        if (alertResult.skipped) {
          console.warn("[Backup Scheduler] Alert email was skipped (no provider configured or demo mode).");
        } else if (!alertResult.success) {
          console.error(`[Backup Scheduler] Alert email also failed: ${alertResult.error}`);
        } else {
          console.log("[Backup Scheduler] Alert email sent successfully.");
        }
        if (result.logId) {
          const alertEmailStatus = alertResult.skipped
            ? "skipped"
            : alertResult.success
              ? "success"
              : "failed";
          await storage.updateBackupLog(result.logId, {
            alertEmailStatus,
            alertEmailError: alertResult.success ? undefined : alertResult.error,
          });
        }
      }
    } catch (err: any) {
      console.error("[Backup Scheduler] Error:", err?.message ?? err);
    }
  }, 60_000);

  // ═══════════════════════════════════════════════════════════════════════════
  // STOCK MANAGEMENT ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  // Seed default locations on first hit
  (storage as any).seedDefaultStockLocations?.();

  // ── Stock Locations ────────────────────────────────────────────────────────
  app.get("/api/stock-locations", async (_req, res) => {
    try { res.json(await (storage as any).getStockLocations()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.post("/api/stock-locations", async (req, res) => {
    try { res.status(201).json(await (storage as any).createStockLocation(req.body)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.put("/api/stock-locations/:id", async (req, res) => {
    try { res.json(await (storage as any).updateStockLocation(req.params.id, req.body)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.delete("/api/stock-locations/:id", async (req, res) => {
    try {
      const ok = await (storage as any).deleteStockLocation(req.params.id);
      res.json({ success: ok });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Stock Balances ──────────────────────────────────────────────────────────
  app.get("/api/stock-balances", async (req, res) => {
    try {
      const { stockItemId, locationId } = req.query as Record<string, string>;
      let data;
      if (stockItemId) data = await (storage as any).getStockBalancesByItem(stockItemId);
      else if (locationId) data = await (storage as any).getStockBalancesByLocation(locationId);
      else data = await (storage as any).getStockBalances();
      res.json(data);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Stock Movements ─────────────────────────────────────────────────────────
  app.get("/api/stock-movements", async (req, res) => {
    try {
      const { stockItemId, jobId, clientId, technicianId, locationId } = req.query as Record<string, string>;
      const filters = { stockItemId, jobId, clientId, technicianId, locationId };
      res.json(await (storage as any).getStockMovements(filters));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.post("/api/stock-movements", async (req, res) => {
    try { res.status(201).json(await (storage as any).createStockMovement(req.body)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Transfer between locations (helper endpoint)
  app.post("/api/stock-transfers", async (req, res) => {
    try {
      const { stockItemId, stockItemName, fromLocationId, fromLocationName, toLocationId, toLocationName, quantity, unitOfMeasure, notes, createdBy } = req.body;
      const movement = await (storage as any).createStockMovement({
        stockItemId, stockItemName,
        movementType: "Transferred Between Locations",
        fromLocationId, fromLocationName,
        toLocationId, toLocationName,
        quantity, unitOfMeasure, notes,
        createdBy: createdBy ?? "System",
      });
      res.status(201).json(movement);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Picking Lists ───────────────────────────────────────────────────────────
  app.get("/api/picking-lists", async (_req, res) => {
    try { res.json(await (storage as any).getPickingLists()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.get("/api/picking-lists/:id", async (req, res) => {
    try {
      const pl = await (storage as any).getPickingList(req.params.id);
      if (!pl) return res.status(404).json({ error: "Not found" });
      res.json(pl);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.post("/api/picking-lists", async (req, res) => {
    try { res.status(201).json(await (storage as any).createPickingList(req.body)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.put("/api/picking-lists/:id", async (req, res) => {
    try { res.json(await (storage as any).updatePickingList(req.params.id, req.body)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.delete("/api/picking-lists/:id", async (req, res) => {
    try { res.json({ success: await (storage as any).deletePickingList(req.params.id) }); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.post("/api/picking-lists/:id/issue", async (req, res) => {
    try {
      const updated = await (storage as any).issuePickingList(req.params.id, req.body.issuedBy ?? "System");
      res.json(updated);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.get("/api/picking-lists/:id/items", async (req, res) => {
    try { res.json(await (storage as any).getPickingListItems(req.params.id)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.post("/api/picking-lists/:id/items", async (req, res) => {
    try { res.status(201).json(await (storage as any).upsertPickingListItem({ ...req.body, pickingListId: req.params.id })); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.put("/api/picking-lists/:id/items/:itemId", async (req, res) => {
    try { res.json(await (storage as any).updatePickingListItem(req.params.itemId, req.body)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.delete("/api/picking-lists/:id/items/:itemId", async (req, res) => {
    try { res.json({ success: await (storage as any).deletePickingListItem(req.params.itemId) }); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Stock Checks ────────────────────────────────────────────────────────────
  app.get("/api/stock-checks", async (_req, res) => {
    try { res.json(await (storage as any).getStockChecks()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.get("/api/stock-checks/:id", async (req, res) => {
    try {
      const sc = await (storage as any).getStockCheck(req.params.id);
      if (!sc) return res.status(404).json({ error: "Not found" });
      res.json(sc);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.post("/api/stock-checks", async (req, res) => {
    try { res.status(201).json(await (storage as any).createStockCheck(req.body)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.put("/api/stock-checks/:id", async (req, res) => {
    try { res.json(await (storage as any).updateStockCheck(req.params.id, req.body)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.post("/api/stock-checks/:id/approve", async (req, res) => {
    try {
      const updated = await (storage as any).approveStockCheck(req.params.id, req.body.approvedBy ?? "System");
      res.json(updated);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.get("/api/stock-checks/:id/items", async (req, res) => {
    try { res.json(await (storage as any).getStockCheckItems(req.params.id)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.post("/api/stock-checks/:id/items", async (req, res) => {
    try { res.status(201).json(await (storage as any).upsertStockCheckItem({ ...req.body, stockCheckId: req.params.id })); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.put("/api/stock-checks/:id/items/:itemId", async (req, res) => {
    try { res.json(await (storage as any).updateStockCheckItem(req.params.itemId, req.body)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Purchase Order Receive ──────────────────────────────────────────────────
  app.post("/api/purchase-orders/:id/receive", async (req, res) => {
    try {
      const { receivedItems, locationId, locationName, receivedBy } = req.body as {
        receivedItems: { itemId: string; quantityReceived: number }[];
        locationId: string;
        locationName: string;
        receivedBy: string;
      };
      const po = await storage.getPurchaseOrder(req.params.id);
      if (!po) return res.status(404).json({ error: "PO not found" });
      const poItems = await storage.getPurchaseOrderItems(po.id);
      const allInventory = await storage.getInventoryItems();
      for (const ri of receivedItems) {
        if (ri.quantityReceived <= 0) continue;
        const poItem = poItems.find(p => p.id === ri.itemId);
        if (!poItem) continue;
        const invItem = allInventory.find(i => i.id === poItem.inventoryItemId);
        // Update PO item received qty
        await (storage as any).updatePurchaseOrderItem?.(poItem.id, { quantityReceived: ri.quantityReceived });
        // Update master inventory quantity
        await storage.updateInventoryQuantity(poItem.inventoryItemId, (invItem ? invItem.quantity : 0) + ri.quantityReceived);
        // Create stock movement
        await (storage as any).createStockMovement({
          stockItemId: poItem.inventoryItemId,
          stockItemName: invItem?.name ?? poItem.itemName ?? "Unknown",
          movementType: "Received from Supplier",
          toLocationId: locationId,
          toLocationName: locationName,
          quantity: String(ri.quantityReceived),
          unitOfMeasure: invItem?.unitOfMeasure ?? "units",
          purchaseOrderId: po.id,
          notes: `Received on PO ${po.poNumber}`,
          createdBy: receivedBy ?? "System",
        });
      }
      // Mark PO as received if all items received
      const updatedPO = await storage.updatePurchaseOrder(po.id, { status: "received", deliveryDate: new Date() });
      res.json(updatedPO);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Job Inventory — client stock usage ─────────────────────────────────────
  app.get("/api/job-inventory/by-client/:clientId", async (req, res) => {
    try { res.json(await (storage as any).getJobInventoryItemsByClient(req.params.clientId)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Unified Contracts ───────────────────────────────────────────────────────
  app.get("/api/unified-contracts", async (req, res) => {
    try {
      const { clientId } = req.query;
      const contracts = clientId
        ? await (storage as any).getUnifiedContractsByClient(String(clientId))
        : await (storage as any).getUnifiedContracts();
      const withLineItems = await Promise.all(
        contracts.map(async (c: any) => ({
          ...c,
          lineItems: await (storage as any).getContractLineItems(c.id),
        }))
      );
      res.json(withLineItems);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/unified-contracts/:id", async (req, res) => {
    try {
      const row = await (storage as any).getUnifiedContract(req.params.id);
      if (!row) return res.status(404).json({ error: "Not found" });
      res.json(row);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/unified-contracts", async (req, res) => {
    try {
      const { lineItems, ...contractData } = req.body;
      const contract = await (storage as any).createUnifiedContract(contractData);
      if (Array.isArray(lineItems) && lineItems.length > 0) {
        await (storage as any).replaceContractLineItems(contract.id, contract.clientId, lineItems);
      }
      const items = await (storage as any).getContractLineItems(contract.id);
      res.status(201).json({ ...contract, lineItems: items });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.put("/api/unified-contracts/:id", async (req, res) => {
    try {
      const { lineItems, ...contractData } = req.body;
      const contract = await (storage as any).updateUnifiedContract(req.params.id, contractData);
      if (Array.isArray(lineItems)) {
        await (storage as any).replaceContractLineItems(contract.id, contract.clientId, lineItems);
      }
      const items = await (storage as any).getContractLineItems(contract.id);
      res.json({ ...contract, lineItems: items });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/unified-contracts/:id", async (req, res) => {
    try {
      await (storage as any).deleteUnifiedContract(req.params.id);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Contract Line Items ─────────────────────────────────────────────────────
  app.get("/api/unified-contracts/:id/line-items", async (req, res) => {
    try { res.json(await (storage as any).getContractLineItems(req.params.id)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Department Defaults ─────────────────────────────────────────────────────
  app.get("/api/department-defaults", async (_req, res) => {
    try { res.json(await (storage as any).getDepartmentDefaults()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/department-defaults/:department", async (req, res) => {
    try {
      const row = await (storage as any).getDepartmentDefault(decodeURIComponent(req.params.department));
      res.json(row ?? null);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.put("/api/department-defaults/:department", async (req, res) => {
    try {
      const row = await (storage as any).upsertDepartmentDefault(decodeURIComponent(req.params.department), req.body);
      res.json(row);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Legal Entities ──────────────────────────────────────────────────────────

  app.get("/api/legal-entities", async (_req, res) => {
    try { res.json(await storage.getLegalEntities()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/legal-entities/:id", async (req, res) => {
    try {
      const entity = await storage.getLegalEntity(req.params.id);
      if (!entity) return res.status(404).json({ error: "Not found" });
      res.json(entity);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/legal-entities", async (req, res) => {
    try {
      const data = insertLegalEntitySchema.parse(req.body);
      res.status(201).json(await storage.createLegalEntity(data));
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.put("/api/legal-entities/:id", async (req, res) => {
    try {
      const entity = await storage.updateLegalEntity(req.params.id, req.body);
      res.json(entity);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  return httpServer;
}
