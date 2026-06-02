import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { runDailyBackupEmail, getBackupEmailConfig } from "./email-backup";
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
} from "@shared/schema";
import { z } from "zod";
import { sendEmail, generatePurchaseOrderEmail, generateApprovalNotificationEmail } from "./email-service";
import { createSageService } from "./sage-integration";
import { AuthService, requireAuth, logActivity, type AuthenticatedRequest } from "./auth-service";
import multer from "multer";
import * as XLSX from "xlsx";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }

      // Get the worker/user by ID
      const worker = await storage.getWorker(userId);
      
      if (!worker) {
        return res.status(401).json({ message: "User not found" });
      }

      // Generate a simple token (for now just use the user ID)
      const token = `token_${worker.id}_${Date.now()}`;

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
      res.json(workers);
    } else {
      const workers = await storage.getWorkers();
      res.json(workers);
    }
  });

  app.get("/api/workers/:id", async (req, res) => {
    const worker = await storage.getWorker(req.params.id);
    if (!worker) {
      return res.status(404).json({ error: "Worker not found" });
    }
    res.json(worker);
  });

  app.post("/api/workers", async (req, res) => {
    try {
      const worker = insertWorkerSchema.parse(req.body);
      const created = await storage.createWorker(worker);
      res.status(201).json(created);
    } catch (error) {
      res.status(400).json({ error: "Invalid worker data" });
    }
  });

  app.put("/api/workers/:id", async (req, res) => {
    try {
      const updateData = insertWorkerSchema.partial().parse(req.body);
      const updated = await storage.updateWorker(req.params.id, updateData);
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Invalid worker data" });
    }
  });

  app.delete("/api/workers/:id", async (req, res) => {
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

  app.delete("/api/clients/:id", async (req, res) => {
    const deleted = await storage.deleteClient(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Client not found" });
    }
    res.status(204).send();
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
      const item = insertInventoryItemSchema.parse(req.body);
      const created = await storage.createInventoryItem(item);
      res.status(201).json(created);
    } catch (error) {
      res.status(400).json({ error: "Invalid inventory item data" });
    }
  });

  app.put("/api/inventory/:id", async (req, res) => {
    try {
      const updateData = insertInventoryItemSchema.partial().parse(req.body);
      const updated = await storage.updateInventoryItem(req.params.id, updateData);
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Invalid inventory item data" });
    }
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
        startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
        endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
        lastPriceIncrease: req.body.lastPriceIncrease ? new Date(req.body.lastPriceIncrease) : undefined,
      };
      const contract = insertRentalContractSchema.parse(data);
      const created = await storage.createRentalContract(contract);
      res.status(201).json(created);
    } catch (error) {
      console.error("Contract creation error:", error);
      res.status(400).json({ error: "Invalid rental contract data" });
    }
  });

  app.put("/api/contracts/:id", async (req, res) => {
    try {
      const data = {
        ...req.body,
        startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
        endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
        lastPriceIncrease: req.body.lastPriceIncrease ? new Date(req.body.lastPriceIncrease) : undefined,
      };
      const updateData = insertRentalContractSchema.partial().parse(data);
      const updated = await storage.updateRentalContract(req.params.id, updateData);
      res.json(updated);
    } catch (error) {
      console.error("Contract update error:", error);
      res.status(400).json({ error: "Invalid rental contract data" });
    }
  });

  app.delete("/api/contracts/:id", async (req, res) => {
    const deleted = await storage.deleteRentalContract(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Rental contract not found" });
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
      const submissionData = insertQuoteSubmissionSchema.parse({ ...req.body, origination: req.body?.origination ?? "website" });
      const submission = await storage.createQuoteSubmission(submissionData);
      res.status(201).json(submission);
    } catch (error: any) {
      res.status(400).json({ error: "Failed to create lead", details: error.message });
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
      const updateData = insertQuoteSubmissionSchema.partial().parse(req.body);
      const updated = await storage.updateQuoteSubmission(req.params.id, updateData);
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid update data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update quote submission" });
    }
  });

  // ── Convert quote to a job (atomic: create job + mark quote "converted") ──
  app.post("/api/quote-submissions/:id/convert-to-job", async (req, res) => {
    try {
      const quote = await storage.getQuoteSubmission(req.params.id);
      if (!quote) return res.status(404).json({ error: "Quote not found" });
      if (quote.status === "converted") return res.status(409).json({ error: "Quote is already converted" });

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
      });

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
      if (quote.status === "converted") return res.status(409).json({ error: "Quote is already converted" });

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
        customerId: clientId,
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

      // ── 3. Quotes ───────────────────────────────────────────────────────────
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
      const data = insertSalesAppointmentSchema.parse(req.body);
      const appt = await storage.createSalesAppointment(data);
      res.status(201).json(appt);
    } catch (err: any) {
      res.status(400).json({ error: "Failed to create appointment", details: err.message });
    }
  });

  app.patch("/api/sales-appointments/:id", async (req, res) => {
    try {
      const appt = await storage.updateSalesAppointment(req.params.id, req.body);
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

  const httpServer = createServer(app);
  return httpServer;
}
