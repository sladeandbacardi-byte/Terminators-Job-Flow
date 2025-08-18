import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertDivisionSchema, insertWorkerSchema, insertClientSchema,
  insertInventoryItemSchema, insertRentalContractSchema, insertJobSchema,
  insertInvoiceSchema, insertInvoiceItemSchema,
  insertNotificationSchema
} from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  
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

  const httpServer = createServer(app);
  return httpServer;
}
