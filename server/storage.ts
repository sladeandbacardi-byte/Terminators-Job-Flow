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
  type QuoteSubmission, type InsertQuoteSubmission,
  type Vehicle, type InsertVehicle,
  type VehicleAssignment, type InsertVehicleAssignment,
  type KmLog, type InsertKmLog,
  type FuelFillup, type InsertFuelFillup,
  type VehicleInspection, type InsertVehicleInspection,
  type VehicleIssue, type InsertVehicleIssue,
  type ServiceRecord, type InsertServiceRecord,
  type WorkshopJob, type InsertWorkshopJob,
  type Team, type InsertTeam,
  type TeamMember, type InsertTeamMember,
  type AttendanceRecord, type InsertAttendanceRecord,
  type AttendanceMemberRecord, type InsertAttendanceMemberRecord,
  type ServiceContract, type InsertServiceContract,
  type SalesAppointment, type InsertSalesAppointment,
  type Expense, type InsertExpense,
  type ServiceScheduleEntry, type InsertServiceScheduleEntry,
  type PricingLibraryItem, type InsertPricingLibraryItem,
  type SalesFollowUp, type InsertSalesFollowUp,
  type TreatmentReport, type InsertTreatmentReport,
  type CommunicationNote, type InsertCommunicationNote,
  type AcceptedWorkflow, type InsertAcceptedWorkflow,
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
  deleteAllClients(): Promise<number>;
  getEquipmentChecklists(date?: string, workerId?: string): Promise<import("@shared/schema").EquipmentChecklist[]>;
  getEquipmentChecklist(id: string): Promise<import("@shared/schema").EquipmentChecklist | undefined>;
  createEquipmentChecklist(data: any): Promise<import("@shared/schema").EquipmentChecklist>;
  updateEquipmentChecklist(id: string, data: any): Promise<import("@shared/schema").EquipmentChecklist>;
  getEquipmentChecklistItems(checklistId: string): Promise<import("@shared/schema").EquipmentChecklistItem[]>;
  replaceEquipmentChecklistItems(checklistId: string, items: any[]): Promise<import("@shared/schema").EquipmentChecklistItem[]>;

  // Inventory Items
  getInventoryItems(): Promise<InventoryItem[]>;
  getInventoryItem(id: string): Promise<InventoryItem | undefined>;
  getInventoryItemsByType(type: string): Promise<InventoryItem[]>;
  getInventoryItemsByDepartment(departmentId: string): Promise<InventoryItem[]>;
  createInventoryItem(item: InsertInventoryItem): Promise<InventoryItem>;
  updateInventoryItem(id: string, item: Partial<InsertInventoryItem>): Promise<InventoryItem>;
  deleteInventoryItem(id: string): Promise<boolean>;
  deleteAllInventoryItems(): Promise<number>;

  // Rental Contracts
  getRentalContracts(): Promise<RentalContract[]>;
  getRentalContract(id: string): Promise<RentalContract | undefined>;
  getActiveRentalContracts(): Promise<RentalContract[]>;
  getExpiringContracts(days: number): Promise<RentalContract[]>;
  createRentalContract(contract: InsertRentalContract): Promise<RentalContract>;
  updateRentalContract(id: string, contract: Partial<InsertRentalContract>): Promise<RentalContract>;
  deleteRentalContract(id: string): Promise<boolean>;
  logContractDeletion(entry: Omit<import("@shared/schema").ContractDeletionHistory, "id" | "deletedAt">): Promise<import("@shared/schema").ContractDeletionHistory>;
  getContractDeletionHistory(): Promise<import("@shared/schema").ContractDeletionHistory[]>;

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
  generateJobNumber(): Promise<string>;
  generateContractNumber(): Promise<string>;
  generateQuoteNumber(): Promise<string>;

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

  // Sales Appointments
  getSalesAppointments(): Promise<SalesAppointment[]>;
  getSalesAppointment(id: string): Promise<SalesAppointment | undefined>;
  getSalesAppointmentsByDate(date: string): Promise<SalesAppointment[]>;
  getSalesAppointmentsByRep(workerId: string): Promise<SalesAppointment[]>;
  getSalesAppointmentsByLead(leadId: string): Promise<SalesAppointment[]>;
  createSalesAppointment(appt: InsertSalesAppointment): Promise<SalesAppointment>;
  updateSalesAppointment(id: string, appt: Partial<InsertSalesAppointment>): Promise<SalesAppointment>;
  deleteSalesAppointment(id: string): Promise<boolean>;

  // Quote Submissions
  getQuoteSubmissions(): Promise<QuoteSubmission[]>;
  getQuoteSubmission(id: string): Promise<QuoteSubmission | undefined>;
  getQuoteSubmissionsByStatus(status: string): Promise<QuoteSubmission[]>;
  createQuoteSubmission(submission: InsertQuoteSubmission): Promise<QuoteSubmission>;
  updateQuoteSubmission(id: string, submission: Partial<InsertQuoteSubmission>): Promise<QuoteSubmission>;
  deleteQuoteSubmission(id: string): Promise<boolean>;

  // Pricing Library
  getPricingLibrary(): Promise<PricingLibraryItem[]>;
  getPricingLibraryItem(id: string): Promise<PricingLibraryItem | undefined>;
  createPricingLibraryItem(item: InsertPricingLibraryItem): Promise<PricingLibraryItem>;
  updatePricingLibraryItem(id: string, item: Partial<InsertPricingLibraryItem>): Promise<PricingLibraryItem | undefined>;
  deletePricingLibraryItem(id: string): Promise<boolean>;

  // Sales Follow-ups
  getSalesFollowUps(): Promise<SalesFollowUp[]>;
  getSalesFollowUpsByLead(leadId: string): Promise<SalesFollowUp[]>;
  createSalesFollowUp(followUp: InsertSalesFollowUp): Promise<SalesFollowUp>;
  updateSalesFollowUp(id: string, followUp: Partial<InsertSalesFollowUp>): Promise<SalesFollowUp | undefined>;
  deleteSalesFollowUp(id: string): Promise<boolean>;

  // Fleet — Vehicles
  getVehicles(): Promise<Vehicle[]>;
  getVehicle(id: string): Promise<Vehicle | undefined>;
  getActiveVehicles(): Promise<Vehicle[]>;
  createVehicle(vehicle: InsertVehicle): Promise<Vehicle>;
  updateVehicle(id: string, vehicle: Partial<InsertVehicle>): Promise<Vehicle>;
  deleteVehicle(id: string): Promise<boolean>;

  // Fleet — Assignments
  getVehicleAssignments(): Promise<VehicleAssignment[]>;
  getActiveAssignmentForWorker(workerId: string): Promise<VehicleAssignment | undefined>;
  getAssignmentsForVehicle(vehicleId: string): Promise<VehicleAssignment[]>;
  createVehicleAssignment(a: InsertVehicleAssignment): Promise<VehicleAssignment>;
  updateVehicleAssignment(id: string, a: Partial<InsertVehicleAssignment>): Promise<VehicleAssignment>;

  // Fleet — KM Logs
  getKmLogs(): Promise<KmLog[]>;
  getKmLogsByWorker(workerId: string): Promise<KmLog[]>;
  getKmLogsByVehicle(vehicleId: string): Promise<KmLog[]>;
  getKmLogsByDateRange(start: Date, end: Date): Promise<KmLog[]>;
  createKmLog(log: InsertKmLog): Promise<KmLog>;
  deleteKmLog(id: string): Promise<boolean>;

  // Fleet — Fuel Fill-ups
  getFuelFillups(): Promise<FuelFillup[]>;
  getFuelFillupsByWorker(workerId: string): Promise<FuelFillup[]>;
  getFuelFillupsByVehicle(vehicleId: string): Promise<FuelFillup[]>;
  getFuelFillupsByDateRange(start: Date, end: Date): Promise<FuelFillup[]>;
  createFuelFillup(f: InsertFuelFillup): Promise<FuelFillup>;
  deleteFuelFillup(id: string): Promise<boolean>;

  // Fleet — Inspections
  getVehicleInspections(): Promise<VehicleInspection[]>;
  getVehicleInspectionsByWorker(workerId: string): Promise<VehicleInspection[]>;
  getVehicleInspectionsByVehicle(vehicleId: string): Promise<VehicleInspection[]>;
  getFailedInspections(): Promise<VehicleInspection[]>;
  createVehicleInspection(i: InsertVehicleInspection): Promise<VehicleInspection>;
  updateVehicleInspection(id: string, i: Partial<InsertVehicleInspection>): Promise<VehicleInspection>;
  deleteVehicleInspection(id: string): Promise<boolean>;

  // Fleet — Dashboard
  getFleetDashboardData(workerId?: string): Promise<any>;

  // Fleet Maintenance — Issues
  getVehicleIssues(): Promise<VehicleIssue[]>;
  getVehicleIssue(id: string): Promise<VehicleIssue | undefined>;
  getVehicleIssuesByVehicle(vehicleId: string): Promise<VehicleIssue[]>;
  getVehicleIssuesByWorker(workerId: string): Promise<VehicleIssue[]>;
  getOpenVehicleIssues(): Promise<VehicleIssue[]>;
  getNotSafeVehicleIssues(): Promise<VehicleIssue[]>;
  createVehicleIssue(issue: InsertVehicleIssue): Promise<VehicleIssue>;
  updateVehicleIssue(id: string, issue: Partial<InsertVehicleIssue> & { managerNotes?: string }): Promise<VehicleIssue>;
  deleteVehicleIssue(id: string): Promise<boolean>;

  // Fleet Maintenance — Service Records
  getServiceRecords(): Promise<ServiceRecord[]>;
  getServiceRecord(id: string): Promise<ServiceRecord | undefined>;
  getServiceRecordsByVehicle(vehicleId: string): Promise<ServiceRecord[]>;
  createServiceRecord(record: InsertServiceRecord): Promise<ServiceRecord>;
  updateServiceRecord(id: string, record: Partial<InsertServiceRecord>): Promise<ServiceRecord>;
  deleteServiceRecord(id: string): Promise<boolean>;
  getMaintenanceDashboardData(): Promise<any>;

  // Fleet — Workshop Jobs
  getWorkshopJobs(): Promise<WorkshopJob[]>;
  getWorkshopJob(id: string): Promise<WorkshopJob | undefined>;
  getWorkshopJobsByVehicle(vehicleId: string): Promise<WorkshopJob[]>;
  createWorkshopJob(job: InsertWorkshopJob): Promise<WorkshopJob>;
  updateWorkshopJob(id: string, job: Partial<InsertWorkshopJob>): Promise<WorkshopJob>;
  deleteWorkshopJob(id: string): Promise<boolean>;
  getFleetNotifications(): Promise<any[]>;

  // Teams
  getTeams(): Promise<Team[]>;
  getTeam(id: string): Promise<Team | undefined>;
  createTeam(team: InsertTeam): Promise<Team>;
  updateTeam(id: string, team: Partial<InsertTeam>): Promise<Team>;
  deleteTeam(id: string): Promise<boolean>;
  getTeamMembers(teamId: string): Promise<TeamMember[]>;
  addTeamMember(member: InsertTeamMember): Promise<TeamMember>;
  removeTeamMember(teamId: string, workerId: string): Promise<boolean>;
  getTeamsForWorker(workerId: string): Promise<Team[]>;
  getTeamsForSupervisor(supervisorId: string): Promise<Team[]>;

  // Attendance
  getAttendanceRecords(filters?: { date?: string; teamId?: string; departmentId?: string }): Promise<AttendanceRecord[]>;
  getAttendanceRecord(id: string): Promise<AttendanceRecord | undefined>;
  getOrCreateAttendance(teamId: string, date: string): Promise<AttendanceRecord>;
  updateAttendanceRecord(id: string, data: Partial<InsertAttendanceRecord>): Promise<AttendanceRecord>;
  getAttendanceMemberRecords(attendanceId: string): Promise<AttendanceMemberRecord[]>;
  getAllAttendanceMemberRecords(): Promise<AttendanceMemberRecord[]>;
  upsertAttendanceMemberRecord(record: InsertAttendanceMemberRecord & { attendanceId: string }): Promise<AttendanceMemberRecord>;
  submitAttendance(attendanceId: string, submittedBy: string): Promise<AttendanceRecord>;

  // Backup & Restore
  exportBackup(): Promise<Record<string, any>>;
  restoreBackup(data: Record<string, any>): Promise<void>;

  // Backup Logs
  getBackupLogs(): Promise<BackupLog[]>;
  addBackupLog(log: Omit<BackupLog, "id">): Promise<BackupLog>;
  updateBackupLog(id: string, patch: Partial<Omit<BackupLog, "id">>): Promise<BackupLog | null>;

  // Integrity Scan History
  getIntegrityScans(): Promise<IntegrityScan[]>;
  addIntegrityScan(scan: Omit<IntegrityScan, "id">): Promise<IntegrityScan>;

  // Backup Schedule
  getBackupSchedule(): Promise<BackupScheduleSettings>;
  setBackupSchedule(settings: BackupScheduleSettings): Promise<BackupScheduleSettings>;

  // Service Contracts (recurring jobs)
  getServiceContracts(): Promise<ServiceContract[]>;
  getServiceContract(id: string): Promise<ServiceContract | undefined>;
  createServiceContract(c: InsertServiceContract): Promise<ServiceContract>;
  updateServiceContract(id: string, c: Partial<InsertServiceContract>): Promise<ServiceContract | undefined>;
  deleteServiceContract(id: string): Promise<boolean>;
  getContractOccurrences(start: Date, end: Date, opts?: { departmentId?: string; technicianId?: string; teamId?: string }): Promise<ContractOccurrence[]>;

  // Expenses
  getExpenses(): Promise<Expense[]>;
  getExpense(id: string): Promise<Expense | undefined>;
  createExpense(e: InsertExpense): Promise<Expense>;
  updateExpense(id: string, e: Partial<InsertExpense>): Promise<Expense>;
  deleteExpense(id: string): Promise<boolean>;

  // Service Schedule
  getServiceScheduleEntries(): Promise<ServiceScheduleEntry[]>;
  getServiceScheduleEntry(id: string): Promise<ServiceScheduleEntry | undefined>;
  createServiceScheduleEntry(e: InsertServiceScheduleEntry): Promise<ServiceScheduleEntry>;
  updateServiceScheduleEntry(id: string, e: Partial<InsertServiceScheduleEntry>): Promise<ServiceScheduleEntry | undefined>;
  deleteServiceScheduleEntry(id: string): Promise<boolean>;

  // Treatment Reports
  getTreatmentReports(): Promise<TreatmentReport[]>;
  getTreatmentReportsByClient(clientId: string): Promise<TreatmentReport[]>;
  getTreatmentReportsByJob(jobId: string): Promise<TreatmentReport[]>;
  getTreatmentReport(id: string): Promise<TreatmentReport | undefined>;
  createTreatmentReport(r: InsertTreatmentReport): Promise<TreatmentReport>;
  updateTreatmentReport(id: string, r: Partial<InsertTreatmentReport>): Promise<TreatmentReport>;
  deleteTreatmentReport(id: string): Promise<boolean>;

  // Communication Notes
  getCommunicationNotes(): Promise<CommunicationNote[]>;
  getCommunicationNotesByClient(clientId: string): Promise<CommunicationNote[]>;
  getCommunicationNote(id: string): Promise<CommunicationNote | undefined>;
  createCommunicationNote(n: InsertCommunicationNote): Promise<CommunicationNote>;
  updateCommunicationNote(id: string, n: Partial<InsertCommunicationNote>): Promise<CommunicationNote>;
  deleteCommunicationNote(id: string): Promise<boolean>;

  // Accepted Quote Workflows
  getAcceptedWorkflows(): Promise<AcceptedWorkflow[]>;
  getAcceptedWorkflow(id: string): Promise<AcceptedWorkflow | undefined>;
  getAcceptedWorkflowByQuote(quoteId: string): Promise<AcceptedWorkflow | undefined>;
  createAcceptedWorkflow(w: InsertAcceptedWorkflow): Promise<AcceptedWorkflow>;
  updateAcceptedWorkflow(id: string, w: Partial<InsertAcceptedWorkflow>): Promise<AcceptedWorkflow>;
  deleteAcceptedWorkflow(id: string): Promise<boolean>;
}

export interface BackupLog {
  id: string;
  datetime: string;
  backupType: "email-auto" | "email-manual" | "email-test";
  fileNames: string[];
  fileSizesBytes: number[];
  destination: string;
  status: "success" | "failed";
  errorMessage?: string;
  recipientEmail?: string;
  alertEmailStatus?: "success" | "failed" | "skipped";
  alertEmailError?: string;
}

export interface IntegrityScan {
  id: string;
  scannedAt: string;
  triggeredBy: string;
  orphanCount: number;
  duplicateGroupCount: number;
}

export interface BackupScheduleSettings {
  enabled: boolean;
  frequency: "daily" | "weekly";
  dayOfWeek: number;
  hourUTC: number;
  minuteUTC: number;
  recipientEmail: string;
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
  private salesAppointments: Map<string, SalesAppointment> = new Map();
  private customReports: Map<string, CustomReport> = new Map();
  private quoteSubmissions: Map<string, QuoteSubmission> = new Map();
  private pricingLibraryMap: Map<string, PricingLibraryItem> = new Map();
  private salesFollowUpsMap: Map<string, SalesFollowUp> = new Map();
  private vehicles: Map<string, Vehicle> = new Map();
  private vehicleAssignments: Map<string, VehicleAssignment> = new Map();
  private kmLogs: Map<string, KmLog> = new Map();
  private fuelFillups: Map<string, FuelFillup> = new Map();
  private vehicleInspections: Map<string, VehicleInspection> = new Map();
  private vehicleIssues: Map<string, VehicleIssue> = new Map();
  private serviceRecords: Map<string, ServiceRecord> = new Map();
  private workshopJobs: Map<string, WorkshopJob> = new Map();
  private teamsMap: Map<string, Team> = new Map();
  private teamMembersMap: Map<string, TeamMember> = new Map();
  private attendanceRecordsMap: Map<string, AttendanceRecord> = new Map();
  private attendanceMemberRecordsMap: Map<string, AttendanceMemberRecord> = new Map();
  private serviceContractsMap: Map<string, ServiceContract> = new Map();
  private expensesMap: Map<string, Expense> = new Map();
  private serviceScheduleMap: Map<string, ServiceScheduleEntry> = new Map();
  private activityLogs: any[] = [];
  private backupLogs: BackupLog[] = [];
  private integrityScans: IntegrityScan[] = [];
  private backupSchedule: BackupScheduleSettings = {
    enabled: true,
    frequency: "daily",
    dayOfWeek: 1,
    hourUTC: 21,
    minuteUTC: 30,
    recipientEmail: process.env.BACKUP_EMAIL_TO ?? "info@terminators.co.za",
  };
  private invoiceCounter: number = 1;
  private poCounter: number = 9;
  private jobCounter: number = 16;
  private contractCounter: number = 7;
  private quoteCounter: number = 6;

