import { 
  type User, type InsertUser,
  type Division, type InsertDivision,
  type Worker, type InsertWorker,
  type Client, type InsertClient,
  type InventoryItem, type InsertInventoryItem,
  type RentalContract, type InsertRentalContract,
  type Job, type InsertJob,
  type Invoice, type InsertInvoice,
  type InvoiceItem, type InsertInvoiceItem,
  type Notification, type InsertNotification,
  type EmailTemplate, type InsertEmailTemplate,
  type EmailLog, type InsertEmailLog,
  type JobInventoryItem, type InsertJobInventoryItem
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Divisions
  getDivisions(): Promise<Division[]>;
  getDivision(id: string): Promise<Division | undefined>;
  createDivision(division: InsertDivision): Promise<Division>;

  // Workers
  getWorkers(): Promise<Worker[]>;
  getWorker(id: string): Promise<Worker | undefined>;
  getWorkersByDivision(divisionId: string): Promise<Worker[]>;
  createWorker(worker: InsertWorker): Promise<Worker>;
  updateWorker(id: string, worker: Partial<InsertWorker>): Promise<Worker>;
  deleteWorker(id: string): Promise<boolean>;

  // Clients
  getClients(): Promise<Client[]>;
  getClient(id: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, client: Partial<InsertClient>): Promise<Client>;
  deleteClient(id: string): Promise<boolean>;

  // Inventory Items
  getInventoryItems(): Promise<InventoryItem[]>;
  getInventoryItem(id: string): Promise<InventoryItem | undefined>;
  getInventoryItemsByType(type: string): Promise<InventoryItem[]>;
  getInventoryItemsByDivision(divisionId: string): Promise<InventoryItem[]>;
  createInventoryItem(item: InsertInventoryItem): Promise<InventoryItem>;
  updateInventoryItem(id: string, item: Partial<InsertInventoryItem>): Promise<InventoryItem>;
  deleteInventoryItem(id: string): Promise<boolean>;

  // Rental Contracts
  getRentalContracts(): Promise<RentalContract[]>;
  getRentalContract(id: string): Promise<RentalContract | undefined>;
  getActiveRentalContracts(): Promise<RentalContract[]>;
  getExpiringContracts(days: number): Promise<RentalContract[]>;
  createRentalContract(contract: InsertRentalContract): Promise<RentalContract>;
  updateRentalContract(id: string, contract: Partial<InsertRentalContract>): Promise<RentalContract>;
  deleteRentalContract(id: string): Promise<boolean>;

  // Jobs
  getJobs(): Promise<Job[]>;
  getJob(id: string): Promise<Job | undefined>;
  getJobsByWorker(workerId: string): Promise<Job[]>;
  getJobsByDivision(divisionId: string): Promise<Job[]>;
  getJobsByStatus(status: string): Promise<Job[]>;
  getJobsByDateRange(startDate: Date, endDate: Date): Promise<Job[]>;
  getTodaysJobs(): Promise<Job[]>;
  createJob(job: InsertJob): Promise<Job>;
  updateJob(id: string, job: Partial<InsertJob>): Promise<Job>;
  deleteJob(id: string): Promise<boolean>;

  // Invoices
  getInvoices(): Promise<Invoice[]>;
  getInvoice(id: string): Promise<Invoice | undefined>;
  getInvoicesByClient(clientId: string): Promise<Invoice[]>;
  getInvoicesByStatus(status: string): Promise<Invoice[]>;
  getOverdueInvoices(): Promise<Invoice[]>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: string, invoice: Partial<InsertInvoice>): Promise<Invoice>;
  deleteInvoice(id: string): Promise<boolean>;
  generateInvoiceNumber(): Promise<string>;

  // Invoice Items
  getInvoiceItems(invoiceId: string): Promise<InvoiceItem[]>;
  createInvoiceItem(item: InsertInvoiceItem): Promise<InvoiceItem>;
  updateInvoiceItem(id: string, item: Partial<InsertInvoiceItem>): Promise<InvoiceItem>;
  deleteInvoiceItem(id: string): Promise<boolean>;

  // Notifications
  getNotifications(): Promise<Notification[]>;
  getNotification(id: string): Promise<Notification | undefined>;
  getUnreadNotifications(): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: string): Promise<boolean>;
  deleteNotification(id: string): Promise<boolean>;

  // Email Templates
  getEmailTemplates(): Promise<EmailTemplate[]>;
  getEmailTemplate(id: string): Promise<EmailTemplate | undefined>;
  getEmailTemplatesByType(type: string): Promise<EmailTemplate[]>;
  createEmailTemplate(template: InsertEmailTemplate): Promise<EmailTemplate>;
  updateEmailTemplate(id: string, template: Partial<InsertEmailTemplate>): Promise<EmailTemplate>;
  deleteEmailTemplate(id: string): Promise<boolean>;

  // Email Logs
  getEmailLogs(): Promise<EmailLog[]>;
  getEmailLog(id: string): Promise<EmailLog | undefined>;
  getEmailLogsByStatus(status: string): Promise<EmailLog[]>;
  createEmailLog(log: InsertEmailLog): Promise<EmailLog>;
  updateEmailLog(id: string, log: Partial<InsertEmailLog>): Promise<EmailLog>;

  // Job Inventory Items
  getJobInventoryItems(): Promise<JobInventoryItem[]>;
  getJobInventoryItem(id: string): Promise<JobInventoryItem | undefined>;
  getJobInventoryItemsByJob(jobId: string): Promise<JobInventoryItem[]>;
  createJobInventoryItem(item: InsertJobInventoryItem): Promise<JobInventoryItem>;
  updateJobInventoryItem(id: string, item: Partial<InsertJobInventoryItem>): Promise<JobInventoryItem>;
  deleteJobInventoryItem(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private divisions: Map<string, Division> = new Map();
  private workers: Map<string, Worker> = new Map();
  private clients: Map<string, Client> = new Map();
  private inventoryItems: Map<string, InventoryItem> = new Map();
  private rentalContracts: Map<string, RentalContract> = new Map();
  private jobs: Map<string, Job> = new Map();
  private invoices: Map<string, Invoice> = new Map();
  private invoiceItems: Map<string, InvoiceItem> = new Map();
  private notifications: Map<string, Notification> = new Map();
  private emailTemplates: Map<string, EmailTemplate> = new Map();
  private emailLogs: Map<string, EmailLog> = new Map();
  private jobInventoryItems: Map<string, JobInventoryItem> = new Map();
  private invoiceCounter: number = 1;

  constructor() {
    this.initializeData();
  }

  private initializeData() {
    // Create divisions
    const pestControlDivision: Division = {
      id: "div-1",
      name: "Pest Control",
      colorCode: "#22c55e",
      description: "Professional pest control services"
    };

    const hygieneDivision: Division = {
      id: "div-2", 
      name: "Hygiene Services",
      colorCode: "#f97316",
      description: "Commercial hygiene and sanitization services"
    };

    this.divisions.set(pestControlDivision.id, pestControlDivision);
    this.divisions.set(hygieneDivision.id, hygieneDivision);

    // Create sample workers
    const workers = [
      { name: "John Smith", email: "john@terminators.co.za", phone: "+27 41 123 4567", divisionId: "div-1" },
      { name: "Sarah Williams", email: "sarah@terminators.co.za", phone: "+27 41 123 4568", divisionId: "div-2" },
      { name: "David Brown", email: "david@terminators.co.za", phone: "+27 41 123 4569", divisionId: "div-1" },
      { name: "Lisa Johnson", email: "lisa@terminators.co.za", phone: "+27 41 123 4570", divisionId: "div-2" },
      { name: "Mike Johnson", email: "mike@terminators.co.za", phone: "+27 41 123 4571", divisionId: "div-1" },
      { name: "Emma Davis", email: "emma@terminators.co.za", phone: "+27 41 123 4572", divisionId: "div-2" },
      { name: "James Wilson", email: "james@terminators.co.za", phone: "+27 41 123 4573", divisionId: "div-1" },
      { name: "Rachel Green", email: "rachel@terminators.co.za", phone: "+27 41 123 4574", divisionId: "div-2" }
    ];

    workers.forEach((worker, index) => {
      const w: Worker = {
        id: `worker-${index + 1}`,
        ...worker,
        isActive: true,
        createdAt: new Date()
      };
      this.workers.set(w.id, w);
    });

    // Create sample clients
    const clients = [
      { name: "Pick n Pay Greenacres", address: "Greenacres Shopping Centre, Port Elizabeth", phone: "+27 41 234 5678", email: "manager@pnp-greenacres.co.za" },
      { name: "Shoprite Checkers", address: "Walmer Park Shopping Centre, Port Elizabeth", phone: "+27 41 234 5679", email: "admin@shoprite.co.za" },
      { name: "Baywest Mall", address: "Baywest City, Port Elizabeth", phone: "+27 41 234 5680", email: "facilities@baywest.co.za" },
      { name: "Boardwalk Casino", address: "Marine Drive, Summerstrand, Port Elizabeth", phone: "+27 41 234 5681", email: "maintenance@boardwalk.co.za" }
    ];

    clients.forEach((client, index) => {
      const c: Client = {
        id: `client-${index + 1}`,
        ...client,
        createdAt: new Date()
      };
      this.clients.set(c.id, c);
    });

    // Create sample inventory items with stock level settings
    const inventoryItems = [
      {
        name: "Paper Towel Dispenser - Wall Mount",
        type: "rental_equipment",
        sku: "PTD-WM-001",
        quantity: 15,
        minStockLevel: 10,
        maxStockLevel: 100,
        reorderPoint: 20,
        unitPrice: "149.99",
        description: "Professional wall-mounted paper towel dispenser, lockable design",
        divisionId: "div-2",
        location: "Main Warehouse - Shelf A3",
        supplier: "HygieneTech Solutions",
        lastRestocked: new Date('2025-08-10')
      },
      {
        name: "Paper Roll Refill - Premium",
        type: "product",
        sku: "PRR-PREM-001", 
        quantity: 8,
        minStockLevel: 15,
        maxStockLevel: 500,
        reorderPoint: 25,
        unitPrice: "12.50",
        description: "High-quality paper towel rolls for dispensers, 200m per roll",
        divisionId: "div-2",
        location: "Main Warehouse - Shelf B2",
        supplier: "PaperCorp Industries",
        lastRestocked: new Date('2025-08-05')
      },
      {
        name: "Hand Sanitizer Dispenser - Automatic",
        type: "rental_equipment",
        sku: "HSD-AUTO-001",
        quantity: 30,
        minStockLevel: 5,
        maxStockLevel: 50,
        reorderPoint: 10,
        unitPrice: "199.99",
        description: "Touchless automatic hand sanitizer dispenser with sensor",
        divisionId: "div-2",
        location: "Main Warehouse - Shelf A1",
        supplier: "HygieneTech Solutions",
        lastRestocked: new Date('2025-08-12')
      },
      {
        name: "Hand Sanitizer Refill - 1L",
        type: "product",
        sku: "HSR-1L-001",
        quantity: 3,
        minStockLevel: 20,
        maxStockLevel: 200,
        reorderPoint: 30,
        unitPrice: "35.00",
        description: "Premium hand sanitizer refill, alcohol-based formula",
        divisionId: "div-2",
        location: "Storage Room B - Shelf 1",
        supplier: "ChemiClean Supplies",
        lastRestocked: new Date('2025-07-28')
      },
      {
        name: "Pest Control Bait Station",
        type: "rental_equipment", 
        sku: "PCB-STAT-001",
        quantity: 25,
        minStockLevel: 8,
        maxStockLevel: 80,
        reorderPoint: 15,
        unitPrice: "89.99",
        description: "Tamper-resistant bait station for rodent control",
        divisionId: "div-1",
        location: "Pest Control Storage - Rack C",
        supplier: "PestTech Professional",
        lastRestocked: new Date('2025-08-14')
      },
      {
        name: "Pest Control Bait - Rodenticide",
        type: "product",
        sku: "PCB-ROD-001",
        quantity: 5,
        minStockLevel: 12,
        maxStockLevel: 150,
        reorderPoint: 20,
        unitPrice: "25.00",
        description: "Professional rodenticide bait blocks",
        divisionId: "div-1",
        location: "Secure Storage - Locked Cabinet A",
        supplier: "ToxiGuard Solutions",
        lastRestocked: new Date('2025-08-01')
      }
    ];

    inventoryItems.forEach((item, index) => {
      const inv: InventoryItem = {
        id: `inv-${index + 1}`,
        ...item,
        createdAt: new Date()
      };
      this.inventoryItems.set(inv.id, inv);
    });

    // Create sample invoices
    const invoices = [
      {
        clientId: "client-1",
        status: "sent",
        issueDate: new Date('2025-08-01'),
        dueDate: new Date('2025-08-31'),
        subtotal: "850.00",
        taxAmount: "127.50",
        total: "977.50",
        paidAmount: "0.00",
        notes: "Monthly pest control service for August 2025",
        terms: "Payment due within 30 days"
      },
      {
        clientId: "client-2",
        status: "paid",
        issueDate: new Date('2025-07-01'),
        dueDate: new Date('2025-07-31'),
        paymentDate: new Date('2025-07-28'),
        subtotal: "1200.00",
        taxAmount: "180.00",
        total: "1380.00",
        paidAmount: "1380.00",
        notes: "Monthly hygiene service for July 2025",
        terms: "Payment due within 30 days"
      },
      {
        clientId: "client-3",
        status: "overdue",
        issueDate: new Date('2025-06-01'),
        dueDate: new Date('2025-06-30'),
        subtotal: "2500.00",
        taxAmount: "375.00",
        total: "2875.00",
        paidAmount: "0.00",
        notes: "Quarterly sanitization service",
        terms: "Payment due within 30 days"
      }
    ];

    for (let i = 0; i < invoices.length; i++) {
      const invoice = invoices[i];
      const invoiceId = `invoice-${i + 1}`;
      const invoiceNumber = `INV-2025-${String(i + 1).padStart(4, '0')}`;
      
      const inv: Invoice = {
        id: invoiceId,
        invoiceNumber,
        ...invoice,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      this.invoices.set(invoiceId, inv);

      // Add invoice items
      if (i === 0) {
        // Pest control invoice items
        const items = [
          { description: "Monthly Pest Control - Interior", quantity: "1", unitPrice: "450.00", total: "450.00" },
          { description: "Monthly Pest Control - Exterior", quantity: "1", unitPrice: "400.00", total: "400.00" }
        ];
        items.forEach((item, itemIndex) => {
          const itemId = `item-${invoiceId}-${itemIndex + 1}`;
          const invoiceItem: InvoiceItem = {
            id: itemId,
            invoiceId,
            ...item
          };
          this.invoiceItems.set(itemId, invoiceItem);
        });
      } else if (i === 1) {
        // Hygiene service invoice items
        const items = [
          { description: "Sanitizer Refill - Entrances", quantity: "8", unitPrice: "75.00", total: "600.00" },
          { description: "Sanitizer Refill - Washrooms", quantity: "12", unitPrice: "50.00", total: "600.00" }
        ];
        items.forEach((item, itemIndex) => {
          const itemId = `item-${invoiceId}-${itemIndex + 1}`;
          const invoiceItem: InvoiceItem = {
            id: itemId,
            invoiceId,
            ...item
          };
          this.invoiceItems.set(itemId, invoiceItem);
        });
      } else if (i === 2) {
        // Mall sanitization invoice items
        const items = [
          { description: "Deep Sanitization - Food Court", quantity: "1", unitPrice: "1500.00", total: "1500.00" },
          { description: "Deep Sanitization - Common Areas", quantity: "1", unitPrice: "1000.00", total: "1000.00" }
        ];
        items.forEach((item, itemIndex) => {
          const itemId = `item-${invoiceId}-${itemIndex + 1}`;
          const invoiceItem: InvoiceItem = {
            id: itemId,
            invoiceId,
            ...item
          };
          this.invoiceItems.set(itemId, invoiceItem);
        });
      }
    }
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Divisions
  async getDivisions(): Promise<Division[]> {
    return Array.from(this.divisions.values());
  }

  async getDivision(id: string): Promise<Division | undefined> {
    return this.divisions.get(id);
  }

  async createDivision(insertDivision: InsertDivision): Promise<Division> {
    const id = randomUUID();
    const division: Division = { ...insertDivision, id };
    this.divisions.set(id, division);
    return division;
  }

  // Workers
  async getWorkers(): Promise<Worker[]> {
    return Array.from(this.workers.values());
  }

  async getWorker(id: string): Promise<Worker | undefined> {
    return this.workers.get(id);
  }

  async getWorkersByDivision(divisionId: string): Promise<Worker[]> {
    return Array.from(this.workers.values()).filter(worker => worker.divisionId === divisionId);
  }

  async createWorker(insertWorker: InsertWorker): Promise<Worker> {
    const id = randomUUID();
    const worker: Worker = { ...insertWorker, id, createdAt: new Date() };
    this.workers.set(id, worker);
    return worker;
  }

  async updateWorker(id: string, updateData: Partial<InsertWorker>): Promise<Worker> {
    const worker = this.workers.get(id);
    if (!worker) throw new Error("Worker not found");
    
    const updatedWorker = { ...worker, ...updateData };
    this.workers.set(id, updatedWorker);
    return updatedWorker;
  }

  async deleteWorker(id: string): Promise<boolean> {
    return this.workers.delete(id);
  }

  // Clients
  async getClients(): Promise<Client[]> {
    return Array.from(this.clients.values());
  }

  async getClient(id: string): Promise<Client | undefined> {
    return this.clients.get(id);
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
    const id = randomUUID();
    const client: Client = { ...insertClient, id, createdAt: new Date() };
    this.clients.set(id, client);
    return client;
  }

  async updateClient(id: string, updateData: Partial<InsertClient>): Promise<Client> {
    const client = this.clients.get(id);
    if (!client) throw new Error("Client not found");
    
    const updatedClient = { ...client, ...updateData };
    this.clients.set(id, updatedClient);
    return updatedClient;
  }

  async deleteClient(id: string): Promise<boolean> {
    return this.clients.delete(id);
  }

  // Inventory Items
  async getInventoryItems(): Promise<InventoryItem[]> {
    return Array.from(this.inventoryItems.values());
  }

  async getInventoryItem(id: string): Promise<InventoryItem | undefined> {
    return this.inventoryItems.get(id);
  }

  async getInventoryItemsByType(type: string): Promise<InventoryItem[]> {
    return Array.from(this.inventoryItems.values()).filter(item => item.type === type);
  }

  async getInventoryItemsByDivision(divisionId: string): Promise<InventoryItem[]> {
    return Array.from(this.inventoryItems.values()).filter(item => item.divisionId === divisionId);
  }

  async createInventoryItem(insertItem: InsertInventoryItem): Promise<InventoryItem> {
    const id = randomUUID();
    const item: InventoryItem = { ...insertItem, id, createdAt: new Date() };
    this.inventoryItems.set(id, item);
    return item;
  }

  async updateInventoryItem(id: string, updateData: Partial<InsertInventoryItem>): Promise<InventoryItem> {
    const item = this.inventoryItems.get(id);
    if (!item) throw new Error("Inventory item not found");
    
    const updatedItem = { ...item, ...updateData };
    this.inventoryItems.set(id, updatedItem);
    return updatedItem;
  }

  async deleteInventoryItem(id: string): Promise<boolean> {
    return this.inventoryItems.delete(id);
  }

  // Stock level management methods
  async getLowStockItems(): Promise<InventoryItem[]> {
    return Array.from(this.inventoryItems.values()).filter(item => 
      item.quantity <= item.minStockLevel
    );
  }

  async getReorderRequiredItems(): Promise<InventoryItem[]> {
    return Array.from(this.inventoryItems.values()).filter(item => 
      item.quantity <= item.reorderPoint
    );
  }

  async getOverstockedItems(): Promise<InventoryItem[]> {
    return Array.from(this.inventoryItems.values()).filter(item => 
      item.quantity >= item.maxStockLevel
    );
  }

  async getStockAlerts(): Promise<{
    lowStock: InventoryItem[];
    reorderRequired: InventoryItem[];
    overstocked: InventoryItem[];
  }> {
    return {
      lowStock: await this.getLowStockItems(),
      reorderRequired: await this.getReorderRequiredItems(),
      overstocked: await this.getOverstockedItems()
    };
  }

  async updateInventoryQuantity(id: string, newQuantity: number, note?: string): Promise<InventoryItem> {
    const item = this.inventoryItems.get(id);
    if (!item) throw new Error("Inventory item not found");
    
    const updatedItem = { 
      ...item, 
      quantity: newQuantity,
      lastRestocked: newQuantity > item.quantity ? new Date() : item.lastRestocked
    };
    this.inventoryItems.set(id, updatedItem);

    // Create notification if stock is low after update
    if (newQuantity <= item.minStockLevel) {
      await this.createNotification({
        title: "Low Stock Alert",
        message: `${item.name} (${item.sku}) is now at ${newQuantity} units - below minimum stock level of ${item.minStockLevel}`,
        type: "warning",
        priority: "high",
        relatedEntityType: "inventory",
        relatedEntityId: id
      });
    }

    return updatedItem;
  }

  // Rental Contracts
  async getRentalContracts(): Promise<RentalContract[]> {
    return Array.from(this.rentalContracts.values());
  }

  async getRentalContract(id: string): Promise<RentalContract | undefined> {
    return this.rentalContracts.get(id);
  }

  async getActiveRentalContracts(): Promise<RentalContract[]> {
    return Array.from(this.rentalContracts.values()).filter(contract => contract.isActive);
  }

  async getExpiringContracts(days: number): Promise<RentalContract[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + days);
    
    return Array.from(this.rentalContracts.values()).filter(contract => 
      contract.isActive && 
      contract.endDate && 
      new Date(contract.endDate) <= cutoffDate
    );
  }

  async createRentalContract(insertContract: InsertRentalContract): Promise<RentalContract> {
    const id = randomUUID();
    const contract: RentalContract = { ...insertContract, id, createdAt: new Date() };
    this.rentalContracts.set(id, contract);
    return contract;
  }

  async updateRentalContract(id: string, updateData: Partial<InsertRentalContract>): Promise<RentalContract> {
    const contract = this.rentalContracts.get(id);
    if (!contract) throw new Error("Rental contract not found");
    
    const updatedContract = { ...contract, ...updateData };
    this.rentalContracts.set(id, updatedContract);
    return updatedContract;
  }

  async deleteRentalContract(id: string): Promise<boolean> {
    return this.rentalContracts.delete(id);
  }

  // Jobs
  async getJobs(): Promise<Job[]> {
    return Array.from(this.jobs.values());
  }

  async getJob(id: string): Promise<Job | undefined> {
    return this.jobs.get(id);
  }

  async getJobsByWorker(workerId: string): Promise<Job[]> {
    return Array.from(this.jobs.values()).filter(job => job.workerId === workerId);
  }

  async getJobsByDivision(divisionId: string): Promise<Job[]> {
    return Array.from(this.jobs.values()).filter(job => job.divisionId === divisionId);
  }

  async getJobsByStatus(status: string): Promise<Job[]> {
    return Array.from(this.jobs.values()).filter(job => job.status === status);
  }

  async getJobsByDateRange(startDate: Date, endDate: Date): Promise<Job[]> {
    return Array.from(this.jobs.values()).filter(job => {
      const jobDate = new Date(job.scheduledDate);
      return jobDate >= startDate && jobDate <= endDate;
    });
  }

  async getTodaysJobs(): Promise<Job[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return this.getJobsByDateRange(today, tomorrow);
  }

  async createJob(insertJob: InsertJob): Promise<Job> {
    const id = randomUUID();
    const now = new Date();
    const job: Job = { 
      ...insertJob, 
      id, 
      createdAt: now, 
      updatedAt: now 
    };
    this.jobs.set(id, job);
    return job;
  }

  async updateJob(id: string, updateData: Partial<InsertJob>): Promise<Job> {
    const job = this.jobs.get(id);
    if (!job) throw new Error("Job not found");
    
    const updatedJob = { ...job, ...updateData, updatedAt: new Date() };
    this.jobs.set(id, updatedJob);
    return updatedJob;
  }

  async deleteJob(id: string): Promise<boolean> {
    return this.jobs.delete(id);
  }

  // Invoices
  async getInvoices(): Promise<Invoice[]> {
    return Array.from(this.invoices.values());
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    return this.invoices.get(id);
  }

  async getInvoicesByClient(clientId: string): Promise<Invoice[]> {
    return Array.from(this.invoices.values()).filter(invoice => invoice.clientId === clientId);
  }

  async getInvoicesByStatus(status: string): Promise<Invoice[]> {
    return Array.from(this.invoices.values()).filter(invoice => invoice.status === status);
  }

  async getOverdueInvoices(): Promise<Invoice[]> {
    const now = new Date();
    return Array.from(this.invoices.values()).filter(invoice => 
      invoice.status !== 'paid' && 
      invoice.status !== 'cancelled' && 
      new Date(invoice.dueDate) < now
    );
  }

  async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const number = String(this.invoiceCounter).padStart(4, '0');
    this.invoiceCounter++;
    return `INV-${year}-${number}`;
  }

  async createInvoice(insertInvoice: InsertInvoice): Promise<Invoice> {
    const id = randomUUID();
    const now = new Date();
    const invoiceNumber = await this.generateInvoiceNumber();
    
    const invoice: Invoice = { 
      ...insertInvoice, 
      id,
      invoiceNumber,
      createdAt: now, 
      updatedAt: now 
    };
    this.invoices.set(id, invoice);
    return invoice;
  }

  async updateInvoice(id: string, updateData: Partial<InsertInvoice>): Promise<Invoice> {
    const invoice = this.invoices.get(id);
    if (!invoice) throw new Error("Invoice not found");
    
    const updatedInvoice = { ...invoice, ...updateData, updatedAt: new Date() };
    this.invoices.set(id, updatedInvoice);
    return updatedInvoice;
  }

  async deleteInvoice(id: string): Promise<boolean> {
    // Also delete associated invoice items
    const items = await this.getInvoiceItems(id);
    items.forEach(item => this.invoiceItems.delete(item.id));
    
    return this.invoices.delete(id);
  }

  // Invoice Items
  async getInvoiceItems(invoiceId: string): Promise<InvoiceItem[]> {
    return Array.from(this.invoiceItems.values()).filter(item => item.invoiceId === invoiceId);
  }

  async createInvoiceItem(insertItem: InsertInvoiceItem): Promise<InvoiceItem> {
    const id = randomUUID();
    const item: InvoiceItem = { ...insertItem, id };
    this.invoiceItems.set(id, item);
    return item;
  }

  async updateInvoiceItem(id: string, updateData: Partial<InsertInvoiceItem>): Promise<InvoiceItem> {
    const item = this.invoiceItems.get(id);
    if (!item) throw new Error("Invoice item not found");
    
    const updatedItem = { ...item, ...updateData };
    this.invoiceItems.set(id, updatedItem);
    return updatedItem;
  }

  async deleteInvoiceItem(id: string): Promise<boolean> {
    return this.invoiceItems.delete(id);
  }

  // Notifications
  async getNotifications(): Promise<Notification[]> {
    return Array.from(this.notifications.values());
  }

  async getNotification(id: string): Promise<Notification | undefined> {
    return this.notifications.get(id);
  }

  async getUnreadNotifications(): Promise<Notification[]> {
    return Array.from(this.notifications.values()).filter(notification => !notification.isRead);
  }

  async createNotification(insertNotification: InsertNotification): Promise<Notification> {
    const id = randomUUID();
    const notification: Notification = { ...insertNotification, id, createdAt: new Date() };
    this.notifications.set(id, notification);
    return notification;
  }

  async markNotificationAsRead(id: string): Promise<boolean> {
    const notification = this.notifications.get(id);
    if (!notification) return false;
    
    notification.isRead = true;
    this.notifications.set(id, notification);
    return true;
  }

  async deleteNotification(id: string): Promise<boolean> {
    return this.notifications.delete(id);
  }

  // Email Templates
  async getEmailTemplates(): Promise<EmailTemplate[]> {
    return Array.from(this.emailTemplates.values());
  }

  async getEmailTemplate(id: string): Promise<EmailTemplate | undefined> {
    return this.emailTemplates.get(id);
  }

  async getEmailTemplatesByType(type: string): Promise<EmailTemplate[]> {
    return Array.from(this.emailTemplates.values()).filter(template => template.type === type);
  }

  async createEmailTemplate(insertTemplate: InsertEmailTemplate): Promise<EmailTemplate> {
    const id = randomUUID();
    const template: EmailTemplate = { ...insertTemplate, id, createdAt: new Date() };
    this.emailTemplates.set(id, template);
    return template;
  }

  async updateEmailTemplate(id: string, updateData: Partial<InsertEmailTemplate>): Promise<EmailTemplate> {
    const template = this.emailTemplates.get(id);
    if (!template) {
      throw new Error(`Email template with id ${id} not found`);
    }
    
    const updatedTemplate = { ...template, ...updateData };
    this.emailTemplates.set(id, updatedTemplate);
    return updatedTemplate;
  }

  async deleteEmailTemplate(id: string): Promise<boolean> {
    return this.emailTemplates.delete(id);
  }

  // Email Logs
  async getEmailLogs(): Promise<EmailLog[]> {
    return Array.from(this.emailLogs.values());
  }

  async getEmailLog(id: string): Promise<EmailLog | undefined> {
    return this.emailLogs.get(id);
  }

  async getEmailLogsByStatus(status: string): Promise<EmailLog[]> {
    return Array.from(this.emailLogs.values()).filter(log => log.status === status);
  }

  async createEmailLog(insertLog: InsertEmailLog): Promise<EmailLog> {
    const id = randomUUID();
    const log: EmailLog = { ...insertLog, id, createdAt: new Date() };
    this.emailLogs.set(id, log);
    return log;
  }

  async updateEmailLog(id: string, updateData: Partial<InsertEmailLog>): Promise<EmailLog> {
    const log = this.emailLogs.get(id);
    if (!log) {
      throw new Error(`Email log with id ${id} not found`);
    }
    
    const updatedLog = { ...log, ...updateData };
    this.emailLogs.set(id, updatedLog);
    return updatedLog;
  }

  // Job Inventory Items
  async getJobInventoryItems(): Promise<JobInventoryItem[]> {
    return Array.from(this.jobInventoryItems.values());
  }

  async getJobInventoryItem(id: string): Promise<JobInventoryItem | undefined> {
    return this.jobInventoryItems.get(id);
  }

  async getJobInventoryItemsByJob(jobId: string): Promise<JobInventoryItem[]> {
    return Array.from(this.jobInventoryItems.values()).filter(item => item.jobId === jobId);
  }

  async createJobInventoryItem(insertItem: InsertJobInventoryItem): Promise<JobInventoryItem> {
    const id = randomUUID();
    const item: JobInventoryItem = { ...insertItem, id, createdAt: new Date() };
    this.jobInventoryItems.set(id, item);
    return item;
  }

  async updateJobInventoryItem(id: string, updateData: Partial<InsertJobInventoryItem>): Promise<JobInventoryItem> {
    const item = this.jobInventoryItems.get(id);
    if (!item) {
      throw new Error(`Job inventory item with id ${id} not found`);
    }
    
    const updatedItem = { ...item, ...updateData };
    this.jobInventoryItems.set(id, updatedItem);
    return updatedItem;
  }

  async deleteJobInventoryItem(id: string): Promise<boolean> {
    return this.jobInventoryItems.delete(id);
  }
}

export const storage = new MemStorage();
