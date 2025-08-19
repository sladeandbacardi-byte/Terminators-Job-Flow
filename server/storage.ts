import { randomUUID } from "crypto";
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
  type JobInventoryItem, type InsertJobInventoryItem,
  type Supplier, type InsertSupplier,
  type PurchaseOrder, type InsertPurchaseOrder,
  type PurchaseOrderItem, type InsertPurchaseOrderItem
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

  // Suppliers
  getSuppliers(): Promise<Supplier[]>;
  getSupplier(id: string): Promise<Supplier | undefined>;
  getSuppliersByCategory(category: string): Promise<Supplier[]>;
  getActiveSuppliers(): Promise<Supplier[]>;
  createSupplier(supplier: InsertSupplier): Promise<Supplier>;
  updateSupplier(id: string, supplier: Partial<InsertSupplier>): Promise<Supplier>;
  deleteSupplier(id: string): Promise<boolean>;

  // Purchase Orders
  getPurchaseOrders(): Promise<PurchaseOrder[]>;
  getPurchaseOrder(id: string): Promise<PurchaseOrder | undefined>;
  getPurchaseOrdersByStatus(status: string): Promise<PurchaseOrder[]>;
  getPendingPurchaseOrders(): Promise<PurchaseOrder[]>;
  createPurchaseOrder(po: InsertPurchaseOrder): Promise<PurchaseOrder>;
  updatePurchaseOrder(id: string, po: Partial<InsertPurchaseOrder>): Promise<PurchaseOrder>;
  approvePurchaseOrder(id: string, approvedById: string): Promise<PurchaseOrder>;
  rejectPurchaseOrder(id: string, rejectionReason: string): Promise<PurchaseOrder>;
  deletePurchaseOrder(id: string): Promise<boolean>;
  
  // Purchase Order Items
  getPurchaseOrderItems(purchaseOrderId: string): Promise<PurchaseOrderItem[]>;
  createPurchaseOrderItem(item: InsertPurchaseOrderItem): Promise<PurchaseOrderItem>;
  updatePurchaseOrderItem(id: string, item: Partial<InsertPurchaseOrderItem>): Promise<PurchaseOrderItem>;
  deletePurchaseOrderItem(id: string): Promise<boolean>;
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
  private suppliers: Map<string, Supplier> = new Map();
  private purchaseOrders: Map<string, PurchaseOrder> = new Map();
  private purchaseOrderItems: Map<string, PurchaseOrderItem> = new Map();
  private invoiceCounter: number = 1;
  private poCounter: number = 1;

  constructor() {
    this.initializeData();
    this.createExampleData();
  }

  private async createExampleData() {
    // Create example clients
    const clients = [
      {
        id: "client-1",
        name: "Pick n Pay - Fourways",
        email: "facilities@picknpay.co.za",
        phone: "+27 11 465 2000",
        address: "Fourways Mall, Cnr Witkoppen & Fourways Blvd, Fourways, Sandton, 2055",
        type: "retail",
        createdAt: new Date("2024-01-15"),
      },
      {
        id: "client-2", 
        name: "Woolworths - Sandton City",
        email: "operations@woolworths.co.za",
        phone: "+27 11 217 4000",
        address: "Sandton City Shopping Centre, 83 Rivonia Rd, Sandhurst, Sandton, 2196",
        type: "retail",
        createdAt: new Date("2024-02-10"),
      },
      {
        id: "client-3",
        name: "McDonald's - Menlyn Park",
        email: "manager@mcdonalds.co.za",
        phone: "+27 12 348 1500",
        address: "Menlyn Park Shopping Centre, Cnr Atterbury & Lois Ave, Menlyn, Pretoria, 0181",
        type: "restaurant",
        createdAt: new Date("2024-02-20"),
      },
      {
        id: "client-4",
        name: "Discovery Health Head Office",
        email: "facilities@discovery.co.za", 
        phone: "+27 11 529 2888",
        address: "1 Discovery Place, Sandton, Johannesburg, 2196",
        type: "corporate",
        createdAt: new Date("2024-01-05"),
      },
      {
        id: "client-5",
        name: "Steers - Mall of Africa",
        email: "operations@steers.co.za",
        phone: "+27 11 549 8000", 
        address: "Mall of Africa, Lone Creek Crescent, Waterfall City, Midrand, 1686",
        type: "restaurant",
        createdAt: new Date("2024-08-10"),
      }
    ];

    // Create example rental contracts
    const contracts = [
      {
        id: "contract-1",
        clientId: "client-1",
        equipmentType: "Paper Towel Dispensers",
        quantity: 15,
        monthlyRate: "2500.00",
        startDate: "2024-01-15",
        endDate: "2025-01-15",
        isActive: true,
        description: "Monthly rental of paper towel dispensers for all restrooms and kitchen areas",
        createdAt: new Date("2024-01-15"),
      },
      {
        id: "contract-2",
        clientId: "client-2", 
        equipmentType: "Hand Sanitizer Stations",
        quantity: 8,
        monthlyRate: "1800.00",
        startDate: "2024-02-10",
        endDate: "2025-02-10", 
        isActive: true,
        description: "Hand sanitizer stations for entrance and checkout areas",
        createdAt: new Date("2024-02-10"),
      },
      {
        id: "contract-3",
        clientId: "client-3",
        equipmentType: "Soap Dispensers", 
        quantity: 6,
        monthlyRate: "1200.00",
        startDate: "2024-02-20",
        endDate: "2024-12-20", // Expiring soon
        isActive: true,
        description: "Soap dispensers for customer and staff restrooms",
        createdAt: new Date("2024-02-20"),
      },
      {
        id: "contract-4",
        clientId: "client-4",
        equipmentType: "Pest Control Stations",
        quantity: 25,
        monthlyRate: "4500.00", 
        startDate: "2024-01-05",
        endDate: "2025-01-05",
        isActive: true,
        description: "Comprehensive pest monitoring stations for office building",
        createdAt: new Date("2024-01-05"),
      }
    ];

    // Create example jobs
    const jobs = [
      {
        id: "job-1",
        clientId: "client-1",
        workerId: "worker-1", 
        divisionId: "div-2", // Hygiene Services
        title: "Monthly Paper Towel Refill - Pick n Pay Fourways",
        description: "Refill all paper towel dispensers and check dispenser functionality",
        status: "completed",
        priority: "medium",
        scheduledDate: new Date(),
        completedDate: new Date(),
        estimatedDuration: 120,
        actualDuration: 105,
        totalAmount: "850.00",
        notes: "All dispensers refilled successfully. Replaced faulty dispenser in main restroom.",
        createdAt: new Date(),
      },
      {
        id: "job-2", 
        clientId: "client-4",
        workerId: "worker-5", // Pest control worker
        divisionId: "div-1", // Pest Control
        title: "Monthly Pest Inspection - Discovery Head Office",
        description: "Check all pest monitoring stations and bait levels",
        status: "in_progress",
        priority: "high",
        scheduledDate: new Date(),
        estimatedDuration: 180,
        totalAmount: "1200.00",
        notes: "Started inspection on floors 1-5. Found increased activity on floor 3.",
        createdAt: new Date(),
      },
      {
        id: "job-3",
        clientId: "client-2",
        workerId: "worker-3",
        divisionId: "div-2", // Hygiene Services  
        title: "Sanitizer Refill - Woolworths Sandton",
        description: "Refill hand sanitizer stations and clean dispensers",
        status: "pending",
        priority: "medium",
        scheduledDate: new Date(Date.now() + 86400000), // Tomorrow
        estimatedDuration: 90,
        totalAmount: "650.00",
        notes: "Scheduled for tomorrow morning. Check sanitizer levels.",
        createdAt: new Date(),
      },
      {
        id: "job-4",
        clientId: "client-3",
        workerId: "worker-2",
        divisionId: "div-2",
        title: "Soap Dispenser Maintenance - McDonald's Menlyn",
        description: "Clean and refill soap dispensers, check functionality",
        status: "pending", 
        priority: "low",
        scheduledDate: new Date(Date.now() + 172800000), // Day after tomorrow
        estimatedDuration: 60,
        totalAmount: "400.00",
        notes: "Regular monthly maintenance visit",
        createdAt: new Date(),
      },
      {
        id: "job-5",
        clientId: "client-5",
        workerId: "worker-6", 
        divisionId: "div-1", // Pest Control
        title: "Initial Pest Assessment - Steers Mall of Africa",
        description: "Comprehensive pest assessment for new client setup",
        status: "completed",
        priority: "high",
        scheduledDate: new Date(Date.now() - 604800000), // Last week
        completedDate: new Date(Date.now() - 604800000 + 7200000), // Completed 2 hours later
        estimatedDuration: 240,
        actualDuration: 195,
        totalAmount: "1500.00",
        notes: "Completed full assessment. Recommended 12 monitoring stations. Client approved.",
        createdAt: new Date(Date.now() - 604800000),
      }
    ];

    // Create example invoices
    const invoices = [
      {
        id: "invoice-1",
        invoiceNumber: "INV-2024-001",
        clientId: "client-1",
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 2592000000), // 30 days from now
        status: "sent",
        totalAmount: "2850.00",
        taxAmount: "427.50",
        subtotalAmount: "2422.50",
        notes: "Monthly rental fee and service charges for August 2024",
        createdAt: new Date(),
      },
      {
        id: "invoice-2", 
        invoiceNumber: "INV-2024-002",
        clientId: "client-4",
        issueDate: new Date(Date.now() - 86400000), // Yesterday
        dueDate: new Date(Date.now() + 2505600000), // 29 days from now
        status: "paid",
        totalAmount: "5700.00",
        taxAmount: "855.00", 
        subtotalAmount: "4845.00",
        paidDate: new Date(),
        notes: "Monthly pest control services and equipment rental - August 2024",
        createdAt: new Date(Date.now() - 86400000),
      },
      {
        id: "invoice-3",
        invoiceNumber: "INV-2024-003",
        clientId: "client-2",
        issueDate: new Date(Date.now() - 172800000), // 2 days ago
        dueDate: new Date(Date.now() + 2419200000), // 28 days from now
        status: "overdue",
        totalAmount: "2070.00",
        taxAmount: "310.50",
        subtotalAmount: "1759.50", 
        notes: "Hand sanitizer rental and refill services - August 2024",
        createdAt: new Date(Date.now() - 172800000),
      }
    ];

    // Create invoice items
    const invoiceItems = [
      {
        id: "item-1",
        invoiceId: "invoice-1",
        description: "Paper Towel Dispenser Rental (15 units)",
        quantity: 15,
        unitPrice: "120.00",
        totalPrice: "1800.00",
      },
      {
        id: "item-2", 
        invoiceId: "invoice-1",
        description: "Paper Towel Refills",
        quantity: 45,
        unitPrice: "13.83",
        totalPrice: "622.50",
      },
      {
        id: "item-3",
        invoiceId: "invoice-2",
        description: "Pest Control Station Rental (25 units)",
        quantity: 25,
        unitPrice: "150.00", 
        totalPrice: "3750.00",
      },
      {
        id: "item-4",
        invoiceId: "invoice-2",
        description: "Monthly Pest Inspection Service",
        quantity: 1,
        unitPrice: "1095.00",
        totalPrice: "1095.00",
      },
      {
        id: "item-5",
        invoiceId: "invoice-3",
        description: "Hand Sanitizer Station Rental (8 units)",
        quantity: 8,
        unitPrice: "180.00",
        totalPrice: "1440.00",
      },
      {
        id: "item-6",
        invoiceId: "invoice-3", 
        description: "Hand Sanitizer Refills",
        quantity: 16,
        unitPrice: "19.97",
        totalPrice: "319.50",
      }
    ];

    // Store all example data
    clients.forEach(client => this.clients.set(client.id, client));
    contracts.forEach(contract => this.rentalContracts.set(contract.id, contract));
    jobs.forEach(job => this.jobs.set(job.id, job));
    invoices.forEach(invoice => this.invoices.set(invoice.id, invoice));
    invoiceItems.forEach(item => this.invoiceItems.set(item.id, item));

    // Create some notifications based on the example data
    await this.createNotification({
      title: "Low Stock Alert",
      message: "Paper Roll Refill (SKU: PR-001) is at 8 units - below minimum stock level of 15",
      type: "warning",
      priority: "high",
      relatedEntityType: "inventory",
      relatedEntityId: "inv-2"
    });

    await this.createNotification({
      title: "Contract Expiring Soon",
      message: "McDonald's Menlyn Park soap dispenser contract expires in 4 months",
      type: "info", 
      priority: "medium",
      relatedEntityType: "contract",
      relatedEntityId: "contract-3"
    });

    await this.createNotification({
      title: "Job Completed",
      message: "Initial pest assessment for Steers Mall of Africa completed successfully",
      type: "success",
      priority: "low",
      relatedEntityType: "job",
      relatedEntityId: "job-5"
    });

    await this.createNotification({
      title: "Payment Received", 
      message: "Discovery Health payment of R5,700 received for invoice INV-2024-002",
      type: "success",
      priority: "low",
      relatedEntityType: "invoice", 
      relatedEntityId: "invoice-2"
    });

    await this.createNotification({
      title: "Critical Stock Alert",
      message: "Hand Sanitizer Refill (SKU: HS-002) is critically low at 3 units",
      type: "error",
      priority: "high",
      relatedEntityType: "inventory",
      relatedEntityId: "inv-3"
    });

    // Create example suppliers
    const suppliers = [
      {
        id: "supplier-1",
        name: "HygieneTech Solutions",
        contactPerson: "Sarah Johnson",
        email: "sarah@hygienetech.co.za",
        phone: "+27 11 234 5678",
        address: "123 Industrial Road, Johannesburg, 2001",
        website: "https://hygienetech.co.za",
        category: "hygiene",
        paymentTerms: "30 days",
        isActive: true,
        notes: "Primary supplier for paper towel dispensers and hygiene equipment",
        createdAt: new Date("2024-01-10"),
      },
      {
        id: "supplier-2",
        name: "Paper Products SA",
        contactPerson: "Michael Chen",
        email: "michael@paperproducts.co.za",
        phone: "+27 21 987 6543",
        address: "456 Commerce Street, Cape Town, 8001",
        website: "https://paperproducts.co.za",
        category: "hygiene",
        paymentTerms: "15 days",
        isActive: true,
        notes: "Reliable supplier for paper towel refills and tissue products",
        createdAt: new Date("2024-01-12"),
      },
      {
        id: "supplier-3",
        name: "PestPro Solutions",
        contactPerson: "David Smith",
        email: "david@pestpro.co.za",
        phone: "+27 12 555 7890",
        address: "789 Security Avenue, Pretoria, 0001",
        website: "https://pestpro.co.za",
        category: "pest_control",
        paymentTerms: "45 days",
        isActive: true,
        notes: "Specialized pest control supplies and baits",
        createdAt: new Date("2024-01-15"),
      },
      {
        id: "supplier-4",
        name: "SafeClean Distributors",
        contactPerson: "Emma Wilson",
        email: "emma@safeclean.co.za",
        phone: "+27 11 444 3333",
        address: "321 Cleaning Way, Sandton, 2196",
        website: "https://safeclean.co.za",
        category: "hygiene",
        paymentTerms: "30 days",
        isActive: true,
        notes: "Hand sanitizers and antibacterial products",
        createdAt: new Date("2024-02-01"),
      },
      {
        id: "supplier-5",
        name: "TrapTech Industries",
        contactPerson: "James Brown",
        email: "james@traptech.co.za",
        phone: "+27 31 222 1111",
        address: "654 Industrial Park, Durban, 4001",
        website: "https://traptech.co.za",
        category: "pest_control",
        paymentTerms: "60 days",
        isActive: true,
        notes: "Monitoring stations and pest control equipment",
        createdAt: new Date("2024-02-05"),
      },
      {
        id: "supplier-6",
        name: "AutoClean Systems",
        contactPerson: "Lisa Green",
        email: "lisa@autoclean.co.za",
        phone: "+27 11 888 9999",
        address: "987 Tech Boulevard, Midrand, 1686",
        website: "https://autoclean.co.za",
        category: "equipment",
        paymentTerms: "30 days",
        isActive: false, // Inactive supplier example
        notes: "Automatic dispensers and smart hygiene solutions. Currently on hold due to quality issues.",
        createdAt: new Date("2024-03-01"),
      }
    ];

    suppliers.forEach(supplier => this.suppliers.set(supplier.id, supplier));

    // Create example purchase orders
    await this.createPurchaseOrder({
      poNumber: "PO-2024-001",
      supplierId: "supplier-1",
      requestedById: "user-1",
      status: "pending",
      totalAmount: "450.00",
      requestDate: new Date("2024-08-15"),
      expectedDeliveryDate: new Date("2024-08-25"),
      notes: "Urgent order for Pick n Pay refill requirements"
    });

    await this.createPurchaseOrder({
      poNumber: "PO-2024-002", 
      supplierId: "supplier-3",
      requestedById: "user-1",
      approvedById: "user-2",
      status: "approved",
      totalAmount: "1250.00",
      requestDate: new Date("2024-08-16"),
      approvalDate: new Date("2024-08-17"),
      expectedDeliveryDate: new Date("2024-08-30"),
      notes: "Monthly pest control supplies order"
    });

    await this.createPurchaseOrder({
      poNumber: "PO-2024-003",
      supplierId: "supplier-2", 
      requestedById: "user-1",
      status: "rejected",
      totalAmount: "320.00",
      requestDate: new Date("2024-08-14"),
      rejectionReason: "Budget constraints for this quarter",
      notes: "Paper towel stock replenishment"
    });
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

    const washroomDivision: Division = {
      id: "div-3",
      name: "Washroom",
      colorCode: "#3b82f6",
      description: "Washroom maintenance and hygiene services"
    };

    const sanitaryBinDivision: Division = {
      id: "div-4",
      name: "Sanitary Bin",
      colorCode: "#8b5cf6",
      description: "Sanitary waste collection and disposal services"
    };

    const deepCleaningDivision: Division = {
      id: "div-5",
      name: "Deep Cleaning",
      colorCode: "#06b6d4",
      description: "Professional deep cleaning and disinfection services"
    };

    this.divisions.set(pestControlDivision.id, pestControlDivision);
    this.divisions.set(hygieneDivision.id, hygieneDivision);
    this.divisions.set(washroomDivision.id, washroomDivision);
    this.divisions.set(sanitaryBinDivision.id, sanitaryBinDivision);
    this.divisions.set(deepCleaningDivision.id, deepCleaningDivision);

    // Create sample workers
    const workers = [
      { name: "John Smith", email: "john@terminators.co.za", phone: "+27 41 123 4567", divisionId: "div-1" },
      { name: "Sarah Williams", email: "sarah@terminators.co.za", phone: "+27 41 123 4568", divisionId: "div-2" },
      { name: "David Brown", email: "david@terminators.co.za", phone: "+27 41 123 4569", divisionId: "div-1" },
      { name: "Lisa Johnson", email: "lisa@terminators.co.za", phone: "+27 41 123 4570", divisionId: "div-2" },
      { name: "Mike Johnson", email: "mike@terminators.co.za", phone: "+27 41 123 4571", divisionId: "div-1" },
      { name: "Emma Davis", email: "emma@terminators.co.za", phone: "+27 41 123 4572", divisionId: "div-2" },
      { name: "James Wilson", email: "james@terminators.co.za", phone: "+27 41 123 4573", divisionId: "div-1" },
      { name: "Rachel Green", email: "rachel@terminators.co.za", phone: "+27 41 123 4574", divisionId: "div-2" },
      { name: "Mark Thompson", email: "mark@terminators.co.za", phone: "+27 41 123 4575", divisionId: "div-3" },
      { name: "Jessica Adams", email: "jessica@terminators.co.za", phone: "+27 41 123 4576", divisionId: "div-3" },
      { name: "Robert Miller", email: "robert@terminators.co.za", phone: "+27 41 123 4577", divisionId: "div-4" },
      { name: "Amanda Clark", email: "amanda@terminators.co.za", phone: "+27 41 123 4578", divisionId: "div-4" },
      { name: "Kevin Lee", email: "kevin@terminators.co.za", phone: "+27 41 123 4579", divisionId: "div-5" },
      { name: "Natalie Scott", email: "natalie@terminators.co.za", phone: "+27 41 123 4580", divisionId: "div-5" }
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
      },
      {
        name: "Washroom Cleaning Kit - Professional",
        type: "product",
        sku: "WCK-PROF-001",
        quantity: 12,
        minStockLevel: 5,
        maxStockLevel: 30,
        reorderPoint: 8,
        unitPrice: "85.00",
        description: "Complete washroom cleaning kit with disinfectants and tools",
        divisionId: "div-3",
        location: "Cleaning Supplies - Shelf D1",
        supplier: "CleanTech Professional",
        lastRestocked: new Date('2025-08-10')
      },
      {
        name: "Toilet Paper Dispenser - Commercial",
        type: "rental_equipment",
        sku: "TPD-COM-001",
        quantity: 18,
        minStockLevel: 8,
        maxStockLevel: 40,
        reorderPoint: 12,
        unitPrice: "120.00",
        description: "Heavy-duty commercial toilet paper dispenser",
        divisionId: "div-3",
        location: "Washroom Equipment - Rack A",
        supplier: "RestroomPro Systems",
        lastRestocked: new Date('2025-08-12')
      },
      {
        name: "Sanitary Bin - Pedal Operated",
        type: "rental_equipment",
        sku: "SB-PED-001",
        quantity: 15,
        minStockLevel: 10,
        maxStockLevel: 50,
        reorderPoint: 15,
        unitPrice: "75.00",
        description: "Hygienic pedal-operated sanitary waste bin with liner",
        divisionId: "div-4",
        location: "Sanitary Equipment - Shelf B",
        supplier: "HygieneTech Solutions",
        lastRestocked: new Date('2025-08-08')
      },
      {
        name: "Sanitary Bin Liners - Biodegradable",
        type: "product",
        sku: "SBL-BIO-001",
        quantity: 25,
        minStockLevel: 50,
        maxStockLevel: 500,
        reorderPoint: 75,
        unitPrice: "18.50",
        description: "Eco-friendly biodegradable sanitary waste bin liners, pack of 50",
        divisionId: "div-4",
        location: "Consumables Storage - Bin C",
        supplier: "EcoWaste Solutions",
        lastRestocked: new Date('2025-08-15')
      },
      {
        name: "Deep Clean Disinfectant - Industrial",
        type: "product",
        sku: "DCD-IND-001",
        quantity: 8,
        minStockLevel: 10,
        maxStockLevel: 60,
        reorderPoint: 15,
        unitPrice: "45.00",
        description: "Industrial-strength disinfectant for deep cleaning services, 5L container",
        divisionId: "div-5",
        location: "Chemical Storage - Locked Section",
        supplier: "ChemiClean Industrial",
        lastRestocked: new Date('2025-08-05')
      },
      {
        name: "Steam Cleaner - Professional",
        type: "rental_equipment",
        sku: "SC-PROF-001",
        quantity: 4,
        minStockLevel: 2,
        maxStockLevel: 10,
        reorderPoint: 3,
        unitPrice: "850.00",
        description: "High-pressure steam cleaner for deep sanitization",
        divisionId: "div-5",
        location: "Equipment Bay - Section E",
        supplier: "SteamTech Professional",
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

  // Analytics and Dashboard Metrics
  async getDashboardAnalytics(period: 'today' | 'week' | 'month' = 'today'): Promise<{
    customers: { count: number; new: number };
    jobs: { total: number; completed: number; inProgress: number; pending: number };
    revenue: { total: number; invoiced: number; paid: number };
    contracts: { active: number; expiring: number };
    inventory: { totalItems: number; lowStock: number; criticalStock: number };
  }> {
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case 'today':
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1);
        break;
    }

    // Customer metrics
    const allCustomers = Array.from(this.clients.values());
    const newCustomers = allCustomers.filter(client => 
      client.createdAt && new Date(client.createdAt) >= startDate
    );

    // Job metrics
    const allJobs = Array.from(this.jobs.values());
    const periodJobs = allJobs.filter(job => 
      new Date(job.scheduledDate) >= startDate
    );
    
    const completedJobs = periodJobs.filter(job => job.status === 'completed');
    const inProgressJobs = periodJobs.filter(job => job.status === 'in_progress');
    const pendingJobs = periodJobs.filter(job => job.status === 'pending');

    // Revenue calculation from completed jobs
    const revenue = completedJobs.reduce((total, job) => {
      return total + (job.totalAmount ? parseFloat(job.totalAmount) : 0);
    }, 0);

    // Invoice metrics
    const allInvoices = Array.from(this.invoices.values());
    const periodInvoices = allInvoices.filter(invoice => 
      invoice.issueDate && new Date(invoice.issueDate) >= startDate
    );
    
    const invoicedAmount = periodInvoices.reduce((total, invoice) => 
      total + parseFloat(invoice.totalAmount), 0
    );
    
    const paidInvoices = periodInvoices.filter(invoice => invoice.status === 'paid');
    const paidAmount = paidInvoices.reduce((total, invoice) => 
      total + parseFloat(invoice.totalAmount), 0
    );

    // Contract metrics
    const activeContracts = Array.from(this.rentalContracts.values())
      .filter(contract => contract.isActive);
    const expiringContracts = await this.getExpiringContracts(30);

    // Inventory metrics
    const allInventory = Array.from(this.inventoryItems.values());
    const lowStockItems = allInventory.filter(item => 
      item.quantity <= item.reorderPoint
    );
    const criticalStockItems = allInventory.filter(item => 
      item.quantity <= item.minStockLevel
    );

    return {
      customers: {
        count: allCustomers.length,
        new: newCustomers.length
      },
      jobs: {
        total: periodJobs.length,
        completed: completedJobs.length,
        inProgress: inProgressJobs.length,
        pending: pendingJobs.length
      },
      revenue: {
        total: revenue,
        invoiced: invoicedAmount,
        paid: paidAmount
      },
      contracts: {
        active: activeContracts.length,
        expiring: expiringContracts.length
      },
      inventory: {
        totalItems: allInventory.length,
        lowStock: lowStockItems.length,
        criticalStock: criticalStockItems.length
      }
    };
  }

  async getRevenueByPeriod(period: 'daily' | 'weekly' | 'monthly', days: number = 30): Promise<Array<{
    date: string;
    revenue: number;
    jobs: number;
  }>> {
    const result = [];
    const now = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      
      let startDate: Date, endDate: Date;
      
      if (period === 'daily') {
        startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);
      } else if (period === 'weekly') {
        const dayOfWeek = date.getDay();
        startDate = new Date(date);
        startDate.setDate(date.getDate() - dayOfWeek);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
      } else {
        startDate = new Date(date.getFullYear(), date.getMonth(), 1);
        endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);
      }

      const periodJobs = Array.from(this.jobs.values()).filter(job => {
        const jobDate = new Date(job.scheduledDate);
        return jobDate >= startDate && jobDate <= endDate && job.status === 'completed';
      });

      const revenue = periodJobs.reduce((total, job) => {
        return total + (job.totalAmount ? parseFloat(job.totalAmount) : 0);
      }, 0);

      result.push({
        date: startDate.toISOString().split('T')[0],
        revenue,
        jobs: periodJobs.length
      });
    }

    return result;
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

  // Suppliers
  async getSuppliers(): Promise<Supplier[]> {
    return Array.from(this.suppliers.values());
  }

  async getSupplier(id: string): Promise<Supplier | undefined> {
    return this.suppliers.get(id);
  }

  async getSuppliersByCategory(category: string): Promise<Supplier[]> {
    return Array.from(this.suppliers.values()).filter(supplier => supplier.category === category);
  }

  async getActiveSuppliers(): Promise<Supplier[]> {
    return Array.from(this.suppliers.values()).filter(supplier => supplier.isActive);
  }

  async createSupplier(insertSupplier: InsertSupplier): Promise<Supplier> {
    const id = randomUUID();
    const supplier: Supplier = { ...insertSupplier, id, createdAt: new Date() };
    this.suppliers.set(id, supplier);
    return supplier;
  }

  async updateSupplier(id: string, updateData: Partial<InsertSupplier>): Promise<Supplier> {
    const supplier = this.suppliers.get(id);
    if (!supplier) throw new Error("Supplier not found");
    
    const updatedSupplier = { ...supplier, ...updateData };
    this.suppliers.set(id, updatedSupplier);
    return updatedSupplier;
  }

  async deleteSupplier(id: string): Promise<boolean> {
    return this.suppliers.delete(id);
  }

  // Purchase Orders
  async getPurchaseOrders(): Promise<PurchaseOrder[]> {
    return Array.from(this.purchaseOrders.values());
  }

  async getPurchaseOrder(id: string): Promise<PurchaseOrder | undefined> {
    return this.purchaseOrders.get(id);
  }

  async getPurchaseOrdersByStatus(status: string): Promise<PurchaseOrder[]> {
    return Array.from(this.purchaseOrders.values()).filter(po => po.status === status);
  }

  async getPendingPurchaseOrders(): Promise<PurchaseOrder[]> {
    return Array.from(this.purchaseOrders.values()).filter(po => po.status === "pending");
  }

  async createPurchaseOrder(insertPO: InsertPurchaseOrder): Promise<PurchaseOrder> {
    const id = randomUUID();
    const poNumber = insertPO.poNumber || `PO-2024-${String(this.poCounter++).padStart(3, '0')}`;
    const po: PurchaseOrder = { 
      ...insertPO, 
      id, 
      poNumber,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.purchaseOrders.set(id, po);
    return po;
  }

  async updatePurchaseOrder(id: string, updateData: Partial<InsertPurchaseOrder>): Promise<PurchaseOrder> {
    const po = this.purchaseOrders.get(id);
    if (!po) throw new Error("Purchase order not found");
    
    const updatedPO = { ...po, ...updateData, updatedAt: new Date() };
    this.purchaseOrders.set(id, updatedPO);
    return updatedPO;
  }

  async approvePurchaseOrder(id: string, approvedById: string): Promise<PurchaseOrder> {
    const po = this.purchaseOrders.get(id);
    if (!po) throw new Error("Purchase order not found");
    
    const updatedPO = { 
      ...po, 
      status: "approved", 
      approvedById, 
      approvalDate: new Date(),
      updatedAt: new Date()
    };
    this.purchaseOrders.set(id, updatedPO);
    return updatedPO;
  }

  async rejectPurchaseOrder(id: string, rejectionReason: string): Promise<PurchaseOrder> {
    const po = this.purchaseOrders.get(id);
    if (!po) throw new Error("Purchase order not found");
    
    const updatedPO = { 
      ...po, 
      status: "rejected", 
      rejectionReason,
      updatedAt: new Date()
    };
    this.purchaseOrders.set(id, updatedPO);
    return updatedPO;
  }

  async deletePurchaseOrder(id: string): Promise<boolean> {
    // Delete associated items first
    const items = Array.from(this.purchaseOrderItems.values()).filter(item => item.purchaseOrderId === id);
    items.forEach(item => this.purchaseOrderItems.delete(item.id));
    
    return this.purchaseOrders.delete(id);
  }

  // Purchase Order Items
  async getPurchaseOrderItems(purchaseOrderId: string): Promise<PurchaseOrderItem[]> {
    return Array.from(this.purchaseOrderItems.values()).filter(item => item.purchaseOrderId === purchaseOrderId);
  }

  async createPurchaseOrderItem(insertItem: InsertPurchaseOrderItem): Promise<PurchaseOrderItem> {
    const id = randomUUID();
    const item: PurchaseOrderItem = { ...insertItem, id, createdAt: new Date() };
    this.purchaseOrderItems.set(id, item);
    return item;
  }

  async updatePurchaseOrderItem(id: string, updateData: Partial<InsertPurchaseOrderItem>): Promise<PurchaseOrderItem> {
    const item = this.purchaseOrderItems.get(id);
    if (!item) throw new Error("Purchase order item not found");
    
    const updatedItem = { ...item, ...updateData };
    this.purchaseOrderItems.set(id, updatedItem);
    return updatedItem;
  }

  async deletePurchaseOrderItem(id: string): Promise<boolean> {
    return this.purchaseOrderItems.delete(id);
  }
}

export const storage = new MemStorage();
