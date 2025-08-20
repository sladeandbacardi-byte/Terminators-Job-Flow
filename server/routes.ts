import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertDivisionSchema, insertWorkerSchema, insertClientSchema,
  insertInventoryItemSchema, insertRentalContractSchema, insertJobSchema,
  insertInvoiceSchema, insertInvoiceItemSchema,
  insertNotificationSchema, insertEmailTemplateSchema, insertEmailLogSchema,
  insertJobInventoryItemSchema, insertSupplierSchema,
  insertPurchaseOrderSchema, insertPurchaseOrderItemSchema
} from "@shared/schema";
import { z } from "zod";
import { sendEmail, generatePurchaseOrderEmail, generateApprovalNotificationEmail } from "./email-service";
import { createSageService } from "./sage-integration";
import { AuthService, requireAuth, logActivity, type AuthenticatedRequest } from "./auth-service";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }

      const authResult = await AuthService.authenticateUser(username, password);
      
      if (!authResult) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      // Log successful login
      await AuthService.logActivity({
        userId: authResult.user.id,
        action: "login",
        details: "User logged in successfully",
        ipAddress: req.ip || req.connection.remoteAddress || null,
        userAgent: req.headers['user-agent'] || null,
      });

      res.json({
        token: authResult.token,
        user: {
          id: authResult.user.id,
          username: authResult.user.username,
          email: authResult.user.email,
          firstName: authResult.user.firstName,
          lastName: authResult.user.lastName,
          role: authResult.user.role,
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
          divisionId: worker.divisionId,
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
  app.get("/api/divisions", async (req, res) => {
    const divisions = await storage.getDivisions();
    res.json(divisions);
  });

  app.post("/api/divisions", async (req, res) => {
    try {
      const division = insertDivisionSchema.parse(req.body);
      const created = await storage.createDivision(division);
      res.status(201).json(created);
    } catch (error) {
      res.status(400).json({ error: "Invalid division data" });
    }
  });

  // Workers
  app.get("/api/workers", async (req, res) => {
    const { divisionId } = req.query;
    if (divisionId) {
      const workers = await storage.getWorkersByDivision(divisionId as string);
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
      const client = insertClientSchema.parse(req.body);
      const created = await storage.createClient(client);
      res.status(201).json(created);
    } catch (error) {
      res.status(400).json({ error: "Invalid client data" });
    }
  });

  app.put("/api/clients/:id", async (req, res) => {
    try {
      const updateData = insertClientSchema.partial().parse(req.body);
      const updated = await storage.updateClient(req.params.id, updateData);
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Invalid client data" });
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
    const { type, divisionId } = req.query;
    let items;
    
    if (type) {
      items = await storage.getInventoryItemsByType(type as string);
    } else if (divisionId) {
      items = await storage.getInventoryItemsByDivision(divisionId as string);
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
      const contract = insertRentalContractSchema.parse(req.body);
      const created = await storage.createRentalContract(contract);
      res.status(201).json(created);
    } catch (error) {
      res.status(400).json({ error: "Invalid rental contract data" });
    }
  });

  app.put("/api/contracts/:id", async (req, res) => {
    try {
      const updateData = insertRentalContractSchema.partial().parse(req.body);
      const updated = await storage.updateRentalContract(req.params.id, updateData);
      res.json(updated);
    } catch (error) {
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
    const { workerId, divisionId, status, date, today } = req.query;
    let jobs;
    
    if (today === "true") {
      jobs = await storage.getTodaysJobs();
    } else if (workerId) {
      jobs = await storage.getJobsByWorker(workerId as string);
    } else if (divisionId) {
      jobs = await storage.getJobsByDivision(divisionId as string);
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
      const job = insertJobSchema.parse(req.body);
      const created = await storage.createJob(job);
      res.status(201).json(created);
    } catch (error) {
      res.status(400).json({ error: "Invalid job data" });
    }
  });

  app.put("/api/jobs/:id", async (req, res) => {
    try {
      const updateData = insertJobSchema.partial().parse(req.body);
      const updated = await storage.updateJob(req.params.id, updateData);
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Invalid job data" });
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

  app.post("/api/invoices", async (req, res) => {
    try {
      const invoice = insertInvoiceSchema.parse(req.body);
      const created = await storage.createInvoice(invoice);
      res.status(201).json(created);
    } catch (error) {
      res.status(400).json({ error: "Invalid invoice data" });
    }
  });

  app.put("/api/invoices/:id", async (req, res) => {
    try {
      const updateData = insertInvoiceSchema.partial().parse(req.body);
      const updated = await storage.updateInvoice(req.params.id, updateData);
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Invalid invoice data" });
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
      // Return empty array for now - calendar events will be derived from jobs
      // In a real implementation, you might have a separate events table
      res.json([]);
    } catch (error) {
      console.error("Error fetching calendar events:", error);
      res.status(500).json({ message: "Failed to fetch calendar events" });
    }
  });

  // Dashboard Analytics
  app.get("/api/dashboard/metrics", async (req, res) => {
    try {
      const [activeJobs, allWorkers, expiringContracts, allJobs, divisions] = await Promise.all([
        storage.getJobsByStatus('in_progress'),
        storage.getWorkers(),
        storage.getExpiringContracts(30),
        storage.getJobs(),
        storage.getDivisions()
      ]);

      const activeWorkers = allWorkers.filter(w => w.isActive);
      const completedJobsThisMonth = allJobs.filter(job => {
        const jobDate = new Date(job.createdAt);
        const now = new Date();
        return job.status === 'completed' && 
               jobDate.getMonth() === now.getMonth() &&
               jobDate.getFullYear() === now.getFullYear();
      });

      // Calculate division performance
      const divisionStats = await Promise.all(divisions.map(async (division) => {
        const [todayJobs, workers] = await Promise.all([
          storage.getJobsByDivision(division.id),
          storage.getWorkersByDivision(division.id)
        ]);

        const todayJobsFiltered = todayJobs.filter(job => {
          const jobDate = new Date(job.scheduledDate);
          const today = new Date();
          return jobDate.toDateString() === today.toDateString();
        });

        return {
          division,
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
        divisions: divisionStats
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

  const httpServer = createServer(app);
  return httpServer;
}