  constructor() {
    this.initializeData();
    this.createExampleData();
    this.initializeFleetData();
    this.initializeTeamData();
    this.initializePricingLibrary();
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

    const accountsDepartment: Department = {
      id: "div-7",
      name: "Accounts",
      colorCode: "#f59e0b",
      description: "Finance, accounts, billing and human resources"
    };

    const dailyCleaningDepartment: Department = {
      id: "div-8",
      name: "Daily Cleaning",
      colorCode: "#14b8a6",
      description: "Daily cleaning and general cleaning services"
    };

    this.departments.set(pestControlDivision.id, pestControlDivision);
    this.departments.set(sanitaryBinDivision.id, sanitaryBinDivision);
    this.departments.set(washroomDivision.id, washroomDivision);
    this.departments.set(deepCleaningDivision.id, deepCleaningDivision);
    this.departments.set(salesDepartment.id, salesDepartment);
    this.departments.set(adminDepartment.id, adminDepartment);
    this.departments.set(accountsDepartment.id, accountsDepartment);
    this.departments.set(dailyCleaningDepartment.id, dailyCleaningDepartment);

    // Create workers based on actual organogram (Organogram 2026)
    const workers = [
      // Management — worker-1
      { name: "Julien Botha",       email: "julien@terminators.co.za",    phone: "+27 82 123 0001", departmentId: "div-6", role: "Managing Member" },

      // Managers — worker-2, worker-3, worker-4
      { name: "Maryka Venter",      email: "service1@terminators.co.za",  phone: "+27 82 666 0748", departmentId: "div-6", role: "Pest Control Services Manager" },
      { name: "Mariette Koekemoer", email: "service@terminators.co.za",   phone: "+27 78 982 6249", departmentId: "div-6", role: "Hygiene Services Manager" },
      { name: "Juli Holtshausen",   email: "accounts@terminators.co.za",  phone: "+27 82 618 9711", departmentId: "div-7", role: "Finance & HR Manager" },

      // Sales — worker-5, worker-6
      { name: "Sheryl-Lyn Lee",     email: "sales@terminators.co.za",     phone: "+27 82 889 2453", departmentId: "div-5", role: "Existing Clients Sales & Admin" },
      { name: "Chane du Toit",      email: "sales2@terminators.co.za",    phone: "+27 82 770 0028", departmentId: "div-5", role: "Sales Rep" },

      // Ablution Deep Cleaning — worker-7
      { name: "Zuki Sandi",         email: "zuki@terminators.co.za",      phone: "+27 82 123 0007", departmentId: "div-4", role: "Ablution Deep Cleaning Supervisor" },

      // Pest Control — worker-8, worker-9, worker-10, worker-11
      { name: "Reece Ebrahim",      email: "reece@terminators.co.za",     phone: "+27 82 123 0008", departmentId: "div-1", role: "Pest Control Operator" },
      { name: "Garth du Preez",     email: "garth@terminators.co.za",     phone: "+27 82 123 0009", departmentId: "div-1", role: "Pest Control Operator" },
      { name: "Michael Meyer",      email: "michael@terminators.co.za",   phone: "+27 82 123 0010", departmentId: "div-1", role: "Pest Control Operator" },
      { name: "Xolani Ndzotoyi",    email: "xolani@terminators.co.za",    phone: "+27 82 123 0011", departmentId: "div-1", role: "Pest Control Operator" },

      // Washroom — worker-12
      { name: "Zain Abdol",         email: "zain@terminators.co.za",      phone: "+27 82 123 0012", departmentId: "div-3", role: "Washroom Supervisor" },

      // Pest Control Assistant — worker-13
      { name: "Leon Coltman",       email: "leon@terminators.co.za",      phone: "+27 82 123 0013", departmentId: "div-1", role: "Pest Control Assistant" },

      // Sanitary Bins — worker-14, worker-15, worker-16, worker-17, worker-18
      { name: "Jackie Roelfse",     email: "jackie@terminators.co.za",    phone: "+27 82 123 0014", departmentId: "div-2", role: "Sanitary Bin B Team Supervisor" },
      { name: "Re-Althon",          email: "reealthon@terminators.co.za", phone: "+27 82 123 0015", departmentId: "div-2", role: "Sanitary Bin A Team Supervisor" },
      { name: "Belinda",            email: "belinda@terminators.co.za",   phone: "+27 82 123 0016", departmentId: "div-2", role: "Sanitary Bin Technician" },
      { name: "Racquel",            email: "racquel@terminators.co.za",   phone: "+27 82 123 0017", departmentId: "div-2", role: "Sanitary Bin Technician" },
      { name: "Asanda",             email: "asanda@terminators.co.za",    phone: "+27 82 123 0018", departmentId: "div-2", role: "Sanitary Bin Technician" },

      // Ablution Deep Cleaning team — worker-19, worker-20, worker-21
      { name: "Nosipho",            email: "nosipho@terminators.co.za",   phone: "+27 82 123 0019", departmentId: "div-4", role: "Deep Cleaning Technician" },
      { name: "Nini",               email: "nini@terminators.co.za",      phone: "+27 82 123 0020", departmentId: "div-4", role: "Deep Cleaning Technician" },
      { name: "Babalwa",            email: "babalwa@terminators.co.za",   phone: "+27 82 123 0021", departmentId: "div-4", role: "Deep Cleaning Technician" },

      // Daily Cleaning Services — worker-22, worker-23
      { name: "Veronica",           email: "veronica@terminators.co.za",  phone: "+27 82 123 0022", departmentId: "div-8", role: "Daily Cleaning Technician" },
      { name: "Margrett",           email: "margrett@terminators.co.za",  phone: "+27 82 123 0023", departmentId: "div-8", role: "Daily Cleaning Technician" },
    ];
    // worker-1  = Julien Botha          (div-6 / Managing Member)
    // worker-2  = Maryka Venter         (div-6 / Pest Control Services Manager)
    // worker-3  = Mariette Koekemoer    (div-6 / Hygiene Services Manager)
    // worker-4  = Juli Holtshausen      (div-7 / Finance & HR Manager)
    // worker-5  = Sheryl-Lyn Lee        (div-5 / Existing Clients Sales & Admin)
    // worker-6  = Chane du Toit         (div-5 / Sales Rep)
    // worker-7  = Zuki Sandi            (div-4 / Ablution Deep Cleaning Supervisor)
    // worker-8  = Reece Ebrahim         (div-1 / Pest Control Operator)
    // worker-9  = Garth du Preez        (div-1 / Pest Control Operator)
    // worker-10 = Michael Meyer         (div-1 / Pest Control Operator)
    // worker-11 = Xolani Ndzotoyi       (div-1 / Pest Control Operator)
    // worker-12 = Zain Abdol            (div-3 / Washroom Supervisor)
    // worker-13 = Leon Coltman          (div-1 / Pest Control Assistant)
    // worker-14 = Jackie Roelfse        (div-2 / Sanitary Bin B Team Supervisor)
    // worker-15 = Re-Althon             (div-2 / Sanitary Bin A Team Supervisor)
    // worker-16 = Belinda               (div-2 / Sanitary Bin Technician)
    // worker-17 = Racquel               (div-2 / Sanitary Bin Technician)
    // worker-18 = Asanda                (div-2 / Sanitary Bin Technician)
    // worker-19 = Nosipho               (div-4 / Deep Cleaning Technician)
    // worker-20 = Nini                  (div-4 / Deep Cleaning Technician)
    // worker-21 = Babalwa               (div-4 / Deep Cleaning Technician)
    // worker-22 = Veronica              (div-8 / Daily Cleaning Technician)
    // worker-23 = Margrett              (div-8 / Daily Cleaning Technician)

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
    // dt(offsetDays, hour, minute) — sets an exact time so calendar sizing is visible
    const dt = (offsetDays: number, hour: number, minute: number = 0) => {
      const d = new Date(now);
      d.setDate(d.getDate() + offsetDays);
      d.setHours(hour, minute, 0, 0);
      return d;
    };
    // d() is a shorthand alias still used by invoice/lead/PO seed data below
    const d = (offsetDays: number) => dt(offsetDays, 8);

    const sampleJobs = [
      // Pest Control Jobs — varied times and durations
      {
        id: "job-1",
        clientId: "client-5",
        workerId: "worker-8",
        departmentId: "div-1",
        title: "Monthly Pest Control Inspection",
        description: "Routine monthly pest control inspection and treatment for restaurant kitchen and dining areas",
        status: "scheduled",
        priority: "medium",
        scheduledDate: dt(1, 8, 0),
        scheduledTime: "08:00",
        estimatedDuration: 120,   // 2 hours
        location: "Greenacres Shopping Centre, Port Elizabeth",
        notes: "Focus on kitchen areas and waste disposal zones",
        createdAt: dt(-5, 9)
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
        scheduledDate: dt(0, 10, 30),
        scheduledTime: "10:30",
        estimatedDuration: 180,   // 3 hours
        location: "Newton Park Shopping Centre, Port Elizabeth",
        notes: "Customer reported rodent droppings in storage room",
        createdAt: dt(-1, 8)
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
        scheduledDate: dt(-3, 7, 30),
        scheduledTime: "07:30",
        estimatedDuration: 240,   // 4 hours
        actualDuration: 210,
        location: "Struandale, Port Elizabeth",
        notes: "Full facility assessment completed. Report submitted.",
        createdAt: dt(-5, 9)
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
        scheduledDate: dt(3, 14, 0),
        scheduledTime: "14:00",
        estimatedDuration: 90,    // 1.5 hours
        location: "Summerstrand, Port Elizabeth",
        notes: "After-hours treatment required",
        createdAt: dt(-2, 8)
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
        scheduledDate: dt(2, 9, 0),
        scheduledTime: "09:00",
        estimatedDuration: 90,
        location: "Walmer Park Shopping Centre, Port Elizabeth",
        notes: "Service all female restroom facilities",
        createdAt: dt(-3, 8)
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
        scheduledDate: dt(0, 8, 0),
        scheduledTime: "08:00",
        estimatedDuration: 150,   // 2.5 hours
        location: "Mercantile Hospital Street, Port Elizabeth",
        notes: "Include maternity and general wards",
        createdAt: dt(-2, 8)
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
        scheduledDate: dt(-4, 7, 0),
        scheduledTime: "07:00",
        estimatedDuration: 180,
        actualDuration: 150,
        location: "West Hill, Port Elizabeth",
        notes: "20 units installed across girl's facilities. Training provided.",
        createdAt: dt(-6, 8)
      },

      // Washroom Service Jobs
      {
        id: "job-8",
        clientId: "client-3",
        workerId: "worker-12",
        departmentId: "div-3",
        title: "Mall Washroom Maintenance",
        description: "Daily washroom cleaning and supply replenishment",
        status: "scheduled",
        priority: "medium",
        scheduledDate: dt(1, 13, 0),
        scheduledTime: "13:00",
        estimatedDuration: 240,   // 4 hours
        location: "Baywest City, Port Elizabeth",
        notes: "Cover all public washroom facilities in mall",
        createdAt: dt(-2, 8)
      },
      {
        id: "job-9",
        clientId: "client-8",
        workerId: "worker-12",
        departmentId: "div-3",
        title: "Office Washroom Deep Clean",
        description: "Quarterly deep cleaning of office building washroom facilities",
        status: "in_progress",
        priority: "medium",
        scheduledDate: dt(0, 14, 0),
        scheduledTime: "14:00",
        estimatedDuration: 180,   // 3 hours
        location: "Heugh Road, Walmer, Port Elizabeth",
        notes: "Focus on tile cleaning and grout restoration",
        createdAt: dt(-1, 8)
      },
      {
        id: "job-10",
        clientId: "client-13",
        workerId: "worker-12",
        departmentId: "div-3",
        title: "School Washroom Upgrade",
        description: "Installation of new paper towel dispensers and soap dispensers",
        status: "completed",
        priority: "high",
        scheduledDate: dt(-5, 8, 30),
        scheduledTime: "08:30",
        estimatedDuration: 300,   // 5 hours
        actualDuration: 270,
        location: "Mount Pleasant, Port Elizabeth",
        notes: "15 new dispensers installed. Old equipment removed.",
        createdAt: dt(-7, 8)
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
        scheduledDate: dt(4, 22, 0),
        scheduledTime: "22:00",
        estimatedDuration: 480,   // 8 hours (night shift)
        location: "Marine Drive, Summerstrand, Port Elizabeth",
        notes: "Night shift operation. Casino remains operational.",
        createdAt: dt(-3, 8)
      },
      {
        id: "job-12",
        clientId: "client-14",
        workerId: "worker-16",
        departmentId: "div-4",
        title: "Factory Floor Deep Clean",
        description: "Industrial deep cleaning of production floor and equipment",
        status: "in_progress",
        priority: "high",
        scheduledDate: dt(0, 7, 0),
        scheduledTime: "07:00",
        estimatedDuration: 360,   // 6 hours
        location: "Uitenhage Road, Port Elizabeth",
        notes: "Coordinate with production schedule. Safety protocols required.",
        createdAt: dt(-2, 8)
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
        scheduledDate: dt(-6, 8, 0),
        scheduledTime: "08:00",
        estimatedDuration: 600,   // 10 hours (full day+)
        actualDuration: 540,
        location: "Baywest City, Port Elizabeth",
        notes: "Weather conditions excellent. All floors completed ahead of schedule.",
        createdAt: dt(-8, 8)
      },
      {
        id: "job-14",
        clientId: "client-14",
        workerId: "worker-16",
        departmentId: "div-4",
        title: "Hospital Ward Deep Clean (2-Day)",
        description: "Full 2-day deep clean of surgical wards and ICU. Sterile protocol required.",
        status: "scheduled",
        priority: "high",
        scheduledDate: dt(2, 7, 0),
        scheduledTime: "07:00",
        estimatedDuration: 2880,  // 2 days = 48 hours
        location: "Provincial Hospital, Port Elizabeth",
        notes: "Must complete before ward reopens. Security clearance required.",
        createdAt: dt(-1, 8)
      },
      {
        id: "job-15",
        clientId: "client-5",
        workerId: "worker-9",
        departmentId: "div-1",
        title: "School Holiday Pest Treatment (3-Day)",
        description: "Comprehensive 3-day fumigation and pest eradication programme across all school buildings",
        status: "scheduled",
        priority: "high",
        scheduledDate: dt(5, 8, 0),
        scheduledTime: "08:00",
        estimatedDuration: 4320,  // 3 days = 72 hours
        location: "Westering High School, Port Elizabeth",
        notes: "School on holiday. Full access granted. Report to principal office on arrival.",
        createdAt: dt(0, 9)
      }
    ];

    // Derive service type from department
    const deptToServiceType: Record<string, string> = {
      'div-1': 'pest_control',
      'div-2': 'sanitary_bins',
      'div-3': 'washroom',
      'div-4': 'deep_cleaning',
    };

    // Add all sample jobs
    sampleJobs.forEach(job => {
      const jobIdx = parseInt(job.id.split('-')[1]) || 0;
      this.jobs.set(job.id, {
        ...job,
        jobNumber: `JOB-2026-${String(jobIdx).padStart(4, '0')}`,
        linkedQuoteId: null,
        serviceType: deptToServiceType[job.departmentId || ''] || 'general',
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
        unitPrice: "125.00",
        quantity: 20,
        billingFrequency: "monthly",
        calculatedTotal: "2500.00",
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
        unitPrice: "150.00",
        quantity: 12,
        billingFrequency: "monthly",
        calculatedTotal: "1800.00",
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
        unitPrice: "200.00",
        quantity: 16,
        billingFrequency: "monthly",
        calculatedTotal: "3200.00",
        monthlyPrice: "3200.00",
        startDate: new Date(now.getFullYear(), now.getMonth() - 8, 1),
        endDate: new Date(now.getFullYear(), now.getMonth() + 1, 1),
        isActive: true,
        notes: "Pest control station rental - McDonald's Greenacres",
      },
      {
        id: "rc-4",
        clientId: "client-4",
        inventoryItemId: "inv-7",
        unitPrice: "300.00",
        quantity: 15,
        billingFrequency: "monthly",
        calculatedTotal: "4500.00",
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
        unitPrice: "150.00",
        quantity: 13,
        billingFrequency: "monthly",
        calculatedTotal: "1950.00",
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
        unitPrice: "200.00",
        quantity: 26,
        billingFrequency: "monthly",
        calculatedTotal: "5200.00",
        monthlyPrice: "5200.00",
        startDate: new Date(now.getFullYear(), now.getMonth() - 5, 1),
        endDate: new Date(now.getFullYear() + 1, now.getMonth() - 5, 1),
        isActive: true,
        notes: "Full hygiene service contract - Life Mercantile Hospital",
      }
    ];

    rentalContracts.forEach(rc => {
      const rcIdx = parseInt(rc.id.split('-')[1]) || 0;
      this.rentalContracts.set(rc.id, {
        ...rc,
        contractNumber: `RC-2026-${String(rcIdx).padStart(4, '0')}`,
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
        origination: "google",
        originationOther: null,
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
        origination: "referral",
        originationOther: null,
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
        frequency: "monthly",
        specialInstructions: "Service must be done before 07:00 AM — guests must not be disturbed. Use fragrance-free products in conference suites. Contact Thandi directly on arrival.",
        lineItemsJson: JSON.stringify([
          { description: "Paper towel dispensers (refill & service)", qty: 42, unit: "units" },
          { description: "Liquid hand soap dispensers (refill)", qty: 38, unit: "units" },
          { description: "Air freshener units (replace & restock)", qty: 18, unit: "units" },
          { description: "Toilet seat sanitiser dispensers", qty: 20, unit: "units" },
          { description: "Sanitary bags & bins — ladies rooms", qty: 12, unit: "units" },
        ]),
        submittedAt: d(-7),
        followUpDate: d(3),
        origination: "website",
        originationOther: null,
      },
      {
        id: "quote-4",
        companyName: "Nelson Mandela University",
        contactPerson: "Mr. Sipho Dlamini",
        email: "facilities@nmu.ac.za",
        phone: "+27 41 504 1111",
        serviceType: "deep_cleaning",
        description: "Semester-end deep clean of 3 lecture blocks and library. Approximately 4,200sqm. Must be done over year-end break (mid-Nov to mid-Jan). All floors, carpets, windows, and ablutions included.",
        address: "University Way, Summerstrand, Port Elizabeth",
        preferredContactMethod: "email",
        status: "quoted",
        assignedTo: "worker-2",
        notes: "Quote submitted R22,000 for full deep clean. Awaiting procurement approval.",
        frequency: "once_off",
        specialInstructions: "University access requires security clearance — request visitor passes at gate B. Chemical usage must comply with NMU environmental policy (no bleach in labs). Library shelving NOT to be moved without supervision.",
        lineItemsJson: JSON.stringify([
          { description: "Industrial floor scrubber (3× lecture blocks)", qty: 1, unit: "machine day" },
          { description: "Carpet extraction cleaning (library)", qty: 620, unit: "sqm" },
          { description: "Window cleaning (interior + exterior)", qty: 180, unit: "panes" },
          { description: "Ablution deep-clean & descale (24 sets)", qty: 24, unit: "ablution sets" },
          { description: "High-dusting & ceiling fans", qty: 3, unit: "blocks" },
        ]),
        submittedAt: d(0),
        followUpDate: d(5),
        origination: "email",
        originationOther: null,
      },
      {
        id: "quote-5",
        companyName: "Woolworths Food - Walmer Park",
        contactPerson: "Henk van der Merwe",
        email: "manager@ww-walmer.co.za",
        phone: "+27 41 368 2200",
        serviceType: "pest_control",
        description: "Existing Woolworths store needing pest control upgrade. Current supplier underperforming. Monthly contract covering retail floor, kitchen prep area, receiving bay and store room.",
        address: "Walmer Park Shopping Centre, Port Elizabeth",
        preferredContactMethod: "phone",
        status: "quoted",
        assignedTo: "worker-2",
        notes: "Very interested — follow up Friday with site visit proposal. Quote sent: R3,200/month.",
        frequency: "monthly",
        specialInstructions: "All treatments must be conducted after trading hours (after 20:00). Gel baiting only in food prep areas — NO spraying near fresh produce. Provide treatment report for HACCP file after each visit.",
        lineItemsJson: JSON.stringify([
          { description: "Rodent bait stations (tamper-resistant)", qty: 14, unit: "stations" },
          { description: "Cockroach gel bait application", qty: 6, unit: "zones" },
          { description: "Flying insect light trap (serviced monthly)", qty: 3, unit: "units" },
          { description: "Residual spray treatment (perimeter)", qty: 1, unit: "full perimeter" },
        ]),
        submittedAt: d(-3),
        followUpDate: d(4),
        origination: "existing_client",
        originationOther: null,
      },
    ];

    sampleQuotes.forEach(q => {
      const qi = parseInt(q.id.split('-')[1]) || 0;
      this.quoteSubmissions.set(q.id, { ...q, quoteNumber: `QT-2026-${String(qi).padStart(4, '0')}` });
    });

    // Seed Sales Appointments
    const today = new Date();
    const fmtDate = (d: Date) => d.toISOString().slice(0, 10);
    const relDay = (n: number) => {
      const d2 = new Date(today); d2.setDate(d2.getDate() + n); return fmtDate(d2);
    };
    const seedAppts: SalesAppointment[] = [
      { id: "sa-1", title: "New lead meeting - Greenfield Office Park", clientName: "Greenfield Office Park", contactPerson: "Mr. Patel", phone: "082 111 2233", siteAddress: "12 Greenfield Rd, Summerstrand", appointmentType: "new_lead_meeting", appointmentTypeOther: null, assignedToId: "worker-6", date: relDay(0), startTime: "09:00", endTime: "10:00", estimatedDuration: 60, status: "planned", notes: "Prospect from Google ad. Interested in pest control + washroom.", completionNote: null, clientFeedback: null, nextAction: null, followUpDate: null, leadId: "quote-1", quoteId: null, departmentId: "div-5", createdAt: new Date() },
      { id: "sa-2", title: "Site visit - Blue Waters Hotel", clientName: "Blue Waters Hotel", contactPerson: "Ms. Botha", phone: "041 580 9000", siteAddress: "Blue Waters Hotel, Beach Rd, PE", appointmentType: "site_visit", appointmentTypeOther: null, assignedToId: "worker-6", date: relDay(0), startTime: "11:30", endTime: "12:30", estimatedDuration: 60, status: "confirmed", notes: "Check current pest situation and quote for monthly contract.", completionNote: null, clientFeedback: null, nextAction: null, followUpDate: null, leadId: null, quoteId: null, departmentId: "div-5", createdAt: new Date() },
      { id: "sa-3", title: "Quote follow-up - Medicross Clinic", clientName: "Medicross Clinic", contactPerson: "Admin Manager", phone: "041 365 5000", siteAddress: "Medicross, Lorraine, PE", appointmentType: "quote_followup", appointmentTypeOther: null, assignedToId: "worker-5", date: relDay(0), startTime: "14:00", endTime: "14:30", estimatedDuration: 30, status: "confirmed", notes: "Follow up on washroom services quote sent 3 days ago.", completionNote: null, clientFeedback: null, nextAction: null, followUpDate: null, leadId: "quote-3", quoteId: null, departmentId: "div-5", createdAt: new Date() },
      { id: "sa-4", title: "Existing client visit - Spar Group PE", clientName: "Spar Group PE", contactPerson: "Mr. van Wyk", phone: "082 500 1234", siteAddress: "Spar DC, Target Field Rd, PE", appointmentType: "existing_client_visit", appointmentTypeOther: null, assignedToId: "worker-5", date: relDay(1), startTime: "09:00", endTime: "10:00", estimatedDuration: 60, status: "planned", notes: "Monthly check-in. Discuss contract renewal for next quarter.", completionNote: null, clientFeedback: null, nextAction: null, followUpDate: null, leadId: null, quoteId: null, departmentId: "div-5", createdAt: new Date() },
      { id: "sa-5", title: "Contract renewal - Murray & Roberts", clientName: "Murray & Roberts", contactPerson: "Facilities Manager", phone: "011 301 0000", siteAddress: "M&R Head Office, Bedfordview", appointmentType: "contract_renewal", appointmentTypeOther: null, assignedToId: "worker-6", date: relDay(1), startTime: "13:00", endTime: "14:00", estimatedDuration: 60, status: "planned", notes: "Annual review and contract renewal for deep cleaning services.", completionNote: null, clientFeedback: null, nextAction: null, followUpDate: null, leadId: null, quoteId: null, departmentId: "div-5", createdAt: new Date() },
      { id: "sa-6", title: "Internal sales meeting - Q2 targets", clientName: "Internal", contactPerson: "Management", phone: "", siteAddress: "Head Office", appointmentType: "internal_meeting", appointmentTypeOther: null, assignedToId: "worker-5", date: relDay(2), startTime: "08:00", endTime: "09:00", estimatedDuration: 60, status: "confirmed", notes: "Q2 pipeline review and target setting with Sheryl-Lyn and Chane.", completionNote: null, clientFeedback: null, nextAction: null, followUpDate: null, leadId: null, quoteId: null, departmentId: "div-5", createdAt: new Date() },
    ];
    seedAppts.forEach(a => this.salesAppointments.set(a.id, a));

    // Seed current-period purchase orders (expenses)
    const samplePOs: PurchaseOrder[] = [
      // Today
      { id: "po-seed-1", poNumber: "PO-2026-0001", supplierId: "supplier-1", requestedById: "user-1", approvedById: "user-1", status: "approved", totalAmount: "1850.00", requestDate: d(0), approvalDate: d(0), expectedDeliveryDate: d(3), actualDeliveryDate: null, sentDate: null, notes: "Pesticide restock - daily run", rejectionReason: null, createdAt: d(0), updatedAt: d(0) },
      { id: "po-seed-2", poNumber: "PO-2026-0002", supplierId: "supplier-2", requestedById: "user-1", approvedById: null, status: "pending", totalAmount: "640.00", requestDate: d(0), approvalDate: null, expectedDeliveryDate: d(5), actualDeliveryDate: null, sentDate: null, notes: "Sanitary bag restocking", rejectionReason: null, createdAt: d(0), updatedAt: d(0) },
      // This week
      { id: "po-seed-3", poNumber: "PO-2026-0003", supplierId: "supplier-1", requestedById: "user-1", approvedById: "user-1", status: "received", totalAmount: "3200.00", requestDate: d(-2), approvalDate: d(-2), sentDate: d(-1), expectedDeliveryDate: d(0), actualDeliveryDate: d(0), notes: "Monthly washroom supplies - soaps & dispensers", rejectionReason: null, createdAt: d(-2), updatedAt: d(0) },
      { id: "po-seed-4", poNumber: "PO-2026-0004", supplierId: "supplier-3", requestedById: "user-1", approvedById: "user-1", status: "approved", totalAmount: "1420.00", requestDate: d(-3), approvalDate: d(-3), expectedDeliveryDate: d(2), actualDeliveryDate: null, sentDate: null, notes: "Deep cleaning chemicals - April stock", rejectionReason: null, createdAt: d(-3), updatedAt: d(-3) },
      { id: "po-seed-5", poNumber: "PO-2026-0005", supplierId: "supplier-2", requestedById: "user-1", approvedById: "user-1", status: "sent", totalAmount: "975.00", requestDate: d(-4), approvalDate: d(-4), sentDate: d(-3), expectedDeliveryDate: d(1), actualDeliveryDate: null, notes: "PPE gloves and masks - field staff", rejectionReason: null, createdAt: d(-4), updatedAt: d(-3) },
      // This month (earlier)
      { id: "po-seed-6", poNumber: "PO-2026-0006", supplierId: "supplier-1", requestedById: "user-1", approvedById: "user-1", status: "received", totalAmount: "5500.00", requestDate: d(-10), approvalDate: d(-10), sentDate: d(-9), expectedDeliveryDate: d(-7), actualDeliveryDate: d(-7), notes: "Bulk rodenticide order for Q2", rejectionReason: null, createdAt: d(-10), updatedAt: d(-7) },
      { id: "po-seed-7", poNumber: "PO-2026-0007", supplierId: "supplier-3", requestedById: "user-1", approvedById: "user-1", status: "received", totalAmount: "2800.00", requestDate: d(-14), approvalDate: d(-13), sentDate: d(-12), expectedDeliveryDate: d(-10), actualDeliveryDate: d(-10), notes: "Washroom paper product replenishment", rejectionReason: null, createdAt: d(-14), updatedAt: d(-10) },
      { id: "po-seed-8", poNumber: "PO-2026-0008", supplierId: "supplier-2", requestedById: "user-1", approvedById: "user-1", status: "approved", totalAmount: "1650.00", requestDate: d(-7), approvalDate: d(-7), expectedDeliveryDate: d(3), actualDeliveryDate: null, sentDate: null, notes: "Vehicle cleaning supplies - fleet", rejectionReason: null, createdAt: d(-7), updatedAt: d(-7) },
    ];

    samplePOs.forEach(po => {
      if (!this.purchaseOrders.has(po.id)) {
        this.purchaseOrders.set(po.id, po);
      }
    });

    // Seed service contracts so the Calendar shows recurring events from day one.
    // Each contract uses the correct capitalized frequency values the occurrence expander expects.
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    const oneYearAhead = new Date(now.getFullYear() + 1, now.getMonth(), 1);

    const seedServiceContracts: ServiceContract[] = [
      {
        id: "sc-seed-1",
        clientId: "client-5",
        customerName: "McDonald's Greenacres",
        departmentId: "div-1",
        serviceType: "pest_control",
        assignedTechnicianId: "worker-8",
        assignedTechnicianName: null,
        assignedTeamId: null,
        assignedTeamName: null,
        frequency: "Monthly",
        invoicingFrequency: "Monthly",
        startDate: sixMonthsAgo,
        endDate: oneYearAhead,
        weekOfMonth: 2,
        dayOfWeek: "Tuesday",
        secondWeekOfMonth: null,
        secondDayOfWeek: null,
        secondStartTime: null,
        annualMonth: null,
        startTime: "07:00",
        estimatedDuration: 120,
        googleMapsLink: null,
        address: "Greenacres Shopping Centre, Port Elizabeth",
        notes: "Monthly pest control inspection and treatment. Focus on kitchen and back-of-house areas.",
        contractPrice: "1250.00",
        isServiceContract: true,
        isRentalContract: false,
        increaseDate: null,
        increasePercentage: null,
        routeOrder: 1,
        contractNumber: "SC-2026-0001",
        ppu: null,
        fixedTime: true,
        invoiceRule: "Invoice per completed job",
        mustBeInvoiced: true,
        financeNotes: null,
        stockTrackingRequired: false,
        refillRule: "Not Applicable",
        stockNotes: null,
        confirmWithClient: false,
        activeStatus: true,
        createdAt: sixMonthsAgo,
        updatedAt: now,
      },
      {
        id: "sc-seed-2",
        clientId: "client-10",
        customerName: "Life Mercantile Hospital",
        departmentId: "div-2",
        serviceType: "sanitary_bins",
        assignedTechnicianId: "worker-13",
        assignedTechnicianName: null,
        assignedTeamId: null,
        assignedTeamName: null,
        frequency: "Weekly",
        invoicingFrequency: "Monthly",
        startDate: sixMonthsAgo,
        endDate: oneYearAhead,
        weekOfMonth: null,
        dayOfWeek: "Thursday",
        secondWeekOfMonth: null,
        secondDayOfWeek: null,
        secondStartTime: null,
        annualMonth: null,
        startTime: "08:00",
        estimatedDuration: 150,
        googleMapsLink: null,
        address: "Mercantile Hospital Street, Port Elizabeth",
        notes: "Weekly sanitary bin service for all hospital facilities including maternity and general wards.",
        contractPrice: "3800.00",
        isServiceContract: true,
        isRentalContract: false,
        increaseDate: null,
        increasePercentage: null,
        routeOrder: 1,
        contractNumber: "SC-2026-0002",
        ppu: null,
        fixedTime: false,
        invoiceRule: "Monthly",
        mustBeInvoiced: true,
        financeNotes: null,
        stockTrackingRequired: true,
        refillRule: "Refills Included",
        stockNotes: "Sanitary bags and liner refills included in contract price.",
        confirmWithClient: false,
        activeStatus: true,
        createdAt: sixMonthsAgo,
        updatedAt: now,
      },
      {
        id: "sc-seed-3",
        clientId: "client-3",
        customerName: "Baywest Mall",
        departmentId: "div-3",
        serviceType: "washroom",
        assignedTechnicianId: "worker-12",
        assignedTechnicianName: null,
        assignedTeamId: null,
        assignedTeamName: null,
        frequency: "Weekly",
        invoicingFrequency: "Monthly",
        startDate: sixMonthsAgo,
        endDate: oneYearAhead,
        weekOfMonth: null,
        dayOfWeek: "Monday",
        secondWeekOfMonth: null,
        secondDayOfWeek: null,
        secondStartTime: null,
        annualMonth: null,
        startTime: "13:00",
        estimatedDuration: 240,
        googleMapsLink: null,
        address: "Baywest City, Port Elizabeth",
        notes: "Weekly washroom maintenance and supply replenishment across all public facilities in the mall.",
        contractPrice: "4200.00",
        isServiceContract: true,
        isRentalContract: false,
        increaseDate: null,
        increasePercentage: null,
        routeOrder: 1,
        contractNumber: "SC-2026-0003",
        ppu: null,
        fixedTime: false,
        invoiceRule: "Monthly",
        mustBeInvoiced: true,
        financeNotes: null,
        stockTrackingRequired: true,
        refillRule: "Refills Included",
        stockNotes: "Paper towels, soap and air freshener refills included.",
        confirmWithClient: false,
        activeStatus: true,
        createdAt: sixMonthsAgo,
        updatedAt: now,
      },
      {
        id: "sc-seed-4",
        clientId: "client-4",
        customerName: "Boardwalk Casino",
        departmentId: "div-4",
        serviceType: "deep_cleaning",
        assignedTechnicianId: "worker-22",
        assignedTechnicianName: null,
        assignedTeamId: null,
        assignedTeamName: null,
        frequency: "Monthly",
        invoicingFrequency: "Monthly",
        startDate: sixMonthsAgo,
        endDate: oneYearAhead,
        weekOfMonth: 1,
        dayOfWeek: "Saturday",
        secondWeekOfMonth: null,
        secondDayOfWeek: null,
        secondStartTime: null,
        annualMonth: null,
        startTime: "22:00",
        estimatedDuration: 480,
        googleMapsLink: null,
        address: "Marine Drive, Summerstrand, Port Elizabeth",
        notes: "Monthly night-shift deep clean of casino floor, VIP areas and back-of-house. Casino remains operational.",
        contractPrice: "5500.00",
        isServiceContract: true,
        isRentalContract: false,
        increaseDate: null,
        increasePercentage: null,
        routeOrder: 1,
        contractNumber: "SC-2026-0004",
        ppu: null,
        fixedTime: true,
        invoiceRule: "Invoice per completed job",
        mustBeInvoiced: true,
        financeNotes: null,
        stockTrackingRequired: false,
        refillRule: "Not Applicable",
        stockNotes: null,
        confirmWithClient: true,
        activeStatus: true,
        createdAt: sixMonthsAgo,
        updatedAt: now,
      },
    ];

    seedServiceContracts.forEach(sc => {
      this.serviceContractsMap.set(sc.id, sc);
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
      hasRentalContract: insertClient.hasRentalContract ?? false,
      rentalContractStatus: insertClient.rentalContractStatus || (insertClient.hasRentalContract ? "Active" : "None"),
      rentalContractType: insertClient.rentalContractType || null,
      rentalNotes: insertClient.rentalNotes || null,
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

  async deleteAllClients(): Promise<number> {
    const count = this.clients.size;
    this.clients.clear();
    return count;
  }

  async getEquipmentChecklists(date?: string, workerId?: string): Promise<import("@shared/schema").EquipmentChecklist[]> { return []; }
  async getEquipmentChecklist(id: string): Promise<import("@shared/schema").EquipmentChecklist | undefined> { return undefined; }
  async createEquipmentChecklist(data: any): Promise<import("@shared/schema").EquipmentChecklist> { return { ...data, id: Math.random().toString(36).slice(2), createdAt: new Date(), updatedAt: new Date() }; }
  async updateEquipmentChecklist(id: string, data: any): Promise<import("@shared/schema").EquipmentChecklist> { return { ...data, id, updatedAt: new Date() }; }
  async getEquipmentChecklistItems(checklistId: string): Promise<import("@shared/schema").EquipmentChecklistItem[]> { return []; }
  async replaceEquipmentChecklistItems(checklistId: string, items: any[]): Promise<import("@shared/schema").EquipmentChecklistItem[]> { return []; }

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

  async deleteAllInventoryItems(): Promise<number> {
    const count = this.inventoryItems.size;
    this.inventoryItems.clear();
    return count;
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
    const contractNumber = await this.generateContractNumber();
    const contract: RentalContract = { 
      ...insertContract, 
      id, 
      contractNumber,
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

  async logContractDeletion(entry: Omit<import("@shared/schema").ContractDeletionHistory, "id" | "deletedAt">): Promise<import("@shared/schema").ContractDeletionHistory> {
    const row = { ...entry, id: Math.random().toString(36).slice(2), deletedAt: new Date() } as import("@shared/schema").ContractDeletionHistory;
    return row;
  }

  async getContractDeletionHistory(): Promise<import("@shared/schema").ContractDeletionHistory[]> {
    return [];
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
    const jobNumber = await this.generateJobNumber();
    const job: Job = { 
      ...insertJob, 
      id, 
      jobNumber,
      linkedQuoteId: (insertJob as any).linkedQuoteId || null,
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

  async generateJobNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const number = String(this.jobCounter).padStart(4, '0');
    this.jobCounter++;
    return `JOB-${year}-${number}`;
  }

  async generateContractNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const number = String(this.contractCounter).padStart(4, '0');
    this.contractCounter++;
    return `RC-${year}-${number}`;
  }

  async generateQuoteNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const number = String(this.quoteCounter).padStart(4, '0');
    this.quoteCounter++;
    return `QT-${year}-${number}`;
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
    const year = new Date().getFullYear();
    const poNumber = insertPO.poNumber || `PO-${year}-${String(this.poCounter++).padStart(4, '0')}`;
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

  // Sales Appointments
  async getSalesAppointments(): Promise<SalesAppointment[]> {
    return Array.from(this.salesAppointments.values()).sort((a, b) =>
      a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)
    );
  }

  async getSalesAppointment(id: string): Promise<SalesAppointment | undefined> {
    return this.salesAppointments.get(id);
  }

  async getSalesAppointmentsByDate(date: string): Promise<SalesAppointment[]> {
    return Array.from(this.salesAppointments.values()).filter(a => a.date === date)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  async getSalesAppointmentsByRep(workerId: string): Promise<SalesAppointment[]> {
    return Array.from(this.salesAppointments.values()).filter(a => a.assignedToId === workerId);
  }

  async getSalesAppointmentsByLead(leadId: string): Promise<SalesAppointment[]> {
    return Array.from(this.salesAppointments.values()).filter(a => a.leadId === leadId);
  }

  async createSalesAppointment(appt: InsertSalesAppointment): Promise<SalesAppointment> {
    const id = randomUUID();
    const record: SalesAppointment = { ...appt, id, createdAt: new Date() };
    this.salesAppointments.set(id, record);
    return record;
  }

  async updateSalesAppointment(id: string, appt: Partial<InsertSalesAppointment>): Promise<SalesAppointment> {
    const existing = this.salesAppointments.get(id);
    if (!existing) throw new Error(`Sales appointment ${id} not found`);
    const updated = { ...existing, ...appt };
    this.salesAppointments.set(id, updated);
    return updated;
  }

  async deleteSalesAppointment(id: string): Promise<boolean> {
    return this.salesAppointments.delete(id);
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
    const quoteNumber = await this.generateQuoteNumber();
    const newSubmission: QuoteSubmission = {
      ...submission,
      id,
      quoteNumber,
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

  // ── Pricing Library ────────────────────────────────────────────────────────

  async getPricingLibrary(): Promise<PricingLibraryItem[]> {
    return Array.from(this.pricingLibraryMap.values()).sort((a, b) => a.category.localeCompare(b.category));
  }

  async getPricingLibraryItem(id: string): Promise<PricingLibraryItem | undefined> {
    return this.pricingLibraryMap.get(id);
  }

  async createPricingLibraryItem(item: InsertPricingLibraryItem): Promise<PricingLibraryItem> {
    const id = randomUUID();
    const newItem: PricingLibraryItem = { ...item, id, createdAt: new Date() };
    this.pricingLibraryMap.set(id, newItem);
    return newItem;
  }

  async updatePricingLibraryItem(id: string, item: Partial<InsertPricingLibraryItem>): Promise<PricingLibraryItem | undefined> {
    const existing = this.pricingLibraryMap.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...item };
    this.pricingLibraryMap.set(id, updated);
    return updated;
  }

  async deletePricingLibraryItem(id: string): Promise<boolean> {
    return this.pricingLibraryMap.delete(id);
  }

  // ── Sales Follow-ups ───────────────────────────────────────────────────────

  async getSalesFollowUps(): Promise<SalesFollowUp[]> {
    return Array.from(this.salesFollowUpsMap.values())
      .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  }

  async getSalesFollowUpsByLead(leadId: string): Promise<SalesFollowUp[]> {
    return Array.from(this.salesFollowUpsMap.values()).filter(f => f.leadId === leadId);
  }

  async createSalesFollowUp(followUp: InsertSalesFollowUp): Promise<SalesFollowUp> {
    const id = randomUUID();
    const newFU: SalesFollowUp = { ...followUp, id, createdAt: new Date() };
    this.salesFollowUpsMap.set(id, newFU);
    return newFU;
  }

  async updateSalesFollowUp(id: string, followUp: Partial<InsertSalesFollowUp>): Promise<SalesFollowUp | undefined> {
    const existing = this.salesFollowUpsMap.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...followUp };
    this.salesFollowUpsMap.set(id, updated);
    return updated;
  }

  async deleteSalesFollowUp(id: string): Promise<boolean> {
    return this.salesFollowUpsMap.delete(id);
  }

  // Activity Logs
  async getActivityLogs(): Promise<any[]> {
    return this.activityLogs;
  }

  private initializePricingLibrary() {
    const seed: Array<Omit<PricingLibraryItem, "id" | "createdAt">> = [
      // Sanitary Bins
      { name: "Standard Sanitary Bin — Supply", category: "sanitary_bins", serviceType: "Supply", unit: "each", unitPrice: "195.00", description: "Standard 20L sanitary bin, supplied and installed", departmentId: "div-2", isActive: true },
      { name: "Sanitary Bin — Monthly Service", category: "sanitary_bins", serviceType: "Monthly Service", unit: "per month", unitPrice: "85.00", description: "Monthly sanitary bin collection and swap", departmentId: "div-2", isActive: true },
      { name: "Nappy Disposal Unit — Supply", category: "sanitary_bins", serviceType: "Supply", unit: "each", unitPrice: "295.00", description: "Nappy disposal unit, supplied and installed", departmentId: "div-2", isActive: true },
      { name: "Nappy Disposal Unit — Monthly Service", category: "sanitary_bins", serviceType: "Monthly Service", unit: "per month", unitPrice: "95.00", description: "Monthly nappy disposal service and swap", departmentId: "div-2", isActive: true },
      // Washroom
      { name: "Soap Dispenser — Supply", category: "washroom", serviceType: "Dispenser Supply", unit: "each", unitPrice: "350.00", description: "Wall-mounted foam soap dispenser, supplied and installed", departmentId: "div-3", isActive: true },
      { name: "Paper Towel Dispenser — Supply", category: "washroom", serviceType: "Dispenser Supply", unit: "each", unitPrice: "295.00", description: "Paper towel dispenser, supplied and installed", departmentId: "div-3", isActive: true },
      { name: "Air Freshener Unit — Supply", category: "washroom", serviceType: "Dispenser Supply", unit: "each", unitPrice: "450.00", description: "Automatic air freshener unit, supplied and installed", departmentId: "div-3", isActive: true },
      { name: "Soap Refill — Per Visit", category: "washroom", serviceType: "Refill Service", unit: "per visit", unitPrice: "75.00", description: "Soap refill service per washroom visit", departmentId: "div-3", isActive: true },
      { name: "Paper Towel Refill — Per Visit", category: "washroom", serviceType: "Refill Service", unit: "per visit", unitPrice: "65.00", description: "Paper towel refill per washroom visit", departmentId: "div-3", isActive: true },
      { name: "Washroom Monthly Service Package", category: "washroom", serviceType: "Contract", unit: "per month", unitPrice: "350.00", description: "Full monthly washroom service — all dispensers maintained and refilled", departmentId: "div-3", isActive: true },
      // Pest Control
      { name: "General Pest Control — Once-off", category: "pest_control", serviceType: "Once-off Treatment", unit: "per visit", unitPrice: "850.00", description: "General pest control treatment, residential or light commercial", departmentId: "div-1", isActive: true },
      { name: "General Pest Control — Monthly Contract", category: "pest_control", serviceType: "Contract", unit: "per month", unitPrice: "450.00", description: "Monthly general pest control treatment", departmentId: "div-1", isActive: true },
      { name: "Rodent Control — Once-off", category: "pest_control", serviceType: "Once-off Treatment", unit: "per visit", unitPrice: "1200.00", description: "Rodent baiting and control — once-off treatment", departmentId: "div-1", isActive: true },
      { name: "Fumigation — Per sqm", category: "pest_control", serviceType: "Fumigation", unit: "per sqm", unitPrice: "12.00", description: "Commercial fumigation service, minimum 200sqm applies", departmentId: "div-1", isActive: true },
      { name: "Termite Treatment — Once-off", category: "pest_control", serviceType: "Termite Control", unit: "per visit", unitPrice: "2500.00", description: "Termite baiting and chemical barrier treatment", departmentId: "div-1", isActive: true },
      // Deep Cleaning
      { name: "Office Deep Clean — Per sqm", category: "deep_cleaning", serviceType: "Deep Clean", unit: "per sqm", unitPrice: "45.00", description: "Professional deep clean, office/commercial space", departmentId: "div-4", isActive: true },
      { name: "Kitchen/Canteen Deep Clean", category: "deep_cleaning", serviceType: "Deep Clean", unit: "per visit", unitPrice: "1800.00", description: "Industrial kitchen or canteen deep clean", departmentId: "div-4", isActive: true },
      { name: "Bathroom Deep Clean", category: "deep_cleaning", serviceType: "Deep Clean", unit: "per visit", unitPrice: "650.00", description: "Deep clean and sanitisation of bathroom facilities", departmentId: "div-4", isActive: true },
      // Dustmats
      { name: "Entrance Mat — Supply (Standard)", category: "dustmats", serviceType: "Supply", unit: "each", unitPrice: "850.00", description: "Standard entrance dustmat, supplied", departmentId: null, isActive: true },
      { name: "Entrance Mat — Monthly Rental Service", category: "dustmats", serviceType: "Rental Contract", unit: "per month", unitPrice: "185.00", description: "Monthly mat rental — laundering and swap included", departmentId: null, isActive: true },
      // Installation
      { name: "Installation Fee — Standard", category: "installation", serviceType: "Installation", unit: "each", unitPrice: "250.00", description: "Standard installation of any single unit/dispenser", departmentId: null, isActive: true },
      { name: "Installation Fee — Complex (per hour)", category: "installation", serviceType: "Installation", unit: "per hour", unitPrice: "350.00", description: "Complex installation requiring drilling, pipework or electrical", departmentId: null, isActive: true },
    ];

    for (const item of seed) {
      const id = randomUUID();
      this.pricingLibraryMap.set(id, { ...item, id, createdAt: new Date() });
    }
  }

  private initializeFleetData() {
    const td = (daysAgo: number, hour = 8) => {
      const d = new Date(); d.setDate(d.getDate() - daysAgo); d.setHours(hour, 0, 0, 0); return d;
    };
    const tdf = (daysAhead: number) => {
      const d = new Date(); d.setDate(d.getDate() + daysAhead); d.setHours(8, 0, 0, 0); return d;
    };

    // ── Real Terminators Fleet ─────────────────────────────────────────────
    // Driver mapping:
    //   vehicle-1  DPN524EC  2006 Mercedes Vito      Re-Althon  (worker-16, div-3 Washroom)
    //   vehicle-2  HDF872EC  2013 VW Caddy            Jackie     (worker-14, div-2 Sanitary Bins)
    //   vehicle-3  JPC031EC  2020 VW Caddy            Garth      (worker-9,  div-1 Pest Control)
    //   vehicle-4  DJG667EC  2005 VW Caddy            Leon       (worker-13, div-1 Pest Control)
    //   vehicle-5  HKY517EC  2015 Suzuki Celerio      Chane      (worker-6,  div-5 Sales)
    //   vehicle-6  HRW489EC  2016 VW Caddy            Zain       (worker-12, div-3 Washroom)
    //   vehicle-7  KRM914EC  2023 Isuzu D-Max         Mike       (worker-10, div-1 Pest Control)
    //   vehicle-8  HRS116EC  2016 VW Caddy            Xolani/X   (worker-11, div-1 Pest Control)
    //   vehicle-9  KDM688EC  2023 VW Caddy            Reece      (worker-8,  div-1 Pest Control)
    //   vehicle-10 (TBA)     2026 BYD Dolphin Surf     Julien     (worker-1,  div-6 Management) — ELECTRIC

    const vehiclesData: Vehicle[] = [
      { id: "vehicle-1",  name: "Mercedes Vito (Re-Althon)",  registration: "DPN524EC", make: "Mercedes-Benz", model: "Vito",    year: "2006", departmentId: "div-3", isActive: true, vehicleStatus: "unsafe",      notes: "Failed inspection — brake light and oil issue outstanding.", createdAt: new Date("2020-01-01") },
      { id: "vehicle-2",  name: "VW Caddy (Jackie)",          registration: "HDF872EC", make: "Volkswagen",   model: "Caddy",   year: "2013", departmentId: "div-2", isActive: true, vehicleStatus: "active",      notes: null, createdAt: new Date("2020-01-01") },
      { id: "vehicle-3",  name: "VW Caddy (Garth)",           registration: "JPC031EC", make: "Volkswagen",   model: "Caddy",   year: "2020", departmentId: "div-1", isActive: true, vehicleStatus: "active",      notes: null, createdAt: new Date("2020-06-01") },
      { id: "vehicle-4",  name: "VW Caddy (Leon)",            registration: "DJG667EC", make: "Volkswagen",   model: "Caddy",   year: "2005", departmentId: "div-1", isActive: true, vehicleStatus: "due_service", notes: "Front left tyre showing inner edge wear — needs attention.", createdAt: new Date("2020-01-01") },
      { id: "vehicle-5",  name: "Suzuki Celerio (Chane)",     registration: "HKY517EC", make: "Suzuki",       model: "Celerio", year: "2015", departmentId: "div-5", isActive: true, vehicleStatus: "active",      notes: null, createdAt: new Date("2020-01-01") },
      { id: "vehicle-6",  name: "VW Caddy (Zain)",            registration: "HRW489EC", make: "Volkswagen",   model: "Caddy",   year: "2016", departmentId: "div-3", isActive: true, vehicleStatus: "due_service", notes: "Service due — approaching next service interval.", createdAt: new Date("2020-01-01") },
      { id: "vehicle-7",  name: "Isuzu D-Max (Mike)",         registration: "KRM914EC", make: "Isuzu",        model: "D-Max",   year: "2023", departmentId: "div-1", isActive: true, vehicleStatus: "active",      notes: null, createdAt: new Date("2023-03-01") },
      { id: "vehicle-8",  name: "VW Caddy (Xolani)",          registration: "HRS116EC", make: "Volkswagen",   model: "Caddy",   year: "2016", departmentId: "div-1", isActive: true, vehicleStatus: "workshop",    notes: "Clutch repair in progress at Gqeberha Auto.", createdAt: new Date("2020-01-01") },
      { id: "vehicle-9",  name: "VW Caddy (Reece)",           registration: "KDM688EC", make: "Volkswagen",   model: "Caddy",   year: "2023", departmentId: "div-1", isActive: true, vehicleStatus: "active",      notes: null, createdAt: new Date("2023-06-01") },
      { id: "vehicle-10", name: "BYD Dolphin Surf (Julien)",  registration: "KTZ909EC", make: "BYD",          model: "Dolphin Surf", year: "2026", departmentId: "div-6", isActive: true, vehicleStatus: "spare",       notes: "Electric vehicle.", createdAt: new Date("2026-01-01") },
    ];
    vehiclesData.forEach(v => this.vehicles.set(v.id, v));

    const assignmentsData: VehicleAssignment[] = [
      { id: "assign-1",  vehicleId: "vehicle-1",  workerId: "worker-16", isActive: true, notes: null, assignedAt: new Date("2020-01-01") },
      { id: "assign-2",  vehicleId: "vehicle-2",  workerId: "worker-14", isActive: true, notes: null, assignedAt: new Date("2020-01-01") },
      { id: "assign-3",  vehicleId: "vehicle-3",  workerId: "worker-9",  isActive: true, notes: null, assignedAt: new Date("2020-06-01") },
      { id: "assign-4",  vehicleId: "vehicle-4",  workerId: "worker-13", isActive: true, notes: null, assignedAt: new Date("2020-01-01") },
      { id: "assign-5",  vehicleId: "vehicle-5",  workerId: "worker-6",  isActive: true, notes: null, assignedAt: new Date("2020-01-01") },
      { id: "assign-6",  vehicleId: "vehicle-6",  workerId: "worker-12", isActive: true, notes: null, assignedAt: new Date("2020-01-01") },
      { id: "assign-7",  vehicleId: "vehicle-7",  workerId: "worker-10", isActive: true, notes: null, assignedAt: new Date("2023-03-01") },
      { id: "assign-8",  vehicleId: "vehicle-8",  workerId: "worker-11", isActive: true, notes: null, assignedAt: new Date("2020-01-01") },
      { id: "assign-9",  vehicleId: "vehicle-9",  workerId: "worker-8",  isActive: true, notes: null, assignedAt: new Date("2023-06-01") },
      { id: "assign-10", vehicleId: "vehicle-10", workerId: "worker-1",  isActive: true, notes: null, assignedAt: new Date("2026-01-01") },
    ];
    assignmentsData.forEach(a => this.vehicleAssignments.set(a.id, a));

    // Estimated current odometers (realistic for each vehicle's age & usage)
    // DPN524EC 2006 Vito     ~285,200 km
    // HDF872EC 2013 Caddy    ~198,400 km
    // JPC031EC 2020 Caddy    ~88,700 km
    // DJG667EC 2005 Caddy    ~322,600 km
    // HKY517EC 2015 Celerio  ~141,800 km
    // HRW489EC 2016 Caddy    ~178,300 km
    // KRM914EC 2023 Isuzu    ~42,100 km
    // HRS116EC 2016 Caddy    ~165,500 km
    // KDM688EC 2023 Caddy    ~36,400 km
    // (TBA)    2026 Surf      ~8,200 km

    const kmLogsData: KmLog[] = [
      // Re-Althon — Vito
      { id: "km-1",  vehicleId: "vehicle-1",  workerId: "worker-16", logDate: td(1),  startOdometer: 285110, endOdometer: 285200, totalKm: 90,  businessKm: 90,  privateKm: 0,  notes: "Washroom servicing — Newton Park route", createdAt: td(1) },
      { id: "km-2",  vehicleId: "vehicle-1",  workerId: "worker-16", logDate: td(6),  startOdometer: 284980, endOdometer: 285110, totalKm: 130, businessKm: 120, privateKm: 10, notes: "Walmer & Summerstrand route", createdAt: td(6) },
      // Jackie — Caddy (Sanitary Bins)
      { id: "km-3",  vehicleId: "vehicle-2",  workerId: "worker-14", logDate: td(1),  startOdometer: 198310, endOdometer: 198400, totalKm: 90,  businessKm: 90,  privateKm: 0,  notes: "Sanitary bin collection — Greenacres area", createdAt: td(1) },
      { id: "km-4",  vehicleId: "vehicle-2",  workerId: "worker-14", logDate: td(8),  startOdometer: 198180, endOdometer: 198310, totalKm: 130, businessKm: 125, privateKm: 5,  notes: "Lorraine & Framesby route", createdAt: td(8) },
      // Garth — Caddy (Pest Control)
      { id: "km-5",  vehicleId: "vehicle-3",  workerId: "worker-9",  logDate: td(2),  startOdometer: 88580,  endOdometer: 88700,  totalKm: 120, businessKm: 120, privateKm: 0,  notes: "Pest control treatments — Uitenhage Road clients", createdAt: td(2) },
      { id: "km-6",  vehicleId: "vehicle-3",  workerId: "worker-9",  logDate: td(7),  startOdometer: 88420,  endOdometer: 88580,  totalKm: 160, businessKm: 150, privateKm: 10, notes: "Industrial area treatments", createdAt: td(7) },
      // Leon — Caddy (Pest Control)
      { id: "km-7",  vehicleId: "vehicle-4",  workerId: "worker-13", logDate: td(2),  startOdometer: 322480, endOdometer: 322600, totalKm: 120, businessKm: 110, privateKm: 10, notes: "Pest control route — North End & Korsten", createdAt: td(2) },
      // Zain — Caddy (Washroom)
      { id: "km-8",  vehicleId: "vehicle-6",  workerId: "worker-12", logDate: td(1),  startOdometer: 178210, endOdometer: 178310, totalKm: 100, businessKm: 100, privateKm: 0,  notes: "Washroom maintenance — Baywest & surrounds", createdAt: td(1) },
      { id: "km-9",  vehicleId: "vehicle-6",  workerId: "worker-12", logDate: td(9),  startOdometer: 178060, endOdometer: 178210, totalKm: 150, businessKm: 150, privateKm: 0,  notes: null, createdAt: td(9) },
      // Mike — Isuzu D-Max (Pest Control)
      { id: "km-10", vehicleId: "vehicle-7",  workerId: "worker-10", logDate: td(3),  startOdometer: 41960,  endOdometer: 42100,  totalKm: 140, businessKm: 140, privateKm: 0,  notes: "Pest treatments — VW Plant & industrial clients", createdAt: td(3) },
      // Xolani — Caddy (Pest Control)
      { id: "km-11", vehicleId: "vehicle-8",  workerId: "worker-11", logDate: td(2),  startOdometer: 165380, endOdometer: 165500, totalKm: 120, businessKm: 115, privateKm: 5,  notes: "Pest control — hospital & clinic route", createdAt: td(2) },
      // Reece — Caddy (Pest Control)
      { id: "km-12", vehicleId: "vehicle-9",  workerId: "worker-8",  logDate: td(1),  startOdometer: 36300,  endOdometer: 36410,  totalKm: 110, businessKm: 110, privateKm: 0,  notes: "Pest control treatments — Walmer area", createdAt: td(1) },
      // Julien — Toyota Surf (Management)
      { id: "km-13", vehicleId: "vehicle-10", workerId: "worker-1",  logDate: td(2),  startOdometer: 8130,   endOdometer: 8200,   totalKm: 70,  businessKm: 70,  privateKm: 0,  notes: "Client site visits — Boardwalk & Baywest", createdAt: td(2) },
      // Chane — Celerio (Sales)
      { id: "km-14", vehicleId: "vehicle-5",  workerId: "worker-6",  logDate: td(3),  startOdometer: 141720, endOdometer: 141800, totalKm: 80,  businessKm: 75,  privateKm: 5,  notes: "Sales visits — new client prospects", createdAt: td(3) },
    ];
    kmLogsData.forEach(l => this.kmLogs.set(l.id, l));

    const fuelData: FuelFillup[] = [
      { id: "fuel-1",  vehicleId: "vehicle-1",  workerId: "worker-16", fillDate: td(4),  odometer: 285110, litres: "70.40", cost: "1864.60", fuelStation: "Engen Greenacres",      receiptPhoto: null, notes: null,                    createdAt: td(4)  },
      { id: "fuel-2",  vehicleId: "vehicle-2",  workerId: "worker-14", fillDate: td(5),  odometer: 198310, litres: "52.10", cost: "1380.65", fuelStation: "BP Newton Park",         receiptPhoto: null, notes: null,                    createdAt: td(5)  },
      { id: "fuel-3",  vehicleId: "vehicle-3",  workerId: "worker-9",  fillDate: td(3),  odometer: 88580,  litres: "48.60", cost: "1287.90", fuelStation: "Shell Walmer",           receiptPhoto: null, notes: null,                    createdAt: td(3)  },
      { id: "fuel-4",  vehicleId: "vehicle-4",  workerId: "worker-13", fillDate: td(6),  odometer: 322480, litres: "55.30", cost: "1465.45", fuelStation: "Caltex Summerstrand",    receiptPhoto: null, notes: "Tank very low",          createdAt: td(6)  },
      { id: "fuel-5",  vehicleId: "vehicle-5",  workerId: "worker-6",  fillDate: td(4),  odometer: 141720, litres: "32.80", cost: "869.20",  fuelStation: "Total Lorraine",         receiptPhoto: null, notes: null,                    createdAt: td(4)  },
      { id: "fuel-6",  vehicleId: "vehicle-6",  workerId: "worker-12", fillDate: td(2),  odometer: 178210, litres: "50.70", cost: "1343.55", fuelStation: "BP Newton Park",         receiptPhoto: null, notes: null,                    createdAt: td(2)  },
      { id: "fuel-7",  vehicleId: "vehicle-7",  workerId: "worker-10", fillDate: td(5),  odometer: 41960,  litres: "65.20", cost: "1727.80", fuelStation: "Engen Uitenhage Road",   receiptPhoto: null, notes: "Diesel",                createdAt: td(5)  },
      { id: "fuel-8",  vehicleId: "vehicle-8",  workerId: "worker-11", fillDate: td(7),  odometer: 165380, litres: "49.40", cost: "1309.10", fuelStation: "Shell Walmer",           receiptPhoto: null, notes: null,                    createdAt: td(7)  },
      { id: "fuel-9",  vehicleId: "vehicle-9",  workerId: "worker-8",  fillDate: td(3),  odometer: 36300,  litres: "46.90", cost: "1242.85", fuelStation: "Caltex Greenacres",      receiptPhoto: null, notes: null,                    createdAt: td(3)  },
      { id: "fuel-11", vehicleId: "vehicle-1",  workerId: "worker-16", fillDate: td(18), odometer: 284980, litres: "68.90", cost: "1825.85", fuelStation: "Total Gqeberha CBD",     receiptPhoto: null, notes: null,                    createdAt: td(18) },
      { id: "fuel-12", vehicleId: "vehicle-3",  workerId: "worker-9",  fillDate: td(16), odometer: 88420,  litres: "47.10", cost: "1248.15", fuelStation: "BP Charlo",             receiptPhoto: null, notes: null,                    createdAt: td(16) },
    ];
    fuelData.forEach(f => this.fuelFillups.set(f.id, f));

    const passItems = JSON.stringify([
      { name: "Tyres (condition & pressure)", result: "pass" },
      { name: "Front lights", result: "pass" },
      { name: "Rear lights & indicators", result: "pass" },
      { name: "Brakes", result: "pass" },
      { name: "Engine oil", result: "pass" },
      { name: "Coolant / water level", result: "pass" },
      { name: "Windscreen (no cracks)", result: "pass" },
      { name: "Wipers", result: "pass" },
      { name: "Mirrors", result: "pass" },
      { name: "Seat belts", result: "pass" },
      { name: "Fire extinguisher", result: "pass" },
      { name: "First aid kit", result: "pass" },
      { name: "Equipment secured", result: "pass" },
      { name: "Vehicle cleanliness", result: "pass" },
      { name: "Licence disc valid", result: "pass" },
      { name: "Driver's licence in possession", result: "pass" },
    ]);
    const failItemsVito = JSON.stringify([
      { name: "Tyres (condition & pressure)", result: "pass" },
      { name: "Front lights", result: "pass" },
      { name: "Rear lights & indicators", result: "fail", comments: "Right rear brake light not working" },
      { name: "Brakes", result: "pass" },
      { name: "Engine oil", result: "fail", comments: "Oil level low — topped up but needs monitoring" },
      { name: "Coolant / water level", result: "pass" },
      { name: "Windscreen (no cracks)", result: "pass" },
      { name: "Wipers", result: "pass" },
      { name: "Mirrors", result: "pass" },
      { name: "Seat belts", result: "pass" },
      { name: "Fire extinguisher", result: "pass" },
      { name: "First aid kit", result: "pass" },
      { name: "Equipment secured", result: "pass" },
      { name: "Vehicle cleanliness", result: "pass" },
      { name: "Licence disc valid", result: "pass" },
      { name: "Driver's licence in possession", result: "pass" },
    ]);
    const failItemsLeon = JSON.stringify([
      { name: "Tyres (condition & pressure)", result: "fail", comments: "Front left tyre worn — needs replacing soon" },
      { name: "Front lights", result: "pass" },
      { name: "Rear lights & indicators", result: "pass" },
      { name: "Brakes", result: "pass" },
      { name: "Engine oil", result: "pass" },
      { name: "Coolant / water level", result: "pass" },
      { name: "Windscreen (no cracks)", result: "pass" },
      { name: "Wipers", result: "pass" },
      { name: "Mirrors", result: "pass" },
      { name: "Seat belts", result: "pass" },
      { name: "Fire extinguisher", result: "pass" },
      { name: "First aid kit", result: "pass" },
      { name: "Equipment secured", result: "pass" },
      { name: "Vehicle cleanliness", result: "pass" },
      { name: "Licence disc valid", result: "pass" },
      { name: "Driver's licence in possession", result: "pass" },
    ]);

    const inspectionsData: VehicleInspection[] = [
      { id: "insp-1",  vehicleId: "vehicle-10", workerId: "worker-1",  inspectionDate: td(2),  overallResult: "pass", itemsJson: passItems,      comments: "New vehicle — all checks passed.", photoUrl: null, failAlertSent: false, createdAt: td(2)  },
      { id: "insp-2",  vehicleId: "vehicle-1",  workerId: "worker-16", inspectionDate: td(1),  overallResult: "fail", itemsJson: failItemsVito,   comments: "Brake light and oil issue reported. Needs attention.", photoUrl: null, failAlertSent: true,  createdAt: td(1)  },
      { id: "insp-3",  vehicleId: "vehicle-2",  workerId: "worker-14", inspectionDate: td(1),  overallResult: "pass", itemsJson: passItems,      comments: null, photoUrl: null, failAlertSent: false, createdAt: td(1)  },
      { id: "insp-4",  vehicleId: "vehicle-3",  workerId: "worker-9",  inspectionDate: td(2),  overallResult: "pass", itemsJson: passItems,      comments: "Vehicle clean and in good condition.", photoUrl: null, failAlertSent: false, createdAt: td(2)  },
      { id: "insp-5",  vehicleId: "vehicle-4",  workerId: "worker-13", inspectionDate: td(2),  overallResult: "fail", itemsJson: failItemsLeon,   comments: "Front left tyre wear reported — monitor closely.", photoUrl: null, failAlertSent: true,  createdAt: td(2)  },
      { id: "insp-6",  vehicleId: "vehicle-5",  workerId: "worker-6",  inspectionDate: td(3),  overallResult: "pass", itemsJson: passItems,      comments: null, photoUrl: null, failAlertSent: false, createdAt: td(3)  },
      { id: "insp-7",  vehicleId: "vehicle-6",  workerId: "worker-12", inspectionDate: td(1),  overallResult: "pass", itemsJson: passItems,      comments: "All good.", photoUrl: null, failAlertSent: false, createdAt: td(1)  },
      { id: "insp-8",  vehicleId: "vehicle-7",  workerId: "worker-10", inspectionDate: td(3),  overallResult: "pass", itemsJson: passItems,      comments: null, photoUrl: null, failAlertSent: false, createdAt: td(3)  },
      { id: "insp-9",  vehicleId: "vehicle-8",  workerId: "worker-11", inspectionDate: td(2),  overallResult: "pass", itemsJson: passItems,      comments: "Vehicle in good condition.", photoUrl: null, failAlertSent: false, createdAt: td(2)  },
      { id: "insp-10", vehicleId: "vehicle-9",  workerId: "worker-8",  inspectionDate: td(1),  overallResult: "pass", itemsJson: passItems,      comments: null, photoUrl: null, failAlertSent: false, createdAt: td(1)  },
    ];
    inspectionsData.forEach(i => this.vehicleInspections.set(i.id, i));

    const issuesData: VehicleIssue[] = [
      { id: "issue-1", vehicleId: "vehicle-1",  workerId: "worker-16", reportedAt: td(1),  category: "electrical", description: "Right rear brake light not working. Bulb may need replacing.", urgency: "high",    status: "open",        photoUrl: null, managerNotes: null, resolvedAt: null, serviceRecordId: null, createdAt: td(1)  },
      { id: "issue-2", vehicleId: "vehicle-1",  workerId: "worker-16", reportedAt: td(1),  category: "engine",     description: "Engine oil level low. Topped up temporarily but burns oil — needs workshop check.", urgency: "medium",  status: "open",        photoUrl: null, managerNotes: null, resolvedAt: null, serviceRecordId: null, createdAt: td(1)  },
      { id: "issue-3", vehicleId: "vehicle-4",  workerId: "worker-13", reportedAt: td(2),  category: "tyres",      description: "Front left tyre showing wear on inner edge. High mileage vehicle — requires inspection.", urgency: "medium",  status: "open",        photoUrl: null, managerNotes: "Monitor tyre — book at PE Tyres if wear increases.", resolvedAt: null, serviceRecordId: null, createdAt: td(2)  },
      { id: "issue-4", vehicleId: "vehicle-2",  workerId: "worker-14", reportedAt: td(10), category: "body",       description: "Dent on rear bumper from reversing into a bollard at client site.", urgency: "low",     status: "open",        photoUrl: null, managerNotes: null, resolvedAt: null, serviceRecordId: null, createdAt: td(10) },
      { id: "issue-5", vehicleId: "vehicle-8",  workerId: "worker-11", reportedAt: td(21), category: "engine",     description: "Clutch slipping slightly on hills. Getting worse over past two weeks.", urgency: "medium",  status: "in_progress", photoUrl: null, managerNotes: "Booked at Gqeberha Auto for Thursday. Driver to be careful on hills.", resolvedAt: null, serviceRecordId: null, createdAt: td(21) },
      { id: "issue-6", vehicleId: "vehicle-10", workerId: "worker-1",  reportedAt: td(5),  category: "other",      description: "Passenger window rattles at highway speed. Seal may need adjustment.", urgency: "low",     status: "open",        photoUrl: null, managerNotes: null, resolvedAt: null, serviceRecordId: null, createdAt: td(5)  },
    ];
    issuesData.forEach(i => this.vehicleIssues.set(i.id, i));

    const serviceData: ServiceRecord[] = [
      { id: "sr-1", vehicleId: "vehicle-1",  serviceDate: td(120), odometer: 284200, serviceProvider: "Mercedes-Benz Eastern Cape", workDone: "Major service — oil change, all filters replaced, gearbox fluid, brake fluid flush. Wiper blades replaced. Tyre rotation.", issuesFixed: null, cost: "9800.00", invoiceNumber: "MBEC-2026-0112", invoiceUrl: null, notes: "High mileage vehicle — recommend checking engine mounts at next service.", nextServiceDate: tdf(60), nextServiceOdometer: 295000, createdByWorkerId: "worker-1", createdAt: td(120) },
      { id: "sr-2", vehicleId: "vehicle-3",  serviceDate: td(90),  odometer: 87500,  serviceProvider: "Caddy Specialists Gqeberha", workDone: "90,000km service — oil, filters, spark plugs, brake pads front. Alignment and balancing.", issuesFixed: null, cost: "6400.00", invoiceNumber: "CSG-2026-0044", invoiceUrl: null, notes: null, nextServiceDate: tdf(90), nextServiceOdometer: 97500, createdByWorkerId: "worker-1", createdAt: td(90) },
      { id: "sr-3", vehicleId: "vehicle-7",  serviceDate: td(45),  odometer: 40000,  serviceProvider: "Isuzu Port Elizabeth",       workDone: "40,000km service — oil change, all filters, fuel filter, diff fluid, tyre rotation and alignment.", issuesFixed: null, cost: "7200.00", invoiceNumber: "IPE-2026-0078", invoiceUrl: null, notes: "Next service at 50,000km.", nextServiceDate: tdf(120), nextServiceOdometer: 50000, createdByWorkerId: "worker-1", createdAt: td(45) },
      { id: "sr-4", vehicleId: "vehicle-9",  serviceDate: td(30),  odometer: 35000,  serviceProvider: "Caddy Specialists Gqeberha", workDone: "35,000km service — oil change, oil filter, air filter, cabin filter, tyre rotation.", issuesFixed: null, cost: "4800.00", invoiceNumber: "CSG-2026-0091", invoiceUrl: null, notes: null, nextServiceDate: tdf(150), nextServiceOdometer: 45000, createdByWorkerId: "worker-1", createdAt: td(30) },
      { id: "sr-5", vehicleId: "vehicle-6",  serviceDate: td(150), odometer: 177000, serviceProvider: "PE Auto Service Centre",      workDone: "Service — oil and filter change, brake pads rear, coolant top-up. Wiper blades replaced.", issuesFixed: null, cost: "5100.00", invoiceNumber: "PEAS-2025-0334", invoiceUrl: null, notes: null, nextServiceDate: tdf(30), nextServiceOdometer: 188000, createdByWorkerId: "worker-1", createdAt: td(150) },
    ];
    serviceData.forEach(r => this.serviceRecords.set(r.id, r));

    const workshopData: WorkshopJob[] = [
      { id: "wj-1", vehicleId: "vehicle-1",  assignedDriverId: "worker-16", issueSource: "inspection",  sourceInspectionId: "insp-2", sourceIssueId: null,    description: "Brake light fault and engine oil consumption — from failed inspection. Requires workshop assessment and repair.", reportedByWorkerId: "worker-1", scheduledDate: tdf(3),   priority: "high",   status: "booked",      serviceProvider: "Mercedes-Benz Eastern Cape", cost: null,       notes: "Vehicle grounded until repairs completed.", completedAt: null, createdAt: td(1)  },
      { id: "wj-2", vehicleId: "vehicle-4",  assignedDriverId: "worker-13", issueSource: "issue_report", sourceInspectionId: null,     sourceIssueId: "issue-3", description: "Front left tyre showing inner edge wear. Inspect and replace if necessary. Check wheel alignment.",                         reportedByWorkerId: "worker-1", scheduledDate: tdf(7),   priority: "medium", status: "open",        serviceProvider: "PE Tyres",                   cost: null,       notes: null, completedAt: null, createdAt: td(2)  },
      { id: "wj-3", vehicleId: "vehicle-8",  assignedDriverId: "worker-11", issueSource: "issue_report", sourceInspectionId: null,     sourceIssueId: "issue-5", description: "Clutch replacement — slipping under load. Gqeberha Auto to assess and replace clutch kit.",                             reportedByWorkerId: "worker-1", scheduledDate: td(0),    priority: "high",   status: "in_progress", serviceProvider: "Gqeberha Auto",              cost: null,       notes: "Vehicle dropped off this morning.", completedAt: null, createdAt: td(3)  },
      { id: "wj-4", vehicleId: "vehicle-6",  assignedDriverId: null,        issueSource: "manual",       sourceInspectionId: null,     sourceIssueId: null,      description: "Scheduled service — 180,000km major service. Oil, filters, plugs, brake fluid, timing belt inspection.",                  reportedByWorkerId: "worker-1", scheduledDate: tdf(14),  priority: "medium", status: "open",        serviceProvider: "PE Auto Service Centre",      cost: null,       notes: null, completedAt: null, createdAt: td(5)  },
    ];
    workshopData.forEach(w => this.workshopJobs.set(w.id, w));
  }

  // Fleet — Vehicles
  async getVehicles(): Promise<Vehicle[]> {
    return Array.from(this.vehicles.values()).sort((a, b) => a.name.localeCompare(b.name));
  }
  async getVehicle(id: string): Promise<Vehicle | undefined> {
    return this.vehicles.get(id);
  }
  async getActiveVehicles(): Promise<Vehicle[]> {
    return Array.from(this.vehicles.values()).filter(v => v.isActive).sort((a, b) => a.name.localeCompare(b.name));
  }
  async createVehicle(vehicle: InsertVehicle): Promise<Vehicle> {
    const id = randomUUID();
    const newVehicle: Vehicle = { ...vehicle, id, createdAt: new Date() };
    this.vehicles.set(id, newVehicle);
    return newVehicle;
  }
  async updateVehicle(id: string, vehicle: Partial<InsertVehicle>): Promise<Vehicle> {
    const existing = this.vehicles.get(id);
    if (!existing) throw new Error("Vehicle not found");
    const updated = { ...existing, ...vehicle };
    this.vehicles.set(id, updated);
    return updated;
  }
  async deleteVehicle(id: string): Promise<boolean> {
    return this.vehicles.delete(id);
  }

  // Fleet — Assignments
  async getVehicleAssignments(): Promise<VehicleAssignment[]> {
    return Array.from(this.vehicleAssignments.values());
  }
  async getActiveAssignmentForWorker(workerId: string): Promise<VehicleAssignment | undefined> {
    return Array.from(this.vehicleAssignments.values()).find(a => a.workerId === workerId && a.isActive);
  }
  async getAssignmentsForVehicle(vehicleId: string): Promise<VehicleAssignment[]> {
    return Array.from(this.vehicleAssignments.values()).filter(a => a.vehicleId === vehicleId);
  }
  async createVehicleAssignment(a: InsertVehicleAssignment): Promise<VehicleAssignment> {
    const id = randomUUID();
    const newA: VehicleAssignment = { ...a, id, assignedAt: new Date() };
    this.vehicleAssignments.set(id, newA);
    return newA;
  }
  async updateVehicleAssignment(id: string, a: Partial<InsertVehicleAssignment>): Promise<VehicleAssignment> {
    const existing = this.vehicleAssignments.get(id);
    if (!existing) throw new Error("Assignment not found");
    const updated = { ...existing, ...a };
    this.vehicleAssignments.set(id, updated);
    return updated;
  }

  // Fleet — KM Logs
  async getKmLogs(): Promise<KmLog[]> {
    return Array.from(this.kmLogs.values()).sort((a, b) => b.logDate.getTime() - a.logDate.getTime());
  }
  async getKmLogsByWorker(workerId: string): Promise<KmLog[]> {
    return Array.from(this.kmLogs.values()).filter(l => l.workerId === workerId).sort((a, b) => b.logDate.getTime() - a.logDate.getTime());
  }
  async getKmLogsByVehicle(vehicleId: string): Promise<KmLog[]> {
    return Array.from(this.kmLogs.values()).filter(l => l.vehicleId === vehicleId).sort((a, b) => b.logDate.getTime() - a.logDate.getTime());
  }
  async getKmLogsByDateRange(start: Date, end: Date): Promise<KmLog[]> {
    return Array.from(this.kmLogs.values()).filter(l => l.logDate >= start && l.logDate <= end).sort((a, b) => b.logDate.getTime() - a.logDate.getTime());
  }
  async createKmLog(log: InsertKmLog): Promise<KmLog> {
    const id = randomUUID();
    const newLog: KmLog = { ...log, id, createdAt: new Date() };
    this.kmLogs.set(id, newLog);
    return newLog;
  }
  async deleteKmLog(id: string): Promise<boolean> {
    return this.kmLogs.delete(id);
  }

  // Fleet — Fuel Fill-ups
  async getFuelFillups(): Promise<FuelFillup[]> {
    return Array.from(this.fuelFillups.values()).sort((a, b) => b.fillDate.getTime() - a.fillDate.getTime());
  }
  async getFuelFillupsByWorker(workerId: string): Promise<FuelFillup[]> {
    return Array.from(this.fuelFillups.values()).filter(f => f.workerId === workerId).sort((a, b) => b.fillDate.getTime() - a.fillDate.getTime());
  }
  async getFuelFillupsByVehicle(vehicleId: string): Promise<FuelFillup[]> {
    return Array.from(this.fuelFillups.values()).filter(f => f.vehicleId === vehicleId).sort((a, b) => b.fillDate.getTime() - a.fillDate.getTime());
  }
  async getFuelFillupsByDateRange(start: Date, end: Date): Promise<FuelFillup[]> {
    return Array.from(this.fuelFillups.values()).filter(f => f.fillDate >= start && f.fillDate <= end).sort((a, b) => b.fillDate.getTime() - a.fillDate.getTime());
  }
  async createFuelFillup(f: InsertFuelFillup): Promise<FuelFillup> {
    const id = randomUUID();
    const newFillup: FuelFillup = { ...f, id, createdAt: new Date() };
    this.fuelFillups.set(id, newFillup);
    return newFillup;
  }
  async deleteFuelFillup(id: string): Promise<boolean> {
    return this.fuelFillups.delete(id);
  }

  // Fleet — Inspections
  async getVehicleInspections(): Promise<VehicleInspection[]> {
    return Array.from(this.vehicleInspections.values()).sort((a, b) => b.inspectionDate.getTime() - a.inspectionDate.getTime());
  }
  async getVehicleInspectionsByWorker(workerId: string): Promise<VehicleInspection[]> {
    return Array.from(this.vehicleInspections.values()).filter(i => i.workerId === workerId).sort((a, b) => b.inspectionDate.getTime() - a.inspectionDate.getTime());
  }
  async getVehicleInspectionsByVehicle(vehicleId: string): Promise<VehicleInspection[]> {
    return Array.from(this.vehicleInspections.values()).filter(i => i.vehicleId === vehicleId).sort((a, b) => b.inspectionDate.getTime() - a.inspectionDate.getTime());
  }
  async getFailedInspections(): Promise<VehicleInspection[]> {
    return Array.from(this.vehicleInspections.values())
      .filter(i => i.overallResult === "fail" && !i.reviewedAt)
      .sort((a, b) => b.inspectionDate.getTime() - a.inspectionDate.getTime());
  }
  async createVehicleInspection(i: InsertVehicleInspection): Promise<VehicleInspection> {
    const id = randomUUID();
    const newInspection: VehicleInspection = { ...i, id, failAlertSent: false, createdAt: new Date() };
    this.vehicleInspections.set(id, newInspection);
    return newInspection;
  }
  async updateVehicleInspection(id: string, i: Partial<InsertVehicleInspection>): Promise<VehicleInspection> {
    const existing = this.vehicleInspections.get(id);
    if (!existing) throw new Error("Inspection not found");
    const updated = { ...existing, ...i };
    this.vehicleInspections.set(id, updated);
    return updated;
  }
  async deleteVehicleInspection(id: string): Promise<boolean> {
    return this.vehicleInspections.delete(id);
  }

  async getFleetDashboardData(workerId?: string): Promise<any> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const allKmLogs = workerId ? await this.getKmLogsByWorker(workerId) : await this.getKmLogs();
    const allFuel = workerId ? await this.getFuelFillupsByWorker(workerId) : await this.getFuelFillups();
    const allInspections = workerId ? await this.getVehicleInspectionsByWorker(workerId) : await this.getVehicleInspections();
    const allVehicles = await this.getActiveVehicles();
    const kmThisMonth = allKmLogs.filter(l => l.logDate >= monthStart).reduce((s, l) => s + l.totalKm, 0);
    const fuelCostThisMonth = allFuel.filter(f => f.fillDate >= monthStart).reduce((s, f) => s + parseFloat(String(f.cost)), 0);
    const failedInspections = allInspections.filter(i => i.overallResult === "fail");
    return {
      activeVehicles: allVehicles.length,
      kmThisMonth,
      fuelCostThisMonth,
      failedInspectionsCount: failedInspections.length,
      recentKmLogs: allKmLogs.slice(0, 5),
      recentFuel: allFuel.slice(0, 5),
      recentInspections: allInspections.slice(0, 5),
      failedInspections,
    };
  }

  // Fleet Maintenance — Issues
  async getVehicleIssues(): Promise<VehicleIssue[]> {
    return Array.from(this.vehicleIssues.values()).sort((a, b) => b.reportedAt.getTime() - a.reportedAt.getTime());
  }
  async getVehicleIssue(id: string): Promise<VehicleIssue | undefined> {
    return this.vehicleIssues.get(id);
  }
  async getVehicleIssuesByVehicle(vehicleId: string): Promise<VehicleIssue[]> {
    return Array.from(this.vehicleIssues.values()).filter(i => i.vehicleId === vehicleId).sort((a, b) => b.reportedAt.getTime() - a.reportedAt.getTime());
  }
  async getVehicleIssuesByWorker(workerId: string): Promise<VehicleIssue[]> {
    return Array.from(this.vehicleIssues.values()).filter(i => i.workerId === workerId).sort((a, b) => b.reportedAt.getTime() - a.reportedAt.getTime());
  }
  async getOpenVehicleIssues(): Promise<VehicleIssue[]> {
    return Array.from(this.vehicleIssues.values()).filter(i => !["completed", "not_required"].includes(i.status)).sort((a, b) => b.reportedAt.getTime() - a.reportedAt.getTime());
  }
  async getNotSafeVehicleIssues(): Promise<VehicleIssue[]> {
    return Array.from(this.vehicleIssues.values()).filter(i => i.urgency === "not_safe" && !["completed", "not_required"].includes(i.status));
  }
  async createVehicleIssue(issue: InsertVehicleIssue): Promise<VehicleIssue> {
    const id = randomUUID();
    const newIssue: VehicleIssue = { ...issue, id, photoUrl: issue.photoUrl ?? null, managerNotes: issue.managerNotes ?? null, resolvedAt: issue.resolvedAt ?? null, serviceRecordId: issue.serviceRecordId ?? null, createdAt: new Date() };
    this.vehicleIssues.set(id, newIssue);
    return newIssue;
  }
  async updateVehicleIssue(id: string, issue: Partial<InsertVehicleIssue> & { managerNotes?: string }): Promise<VehicleIssue> {
    const existing = this.vehicleIssues.get(id);
    if (!existing) throw new Error("Issue not found");
    const updated: VehicleIssue = { ...existing, ...issue };
    if (issue.status === "completed" && !existing.resolvedAt) updated.resolvedAt = new Date();
    this.vehicleIssues.set(id, updated);
    return updated;
  }
  async deleteVehicleIssue(id: string): Promise<boolean> {
    return this.vehicleIssues.delete(id);
  }

  // Fleet Maintenance — Service Records
  async getServiceRecords(): Promise<ServiceRecord[]> {
    return Array.from(this.serviceRecords.values()).sort((a, b) => b.serviceDate.getTime() - a.serviceDate.getTime());
  }
  async getServiceRecord(id: string): Promise<ServiceRecord | undefined> {
    return this.serviceRecords.get(id);
  }
  async getServiceRecordsByVehicle(vehicleId: string): Promise<ServiceRecord[]> {
    return Array.from(this.serviceRecords.values()).filter(r => r.vehicleId === vehicleId).sort((a, b) => b.serviceDate.getTime() - a.serviceDate.getTime());
  }
  async createServiceRecord(record: InsertServiceRecord): Promise<ServiceRecord> {
    const id = randomUUID();
    const newRec: ServiceRecord = {
      ...record, id,
      issuesFixed: record.issuesFixed ?? null, cost: record.cost ?? null, invoiceNumber: record.invoiceNumber ?? null,
      invoiceUrl: record.invoiceUrl ?? null, notes: record.notes ?? null, nextServiceDate: record.nextServiceDate ?? null,
      nextServiceOdometer: record.nextServiceOdometer ?? null, createdByWorkerId: record.createdByWorkerId ?? null,
      createdAt: new Date(),
    };
    this.serviceRecords.set(id, newRec);
    return newRec;
  }
  async updateServiceRecord(id: string, record: Partial<InsertServiceRecord>): Promise<ServiceRecord> {
    const existing = this.serviceRecords.get(id);
    if (!existing) throw new Error("Service record not found");
    const updated = { ...existing, ...record };
    this.serviceRecords.set(id, updated);
    return updated;
  }
  async deleteServiceRecord(id: string): Promise<boolean> {
    return this.serviceRecords.delete(id);
  }

  // Fleet — Workshop Jobs
  async getWorkshopJobs(): Promise<WorkshopJob[]> {
    return Array.from(this.workshopJobs.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  async getWorkshopJob(id: string): Promise<WorkshopJob | undefined> {
    return this.workshopJobs.get(id);
  }
  async getWorkshopJobsByVehicle(vehicleId: string): Promise<WorkshopJob[]> {
    return Array.from(this.workshopJobs.values()).filter(w => w.vehicleId === vehicleId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  async createWorkshopJob(job: InsertWorkshopJob): Promise<WorkshopJob> {
    const id = randomUUID();
    const newJob: WorkshopJob = {
      ...job, id,
      assignedDriverId: job.assignedDriverId ?? null,
      sourceInspectionId: job.sourceInspectionId ?? null,
      sourceIssueId: job.sourceIssueId ?? null,
      reportedByWorkerId: job.reportedByWorkerId ?? null,
      scheduledDate: job.scheduledDate ?? null,
      serviceProvider: job.serviceProvider ?? null,
      cost: job.cost ?? null,
      notes: job.notes ?? null,
      completedAt: job.completedAt ?? null,
      createdAt: new Date(),
    };
    this.workshopJobs.set(id, newJob);
    return newJob;
  }
  async updateWorkshopJob(id: string, job: Partial<InsertWorkshopJob>): Promise<WorkshopJob> {
    const existing = this.workshopJobs.get(id);
    if (!existing) throw new Error("Workshop job not found");
    const updated: WorkshopJob = { ...existing, ...job };
    if (job.status === "completed" && !existing.completedAt) updated.completedAt = new Date();
    this.workshopJobs.set(id, updated);
    return updated;
  }
  async deleteWorkshopJob(id: string): Promise<boolean> {
    return this.workshopJobs.delete(id);
  }

  async getFleetNotifications(): Promise<any[]> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const notifications: any[] = [];

    // Failed unreviewed inspections
    const failedInsp = Array.from(this.vehicleInspections.values()).filter(i => i.overallResult === "fail" && !i.reviewedAt);
    for (const ins of failedInsp) {
      const v = this.vehicles.get(ins.vehicleId);
      notifications.push({ id: `insp-${ins.id}`, type: "inspection_failed", severity: "high", title: "Inspection Failed", message: `${v?.name ?? ins.vehicleId} failed inspection`, vehicleId: ins.vehicleId, createdAt: ins.inspectionDate });
    }

    // Unsafe vehicles
    for (const v of this.vehicles.values()) {
      if (v.vehicleStatus === "unsafe") {
        notifications.push({ id: `unsafe-${v.id}`, type: "vehicle_unsafe", severity: "critical", title: "Vehicle Marked Unsafe", message: `${v.name} is marked as unsafe`, vehicleId: v.id, createdAt: v.createdAt });
      }
    }

    // Open high-urgency issues
    const hotIssues = Array.from(this.vehicleIssues.values()).filter(i => ["open", "in_progress"].includes(i.status) && ["high", "not_safe"].includes(i.urgency));
    for (const issue of hotIssues) {
      const v = this.vehicles.get(issue.vehicleId);
      notifications.push({ id: `issue-${issue.id}`, type: "issue_reported", severity: issue.urgency === "not_safe" ? "critical" : "high", title: "Issue Reported", message: `${v?.name ?? issue.vehicleId}: ${issue.description.slice(0, 60)}...`, vehicleId: issue.vehicleId, createdAt: issue.reportedAt });
    }

    // Service overdue
    const allSvc = Array.from(this.serviceRecords.values());
    for (const v of this.vehicles.values()) {
      const svc = allSvc.filter(r => r.vehicleId === v.id).sort((a, b) => b.serviceDate.getTime() - a.serviceDate.getTime())[0];
      if (svc?.nextServiceDate && new Date(svc.nextServiceDate) < now) {
        notifications.push({ id: `svc-due-${v.id}`, type: "service_overdue", severity: "medium", title: "Service Overdue", message: `${v.name} service was due ${Math.abs(Math.round((now.getTime() - new Date(svc.nextServiceDate).getTime()) / 86400000))} days ago`, vehicleId: v.id, createdAt: svc.nextServiceDate });
      } else if (svc?.nextServiceDate) {
        const daysLeft = Math.round((new Date(svc.nextServiceDate).getTime() - now.getTime()) / 86400000);
        if (daysLeft <= 30 && daysLeft > 0) {
          notifications.push({ id: `svc-soon-${v.id}`, type: "service_due_soon", severity: "low", title: "Service Due Soon", message: `${v.name} service due in ${daysLeft} days`, vehicleId: v.id, createdAt: svc.nextServiceDate });
        }
      }
    }

    // Recent workshop jobs (created today)
    const todayJobs = Array.from(this.workshopJobs.values()).filter(w => w.createdAt >= today);
    for (const wj of todayJobs) {
      const v = this.vehicles.get(wj.vehicleId);
      notifications.push({ id: `wj-${wj.id}`, type: "workshop_job_created", severity: "low", title: "Workshop Job Created", message: `${v?.name ?? wj.vehicleId}: ${wj.description.slice(0, 60)}`, vehicleId: wj.vehicleId, createdAt: wj.createdAt });
    }

    return notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getMaintenanceDashboardData(): Promise<any> {
    const allVehicles = Array.from(this.vehicles.values()).filter(v => v.isActive);
    const allIssues = Array.from(this.vehicleIssues.values());
    const allServiceRecords = Array.from(this.serviceRecords.values());
    const allKmLogs = Array.from(this.kmLogs.values());
    const now = new Date();

    const openIssues = allIssues.filter(i => !["completed", "not_required"].includes(i.status));
    const notSafeIssues = openIssues.filter(i => i.urgency === "not_safe");

    const latestServiceByVehicle: Record<string, ServiceRecord | null> = {};
    const latestOdoByVehicle: Record<string, number | null> = {};
    for (const v of allVehicles) {
      const recs = allServiceRecords.filter(r => r.vehicleId === v.id).sort((a, b) => b.serviceDate.getTime() - a.serviceDate.getTime());
      latestServiceByVehicle[v.id] = recs[0] ?? null;
      const logs = allKmLogs.filter(l => l.vehicleId === v.id).sort((a, b) => b.logDate.getTime() - a.logDate.getTime());
      latestOdoByVehicle[v.id] = logs[0]?.endOdometer ?? null;
    }

    const overdueVehicles = allVehicles.filter(v => {
      const sr = latestServiceByVehicle[v.id]; if (!sr) return false;
      if (sr.nextServiceDate && sr.nextServiceDate < now) return true;
      if (sr.nextServiceOdometer && latestOdoByVehicle[v.id] && latestOdoByVehicle[v.id]! >= sr.nextServiceOdometer) return true;
      return false;
    });

    const dueSoonVehicles = allVehicles.filter(v => {
      if (overdueVehicles.find(ov => ov.id === v.id)) return false;
      const sr = latestServiceByVehicle[v.id]; if (!sr) return false;
      const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      if (sr.nextServiceDate && sr.nextServiceDate <= in30 && sr.nextServiceDate >= now) return true;
      if (sr.nextServiceOdometer && latestOdoByVehicle[v.id] && sr.nextServiceOdometer - latestOdoByVehicle[v.id]! <= 1000 && sr.nextServiceOdometer - latestOdoByVehicle[v.id]! > 0) return true;
      return false;
    });

    const totalServiceCost = allServiceRecords.reduce((s, r) => s + parseFloat(String(r.cost || "0")), 0);

    return {
      openIssuesCount: openIssues.length, notSafeCount: notSafeIssues.length,
      overdueCount: overdueVehicles.length, dueSoonCount: dueSoonVehicles.length,
      totalServiceCost, recentServices: allServiceRecords.slice(0, 5),
      vehiclesWithIssues: allVehicles.filter(v => openIssues.some(i => i.vehicleId === v.id)).length,
    };
  }

  private initializeTeamData() {
    // Teams seeded from Organogram 2026
    const teams: Team[] = [
      {
        id: "team-1",
        name: "Pest Control Team",
        departmentId: "div-1",
        supervisorId: "worker-8",   // Reece Ebrahim
        isActive: true,
        notes: "Main pest control field team",
        createdAt: new Date(),
      },
      {
        id: "team-2",
        name: "Sanitary Bin A Team",
        departmentId: "div-2",
        supervisorId: "worker-15",  // Re-Althon
        isActive: true,
        notes: "Sanitary bin service A team",
        createdAt: new Date(),
      },
      {
        id: "team-3",
        name: "Sanitary Bin B Team",
        departmentId: "div-2",
        supervisorId: "worker-14",  // Jackie Roelfse
        isActive: true,
        notes: "Sanitary bin service B team",
        createdAt: new Date(),
      },
      {
        id: "team-4",
        name: "Washroom Services Team",
        departmentId: "div-3",
        supervisorId: "worker-12",  // Zain Abdol
        isActive: true,
        notes: "Washroom services team",
        createdAt: new Date(),
      },
      {
        id: "team-5",
        name: "Ablution Deep Cleaning Team",
        departmentId: "div-4",
        supervisorId: "worker-7",   // Zuki Sandi
        isActive: true,
        notes: "Ablution and deep cleaning team",
        createdAt: new Date(),
      },
      {
        id: "team-6",
        name: "Daily Cleaning Team",
        departmentId: "div-8",
        supervisorId: "worker-3",   // Mariette Koekemoer (Hygiene Services Manager)
        isActive: true,
        notes: "Daily cleaning services team",
        createdAt: new Date(),
      },
    ];
    teams.forEach(t => this.teamsMap.set(t.id, t));

    const members: TeamMember[] = [
      // Pest Control Team
      { id: "tm-1",  teamId: "team-1", workerId: "worker-8"  },  // Reece Ebrahim
      { id: "tm-2",  teamId: "team-1", workerId: "worker-9"  },  // Garth du Preez
      { id: "tm-3",  teamId: "team-1", workerId: "worker-10" },  // Michael Meyer
      { id: "tm-4",  teamId: "team-1", workerId: "worker-11" },  // Xolani Ndzotoyi
      { id: "tm-5",  teamId: "team-1", workerId: "worker-13" },  // Leon Coltman
      // Sanitary Bin A Team
      { id: "tm-6",  teamId: "team-2", workerId: "worker-15" },  // Re-Althon
      { id: "tm-7",  teamId: "team-2", workerId: "worker-16" },  // Belinda
      { id: "tm-8",  teamId: "team-2", workerId: "worker-17" },  // Racquel
      // Sanitary Bin B Team
      { id: "tm-9",  teamId: "team-3", workerId: "worker-14" },  // Jackie Roelfse
      { id: "tm-10", teamId: "team-3", workerId: "worker-18" },  // Asanda
      // Washroom Services Team
      { id: "tm-11", teamId: "team-4", workerId: "worker-12" },  // Zain Abdol
      // Ablution Deep Cleaning Team
      { id: "tm-12", teamId: "team-5", workerId: "worker-7"  },  // Zuki Sandi
      { id: "tm-13", teamId: "team-5", workerId: "worker-19" },  // Nosipho
      { id: "tm-14", teamId: "team-5", workerId: "worker-20" },  // Nini
      { id: "tm-15", teamId: "team-5", workerId: "worker-21" },  // Babalwa
      // Daily Cleaning Team
      { id: "tm-16", teamId: "team-6", workerId: "worker-22" },  // Veronica
      { id: "tm-17", teamId: "team-6", workerId: "worker-23" },  // Margrett
    ];
    members.forEach(m => this.teamMembersMap.set(m.id, m));
  }

  // ── Teams ─────────────────────────────────────────────────────────────────

  async getTeams(): Promise<Team[]> {
    return Array.from(this.teamsMap.values());
  }

  async getTeam(id: string): Promise<Team | undefined> {
    return this.teamsMap.get(id);
  }

  async createTeam(team: InsertTeam): Promise<Team> {
    const id = randomUUID();
    const record: Team = { ...team, id, createdAt: new Date() };
    this.teamsMap.set(id, record);
    return record;
  }

  async updateTeam(id: string, team: Partial<InsertTeam>): Promise<Team> {
    const existing = this.teamsMap.get(id);
    if (!existing) throw new Error(`Team ${id} not found`);
    const updated = { ...existing, ...team };
    this.teamsMap.set(id, updated);
    return updated;
  }

  async deleteTeam(id: string): Promise<boolean> {
    return this.teamsMap.delete(id);
  }

  async getTeamMembers(teamId: string): Promise<TeamMember[]> {
    return Array.from(this.teamMembersMap.values()).filter(m => m.teamId === teamId);
  }

  async addTeamMember(member: InsertTeamMember): Promise<TeamMember> {
    const existing = Array.from(this.teamMembersMap.values()).find(
      m => m.teamId === member.teamId && m.workerId === member.workerId
    );
    if (existing) return existing;
    const id = randomUUID();
    const record: TeamMember = { ...member, id };
    this.teamMembersMap.set(id, record);
    return record;
  }

  async removeTeamMember(teamId: string, workerId: string): Promise<boolean> {
    const entry = Array.from(this.teamMembersMap.entries()).find(
      ([, m]) => m.teamId === teamId && m.workerId === workerId
    );
    if (!entry) return false;
    return this.teamMembersMap.delete(entry[0]);
  }

  async getTeamsForWorker(workerId: string): Promise<Team[]> {
    const teamIds = Array.from(this.teamMembersMap.values())
      .filter(m => m.workerId === workerId)
      .map(m => m.teamId);
    return teamIds.map(id => this.teamsMap.get(id)).filter(Boolean) as Team[];
  }

  async getTeamsForSupervisor(supervisorId: string): Promise<Team[]> {
    return Array.from(this.teamsMap.values()).filter(t => t.supervisorId === supervisorId && t.isActive);
  }

  // ── Attendance ────────────────────────────────────────────────────────────

  async getAttendanceRecords(filters?: { date?: string; teamId?: string; departmentId?: string }): Promise<AttendanceRecord[]> {
    let records = Array.from(this.attendanceRecordsMap.values());
    if (filters?.date) records = records.filter(r => r.date === filters.date);
    if (filters?.teamId) records = records.filter(r => r.teamId === filters.teamId);
    if (filters?.departmentId) records = records.filter(r => r.departmentId === filters.departmentId);
    return records.sort((a, b) => b.date.localeCompare(a.date));
  }

  async getAttendanceRecord(id: string): Promise<AttendanceRecord | undefined> {
    return this.attendanceRecordsMap.get(id);
  }

  async getOrCreateAttendance(teamId: string, date: string): Promise<AttendanceRecord> {
    // Return existing record for this team+date if it exists
    const existing = Array.from(this.attendanceRecordsMap.values()).find(
      r => r.teamId === teamId && r.date === date
    );
    if (existing) return existing;

    // Build a fresh record from team data
    const team = this.teamsMap.get(teamId);
    if (!team) throw new Error(`Team ${teamId} not found`);
    const supervisor = this.workers.get(team.supervisorId);
    const department = this.departments.get(team.departmentId);

    const id = randomUUID();
    const record: AttendanceRecord = {
      id,
      date,
      teamId,
      teamName: team.name,
      departmentId: team.departmentId,
      supervisorId: team.supervisorId,
      supervisorName: supervisor?.name ?? "Unknown",
      submittedBy: null,
      submittedAt: null,
      status: "not_submitted",
      createdAt: new Date(),
    };
    this.attendanceRecordsMap.set(id, record);

    // Pre-create not_confirmed entries for each team member
    const members = Array.from(this.teamMembersMap.values()).filter(m => m.teamId === teamId);
    for (const m of members) {
      const worker = this.workers.get(m.workerId);
      if (!worker) continue;
      const memberId = randomUUID();
      this.attendanceMemberRecordsMap.set(memberId, {
        id: memberId,
        attendanceId: id,
        workerId: m.workerId,
        employeeName: worker.name,
        role: worker.role ?? null,
        status: "not_confirmed",
        absenceReason: null,
        notes: null,
      });
    }

    return record;
  }

  async updateAttendanceRecord(id: string, data: Partial<InsertAttendanceRecord>): Promise<AttendanceRecord> {
    const existing = this.attendanceRecordsMap.get(id);
    if (!existing) throw new Error(`Attendance record ${id} not found`);
    const updated = { ...existing, ...data };
    this.attendanceRecordsMap.set(id, updated);
    return updated;
  }

  async getAttendanceMemberRecords(attendanceId: string): Promise<AttendanceMemberRecord[]> {
    return Array.from(this.attendanceMemberRecordsMap.values()).filter(r => r.attendanceId === attendanceId);
  }

  async getAllAttendanceMemberRecords(): Promise<AttendanceMemberRecord[]> {
    return Array.from(this.attendanceMemberRecordsMap.values());
  }

  async upsertAttendanceMemberRecord(record: InsertAttendanceMemberRecord & { attendanceId: string }): Promise<AttendanceMemberRecord> {
    const existing = Array.from(this.attendanceMemberRecordsMap.values()).find(
      r => r.attendanceId === record.attendanceId && r.workerId === record.workerId
    );
    if (existing) {
      const updated: AttendanceMemberRecord = { ...existing, ...record };
      this.attendanceMemberRecordsMap.set(existing.id, updated);
      return updated;
    }
    const id = randomUUID();
    const newRecord: AttendanceMemberRecord = { ...record, id };
    this.attendanceMemberRecordsMap.set(id, newRecord);
    return newRecord;
  }

  async submitAttendance(attendanceId: string, submittedBy: string): Promise<AttendanceRecord> {
    const existing = this.attendanceRecordsMap.get(attendanceId);
    if (!existing) throw new Error(`Attendance record ${attendanceId} not found`);
    // Any member still "not_confirmed" becomes "absent"
    const memberRecords = Array.from(this.attendanceMemberRecordsMap.values()).filter(
      r => r.attendanceId === attendanceId
    );
    for (const mr of memberRecords) {
      if (mr.status === "not_confirmed") {
        this.attendanceMemberRecordsMap.set(mr.id, { ...mr, status: "absent" });
      }
    }
    const updated: AttendanceRecord = {
      ...existing,
      status: "submitted",
      submittedBy,
      submittedAt: new Date(),
    };
    this.attendanceRecordsMap.set(attendanceId, updated);
    return updated;
  }

  async exportBackup(): Promise<Record<string, any>> {
    return {
      exportedAt: new Date().toISOString(),
      version: "1.0",
      departments: Array.from(this.departments.values()),
      workers: Array.from(this.workers.values()),
      clients: Array.from(this.clients.values()),
      inventoryItems: Array.from(this.inventoryItems.values()),
      rentalContracts: Array.from(this.rentalContracts.values()),
      jobs: Array.from(this.jobs.values()),
      invoices: Array.from(this.invoices.values()),
      invoiceItems: Array.from(this.invoiceItems.values()),
      suppliers: Array.from(this.suppliers.values()),
      purchaseOrders: Array.from(this.purchaseOrders.values()),
      purchaseOrderItems: Array.from(this.purchaseOrderItems.values()),
      calendarEvents: Array.from(this.calendarEvents.values()),
      customReports: Array.from(this.customReports.values()),
      quoteSubmissions: Array.from(this.quoteSubmissions.values()),
      emailTemplates: Array.from(this.emailTemplates.values()),
      emailLogs: Array.from(this.emailLogs.values()),
      notifications: Array.from(this.notifications.values()),
      serviceContracts: Array.from(this.serviceContractsMap.values()),
      activityLogs: this.activityLogs,
      invoiceCounter: this.invoiceCounter,
      poCounter: this.poCounter,
      jobCounter: this.jobCounter,
      contractCounter: this.contractCounter,
      quoteCounter: this.quoteCounter,
    };
  }

  async restoreBackup(data: Record<string, any>): Promise<void> {
    const toMap = <T extends { id: string }>(arr: T[]): Map<string, T> => {
      const m = new Map<string, T>();
      if (Array.isArray(arr)) arr.forEach(item => m.set(item.id, item));
      return m;
    };
    if (data.departments) this.departments = toMap(data.departments);
    if (data.workers) this.workers = toMap(data.workers);
    if (data.clients) this.clients = toMap(data.clients);
    if (data.inventoryItems) this.inventoryItems = toMap(data.inventoryItems);
    if (data.rentalContracts) this.rentalContracts = toMap(data.rentalContracts);
    if (data.jobs) this.jobs = toMap(data.jobs);
    if (data.invoices) this.invoices = toMap(data.invoices);
    if (data.invoiceItems) this.invoiceItems = toMap(data.invoiceItems);
    if (data.suppliers) this.suppliers = toMap(data.suppliers);
    if (data.purchaseOrders) this.purchaseOrders = toMap(data.purchaseOrders);
    if (data.purchaseOrderItems) this.purchaseOrderItems = toMap(data.purchaseOrderItems);
    if (data.calendarEvents) this.calendarEvents = toMap(data.calendarEvents);
    if (data.customReports) this.customReports = toMap(data.customReports);
    if (data.quoteSubmissions) this.quoteSubmissions = toMap(data.quoteSubmissions);
    if (data.emailTemplates) this.emailTemplates = toMap(data.emailTemplates);
    if (data.emailLogs) this.emailLogs = toMap(data.emailLogs);
    if (data.notifications) this.notifications = toMap(data.notifications);
    if (data.serviceContracts) this.serviceContractsMap = toMap(data.serviceContracts);
    if (Array.isArray(data.activityLogs)) this.activityLogs = data.activityLogs;
    if (typeof data.invoiceCounter === "number") this.invoiceCounter = data.invoiceCounter;
    if (typeof data.poCounter === "number") this.poCounter = data.poCounter;
    if (typeof data.jobCounter === "number") this.jobCounter = data.jobCounter;
    if (typeof data.contractCounter === "number") this.contractCounter = data.contractCounter;
    if (typeof data.quoteCounter === "number") this.quoteCounter = data.quoteCounter;
  }

  async getBackupLogs(): Promise<BackupLog[]> {
    return [...this.backupLogs].sort((a, b) => b.datetime.localeCompare(a.datetime));
  }

  async addBackupLog(log: Omit<BackupLog, "id">): Promise<BackupLog> {
    const newLog: BackupLog = { ...log, id: `bl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` };
    this.backupLogs.push(newLog);
    if (this.backupLogs.length > 200) {
      this.backupLogs = this.backupLogs.slice(-200);
    }
    return newLog;
  }

  async updateBackupLog(id: string, patch: Partial<Omit<BackupLog, "id">>): Promise<BackupLog | null> {
    const idx = this.backupLogs.findIndex((l) => l.id === id);
    if (idx === -1) return null;
    this.backupLogs[idx] = { ...this.backupLogs[idx], ...patch };
    return this.backupLogs[idx];
  }

  async getIntegrityScans(): Promise<IntegrityScan[]> {
    return [...this.integrityScans].sort((a, b) => b.scannedAt.localeCompare(a.scannedAt));
  }

  async addIntegrityScan(scan: Omit<IntegrityScan, "id">): Promise<IntegrityScan> {
    const newScan: IntegrityScan = { ...scan, id: `is-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` };
    this.integrityScans.push(newScan);
    if (this.integrityScans.length > 100) {
      this.integrityScans = this.integrityScans.slice(-100);
    }
    return newScan;
  }

  async getBackupSchedule(): Promise<BackupScheduleSettings> {
    return { ...this.backupSchedule };
  }

  async setBackupSchedule(settings: BackupScheduleSettings): Promise<BackupScheduleSettings> {
    this.backupSchedule = { ...settings };
    return { ...this.backupSchedule };
  }

  // ─── Service Contracts (recurring jobs, Outlook-style) ──────────────────
  async getServiceContracts(): Promise<ServiceContract[]> {
    return Array.from(this.serviceContractsMap.values())
      .sort((a, b) => a.customerName.localeCompare(b.customerName));
  }

  async getServiceContract(id: string): Promise<ServiceContract | undefined> {
    return this.serviceContractsMap.get(id);
  }

  async createServiceContract(c: InsertServiceContract): Promise<ServiceContract> {
    const now = new Date();
    const row: ServiceContract = {
      id: `sc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      clientId: c.clientId,
      customerName: c.customerName,
      departmentId: c.departmentId,
      serviceType: c.serviceType,
      assignedTechnicianId: c.assignedTechnicianId ?? null,
      assignedTechnicianName: c.assignedTechnicianName ?? null,
      assignedTeamId: c.assignedTeamId ?? null,
      assignedTeamName: c.assignedTeamName ?? null,
      frequency: c.frequency,
      invoicingFrequency: c.invoicingFrequency ?? null,
      startDate: c.startDate ? new Date(c.startDate) : null,
      endDate: c.endDate ? new Date(c.endDate) : null,
      weekOfMonth: c.weekOfMonth ?? null,
      dayOfWeek: c.dayOfWeek ?? null,
      secondWeekOfMonth: c.secondWeekOfMonth ?? null,
      secondDayOfWeek: c.secondDayOfWeek ?? null,
      secondStartTime: c.secondStartTime ?? null,
      annualMonth: c.annualMonth ?? null,
      startTime: c.startTime ?? null,
      estimatedDuration: c.estimatedDuration ?? null,
      googleMapsLink: c.googleMapsLink ?? null,
      address: c.address ?? null,
      notes: c.notes ?? null,
      contractPrice: (c as any).contractPrice ?? null,
      isServiceContract: (c as any).isServiceContract ?? true,
      isRentalContract: (c as any).isRentalContract ?? false,
      increaseDate: (c as any).increaseDate ?? null,
      increasePercentage: (c as any).increasePercentage ?? null,
      routeOrder: (c as any).routeOrder ?? null,
      contractNumber: (c as any).contractNumber ?? null,
      ppu: (c as any).ppu ?? null,
      fixedTime: (c as any).fixedTime ?? false,
      invoiceRule: (c as any).invoiceRule ?? null,
      mustBeInvoiced: (c as any).mustBeInvoiced ?? true,
      financeNotes: (c as any).financeNotes ?? null,
      stockTrackingRequired: (c as any).stockTrackingRequired ?? false,
      refillRule: (c as any).refillRule ?? null,
      stockNotes: (c as any).stockNotes ?? null,
      confirmWithClient: (c as any).confirmWithClient ?? false,
      activeStatus: c.activeStatus ?? true,
      createdAt: now,
      updatedAt: now,
    };
    this.serviceContractsMap.set(row.id, row);
    return row;
  }

  async updateServiceContract(id: string, patch: Partial<InsertServiceContract>): Promise<ServiceContract | undefined> {
    const cur = this.serviceContractsMap.get(id);
    if (!cur) return undefined;
    const next: ServiceContract = {
      ...cur,
      ...patch,
      startDate: patch.startDate !== undefined ? (patch.startDate ? new Date(patch.startDate) : null) : cur.startDate,
      endDate: patch.endDate !== undefined ? (patch.endDate ? new Date(patch.endDate) : null) : cur.endDate,
      id,
      updatedAt: new Date(),
    } as ServiceContract;
    this.serviceContractsMap.set(id, next);
    return next;
  }

  async deleteServiceContract(id: string): Promise<boolean> {
    return this.serviceContractsMap.delete(id);
  }

  // ── Expenses ──────────────────────────────────────────────────────────────
  async getExpenses(): Promise<Expense[]> {
    return Array.from(this.expensesMap.values()).sort((a, b) => b.date.localeCompare(a.date));
  }

  async getExpense(id: string): Promise<Expense | undefined> {
    return this.expensesMap.get(id);
  }

  async createExpense(e: InsertExpense): Promise<Expense> {
    const row: Expense = {
      id: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: e.date,
      supplier: e.supplier,
      category: e.category,
      description: e.description,
      amount: String(e.amount),
      vatIncluded: e.vatIncluded ?? false,
      departmentId: e.departmentId ?? null,
      invoiceUrl: e.invoiceUrl ?? null,
      paymentStatus: e.paymentStatus ?? "unpaid",
      notes: e.notes ?? null,
      createdAt: new Date(),
    };
    this.expensesMap.set(row.id, row);
    return row;
  }

  async updateExpense(id: string, patch: Partial<InsertExpense>): Promise<Expense> {
    const cur = this.expensesMap.get(id);
    if (!cur) throw new Error("Expense not found");
    const next: Expense = {
      ...cur,
      ...patch,
      amount: patch.amount !== undefined ? String(patch.amount) : cur.amount,
      id,
    };
    this.expensesMap.set(id, next);
    return next;
  }

  async deleteExpense(id: string): Promise<boolean> {
    return this.expensesMap.delete(id);
  }

  // ── Service Schedule ──────────────────────────────────────────────────────
  async getServiceScheduleEntries(): Promise<ServiceScheduleEntry[]> {
    return Array.from(this.serviceScheduleMap.values())
      .sort((a, b) => {
        const days = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
        const di = days.indexOf(a.dayOfWeek) - days.indexOf(b.dayOfWeek);
        return di !== 0 ? di : (a.routeOrder ?? 0) - (b.routeOrder ?? 0);
      });
  }

  async getServiceScheduleEntry(id: string): Promise<ServiceScheduleEntry | undefined> {
    return this.serviceScheduleMap.get(id);
  }

  async createServiceScheduleEntry(e: InsertServiceScheduleEntry): Promise<ServiceScheduleEntry> {
    const row: ServiceScheduleEntry = {
      id: `sse-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      clientId:           e.clientId ?? null,
      clientName:         e.clientName,
      contractId:         e.contractId ?? null,
      contractRef:        e.contractRef ?? null,
      address:            e.address ?? null,
      suburb:             e.suburb ?? null,
      serviceType:        e.serviceType ?? "other",
      frequency:          e.frequency ?? null,
      weekOfMonth:        e.weekOfMonth ?? null,
      dayOfWeek:          e.dayOfWeek ?? "Monday",
      serviceTime:        e.serviceTime ?? null,
      secondWeekOfMonth:  e.secondWeekOfMonth ?? null,
      secondDayOfWeek:    e.secondDayOfWeek ?? null,
      secondServiceTime:  e.secondServiceTime ?? null,
      onceOffDate:        e.onceOffDate ?? null,
      estimatedDuration:  e.estimatedDuration ?? null,
      assignedTeam:       e.assignedTeam ?? null,
      routeOrder:         e.routeOrder ?? 0,
      contractStatus:     e.contractStatus ?? "active",
      jobStatus:          e.jobStatus ?? null,
      googleMapsLink:     e.googleMapsLink ?? null,
      notes:              e.notes ?? null,
      isActive:           e.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.serviceScheduleMap.set(row.id, row);
    return row;
  }

  async updateServiceScheduleEntry(id: string, patch: Partial<InsertServiceScheduleEntry>): Promise<ServiceScheduleEntry | undefined> {
    const cur = this.serviceScheduleMap.get(id);
    if (!cur) return undefined;
    const next: ServiceScheduleEntry = { ...cur, ...patch, id, updatedAt: new Date() };
    this.serviceScheduleMap.set(id, next);
    return next;
  }

  async deleteServiceScheduleEntry(id: string): Promise<boolean> {
    return this.serviceScheduleMap.delete(id);
  }

  // Treatment Reports (MemStorage stubs — production uses DbStorage)
  async getTreatmentReports(): Promise<TreatmentReport[]> { return []; }
  async getTreatmentReportsByClient(_clientId: string): Promise<TreatmentReport[]> { return []; }
  async getTreatmentReportsByJob(_jobId: string): Promise<TreatmentReport[]> { return []; }
  async getTreatmentReport(_id: string): Promise<TreatmentReport | undefined> { return undefined; }
  async createTreatmentReport(r: InsertTreatmentReport): Promise<TreatmentReport> { throw new Error("Use DbStorage for treatment reports"); }
  async updateTreatmentReport(_id: string, _r: Partial<InsertTreatmentReport>): Promise<TreatmentReport> { throw new Error("Use DbStorage for treatment reports"); }
  async deleteTreatmentReport(_id: string): Promise<boolean> { return false; }

  // Communication Notes (MemStorage stubs — production uses DbStorage)
  async getCommunicationNotes(): Promise<CommunicationNote[]> { return []; }
  async getCommunicationNotesByClient(_clientId: string): Promise<CommunicationNote[]> { return []; }
  async getCommunicationNote(_id: string): Promise<CommunicationNote | undefined> { return undefined; }
  async createCommunicationNote(_n: InsertCommunicationNote): Promise<CommunicationNote> { throw new Error("Use DbStorage for communication notes"); }
  async updateCommunicationNote(_id: string, _n: Partial<InsertCommunicationNote>): Promise<CommunicationNote> { throw new Error("Use DbStorage for communication notes"); }
  async deleteCommunicationNote(_id: string): Promise<boolean> { return false; }

  // Accepted Quote Workflows (MemStorage stubs — production uses DbStorage)
  async getAcceptedWorkflows(): Promise<AcceptedWorkflow[]> { return []; }
  async getAcceptedWorkflow(_id: string): Promise<AcceptedWorkflow | undefined> { return undefined; }
  async getAcceptedWorkflowByQuote(_quoteId: string): Promise<AcceptedWorkflow | undefined> { return undefined; }
  async createAcceptedWorkflow(_w: InsertAcceptedWorkflow): Promise<AcceptedWorkflow> { throw new Error("Use DbStorage for accepted workflows"); }
  async updateAcceptedWorkflow(_id: string, _w: Partial<InsertAcceptedWorkflow>): Promise<AcceptedWorkflow> { throw new Error("Use DbStorage for accepted workflows"); }
  async deleteAcceptedWorkflow(_id: string): Promise<boolean> { return false; }

  async getContractOccurrences(start: Date, end: Date, opts: { departmentId?: string; technicianId?: string; teamId?: string } = {}): Promise<ContractOccurrence[]> {
    const contracts = Array.from(this.serviceContractsMap.values())
      .filter(c => c.activeStatus !== false)
      .filter(c => !opts.departmentId || c.departmentId === opts.departmentId)
      .filter(c => !opts.technicianId || c.assignedTechnicianId === opts.technicianId)
      .filter(c => !opts.teamId || c.assignedTeamId === opts.teamId);
    const out: ContractOccurrence[] = [];
    for (const c of contracts) {
      for (const occ of expandContract(c, start, end)) out.push(occ);
    }
    return out.sort((a, b) => +a.scheduledDate - +b.scheduledDate);
  }
}

// ─── Contract occurrence expander ──────────────────────────────────────────
export interface ContractOccurrence {
  id: string;                    // virtual id: `occ-<contractId>-<isoDate>`
  contractId: string;
  clientId: string;
  customerName: string;
  departmentId: string;
  serviceType: string;
  assignedTechnicianId: string | null;
  assignedTechnicianName: string | null;
  assignedTeamId: string | null;
  assignedTeamName: string | null;
  scheduledDate: Date;
  estimatedDuration: number | null;
  startTime: string | null;
  googleMapsLink: string | null;
  address: string | null;
  notes: string | null;
  frequency: string;
}

const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
function dayIdx(name: string | null): number { return name ? DAY_NAMES.indexOf(name) : -1; }
function applyTime(d: Date, hhmm: string | null): Date {
  if (!hhmm) return d;
  const [h, m] = hhmm.split(":").map(n => parseInt(n, 10) || 0);
  const r = new Date(d);
  r.setHours(h, m, 0, 0);
  return r;
}
function nthWeekdayOf(year: number, monthZero: number, weekOfMonth: number, dayName: string): Date | null {
  const di = dayIdx(dayName);
  if (di < 0) return null;
  if (weekOfMonth >= 5) {
    // last weekday of month
    const last = new Date(year, monthZero + 1, 0);
    const offset = (last.getDay() - di + 7) % 7;
    return new Date(year, monthZero, last.getDate() - offset);
  }
  const first = new Date(year, monthZero, 1);
  const offset = (di - first.getDay() + 7) % 7;
  const day = 1 + offset + (weekOfMonth - 1) * 7;
  const r = new Date(year, monthZero, day);
  return r.getMonth() === monthZero ? r : null;
}
function expandContract(c: ServiceContract, start: Date, end: Date): ContractOccurrence[] {
  const out: ContractOccurrence[] = [];
  const cStart = c.startDate ? new Date(c.startDate) : null;
  const cEnd = c.endDate ? new Date(c.endDate) : null;
  const winStart = new Date(start); winStart.setHours(0,0,0,0);
  const winEnd = new Date(end); winEnd.setHours(23,59,59,999);
  const inWin = (d: Date) =>
    d >= winStart && d <= winEnd && (!cStart || d >= new Date(cStart.getFullYear(), cStart.getMonth(), cStart.getDate())) && (!cEnd || d <= cEnd);

  const make = (date: Date, time: string | null): ContractOccurrence => {
    const sd = applyTime(date, time);
    return {
      id: `occ-${c.id}-${sd.toISOString()}`,
      contractId: c.id,
      clientId: c.clientId,
      customerName: c.customerName,
      departmentId: c.departmentId,
      serviceType: c.serviceType,
      assignedTechnicianId: c.assignedTechnicianId,
      assignedTechnicianName: c.assignedTechnicianName,
      assignedTeamId: c.assignedTeamId,
      assignedTeamName: c.assignedTeamName,
      scheduledDate: sd,
      estimatedDuration: c.estimatedDuration,
      startTime: time,
      googleMapsLink: c.googleMapsLink,
      address: c.address,
      notes: c.notes,
      frequency: c.frequency,
    };
  };

  const freq = c.frequency;

  if (freq === "Once-off") {
    if (cStart) {
      const d = new Date(cStart.getFullYear(), cStart.getMonth(), cStart.getDate());
      if (inWin(d)) out.push(make(d, c.startTime));
    }
    return out;
  }

  if (freq === "Daily") {
    const from = cStart && cStart > winStart ? new Date(cStart.getFullYear(), cStart.getMonth(), cStart.getDate()) : new Date(winStart);
    const to = cEnd && cEnd < winEnd ? cEnd : winEnd;
    const d = new Date(from);
    while (d <= to) {
      out.push(make(new Date(d), c.startTime));
      d.setDate(d.getDate() + 1);
    }
    return out;
  }

  if (freq === "2 x a week") {
    const days = [dayIdx(c.dayOfWeek), dayIdx(c.secondDayOfWeek)].filter(i => i >= 0);
    if (!days.length) return out;
    const from = cStart && cStart > winStart ? new Date(cStart.getFullYear(), cStart.getMonth(), cStart.getDate()) : new Date(winStart);
    const to = cEnd && cEnd < winEnd ? cEnd : winEnd;
    const d = new Date(from);
    while (d <= to) {
      if (days.includes(d.getDay())) out.push(make(new Date(d), c.startTime));
      d.setDate(d.getDate() + 1);
    }
    return out;
  }

  if (freq === "Weekly") {
    const di = dayIdx(c.dayOfWeek);
    if (di < 0) return out;
    const from = cStart && cStart > winStart ? new Date(cStart.getFullYear(), cStart.getMonth(), cStart.getDate()) : new Date(winStart);
    const to = cEnd && cEnd < winEnd ? cEnd : winEnd;
    const d = new Date(from);
    while (d <= to) {
      if (d.getDay() === di) out.push(make(new Date(d), c.startTime));
      d.setDate(d.getDate() + 1);
    }
    return out;
  }

  // Monthly variants — iterate month by month with step
  const monthlyStep: Record<string, number> = {
    "Monthly": 1, "Twice a month": 1, "Every 2 months": 2, "Quarterly": 3, "Every 6 months": 6,
  };
  if (freq in monthlyStep) {
    const step = monthlyStep[freq];
    // Use contract startDate as cadence anchor (deterministic). Fall back to epoch (Jan 1970) so the
    // step pattern is stable across query windows when startDate is missing for plain "Monthly"/"Twice a month".
    const anchor = cStart ?? new Date(1970, 0, 1);
    const anchorIdx = anchor.getFullYear() * 12 + anchor.getMonth();
    const startIdx = winStart.getFullYear() * 12 + winStart.getMonth();
    const endIdx = winEnd.getFullYear() * 12 + winEnd.getMonth();
    for (let mi = startIdx; mi <= endIdx; mi++) {
      if (mi < anchorIdx) continue;
      if ((mi - anchorIdx) % step !== 0) continue;
      const y = Math.floor(mi / 12);
      const mz = mi % 12;
      const first = nthWeekdayOf(y, mz, c.weekOfMonth ?? 1, c.dayOfWeek ?? "");
      if (first && inWin(first)) out.push(make(first, c.startTime));
      if (freq === "Twice a month" && c.secondWeekOfMonth && c.secondDayOfWeek) {
        const second = nthWeekdayOf(y, mz, c.secondWeekOfMonth, c.secondDayOfWeek);
        if (second && inWin(second)) out.push(make(second, c.secondStartTime || c.startTime));
      }
    }
    return out;
  }

  if (freq === "Annually") {
    const targetMz = (c.annualMonth ?? 1) - 1;
    const ys = winStart.getFullYear();
    const ye = winEnd.getFullYear();
    for (let y = ys; y <= ye; y++) {
      const d = nthWeekdayOf(y, targetMz, c.weekOfMonth ?? 1, c.dayOfWeek ?? "");
      if (d && inWin(d)) out.push(make(d, c.startTime));
    }
    return out;
  }

  return out;
}

import { DbStorage } from "./db-storage";
export const storage = new DbStorage();
