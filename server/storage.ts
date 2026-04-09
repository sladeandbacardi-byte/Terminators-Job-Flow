import { randomUUID } from "crypto";
import { 
  type User, type InsertUser,
  type Department, type InsertDepartment,
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
  type PurchaseOrderItem, type InsertPurchaseOrderItem,
  type CalendarEvent, type InsertCalendarEvent,
  type CustomReport, type InsertCustomReport,
  type QuoteSubmission, type InsertQuoteSubmission
} from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Departments
  getDepartments(): Promise<Department[]>;
  getDepartment(id: string): Promise<Department | undefined>;
  createDepartment(department: InsertDepartment): Promise<Department>;

  // Workers
  getWorkers(): Promise<Worker[]>;
  getWorker(id: string): Promise<Worker | undefined>;
  getWorkerByEmployeeId(employeeId: string): Promise<Worker | undefined>;
  getWorkersByDepartment(departmentId: string): Promise<Worker[]>;
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
  getInventoryItemsByDepartment(departmentId: string): Promise<InventoryItem[]>;
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
  getJobsForWorker(workerId: string): Promise<(Job & { client: Client })[]>;
  getJobsByDepartment(departmentId: string): Promise<Job[]>;
  getJobsByStatus(status: string): Promise<Job[]>;
  getJobsByDateRange(startDate: Date, endDate: Date): Promise<Job[]>;
  getJobsByDepartmentAndDateRange(departmentId: string, startDate: Date, endDate: Date): Promise<(Job & { client: Client; worker: Worker; inventoryItems: (JobInventoryItem & { inventoryItem: InventoryItem })[] })[]>;
  getTodaysJobs(): Promise<Job[]>;
  updateJobStatus(jobId: string, status: string): Promise<Job>;
  getJobCardData(jobId: string): Promise<(Job & { client: Client, worker: Worker, department: Department, inventoryItems: (JobInventoryItem & { inventoryItem: InventoryItem })[] }) | undefined>;
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

  // Activity Logs (for admin audit trail)
  getActivityLogs(): Promise<any[]>;

  // Calendar Events
  getCalendarEvents(): Promise<CalendarEvent[]>;
  getCalendarEvent(id: string): Promise<CalendarEvent | undefined>;
  createCalendarEvent(event: InsertCalendarEvent): Promise<CalendarEvent>;
  updateCalendarEvent(id: string, event: Partial<InsertCalendarEvent>): Promise<CalendarEvent>;
  deleteCalendarEvent(id: string): Promise<boolean>;

  // Custom Reports
  getCustomReports(): Promise<CustomReport[]>;
  getCustomReport(id: string): Promise<CustomReport | undefined>;
  getCustomReportsByType(type: string): Promise<CustomReport[]>;
  createCustomReport(report: InsertCustomReport): Promise<CustomReport>;
  updateCustomReport(id: string, report: Partial<InsertCustomReport>): Promise<CustomReport>;
  deleteCustomReport(id: string): Promise<boolean>;
  runCustomReport(id: string): Promise<any>;

  // Quote Submissions
  getQuoteSubmissions(): Promise<QuoteSubmission[]>;
  getQuoteSubmission(id: string): Promise<QuoteSubmission | undefined>;
  getQuoteSubmissionsByStatus(status: string): Promise<QuoteSubmission[]>;
  createQuoteSubmission(submission: InsertQuoteSubmission): Promise<QuoteSubmission>;
  updateQuoteSubmission(id: string, submission: Partial<InsertQuoteSubmission>): Promise<QuoteSubmission>;
  deleteQuoteSubmission(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private departments: Map<string, Department> = new Map();
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
  private calendarEvents: Map<string, CalendarEvent> = new Map();
  private customReports: Map<string, CustomReport> = new Map();
  private quoteSubmissions: Map<string, QuoteSubmission> = new Map();
  private activityLogs: any[] = [];
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
        departmentId: "div-2", // Hygiene Services
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
        departmentId: "div-1", // Pest Control
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
        departmentId: "div-2", // Hygiene Services  
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
        departmentId: "div-2",
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
        departmentId: "div-1", // Pest Control
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

    // Store all example data - skip clients here since initializeData already seeds them
    // (createExampleData runs after initializeData and would overwrite them without status)
    // Only seed clients if they're not already present
    clients.forEach(client => {
      if (this.clients.has(client.id)) return; // don't overwrite
      const clientData: Client = {
        id: client.id,
        name: client.name,
        status: "active",
        contactPerson: client.contactPerson || null,
        email: client.email || null,
        phone: client.phone || null,
        address: client.address || null,
        departmentId: client.departmentId || "div-1",
        businessType: client.type || null,
        taxNumber: null,
        creditLimit: null,
        paymentTerms: client.paymentTerms || "30 days",
        notes: client.notes || null,
        createdAt: client.createdAt,
        updatedAt: new Date()
      };
      this.clients.set(client.id, clientData);
    });
    
    // Skip contracts — initializeData already seeds rc-* contracts
    // Skip jobs — initializeData already seeds job-* with current dates
    // Skip invoices — initializeData already seeds sinv-* invoices
    
    invoiceItems.forEach(item => {
      const itemData: InvoiceItem = {
        id: item.id,
        invoiceId: item.invoiceId,
        description: item.description,
        quantity: item.quantity.toString(),
        unitPrice: item.unitPrice,
        total: item.totalPrice,
        inventoryItemId: null,
        jobId: null,
        contractId: null
      };
      this.invoiceItems.set(item.id, itemData);
    });

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
        departmentId: "div-2", // Sanitary Bin Services
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
        departmentId: "div-3", // Washroom Services
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
        departmentId: "div-1", // Pest Control Services
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
        departmentId: "div-3", // Washroom Services
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
        departmentId: "div-1", // Pest Control Services
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
        departmentId: "div-2", // Sanitary Bin Services
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
    // Clear any existing divisions first to prevent duplicates
    this.departments.clear();
    
    // Create divisions - Updated to match actual business services from terminators.co.za
    const pestControlDivision: Department = {
      id: "div-1",
      name: "Pest Control",
      colorCode: "#22c55e",
      description: "Professional pest control and extermination services for residential and commercial clients"
    };

    const sanitaryBinDivision: Department = {
      id: "div-2",
      name: "Sanitary Bins",
      colorCode: "#8b5cf6",
      description: "Sanitary waste collection, disposal and feminine hygiene services"
    };

    const washroomDivision: Department = {
      id: "div-3",
      name: "Washroom",
      colorCode: "#3b82f6",
      description: "Complete washroom maintenance, hygiene and supply services"
    };

    const deepCleaningDivision: Department = {
      id: "div-4",
      name: "Deep Cleaning",
      colorCode: "#f59e0b",
      description: "Professional deep cleaning and specialized cleaning services"
    };

    const salesDepartment: Department = {
      id: "div-5",
      name: "Sales",
      colorCode: "#ec4899",
      description: "Sales and customer service administration"
    };

    const adminDepartment: Department = {
      id: "div-6",
      name: "Admin",
      colorCode: "#6366f1",
      description: "Administration, finance, and human resources"
    };

    this.departments.set(pestControlDivision.id, pestControlDivision);
    this.departments.set(sanitaryBinDivision.id, sanitaryBinDivision);
    this.departments.set(washroomDivision.id, washroomDivision);
    this.departments.set(deepCleaningDivision.id, deepCleaningDivision);
    this.departments.set(salesDepartment.id, salesDepartment);
    this.departments.set(adminDepartment.id, adminDepartment);

    // Create workers based on actual organogram
    const workers = [
      // Management Team
      { name: "Julien Botha", email: "julien@terminators.co.za", phone: "+27 41 123 4567", departmentId: "div-6", role: "Operational Manager" },
      { name: "Sheryl-Lyn Lee", email: "sheryl@terminators.co.za", phone: "+27 41 123 4568", departmentId: "div-5", role: "Sales Administrator" },
      { name: "Juli Holtshausen", email: "juli@terminators.co.za", phone: "+27 41 123 4569", departmentId: "div-6", role: "Finance and Human Resources Manager" },
      { name: "Chane du Toit", email: "chane@terminators.co.za", phone: "+27 41 123 4590", departmentId: "div-5", role: "Sales Consultant" },
      { name: "Mariette Koekemoer", email: "mariette@terminators.co.za", phone: "+27 41 123 4570", departmentId: "div-3", role: "Hygiene Services Coordinator" },
      { name: "Maryka Venter", email: "maryka@terminators.co.za", phone: "+27 41 123 4571", departmentId: "div-6", role: "Pest Control Services Coordinator" },
      
      // Pest Control Team
      { name: "Reece Ebrahim", email: "reece@terminators.co.za", phone: "+27 41 123 4572", departmentId: "div-1", role: "PCO" },
      { name: "Garth du Preez", email: "garth@terminators.co.za", phone: "+27 41 123 4573", departmentId: "div-1", role: "PCO" },
      { name: "Michael Meyer", email: "michael@terminators.co.za", phone: "+27 41 123 4574", departmentId: "div-1", role: "PCO" },
      { name: "Xolani Ndzotoyi", email: "xolani@terminators.co.za", phone: "+27 41 123 4575", departmentId: "div-1", role: "PCO" },
      { name: "Leon Coltman", email: "leon@terminators.co.za", phone: "+27 41 123 4576", departmentId: "div-1", role: "Assistant" },
      
      // Sanitary Bin Service A Team
      { name: "Donovan", email: "donovan@terminators.co.za", phone: "+27 41 123 4576", departmentId: "div-2", role: "Supervisor" },
      { name: "Belinda", email: "belinda@terminators.co.za", phone: "+27 41 123 4577", departmentId: "div-2", role: "Sanitary Bin Technician" },
      // Sanitary Bin Service B Team
      { name: "Jackie Roelfse", email: "jackie@terminators.co.za", phone: "+27 41 123 4579", departmentId: "div-2", role: "Supervisor" },
      { name: "Asanda", email: "asanda@terminators.co.za", phone: "+27 41 123 4581", departmentId: "div-2", role: "Sanitary Bin Technician" },
      
      // Washroom Services Team
      { name: "Zain Abdol", email: "zain@terminators.co.za", phone: "+27 41 123 4582", departmentId: "div-3", role: "Supervisor" },
      { name: "Siphokazi", email: "siphokazi@terminators.co.za", phone: "+27 41 123 4583", departmentId: "div-3", role: "Washroom Technician" },
      { name: "Zuki Sandi", email: "zuki@terminators.co.za", phone: "+27 41 123 4584", departmentId: "div-4", role: "Deep Cleaning Specialist" },
      { name: "Nini", email: "nini@terminators.co.za", phone: "+27 41 123 4586", departmentId: "div-4", role: "Deep Cleaning Specialist" },
      { name: "Veronica", email: "veronica@terminators.co.za", phone: "+27 41 123 4587", departmentId: "div-4", role: "Deep Cleaning Specialist" },
      { name: "Margrett", email: "margrett@terminators.co.za", phone: "+27 41 123 4588", departmentId: "div-4", role: "Deep Cleaning Specialist" },
      { name: "Babalwa", email: "babalwa@terminators.co.za", phone: "+27 41 123 4589", departmentId: "div-4", role: "Deep Cleaning Specialist" }
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

    // Create sample clients across all departments
    const clients = [
      // Retail Clients - Multiple departments
      { name: "Pick n Pay Greenacres", address: "Greenacres Shopping Centre, Port Elizabeth", phone: "+27 41 234 5678", email: "manager@pnp-greenacres.co.za", businessType: "retail", departmentId: "div-1" },
      { name: "Shoprite Checkers Walmer", address: "Walmer Park Shopping Centre, Port Elizabeth", phone: "+27 41 234 5679", email: "admin@shoprite.co.za", businessType: "retail", departmentId: "div-2" },
      { name: "Baywest Mall", address: "Baywest City, Port Elizabeth", phone: "+27 41 234 5680", email: "facilities@baywest.co.za", businessType: "retail", departmentId: "div-3" },
      { name: "Boardwalk Casino", address: "Marine Drive, Summerstrand, Port Elizabeth", phone: "+27 41 234 5681", email: "maintenance@boardwalk.co.za", businessType: "hospitality", departmentId: "div-4" },
      
      // Restaurant Clients - Pest Control focus
      { name: "McDonald's Greenacres", address: "Greenacres Shopping Centre, Port Elizabeth", phone: "+27 41 234 5682", email: "manager@mcdonalds-ge.co.za", businessType: "restaurant", departmentId: "div-1" },
      { name: "KFC Newton Park", address: "Newton Park Shopping Centre, Port Elizabeth", phone: "+27 41 234 5683", email: "store@kfc-newton.co.za", businessType: "restaurant", departmentId: "div-1" },
      { name: "Steers Summerstrand", address: "Beach Road, Summerstrand, Port Elizabeth", phone: "+27 41 234 5684", email: "manager@steers-summ.co.za", businessType: "restaurant", departmentId: "div-1" },
      
      // Office Buildings - Washroom & Deep Cleaning
      { name: "Mutual Heights Office Park", address: "Heugh Road, Walmer, Port Elizabeth", phone: "+27 41 234 5685", email: "facilities@mutualheights.co.za", businessType: "office", departmentId: "div-3" },
      { name: "Baywest Office Tower", address: "Baywest City, Port Elizabeth", phone: "+27 41 234 5686", email: "admin@baywestoffice.co.za", businessType: "office", departmentId: "div-4" },
      
      // Healthcare Facilities - All services
      { name: "Life Mercantile Hospital", address: "Mercantile Hospital Street, Port Elizabeth", phone: "+27 41 234 5687", email: "facilities@lifemercantile.co.za", businessType: "healthcare", departmentId: "div-2" },
      { name: "Netcare Greenacres", address: "Greenacres, Port Elizabeth", phone: "+27 41 234 5688", email: "admin@netcare-ge.co.za", businessType: "healthcare", departmentId: "div-4" },
      
      // Schools - Multiple departments
      { name: "Grey High School", address: "West Hill, Port Elizabeth", phone: "+27 41 234 5689", email: "admin@greyhigh.co.za", businessType: "education", departmentId: "div-2" },
      { name: "Collegiate Girls High", address: "Mount Pleasant, Port Elizabeth", phone: "+27 41 234 5690", email: "facilities@collegiate.co.za", businessType: "education", departmentId: "div-3" },
      
      // Manufacturing - Deep Cleaning & Pest Control
      { name: "Volkswagen SA", address: "Uitenhage Road, Port Elizabeth", phone: "+27 41 234 5691", email: "facilities@vw.co.za", businessType: "manufacturing", departmentId: "div-4" },
      { name: "General Motors SA", address: "Struandale, Port Elizabeth", phone: "+27 41 234 5692", email: "maintenance@gm.co.za", businessType: "manufacturing", departmentId: "div-1" }
    ];

    clients.forEach((client, index) => {
      const c: Client = {
        id: `client-${index + 1}`,
        status: "active",
        taxNumber: null,
        creditLimit: null,
        contactPerson: null,
        paymentTerms: "30 days",
        notes: null,
        updatedAt: new Date(),
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
        departmentId: "div-3",
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
        departmentId: "div-3",
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
        departmentId: "div-3",
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
        departmentId: "div-3",
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
        departmentId: "div-1",
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
        departmentId: "div-1",
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
        departmentId: "div-3",
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
        departmentId: "div-3",
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
        departmentId: "div-2",
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
        departmentId: "div-2",
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
        departmentId: "div-3",
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
        departmentId: "div-4",
        location: "Equipment Bay - Section E",
        supplier: "SteamTech Professional",
        lastRestocked: new Date('2025-08-01')
      },
      // More Deep Cleaning Equipment
      {
        name: "Carpet Cleaning Machine - Industrial",
        type: "rental_equipment",
        sku: "CCM-IND-001",
        quantity: 3,
        minStockLevel: 1,
        maxStockLevel: 8,
        reorderPoint: 2,
        unitPrice: "1200.00",
        description: "Industrial carpet cleaning machine with extraction system",
        departmentId: "div-4",
        location: "Equipment Bay - Section D",
        supplier: "CleanTech Equipment",
        lastRestocked: new Date('2025-08-03')
      },
      {
        name: "Floor Polisher - Commercial",
        type: "rental_equipment", 
        sku: "FP-COM-001",
        quantity: 6,
        minStockLevel: 2,
        maxStockLevel: 12,
        reorderPoint: 4,
        unitPrice: "450.00",
        description: "Heavy-duty floor polisher for commercial spaces",
        departmentId: "div-4",
        location: "Equipment Bay - Section C",
        supplier: "FloorCare Pro",
        lastRestocked: new Date('2025-08-07')
      },
      {
        name: "Glass Cleaner - Professional Grade",
        type: "product",
        sku: "GC-PRO-001",
        quantity: 12,
        minStockLevel: 20,
        maxStockLevel: 100,
        reorderPoint: 30,
        unitPrice: "25.00",
        description: "Streak-free professional glass cleaner, 5L container",
        departmentId: "div-4",
        location: "Chemical Storage - Section B",
        supplier: "GlassTech Solutions",
        lastRestocked: new Date('2025-08-09')
      },
      {
        name: "Pressure Washer - Heavy Duty",
        type: "rental_equipment",
        sku: "PW-HD-001", 
        quantity: 2,
        minStockLevel: 1,
        maxStockLevel: 5,
        reorderPoint: 2,
        unitPrice: "950.00",
        description: "High-pressure washer for exterior deep cleaning",
        departmentId: "div-4",
        location: "Equipment Bay - Outdoor Section",
        supplier: "PressureClean Systems",
        lastRestocked: new Date('2025-08-11')
      },
      // Additional Pest Control Items
      {
        name: "Insecticide Spray - Professional",
        type: "product",
        sku: "IS-PRO-001",
        quantity: 15,
        minStockLevel: 25,
        maxStockLevel: 150,
        reorderPoint: 35,
        unitPrice: "42.00",
        description: "Professional-grade insecticide spray, 1L bottle",
        departmentId: "div-1",
        location: "Secure Storage - Locked Cabinet B",
        supplier: "PestGuard Professional",
        lastRestocked: new Date('2025-08-13')
      },
      {
        name: "Termite Detection Kit",
        type: "product",
        sku: "TDK-001",
        quantity: 8,
        minStockLevel: 5,
        maxStockLevel: 30,
        reorderPoint: 10,
        unitPrice: "125.00",
        description: "Professional termite detection and monitoring kit",
        departmentId: "div-1",
        location: "Pest Control Storage - Shelf A",
        supplier: "TermiteGuard Systems",
        lastRestocked: new Date('2025-08-06')
      },
      // Additional Sanitary Bin Items
      {
        name: "Feminine Hygiene Disposal Unit",
        type: "rental_equipment",
        sku: "FHDU-001",
        quantity: 20,
        minStockLevel: 15,
        maxStockLevel: 60,
        reorderPoint: 25,
        unitPrice: "95.00",
        description: "Discrete feminine hygiene disposal unit with odor control",
        departmentId: "div-2",
        location: "Sanitary Equipment - Rack C",
        supplier: "HygieneTech Solutions",
        lastRestocked: new Date('2025-08-14')
      },
      {
        name: "Disinfectant Spray - Hospital Grade",
        type: "product",
        sku: "DS-HG-001",
        quantity: 18,
        minStockLevel: 30,
        maxStockLevel: 150,
        reorderPoint: 45,
        unitPrice: "32.00",
        description: "Hospital-grade disinfectant spray for sanitary equipment",
        departmentId: "div-2",
        location: "Chemical Storage - Section A",
        supplier: "MediClean Supplies",
        lastRestocked: new Date('2025-08-12')
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

    // Create comprehensive sample jobs across all departments
    // Use dates relative to now so today/this week filters always show data
    const now = new Date();
    const d = (offsetDays: number) => {
      const dt = new Date(now);
      dt.setDate(dt.getDate() + offsetDays);
      dt.setHours(8, 0, 0, 0);
      return dt;
    };

    const sampleJobs = [
      // Pest Control Jobs
      {
        id: "job-1",
        clientId: "client-5",
        workerId: "worker-7",
        departmentId: "div-1",
        title: "Monthly Pest Control Inspection",
        description: "Routine monthly pest control inspection and treatment for restaurant kitchen and dining areas",
        status: "scheduled",
        priority: "medium",
        scheduledDate: d(1),
        estimatedDuration: 120,
        location: "Greenacres Shopping Centre, Port Elizabeth",
        notes: "Focus on kitchen areas and waste disposal zones",
        createdAt: d(-5)
      },
      {
        id: "job-2",
        clientId: "client-6",
        workerId: "worker-8",
        departmentId: "div-1",
        title: "Emergency Rodent Control",
        description: "Emergency call for rodent infestation in storage area",
        status: "in_progress",
        priority: "high",
        scheduledDate: d(0),
        estimatedDuration: 180,
        location: "Newton Park Shopping Centre, Port Elizabeth",
        notes: "Customer reported rodent droppings in storage room",
        createdAt: d(-1)
      },
      {
        id: "job-3",
        clientId: "client-15",
        workerId: "worker-9",
        departmentId: "div-1",
        title: "Industrial Pest Assessment",
        description: "Comprehensive pest risk assessment for manufacturing facility",
        status: "completed",
        priority: "high",
        scheduledDate: d(-3),
        completedDate: d(-3),
        estimatedDuration: 240,
        actualDuration: 210,
        location: "Struandale, Port Elizabeth",
        notes: "Full facility assessment completed. Report submitted.",
        createdAt: d(-5)
      },
      {
        id: "job-4",
        clientId: "client-7",
        workerId: "worker-10",
        departmentId: "div-1",
        title: "Restaurant Kitchen Fumigation",
        description: "Full kitchen area fumigation and treatment",
        status: "scheduled",
        priority: "medium",
        scheduledDate: d(3),
        estimatedDuration: 90,
        location: "Summerstrand, Port Elizabeth",
        notes: "After-hours treatment required",
        createdAt: d(-2)
      },

      // Sanitary Bin Service Jobs
      {
        id: "job-5",
        clientId: "client-2",
        workerId: "worker-13",
        departmentId: "div-2",
        title: "Weekly Sanitary Bin Service",
        description: "Weekly collection and maintenance of sanitary disposal units",
        status: "scheduled",
        priority: "medium",
        scheduledDate: d(2),
        estimatedDuration: 90,
        location: "Walmer Park Shopping Centre, Port Elizabeth",
        notes: "Service all female restroom facilities",
        createdAt: d(-3)
      },
      {
        id: "job-6",
        clientId: "client-11",
        workerId: "worker-14",
        departmentId: "div-2",
        title: "Hospital Sanitary Service",
        description: "Bi-weekly sanitary bin service for hospital facilities",
        status: "in_progress",
        priority: "high",
        scheduledDate: d(0),
        estimatedDuration: 150,
        location: "Mercantile Hospital Street, Port Elizabeth",
        notes: "Include maternity and general wards",
        createdAt: d(-2)
      },
      {
        id: "job-7",
        clientId: "client-12",
        workerId: "worker-15",
        departmentId: "div-2",
        title: "School Hygiene Program Setup",
        description: "Installation and setup of sanitary disposal units for new term",
        status: "completed",
        priority: "medium",
        scheduledDate: d(-4),
        completedDate: d(-4),
        estimatedDuration: 180,
        actualDuration: 150,
        location: "West Hill, Port Elizabeth",
        notes: "20 units installed across girl's facilities. Training provided.",
        createdAt: d(-6)
      },

      // Washroom Service Jobs
      {
        id: "job-8",
        clientId: "client-3",
        workerId: "worker-20",
        departmentId: "div-3",
        title: "Mall Washroom Maintenance",
        description: "Daily washroom cleaning and supply replenishment",
        status: "scheduled",
        priority: "medium",
        scheduledDate: d(1),
        estimatedDuration: 240,
        location: "Baywest City, Port Elizabeth",
        notes: "Cover all public washroom facilities in mall",
        createdAt: d(-2)
      },
      {
        id: "job-9",
        clientId: "client-8",
        workerId: "worker-21",
        departmentId: "div-3",
        title: "Office Washroom Deep Clean",
        description: "Quarterly deep cleaning of office building washroom facilities",
        status: "in_progress",
        priority: "medium",
        scheduledDate: d(0),
        estimatedDuration: 180,
        location: "Heugh Road, Walmer, Port Elizabeth",
        notes: "Focus on tile cleaning and grout restoration",
        createdAt: d(-1)
      },
      {
        id: "job-10",
        clientId: "client-13",
        workerId: "worker-19",
        departmentId: "div-3",
        title: "School Washroom Upgrade",
        description: "Installation of new paper towel dispensers and soap dispensers",
        status: "completed",
        priority: "high",
        scheduledDate: d(-5),
        completedDate: d(-5),
        estimatedDuration: 300,
        actualDuration: 270,
        location: "Mount Pleasant, Port Elizabeth",
        notes: "15 new dispensers installed. Old equipment removed.",
        createdAt: d(-7)
      },

      // Deep Cleaning Jobs
      {
        id: "job-11",
        clientId: "client-4",
        workerId: "worker-23",
        departmentId: "div-4",
        title: "Casino Deep Clean Service",
        description: "Monthly deep cleaning of casino floor and VIP areas",
        status: "scheduled",
        priority: "high",
        scheduledDate: d(4),
        estimatedDuration: 480,
        location: "Marine Drive, Summerstrand, Port Elizabeth",
        notes: "Night shift operation. Casino remains operational.",
        createdAt: d(-3)
      },
      {
        id: "job-12",
        clientId: "client-14",
        workerId: "worker-24",
        departmentId: "div-4",
        title: "Factory Floor Deep Clean",
        description: "Industrial deep cleaning of production floor and equipment",
        status: "in_progress",
        priority: "high",
        scheduledDate: d(0),
        estimatedDuration: 360,
        location: "Uitenhage Road, Port Elizabeth",
        notes: "Coordinate with production schedule. Safety protocols required.",
        createdAt: d(-2)
      },
      {
        id: "job-13",
        clientId: "client-10",
        workerId: "worker-22",
        departmentId: "div-4",
        title: "Office Building Window Cleaning",
        description: "External and internal window cleaning for 15-story office building",
        status: "completed",
        priority: "medium",
        scheduledDate: d(-6),
        completedDate: d(-6),
        estimatedDuration: 600,
        actualDuration: 540,
        location: "Baywest City, Port Elizabeth",
        notes: "Weather conditions excellent. All floors completed ahead of schedule.",
        createdAt: d(-8)
      }
    ];

    // Add all sample jobs
    sampleJobs.forEach(job => {
      this.jobs.set(job.id, {
        ...job,
        serviceType: "scheduled",
        scheduledTime: null,
        startTime: null,
        endTime: null,
        completionNotes: null,
        isRecurring: false,
        recurringPattern: null,
        parentJobId: null,
        diary: null,
        howInvoiced: null,
        email: null,
        areaCode: null,
        salesperson: null,
        contractNo: null,
        isContract: false,
        service: null,
        insects: null,
        price: null,
        pricePerUnit: null,
        increaseDate: null,
        specialInstructions: null,
        internalInstructions: null,
        isFixed: false,
        orderNo: null,
        recurrenceInterval: null,
        recurrencePeriod: null,
        recurrenceDay: null,
        recurrenceCount: null,
        recurrenceYears: null,
        description: (job as any).description || null,
        completedDate: (job as any).completedDate || null,
        actualDuration: (job as any).actualDuration || null,
        updatedAt: new Date()
      } as Job);
    });

    // Create sample rental contracts
    const rentalContracts = [
      {
        id: "rc-1",
        clientId: "client-1",
        inventoryItemId: "inv-1",
        monthlyPrice: "2500.00",
        startDate: new Date(now.getFullYear(), now.getMonth() - 6, 1),
        endDate: new Date(now.getFullYear() + 1, now.getMonth() - 6, 1),
        isActive: true,
        notes: "Monthly paper towel dispenser rental - Pick n Pay Greenacres",
      },
      {
        id: "rc-2",
        clientId: "client-2",
        inventoryItemId: "inv-3",
        monthlyPrice: "1800.00",
        startDate: new Date(now.getFullYear(), now.getMonth() - 4, 1),
        endDate: new Date(now.getFullYear() + 1, now.getMonth() - 4, 1),
        isActive: true,
        notes: "Hand sanitizer stations rental - Shoprite Walmer",
      },
      {
        id: "rc-3",
        clientId: "client-5",
        inventoryItemId: "inv-5",
        monthlyPrice: "3200.00",
        startDate: new Date(now.getFullYear(), now.getMonth() - 8, 1),
        endDate: new Date(now.getFullYear(), now.getMonth() + 1, 1), // expires next month
        isActive: true,
        notes: "Pest control station rental - McDonald's Greenacres",
      },
      {
        id: "rc-4",
        clientId: "client-4",
        inventoryItemId: "inv-7",
        monthlyPrice: "4500.00",
        startDate: new Date(now.getFullYear(), now.getMonth() - 3, 1),
        endDate: new Date(now.getFullYear() + 1, now.getMonth() - 3, 1),
        isActive: true,
        notes: "Washroom cleaning service contract - Boardwalk Casino",
      },
      {
        id: "rc-5",
        clientId: "client-10",
        inventoryItemId: "inv-8",
        monthlyPrice: "1950.00",
        startDate: new Date(now.getFullYear(), now.getMonth() - 2, 1),
        endDate: new Date(now.getFullYear() + 1, now.getMonth() - 2, 1),
        isActive: true,
        notes: "Feminine hygiene disposal unit rental - Baywest Office Tower",
      },
      {
        id: "rc-6",
        clientId: "client-11",
        inventoryItemId: "inv-4",
        monthlyPrice: "5200.00",
        startDate: new Date(now.getFullYear(), now.getMonth() - 5, 1),
        endDate: new Date(now.getFullYear() + 1, now.getMonth() - 5, 1),
        isActive: true,
        notes: "Full hygiene service contract - Life Mercantile Hospital",
      }
    ];

    rentalContracts.forEach(rc => {
      this.rentalContracts.set(rc.id, {
        ...rc,
        lastPriceIncrease: null,
        createdAt: new Date()
      } as RentalContract);
    });

    // Create comprehensive sample invoices
    const sampleInvoices = [
      // Older paid invoices (last month)
      { clientId: "client-1", status: "paid", issueDate: d(-60), dueDate: d(-30), paymentDate: d(-35), subtotal: "2173.91", taxAmount: "326.09", total: "2500.00", paidAmount: "2500.00", notes: "March contract payment - Pick n Pay" },
      { clientId: "client-2", status: "paid", issueDate: d(-55), dueDate: d(-25), paymentDate: d(-28), subtotal: "1565.22", taxAmount: "234.78", total: "1800.00", paidAmount: "1800.00", notes: "March contract payment - Shoprite" },
      { clientId: "client-4", status: "paid", issueDate: d(-50), dueDate: d(-20), paymentDate: d(-22), subtotal: "3913.04", taxAmount: "586.96", total: "4500.00", paidAmount: "4500.00", notes: "March washroom contract - Boardwalk" },
      // Current month paid invoices
      { clientId: "client-11", status: "paid", issueDate: d(-14), dueDate: d(16), paymentDate: d(-5), subtotal: "4521.74", taxAmount: "678.26", total: "5200.00", paidAmount: "5200.00", notes: "April hospital service - Life Mercantile" },
      { clientId: "client-5", status: "paid", issueDate: d(-12), dueDate: d(18), paymentDate: d(-3), subtotal: "1086.96", taxAmount: "163.04", total: "1250.00", paidAmount: "1250.00", notes: "April pest control - McDonald's Greenacres" },
      // This week paid invoices
      { clientId: "client-7", status: "paid", issueDate: d(-6), dueDate: d(24), paymentDate: d(-2), subtotal: "1739.13", taxAmount: "260.87", total: "2000.00", paidAmount: "2000.00", notes: "April sanitary bins - Standard Bank Port Elizabeth" },
      { clientId: "client-9", status: "paid", issueDate: d(-5), dueDate: d(25), paymentDate: d(-1), subtotal: "2608.70", taxAmount: "391.30", total: "3000.00", paidAmount: "3000.00", notes: "April deep clean - Greenacres Shopping Centre" },
      // Today paid
      { clientId: "client-3", status: "paid", issueDate: d(-3), dueDate: d(27), paymentDate: d(0), subtotal: "3478.26", taxAmount: "521.74", total: "4000.00", paidAmount: "4000.00", notes: "April washroom contract - Baywest Mall" },
      // Outstanding/sent
      { clientId: "client-1", status: "sent", issueDate: d(-15), dueDate: d(15), subtotal: "2173.91", taxAmount: "326.09", total: "2500.00", paidAmount: "0.00", notes: "April contract payment - Pick n Pay" },
      { clientId: "client-2", status: "sent", issueDate: d(-10), dueDate: d(20), subtotal: "1565.22", taxAmount: "234.78", total: "1800.00", paidAmount: "0.00", notes: "April contract payment - Shoprite" },
      { clientId: "client-5", status: "sent", issueDate: d(-8), dueDate: d(22), subtotal: "2782.61", taxAmount: "417.39", total: "3200.00", paidAmount: "0.00", notes: "April pest control rental - McDonald's" },
      { clientId: "client-3", status: "overdue", issueDate: d(-45), dueDate: d(-15), subtotal: "2608.70", taxAmount: "391.30", total: "3000.00", paidAmount: "0.00", notes: "February washroom service - Baywest Mall" },
      { clientId: "client-12", status: "overdue", issueDate: d(-40), dueDate: d(-10), subtotal: "1304.35", taxAmount: "195.65", total: "1500.00", paidAmount: "0.00", notes: "February hygiene - Grey High School" },
      { clientId: "client-11", status: "paid", issueDate: d(-35), dueDate: d(-5), paymentDate: d(-8), subtotal: "4521.74", taxAmount: "678.26", total: "5200.00", paidAmount: "5200.00", notes: "March hospital service - Life Mercantile" },
      { clientId: "client-6", status: "draft", issueDate: d(-2), dueDate: d(28), subtotal: "652.17", taxAmount: "97.83", total: "750.00", paidAmount: "0.00", notes: "April rodent control - KFC Newton Park" },
    ];

    sampleInvoices.forEach((inv, i) => {
      const id = `sinv-${i + 1}`;
      this.invoices.set(id, {
        id,
        invoiceNumber: `INV-${now.getFullYear()}-${String(i + 4).padStart(4, '0')}`,
        clientId: inv.clientId,
        status: inv.status,
        issueDate: inv.issueDate,
        dueDate: inv.dueDate,
        subtotal: inv.subtotal,
        taxAmount: inv.taxAmount,
        total: inv.total,
        paidAmount: inv.paidAmount,
        paymentDate: (inv as any).paymentDate || null,
        notes: inv.notes,
        terms: "Payment due within 30 days",
        createdAt: new Date(),
        updatedAt: new Date(),
        sageInvoiceId: null,
        sageStatus: null
      } as Invoice);
    });

    // Seed sample quote submissions
    const sampleQuotes: QuoteSubmission[] = [
      {
        id: "quote-1",
        companyName: "Spar Newton Park",
        contactPerson: "Johan Myburgh",
        email: "jmyburgh@spar-np.co.za",
        phone: "+27 41 365 1234",
        serviceType: "pest_control",
        description: "Looking for monthly pest control contract for supermarket. Approximately 800sqm. Kitchen, storage and shopfloor included.",
        address: "Newton Park Shopping Centre, Port Elizabeth",
        preferredContactMethod: "phone",
        status: "new",
        assignedTo: null,
        notes: null,
        submittedAt: d(-1),
        followUpDate: d(2),
      },
      {
        id: "quote-2",
        companyName: "Greenacres Medical Centre",
        contactPerson: "Dr. Sandra Botha",
        email: "admin@greenacresmed.co.za",
        phone: "+27 41 374 5678",
        serviceType: "sanitary_bins",
        description: "Medical facility requires sanitary bin service for 6 female restrooms. Bi-weekly collection preferred.",
        address: "Greenacres, Port Elizabeth",
        preferredContactMethod: "email",
        status: "contacted",
        assignedTo: "worker-2",
        notes: "Spoke with Dr Botha on Monday. Sending quote by Wednesday.",
        submittedAt: d(-4),
        followUpDate: d(1),
      },
      {
        id: "quote-3",
        companyName: "Bay Harbour Hotel",
        contactPerson: "Thandi Nkosi",
        email: "t.nkosi@bayharbour.co.za",
        phone: "+27 41 583 9000",
        serviceType: "washroom",
        description: "Full washroom maintenance required for 4-star hotel. 35 guest rooms, 2 conference suites, pool area. Daily service needed.",
        address: "Marine Drive, Summerstrand, Port Elizabeth",
        preferredContactMethod: "either",
        status: "quoted",
        assignedTo: "worker-2",
        notes: "Quote sent: R8,500/month for full washroom service. Awaiting sign-off from GM.",
        submittedAt: d(-7),
        followUpDate: d(3),
      },
      {
        id: "quote-4",
        companyName: "Nelson Mandela University",
        contactPerson: "Facilities Manager",
        email: "facilities@nmu.ac.za",
        phone: "+27 41 504 1111",
        serviceType: "deep_cleaning",
        description: "Semester-end deep clean of 3 lecture blocks and library. Approximately 4,200sqm. Must be done over year-end break.",
        address: "University Way, Summerstrand, Port Elizabeth",
        preferredContactMethod: "email",
        status: "new",
        assignedTo: null,
        notes: null,
        submittedAt: d(0),
        followUpDate: d(5),
      },
      {
        id: "quote-5",
        companyName: "Woolworths Food - Walmer Park",
        contactPerson: "Store Manager",
        email: "manager@ww-walmer.co.za",
        phone: "+27 41 368 2200",
        serviceType: "pest_control",
        description: "Existing Woolworths store needing pest control upgrade. Current supplier underperforming. Monthly contract.",
        address: "Walmer Park Shopping Centre, Port Elizabeth",
        preferredContactMethod: "phone",
        status: "contacted",
        assignedTo: "worker-2",
        notes: "Very interested — follow up Friday with site visit proposal.",
        submittedAt: d(-3),
        followUpDate: d(4),
      },
    ];

    sampleQuotes.forEach(q => {
      this.quoteSubmissions.set(q.id, q);
    });

    // Seed current-period purchase orders (expenses)
    const samplePOs: PurchaseOrder[] = [
      // Today
      { id: "po-seed-1", poNumber: "PO-TODAY-001", supplierId: "supplier-1", requestedById: "user-1", approvedById: "user-1", status: "approved", totalAmount: "1850.00", requestDate: d(0), approvalDate: d(0), expectedDeliveryDate: d(3), actualDeliveryDate: null, sentDate: null, notes: "Pesticide restock - daily run", rejectionReason: null, createdAt: d(0), updatedAt: d(0) },
      { id: "po-seed-2", poNumber: "PO-TODAY-002", supplierId: "supplier-2", requestedById: "user-1", approvedById: null, status: "pending", totalAmount: "640.00", requestDate: d(0), approvalDate: null, expectedDeliveryDate: d(5), actualDeliveryDate: null, sentDate: null, notes: "Sanitary bag restocking", rejectionReason: null, createdAt: d(0), updatedAt: d(0) },
      // This week
      { id: "po-seed-3", poNumber: "PO-WEEK-001", supplierId: "supplier-1", requestedById: "user-1", approvedById: "user-1", status: "received", totalAmount: "3200.00", requestDate: d(-2), approvalDate: d(-2), sentDate: d(-1), expectedDeliveryDate: d(0), actualDeliveryDate: d(0), notes: "Monthly washroom supplies - soaps & dispensers", rejectionReason: null, createdAt: d(-2), updatedAt: d(0) },
      { id: "po-seed-4", poNumber: "PO-WEEK-002", supplierId: "supplier-3", requestedById: "user-1", approvedById: "user-1", status: "approved", totalAmount: "1420.00", requestDate: d(-3), approvalDate: d(-3), expectedDeliveryDate: d(2), actualDeliveryDate: null, sentDate: null, notes: "Deep cleaning chemicals - April stock", rejectionReason: null, createdAt: d(-3), updatedAt: d(-3) },
      { id: "po-seed-5", poNumber: "PO-WEEK-003", supplierId: "supplier-2", requestedById: "user-1", approvedById: "user-1", status: "sent", totalAmount: "975.00", requestDate: d(-4), approvalDate: d(-4), sentDate: d(-3), expectedDeliveryDate: d(1), actualDeliveryDate: null, notes: "PPE gloves and masks - field staff", rejectionReason: null, createdAt: d(-4), updatedAt: d(-3) },
      // This month (earlier)
      { id: "po-seed-6", poNumber: "PO-MONTH-001", supplierId: "supplier-1", requestedById: "user-1", approvedById: "user-1", status: "received", totalAmount: "5500.00", requestDate: d(-10), approvalDate: d(-10), sentDate: d(-9), expectedDeliveryDate: d(-7), actualDeliveryDate: d(-7), notes: "Bulk rodenticide order for Q2", rejectionReason: null, createdAt: d(-10), updatedAt: d(-7) },
      { id: "po-seed-7", poNumber: "PO-MONTH-002", supplierId: "supplier-3", requestedById: "user-1", approvedById: "user-1", status: "received", totalAmount: "2800.00", requestDate: d(-14), approvalDate: d(-13), sentDate: d(-12), expectedDeliveryDate: d(-10), actualDeliveryDate: d(-10), notes: "Washroom paper product replenishment", rejectionReason: null, createdAt: d(-14), updatedAt: d(-10) },
      { id: "po-seed-8", poNumber: "PO-MONTH-003", supplierId: "supplier-2", requestedById: "user-1", approvedById: "user-1", status: "approved", totalAmount: "1650.00", requestDate: d(-7), approvalDate: d(-7), expectedDeliveryDate: d(3), actualDeliveryDate: null, sentDate: null, notes: "Vehicle cleaning supplies - fleet", rejectionReason: null, createdAt: d(-7), updatedAt: d(-7) },
    ];

    samplePOs.forEach(po => {
      if (!this.purchaseOrders.has(po.id)) {
        this.purchaseOrders.set(po.id, po);
      }
    });
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

  // Departments
  async getDepartments(): Promise<Department[]> {
    return Array.from(this.departments.values());
  }

  async getDepartment(id: string): Promise<Department | undefined> {
    return this.departments.get(id);
  }

  async createDepartment(insertDepartment: InsertDepartment): Promise<Department> {
    const id = randomUUID();
    const department: Department = { 
      ...insertDepartment, 
      id,
      description: insertDepartment.description || null
    };
    this.departments.set(id, department);
    return department;
  }

  // Workers
  async getWorkers(): Promise<Worker[]> {
    return Array.from(this.workers.values());
  }

  async getWorker(id: string): Promise<Worker | undefined> {
    return this.workers.get(id);
  }

  async getWorkerByEmployeeId(employeeId: string): Promise<Worker | undefined> {
    return Array.from(this.workers.values()).find(w => w.employeeId === employeeId);
  }

  async getWorkersByDepartment(departmentId: string): Promise<Worker[]> {
    return Array.from(this.workers.values()).filter(worker => worker.departmentId === departmentId);
  }

  async createWorker(insertWorker: InsertWorker): Promise<Worker> {
    const id = randomUUID();
    const worker: Worker = { 
      ...insertWorker, 
      id, 
      createdAt: new Date(),
      isActive: insertWorker.isActive ?? true,
      role: insertWorker.role || null
    };
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
    console.log("MemStorage: Creating client with data:", JSON.stringify(insertClient));
    const id = randomUUID();
    const client: Client = { 
      ...insertClient, 
      id, 
      createdAt: new Date(),
      contactPerson: insertClient.contactPerson || null,
      email: insertClient.email || null,
      phone: insertClient.phone || null,
      address: insertClient.address || null,
      paymentTerms: insertClient.paymentTerms || null,
      notes: insertClient.notes || null,
      website: (insertClient as any).website || null,
      category: (insertClient as any).category || null,
      updatedAt: new Date()
    };
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

  async getInventoryItemsByDepartment(departmentId: string): Promise<InventoryItem[]> {
    return Array.from(this.inventoryItems.values()).filter(item => item.departmentId === departmentId);
  }

  async createInventoryItem(insertItem: InsertInventoryItem): Promise<InventoryItem> {
    const id = randomUUID();
    const item: InventoryItem = { 
      ...insertItem, 
      id, 
      createdAt: new Date(),
      departmentId: insertItem.departmentId || null,
      description: insertItem.description || null,
      supplier: insertItem.supplier || null,
      location: insertItem.location || null,
      unitPrice: insertItem.unitPrice || null,
      lastRestocked: insertItem.lastRestocked || null
    };
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

    // Revenue calculation from completed jobs (using related invoices)
    const completedJobIds = new Set(completedJobs.map(job => job.id));
    const relatedInvoices = Array.from(this.invoices.values()).filter(invoice => 
      invoice.status === 'paid'
    );
    const revenue = relatedInvoices.reduce((total, invoice) => {
      return total + parseFloat(invoice.total);
    }, 0);

    // Invoice metrics
    const allInvoices = Array.from(this.invoices.values());
    const periodInvoices = allInvoices.filter(invoice => 
      invoice.issueDate && new Date(invoice.issueDate) >= startDate
    );
    
    const invoicedAmount = periodInvoices.reduce((total, invoice) => 
      total + parseFloat(invoice.total), 0
    );
    
    const paidInvoices = periodInvoices.filter(invoice => invoice.status === 'paid');
    const paidAmount = paidInvoices.reduce((total, invoice) => 
      total + parseFloat(invoice.total), 0
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

      // Calculate revenue from invoices for this period instead of jobs
      const periodInvoices = Array.from(this.invoices.values()).filter(invoice => {
        const invoiceDate = new Date(invoice.issueDate);
        return invoiceDate >= startDate && invoiceDate <= endDate && invoice.status === 'paid';
      });
      
      const revenue = periodInvoices.reduce((total, invoice) => {
        return total + parseFloat(invoice.total);
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
    const contract: RentalContract = { 
      ...insertContract, 
      id, 
      createdAt: new Date(),
      isActive: insertContract.isActive ?? true,
      notes: insertContract.notes || null,
      endDate: insertContract.endDate || null,
      lastPriceIncrease: insertContract.lastPriceIncrease || null
    };
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

  async getJobsByDepartment(departmentId: string): Promise<Job[]> {
    return Array.from(this.jobs.values()).filter(job => job.departmentId === departmentId);
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

  async getJobsByDepartmentAndDateRange(departmentId: string, startDate: Date, endDate: Date): Promise<(Job & { client: Client; worker: Worker; inventoryItems: (JobInventoryItem & { inventoryItem: InventoryItem })[] })[]> {
    const jobs = Array.from(this.jobs.values()).filter(job => {
      const jobDate = new Date(job.scheduledDate);
      return job.departmentId === departmentId && jobDate >= startDate && jobDate <= endDate;
    });

    // Enrich jobs with client, worker, and inventory item details
    const enrichedJobs = jobs.map(job => {
      const client = this.clients.get(job.clientId);
      const worker = this.workers.get(job.workerId);
      
      // Get job inventory items with full inventory item details
      const jobInventoryItems = Array.from(this.jobInventoryItems.values())
        .filter(item => item.jobId === job.id)
        .map(jobItem => {
          const inventoryItem = this.inventoryItems.get(jobItem.inventoryItemId);
          return {
            ...jobItem,
            inventoryItem: inventoryItem || {
              id: jobItem.inventoryItemId,
              name: 'Unknown Item',
              description: '',
              sku: '',
              type: 'unknown',
              departmentId: '',
              unit: '',
              currentStock: 0,
              minStock: 0,
              maxStock: 0,
              unitCost: 0,
              supplierInfo: '',
              createdAt: new Date(),
              updatedAt: new Date()
            }
          };
        });

      return {
        ...job,
        client: client || {
          id: job.clientId,
          name: 'Unknown Client',
          contactPerson: '',
          phone: '',
          email: '',
          address: '',
          notes: '',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        worker: worker || {
          id: job.workerId,
          name: 'Unknown Worker',
          email: '',
          phone: '',
          departmentId: job.departmentId,
          role: 'technician',
          employeeId: '',
          pin: '',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        inventoryItems: jobInventoryItems
      };
    });

    return enrichedJobs;
  }

  async createJob(insertJob: InsertJob): Promise<Job> {
    const id = randomUUID();
    const now = new Date();
    const job: Job = { 
      ...insertJob, 
      id, 
      createdAt: now, 
      updatedAt: now,
      notes: insertJob.notes || null,
      description: insertJob.description || null,
      location: insertJob.location || null,
      serviceType: insertJob.serviceType || null,
      estimatedDuration: insertJob.estimatedDuration || null,
      actualDuration: insertJob.actualDuration || null,
      startTime: insertJob.startTime || null,
      endTime: insertJob.endTime || null,
      completedDate: insertJob.completedDate || null,
      parentJobId: insertJob.parentJobId || null
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

  async getJobsForWorker(workerId: string): Promise<(Job & { client: Client })[]> {
    const workerJobs = Array.from(this.jobs.values()).filter(job => job.workerId === workerId);
    const result: (Job & { client: Client })[] = [];
    
    for (const job of workerJobs) {
      const client = this.clients.get(job.clientId);
      if (client) {
        result.push({ ...job, client });
      }
    }
    
    return result;
  }

  async updateJobStatus(jobId: string, status: string): Promise<Job> {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error("Job not found");
    
    const updatedJob = { ...job, status };
    this.jobs.set(jobId, updatedJob);
    return updatedJob;
  }

  async getJobCardData(jobId: string): Promise<(Job & { client: Client, worker: Worker, department: Department, inventoryItems: (JobInventoryItem & { inventoryItem: InventoryItem })[] }) | undefined> {
    const job = this.jobs.get(jobId);
    if (!job) return undefined;

    const client = this.clients.get(job.clientId);
    if (!client) return undefined;

    const worker = job.workerId ? this.workers.get(job.workerId) : undefined;
    if (!worker) return undefined;

    const department = this.departments.get(job.departmentId);
    if (!department) return undefined;

    // Get job inventory items
    const jobInventoryItems = Array.from(this.jobInventoryItems.values())
      .filter(item => item.jobId === jobId);
    
    const inventoryItems: (JobInventoryItem & { inventoryItem: InventoryItem })[] = [];
    for (const jobItem of jobInventoryItems) {
      const inventoryItem = this.inventoryItems.get(jobItem.inventoryItemId);
      if (inventoryItem) {
        inventoryItems.push({ ...jobItem, inventoryItem });
      }
    }

    return {
      ...job,
      client,
      worker,
      department,
      inventoryItems
    };
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
      updatedAt: now,
      notes: insertInvoice.notes || null,
      paymentDate: insertInvoice.paymentDate || null,
      terms: insertInvoice.terms || null
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
    const item: InvoiceItem = { 
      ...insertItem, 
      id,
      inventoryItemId: insertItem.inventoryItemId || null,
      jobId: insertItem.jobId || null,
      contractId: insertItem.contractId || null
    };
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
    const supplier: Supplier = { 
      ...insertSupplier, 
      id, 
      createdAt: new Date(),
      contactPerson: insertSupplier.contactPerson || null,
      email: insertSupplier.email || null,
      phone: insertSupplier.phone || null,
      address: insertSupplier.address || null,
      website: insertSupplier.website || null,
      departmentId: insertSupplier.departmentId || null,
      paymentTerms: insertSupplier.paymentTerms || null,
      notes: insertSupplier.notes || null
    };
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

  // Calendar Events
  async getCalendarEvents(): Promise<CalendarEvent[]> {
    return Array.from(this.calendarEvents.values());
  }

  async getCalendarEvent(id: string): Promise<CalendarEvent | undefined> {
    return this.calendarEvents.get(id);
  }

  async createCalendarEvent(insertEvent: InsertCalendarEvent): Promise<CalendarEvent> {
    const id = randomUUID();
    const event: CalendarEvent = { 
      ...insertEvent, 
      id, 
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.calendarEvents.set(id, event);
    return event;
  }

  async updateCalendarEvent(id: string, updateData: Partial<InsertCalendarEvent>): Promise<CalendarEvent> {
    const event = this.calendarEvents.get(id);
    if (!event) {
      throw new Error(`Calendar event with id ${id} not found`);
    }
    
    const updatedEvent = { 
      ...event, 
      ...updateData, 
      updatedAt: new Date() 
    };
    this.calendarEvents.set(id, updatedEvent);
    return updatedEvent;
  }

  async deleteCalendarEvent(id: string): Promise<boolean> {
    return this.calendarEvents.delete(id);
  }

  // Custom Reports
  async getCustomReports(): Promise<CustomReport[]> {
    return Array.from(this.customReports.values());
  }

  async getCustomReport(id: string): Promise<CustomReport | undefined> {
    return this.customReports.get(id);
  }

  async getCustomReportsByType(type: string): Promise<CustomReport[]> {
    return Array.from(this.customReports.values()).filter(report => report.reportType === type);
  }

  async createCustomReport(insertReport: InsertCustomReport): Promise<CustomReport> {
    const id = randomUUID();
    const report: CustomReport = { 
      ...insertReport, 
      id, 
      lastRun: null,
      runCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.customReports.set(id, report);
    return report;
  }

  async updateCustomReport(id: string, updateData: Partial<InsertCustomReport>): Promise<CustomReport> {
    const report = this.customReports.get(id);
    if (!report) throw new Error("Custom report not found");
    
    const updatedReport = { ...report, ...updateData, updatedAt: new Date() };
    this.customReports.set(id, updatedReport);
    return updatedReport;
  }

  async deleteCustomReport(id: string): Promise<boolean> {
    return this.customReports.delete(id);
  }

  async runCustomReport(id: string): Promise<any> {
    const report = this.customReports.get(id);
    if (!report) throw new Error("Custom report not found");

    // Update run statistics
    const updatedReport = { 
      ...report, 
      lastRun: new Date(), 
      runCount: (report.runCount || 0) + 1 
    };
    this.customReports.set(id, updatedReport);

    // Parse configuration and filters
    const config = report.configuration ? JSON.parse(report.configuration) : {};
    const filters = report.filters ? JSON.parse(report.filters) : {};

    // Generate report data based on type and template
    let reportData: any = {};

    switch (report.template) {
      case "sales_summary":
        reportData = await this.generateSalesSummaryReport(filters);
        break;
      case "expense_breakdown":
        reportData = await this.generateExpenseBreakdownReport(filters);
        break;
      case "financial_overview":
        reportData = await this.generateFinancialOverviewReport(filters);
        break;
      default:
        reportData = { message: "Custom report template not implemented yet" };
    }

    return {
      reportId: id,
      reportName: report.name,
      generatedAt: new Date(),
      data: reportData,
      filters: filters,
      runCount: updatedReport.runCount
    };
  }

  private async generateSalesSummaryReport(filters: any): Promise<any> {
    const invoices = Array.from(this.invoices.values());
    const clients = Array.from(this.clients.values());
    const divisions = Array.from(this.departments.values());
    
    // Filter by date range
    let filteredInvoices = invoices;
    if (filters.dateRange) {
      const dateFilter = this.getDateRangeFilter(filters.dateRange);
      filteredInvoices = invoices.filter(invoice => 
        invoice.createdAt >= dateFilter.start && invoice.createdAt <= dateFilter.end
      );
    }

    // Filter by departments
    if (filters.departments && filters.departments.length > 0) {
      const relevantClientIds = clients
        .filter(client => filters.departments.includes(client.departmentId))
        .map(client => client.id);
      filteredInvoices = filteredInvoices.filter(invoice => 
        relevantClientIds.includes(invoice.clientId)
      );
    }

    // Calculate totals
    const totalRevenue = filteredInvoices
      .filter(inv => filters.includeInvoiceStatus?.includes(inv.status) || !filters.includeInvoiceStatus)
      .reduce((sum, invoice) => sum + parseFloat(invoice.totalAmount || "0"), 0);

    const invoiceCount = filteredInvoices.length;

    // Revenue by department
    const revenueByDepartment = divisions.map(division => {
      const divisionClientIds = clients
        .filter(client => client.departmentId === division.id)
        .map(client => client.id);
      
      const divisionRevenue = filteredInvoices
        .filter(invoice => divisionClientIds.includes(invoice.clientId))
        .reduce((sum, invoice) => sum + parseFloat(invoice.totalAmount || "0"), 0);

      return {
        department: division.name,
        revenue: divisionRevenue,
        invoiceCount: filteredInvoices.filter(invoice => divisionClientIds.includes(invoice.clientId)).length
      };
    });

    // Top clients
    const clientRevenue = new Map<string, number>();
    filteredInvoices.forEach(invoice => {
      const current = clientRevenue.get(invoice.clientId) || 0;
      clientRevenue.set(invoice.clientId, current + parseFloat(invoice.totalAmount || "0"));
    });

    const topClients = Array.from(clientRevenue.entries())
      .map(([clientId, revenue]) => {
        const client = clients.find(c => c.id === clientId);
        return {
          clientName: client?.name || "Unknown",
          revenue
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return {
      totalRevenue,
      invoiceCount,
      revenueByDepartment,
      topClients,
      averageInvoiceValue: invoiceCount > 0 ? totalRevenue / invoiceCount : 0
    };
  }

  private async generateExpenseBreakdownReport(filters: any): Promise<any> {
    const purchaseOrders = Array.from(this.purchaseOrders.values());
    const inventoryItems = Array.from(this.inventoryItems.values());
    const divisions = Array.from(this.departments.values());

    // Filter by date range
    let filteredPOs = purchaseOrders;
    if (filters.dateRange) {
      const dateFilter = this.getDateRangeFilter(filters.dateRange);
      filteredPOs = purchaseOrders.filter(po => 
        po.createdAt >= dateFilter.start && po.createdAt <= dateFilter.end
      );
    }

    // Calculate total expenses from approved purchase orders
    const totalExpenses = filteredPOs
      .filter(po => po.status === "approved")
      .reduce((sum, po) => sum + parseFloat(po.totalAmount || "0"), 0);

    // Expenses by department
    const expensesByDepartment = divisions.map(division => {
      const divisionExpenses = filteredPOs
        .filter(po => po.departmentId === division.id && po.status === "approved")
        .reduce((sum, po) => sum + parseFloat(po.totalAmount || "0"), 0);

      return {
        department: division.name,
        expenses: divisionExpenses,
        poCount: filteredPOs.filter(po => po.departmentId === division.id).length
      };
    });

    // Top suppliers
    const supplierExpenses = new Map<string, number>();
    filteredPOs
      .filter(po => po.status === "approved")
      .forEach(po => {
        const current = supplierExpenses.get(po.supplierId) || 0;
        supplierExpenses.set(po.supplierId, current + parseFloat(po.totalAmount || "0"));
      });

    const topSuppliers = Array.from(supplierExpenses.entries())
      .map(([supplierId, expenses]) => {
        const supplier = Array.from(this.suppliers.values()).find(s => s.id === supplierId);
        return {
          supplierName: supplier?.name || "Unknown",
          expenses
        };
      })
      .sort((a, b) => b.expenses - a.expenses)
      .slice(0, 5);

    return {
      totalExpenses,
      expensesByDepartment,
      topSuppliers,
      purchaseOrderCount: filteredPOs.length,
      averagePOValue: filteredPOs.length > 0 ? totalExpenses / filteredPOs.length : 0
    };
  }

  private async generateFinancialOverviewReport(filters: any): Promise<any> {
    const salesData = await this.generateSalesSummaryReport(filters);
    const expenseData = await this.generateExpenseBreakdownReport(filters);

    const totalRevenue = salesData.totalRevenue;
    const totalExpenses = expenseData.totalExpenses;
    const grossProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    // Department profitability
    const departmentProfitability = salesData.revenueByDepartment.map((revDept: any) => {
      const expDept = expenseData.expensesByDepartment.find((d: any) => d.department === revDept.department);
      const profit = revDept.revenue - (expDept?.expenses || 0);
      const margin = revDept.revenue > 0 ? (profit / revDept.revenue) * 100 : 0;

      return {
        department: revDept.department,
        revenue: revDept.revenue,
        expenses: expDept?.expenses || 0,
        profit,
        margin
      };
    });

    return {
      totalRevenue,
      totalExpenses,
      grossProfit,
      profitMargin,
      departmentProfitability,
      invoiceCount: salesData.invoiceCount,
      purchaseOrderCount: expenseData.purchaseOrderCount
    };
  }

  private getDateRangeFilter(dateRange: string): { start: Date; end: Date } {
    const now = new Date();
    const start = new Date();
    const end = new Date();

    switch (dateRange) {
      case "last_7_days":
        start.setDate(now.getDate() - 7);
        break;
      case "last_30_days":
        start.setDate(now.getDate() - 30);
        break;
      case "last_90_days":
        start.setDate(now.getDate() - 90);
        break;
      case "last_year":
        start.setFullYear(now.getFullYear() - 1);
        break;
      default:
        start.setDate(now.getDate() - 30);
    }

    return { start, end };
  }

  // Quote Submissions
  async getQuoteSubmissions(): Promise<QuoteSubmission[]> {
    return Array.from(this.quoteSubmissions.values()).sort((a, b) => 
      b.submittedAt.getTime() - a.submittedAt.getTime()
    );
  }

  async getQuoteSubmission(id: string): Promise<QuoteSubmission | undefined> {
    return this.quoteSubmissions.get(id);
  }

  async getQuoteSubmissionsByStatus(status: string): Promise<QuoteSubmission[]> {
    return Array.from(this.quoteSubmissions.values())
      .filter(q => q.status === status)
      .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
  }

  async createQuoteSubmission(submission: InsertQuoteSubmission): Promise<QuoteSubmission> {
    const id = randomUUID();
    const newSubmission: QuoteSubmission = {
      ...submission,
      id,
      submittedAt: new Date(),
    };
    this.quoteSubmissions.set(id, newSubmission);
    return newSubmission;
  }

  async updateQuoteSubmission(id: string, updateData: Partial<InsertQuoteSubmission>): Promise<QuoteSubmission> {
    const submission = this.quoteSubmissions.get(id);
    if (!submission) throw new Error("Quote submission not found");
    
    const updatedSubmission = { ...submission, ...updateData };
    this.quoteSubmissions.set(id, updatedSubmission);
    return updatedSubmission;
  }

  async deleteQuoteSubmission(id: string): Promise<boolean> {
    return this.quoteSubmissions.delete(id);
  }

  // Activity Logs
  async getActivityLogs(): Promise<any[]> {
    return this.activityLogs;
  }
}

export const storage = new MemStorage();
