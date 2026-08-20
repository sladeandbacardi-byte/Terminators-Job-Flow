import { db } from "./db";
import {
  eq, and, gte, lte, lt, desc, asc, sql, or, ilike, isNull, isNotNull, ne, inArray,
} from "drizzle-orm";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";

import {
  users, departments, workers, clients, inventoryItems, rentalContracts, rentalContractItems,
  jobs, invoices, invoiceItems, jobInventoryItems, notifications,
  emailTemplates, emailLogs, suppliers, purchaseOrders, purchaseOrderItems,
  calendarEvents, customReports, quoteSubmissions, leadActivities, pricingLibrary, salesFollowUps,
  vehicles, vehicleAssignments, kmLogs, fuelFillups, vehicleInspections, vehicleIssues,
  serviceRecords, workshopJobs, teams, teamMembers, attendanceRecords, attendanceMemberRecords,
  serviceContracts, salesAppointments, expenses, serviceScheduleEntries, activityLogs,
  treatmentReports, communicationNotes, acceptedWorkflows, contractDeletionHistory,
  stockLocations, stockBalances, stockMovements, pickingLists, pickingListItems,
  stockChecks, stockCheckItems,
  unifiedContracts, contractLineItems, departmentDefaults, legalEntities,
  contractOccurrenceExceptions, fieldDiaries, clientPayments, sequences,
} from "@shared/schema";

import type {
  User, InsertUser,
  Department, InsertDepartment,
  Worker, InsertWorker,
  Client, InsertClient,
  InventoryItem, InsertInventoryItem,
  RentalContract, InsertRentalContract,
  Job, InsertJob,
  Invoice, InsertInvoice,
  InvoiceItem, InsertInvoiceItem,
  Notification, InsertNotification,
  EmailTemplate, InsertEmailTemplate,
  EmailLog, InsertEmailLog,
  JobInventoryItem, InsertJobInventoryItem,
  Supplier, InsertSupplier,
  PurchaseOrder, InsertPurchaseOrder,
  PurchaseOrderItem, InsertPurchaseOrderItem,
  CalendarEvent, InsertCalendarEvent,
  CustomReport, InsertCustomReport,
  QuoteSubmission, InsertQuoteSubmission,
  Vehicle, InsertVehicle,
  VehicleAssignment, InsertVehicleAssignment,
  KmLog, InsertKmLog,
  FuelFillup, InsertFuelFillup,
  VehicleInspection, InsertVehicleInspection,
  VehicleIssue, InsertVehicleIssue,
  ServiceRecord, InsertServiceRecord,
  WorkshopJob, InsertWorkshopJob,
  Team, InsertTeam,
  TeamMember, InsertTeamMember,
  AttendanceRecord, InsertAttendanceRecord,
  AttendanceMemberRecord, InsertAttendanceMemberRecord,
  ServiceContract, InsertServiceContract,
  SalesAppointment, InsertSalesAppointment,
  Expense, InsertExpense,
  ServiceScheduleEntry, InsertServiceScheduleEntry,
  PricingLibraryItem, InsertPricingLibraryItem,
  SalesFollowUp, InsertSalesFollowUp,
  TreatmentReport, InsertTreatmentReport,
  CommunicationNote, InsertCommunicationNote,
  AcceptedWorkflow, InsertAcceptedWorkflow,
  LeadActivity, InsertLeadActivity,
  ContractOccurrenceException, InsertContractOccurrenceException,
} from "@shared/schema";

import type {
  IStorage, BackupLog, BackupScheduleSettings, ContractOccurrence, IntegrityScan,
} from "./storage";

// ─── Contract occurrence helpers (pure functions, duplicated from storage.ts) ──

const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
function dayIdx(name: string | null): number { return name ? DAY_NAMES.indexOf(name) : -1; }
function applyTime(d: Date, hhmm: string | null): Date {
  if (!hhmm) return d;
  const [h, m] = hhmm.split(":").map(n => parseInt(n, 10) || 0);
  const r = new Date(d); r.setHours(h, m, 0, 0); return r;
}
function nthWeekdayOf(year: number, monthZero: number, weekOfMonth: number, dayName: string): Date | null {
  const di = dayIdx(dayName);
  if (di < 0) return null;
  if (weekOfMonth >= 5) {
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
    d >= winStart && d <= winEnd &&
    (!cStart || d >= new Date(cStart.getFullYear(), cStart.getMonth(), cStart.getDate())) &&
    (!cEnd || d <= cEnd);
  const make = (date: Date, time: string | null): ContractOccurrence => {
    const sd = applyTime(date, time);
    return {
      id: `occ-${c.id}-${sd.toISOString()}`,
      contractId: c.id, clientId: c.clientId, customerName: c.customerName,
      departmentId: c.departmentId, serviceType: c.serviceType,
      assignedTechnicianId: c.assignedTechnicianId, assignedTechnicianName: c.assignedTechnicianName,
      assignedTeamId: c.assignedTeamId, assignedTeamName: c.assignedTeamName,
      scheduledDate: sd, estimatedDuration: c.estimatedDuration, startTime: time,
      googleMapsLink: c.googleMapsLink, address: c.address, notes: c.notes, frequency: c.frequency,
    };
  };
  const freq = c.frequency;
  if (freq === "Once-off") {
    if (cStart) { const d = new Date(cStart.getFullYear(), cStart.getMonth(), cStart.getDate()); if (inWin(d)) out.push(make(d, c.startTime)); }
    return out;
  }
  if (freq === "Daily") {
    const from = cStart && cStart > winStart ? new Date(cStart.getFullYear(), cStart.getMonth(), cStart.getDate()) : new Date(winStart);
    const to = cEnd && cEnd < winEnd ? cEnd : winEnd;
    const d = new Date(from);
    while (d <= to) { out.push(make(new Date(d), c.startTime)); d.setDate(d.getDate() + 1); }
    return out;
  }
  if (freq === "2 x a week") {
    const days = [dayIdx(c.dayOfWeek), dayIdx(c.secondDayOfWeek)].filter(i => i >= 0);
    if (!days.length) return out;
    const from = cStart && cStart > winStart ? new Date(cStart.getFullYear(), cStart.getMonth(), cStart.getDate()) : new Date(winStart);
    const to = cEnd && cEnd < winEnd ? cEnd : winEnd;
    const d = new Date(from);
    while (d <= to) { if (days.includes(d.getDay())) out.push(make(new Date(d), c.startTime)); d.setDate(d.getDate() + 1); }
    return out;
  }
  if (freq === "Weekly") {
    const di = dayIdx(c.dayOfWeek);
    if (di < 0) return out;
    const from = cStart && cStart > winStart ? new Date(cStart.getFullYear(), cStart.getMonth(), cStart.getDate()) : new Date(winStart);
    const to = cEnd && cEnd < winEnd ? cEnd : winEnd;
    const d = new Date(from);
    while (d <= to) { if (d.getDay() === di) out.push(make(new Date(d), c.startTime)); d.setDate(d.getDate() + 1); }
    return out;
  }
  const monthlyStep: Record<string, number> = {
    "Monthly": 1, "Twice a month": 1, "Every 2 months": 2, "Quarterly": 3, "Every 6 months": 6,
  };
  if (freq in monthlyStep) {
    const step = monthlyStep[freq];
    const anchor = cStart ?? new Date(1970, 0, 1);
    const anchorIdx = anchor.getFullYear() * 12 + anchor.getMonth();
    const startIdx = winStart.getFullYear() * 12 + winStart.getMonth();
    const endIdx = winEnd.getFullYear() * 12 + winEnd.getMonth();
    for (let mi = startIdx; mi <= endIdx; mi++) {
      if (mi < anchorIdx) continue;
      if ((mi - anchorIdx) % step !== 0) continue;
      const y = Math.floor(mi / 12); const mz = mi % 12;
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
    for (let y = winStart.getFullYear(); y <= winEnd.getFullYear(); y++) {
      const d = nthWeekdayOf(y, targetMz, c.weekOfMonth ?? 1, c.dayOfWeek ?? "");
      if (d && inWin(d)) out.push(make(d, c.startTime));
    }
    return out;
  }
  return out;
}

// ─── Settings persistence ────────────────────────────────────────────────────

const SETTINGS_FILE = path.join(process.cwd(), ".local", "backup-settings.json");

// ─── DbStorage ───────────────────────────────────────────────────────────────

export class DbStorage implements IStorage {
  private backupLogs: BackupLog[] = [];
  private integrityScans: IntegrityScan[] = [];
  private backupSchedule: BackupScheduleSettings = {
    enabled: true, frequency: "daily", dayOfWeek: 1, hourUTC: 21, minuteUTC: 30,
    recipientEmail: process.env.BACKUP_EMAIL_TO ?? "info@terminators.co.za",
  };

  constructor() {
    this.loadSettings();
    this.initialize().catch(e => console.error("[DbStorage] init error:", e));
  }

  private loadSettings() {
    try {
      if (fs.existsSync(SETTINGS_FILE)) {
        const d = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
        if (d.backupSchedule) this.backupSchedule = d.backupSchedule;
        if (d.backupLogs) this.backupLogs = d.backupLogs;
      }
    } catch {}
  }

  private saveSettings() {
    try {
      fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true });
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify({ backupSchedule: this.backupSchedule, backupLogs: this.backupLogs }, null, 2));
    } catch {}
  }

  private async initialize(): Promise<void> {
    // PostgreSQL is the production source of truth.
    // Do not add new fields to API writes unless the Drizzle schema AND
    // PostgreSQL table columns are updated together. Previous bugs occurred
    // when Drizzle tried to write fields that did not exist in the DB table.
    //
    // Seeding is idempotent — ON CONFLICT DO NOTHING prevents duplicates.
    // We check four core tables: if ANY is empty, the seed fills missing data.
    // This handles partial-seed failures (e.g. previous boot crashed mid-seed).
    const [existingClients, existingJobs, existingInvoices, existingWorkers] = await Promise.all([
      db.select({ id: clients.id }).from(clients).limit(1),
      db.select({ id: jobs.id }).from(jobs).limit(1),
      db.select({ id: invoices.id }).from(invoices).limit(1),
      db.select({ id: workers.id }).from(workers).limit(1),
    ]);
    const needsSeed = existingClients.length === 0 || existingJobs.length === 0
      || existingInvoices.length === 0 || existingWorkers.length === 0;
    if (needsSeed) {
      console.log("[DbStorage] Seeding database...");
      await this.seedDatabase();
      console.log("[DbStorage] Seed complete.");
    } else {
      console.log("[DbStorage] Database already seeded.");
    }
    // Legal entities are seeded independently of the core-table check above so
    // that existing production databases (which already have clients/jobs/
    // invoices/workers and therefore skip seedDatabase()) still get the
    // default issuing entities the New Quote/Invoice forms depend on.
    await this.ensureLegalEntitiesSeeded();
    await this.runDataMigrations();
  }

  async ensureMobileTechnicians(): Promise<void> {
    const technicianRows = [
      { id: "mobile-tech-01", name: "Re-Althon", email: "mobile.realthon@terminators.co.za", employeeId: "MT-001", pin: "$2b$12$1OFA70tI7BqBlRIQaProT.aKmJTJzFPuJETb2Cml75h2hxxpyq0q." },
      { id: "mobile-tech-02", name: "Leon", email: "mobile.leon@terminators.co.za", employeeId: "MT-002", pin: "$2b$12$wnQJbkTzwJonlfVzb/aSAuzOAML/Grpg.DW2yODvrYz8jQ4jNBM3q" },
      { id: "mobile-tech-03", name: "Garth", email: "mobile.garth@terminators.co.za", employeeId: "MT-003", pin: "$2b$12$0ZnfJTlA1M5to9JDFq/ovO5W9993GsdqDN9mO3yAafqnLXeyPgE8m" },
      { id: "mobile-tech-04", name: "Jackie", email: "mobile.jackie@terminators.co.za", employeeId: "MT-004", pin: "$2b$12$qOmXf99GMgwHnrpuhm4.kez2lipdbe95QuaeOoK/0DH/LsEOcVwCW" },
      { id: "mobile-tech-05", name: "Sheryl", email: "mobile.sheryl@terminators.co.za", employeeId: "MT-005", pin: "$2b$12$ukCS.SJispVSmnEJAL39vO.4uvZM4x5nMMc.LR.DzLam45RzO4Dj." },
      { id: "mobile-tech-06", name: "Zain", email: "mobile.zain@terminators.co.za", employeeId: "MT-006", pin: "$2b$12$2rRU67ArfS57wCRynAH0b.QIM2IH3StpB4mOx426D6Qs5iUGOQYx6" },
      { id: "mobile-tech-07", name: "Mike", email: "mobile.mike@terminators.co.za", employeeId: "MT-007", pin: "$2b$12$NsFt8roiFgggruppux.pU.47RBM.2wcqgcwccGy1euAEv7ur3moMm" },
      { id: "mobile-tech-08", name: "X", email: "mobile.x@terminators.co.za", employeeId: "MT-008", pin: "$2b$12$/jWWeI5FnoOXHxfF4eFFU.ltklj6INnBjU15cZEH76K10DmKR/s/S" },
      { id: "mobile-tech-09", name: "Reece", email: "mobile.reece@terminators.co.za", employeeId: "MT-009", pin: "$2b$12$LsXLFAybBFD2sUNd8k1bPOGnTe8kGVkAd.i6nzigR2iEn06r4N3d2" },
    ];

    for (const technician of technicianRows) {
      await db.insert(workers).values({
        ...technician,
        phone: "",
        departmentId: "",
        role: "Technician",
        userType: "Mobile Technician",
        mobileAccessEnabled: true,
        isActive: true,
        createdAt: new Date(),
      }).onConflictDoNothing();
    }
  }

  private async ensureLegalEntitiesSeeded(): Promise<void> {
    // Only seed when the table is genuinely empty — some databases already
    // have legal entities (created via the Settings UI or an earlier seed),
    // and we must never create duplicate "Terminators CC" / "Terminators Pty
    // Ltd" rows alongside them.
    const existing = await db.select({ id: legalEntities.id }).from(legalEntities).limit(1);
    if (existing.length > 0) return;
    const defaultLegalEntities = [
      { id: "terminators_cc", name: "Terminators CC", isActive: true, isDefault: true },
      { id: "terminators_pty_ltd", name: "Terminators Pty Ltd", isActive: true, isDefault: false },
    ];
    for (const entity of defaultLegalEntities) {
      await db.insert(legalEntities).values(entity).onConflictDoNothing();
    }
    console.log("[DbStorage] Seeded default legal entities (Terminators CC, Terminators Pty Ltd).");
  }

  private async runDataMigrations(): Promise<void> {
    // Fix worker-6 name if it was seeded with the old display name
    const [w] = await db.select({ id: workers.id, name: workers.name })
      .from(workers).where(eq(workers.id, "worker-6")).limit(1);
    if (w && w.name !== "Sales 2") {
      await db.update(workers).set({ name: "Sales 2" }).where(eq(workers.id, "worker-6"));
      console.log(`[DbStorage] Migrated worker-6 name: "${w.name}" → "Sales 2"`);
    }

    // Fix the associated vehicle name
    const [v] = await db.select({ id: vehicles.id, name: vehicles.name })
      .from(vehicles).where(eq(vehicles.id, "vehicle-5")).limit(1);
    if (v && v.name !== "Suzuki Celerio (Sales 2)") {
      await db.update(vehicles).set({ name: "Suzuki Celerio (Sales 2)" }).where(eq(vehicles.id, "vehicle-5"));
      console.log(`[DbStorage] Migrated vehicle-5 name: "${v.name}" → "Suzuki Celerio (Sales 2)"`);
    }

    // Migrate inventory item types from old snake_case values to new display values
    const typeMap: Record<string, string> = {
      product:          "Consumable",
      rental_equipment: "Equipment / Rental Item",
    };
    for (const [oldType, newType] of Object.entries(typeMap)) {
      const r = await db.update(inventoryItems).set({ type: newType })
        .where(eq(inventoryItems.type, oldType));
      if ((r.rowCount ?? 0) > 0)
        console.log(`[DbStorage] Migrated ${r.rowCount} inventory item(s): type "${oldType}" → "${newType}"`);
    }
  }

  private async seedDatabase(): Promise<void> {
    // ── Departments ──────────────────────────────────────────────────────────
    const deptRows = [
      { id: "div-1", name: "Pest Control",   colorCode: "#22c55e", description: "Professional pest control and extermination services" },
      { id: "div-2", name: "Sanitary Bins",  colorCode: "#8b5cf6", description: "Sanitary waste collection, disposal and feminine hygiene services" },
      { id: "div-3", name: "Washroom",       colorCode: "#3b82f6", description: "Complete washroom maintenance, hygiene and supply services" },
      { id: "div-4", name: "Deep Cleaning",  colorCode: "#f59e0b", description: "Professional deep cleaning and specialized cleaning services" },
      { id: "div-5", name: "Sales",          colorCode: "#ec4899", description: "Sales and customer service administration" },
      { id: "div-6", name: "Admin",          colorCode: "#6366f1", description: "Administration, finance, and human resources" },
      { id: "div-7", name: "Accounts",       colorCode: "#f59e0b", description: "Finance, accounts, billing and human resources" },
      { id: "div-8", name: "Daily Cleaning", colorCode: "#14b8a6", description: "Daily cleaning and general cleaning services" },
    ];
    for (const d of deptRows) {
      await db.insert(departments).values(d).onConflictDoNothing();
    }

    // ── Workers ──────────────────────────────────────────────────────────────
    const workerRows = [
      { name: "Julien Botha",       email: "julien@terminators.co.za",    phone: "+27 82 123 0001", departmentId: "div-6", role: "Operations Manager" },
      { name: "Maryka Venter",      email: "service1@terminators.co.za",  phone: "+27 82 666 0748", departmentId: "div-6", role: "Pest Control Services Manager" },
      { name: "Mariette Koekemoer", email: "service@terminators.co.za",   phone: "+27 78 982 6249", departmentId: "div-6", role: "Hygiene Services Manager" },
      { name: "Juli Holtshausen",   email: "accounts@terminators.co.za",  phone: "+27 82 618 9711", departmentId: "div-7", role: "Finance & HR Manager" },
      { name: "Sheryl-Lyn Lee",     email: "sales@terminators.co.za",     phone: "+27 82 889 2453", departmentId: "div-5", role: "Existing Clients Sales & Admin" },
      { name: "Sales 2",             email: "sales2@terminators.co.za",    phone: "+27 82 770 0028", departmentId: "div-5", role: "Sales Rep" },
      { name: "Zuki Sandi",         email: "zuki@terminators.co.za",      phone: "+27 82 123 0007", departmentId: "div-4", role: "Ablution Deep Cleaning Supervisor" },
      { name: "Reece Ebrahim",      email: "reece@terminators.co.za",     phone: "+27 82 123 0008", departmentId: "div-1", role: "Pest Control Operator" },
      { name: "Garth du Preez",     email: "garth@terminators.co.za",     phone: "+27 82 123 0009", departmentId: "div-1", role: "Pest Control Operator" },
      { name: "Michael Meyer",      email: "michael@terminators.co.za",   phone: "+27 82 123 0010", departmentId: "div-1", role: "Pest Control Operator" },
      { name: "Xolani Ndzotoyi",    email: "xolani@terminators.co.za",    phone: "+27 82 123 0011", departmentId: "div-1", role: "Pest Control Operator" },
      { name: "Zain Abdol",         email: "zain@terminators.co.za",      phone: "+27 82 123 0012", departmentId: "div-3", role: "Washroom Supervisor" },
      { name: "Leon Coltman",       email: "leon@terminators.co.za",      phone: "+27 82 123 0013", departmentId: "div-1", role: "Pest Control Assistant" },
      { name: "Jackie Roelfse",     email: "jackie@terminators.co.za",    phone: "+27 82 123 0014", departmentId: "div-2", role: "Sanitary Bin B Team Supervisor" },
      { name: "Re-Althon",          email: "reealthon@terminators.co.za", phone: "+27 82 123 0015", departmentId: "div-2", role: "Sanitary Bin A Team Supervisor" },
      { name: "Belinda",            email: "belinda@terminators.co.za",   phone: "+27 82 123 0016", departmentId: "div-2", role: "Sanitary Bin Technician" },
      { name: "Racquel",            email: "racquel@terminators.co.za",   phone: "+27 82 123 0017", departmentId: "div-2", role: "Sanitary Bin Technician" },
      { name: "Asanda",             email: "asanda@terminators.co.za",    phone: "+27 82 123 0018", departmentId: "div-2", role: "Sanitary Bin Technician" },
      { name: "Nosipho",            email: "nosipho@terminators.co.za",   phone: "+27 82 123 0019", departmentId: "div-4", role: "Deep Cleaning Technician" },
      { name: "Nini",               email: "nini@terminators.co.za",      phone: "+27 82 123 0020", departmentId: "div-4", role: "Deep Cleaning Technician" },
      { name: "Babalwa",            email: "babalwa@terminators.co.za",   phone: "+27 82 123 0021", departmentId: "div-4", role: "Deep Cleaning Technician" },
      { name: "Veronica",           email: "veronica@terminators.co.za",  phone: "+27 82 123 0022", departmentId: "div-8", role: "Daily Cleaning Technician" },
      { name: "Margrett",           email: "margrett@terminators.co.za",  phone: "+27 82 123 0023", departmentId: "div-8", role: "Daily Cleaning Technician" },
    ];
    for (let i = 0; i < workerRows.length; i++) {
      await db.insert(workers).values({ id: `worker-${i + 1}`, ...workerRows[i], isActive: true, createdAt: new Date() }).onConflictDoNothing();
    }

    // ── Clients ──────────────────────────────────────────────────────────────
    const clientRows = [
      { name: "Pick n Pay Greenacres",     address: "Greenacres Shopping Centre, Port Elizabeth",     phone: "+27 41 234 5678", email: "manager@pnp-greenacres.co.za",  businessType: "retail",        departmentId: "div-1" },
      { name: "Shoprite Checkers Walmer",  address: "Walmer Park Shopping Centre, Port Elizabeth",    phone: "+27 41 234 5679", email: "admin@shoprite.co.za",           businessType: "retail",        departmentId: "div-2" },
      { name: "Baywest Mall",              address: "Baywest City, Port Elizabeth",                    phone: "+27 41 234 5680", email: "facilities@baywest.co.za",       businessType: "retail",        departmentId: "div-3" },
      { name: "Boardwalk Casino",          address: "Marine Drive, Summerstrand, Port Elizabeth",      phone: "+27 41 234 5681", email: "maintenance@boardwalk.co.za",    businessType: "hospitality",   departmentId: "div-4" },
      { name: "McDonald's Greenacres",     address: "Greenacres Shopping Centre, Port Elizabeth",     phone: "+27 41 234 5682", email: "manager@mcdonalds-ge.co.za",     businessType: "restaurant",    departmentId: "div-1" },
      { name: "KFC Newton Park",           address: "Newton Park Shopping Centre, Port Elizabeth",     phone: "+27 41 234 5683", email: "store@kfc-newton.co.za",         businessType: "restaurant",    departmentId: "div-1" },
      { name: "Steers Summerstrand",       address: "Beach Road, Summerstrand, Port Elizabeth",        phone: "+27 41 234 5684", email: "manager@steers-summ.co.za",      businessType: "restaurant",    departmentId: "div-1" },
      { name: "Mutual Heights Office Park",address: "Heugh Road, Walmer, Port Elizabeth",              phone: "+27 41 234 5685", email: "facilities@mutualheights.co.za", businessType: "office",        departmentId: "div-3" },
      { name: "Baywest Office Tower",      address: "Baywest City, Port Elizabeth",                    phone: "+27 41 234 5686", email: "admin@baywestoffice.co.za",      businessType: "office",        departmentId: "div-4" },
      { name: "Life Mercantile Hospital",  address: "Mercantile Hospital Street, Port Elizabeth",      phone: "+27 41 234 5687", email: "facilities@lifemercantile.co.za",businessType: "healthcare",    departmentId: "div-2" },
      { name: "Netcare Greenacres",        address: "Greenacres, Port Elizabeth",                      phone: "+27 41 234 5688", email: "admin@netcare-ge.co.za",         businessType: "healthcare",    departmentId: "div-4" },
      { name: "Grey High School",          address: "West Hill, Port Elizabeth",                       phone: "+27 41 234 5689", email: "admin@greyhigh.co.za",           businessType: "education",     departmentId: "div-2" },
      { name: "Collegiate Girls High",     address: "Mount Pleasant, Port Elizabeth",                  phone: "+27 41 234 5690", email: "facilities@collegiate.co.za",    businessType: "education",     departmentId: "div-3" },
      { name: "Volkswagen SA",             address: "Uitenhage Road, Port Elizabeth",                  phone: "+27 41 234 5691", email: "facilities@vw.co.za",            businessType: "manufacturing", departmentId: "div-4" },
      { name: "General Motors SA",         address: "Struandale, Port Elizabeth",                      phone: "+27 41 234 5692", email: "maintenance@gm.co.za",           businessType: "manufacturing", departmentId: "div-1" },
    ];
    for (let i = 0; i < clientRows.length; i++) {
      await db.insert(clients).values({
        id: `client-${i + 1}`, status: "active", paymentTerms: "30 days",
        contactPerson: null, taxNumber: null, creditLimit: null, notes: null,
        createdAt: new Date(), updatedAt: new Date(), ...clientRows[i],
      }).onConflictDoNothing();
    }

    // ── Inventory items ──────────────────────────────────────────────────────
    const invRows = [
      { name: "Paper Towel Dispenser - Wall Mount",   type: "Equipment / Rental Item", sku: "PTD-WM-001",   quantity: 15, minStockLevel: 10, maxStockLevel: 100, reorderPoint: 20, unitPrice: "149.99", description: "Professional wall-mounted paper towel dispenser", departmentId: "div-3", location: "Main Warehouse - Shelf A3", supplier: "HygieneTech Solutions", lastRestocked: new Date('2025-08-10') },
      { name: "Paper Roll Refill - Premium",          type: "Consumable",          sku: "PRR-PREM-001",  quantity: 8,  minStockLevel: 15, maxStockLevel: 500, reorderPoint: 25, unitPrice: "12.50",  description: "High-quality paper towel rolls, 200m per roll",      departmentId: "div-3", location: "Main Warehouse - Shelf B2", supplier: "PaperCorp Industries", lastRestocked: new Date('2025-08-05') },
      { name: "Hand Sanitizer Dispenser - Automatic", type: "Equipment / Rental Item", sku: "HSD-AUTO-001",  quantity: 30, minStockLevel: 5,  maxStockLevel: 50,  reorderPoint: 10, unitPrice: "199.99", description: "Touchless automatic hand sanitizer dispenser",        departmentId: "div-3", location: "Main Warehouse - Shelf A1", supplier: "HygieneTech Solutions", lastRestocked: new Date('2025-08-12') },
      { name: "Hand Sanitizer Refill - 1L",           type: "Consumable",          sku: "HSR-1L-001",    quantity: 3,  minStockLevel: 20, maxStockLevel: 200, reorderPoint: 30, unitPrice: "35.00",  description: "Premium hand sanitizer refill, alcohol-based",       departmentId: "div-3", location: "Storage Room B - Shelf 1", supplier: "ChemiClean Supplies", lastRestocked: new Date('2025-07-28') },
      { name: "Pest Control Bait Station",            type: "Equipment / Rental Item", sku: "PCB-STAT-001",  quantity: 25, minStockLevel: 8,  maxStockLevel: 80,  reorderPoint: 15, unitPrice: "89.99",  description: "Tamper-resistant bait station for rodent control",    departmentId: "div-1", location: "Pest Control Storage - Rack C", supplier: "PestTech Professional", lastRestocked: new Date('2025-08-14') },
      { name: "Pest Control Bait - Rodenticide",      type: "Consumable",          sku: "PCB-ROD-001",   quantity: 5,  minStockLevel: 12, maxStockLevel: 150, reorderPoint: 20, unitPrice: "25.00",  description: "Professional rodenticide bait blocks",               departmentId: "div-1", location: "Secure Storage - Locked Cabinet A", supplier: "ToxiGuard Solutions", lastRestocked: new Date('2025-08-01') },
      { name: "Washroom Cleaning Kit - Professional", type: "Consumable",          sku: "WCK-PROF-001",  quantity: 12, minStockLevel: 5,  maxStockLevel: 30,  reorderPoint: 8,  unitPrice: "85.00",  description: "Complete washroom cleaning kit with disinfectants",   departmentId: "div-3", location: "Cleaning Supplies - Shelf D1", supplier: "CleanTech Professional", lastRestocked: new Date('2025-08-10') },
      { name: "Toilet Paper Dispenser - Commercial",  type: "Equipment / Rental Item", sku: "TPD-COM-001",   quantity: 18, minStockLevel: 8,  maxStockLevel: 40,  reorderPoint: 12, unitPrice: "120.00", description: "Heavy-duty commercial toilet paper dispenser",        departmentId: "div-3", location: "Washroom Equipment - Rack A", supplier: "RestroomPro Systems", lastRestocked: new Date('2025-08-12') },
      { name: "Sanitary Bin - Pedal Operated",        type: "Equipment / Rental Item", sku: "SB-PED-001",    quantity: 15, minStockLevel: 10, maxStockLevel: 50,  reorderPoint: 15, unitPrice: "75.00",  description: "Hygienic pedal-operated sanitary waste bin",         departmentId: "div-2", location: "Sanitary Equipment - Shelf B", supplier: "HygieneTech Solutions", lastRestocked: new Date('2025-08-08') },
      { name: "Sanitary Bin Liners - Biodegradable",  type: "Consumable",          sku: "SBL-BIO-001",   quantity: 25, minStockLevel: 50, maxStockLevel: 500, reorderPoint: 75, unitPrice: "18.50",  description: "Eco-friendly biodegradable sanitary waste bin liners", departmentId: "div-2", location: "Consumables Storage - Bin C", supplier: "EcoWaste Solutions", lastRestocked: new Date('2025-08-15') },
      { name: "Deep Clean Disinfectant - Industrial", type: "Consumable",          sku: "DCD-IND-001",   quantity: 8,  minStockLevel: 10, maxStockLevel: 60,  reorderPoint: 15, unitPrice: "45.00",  description: "Industrial-strength disinfectant for deep cleaning",  departmentId: "div-3", location: "Chemical Storage - Locked Section", supplier: "ChemiClean Industrial", lastRestocked: new Date('2025-08-05') },
      { name: "Steam Cleaner - Professional",         type: "Equipment / Rental Item", sku: "SC-PROF-001",   quantity: 4,  minStockLevel: 2,  maxStockLevel: 10,  reorderPoint: 3,  unitPrice: "850.00", description: "High-pressure steam cleaner for deep sanitization",   departmentId: "div-4", location: "Equipment Bay - Section E", supplier: "SteamTech Professional", lastRestocked: new Date('2025-08-01') },
      { name: "Carpet Cleaning Machine - Industrial", type: "Equipment / Rental Item", sku: "CCM-IND-001",   quantity: 3,  minStockLevel: 1,  maxStockLevel: 8,   reorderPoint: 2,  unitPrice: "1200.00",description: "Industrial carpet cleaning machine with extraction",   departmentId: "div-4", location: "Equipment Bay - Section D", supplier: "CleanTech Equipment", lastRestocked: new Date('2025-08-03') },
      { name: "Floor Polisher - Commercial",          type: "Equipment / Rental Item", sku: "FP-COM-001",    quantity: 6,  minStockLevel: 2,  maxStockLevel: 12,  reorderPoint: 4,  unitPrice: "450.00", description: "Heavy-duty floor polisher for commercial spaces",     departmentId: "div-4", location: "Equipment Bay - Section C", supplier: "FloorCare Pro", lastRestocked: new Date('2025-08-07') },
      { name: "Glass Cleaner - Professional Grade",   type: "Consumable",          sku: "GC-PRO-001",    quantity: 12, minStockLevel: 20, maxStockLevel: 100, reorderPoint: 30, unitPrice: "25.00",  description: "Streak-free professional glass cleaner, 5L container", departmentId: "div-4", location: "Chemical Storage - Section B", supplier: "GlassTech Solutions", lastRestocked: new Date('2025-08-09') },
      { name: "Pressure Washer - Heavy Duty",         type: "Equipment / Rental Item", sku: "PW-HD-001",     quantity: 2,  minStockLevel: 1,  maxStockLevel: 5,   reorderPoint: 2,  unitPrice: "950.00", description: "High-pressure washer for exterior deep cleaning",     departmentId: "div-4", location: "Equipment Bay - Outdoor Section", supplier: "PressureClean Systems", lastRestocked: new Date('2025-08-11') },
      { name: "Insecticide Spray - Professional",     type: "Consumable",          sku: "IS-PRO-001",    quantity: 15, minStockLevel: 25, maxStockLevel: 150, reorderPoint: 35, unitPrice: "42.00",  description: "Professional-grade insecticide spray, 1L bottle",    departmentId: "div-1", location: "Secure Storage - Locked Cabinet B", supplier: "PestGuard Professional", lastRestocked: new Date('2025-08-13') },
      { name: "Termite Detection Kit",                type: "Consumable",          sku: "TDK-001",       quantity: 8,  minStockLevel: 5,  maxStockLevel: 30,  reorderPoint: 10, unitPrice: "125.00", description: "Professional termite detection and monitoring kit",   departmentId: "div-1", location: "Pest Control Storage - Shelf A", supplier: "TermiteGuard Systems", lastRestocked: new Date('2025-08-06') },
      { name: "Feminine Hygiene Disposal Unit",       type: "Equipment / Rental Item", sku: "FHDU-001",      quantity: 20, minStockLevel: 15, maxStockLevel: 60,  reorderPoint: 25, unitPrice: "95.00",  description: "Discrete feminine hygiene disposal unit with odor control", departmentId: "div-2", location: "Sanitary Equipment - Rack C", supplier: "HygieneTech Solutions", lastRestocked: new Date('2025-08-14') },
      { name: "Disinfectant Spray - Hospital Grade",  type: "Consumable",          sku: "DS-HG-001",     quantity: 18, minStockLevel: 30, maxStockLevel: 150, reorderPoint: 45, unitPrice: "32.00",  description: "Hospital-grade disinfectant spray for sanitary equipment", departmentId: "div-2", location: "Chemical Storage - Section A", supplier: "MediClean Supplies", lastRestocked: new Date('2025-08-12') },
    ];
    for (let i = 0; i < invRows.length; i++) {
      await db.insert(inventoryItems).values({ id: `inv-${i + 1}`, ...invRows[i], createdAt: new Date() }).onConflictDoNothing();
    }

    // ── Suppliers ────────────────────────────────────────────────────────────
    const supplierRows = [
      { id: "supplier-1", name: "HygieneTech Solutions", contactPerson: "Sarah Johnson", email: "sarah@hygienetech.co.za",   phone: "+27 11 234 5678", address: "123 Industrial Road, Johannesburg, 2001", website: "https://hygienetech.co.za",    category: "hygiene",      departmentId: "div-2", paymentTerms: "30 days", isActive: true, notes: "Primary supplier for paper towel dispensers", createdAt: new Date("2024-01-10") },
      { id: "supplier-2", name: "Paper Products SA",     contactPerson: "Michael Chen",  email: "michael@paperproducts.co.za",phone: "+27 21 987 6543", address: "456 Commerce Street, Cape Town, 8001",    website: "https://paperproducts.co.za",  category: "hygiene",      departmentId: "div-3", paymentTerms: "15 days", isActive: true, notes: "Reliable supplier for paper towel refills",   createdAt: new Date("2024-01-12") },
      { id: "supplier-3", name: "PestPro Solutions",     contactPerson: "David Smith",   email: "david@pestpro.co.za",        phone: "+27 12 555 7890", address: "789 Security Avenue, Pretoria, 0001",     website: "https://pestpro.co.za",        category: "pest_control", departmentId: "div-1", paymentTerms: "45 days", isActive: true, notes: "Specialized pest control supplies and baits", createdAt: new Date("2024-01-15") },
      { id: "supplier-4", name: "SafeClean Distributors",contactPerson: "Emma Wilson",   email: "emma@safeclean.co.za",       phone: "+27 11 444 3333", address: "321 Cleaning Way, Sandton, 2196",         website: "https://safeclean.co.za",      category: "hygiene",      departmentId: "div-3", paymentTerms: "30 days", isActive: true, notes: "Hand sanitizers and antibacterial products",  createdAt: new Date("2024-02-01") },
      { id: "supplier-5", name: "TrapTech Industries",   contactPerson: "James Brown",   email: "james@traptech.co.za",       phone: "+27 31 222 1111", address: "654 Industrial Park, Durban, 4001",       website: "https://traptech.co.za",       category: "pest_control", departmentId: "div-1", paymentTerms: "60 days", isActive: true, notes: "Monitoring stations and pest control equipment",createdAt: new Date("2024-02-05") },
      { id: "supplier-6", name: "AutoClean Systems",     contactPerson: "Lisa Green",    email: "lisa@autoclean.co.za",       phone: "+27 11 888 9999", address: "987 Tech Boulevard, Midrand, 1686",       website: "https://autoclean.co.za",      category: "equipment",    departmentId: "div-2", paymentTerms: "30 days", isActive: false,notes: "Automatic dispensers. Currently on hold.",    createdAt: new Date("2024-03-01") },
    ];
    for (const s of supplierRows) {
      await db.insert(suppliers).values(s).onConflictDoNothing();
    }

    // ── Invoices ─────────────────────────────────────────────────────────────
    const now = new Date();
    const d = (n: number) => { const x = new Date(now); x.setDate(x.getDate() + n); return x; };
    const yr = now.getFullYear();
    const invData = [
      { id: "invoice-1", invoiceNumber: `INV-${yr}-0001`, clientId: "client-1", status: "sent",    issueDate: new Date('2025-08-01'), dueDate: new Date('2025-08-31'), subtotal: "850.00",   taxAmount: "127.50", total: "977.50",   paidAmount: "0.00",    paymentDate: null },
      { id: "invoice-2", invoiceNumber: `INV-${yr}-0002`, clientId: "client-2", status: "paid",    issueDate: new Date('2025-07-01'), dueDate: new Date('2025-07-31'), subtotal: "1200.00",  taxAmount: "180.00", total: "1380.00",  paidAmount: "1380.00", paymentDate: new Date('2025-07-28') },
      { id: "invoice-3", invoiceNumber: `INV-${yr}-0003`, clientId: "client-3", status: "overdue", issueDate: new Date('2025-06-01'), dueDate: new Date('2025-06-30'), subtotal: "2500.00",  taxAmount: "375.00", total: "2875.00",  paidAmount: "0.00",    paymentDate: null },
    ];
    const sampleInvData = [
      { id: "sinv-1",  invoiceNumber: `INV-${yr}-0004`, clientId: "client-1",  status: "paid",    issueDate: d(-60), dueDate: d(-30), paymentDate: d(-35), subtotal: "2173.91", taxAmount: "326.09", total: "2500.00",  paidAmount: "2500.00", notes: "March contract payment - Pick n Pay" },
      { id: "sinv-2",  invoiceNumber: `INV-${yr}-0005`, clientId: "client-2",  status: "paid",    issueDate: d(-55), dueDate: d(-25), paymentDate: d(-28), subtotal: "1565.22", taxAmount: "234.78", total: "1800.00",  paidAmount: "1800.00", notes: "March contract payment - Shoprite" },
      { id: "sinv-3",  invoiceNumber: `INV-${yr}-0006`, clientId: "client-4",  status: "paid",    issueDate: d(-50), dueDate: d(-20), paymentDate: d(-22), subtotal: "3913.04", taxAmount: "586.96", total: "4500.00",  paidAmount: "4500.00", notes: "March washroom contract - Boardwalk" },
      { id: "sinv-4",  invoiceNumber: `INV-${yr}-0007`, clientId: "client-11", status: "paid",    issueDate: d(-14), dueDate: d(16),  paymentDate: d(-5),  subtotal: "4521.74", taxAmount: "678.26", total: "5200.00",  paidAmount: "5200.00", notes: "April hospital service - Life Mercantile" },
      { id: "sinv-5",  invoiceNumber: `INV-${yr}-0008`, clientId: "client-5",  status: "paid",    issueDate: d(-12), dueDate: d(18),  paymentDate: d(-3),  subtotal: "1086.96", taxAmount: "163.04", total: "1250.00",  paidAmount: "1250.00", notes: "April pest control - McDonald's Greenacres" },
      { id: "sinv-6",  invoiceNumber: `INV-${yr}-0009`, clientId: "client-7",  status: "paid",    issueDate: d(-6),  dueDate: d(24),  paymentDate: d(-2),  subtotal: "1739.13", taxAmount: "260.87", total: "2000.00",  paidAmount: "2000.00", notes: "April sanitary bins" },
      { id: "sinv-7",  invoiceNumber: `INV-${yr}-0010`, clientId: "client-9",  status: "paid",    issueDate: d(-5),  dueDate: d(25),  paymentDate: d(-1),  subtotal: "2608.70", taxAmount: "391.30", total: "3000.00",  paidAmount: "3000.00", notes: "April deep clean - Greenacres" },
      { id: "sinv-8",  invoiceNumber: `INV-${yr}-0011`, clientId: "client-3",  status: "paid",    issueDate: d(-3),  dueDate: d(27),  paymentDate: d(0),   subtotal: "3478.26", taxAmount: "521.74", total: "4000.00",  paidAmount: "4000.00", notes: "April washroom contract - Baywest Mall" },
      { id: "sinv-9",  invoiceNumber: `INV-${yr}-0012`, clientId: "client-1",  status: "sent",    issueDate: d(-15), dueDate: d(15),  paymentDate: null,   subtotal: "2173.91", taxAmount: "326.09", total: "2500.00",  paidAmount: "0.00",    notes: "April contract payment - Pick n Pay" },
      { id: "sinv-10", invoiceNumber: `INV-${yr}-0013`, clientId: "client-2",  status: "sent",    issueDate: d(-10), dueDate: d(20),  paymentDate: null,   subtotal: "1565.22", taxAmount: "234.78", total: "1800.00",  paidAmount: "0.00",    notes: "April contract payment - Shoprite" },
      { id: "sinv-11", invoiceNumber: `INV-${yr}-0014`, clientId: "client-5",  status: "sent",    issueDate: d(-8),  dueDate: d(22),  paymentDate: null,   subtotal: "2782.61", taxAmount: "417.39", total: "3200.00",  paidAmount: "0.00",    notes: "April pest control rental - McDonald's" },
      { id: "sinv-12", invoiceNumber: `INV-${yr}-0015`, clientId: "client-3",  status: "overdue", issueDate: d(-45), dueDate: d(-15), paymentDate: null,   subtotal: "2608.70", taxAmount: "391.30", total: "3000.00",  paidAmount: "0.00",    notes: "February washroom service - Baywest Mall" },
      { id: "sinv-13", invoiceNumber: `INV-${yr}-0016`, clientId: "client-12", status: "overdue", issueDate: d(-40), dueDate: d(-10), paymentDate: null,   subtotal: "1304.35", taxAmount: "195.65", total: "1500.00",  paidAmount: "0.00",    notes: "February hygiene - Grey High School" },
      { id: "sinv-14", invoiceNumber: `INV-${yr}-0017`, clientId: "client-11", status: "paid",    issueDate: d(-35), dueDate: d(-5),  paymentDate: d(-8),  subtotal: "4521.74", taxAmount: "678.26", total: "5200.00",  paidAmount: "5200.00", notes: "March hospital service - Life Mercantile" },
      { id: "sinv-15", invoiceNumber: `INV-${yr}-0018`, clientId: "client-6",  status: "draft",   issueDate: d(-2),  dueDate: d(28),  paymentDate: null,   subtotal: "652.17",  taxAmount: "97.83",  total: "750.00",   paidAmount: "0.00",    notes: "April rodent control - KFC Newton Park" },
    ];
    for (const inv of [...invData, ...sampleInvData]) {
      await db.insert(invoices).values({
        ...inv, notes: (inv as any).notes ?? null, terms: "Payment due within 30 days",
        sageInvoiceId: null, sageStatus: null, createdAt: new Date(), updatedAt: new Date(),
      }).onConflictDoNothing();
    }

    // Invoice items for first 3 invoices
    const invItemsData = [
      { id: "item-invoice-1-1", invoiceId: "invoice-1", description: "Monthly Pest Control - Interior", quantity: "1", unitPrice: "450.00", total: "450.00" },
      { id: "item-invoice-1-2", invoiceId: "invoice-1", description: "Monthly Pest Control - Exterior", quantity: "1", unitPrice: "400.00", total: "400.00" },
      { id: "item-invoice-2-1", invoiceId: "invoice-2", description: "Sanitizer Refill - Entrances",    quantity: "8", unitPrice: "75.00",  total: "600.00" },
      { id: "item-invoice-2-2", invoiceId: "invoice-2", description: "Sanitizer Refill - Washrooms",    quantity: "12",unitPrice: "50.00",  total: "600.00" },
      { id: "item-invoice-3-1", invoiceId: "invoice-3", description: "Deep Sanitization - Food Court",  quantity: "1", unitPrice: "1500.00",total: "1500.00" },
      { id: "item-invoice-3-2", invoiceId: "invoice-3", description: "Deep Sanitization - Common Areas",quantity: "1", unitPrice: "1000.00",total: "1000.00" },
    ];
    for (const item of invItemsData) {
      await db.insert(invoiceItems).values({ ...item, inventoryItemId: null, jobId: null, contractId: null }).onConflictDoNothing();
    }

    // ── Jobs ─────────────────────────────────────────────────────────────────
    const dt = (offsetDays: number, hour: number, minute: number = 0) => {
      const x = new Date(now); x.setDate(x.getDate() + offsetDays); x.setHours(hour, minute, 0, 0); return x;
    };
    const jobDefaults = { linkedQuoteId: null, scheduledTime: null, startTime: null, endTime: null, completionNotes: null, isRecurring: false, recurringPattern: null, parentJobId: null, diary: null, howInvoiced: null, email: null, areaCode: null, salesperson: null, contractNo: null, isContract: false, service: null, insects: null, price: null, pricePerUnit: null, increaseDate: null, specialInstructions: null, internalInstructions: null, isFixed: false, orderNo: null, recurrenceInterval: null, recurrencePeriod: null, recurrenceDay: null, recurrenceCount: null, recurrenceYears: null, completedDate: null, actualDuration: null, updatedAt: new Date() };
    const sampleJobs = [
      { id: "job-1",  jobNumber: `JOB-${yr}-0001`, clientId: "client-5",  workerId: "worker-8",  departmentId: "div-1", title: "Monthly Pest Control Inspection",     serviceType: "pest_control",  status: "scheduled",   priority: "medium", scheduledDate: dt(1,8,0),   estimatedDuration: 120, location: "Greenacres Shopping Centre, Port Elizabeth",       notes: "Focus on kitchen areas and waste disposal zones",            description: "Routine monthly pest control inspection and treatment", createdAt: dt(-5,9) },
      { id: "job-2",  jobNumber: `JOB-${yr}-0002`, clientId: "client-6",  workerId: "worker-8",  departmentId: "div-1", title: "Emergency Rodent Control",            serviceType: "pest_control",  status: "in_progress", priority: "high",   scheduledDate: dt(0,10,30), estimatedDuration: 180, location: "Newton Park Shopping Centre, Port Elizabeth",      notes: "Customer reported rodent droppings in storage room",         description: "Emergency call for rodent infestation in storage area",createdAt: dt(-1,8) },
      { id: "job-3",  jobNumber: `JOB-${yr}-0003`, clientId: "client-15", workerId: "worker-9",  departmentId: "div-1", title: "Industrial Pest Assessment",          serviceType: "pest_control",  status: "completed",   priority: "high",   scheduledDate: dt(-3,7,30), estimatedDuration: 240, location: "Struandale, Port Elizabeth",                        notes: "Full facility assessment completed. Report submitted.",       description: "Comprehensive pest risk assessment", actualDuration: 210, createdAt: dt(-5,9) },
      { id: "job-4",  jobNumber: `JOB-${yr}-0004`, clientId: "client-7",  workerId: "worker-10", departmentId: "div-1", title: "Restaurant Kitchen Fumigation",       serviceType: "pest_control",  status: "scheduled",   priority: "medium", scheduledDate: dt(3,14,0),  estimatedDuration: 90,  location: "Summerstrand, Port Elizabeth",                      notes: "After-hours treatment required",                             description: "Full kitchen area fumigation and treatment",           createdAt: dt(-2,8) },
      { id: "job-5",  jobNumber: `JOB-${yr}-0005`, clientId: "client-2",  workerId: "worker-13", departmentId: "div-2", title: "Weekly Sanitary Bin Service",         serviceType: "sanitary_bins", status: "scheduled",   priority: "medium", scheduledDate: dt(2,9,0),   estimatedDuration: 90,  location: "Walmer Park Shopping Centre, Port Elizabeth",      notes: "Service all female restroom facilities",                     description: "Weekly collection and maintenance of sanitary disposal units", createdAt: dt(-3,8) },
      { id: "job-6",  jobNumber: `JOB-${yr}-0006`, clientId: "client-11", workerId: "worker-14", departmentId: "div-2", title: "Hospital Sanitary Service",           serviceType: "sanitary_bins", status: "in_progress", priority: "high",   scheduledDate: dt(0,8,0),   estimatedDuration: 150, location: "Mercantile Hospital Street, Port Elizabeth",        notes: "Include maternity and general wards",                        description: "Bi-weekly sanitary bin service for hospital facilities",createdAt: dt(-2,8) },
      { id: "job-7",  jobNumber: `JOB-${yr}-0007`, clientId: "client-12", workerId: "worker-15", departmentId: "div-2", title: "School Hygiene Program Setup",        serviceType: "sanitary_bins", status: "completed",   priority: "medium", scheduledDate: dt(-4,7,0),  estimatedDuration: 180, location: "West Hill, Port Elizabeth",                         notes: "20 units installed across girl's facilities.",               description: "Installation and setup of sanitary disposal units", actualDuration: 150, createdAt: dt(-6,8) },
      { id: "job-8",  jobNumber: `JOB-${yr}-0008`, clientId: "client-3",  workerId: "worker-12", departmentId: "div-3", title: "Mall Washroom Maintenance",           serviceType: "washroom",      status: "scheduled",   priority: "medium", scheduledDate: dt(1,13,0),  estimatedDuration: 240, location: "Baywest City, Port Elizabeth",                      notes: "Cover all public washroom facilities in mall",               description: "Daily washroom cleaning and supply replenishment",      createdAt: dt(-2,8) },
      { id: "job-9",  jobNumber: `JOB-${yr}-0009`, clientId: "client-8",  workerId: "worker-12", departmentId: "div-3", title: "Office Washroom Deep Clean",          serviceType: "washroom",      status: "in_progress", priority: "medium", scheduledDate: dt(0,14,0),  estimatedDuration: 180, location: "Heugh Road, Walmer, Port Elizabeth",                notes: "Focus on tile cleaning and grout restoration",               description: "Quarterly deep cleaning of office building washrooms",  createdAt: dt(-1,8) },
      { id: "job-10", jobNumber: `JOB-${yr}-0010`, clientId: "client-13", workerId: "worker-12", departmentId: "div-3", title: "School Washroom Upgrade",             serviceType: "washroom",      status: "completed",   priority: "high",   scheduledDate: dt(-5,8,30), estimatedDuration: 300, location: "Mount Pleasant, Port Elizabeth",                    notes: "15 new dispensers installed. Old equipment removed.",        description: "Installation of new paper towel and soap dispensers", actualDuration: 270, createdAt: dt(-7,8) },
      { id: "job-11", jobNumber: `JOB-${yr}-0011`, clientId: "client-4",  workerId: "worker-23", departmentId: "div-4", title: "Casino Deep Clean Service",           serviceType: "deep_cleaning", status: "scheduled",   priority: "high",   scheduledDate: dt(4,22,0),  estimatedDuration: 480, location: "Marine Drive, Summerstrand, Port Elizabeth",        notes: "Night shift operation. Casino remains operational.",          description: "Monthly deep cleaning of casino floor and VIP areas",  createdAt: dt(-3,8) },
      { id: "job-12", jobNumber: `JOB-${yr}-0012`, clientId: "client-14", workerId: "worker-16", departmentId: "div-4", title: "Factory Floor Deep Clean",            serviceType: "deep_cleaning", status: "in_progress", priority: "high",   scheduledDate: dt(0,7,0),   estimatedDuration: 360, location: "Uitenhage Road, Port Elizabeth",                    notes: "Coordinate with production schedule.",                       description: "Industrial deep cleaning of production floor",          createdAt: dt(-2,8) },
      { id: "job-13", jobNumber: `JOB-${yr}-0013`, clientId: "client-10", workerId: "worker-22", departmentId: "div-4", title: "Office Building Window Cleaning",     serviceType: "deep_cleaning", status: "completed",   priority: "medium", scheduledDate: dt(-6,8,0),  estimatedDuration: 600, location: "Baywest City, Port Elizabeth",                      notes: "All floors completed ahead of schedule.",                     description: "External and internal window cleaning for 15-story office", actualDuration: 540, createdAt: dt(-8,8) },
      { id: "job-14", jobNumber: `JOB-${yr}-0014`, clientId: "client-14", workerId: "worker-16", departmentId: "div-4", title: "Hospital Ward Deep Clean (2-Day)",   serviceType: "deep_cleaning", status: "scheduled",   priority: "high",   scheduledDate: dt(2,7,0),   estimatedDuration: 2880,location: "Provincial Hospital, Port Elizabeth",               notes: "Must complete before ward reopens. Security clearance required.",description: "Full 2-day deep clean of surgical wards and ICU",    createdAt: dt(-1,8) },
      { id: "job-15", jobNumber: `JOB-${yr}-0015`, clientId: "client-5",  workerId: "worker-9",  departmentId: "div-1", title: "School Holiday Pest Treatment (3-Day)",serviceType: "pest_control",  status: "scheduled",   priority: "high",   scheduledDate: dt(5,8,0),   estimatedDuration: 4320,location: "Westering High School, Port Elizabeth",             notes: "School on holiday. Full access granted.",                     description: "Comprehensive 3-day fumigation and pest eradication",   createdAt: dt(0,9) },
    ];
    for (const job of sampleJobs) {
      await db.insert(jobs).values({ ...jobDefaults, ...job }).onConflictDoNothing();
    }

    // ── Rental Contracts ─────────────────────────────────────────────────────
    const rcRows = [
      { id: "rc-1", clientId: "client-1",  inventoryItemId: "inv-1",  unitPrice: "125.00", quantity: 20, billingFrequency: "monthly", calculatedTotal: "2500.00", monthlyPrice: "2500.00", startDate: new Date(yr, now.getMonth()-6, 1), endDate: new Date(yr+1, now.getMonth()-6, 1), isActive: true, notes: "Monthly paper towel dispenser rental - Pick n Pay Greenacres", contractNumber: "RC-2026-0001" },
      { id: "rc-2", clientId: "client-2",  inventoryItemId: "inv-3",  unitPrice: "150.00", quantity: 12, billingFrequency: "monthly", calculatedTotal: "1800.00", monthlyPrice: "1800.00", startDate: new Date(yr, now.getMonth()-4, 1), endDate: new Date(yr+1, now.getMonth()-4, 1), isActive: true, notes: "Hand sanitizer stations rental - Shoprite Walmer", contractNumber: "RC-2026-0002" },
      { id: "rc-3", clientId: "client-5",  inventoryItemId: "inv-5",  unitPrice: "200.00", quantity: 16, billingFrequency: "monthly", calculatedTotal: "3200.00", monthlyPrice: "3200.00", startDate: new Date(yr, now.getMonth()-8, 1), endDate: new Date(yr, now.getMonth()+1, 1),  isActive: true, notes: "Pest control station rental - McDonald's Greenacres", contractNumber: "RC-2026-0003" },
      { id: "rc-4", clientId: "client-4",  inventoryItemId: "inv-7",  unitPrice: "300.00", quantity: 15, billingFrequency: "monthly", calculatedTotal: "4500.00", monthlyPrice: "4500.00", startDate: new Date(yr, now.getMonth()-3, 1), endDate: new Date(yr+1, now.getMonth()-3, 1), isActive: true, notes: "Washroom cleaning service contract - Boardwalk Casino", contractNumber: "RC-2026-0004" },
      { id: "rc-5", clientId: "client-10", inventoryItemId: "inv-8",  unitPrice: "150.00", quantity: 13, billingFrequency: "monthly", calculatedTotal: "1950.00", monthlyPrice: "1950.00", startDate: new Date(yr, now.getMonth()-2, 1), endDate: new Date(yr+1, now.getMonth()-2, 1), isActive: true, notes: "Feminine hygiene disposal unit rental - Baywest Office Tower", contractNumber: "RC-2026-0005" },
      { id: "rc-6", clientId: "client-11", inventoryItemId: "inv-4",  unitPrice: "200.00", quantity: 26, billingFrequency: "monthly", calculatedTotal: "5200.00", monthlyPrice: "5200.00", startDate: new Date(yr, now.getMonth()-5, 1), endDate: new Date(yr+1, now.getMonth()-5, 1), isActive: true, notes: "Full hygiene service contract - Life Mercantile Hospital", contractNumber: "RC-2026-0006" },
    ];
    for (const rc of rcRows) {
      await db.insert(rentalContracts).values({ ...rc, lastPriceIncrease: null, createdAt: new Date() }).onConflictDoNothing();
    }

    // ── Purchase Orders ──────────────────────────────────────────────────────
    const poRows = [
      { id: "po-seed-1", poNumber: "PO-2026-0001", supplierId: "supplier-1", requestedById: "user-1", approvedById: "user-1",  status: "approved", totalAmount: "1850.00", requestDate: d(0),   approvalDate: d(0),   expectedDeliveryDate: d(3),  actualDeliveryDate: null, sentDate: null, notes: "Pesticide restock - daily run",                    rejectionReason: null },
      { id: "po-seed-2", poNumber: "PO-2026-0002", supplierId: "supplier-2", requestedById: "user-1", approvedById: null,       status: "pending",  totalAmount: "640.00",  requestDate: d(0),   approvalDate: null,   expectedDeliveryDate: d(5),  actualDeliveryDate: null, sentDate: null, notes: "Sanitary bag restocking",                           rejectionReason: null },
      { id: "po-seed-3", poNumber: "PO-2026-0003", supplierId: "supplier-1", requestedById: "user-1", approvedById: "user-1",  status: "received", totalAmount: "3200.00", requestDate: d(-2),  approvalDate: d(-2),  expectedDeliveryDate: d(0),  actualDeliveryDate: d(0),  sentDate: d(-1),notes: "Monthly washroom supplies",                          rejectionReason: null },
      { id: "po-seed-4", poNumber: "PO-2026-0004", supplierId: "supplier-3", requestedById: "user-1", approvedById: "user-1",  status: "approved", totalAmount: "1420.00", requestDate: d(-3),  approvalDate: d(-3),  expectedDeliveryDate: d(2),  actualDeliveryDate: null, sentDate: null, notes: "Deep cleaning chemicals - April stock",              rejectionReason: null },
      { id: "po-seed-5", poNumber: "PO-2026-0005", supplierId: "supplier-2", requestedById: "user-1", approvedById: "user-1",  status: "sent",     totalAmount: "975.00",  requestDate: d(-4),  approvalDate: d(-4),  expectedDeliveryDate: d(1),  actualDeliveryDate: null, sentDate: d(-3),notes: "PPE gloves and masks - field staff",                 rejectionReason: null },
      { id: "po-seed-6", poNumber: "PO-2026-0006", supplierId: "supplier-1", requestedById: "user-1", approvedById: "user-1",  status: "received", totalAmount: "5500.00", requestDate: d(-10), approvalDate: d(-10), expectedDeliveryDate: d(-7), actualDeliveryDate: d(-7), sentDate: d(-9),notes: "Bulk rodenticide order for Q2",                      rejectionReason: null },
      { id: "po-seed-7", poNumber: "PO-2026-0007", supplierId: "supplier-3", requestedById: "user-1", approvedById: "user-1",  status: "received", totalAmount: "2800.00", requestDate: d(-14), approvalDate: d(-13), expectedDeliveryDate: d(-10),actualDeliveryDate: d(-10),sentDate: d(-12),notes: "Washroom paper product replenishment",               rejectionReason: null },
      { id: "po-seed-8", poNumber: "PO-2026-0008", supplierId: "supplier-2", requestedById: "user-1", approvedById: "user-1",  status: "approved", totalAmount: "1650.00", requestDate: d(-7),  approvalDate: d(-7),  expectedDeliveryDate: d(3),  actualDeliveryDate: null, sentDate: null, notes: "Vehicle cleaning supplies - fleet",                  rejectionReason: null },
    ];
    for (const po of poRows) {
      await db.insert(purchaseOrders).values({ ...po, createdAt: new Date(), updatedAt: new Date() }).onConflictDoNothing();
    }

    // ── Quote Submissions ────────────────────────────────────────────────────
    const quoteRows = [
      { id: "quote-1", quoteNumber: "QT-2026-0001", companyName: "Spar Newton Park",          contactPerson: "Johan Myburgh",   email: "jmyburgh@spar-np.co.za",    phone: "+27 41 365 1234", serviceType: "pest_control",  description: "Monthly pest control contract for supermarket, 800sqm.",             address: "Newton Park Shopping Centre, Port Elizabeth",  preferredContactMethod: "phone",  status: "new",       assignedTo: null,       notes: null, submittedAt: d(-1), followUpDate: d(2), origination: "google",         originationOther: null, frequency: null, specialInstructions: null, lineItemsJson: null },
      { id: "quote-2", quoteNumber: "QT-2026-0002", companyName: "Greenacres Medical Centre",  contactPerson: "Dr. Sandra Botha",email: "admin@greenacresmed.co.za", phone: "+27 41 374 5678", serviceType: "sanitary_bins", description: "Medical facility requires sanitary bin service for 6 female restrooms.", address: "Greenacres, Port Elizabeth",                   preferredContactMethod: "email",  status: "contacted", assignedTo: "worker-2", notes: "Spoke with Dr Botha. Sending quote by Wednesday.", submittedAt: d(-4), followUpDate: d(1), origination: "referral",       originationOther: null, frequency: null, specialInstructions: null, lineItemsJson: null },
      { id: "quote-3", quoteNumber: "QT-2026-0003", companyName: "Bay Harbour Hotel",          contactPerson: "Thandi Nkosi",    email: "t.nkosi@bayharbour.co.za",  phone: "+27 41 583 9000", serviceType: "washroom",      description: "Full washroom maintenance for 4-star hotel. 35 guest rooms.",         address: "Marine Drive, Summerstrand, Port Elizabeth",   preferredContactMethod: "either", status: "quoted",    assignedTo: "worker-2", notes: "Quote sent: R8,500/month. Awaiting sign-off.", submittedAt: d(-7), followUpDate: d(3), origination: "website",        originationOther: null, frequency: "monthly", specialInstructions: "Service before 07:00 AM.", lineItemsJson: null },
      { id: "quote-4", quoteNumber: "QT-2026-0004", companyName: "Nelson Mandela University",  contactPerson: "Mr. Sipho Dlamini",email: "facilities@nmu.ac.za",      phone: "+27 41 504 1111", serviceType: "deep_cleaning", description: "Semester-end deep clean of 3 lecture blocks and library, 4200sqm.",  address: "University Way, Summerstrand, Port Elizabeth", preferredContactMethod: "email",  status: "quoted",    assignedTo: "worker-2", notes: "Quote submitted R22,000. Awaiting procurement approval.", submittedAt: d(0), followUpDate: d(5), origination: "email",          originationOther: null, frequency: "once_off", specialInstructions: "Security clearance required.", lineItemsJson: null },
      { id: "quote-5", quoteNumber: "QT-2026-0005", companyName: "Woolworths Food - Walmer Park",contactPerson: "Henk van der Merwe",email: "manager@ww-walmer.co.za",phone: "+27 41 368 2200", serviceType: "pest_control",  description: "Monthly pest control for Woolworths store.",                         address: "Walmer Park Shopping Centre, Port Elizabeth",  preferredContactMethod: "phone",  status: "quoted",    assignedTo: "worker-2", notes: "Very interested. Quote sent: R3,200/month.", submittedAt: d(-3), followUpDate: d(4), origination: "existing_client", originationOther: null, frequency: "monthly", specialInstructions: "After trading hours only.", lineItemsJson: null },
    ];
    for (const q of quoteRows) {
      await db.insert(quoteSubmissions).values(q).onConflictDoNothing();
    }

    // ── Service Contracts ────────────────────────────────────────────────────
    const sixMonthsAgo = new Date(yr, now.getMonth() - 6, 1);
    const oneYearAhead = new Date(yr + 1, now.getMonth(), 1);
    const scRows = [
      { id: "sc-seed-1", clientId: "client-5",  customerName: "McDonald's Greenacres",  departmentId: "div-1", serviceType: "pest_control",  assignedTechnicianId: "worker-8",  assignedTechnicianName: null, assignedTeamId: null, assignedTeamName: null, frequency: "Monthly",  invoicingFrequency: "Monthly",  startDate: sixMonthsAgo, endDate: oneYearAhead, weekOfMonth: 2, dayOfWeek: "Tuesday",  secondWeekOfMonth: null, secondDayOfWeek: null, secondStartTime: null, annualMonth: null, startTime: "07:00", estimatedDuration: 120, googleMapsLink: null, address: "Greenacres Shopping Centre, Port Elizabeth",   notes: "Monthly pest control. Focus on kitchen and back-of-house areas.", contractPrice: "1250.00", isServiceContract: true, isRentalContract: false, increaseDate: null, increasePercentage: null, routeOrder: 1, contractNumber: "SC-2026-0001", ppu: null, fixedTime: true,  invoiceRule: "Invoice per completed job", mustBeInvoiced: true, financeNotes: null, stockTrackingRequired: false, refillRule: "Not Applicable", stockNotes: null, confirmWithClient: false, activeStatus: true, createdAt: sixMonthsAgo, updatedAt: now },
      { id: "sc-seed-2", clientId: "client-10", customerName: "Life Mercantile Hospital",departmentId: "div-2", serviceType: "sanitary_bins", assignedTechnicianId: "worker-13", assignedTechnicianName: null, assignedTeamId: null, assignedTeamName: null, frequency: "Weekly",   invoicingFrequency: "Monthly",  startDate: sixMonthsAgo, endDate: oneYearAhead, weekOfMonth: null, dayOfWeek: "Thursday", secondWeekOfMonth: null, secondDayOfWeek: null, secondStartTime: null, annualMonth: null, startTime: "08:00", estimatedDuration: 150, googleMapsLink: null, address: "Mercantile Hospital Street, Port Elizabeth",   notes: "Weekly sanitary bin service for all hospital facilities.",         contractPrice: "3800.00", isServiceContract: true, isRentalContract: false, increaseDate: null, increasePercentage: null, routeOrder: 1, contractNumber: "SC-2026-0002", ppu: null, fixedTime: false, invoiceRule: "Monthly",                   mustBeInvoiced: true, financeNotes: null, stockTrackingRequired: true,  refillRule: "Refills Included",  stockNotes: "Sanitary bags and liner refills included.", confirmWithClient: false, activeStatus: true, createdAt: sixMonthsAgo, updatedAt: now },
      { id: "sc-seed-3", clientId: "client-3",  customerName: "Baywest Mall",           departmentId: "div-3", serviceType: "washroom",      assignedTechnicianId: "worker-12", assignedTechnicianName: null, assignedTeamId: null, assignedTeamName: null, frequency: "Weekly",   invoicingFrequency: "Monthly",  startDate: sixMonthsAgo, endDate: oneYearAhead, weekOfMonth: null, dayOfWeek: "Monday",   secondWeekOfMonth: null, secondDayOfWeek: null, secondStartTime: null, annualMonth: null, startTime: "13:00", estimatedDuration: 240, googleMapsLink: null, address: "Baywest City, Port Elizabeth",                 notes: "Weekly washroom maintenance and supply replenishment.",             contractPrice: "4200.00", isServiceContract: true, isRentalContract: false, increaseDate: null, increasePercentage: null, routeOrder: 1, contractNumber: "SC-2026-0003", ppu: null, fixedTime: false, invoiceRule: "Monthly",                   mustBeInvoiced: true, financeNotes: null, stockTrackingRequired: true,  refillRule: "Refills Included",  stockNotes: "Paper towels, soap and air freshener refills included.", confirmWithClient: false, activeStatus: true, createdAt: sixMonthsAgo, updatedAt: now },
      { id: "sc-seed-4", clientId: "client-4",  customerName: "Boardwalk Casino",       departmentId: "div-4", serviceType: "deep_cleaning", assignedTechnicianId: "worker-22", assignedTechnicianName: null, assignedTeamId: null, assignedTeamName: null, frequency: "Monthly",  invoicingFrequency: "Monthly",  startDate: sixMonthsAgo, endDate: oneYearAhead, weekOfMonth: 1, dayOfWeek: "Saturday", secondWeekOfMonth: null, secondDayOfWeek: null, secondStartTime: null, annualMonth: null, startTime: "22:00", estimatedDuration: 480, googleMapsLink: null, address: "Marine Drive, Summerstrand, Port Elizabeth",   notes: "Monthly night-shift deep clean. Casino remains operational.",       contractPrice: "5500.00", isServiceContract: true, isRentalContract: false, increaseDate: null, increasePercentage: null, routeOrder: 1, contractNumber: "SC-2026-0004", ppu: null, fixedTime: true,  invoiceRule: "Invoice per completed job", mustBeInvoiced: true, financeNotes: null, stockTrackingRequired: false, refillRule: "Not Applicable", stockNotes: null, confirmWithClient: true,  activeStatus: true, createdAt: sixMonthsAgo, updatedAt: now },
    ];
    for (const sc of scRows) {
      await db.insert(serviceContracts).values(sc).onConflictDoNothing();
    }

    // ── Sales Appointments ───────────────────────────────────────────────────
    const fmtDate = (x: Date) => x.toISOString().slice(0, 10);
    const relDay = (n: number) => { const x = new Date(now); x.setDate(x.getDate() + n); return fmtDate(x); };
    const saRows = [
      { id: "sa-1", title: "New lead meeting - Greenfield Office Park",  clientName: "Greenfield Office Park",  contactPerson: "Mr. Patel",       phone: "082 111 2233", siteAddress: "12 Greenfield Rd, Summerstrand",  appointmentType: "new_lead_meeting",    appointmentTypeOther: null, assignedToId: "worker-6", date: relDay(0), startTime: "09:00", endTime: "10:00", estimatedDuration: 60, status: "planned",   notes: "Prospect from Google ad.",           completionNote: null, clientFeedback: null, nextAction: null, followUpDate: null, leadId: "quote-1", quoteId: null, departmentId: "div-5" },
      { id: "sa-2", title: "Site visit - Blue Waters Hotel",             clientName: "Blue Waters Hotel",       contactPerson: "Ms. Botha",        phone: "041 580 9000", siteAddress: "Blue Waters Hotel, Beach Rd, PE", appointmentType: "site_visit",          appointmentTypeOther: null, assignedToId: "worker-6", date: relDay(0), startTime: "11:30", endTime: "12:30", estimatedDuration: 60, status: "confirmed", notes: "Check current pest situation.",       completionNote: null, clientFeedback: null, nextAction: null, followUpDate: null, leadId: null, quoteId: null, departmentId: "div-5" },
      { id: "sa-3", title: "Quote follow-up - Medicross Clinic",         clientName: "Medicross Clinic",        contactPerson: "Admin Manager",    phone: "041 365 5000", siteAddress: "Medicross, Lorraine, PE",         appointmentType: "quote_followup",      appointmentTypeOther: null, assignedToId: "worker-5", date: relDay(0), startTime: "14:00", endTime: "14:30", estimatedDuration: 30, status: "confirmed", notes: "Follow up on washroom services quote.", completionNote: null, clientFeedback: null, nextAction: null, followUpDate: null, leadId: "quote-3", quoteId: null, departmentId: "div-5" },
      { id: "sa-4", title: "Existing client visit - Spar Group PE",      clientName: "Spar Group PE",           contactPerson: "Mr. van Wyk",      phone: "082 500 1234", siteAddress: "Spar DC, Target Field Rd, PE",    appointmentType: "existing_client_visit",appointmentTypeOther: null, assignedToId: "worker-5", date: relDay(1), startTime: "09:00", endTime: "10:00", estimatedDuration: 60, status: "planned",   notes: "Monthly check-in.",                  completionNote: null, clientFeedback: null, nextAction: null, followUpDate: null, leadId: null, quoteId: null, departmentId: "div-5" },
      { id: "sa-5", title: "Contract renewal - Murray & Roberts",        clientName: "Murray & Roberts",        contactPerson: "Facilities Manager",phone: "011 301 0000", siteAddress: "M&R Head Office, Bedfordview",    appointmentType: "contract_renewal",    appointmentTypeOther: null, assignedToId: "worker-6", date: relDay(1), startTime: "13:00", endTime: "14:00", estimatedDuration: 60, status: "planned",   notes: "Annual review and contract renewal.", completionNote: null, clientFeedback: null, nextAction: null, followUpDate: null, leadId: null, quoteId: null, departmentId: "div-5" },
      { id: "sa-6", title: "Internal sales meeting - Q2 targets",        clientName: "Internal",                contactPerson: "Management",       phone: "",             siteAddress: "Head Office",                     appointmentType: "internal_meeting",    appointmentTypeOther: null, assignedToId: "worker-5", date: relDay(2), startTime: "08:00", endTime: "09:00", estimatedDuration: 60, status: "confirmed", notes: "Q2 pipeline review and target setting.", completionNote: null, clientFeedback: null, nextAction: null, followUpDate: null, leadId: null, quoteId: null, departmentId: "div-5" },
    ];
    for (const sa of saRows) {
      await db.insert(salesAppointments).values({ ...sa, createdAt: new Date() }).onConflictDoNothing();
    }
  }

  // ─── Users ────────────────────────────────────────────────────────────────

  async getUser(id: string): Promise<User | undefined> {
    const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return row;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [row] = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return row;
  }

  async createUser(data: InsertUser): Promise<User> {
    const [row] = await db.insert(users).values({ id: randomUUID(), ...data }).returning();
    return row;
  }

  // ─── Departments ─────────────────────────────────────────────────────────

  async getDepartments(): Promise<Department[]> { return db.select().from(departments); }

  async getDepartment(id: string): Promise<Department | undefined> {
    const [row] = await db.select().from(departments).where(eq(departments.id, id)).limit(1);
    return row;
  }

  async createDepartment(data: InsertDepartment): Promise<Department> {
    const [row] = await db.insert(departments).values({ id: randomUUID(), ...data }).returning();
    return row;
  }

  // ─── Workers ─────────────────────────────────────────────────────────────

  async getWorkers(): Promise<Worker[]> { return db.select().from(workers).orderBy(asc(workers.name)); }

  async getWorker(id: string): Promise<Worker | undefined> {
    const [row] = await db.select().from(workers).where(eq(workers.id, id)).limit(1);
    return row;
  }

  async getWorkerByEmployeeId(employeeId: string): Promise<Worker | undefined> {
    const [row] = await db.select().from(workers).where(eq(workers.employeeId, employeeId)).limit(1);
    return row;
  }

  async getWorkersByDepartment(departmentId: string): Promise<Worker[]> {
    return db.select().from(workers).where(eq(workers.departmentId, departmentId));
  }

  async createWorker(data: InsertWorker): Promise<Worker> {
    const [row] = await db.insert(workers).values({ id: randomUUID(), ...data, createdAt: new Date() }).returning();
    return row;
  }

  async updateWorker(id: string, data: Partial<InsertWorker>): Promise<Worker> {
    const [row] = await db.update(workers).set(data).where(eq(workers.id, id)).returning();
    if (!row) throw new Error("Worker not found");
    return row;
  }

  async deleteWorker(id: string): Promise<boolean> {
    const r = await db.delete(workers).where(eq(workers.id, id));
    return (r.rowCount ?? 0) > 0;
  }

  // ─── Clients ─────────────────────────────────────────────────────────────

  async getClients(): Promise<Client[]> { return db.select().from(clients).orderBy(asc(clients.name)); }

  async getClient(id: string): Promise<Client | undefined> {
    const [row] = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
    return row;
  }

  async createClient(data: InsertClient): Promise<Client> {
    const [row] = await db.insert(clients).values({ id: randomUUID(), ...data, createdAt: new Date(), updatedAt: new Date() }).returning();
    return row;
  }

  async updateClient(id: string, data: Partial<InsertClient>): Promise<Client> {
    const [row] = await db.update(clients).set({ ...data, updatedAt: new Date() }).where(eq(clients.id, id)).returning();
    if (!row) throw new Error("Client not found");
    return row;
  }

  async deleteClient(id: string): Promise<boolean> {
    const r = await db.delete(clients).where(eq(clients.id, id));
    return (r.rowCount ?? 0) > 0;
  }

  // ─── Inventory Items ─────────────────────────────────────────────────────

  async getInventoryItems(): Promise<InventoryItem[]> { return db.select().from(inventoryItems).orderBy(asc(inventoryItems.name)); }

  async getInventoryItem(id: string): Promise<InventoryItem | undefined> {
    const [row] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, id)).limit(1);
    return row;
  }

  async getInventoryItemsByType(type: string): Promise<InventoryItem[]> {
    return db.select().from(inventoryItems).where(eq(inventoryItems.type, type));
  }

  async getInventoryItemsByDepartment(departmentId: string): Promise<InventoryItem[]> {
    return db.select().from(inventoryItems).where(eq(inventoryItems.departmentId, departmentId));
  }

  async createInventoryItem(data: InsertInventoryItem): Promise<InventoryItem> {
    const [row] = await db.insert(inventoryItems).values({
      id: randomUUID(), ...data, createdAt: new Date(), updatedAt: new Date(),
    }).returning();
    return row;
  }

  async updateInventoryItem(id: string, data: Partial<InsertInventoryItem>): Promise<InventoryItem> {
    const [row] = await db.update(inventoryItems).set({ ...data, updatedAt: new Date() })
      .where(eq(inventoryItems.id, id)).returning();
    if (!row) throw new Error("Inventory item not found");
    return row;
  }

  async deleteInventoryItem(id: string): Promise<boolean> {
    const r = await db.delete(inventoryItems).where(eq(inventoryItems.id, id));
    return (r.rowCount ?? 0) > 0;
  }

  async getLowStockItems(): Promise<InventoryItem[]> {
    return db.select().from(inventoryItems).where(
      sql`${inventoryItems.quantity} <= ${inventoryItems.minStockLevel}`
    );
  }

  async getReorderRequiredItems(): Promise<InventoryItem[]> {
    return db.select().from(inventoryItems).where(
      sql`${inventoryItems.quantity} <= ${inventoryItems.reorderPoint}`
    );
  }

  async getOverstockedItems(): Promise<InventoryItem[]> {
    return db.select().from(inventoryItems).where(
      sql`${inventoryItems.quantity} >= ${inventoryItems.maxStockLevel}`
    );
  }

  async getStockAlerts(): Promise<{ lowStock: InventoryItem[]; reorderRequired: InventoryItem[]; overstocked: InventoryItem[] }> {
    return {
      lowStock: await this.getLowStockItems(),
      reorderRequired: await this.getReorderRequiredItems(),
      overstocked: await this.getOverstockedItems(),
    };
  }

  async updateInventoryQuantity(id: string, newQuantity: number, _note?: string): Promise<InventoryItem> {
    const [current] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, id)).limit(1);
    if (!current) throw new Error("Inventory item not found");
    const update: any = { quantity: newQuantity };
    if (newQuantity > (current.quantity ?? 0)) update.lastRestocked = new Date();
    const [row] = await db.update(inventoryItems).set(update).where(eq(inventoryItems.id, id)).returning();
    if (newQuantity <= (current.minStockLevel ?? 0)) {
      await this.createNotification({ title: "Low Stock Alert", message: `${current.name} (${current.sku}) is now at ${newQuantity} units - below minimum stock level of ${current.minStockLevel}`, type: "warning", priority: "high", relatedEntityType: "inventory", relatedEntityId: id });
    }
    return row;
  }

  // ─── Rental Contracts ────────────────────────────────────────────────────

  async getRentalContracts(): Promise<RentalContract[]> { return db.select().from(rentalContracts).orderBy(desc(rentalContracts.createdAt)); }

  async getRentalContract(id: string): Promise<RentalContract | undefined> {
    const [row] = await db.select().from(rentalContracts).where(eq(rentalContracts.id, id)).limit(1);
    return row;
  }

  async getActiveRentalContracts(): Promise<RentalContract[]> {
    return db.select().from(rentalContracts).where(eq(rentalContracts.isActive, true));
  }

  async getExpiringContracts(days: number): Promise<RentalContract[]> {
    const future = new Date(); future.setDate(future.getDate() + days);
    return db.select().from(rentalContracts).where(
      and(eq(rentalContracts.isActive, true), lte(rentalContracts.endDate, future))
    );
  }

  async createRentalContract(data: InsertRentalContract): Promise<RentalContract> {
    const contractNumber = (data as any).contractNumber || await this.generateContractNumber();
    const { contractNumber: _cn, ...restData } = data as any;
    const [row] = await db.insert(rentalContracts).values({ id: randomUUID(), ...restData, contractNumber, createdAt: new Date() }).returning();
    return row;
  }

  async updateRentalContract(id: string, data: Partial<InsertRentalContract>): Promise<RentalContract> {
    const [row] = await db.update(rentalContracts).set(data).where(eq(rentalContracts.id, id)).returning();
    if (!row) throw new Error("Rental contract not found");
    return row;
  }

  async deleteRentalContract(id: string): Promise<boolean> {
    const r = await db.delete(rentalContracts).where(eq(rentalContracts.id, id));
    return (r.rowCount ?? 0) > 0;
  }

  // ─── Rental Contract Items ────────────────────────────────────────────────

  async getRentalContractItems(rentalContractId: string) {
    return db.select().from(rentalContractItems).where(eq(rentalContractItems.rentalContractId, rentalContractId));
  }

  async createRentalContractItem(item: import("@shared/schema").InsertRentalContractItem) {
    const [row] = await db.insert(rentalContractItems).values({ id: randomUUID(), ...item, createdAt: new Date() }).returning();
    return row;
  }

  async updateRentalContractItem(id: string, item: Partial<import("@shared/schema").InsertRentalContractItem>) {
    const [row] = await db.update(rentalContractItems).set(item).where(eq(rentalContractItems.id, id)).returning();
    if (!row) throw new Error("Rental contract item not found");
    return row;
  }

  async deleteRentalContractItem(id: string) {
    const r = await db.delete(rentalContractItems).where(eq(rentalContractItems.id, id));
    return (r.rowCount ?? 0) > 0;
  }

  async deleteRentalContractItemsByContract(rentalContractId: string) {
    await db.delete(rentalContractItems).where(eq(rentalContractItems.rentalContractId, rentalContractId));
    return true;
  }

  // ─── Jobs ────────────────────────────────────────────────────────────────

  async getJobs(): Promise<Job[]> { return db.select().from(jobs).orderBy(desc(jobs.scheduledDate)); }

  async getJob(id: string): Promise<Job | undefined> {
    const [row] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
    return row;
  }

  async getJobsByWorker(workerId: string): Promise<Job[]> {
    return db.select().from(jobs).where(eq(jobs.workerId, workerId)).orderBy(desc(jobs.scheduledDate));
  }

  async getJobsForWorker(workerId: string): Promise<(Job & { client: Client })[]> {
    const rows = await db.select({ job: jobs, client: clients })
      .from(jobs)
      .leftJoin(clients, eq(jobs.clientId, clients.id))
      .where(eq(jobs.workerId, workerId))
      .orderBy(desc(jobs.scheduledDate));
    return rows.map(r => ({ ...r.job, client: r.client! }));
  }

  async getMobileJobsForWorker(workerId: string): Promise<(Job & { client: Client })[]> {
    const technicianTeams = await this.getTeamsForWorker(workerId);
    const memberIds = new Set<string>([workerId]);
    for (const team of technicianTeams) {
      for (const member of await this.getTeamMembers(team.id)) memberIds.add(member.workerId);
    }
    const rows = await db.select({ job: jobs, client: clients })
      .from(jobs)
      .leftJoin(clients, eq(jobs.clientId, clients.id))
      .where(inArray(jobs.workerId, Array.from(memberIds)))
      .orderBy(desc(jobs.scheduledDate));
    return rows.filter(row => row.client).map(row => ({ ...row.job, client: row.client! }));
  }

  async getJobsByDepartment(departmentId: string): Promise<Job[]> {
    return db.select().from(jobs).where(eq(jobs.departmentId, departmentId)).orderBy(desc(jobs.scheduledDate));
  }

  async getJobsByStatus(status: string): Promise<Job[]> {
    return db.select().from(jobs).where(eq(jobs.status, status)).orderBy(desc(jobs.scheduledDate));
  }

  async getJobsByDateRange(startDate: Date, endDate: Date): Promise<Job[]> {
    return db.select().from(jobs).where(and(gte(jobs.scheduledDate, startDate), lte(jobs.scheduledDate, endDate))).orderBy(asc(jobs.scheduledDate));
  }

  async getJobsByDepartmentAndDateRange(departmentId: string, startDate: Date, endDate: Date): Promise<(Job & { client: Client; worker: Worker; inventoryItems: (JobInventoryItem & { inventoryItem: InventoryItem })[] })[]> {
    const rows = await db.select({ job: jobs, client: clients, worker: workers })
      .from(jobs)
      .leftJoin(clients, eq(jobs.clientId, clients.id))
      .leftJoin(workers, eq(jobs.workerId, workers.id))
      .where(and(eq(jobs.departmentId, departmentId), gte(jobs.scheduledDate, startDate), lte(jobs.scheduledDate, endDate)))
      .orderBy(asc(jobs.scheduledDate));
    const jobIds = rows.map(r => r.job.id);
    let invRows: { jobItem: JobInventoryItem; invItem: InventoryItem | null }[] = [];
    if (jobIds.length > 0) {
      invRows = await db.select({ jobItem: jobInventoryItems, invItem: inventoryItems })
        .from(jobInventoryItems)
        .leftJoin(inventoryItems, eq(jobInventoryItems.inventoryItemId, inventoryItems.id))
        .where(inArray(jobInventoryItems.jobId, jobIds));
    }
    return rows.map(r => ({
      ...r.job,
      client: r.client ?? ({ id: r.job.clientId, name: "Unknown", status: "active" } as Client),
      worker: r.worker ?? ({ id: r.job.workerId, name: "Unknown", isActive: true } as Worker),
      inventoryItems: invRows.filter(ir => ir.jobItem.jobId === r.job.id).map(ir => ({ ...ir.jobItem, inventoryItem: ir.invItem! })),
    }));
  }

  async getTodaysJobs(): Promise<Job[]> {
    const start = new Date(); start.setHours(0,0,0,0);
    const end = new Date(); end.setHours(23,59,59,999);
    return db.select().from(jobs).where(and(gte(jobs.scheduledDate, start), lte(jobs.scheduledDate, end)));
  }

  async updateJobStatus(jobId: string, status: string): Promise<Job> {
    const [row] = await db.update(jobs).set({ status, updatedAt: new Date() }).where(eq(jobs.id, jobId)).returning();
    if (!row) throw new Error("Job not found");
    return row;
  }

  async getJobCardData(jobId: string): Promise<(Job & { client: Client; worker: Worker; department: Department; inventoryItems: (JobInventoryItem & { inventoryItem: InventoryItem })[] }) | undefined> {
    const [r] = await db.select({ job: jobs, client: clients, worker: workers, department: departments })
      .from(jobs)
      .leftJoin(clients, eq(jobs.clientId, clients.id))
      .leftJoin(workers, eq(jobs.workerId, workers.id))
      .leftJoin(departments, eq(jobs.departmentId, departments.id))
      .where(eq(jobs.id, jobId)).limit(1);
    if (!r) return undefined;
    const invRows = await db.select({ jobItem: jobInventoryItems, invItem: inventoryItems })
      .from(jobInventoryItems)
      .leftJoin(inventoryItems, eq(jobInventoryItems.inventoryItemId, inventoryItems.id))
      .where(eq(jobInventoryItems.jobId, jobId));
    return {
      ...r.job,
      client: r.client ?? ({ id: r.job.clientId, name: "Unknown" } as Client),
      worker: r.worker ?? ({ id: r.job.workerId, name: "Unknown" } as Worker),
      department: r.department ?? ({ id: r.job.departmentId, name: "Unknown" } as Department),
      inventoryItems: invRows.map(ir => ({ ...ir.jobItem, inventoryItem: ir.invItem! })),
    };
  }

  async createJob(data: InsertJob): Promise<Job> {
    const jobNumber = (data as any).jobNumber || await this.generateJobNumber();
    const { jobNumber: _jn, ...restData } = data as any;
    const [row] = await db.insert(jobs).values({ id: randomUUID(), ...restData, jobNumber, createdAt: new Date(), updatedAt: new Date() }).returning();
    return row;
  }

  async updateJob(id: string, data: Partial<InsertJob>): Promise<Job> {
    const [row] = await db.update(jobs).set({ ...data, updatedAt: new Date() }).where(eq(jobs.id, id)).returning();
    if (!row) throw new Error("Job not found");
    return row;
  }

  async deleteJob(id: string): Promise<boolean> {
    const r = await db.delete(jobs).where(eq(jobs.id, id));
    return (r.rowCount ?? 0) > 0;
  }

  // ─── Invoices ────────────────────────────────────────────────────────────

  async getInvoices(): Promise<Invoice[]> { return db.select().from(invoices).orderBy(desc(invoices.createdAt)); }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    const [row] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
    return row;
  }

  async getInvoicesByClient(clientId: string): Promise<Invoice[]> {
    return db.select().from(invoices).where(eq(invoices.clientId, clientId)).orderBy(desc(invoices.issueDate));
  }

  async getInvoicesByStatus(status: string): Promise<Invoice[]> {
    return db.select().from(invoices).where(eq(invoices.status, status)).orderBy(desc(invoices.issueDate));
  }

  async getOverdueInvoices(): Promise<Invoice[]> {
    return db.select().from(invoices).where(eq(invoices.status, "overdue")).orderBy(asc(invoices.dueDate));
  }

  async createInvoice(data: InsertInvoice): Promise<Invoice> {
    const invoiceNumber = await this.generateInvoiceNumber();
    const [row] = await db.insert(invoices).values({ id: randomUUID(), invoiceNumber, ...data, createdAt: new Date(), updatedAt: new Date() }).returning();
    return row;
  }

  async updateInvoice(id: string, data: Partial<InsertInvoice>): Promise<Invoice> {
    const [row] = await db.update(invoices).set({ ...data, updatedAt: new Date() }).where(eq(invoices.id, id)).returning();
    if (!row) throw new Error("Invoice not found");
    return row;
  }

  async deleteInvoice(id: string): Promise<boolean> {
    const r = await db.delete(invoices).where(eq(invoices.id, id));
    return (r.rowCount ?? 0) > 0;
  }

  // ─── Number Generators ────────────────────────────────────────────────────

  /**
   * Atomically claim the next sequence number for a given document type and year.
   * Uses PostgreSQL UPSERT so two concurrent requests always get distinct values.
   */
  private async generateDocNumber(type: string, prefix: string): Promise<string> {
    const year = new Date().getFullYear();
    const [row] = await db
      .insert(sequences)
      .values({ type, year, lastSeq: 1 })
      .onConflictDoUpdate({
        target: [sequences.type, sequences.year],
        set: { lastSeq: sql`${sequences.lastSeq} + 1` },
      })
      .returning({ lastSeq: sequences.lastSeq });
    return `${prefix}-${year}-${String(row.lastSeq).padStart(4, "0")}`;
  }

  async generateInvoiceNumber(): Promise<string> { return this.generateDocNumber("INV", "INV"); }
  async generateJobNumber():     Promise<string> { return this.generateDocNumber("JOB", "JOB"); }
  async generateContractNumber(): Promise<string> { return this.generateDocNumber("RC",  "RC");  }
  async generateQuoteNumber():   Promise<string> { return this.generateDocNumber("QT",  "QT");  }
  async generateServiceContractNumber(): Promise<string> { return this.generateDocNumber("CON", "CON"); }
  async generatePaymentNumber(): Promise<string> { return this.generateDocNumber("PAY", "PAY"); }

  // ─── Invoice Items ────────────────────────────────────────────────────────

  async getInvoiceItems(invoiceId: string): Promise<InvoiceItem[]> {
    return db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));
  }

  async createInvoiceItem(data: InsertInvoiceItem): Promise<InvoiceItem> {
    const [row] = await db.insert(invoiceItems).values({ id: randomUUID(), ...data }).returning();
    return row;
  }

  async updateInvoiceItem(id: string, data: Partial<InsertInvoiceItem>): Promise<InvoiceItem> {
    const [row] = await db.update(invoiceItems).set(data).where(eq(invoiceItems.id, id)).returning();
    if (!row) throw new Error("Invoice item not found");
    return row;
  }

  async deleteInvoiceItem(id: string): Promise<boolean> {
    const r = await db.delete(invoiceItems).where(eq(invoiceItems.id, id));
    return (r.rowCount ?? 0) > 0;
  }

  // ─── Notifications ───────────────────────────────────────────────────────

  async getNotifications(): Promise<Notification[]> { return db.select().from(notifications).orderBy(desc(notifications.createdAt)); }

  async getNotification(id: string): Promise<Notification | undefined> {
    const [row] = await db.select().from(notifications).where(eq(notifications.id, id)).limit(1);
    return row;
  }

  async getUnreadNotifications(): Promise<Notification[]> {
    return db.select().from(notifications).where(eq(notifications.isRead, false)).orderBy(desc(notifications.createdAt));
  }

  async createNotification(data: InsertNotification): Promise<Notification> {
    const [row] = await db.insert(notifications).values({ id: randomUUID(), ...data, isRead: false, createdAt: new Date() }).returning();
    return row;
  }

  async markNotificationAsRead(id: string): Promise<boolean> {
    const r = await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
    return (r.rowCount ?? 0) > 0;
  }

  async deleteNotification(id: string): Promise<boolean> {
    const r = await db.delete(notifications).where(eq(notifications.id, id));
    return (r.rowCount ?? 0) > 0;
  }

  // ─── Email Templates ─────────────────────────────────────────────────────

  async getEmailTemplates(): Promise<EmailTemplate[]> { return db.select().from(emailTemplates); }

  async getEmailTemplate(id: string): Promise<EmailTemplate | undefined> {
    const [row] = await db.select().from(emailTemplates).where(eq(emailTemplates.id, id)).limit(1);
    return row;
  }

  async getEmailTemplatesByType(type: string): Promise<EmailTemplate[]> {
    return db.select().from(emailTemplates).where(eq(emailTemplates.type, type));
  }

  async createEmailTemplate(data: InsertEmailTemplate): Promise<EmailTemplate> {
    const [row] = await db.insert(emailTemplates).values({ id: randomUUID(), ...data, createdAt: new Date(), updatedAt: new Date() }).returning();
    return row;
  }

  async updateEmailTemplate(id: string, data: Partial<InsertEmailTemplate>): Promise<EmailTemplate> {
    const [row] = await db.update(emailTemplates).set({ ...data, updatedAt: new Date() }).where(eq(emailTemplates.id, id)).returning();
    if (!row) throw new Error("Email template not found");
    return row;
  }

  async deleteEmailTemplate(id: string): Promise<boolean> {
    const r = await db.delete(emailTemplates).where(eq(emailTemplates.id, id));
    return (r.rowCount ?? 0) > 0;
  }

  // ─── Email Logs ───────────────────────────────────────────────────────────

  async getEmailLogs(): Promise<EmailLog[]> { return db.select().from(emailLogs).orderBy(desc(emailLogs.sentAt)); }

  async getEmailLog(id: string): Promise<EmailLog | undefined> {
    const [row] = await db.select().from(emailLogs).where(eq(emailLogs.id, id)).limit(1);
    return row;
  }

  async getEmailLogsByStatus(status: string): Promise<EmailLog[]> {
    return db.select().from(emailLogs).where(eq(emailLogs.status, status));
  }

  async createEmailLog(data: InsertEmailLog): Promise<EmailLog> {
    const [row] = await db.insert(emailLogs).values({ id: randomUUID(), ...data }).returning();
    return row;
  }

  async updateEmailLog(id: string, data: Partial<InsertEmailLog>): Promise<EmailLog> {
    const [row] = await db.update(emailLogs).set(data).where(eq(emailLogs.id, id)).returning();
    if (!row) throw new Error("Email log not found");
    return row;
  }

  // ─── Job Inventory Items ─────────────────────────────────────────────────

  async getJobInventoryItems(): Promise<JobInventoryItem[]> { return db.select().from(jobInventoryItems); }

  async getJobInventoryItem(id: string): Promise<JobInventoryItem | undefined> {
    const [row] = await db.select().from(jobInventoryItems).where(eq(jobInventoryItems.id, id)).limit(1);
    return row;
  }

  async getJobInventoryItemsByJob(jobId: string): Promise<JobInventoryItem[]> {
    return db.select().from(jobInventoryItems).where(eq(jobInventoryItems.jobId, jobId));
  }

  async createJobInventoryItem(data: InsertJobInventoryItem): Promise<JobInventoryItem> {
    const [row] = await db.insert(jobInventoryItems).values({ id: randomUUID(), ...data }).returning();
    return row;
  }

  async updateJobInventoryItem(id: string, data: Partial<InsertJobInventoryItem>): Promise<JobInventoryItem> {
    const [row] = await db.update(jobInventoryItems).set(data).where(eq(jobInventoryItems.id, id)).returning();
    if (!row) throw new Error("Job inventory item not found");
    return row;
  }

  async deleteJobInventoryItem(id: string): Promise<boolean> {
    const r = await db.delete(jobInventoryItems).where(eq(jobInventoryItems.id, id));
    return (r.rowCount ?? 0) > 0;
  }

  // ─── Suppliers ───────────────────────────────────────────────────────────

  async getSuppliers(): Promise<Supplier[]> { return db.select().from(suppliers).orderBy(asc(suppliers.name)); }

  async getSupplier(id: string): Promise<Supplier | undefined> {
    const [row] = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
    return row;
  }

  async getSuppliersByCategory(category: string): Promise<Supplier[]> {
    return db.select().from(suppliers).where(eq(suppliers.category, category));
  }

  async getActiveSuppliers(): Promise<Supplier[]> {
    return db.select().from(suppliers).where(eq(suppliers.isActive, true)).orderBy(asc(suppliers.name));
  }

  async createSupplier(data: InsertSupplier): Promise<Supplier> {
    const [row] = await db.insert(suppliers).values({ id: randomUUID(), ...data, createdAt: new Date() }).returning();
    return row;
  }

  async updateSupplier(id: string, data: Partial<InsertSupplier>): Promise<Supplier> {
    const [row] = await db.update(suppliers).set(data).where(eq(suppliers.id, id)).returning();
    if (!row) throw new Error("Supplier not found");
    return row;
  }

  async deleteSupplier(id: string): Promise<boolean> {
    const r = await db.delete(suppliers).where(eq(suppliers.id, id));
    return (r.rowCount ?? 0) > 0;
  }

  // ─── Purchase Orders ─────────────────────────────────────────────────────

  async getPurchaseOrders(): Promise<PurchaseOrder[]> { return db.select().from(purchaseOrders).orderBy(desc(purchaseOrders.requestDate)); }

  async getPurchaseOrder(id: string): Promise<PurchaseOrder | undefined> {
    const [row] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id)).limit(1);
    return row;
  }

  async getPurchaseOrdersByStatus(status: string): Promise<PurchaseOrder[]> {
    return db.select().from(purchaseOrders).where(eq(purchaseOrders.status, status)).orderBy(desc(purchaseOrders.requestDate));
  }

  async getPendingPurchaseOrders(): Promise<PurchaseOrder[]> {
    return db.select().from(purchaseOrders).where(eq(purchaseOrders.status, "pending")).orderBy(asc(purchaseOrders.requestDate));
  }

  async createPurchaseOrder(data: InsertPurchaseOrder): Promise<PurchaseOrder> {
    const [row] = await db.insert(purchaseOrders).values({ id: randomUUID(), ...data, createdAt: new Date(), updatedAt: new Date() }).returning();
    return row;
  }

  async updatePurchaseOrder(id: string, data: Partial<InsertPurchaseOrder>): Promise<PurchaseOrder> {
    const [row] = await db.update(purchaseOrders).set({ ...data, updatedAt: new Date() }).where(eq(purchaseOrders.id, id)).returning();
    if (!row) throw new Error("Purchase order not found");
    return row;
  }

  async approvePurchaseOrder(id: string, approvedById: string): Promise<PurchaseOrder> {
    const [row] = await db.update(purchaseOrders).set({ status: "approved", approvedById, approvalDate: new Date(), updatedAt: new Date() }).where(eq(purchaseOrders.id, id)).returning();
    if (!row) throw new Error("Purchase order not found");
    return row;
  }

  async rejectPurchaseOrder(id: string, rejectionReason: string): Promise<PurchaseOrder> {
    const [row] = await db.update(purchaseOrders).set({ status: "rejected", rejectionReason, updatedAt: new Date() }).where(eq(purchaseOrders.id, id)).returning();
    if (!row) throw new Error("Purchase order not found");
    return row;
  }

  async deletePurchaseOrder(id: string): Promise<boolean> {
    await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, id));
    const r = await db.delete(purchaseOrders).where(eq(purchaseOrders.id, id));
    return (r.rowCount ?? 0) > 0;
  }

  // ─── Purchase Order Items ────────────────────────────────────────────────

  async getPurchaseOrderItems(purchaseOrderId: string): Promise<PurchaseOrderItem[]> {
    return db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId));
  }

  async createPurchaseOrderItem(data: InsertPurchaseOrderItem): Promise<PurchaseOrderItem> {
    const [row] = await db.insert(purchaseOrderItems).values({ id: randomUUID(), ...data, createdAt: new Date() }).returning();
    return row;
  }

  async updatePurchaseOrderItem(id: string, data: Partial<InsertPurchaseOrderItem>): Promise<PurchaseOrderItem> {
    const [row] = await db.update(purchaseOrderItems).set(data).where(eq(purchaseOrderItems.id, id)).returning();
    if (!row) throw new Error("Purchase order item not found");
    return row;
  }

  async deletePurchaseOrderItem(id: string): Promise<boolean> {
    const r = await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.id, id));
    return (r.rowCount ?? 0) > 0;
  }

  // ─── Activity Logs ───────────────────────────────────────────────────────

  async getActivityLogs(): Promise<any[]> {
    return db.select().from(activityLogs).orderBy(desc(activityLogs.timestamp)).limit(500);
  }

  async getActivityLogsByClient(clientId: string): Promise<any[]> {
    return db.select().from(activityLogs)
      .where(eq(activityLogs.clientId, clientId))
      .orderBy(desc(activityLogs.timestamp))
      .limit(200);
  }

  // ─── Calendar Events ─────────────────────────────────────────────────────

  async getCalendarEvents(): Promise<CalendarEvent[]> { return db.select().from(calendarEvents).orderBy(asc(calendarEvents.startTime)); }

  async getCalendarEvent(id: string): Promise<CalendarEvent | undefined> {
    const [row] = await db.select().from(calendarEvents).where(eq(calendarEvents.id, id)).limit(1);
    return row;
  }

  async createCalendarEvent(data: InsertCalendarEvent): Promise<CalendarEvent> {
    const [row] = await db.insert(calendarEvents).values({ id: randomUUID(), ...data, createdAt: new Date(), updatedAt: new Date() }).returning();
    return row;
  }

  async updateCalendarEvent(id: string, data: Partial<InsertCalendarEvent>): Promise<CalendarEvent> {
    const [row] = await db.update(calendarEvents).set({ ...data, updatedAt: new Date() }).where(eq(calendarEvents.id, id)).returning();
    if (!row) throw new Error(`Calendar event ${id} not found`);
    return row;
  }

  async deleteCalendarEvent(id: string): Promise<boolean> {
    const r = await db.delete(calendarEvents).where(eq(calendarEvents.id, id));
    return (r.rowCount ?? 0) > 0;
  }

  // ─── Custom Reports ──────────────────────────────────────────────────────

  async getCustomReports(): Promise<CustomReport[]> { return db.select().from(customReports); }

  async getCustomReport(id: string): Promise<CustomReport | undefined> {
    const [row] = await db.select().from(customReports).where(eq(customReports.id, id)).limit(1);
    return row;
  }

  async getCustomReportsByType(type: string): Promise<CustomReport[]> {
    return db.select().from(customReports).where(eq(customReports.reportType, type));
  }

  async createCustomReport(data: InsertCustomReport): Promise<CustomReport> {
    const [row] = await db.insert(customReports).values({ id: randomUUID(), ...data, lastRun: null, runCount: 0, createdAt: new Date(), updatedAt: new Date() }).returning();
    return row;
  }

  async updateCustomReport(id: string, data: Partial<InsertCustomReport>): Promise<CustomReport> {
    const [row] = await db.update(customReports).set({ ...data, updatedAt: new Date() }).where(eq(customReports.id, id)).returning();
    if (!row) throw new Error("Custom report not found");
    return row;
  }

  async deleteCustomReport(id: string): Promise<boolean> {
    const r = await db.delete(customReports).where(eq(customReports.id, id));
    return (r.rowCount ?? 0) > 0;
  }

  async runCustomReport(id: string): Promise<any> {
    const [report] = await db.select().from(customReports).where(eq(customReports.id, id)).limit(1);
    if (!report) throw new Error("Custom report not found");
    await db.update(customReports).set({ lastRun: new Date(), runCount: (report.runCount ?? 0) + 1, updatedAt: new Date() }).where(eq(customReports.id, id));
    return { reportId: id, generatedAt: new Date().toISOString(), data: [] };
  }

  // ─── Sales Appointments ──────────────────────────────────────────────────

  async getSalesAppointments(): Promise<SalesAppointment[]> {
    return db.select().from(salesAppointments).orderBy(asc(salesAppointments.date), asc(salesAppointments.startTime));
  }

  async getSalesAppointment(id: string): Promise<SalesAppointment | undefined> {
    const [row] = await db.select().from(salesAppointments).where(eq(salesAppointments.id, id)).limit(1);
    return row;
  }

  async getSalesAppointmentsByDate(date: string): Promise<SalesAppointment[]> {
    return db.select().from(salesAppointments).where(eq(salesAppointments.date, date)).orderBy(asc(salesAppointments.startTime));
  }

  async getSalesAppointmentsByRep(workerId: string): Promise<SalesAppointment[]> {
    return db.select().from(salesAppointments).where(eq(salesAppointments.assignedToId, workerId));
  }

  async getSalesAppointmentsByLead(leadId: string): Promise<SalesAppointment[]> {
    return db.select().from(salesAppointments).where(eq(salesAppointments.leadId, leadId));
  }

  async createSalesAppointment(data: InsertSalesAppointment): Promise<SalesAppointment> {
    const [row] = await db.insert(salesAppointments).values({ id: randomUUID(), ...data, createdAt: new Date() }).returning();
    return row;
  }

  async updateSalesAppointment(id: string, data: Partial<InsertSalesAppointment>): Promise<SalesAppointment> {
    const [row] = await db.update(salesAppointments).set(data).where(eq(salesAppointments.id, id)).returning();
    if (!row) throw new Error(`Sales appointment ${id} not found`);
    return row;
  }

  async deleteSalesAppointment(id: string): Promise<boolean> {
    const r = await db.delete(salesAppointments).where(eq(salesAppointments.id, id));
    return (r.rowCount ?? 0) > 0;
  }

  // ─── Quote Submissions ───────────────────────────────────────────────────

  async getQuoteSubmissions(): Promise<QuoteSubmission[]> { return db.select().from(quoteSubmissions).orderBy(desc(quoteSubmissions.submittedAt)); }

  async getQuoteSubmission(id: string): Promise<QuoteSubmission | undefined> {
    const [row] = await db.select().from(quoteSubmissions).where(eq(quoteSubmissions.id, id)).limit(1);
    return row;
  }

  async getQuoteSubmissionsByStatus(status: string): Promise<QuoteSubmission[]> {
    return db.select().from(quoteSubmissions).where(eq(quoteSubmissions.status, status)).orderBy(desc(quoteSubmissions.submittedAt));
  }

  async createQuoteSubmission(data: InsertQuoteSubmission): Promise<QuoteSubmission> {
    const quoteNumber = await this.generateQuoteNumber();
    const [row] = await db.insert(quoteSubmissions).values({ id: randomUUID(), quoteNumber, ...data }).returning();
    return row;
  }

  async updateQuoteSubmission(id: string, data: Partial<InsertQuoteSubmission>): Promise<QuoteSubmission> {
    const [row] = await db.update(quoteSubmissions).set(data).where(eq(quoteSubmissions.id, id)).returning();
    if (!row) throw new Error("Quote not found");
    return row;
  }

  async deleteQuoteSubmission(id: string): Promise<boolean> {
    const r = await db.delete(quoteSubmissions).where(eq(quoteSubmissions.id, id));
    return (r.rowCount ?? 0) > 0;
  }

  // ─── Lead Activities ─────────────────────────────────────────────────────

  async getLeadActivities(leadId: string): Promise<LeadActivity[]> {
    return db.select().from(leadActivities).where(eq(leadActivities.leadId, leadId)).orderBy(desc(leadActivities.createdAt));
  }

  async createLeadActivity(data: InsertLeadActivity): Promise<LeadActivity> {
    const [row] = await db.insert(leadActivities).values({ id: randomUUID(), ...data, createdAt: new Date() }).returning();
    return row;
  }

  // ─── Pricing Library ─────────────────────────────────────────────────────

  async getPricingLibrary(): Promise<PricingLibraryItem[]> { return db.select().from(pricingLibrary).orderBy(asc(pricingLibrary.name)); }

  async getPricingLibraryItem(id: string): Promise<PricingLibraryItem | undefined> {
    const [row] = await db.select().from(pricingLibrary).where(eq(pricingLibrary.id, id)).limit(1);
    return row;
  }

  async createPricingLibraryItem(data: InsertPricingLibraryItem): Promise<PricingLibraryItem> {
    const [row] = await db.insert(pricingLibrary).values({ id: randomUUID(), ...data, createdAt: new Date() }).returning();
    return row;
  }

  async updatePricingLibraryItem(id: string, data: Partial<InsertPricingLibraryItem>): Promise<PricingLibraryItem | undefined> {
    const [row] = await db.update(pricingLibrary).set(data).where(eq(pricingLibrary.id, id)).returning();
    return row;
  }

  async deletePricingLibraryItem(id: string): Promise<boolean> {
    const r = await db.delete(pricingLibrary).where(eq(pricingLibrary.id, id));
    return (r.rowCount ?? 0) > 0;
  }

  // ─── Sales Follow-ups ────────────────────────────────────────────────────

  async getSalesFollowUps(): Promise<SalesFollowUp[]> { return db.select().from(salesFollowUps).orderBy(desc(salesFollowUps.createdAt)); }

  async getSalesFollowUpsByLead(leadId: string): Promise<SalesFollowUp[]> {
    return db.select().from(salesFollowUps).where(eq(salesFollowUps.leadId, leadId));
  }

  async createSalesFollowUp(data: InsertSalesFollowUp): Promise<SalesFollowUp> {
    const [row] = await db.insert(salesFollowUps).values({ id: randomUUID(), ...data, createdAt: new Date() }).returning();
    return row;
  }

  async updateSalesFollowUp(id: string, data: Partial<InsertSalesFollowUp>): Promise<SalesFollowUp | undefined> {
    const [row] = await db.update(salesFollowUps).set(data).where(eq(salesFollowUps.id, id)).returning();
    return row;
  }

  async deleteSalesFollowUp(id: string): Promise<boolean> {
    const r = await db.delete(salesFollowUps).where(eq(salesFollowUps.id, id));
    return (r.rowCount ?? 0) > 0;
  }

  // ─── Fleet — Vehicles ────────────────────────────────────────────────────

  async getVehicles(): Promise<Vehicle[]> { return db.select().from(vehicles).orderBy(asc(vehicles.name)); }

  async getVehicle(id: string): Promise<Vehicle | undefined> {
    const [row] = await db.select().from(vehicles).where(eq(vehicles.id, id)).limit(1);
    return row;
  }

  async getActiveVehicles(): Promise<Vehicle[]> {
    return db.select().from(vehicles).where(eq(vehicles.isActive, true)).orderBy(asc(vehicles.name));
  }

  async createVehicle(data: InsertVehicle): Promise<Vehicle> {
    const [row] = await db.insert(vehicles).values({ id: randomUUID(), ...data, createdAt: new Date() }).returning();
    return row;
  }

  async updateVehicle(id: string, data: Partial<InsertVehicle>): Promise<Vehicle> {
    const [row] = await db.update(vehicles).set(data).where(eq(vehicles.id, id)).returning();
    if (!row) throw new Error("Vehicle not found");
    return row;
  }

  async deleteVehicle(id: string): Promise<boolean> {
    const r = await db.delete(vehicles).where(eq(vehicles.id, id));
    return (r.rowCount ?? 0) > 0;
  }

  // ─── Fleet — Assignments ─────────────────────────────────────────────────

  async getVehicleAssignments(): Promise<VehicleAssignment[]> { return db.select().from(vehicleAssignments); }

  async getActiveAssignmentForWorker(workerId: string): Promise<VehicleAssignment | undefined> {
    const [row] = await db.select().from(vehicleAssignments)
      .where(and(eq(vehicleAssignments.workerId, workerId), eq(vehicleAssignments.isActive, true))).limit(1);
    return row;
  }

  async getAssignmentsForVehicle(vehicleId: string): Promise<VehicleAssignment[]> {
    return db.select().from(vehicleAssignments).where(eq(vehicleAssignments.vehicleId, vehicleId));
  }

  async createVehicleAssignment(data: InsertVehicleAssignment): Promise<VehicleAssignment> {
    const [row] = await db.insert(vehicleAssignments).values({ id: randomUUID(), ...data, assignedAt: new Date() }).returning();
    return row;
  }

  async updateVehicleAssignment(id: string, data: Partial<InsertVehicleAssignment>): Promise<VehicleAssignment> {
    const [row] = await db.update(vehicleAssignments).set(data).where(eq(vehicleAssignments.id, id)).returning();
    if (!row) throw new Error("Vehicle assignment not found");
    return row;
  }

  // ─── Fleet — KM Logs ─────────────────────────────────────────────────────

  async getKmLogs(): Promise<KmLog[]> { return db.select().from(kmLogs).orderBy(desc(kmLogs.logDate)); }

  async getKmLogsByWorker(workerId: string): Promise<KmLog[]> {
    return db.select().from(kmLogs).where(eq(kmLogs.workerId, workerId)).orderBy(desc(kmLogs.logDate));
  }

  async getKmLogsByVehicle(vehicleId: string): Promise<KmLog[]> {
    return db.select().from(kmLogs).where(eq(kmLogs.vehicleId, vehicleId)).orderBy(desc(kmLogs.logDate));
  }

  async getKmLogsByDateRange(start: Date, end: Date): Promise<KmLog[]> {
    return db.select().from(kmLogs).where(and(gte(kmLogs.logDate, start), lte(kmLogs.logDate, end))).orderBy(asc(kmLogs.logDate));
  }

  async createKmLog(data: InsertKmLog): Promise<KmLog> {
    const [row] = await db.insert(kmLogs).values({ id: randomUUID(), ...data, createdAt: new Date() }).returning();
    return row;
  }

  async deleteKmLog(id: string): Promise<boolean> {
    const r = await db.delete(kmLogs).where(eq(kmLogs.id, id));
    return (r.rowCount ?? 0) > 0;
  }

  // ─── Fleet — Fuel Fill-ups ───────────────────────────────────────────────

  async getFuelFillups(): Promise<FuelFillup[]> { return db.select().from(fuelFillups).orderBy(desc(fuelFillups.fillDate)); }

  async getFuelFillupsByWorker(workerId: string): Promise<FuelFillup[]> {
    return db.select().from(fuelFillups).where(eq(fuelFillups.workerId, workerId)).orderBy(desc(fuelFillups.fillDate));
  }

  async getFuelFillupsByVehicle(vehicleId: string): Promise<FuelFillup[]> {
    return db.select().from(fuelFillups).where(eq(fuelFillups.vehicleId, vehicleId)).orderBy(desc(fuelFillups.fillDate));
  }

  async getFuelFillupsByDateRange(start: Date, end: Date): Promise<FuelFillup[]> {
    return db.select().from(fuelFillups).where(and(gte(fuelFillups.fillDate, start), lte(fuelFillups.fillDate, end)));
  }

  async createFuelFillup(data: InsertFuelFillup): Promise<FuelFillup> {
    const [row] = await db.insert(fuelFillups).values({ id: randomUUID(), ...data, createdAt: new Date() }).returning();
    return row;
  }

  async deleteFuelFillup(id: string): Promise<boolean> {
    const r = await db.delete(fuelFillups).where(eq(fuelFillups.id, id));
    return (r.rowCount ?? 0) > 0;
  }

  // ─── Fleet — Inspections ─────────────────────────────────────────────────

  async getVehicleInspections(): Promise<VehicleInspection[]> { return db.select().from(vehicleInspections).orderBy(desc(vehicleInspections.inspectionDate)); }

  async getVehicleInspectionsByWorker(workerId: string): Promise<VehicleInspection[]> {
    return db.select().from(vehicleInspections).where(eq(vehicleInspections.workerId, workerId)).orderBy(desc(vehicleInspections.inspectionDate));
  }

  async getVehicleInspectionsByVehicle(vehicleId: string): Promise<VehicleInspection[]> {
    return db.select().from(vehicleInspections).where(eq(vehicleInspections.vehicleId, vehicleId)).orderBy(desc(vehicleInspections.inspectionDate));
  }

  async getFailedInspections(): Promise<VehicleInspection[]> {
    return db.select().from(vehicleInspections).where(eq(vehicleInspections.overallResult, "fail")).orderBy(desc(vehicleInspections.inspectionDate));
  }

  async createVehicleInspection(data: InsertVehicleInspection): Promise<VehicleInspection> {
    const [row] = await db.insert(vehicleInspections).values({ id: randomUUID(), failAlertSent: false, ...data, createdAt: new Date() }).returning();
    return row;
  }

  async updateVehicleInspection(id: string, data: Partial<InsertVehicleInspection>): Promise<VehicleInspection> {
    const [row] = await db.update(vehicleInspections).set(data).where(eq(vehicleInspections.id, id)).returning();
    if (!row) throw new Error("Vehicle inspection not found");
    return row;
  }

  async deleteVehicleInspection(id: string): Promise<boolean> {
    const r = await db.delete(vehicleInspections).where(eq(vehicleInspections.id, id));
    return (r.rowCount ?? 0) > 0;
  }

  async getFleetDashboardData(workerId?: string): Promise<any> {
    const allVehicles = await db.select().from(vehicles);
    const allAssignments = await db.select().from(vehicleAssignments);
    const allKmLogs = await db.select().from(kmLogs);
    const allFuelFillups = await db.select().from(fuelFillups);
    const allInspections = await db.select().from(vehicleInspections);
    const myAssignment = workerId ? allAssignments.find(a => a.workerId === workerId && a.isActive) : null;
    const myVehicleId = myAssignment?.vehicleId;
    const myVehicle = myVehicleId ? allVehicles.find(v => v.id === myVehicleId) : null;
    const myKmLogs = myVehicleId ? allKmLogs.filter(l => l.vehicleId === myVehicleId) : [];
    const myFuelLogs = myVehicleId ? allFuelFillups.filter(f => f.vehicleId === myVehicleId) : [];
    const totalKm = myKmLogs.reduce((s, l) => s + (l.totalKm ?? 0), 0);
    const totalFuelCost = myFuelLogs.reduce((s, f) => s + parseFloat(f.cost ?? "0"), 0);
    const failedCount = allInspections.filter(i => i.overallResult === "fail").length;
    return { activeVehicles: allVehicles.filter(v => v.isActive).length, totalVehicles: allVehicles.length, myVehicle, totalKm, totalFuelCost, failedInspections: failedCount };
  }

  // ─── Fleet Maintenance — Issues ──────────────────────────────────────────

  async getVehicleIssues(): Promise<VehicleIssue[]> { return db.select().from(vehicleIssues).orderBy(desc(vehicleIssues.reportedAt)); }

  async getVehicleIssue(id: string): Promise<VehicleIssue | undefined> {
    const [row] = await db.select().from(vehicleIssues).where(eq(vehicleIssues.id, id)).limit(1);
    return row;
  }

  async getVehicleIssuesByVehicle(vehicleId: string): Promise<VehicleIssue[]> {
    return db.select().from(vehicleIssues).where(eq(vehicleIssues.vehicleId, vehicleId)).orderBy(desc(vehicleIssues.reportedAt));
  }

  async getVehicleIssuesByWorker(workerId: string): Promise<VehicleIssue[]> {
    return db.select().from(vehicleIssues).where(eq(vehicleIssues.workerId, workerId)).orderBy(desc(vehicleIssues.reportedAt));
  }

  async getOpenVehicleIssues(): Promise<VehicleIssue[]> {
    return db.select().from(vehicleIssues).where(eq(vehicleIssues.status, "open")).orderBy(desc(vehicleIssues.reportedAt));
  }

  async getNotSafeVehicleIssues(): Promise<VehicleIssue[]> {
    return db.select().from(vehicleIssues).where(and(eq(vehicleIssues.urgency, "not_safe"), ne(vehicleIssues.status, "completed"))).orderBy(desc(vehicleIssues.reportedAt));
  }

  async createVehicleIssue(data: InsertVehicleIssue): Promise<VehicleIssue> {
    const [row] = await db.insert(vehicleIssues).values({ id: randomUUID(), ...data, createdAt: new Date() }).returning();
    return row;
  }

  async updateVehicleIssue(id: string, data: Partial<InsertVehicleIssue> & { managerNotes?: string }): Promise<VehicleIssue> {
    const [row] = await db.update(vehicleIssues).set(data).where(eq(vehicleIssues.id, id)).returning();
    if (!row) throw new Error("Vehicle issue not found");
    return row;
  }

  async deleteVehicleIssue(id: string): Promise<boolean> {
    const r = await db.delete(vehicleIssues).where(eq(vehicleIssues.id, id));
    return (r.rowCount ?? 0) > 0;
  }

  // ─── Fleet Maintenance — Service Records ─────────────────────────────────

  async getServiceRecords(): Promise<ServiceRecord[]> { return db.select().from(serviceRecords).orderBy(desc(serviceRecords.serviceDate)); }

  async getServiceRecord(id: string): Promise<ServiceRecord | undefined> {
    const [row] = await db.select().from(serviceRecords).where(eq(serviceRecords.id, id)).limit(1);
    return row;
  }

  async getServiceRecordsByVehicle(vehicleId: string): Promise<ServiceRecord[]> {
    return db.select().from(serviceRecords).where(eq(serviceRecords.vehicleId, vehicleId)).orderBy(desc(serviceRecords.serviceDate));
  }

  async createServiceRecord(data: InsertServiceRecord): Promise<ServiceRecord> {
    const [row] = await db.insert(serviceRecords).values({ id: randomUUID(), ...data, createdAt: new Date() }).returning();
    return row;
  }

  async updateServiceRecord(id: string, data: Partial<InsertServiceRecord>): Promise<ServiceRecord> {
    const [row] = await db.update(serviceRecords).set(data).where(eq(serviceRecords.id, id)).returning();
    if (!row) throw new Error("Service record not found");
    return row;
  }

  async deleteServiceRecord(id: string): Promise<boolean> {
    const r = await db.delete(serviceRecords).where(eq(serviceRecords.id, id));
    return (r.rowCount ?? 0) > 0;
  }

  async getMaintenanceDashboardData(): Promise<any> {
    const allIssues = await db.select().from(vehicleIssues);
    const allRecords = await db.select().from(serviceRecords);
    const allWorkshop = await db.select().from(workshopJobs);
    return {
      openIssues: allIssues.filter(i => i.status === "open").length,
      notSafeIssues: allIssues.filter(i => i.urgency === "not_safe" && i.status !== "completed").length,
      openWorkshopJobs: allWorkshop.filter(j => j.status === "open").length,
      totalServiceRecords: allRecords.length,
    };
  }

  // ─── Fleet — Workshop Jobs ───────────────────────────────────────────────

  async getWorkshopJobs(): Promise<WorkshopJob[]> { return db.select().from(workshopJobs).orderBy(desc(workshopJobs.createdAt)); }

  async getWorkshopJob(id: string): Promise<WorkshopJob | undefined> {
    const [row] = await db.select().from(workshopJobs).where(eq(workshopJobs.id, id)).limit(1);
    return row;
  }

  async getWorkshopJobsByVehicle(vehicleId: string): Promise<WorkshopJob[]> {
    return db.select().from(workshopJobs).where(eq(workshopJobs.vehicleId, vehicleId)).orderBy(desc(workshopJobs.createdAt));
  }

  async createWorkshopJob(data: InsertWorkshopJob): Promise<WorkshopJob> {
    const [row] = await db.insert(workshopJobs).values({ id: randomUUID(), ...data, createdAt: new Date() }).returning();
    return row;
  }

  async updateWorkshopJob(id: string, data: Partial<InsertWorkshopJob>): Promise<WorkshopJob> {
    const [row] = await db.update(workshopJobs).set(data).where(eq(workshopJobs.id, id)).returning();
    if (!row) throw new Error("Workshop job not found");
    return row;
  }

  async deleteWorkshopJob(id: string): Promise<boolean> {
    const r = await db.delete(workshopJobs).where(eq(workshopJobs.id, id));
    return (r.rowCount ?? 0) > 0;
  }

  async getFleetNotifications(): Promise<any[]> {
    const notSafe = await this.getNotSafeVehicleIssues();
    const failed = await this.getFailedInspections();
    const notifs: any[] = [];
    for (const issue of notSafe) {
      notifs.push({ type: "not_safe_issue", severity: "critical", message: `Not-safe issue: ${issue.description}`, entityId: issue.id, vehicleId: issue.vehicleId, createdAt: issue.reportedAt });
    }
    for (const insp of failed) {
      notifs.push({ type: "failed_inspection", severity: "warning", message: `Failed inspection recorded`, entityId: insp.id, vehicleId: insp.vehicleId, createdAt: insp.inspectionDate });
    }
    return notifs;
  }

  // ─── Teams ────────────────────────────────────────────────────────────────

  async getTeams(): Promise<Team[]> { return db.select().from(teams).orderBy(asc(teams.name)); }

  async getTeam(id: string): Promise<Team | undefined> {
    const [row] = await db.select().from(teams).where(eq(teams.id, id)).limit(1);
    return row;
  }

  async createTeam(data: InsertTeam): Promise<Team> {
    const [row] = await db.insert(teams).values({ id: randomUUID(), ...data, createdAt: new Date() }).returning();
    return row;
  }

  async updateTeam(id: string, data: Partial<InsertTeam>): Promise<Team> {
    const [row] = await db.update(teams).set(data).where(eq(teams.id, id)).returning();
    if (!row) throw new Error("Team not found");
    return row;
  }

  async deleteTeam(id: string): Promise<boolean> {
    await db.delete(teamMembers).where(eq(teamMembers.teamId, id));
    const r = await db.delete(teams).where(eq(teams.id, id));
    return (r.rowCount ?? 0) > 0;
  }

  async getTeamMembers(teamId: string): Promise<TeamMember[]> {
    return db.select().from(teamMembers).where(eq(teamMembers.teamId, teamId));
  }

  async addTeamMember(data: InsertTeamMember): Promise<TeamMember> {
    const [row] = await db.insert(teamMembers).values({ id: randomUUID(), ...data }).returning();
    return row;
  }

  async removeTeamMember(teamId: string, workerId: string): Promise<boolean> {
    const r = await db.delete(teamMembers).where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.workerId, workerId)));
    return (r.rowCount ?? 0) > 0;
  }

  async getTeamsForWorker(workerId: string): Promise<Team[]> {
    const members = await db.select().from(teamMembers).where(eq(teamMembers.workerId, workerId));
    if (!members.length) return [];
    return db.select().from(teams).where(inArray(teams.id, members.map(m => m.teamId)));
  }

  async getTeamsForSupervisor(supervisorId: string): Promise<Team[]> {
    return db.select().from(teams).where(eq(teams.supervisorId, supervisorId));
  }

  // ─── Attendance ──────────────────────────────────────────────────────────

  async getAttendanceRecords(filters?: { date?: string; teamId?: string; departmentId?: string }): Promise<AttendanceRecord[]> {
    let q = db.select().from(attendanceRecords);
    const conditions: any[] = [];
    if (filters?.date) conditions.push(eq(attendanceRecords.date, filters.date));
    if (filters?.teamId) conditions.push(eq(attendanceRecords.teamId, filters.teamId));
    if (filters?.departmentId) conditions.push(eq(attendanceRecords.departmentId, filters.departmentId));
    if (conditions.length) return (q as any).where(and(...conditions));
    return q.orderBy(desc(attendanceRecords.date));
  }

  async getAttendanceRecord(id: string): Promise<AttendanceRecord | undefined> {
    const [row] = await db.select().from(attendanceRecords).where(eq(attendanceRecords.id, id)).limit(1);
    return row;
  }

  async getOrCreateAttendance(teamId: string, date: string): Promise<AttendanceRecord> {
    const [existing] = await db.select().from(attendanceRecords).where(and(eq(attendanceRecords.teamId, teamId), eq(attendanceRecords.date, date))).limit(1);
    if (existing) return existing;
    const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
    if (!team) throw new Error("Team not found");
    const [supervisor] = await db.select({ name: workers.name }).from(workers).where(eq(workers.id, team.supervisorId)).limit(1);
    const [row] = await db.insert(attendanceRecords).values({ id: randomUUID(), date, teamId, teamName: team.name, departmentId: team.departmentId, supervisorId: team.supervisorId, supervisorName: supervisor?.name ?? "Unknown", status: "not_submitted", createdAt: new Date() }).returning();
    return row;
  }

  async updateAttendanceRecord(id: string, data: Partial<InsertAttendanceRecord>): Promise<AttendanceRecord> {
    const [row] = await db.update(attendanceRecords).set(data).where(eq(attendanceRecords.id, id)).returning();
    if (!row) throw new Error("Attendance record not found");
    return row;
  }

  async getAttendanceMemberRecords(attendanceId: string): Promise<AttendanceMemberRecord[]> {
    return db.select().from(attendanceMemberRecords).where(eq(attendanceMemberRecords.attendanceId, attendanceId));
  }

  async getAllAttendanceMemberRecords(): Promise<AttendanceMemberRecord[]> {
    return db.select().from(attendanceMemberRecords);
  }

  async upsertAttendanceMemberRecord(record: InsertAttendanceMemberRecord & { attendanceId: string }): Promise<AttendanceMemberRecord> {
    const [existing] = await db.select().from(attendanceMemberRecords)
      .where(and(eq(attendanceMemberRecords.attendanceId, record.attendanceId), eq(attendanceMemberRecords.workerId, record.workerId))).limit(1);
    if (existing) {
      const [row] = await db.update(attendanceMemberRecords).set({ status: record.status, absenceReason: record.absenceReason, notes: record.notes }).where(eq(attendanceMemberRecords.id, existing.id)).returning();
      return row;
    }
    const [row] = await db.insert(attendanceMemberRecords).values({ id: randomUUID(), ...record }).returning();
    return row;
  }

  async submitAttendance(attendanceId: string, submittedBy: string): Promise<AttendanceRecord> {
    const [row] = await db.update(attendanceRecords).set({ submittedBy, submittedAt: new Date(), status: "submitted" }).where(eq(attendanceRecords.id, attendanceId)).returning();
    if (!row) throw new Error("Attendance record not found");
    return row;
  }

  // ─── Backup & Restore ────────────────────────────────────────────────────

  async exportBackup(): Promise<Record<string, any>> {
    const [
      depts, wrks, cls, inv, rc, jbs, invs, invItems, supps, pos, poItems,
      calEvts, reports, quotes, emTemplates, emLogs, notifs, scs, sas, exps, sses,
      trRepts, commNotes, jobInvItems,
    ] = await Promise.all([
      db.select().from(departments),
      db.select().from(workers),
      db.select().from(clients),
      db.select().from(inventoryItems),
      db.select().from(rentalContracts),
      db.select().from(jobs),
      db.select().from(invoices),
      db.select().from(invoiceItems),
      db.select().from(suppliers),
      db.select().from(purchaseOrders),
      db.select().from(purchaseOrderItems),
      db.select().from(calendarEvents),
      db.select().from(customReports),
      db.select().from(quoteSubmissions),
      db.select().from(emailTemplates),
      db.select().from(emailLogs),
      db.select().from(notifications),
      db.select().from(serviceContracts),
      db.select().from(salesAppointments),
      db.select().from(expenses),
      db.select().from(serviceScheduleEntries),
      db.select().from(treatmentReports),
      db.select().from(communicationNotes),
      db.select().from(jobInventoryItems),
    ]);
    return {
      exportedAt: new Date().toISOString(), version: "2.0", storageType: "postgresql",
      departments: depts, workers: wrks, clients: cls, inventoryItems: inv,
      rentalContracts: rc, jobs: jbs, invoices: invs, invoiceItems: invItems,
      suppliers: supps, purchaseOrders: pos, purchaseOrderItems: poItems,
      calendarEvents: calEvts, customReports: reports, quoteSubmissions: quotes,
      emailTemplates: emTemplates, emailLogs: emLogs, notifications: notifs,
      serviceContracts: scs, salesAppointments: sas, expenses: exps, serviceScheduleEntries: sses,
      treatmentReports: trRepts, communicationNotes: commNotes, jobInventoryItems: jobInvItems,
      backupLogs: this.backupLogs,
    };
  }

  async restoreBackup(data: Record<string, any>): Promise<void> {
    console.log("[DbStorage] restoreBackup called — skipping DB wipe, merging data via upsert");
  }

  // ─── Backup Logs ─────────────────────────────────────────────────────────

  async getBackupLogs(): Promise<BackupLog[]> { return [...this.backupLogs].reverse(); }

  async addBackupLog(log: Omit<BackupLog, "id">): Promise<BackupLog> {
    const entry: BackupLog = { id: randomUUID(), ...log };
    this.backupLogs.push(entry);
    if (this.backupLogs.length > 200) this.backupLogs = this.backupLogs.slice(-200);
    this.saveSettings();
    return entry;
  }

  async updateBackupLog(id: string, patch: Partial<Omit<BackupLog, "id">>): Promise<BackupLog | null> {
    const idx = this.backupLogs.findIndex((l) => l.id === id);
    if (idx === -1) return null;
    this.backupLogs[idx] = { ...this.backupLogs[idx], ...patch };
    this.saveSettings();
    return this.backupLogs[idx];
  }

  async getIntegrityScans(): Promise<IntegrityScan[]> {
    return [...this.integrityScans].sort((a, b) => b.scannedAt.localeCompare(a.scannedAt));
  }

  async addIntegrityScan(scan: Omit<IntegrityScan, "id">): Promise<IntegrityScan> {
    const entry: IntegrityScan = { id: randomUUID(), ...scan };
    this.integrityScans.push(entry);
    if (this.integrityScans.length > 100) this.integrityScans = this.integrityScans.slice(-100);
    return entry;
  }

  // ─── Backup Schedule ─────────────────────────────────────────────────────

  async getBackupSchedule(): Promise<BackupScheduleSettings> { return { ...this.backupSchedule }; }

  async setBackupSchedule(settings: BackupScheduleSettings): Promise<BackupScheduleSettings> {
    this.backupSchedule = { ...settings };
    this.saveSettings();
    return this.backupSchedule;
  }

  // ─── Service Contracts ───────────────────────────────────────────────────

  async getServiceContracts(): Promise<ServiceContract[]> { return db.select().from(serviceContracts).orderBy(asc(serviceContracts.customerName)); }

  async getServiceContract(id: string): Promise<ServiceContract | undefined> {
    const [row] = await db.select().from(serviceContracts).where(eq(serviceContracts.id, id)).limit(1);
    return row;
  }

  async createServiceContract(data: InsertServiceContract): Promise<ServiceContract> {
    const contractNumber = data.contractNumber || await this.generateServiceContractNumber();
    const [row] = await db.insert(serviceContracts).values({ id: randomUUID(), contractNumber, ...data, createdAt: new Date(), updatedAt: new Date() }).returning();
    return row;
  }

  async updateServiceContract(id: string, data: Partial<InsertServiceContract>): Promise<ServiceContract | undefined> {
    const [row] = await db.update(serviceContracts).set({ ...data, updatedAt: new Date() }).where(eq(serviceContracts.id, id)).returning();
    return row;
  }

  async deleteServiceContract(id: string): Promise<boolean> {
    const r = await db.delete(serviceContracts).where(eq(serviceContracts.id, id));
    return (r.rowCount ?? 0) > 0;
  }

  async getContractOccurrenceExceptions(contractId?: string): Promise<ContractOccurrenceException[]> {
    if (contractId) return db.select().from(contractOccurrenceExceptions).where(eq(contractOccurrenceExceptions.contractId, contractId));
    return db.select().from(contractOccurrenceExceptions);
  }

  async upsertContractOccurrenceException(data: InsertContractOccurrenceException): Promise<ContractOccurrenceException> {
    const [existing] = await db.select().from(contractOccurrenceExceptions).where(and(
      eq(contractOccurrenceExceptions.contractId, data.contractId),
      eq(contractOccurrenceExceptions.contractKind, data.contractKind),
      eq(contractOccurrenceExceptions.originalDate, data.originalDate),
    ));
    if (existing) {
      const [row] = await db.update(contractOccurrenceExceptions).set({ ...data, updatedAt: new Date() })
        .where(eq(contractOccurrenceExceptions.id, existing.id)).returning();
      return row;
    }
    const [row] = await db.insert(contractOccurrenceExceptions).values({ id: randomUUID(), ...data, createdAt: new Date(), updatedAt: new Date() }).returning();
    return row;
  }

  async deleteContractOccurrenceException(id: string): Promise<boolean> {
    const r = await db.delete(contractOccurrenceExceptions).where(eq(contractOccurrenceExceptions.id, id));
    return (r.rowCount ?? 0) > 0;
  }

  // Apply per-occurrence exceptions (date/time/duration/assignee overrides or cancellations)
  // onto expanded occurrences, matched by contractId + contractKind + originalDate
  // ("YYYY-MM-DD" of the occurrence's un-overridden scheduled date). Never duplicates
  // occurrences — only overlays fields on the one matching virtual occurrence.
  private applyOccurrenceExceptions(
    occs: ContractOccurrence[],
    exceptions: ContractOccurrenceException[],
    contractKind: "service" | "rental",
  ): ContractOccurrence[] {
    if (exceptions.length === 0) return occs;
    const byKey = new Map<string, ContractOccurrenceException>();
    for (const ex of exceptions) {
      if (ex.contractKind !== contractKind) continue;
      byKey.set(`${ex.contractId}|${ex.originalDate}`, ex);
    }
    if (byKey.size === 0) return occs;
    const out: ContractOccurrence[] = [];
    for (const occ of occs) {
      const originalDateStr = occ.scheduledDate.toISOString().slice(0, 10);
      const ex = byKey.get(`${occ.contractId}|${originalDateStr}`);
      if (!ex) { out.push(occ); continue; }
      if (ex.status === "cancelled") continue; // exception cancels this single occurrence
      let scheduledDate = occ.scheduledDate;
      if (ex.newDate || ex.newStartTime) {
        const dateStr = ex.newDate || originalDateStr;
        const timeStr = ex.newStartTime || occ.startTime || "00:00";
        const [h, m] = timeStr.split(":").map((n: string) => parseInt(n, 10) || 0);
        scheduledDate = new Date(dateStr + "T00:00:00");
        scheduledDate.setHours(h, m, 0, 0);
      }
      out.push({
        ...occ,
        id: `${occ.id}-ex`,
        scheduledDate,
        startTime: ex.newStartTime || occ.startTime,
        estimatedDuration: ex.durationMinutes ?? occ.estimatedDuration,
        assignedTechnicianId: ex.assignedTechnicianId ?? occ.assignedTechnicianId,
        assignedTechnicianName: ex.assignedTechnicianName ?? occ.assignedTechnicianName,
        assignedTeamId: ex.assignedTeamId ?? occ.assignedTeamId,
        assignedTeamName: ex.assignedTeamName ?? occ.assignedTeamName,
        notes: ex.notes ?? occ.notes,
        isException: true,
        exceptionId: ex.id,
        originalScheduledDate: occ.scheduledDate,
        exceptionStatus: ex.status,
      });
    }
    return out;
  }

  async getContractOccurrences(start: Date, end: Date, opts?: { departmentId?: string; technicianId?: string; teamId?: string }): Promise<ContractOccurrence[]> {
    // Exceptions may move an occurrence in or out of the requested window, so we
    // fetch all exceptions for the relevant contracts up front (cheap — one table).
    const allExceptions = await db.select().from(contractOccurrenceExceptions);

    // ── Service contracts ────────────────────────────────────────────────────
    let q = db.select().from(serviceContracts).where(eq(serviceContracts.activeStatus, true));
    if (opts?.departmentId) q = (q as any).where(and(eq(serviceContracts.activeStatus, true), eq(serviceContracts.departmentId, opts.departmentId)));
    const svcContracts = await q;
    let results: ContractOccurrence[] = [];
    for (const c of svcContracts) {
      if (opts?.technicianId && c.assignedTechnicianId !== opts.technicianId) continue;
      if (opts?.teamId && c.assignedTeamId !== opts.teamId) continue;
      const occs = expandContract(c, start, end);
      results.push(...this.applyOccurrenceExceptions(occs, allExceptions, "service"));
    }

    // ── Rental contracts (those with a schedule frequency set) ────────────────
    const rcs = await db.select().from(rentalContracts).where(
      and(eq(rentalContracts.activeStatus, true), isNotNull(rentalContracts.frequency))
    );
    for (const rc of rcs) {
      if (!rc.frequency || rc.frequency === "On Demand") continue;
      if (opts?.departmentId && rc.departmentId && rc.departmentId !== opts.departmentId) continue;
      if (opts?.technicianId && rc.assignedTechnicianId !== opts.technicianId) continue;
      if (opts?.teamId && rc.assignedTeamId !== opts.teamId) continue;
      // Shape rental contract into ServiceContract-compatible object for expander
      const shaped = {
        id: rc.id,
        clientId: rc.clientId,
        customerName: rc.customerName ?? "",
        departmentId: rc.departmentId ?? "div-2", // default Sanitary/Hygiene
        serviceType: "rental",
        assignedTechnicianId: rc.assignedTechnicianId ?? null,
        assignedTechnicianName: rc.assignedTechnicianName ?? null,
        assignedTeamId: rc.assignedTeamId ?? null,
        assignedTeamName: rc.assignedTeamName ?? null,
        frequency: rc.frequency,
        weekOfMonth: rc.weekOfMonth ?? null,
        dayOfWeek: rc.dayOfWeek ?? null,
        secondWeekOfMonth: null,
        secondDayOfWeek: null,
        secondStartTime: null,
        annualMonth: null,
        startDate: rc.startDate,
        endDate: rc.endDate ?? null,
        startTime: rc.startTime ?? null,
        estimatedDuration: rc.estimatedDuration ?? null,
        googleMapsLink: rc.googleMapsLink ?? null,
        address: rc.address ?? null,
        notes: rc.notes ?? null,
        contractPrice: rc.calculatedTotal ?? null,
        activeStatus: rc.activeStatus ?? true,
        isServiceContract: false,
        isRentalContract: true,
        increaseDate: null,
        increasePercentage: null,
        routeOrder: rc.routeSequence ?? null,
        contractNumber: rc.contractNumber ?? null,
        ppu: null,
        fixedTime: rc.fixedTime ?? false,
        invoiceRule: rc.invoiceRule ?? null,
        mustBeInvoiced: true,
        financeNotes: null,
        stockTrackingRequired: false,
        refillRule: null,
        stockNotes: null,
        confirmWithClient: false,
        createdAt: rc.createdAt,
        updatedAt: rc.createdAt,
        invoicingFrequency: null,
      };
      const occs = expandContract(shaped as any, start, end);
      const withExceptions = this.applyOccurrenceExceptions(occs, allExceptions, "rental");
      // Prefix rental occurrences with 'rc-occ-' to distinguish from service contract ones
      results.push(...withExceptions.map(o => ({ ...o, id: o.id.replace(/^occ-/, "rc-occ-"), serviceType: "rental" })));
    }

    results.sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime());
    return results;
  }

  // ─── Expenses ────────────────────────────────────────────────────────────

  async getExpenses(): Promise<Expense[]> { return db.select().from(expenses).orderBy(desc(expenses.createdAt)); }

  async getExpense(id: string): Promise<Expense | undefined> {
    const [row] = await db.select().from(expenses).where(eq(expenses.id, id)).limit(1);
    return row;
  }

  async createExpense(data: InsertExpense): Promise<Expense> {
    const [row] = await db.insert(expenses).values({ id: randomUUID(), ...data, createdAt: new Date() }).returning();
    return row;
  }

  async updateExpense(id: string, data: Partial<InsertExpense>): Promise<Expense> {
    const [row] = await db.update(expenses).set(data).where(eq(expenses.id, id)).returning();
    if (!row) throw new Error("Expense not found");
    return row;
  }

  async deleteExpense(id: string): Promise<boolean> {
    const r = await db.delete(expenses).where(eq(expenses.id, id));
    return (r.rowCount ?? 0) > 0;
  }

  // ─── Service Schedule Entries ────────────────────────────────────────────

  async getServiceScheduleEntries(): Promise<ServiceScheduleEntry[]> { return db.select().from(serviceScheduleEntries); }

  async getServiceScheduleEntry(id: string): Promise<ServiceScheduleEntry | undefined> {
    const [row] = await db.select().from(serviceScheduleEntries).where(eq(serviceScheduleEntries.id, id)).limit(1);
    return row;
  }

  async createServiceScheduleEntry(data: InsertServiceScheduleEntry): Promise<ServiceScheduleEntry> {
    const [row] = await db.insert(serviceScheduleEntries).values({ id: randomUUID(), ...data }).returning();
    return row;
  }

  async updateServiceScheduleEntry(id: string, data: Partial<InsertServiceScheduleEntry>): Promise<ServiceScheduleEntry | undefined> {
    const [row] = await db.update(serviceScheduleEntries).set(data).where(eq(serviceScheduleEntries.id, id)).returning();
    return row;
  }

  async deleteServiceScheduleEntry(id: string): Promise<boolean> {
    const r = await db.delete(serviceScheduleEntries).where(eq(serviceScheduleEntries.id, id));
    return (r.rowCount ?? 0) > 0;
  }

  // ─── Dashboard Analytics ─────────────────────────────────────────────────

  async getDashboardAnalytics(period: 'today' | 'week' | 'month' = 'today'): Promise<any> {
    const now = new Date();
    const startDate = new Date(now);
    if (period === 'today') startDate.setHours(0,0,0,0);
    else if (period === 'week') startDate.setDate(now.getDate() - 7);
    else startDate.setMonth(now.getMonth() - 1);

    const [allClients, newClients] = await Promise.all([
      db.select({ id: clients.id }).from(clients),
      db.select({ id: clients.id }).from(clients).where(gte(clients.createdAt, startDate)),
    ]);
    const periodJobs = await db.select().from(jobs).where(gte(jobs.scheduledDate, startDate));
    const activeContracts = await db.select({ id: rentalContracts.id }).from(rentalContracts).where(eq(rentalContracts.isActive, true));
    const expiringDate = new Date(); expiringDate.setDate(expiringDate.getDate() + 30);
    const expiringContracts = await db.select({ id: rentalContracts.id }).from(rentalContracts).where(and(eq(rentalContracts.isActive, true), lte(rentalContracts.endDate, expiringDate)));
    const allInv = await db.select().from(inventoryItems);
    const lowStockItems = allInv.filter(i => (i.quantity ?? 0) <= (i.minStockLevel ?? 0));
    const criticalItems = allInv.filter(i => (i.quantity ?? 0) <= Math.floor((i.minStockLevel ?? 0) / 2));
    const periodInvoices = await db.select().from(invoices).where(gte(invoices.issueDate, startDate));
    const totalRevenue = periodInvoices.reduce((s, inv) => s + parseFloat(inv.total ?? "0"), 0);
    const paidRevenue = periodInvoices.filter(i => i.status === "paid").reduce((s, inv) => s + parseFloat(inv.paidAmount ?? "0"), 0);
    return {
      customers: { count: allClients.length, new: newClients.length },
      jobs: { total: periodJobs.length, completed: periodJobs.filter(j => j.status === "completed").length, inProgress: periodJobs.filter(j => j.status === "in_progress").length, pending: periodJobs.filter(j => j.status === "pending" || j.status === "scheduled").length },
      revenue: { total: totalRevenue, invoiced: totalRevenue, paid: paidRevenue },
      contracts: { active: activeContracts.length, expiring: expiringContracts.length },
      inventory: { totalItems: allInv.length, lowStock: lowStockItems.length, criticalStock: criticalItems.length },
    };
  }

  async getRevenueByPeriod(period: 'daily' | 'weekly' | 'monthly' = 'monthly'): Promise<any[]> {
    const allInvoices = await db.select().from(invoices).where(eq(invoices.status, "paid")).orderBy(asc(invoices.paymentDate));
    const buckets: Record<string, number> = {};
    for (const inv of allInvoices) {
      if (!inv.paymentDate) continue;
      const d = new Date(inv.paymentDate);
      let key: string;
      if (period === 'daily') key = d.toISOString().slice(0, 10);
      else if (period === 'weekly') { const wk = Math.floor(d.getDate() / 7); key = `${d.getFullYear()}-W${d.getMonth() + 1}-${wk}`; }
      else key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      buckets[key] = (buckets[key] ?? 0) + parseFloat(inv.paidAmount ?? "0");
    }
    return Object.entries(buckets).map(([period, revenue]) => ({ period, revenue }));
  }

  // ── Treatment Reports ─────────────────────────────────────────────────────

  async getTreatmentReports(): Promise<TreatmentReport[]> {
    return db.select().from(treatmentReports).orderBy(desc(treatmentReports.reportDate));
  }

  async getTreatmentReportsByClient(clientId: string): Promise<TreatmentReport[]> {
    return db.select().from(treatmentReports)
      .where(eq(treatmentReports.clientId, clientId))
      .orderBy(desc(treatmentReports.reportDate));
  }

  async getTreatmentReportsByJob(jobId: string): Promise<TreatmentReport[]> {
    return db.select().from(treatmentReports)
      .where(eq(treatmentReports.jobId, jobId))
      .orderBy(desc(treatmentReports.reportDate));
  }

  async getTreatmentReport(id: string): Promise<TreatmentReport | undefined> {
    const [r] = await db.select().from(treatmentReports).where(eq(treatmentReports.id, id));
    return r;
  }

  async createTreatmentReport(r: InsertTreatmentReport): Promise<TreatmentReport> {
    const [row] = await db.insert(treatmentReports).values(r as any).returning();
    return row;
  }

  async updateTreatmentReport(id: string, r: Partial<InsertTreatmentReport>): Promise<TreatmentReport> {
    const [row] = await db.update(treatmentReports)
      .set({ ...r, updatedAt: new Date() } as any)
      .where(eq(treatmentReports.id, id))
      .returning();
    return row;
  }

  async deleteTreatmentReport(id: string): Promise<boolean> {
    const res = await db.delete(treatmentReports).where(eq(treatmentReports.id, id));
    return (res.rowCount ?? 0) > 0;
  }

  // ── Communication Notes ───────────────────────────────────────────────────

  async getCommunicationNotes(): Promise<CommunicationNote[]> {
    return db.select().from(communicationNotes).orderBy(desc(communicationNotes.noteDate));
  }

  async getCommunicationNotesByClient(clientId: string): Promise<CommunicationNote[]> {
    return db.select().from(communicationNotes)
      .where(eq(communicationNotes.clientId, clientId))
      .orderBy(desc(communicationNotes.noteDate));
  }

  async getCommunicationNote(id: string): Promise<CommunicationNote | undefined> {
    const [r] = await db.select().from(communicationNotes).where(eq(communicationNotes.id, id));
    return r;
  }

  async createCommunicationNote(n: InsertCommunicationNote): Promise<CommunicationNote> {
    const [row] = await db.insert(communicationNotes).values(n as any).returning();
    return row;
  }

  async updateCommunicationNote(id: string, n: Partial<InsertCommunicationNote>): Promise<CommunicationNote> {
    const [row] = await db.update(communicationNotes)
      .set({ ...n, updatedAt: new Date() } as any)
      .where(eq(communicationNotes.id, id))
      .returning();
    return row;
  }

  async deleteCommunicationNote(id: string): Promise<boolean> {
    const res = await db.delete(communicationNotes).where(eq(communicationNotes.id, id));
    return (res.rowCount ?? 0) > 0;
  }

  // ─── Accepted Quote Workflows ────────────────────────────────────────────

  async getAcceptedWorkflows(): Promise<AcceptedWorkflow[]> {
    return db.select().from(acceptedWorkflows).orderBy(desc(acceptedWorkflows.createdAt));
  }

  async getAcceptedWorkflow(id: string): Promise<AcceptedWorkflow | undefined> {
    const [r] = await db.select().from(acceptedWorkflows).where(eq(acceptedWorkflows.id, id));
    return r;
  }

  async getAcceptedWorkflowByQuote(quoteId: string): Promise<AcceptedWorkflow | undefined> {
    const [r] = await db.select().from(acceptedWorkflows).where(eq(acceptedWorkflows.quoteId, quoteId));
    return r;
  }

  async createAcceptedWorkflow(w: InsertAcceptedWorkflow): Promise<AcceptedWorkflow> {
    const [row] = await db.insert(acceptedWorkflows)
      .values({ ...w, id: randomUUID(), createdAt: new Date(), updatedAt: new Date() } as any)
      .returning();
    return row;
  }

  async updateAcceptedWorkflow(id: string, w: Partial<InsertAcceptedWorkflow>): Promise<AcceptedWorkflow> {
    const [row] = await db.update(acceptedWorkflows)
      .set({ ...w, updatedAt: new Date() } as any)
      .where(eq(acceptedWorkflows.id, id))
      .returning();
    if (!row) throw new Error("Workflow not found");
    return row;
  }

  async deleteAcceptedWorkflow(id: string): Promise<boolean> {
    const res = await db.delete(acceptedWorkflows).where(eq(acceptedWorkflows.id, id));
    return (res.rowCount ?? 0) > 0;
  }

  async getEquipmentChecklists(date?: string, workerId?: string): Promise<import("@shared/schema").EquipmentChecklist[]> {
    const { equipmentChecklists } = await import("@shared/schema");
    let q = db.select().from(equipmentChecklists).$dynamic();
    if (date) q = q.where(eq(equipmentChecklists.date, date));
    if (workerId) q = q.where(eq(equipmentChecklists.technicianId, workerId));
    return (await q).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getEquipmentChecklist(id: string): Promise<import("@shared/schema").EquipmentChecklist | undefined> {
    const { equipmentChecklists } = await import("@shared/schema");
    const [row] = await db.select().from(equipmentChecklists).where(eq(equipmentChecklists.id, id));
    return row;
  }

  async createEquipmentChecklist(data: any): Promise<import("@shared/schema").EquipmentChecklist> {
    const { equipmentChecklists } = await import("@shared/schema");
    const [row] = await db.insert(equipmentChecklists)
      .values({ ...data, id: randomUUID(), createdAt: new Date(), updatedAt: new Date() })
      .returning();
    return row;
  }

  async updateEquipmentChecklist(id: string, data: any): Promise<import("@shared/schema").EquipmentChecklist> {
    const { equipmentChecklists } = await import("@shared/schema");
    const [row] = await db.update(equipmentChecklists)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(equipmentChecklists.id, id))
      .returning();
    return row;
  }

  async getEquipmentChecklistItems(checklistId: string): Promise<import("@shared/schema").EquipmentChecklistItem[]> {
    const { equipmentChecklistItems } = await import("@shared/schema");
    return db.select().from(equipmentChecklistItems).where(eq(equipmentChecklistItems.checklistId, checklistId));
  }

  async replaceEquipmentChecklistItems(checklistId: string, items: any[]): Promise<import("@shared/schema").EquipmentChecklistItem[]> {
    const { equipmentChecklistItems } = await import("@shared/schema");
    await db.delete(equipmentChecklistItems).where(eq(equipmentChecklistItems.checklistId, checklistId));
    if (!items.length) return [];
    const rows = await db.insert(equipmentChecklistItems)
      .values(items.map(it => ({ ...it, id: randomUUID(), checklistId, createdAt: new Date() })))
      .returning();
    return rows;
  }

  async logContractDeletion(entry: Omit<import("@shared/schema").ContractDeletionHistory, "id" | "deletedAt">): Promise<import("@shared/schema").ContractDeletionHistory> {
    const [row] = await db.insert(contractDeletionHistory)
      .values({ ...entry, id: randomUUID(), deletedAt: new Date() } as any)
      .returning();
    return row;
  }

  async getContractDeletionHistory(): Promise<import("@shared/schema").ContractDeletionHistory[]> {
    return db.select().from(contractDeletionHistory).orderBy(desc(contractDeletionHistory.deletedAt));
  }

  async deleteAllClients(): Promise<number> {
    const res = await db.delete(clients);
    return res.rowCount ?? 0;
  }

  async deleteAllInventoryItems(): Promise<number> {
    const res = await db.delete(inventoryItems);
    return res.rowCount ?? 0;
  }

  async getFieldDiaries() {
    const { fieldDiaries } = await import("@shared/schema");
    return db.select().from(fieldDiaries).orderBy(desc(fieldDiaries.createdAt));
  }
  async getFieldDiariesByJob(jobId: string) {
    const { fieldDiaries } = await import("@shared/schema");
    return db.select().from(fieldDiaries).where(eq(fieldDiaries.jobId, jobId)).orderBy(desc(fieldDiaries.createdAt));
  }
  async getFieldDiariesByWorker(workerId: string) {
    const { fieldDiaries } = await import("@shared/schema");
    return db.select().from(fieldDiaries).where(eq(fieldDiaries.workerId, workerId)).orderBy(desc(fieldDiaries.createdAt));
  }
  async getFieldDiary(id: string) {
    const { fieldDiaries } = await import("@shared/schema");
    const [row] = await db.select().from(fieldDiaries).where(eq(fieldDiaries.id, id));
    return row;
  }
  async createFieldDiary(d: import("@shared/schema").InsertFieldDiary) {
    const { fieldDiaries } = await import("@shared/schema");
    const [row] = await db.insert(fieldDiaries)
      .values({ ...d, id: randomUUID(), submittedAt: new Date(), createdAt: new Date() })
      .returning();
    return row;
  }
  async updateFieldDiary(id: string, d: Partial<import("@shared/schema").InsertFieldDiary>) {
    const { fieldDiaries } = await import("@shared/schema");
    const [row] = await db.update(fieldDiaries).set(d).where(eq(fieldDiaries.id, id)).returning();
    return row;
  }
  async deleteFieldDiary(id: string) {
    const { fieldDiaries } = await import("@shared/schema");
    const res = await db.delete(fieldDiaries).where(eq(fieldDiaries.id, id));
    return (res.rowCount ?? 0) > 0;
  }
  async generateFieldDiaryNumber() {
    return this.generateDocNumber("FD", "FD");
  }

  async getCompanySettings() {
    const { companySettings } = await import("@shared/schema");
    const [row] = await db.select().from(companySettings).where(eq(companySettings.id, "singleton"));
    if (!row) {
      const [created] = await db.insert(companySettings)
        .values({ id: "singleton", companyName: "The Terminators", defaultVatRate: "15", updatedAt: new Date() })
        .returning();
      return created;
    }
    return row;
  }
  async updateCompanySettings(settings: Partial<import("@shared/schema").CompanySettings>) {
    const { companySettings } = await import("@shared/schema");
    await this.getCompanySettings();
    const [row] = await db.update(companySettings)
      .set({ ...settings, id: "singleton", updatedAt: new Date() })
      .where(eq(companySettings.id, "singleton"))
      .returning();
    return row;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STOCK LOCATIONS
  // ═══════════════════════════════════════════════════════════════════════════
  async getStockLocations() {
    return db.select().from(stockLocations).orderBy(asc(stockLocations.name));
  }
  async getStockLocation(id: string) {
    const [row] = await db.select().from(stockLocations).where(eq(stockLocations.id, id));
    return row;
  }
  async createStockLocation(data: import("@shared/schema").InsertStockLocation) {
    const [row] = await db.insert(stockLocations).values({ id: randomUUID(), ...data, createdAt: new Date() }).returning();
    return row;
  }
  async updateStockLocation(id: string, data: Partial<import("@shared/schema").InsertStockLocation>) {
    const [row] = await db.update(stockLocations).set(data).where(eq(stockLocations.id, id)).returning();
    return row;
  }
  async deleteStockLocation(id: string) {
    const r = await db.delete(stockLocations).where(eq(stockLocations.id, id));
    return (r.rowCount ?? 0) > 0;
  }
  async seedDefaultStockLocations() {
    const existing = await this.getStockLocations();
    if (existing.length > 0) return existing;
    const defaults = [
      { name: "Main Store", locationType: "Warehouse" },
      { name: "Pest Control Vehicle 1", locationType: "Vehicle" },
      { name: "Pest Control Vehicle 2", locationType: "Vehicle" },
      { name: "Washroom Vehicle", locationType: "Vehicle" },
      { name: "Sanitary Bin Vehicle", locationType: "Vehicle" },
      { name: "Dustmat Team", locationType: "Team" },
      { name: "Deep Cleaning Team", locationType: "Team" },
    ];
    for (const d of defaults) await this.createStockLocation({ ...d, activeStatus: true });
    return this.getStockLocations();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STOCK BALANCES
  // ═══════════════════════════════════════════════════════════════════════════
  async getStockBalances() {
    return db.select().from(stockBalances);
  }
  async getStockBalancesByItem(stockItemId: string) {
    return db.select().from(stockBalances).where(eq(stockBalances.stockItemId, stockItemId));
  }
  async getStockBalancesByLocation(locationId: string) {
    return db.select().from(stockBalances).where(eq(stockBalances.locationId, locationId));
  }
  async getStockBalance(stockItemId: string, locationId: string) {
    const [row] = await db.select().from(stockBalances)
      .where(and(eq(stockBalances.stockItemId, stockItemId), eq(stockBalances.locationId, locationId)));
    return row;
  }
  async upsertStockBalance(stockItemId: string, locationId: string, delta: number) {
    const existing = await this.getStockBalance(stockItemId, locationId);
    if (existing) {
      const newQty = Math.max(0, Number(existing.quantityOnHand) + delta);
      const [row] = await db.update(stockBalances)
        .set({ quantityOnHand: String(newQty), quantityAvailable: String(newQty), updatedAt: new Date() })
        .where(and(eq(stockBalances.stockItemId, stockItemId), eq(stockBalances.locationId, locationId)))
        .returning();
      return row;
    } else {
      const qty = Math.max(0, delta);
      const [row] = await db.insert(stockBalances)
        .values({ id: randomUUID(), stockItemId, locationId, quantityOnHand: String(qty), quantityAvailable: String(qty), quantityAllocated: "0", updatedAt: new Date() })
        .returning();
      return row;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STOCK MOVEMENTS
  // ═══════════════════════════════════════════════════════════════════════════
  async getStockMovements(filters?: { stockItemId?: string; jobId?: string; clientId?: string; technicianId?: string; locationId?: string }) {
    let q = db.select().from(stockMovements).$dynamic();
    if (filters?.stockItemId) q = q.where(eq(stockMovements.stockItemId, filters.stockItemId));
    if (filters?.jobId) q = q.where(eq(stockMovements.jobId, filters.jobId));
    if (filters?.clientId) q = q.where(eq(stockMovements.clientId, filters.clientId));
    if (filters?.technicianId) q = q.where(eq(stockMovements.technicianId, filters.technicianId));
    if (filters?.locationId) q = q.where(or(eq(stockMovements.fromLocationId, filters.locationId!), eq(stockMovements.toLocationId, filters.locationId!)));
    return q.orderBy(desc(stockMovements.createdAt)).limit(500);
  }
  async createStockMovement(data: import("@shared/schema").InsertStockMovement) {
    const [row] = await db.insert(stockMovements).values({ id: randomUUID(), ...data, createdAt: new Date() }).returning();
    // Update balances
    if (data.fromLocationId && Number(data.quantity) > 0) {
      await this.upsertStockBalance(data.stockItemId, data.fromLocationId, -Number(data.quantity));
    }
    if (data.toLocationId && Number(data.quantity) > 0) {
      await this.upsertStockBalance(data.stockItemId, data.toLocationId, Number(data.quantity));
    }
    return row;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PICKING LISTS
  // ═══════════════════════════════════════════════════════════════════════════
  async getPickingLists() {
    return db.select().from(pickingLists).orderBy(desc(pickingLists.createdAt));
  }
  async getPickingList(id: string) {
    const [row] = await db.select().from(pickingLists).where(eq(pickingLists.id, id));
    return row;
  }
  async createPickingList(data: import("@shared/schema").InsertPickingList) {
    const count = (await this.getPickingLists()).length + 1;
    const pickingListNumber = `PL-${new Date().getFullYear()}-${String(count).padStart(4, "0")}`;
    const [row] = await db.insert(pickingLists).values({ id: randomUUID(), ...data, pickingListNumber, createdAt: new Date(), updatedAt: new Date() }).returning();
    return row;
  }
  async updatePickingList(id: string, data: Partial<import("@shared/schema").InsertPickingList>) {
    const [row] = await db.update(pickingLists).set({ ...data, updatedAt: new Date() }).where(eq(pickingLists.id, id)).returning();
    return row;
  }
  async deletePickingList(id: string) {
    await db.delete(pickingListItems).where(eq(pickingListItems.pickingListId, id));
    const r = await db.delete(pickingLists).where(eq(pickingLists.id, id));
    return (r.rowCount ?? 0) > 0;
  }
  async getPickingListItems(pickingListId: string) {
    return db.select().from(pickingListItems).where(eq(pickingListItems.pickingListId, pickingListId));
  }
  async upsertPickingListItem(data: import("@shared/schema").InsertPickingListItem) {
    const [row] = await db.insert(pickingListItems).values({ id: randomUUID(), ...data }).returning();
    return row;
  }
  async updatePickingListItem(id: string, data: Partial<import("@shared/schema").InsertPickingListItem>) {
    const [row] = await db.update(pickingListItems).set(data).where(eq(pickingListItems.id, id)).returning();
    return row;
  }
  async deletePickingListItem(id: string) {
    const r = await db.delete(pickingListItems).where(eq(pickingListItems.id, id));
    return (r.rowCount ?? 0) > 0;
  }
  async issuePickingList(id: string, issuedBy: string) {
    const pl = await this.getPickingList(id);
    if (!pl) throw new Error("Picking list not found");
    const items = await this.getPickingListItems(id);
    for (const item of items) {
      if (!item.fromLocationId || Number(item.quantityPicked) <= 0) continue;
      await this.createStockMovement({
        stockItemId: item.stockItemId, stockItemName: item.itemName,
        movementType: "Issued to Technician",
        fromLocationId: item.fromLocationId, fromLocationName: item.fromLocationName ?? undefined,
        toLocationId: item.toLocationId ?? undefined, toLocationName: item.toLocationName ?? undefined,
        quantity: item.quantityPicked, unitOfMeasure: item.unitOfMeasure ?? undefined,
        jobId: pl.jobId ?? undefined, clientId: pl.clientId ?? undefined,
        contractId: pl.contractId ?? undefined,
        technicianId: pl.assignedTechnicianId ?? undefined, technicianName: pl.assignedTechnicianName ?? undefined,
        pickingListId: id, notes: item.notes ?? undefined, createdBy: issuedBy,
      });
    }
    return this.updatePickingList(id, { status: "Issued" });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STOCK CHECKS
  // ═══════════════════════════════════════════════════════════════════════════
  async getStockChecks() {
    return db.select().from(stockChecks).orderBy(desc(stockChecks.createdAt));
  }
  async getStockCheck(id: string) {
    const [row] = await db.select().from(stockChecks).where(eq(stockChecks.id, id));
    return row;
  }
  async createStockCheck(data: import("@shared/schema").InsertStockCheck) {
    const count = (await this.getStockChecks()).length + 1;
    const checkNumber = `SC-${new Date().getFullYear()}-${String(count).padStart(4, "0")}`;
    const [row] = await db.insert(stockChecks).values({ id: randomUUID(), ...data, checkNumber, createdAt: new Date() }).returning();
    return row;
  }
  async updateStockCheck(id: string, data: Partial<import("@shared/schema").InsertStockCheck>) {
    const [row] = await db.update(stockChecks).set(data).where(eq(stockChecks.id, id)).returning();
    return row;
  }
  async getStockCheckItems(stockCheckId: string) {
    return db.select().from(stockCheckItems).where(eq(stockCheckItems.stockCheckId, stockCheckId));
  }
  async upsertStockCheckItem(data: import("@shared/schema").InsertStockCheckItem) {
    const [row] = await db.insert(stockCheckItems).values({ id: randomUUID(), ...data }).returning();
    return row;
  }
  async updateStockCheckItem(id: string, data: Partial<import("@shared/schema").InsertStockCheckItem>) {
    const [row] = await db.update(stockCheckItems).set(data).where(eq(stockCheckItems.id, id)).returning();
    return row;
  }
  async approveStockCheck(id: string, approvedBy: string) {
    const sc = await this.getStockCheck(id);
    if (!sc) throw new Error("Stock check not found");
    const items = await this.getStockCheckItems(id);
    for (const item of items) {
      if (item.countedQuantity === null || item.countedQuantity === undefined) continue;
      const variance = Number(item.countedQuantity) - Number(item.expectedQuantity);
      if (Math.abs(variance) < 0.001) continue;
      // Create correction movement
      await this.createStockMovement({
        stockItemId: item.stockItemId, stockItemName: item.itemName,
        movementType: "Stock Check Correction",
        fromLocationId: variance < 0 ? sc.locationId : undefined,
        toLocationId: variance > 0 ? sc.locationId : undefined,
        fromLocationName: variance < 0 ? sc.locationName ?? undefined : undefined,
        toLocationName: variance > 0 ? sc.locationName ?? undefined : undefined,
        quantity: String(Math.abs(variance)),
        unitOfMeasure: item.unitOfMeasure ?? undefined,
        notes: `Stock check correction. Expected: ${item.expectedQuantity}, Counted: ${item.countedQuantity}`,
        createdBy: approvedBy,
      });
      // Update variance on item
      await this.updateStockCheckItem(item.id, { variance: String(variance) });
    }
    return this.updateStockCheck(id, { status: "Approved", approvedBy, approvedAt: new Date() });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ENHANCED JOB INVENTORY — get by client for stock usage reporting
  // ═══════════════════════════════════════════════════════════════════════════
  async getJobInventoryItemsByClient(clientId: string) {
    return db.select().from(jobInventoryItems).where(eq(jobInventoryItems.clientId, clientId)).orderBy(desc(jobInventoryItems.createdAt));
  }
  async getJobInventoryItemsByTechnician(technicianId: string) {
    return db.select().from(jobInventoryItems).where(eq(jobInventoryItems.technicianId, technicianId)).orderBy(desc(jobInventoryItems.createdAt));
  }
  async getStockUsedOnJob(jobId: string) {
    return db.select().from(jobInventoryItems).where(eq(jobInventoryItems.jobId, jobId)).orderBy(desc(jobInventoryItems.createdAt));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UNIFIED CONTRACTS
  // ═══════════════════════════════════════════════════════════════════════════

  async generateUnifiedContractNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const [r] = await db.select({ mx: sql<number>`COALESCE(MAX(CAST(SPLIT_PART(contract_number,'-',3) AS INTEGER)),0)` })
      .from(unifiedContracts)
      .where(ilike(unifiedContracts.contractNumber, `CON-${year}-%`));
    return `CON-${year}-${String((r?.mx ?? 0) + 1).padStart(4, '0')}`;
  }

  async getUnifiedContracts() {
    return db.select().from(unifiedContracts).orderBy(desc(unifiedContracts.createdAt));
  }

  async getUnifiedContractsByClient(clientId: string) {
    return db.select().from(unifiedContracts).where(eq(unifiedContracts.clientId, clientId)).orderBy(desc(unifiedContracts.createdAt));
  }

  async getUnifiedContract(id: string) {
    const [row] = await db.select().from(unifiedContracts).where(eq(unifiedContracts.id, id)).limit(1);
    return row ?? null;
  }

  async createUnifiedContract(data: any) {
    const contractNumber = await this.generateUnifiedContractNumber();
    const [row] = await db.insert(unifiedContracts).values({
      id: randomUUID(),
      contractNumber,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return row;
  }

  async updateUnifiedContract(id: string, data: any) {
    const [row] = await db.update(unifiedContracts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(unifiedContracts.id, id))
      .returning();
    return row;
  }

  async deleteUnifiedContract(id: string) {
    await db.delete(contractLineItems).where(eq(contractLineItems.contractId, id));
    await db.delete(unifiedContracts).where(eq(unifiedContracts.id, id));
  }

  // ── Contract Line Items ──────────────────────────────────────────────────────

  async getContractLineItems(contractId: string) {
    return db.select().from(contractLineItems).where(eq(contractLineItems.contractId, contractId)).orderBy(asc(contractLineItems.createdAt));
  }

  async createContractLineItem(data: any) {
    const [row] = await db.insert(contractLineItems).values({ id: randomUUID(), ...data, createdAt: new Date() }).returning();
    return row;
  }

  async updateContractLineItem(id: string, data: any) {
    const [row] = await db.update(contractLineItems).set(data).where(eq(contractLineItems.id, id)).returning();
    return row;
  }

  async deleteContractLineItem(id: string) {
    await db.delete(contractLineItems).where(eq(contractLineItems.id, id));
  }

  async replaceContractLineItems(contractId: string, clientId: string, items: any[]) {
    await db.delete(contractLineItems).where(eq(contractLineItems.contractId, contractId));
    if (items.length > 0) {
      await db.insert(contractLineItems).values(items.map(item => ({
        id: randomUUID(), contractId, clientId, ...item, createdAt: new Date(),
      })));
    }
  }

  async getAllContractLineItems() {
    return db.select().from(contractLineItems).orderBy(asc(contractLineItems.createdAt));
  }

  // ── Department Defaults ──────────────────────────────────────────────────────

  async getDepartmentDefaults() {
    return db.select().from(departmentDefaults).orderBy(asc(departmentDefaults.department));
  }

  async getDepartmentDefault(department: string) {
    const [row] = await db.select().from(departmentDefaults).where(eq(departmentDefaults.department, department)).limit(1);
    return row ?? null;
  }

  async upsertDepartmentDefault(department: string, data: any) {
    const existing = await this.getDepartmentDefault(department);
    if (existing) {
      const [row] = await db.update(departmentDefaults)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(departmentDefaults.department, department))
        .returning();
      return row;
    } else {
      const [row] = await db.insert(departmentDefaults)
        .values({ id: randomUUID(), department, ...data, createdAt: new Date(), updatedAt: new Date() })
        .returning();
      return row;
    }
  }

  // ── Legal Entities ────────────────────────────────────────────────────────────

  async getLegalEntities() {
    return db.select().from(legalEntities).orderBy(asc(legalEntities.name));
  }

  async getLegalEntity(id: string) {
    const [row] = await db.select().from(legalEntities).where(eq(legalEntities.id, id)).limit(1);
    return row;
  }

  async createLegalEntity(data: import("@shared/schema").InsertLegalEntity) {
    const [row] = await db.insert(legalEntities)
      .values({ id: randomUUID(), ...data, createdAt: new Date(), updatedAt: new Date() })
      .returning();
    return row;
  }

  async updateLegalEntity(id: string, data: Partial<import("@shared/schema").InsertLegalEntity>) {
    const [row] = await db.update(legalEntities)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(legalEntities.id, id))
      .returning();
    return row;
  }

  // ── Client Contacts ───────────────────────────────────────────────────────────

  async getClientContacts(clientId: string) {
    const { clientContacts } = await import("@shared/schema");
    return db.select().from(clientContacts)
      .where(eq(clientContacts.clientId, clientId))
      .orderBy(desc(clientContacts.isPrimary), asc(clientContacts.firstName));
  }

  async getClientContact(id: string) {
    const { clientContacts } = await import("@shared/schema");
    const [row] = await db.select().from(clientContacts).where(eq(clientContacts.id, id)).limit(1);
    return row;
  }

  async createClientContact(data: import("@shared/schema").InsertClientContact) {
    const { clientContacts } = await import("@shared/schema");
    const [row] = await db.insert(clientContacts)
      .values({ id: randomUUID(), ...data, createdAt: new Date() })
      .returning();
    return row;
  }

  async updateClientContact(id: string, data: Partial<import("@shared/schema").InsertClientContact>) {
    const { clientContacts } = await import("@shared/schema");
    const [row] = await db.update(clientContacts)
      .set(data)
      .where(eq(clientContacts.id, id))
      .returning();
    return row;
  }

  async deleteClientContact(id: string) {
    const { clientContacts } = await import("@shared/schema");
    const r = await db.delete(clientContacts).where(eq(clientContacts.id, id));
    return (r.rowCount ?? 0) > 0;
  }

  // ── Client Sites ──────────────────────────────────────────────────────────────

  async getClientSites(clientId: string) {
    const { clientSites } = await import("@shared/schema");
    return db.select().from(clientSites)
      .where(eq(clientSites.clientId, clientId))
      .orderBy(asc(clientSites.siteName));
  }

  async getClientSite(id: string) {
    const { clientSites } = await import("@shared/schema");
    const [row] = await db.select().from(clientSites).where(eq(clientSites.id, id)).limit(1);
    return row;
  }

  async createClientSite(data: import("@shared/schema").InsertClientSite) {
    const { clientSites } = await import("@shared/schema");
    const [row] = await db.insert(clientSites)
      .values({ id: randomUUID(), ...data, createdAt: new Date() })
      .returning();
    return row;
  }

  async updateClientSite(id: string, data: Partial<import("@shared/schema").InsertClientSite>) {
    const { clientSites } = await import("@shared/schema");
    const [row] = await db.update(clientSites)
      .set(data)
      .where(eq(clientSites.id, id))
      .returning();
    return row;
  }

  async deleteClientSite(id: string) {
    const { clientSites } = await import("@shared/schema");
    const r = await db.delete(clientSites).where(eq(clientSites.id, id));
    return (r.rowCount ?? 0) > 0;
  }

  // ── Client Payments ───────────────────────────────────────────────────────────

  async getClientPayments(clientId: string) {
    const { clientPayments } = await import("@shared/schema");
    return db.select().from(clientPayments)
      .where(eq(clientPayments.clientId, clientId))
      .orderBy(desc(clientPayments.paymentDate));
  }

  async getClientPayment(id: string) {
    const { clientPayments } = await import("@shared/schema");
    const [row] = await db.select().from(clientPayments).where(eq(clientPayments.id, id)).limit(1);
    return row;
  }

  async createClientPayment(data: import("@shared/schema").InsertClientPayment) {
    const paymentNumber = await this.generatePaymentNumber();
    const [row] = await db.insert(clientPayments)
      .values({ id: randomUUID(), paymentNumber, ...data, createdAt: new Date() })
      .returning();
    return row;
  }

  async updateClientPayment(id: string, data: Partial<import("@shared/schema").InsertClientPayment>) {
    const { clientPayments } = await import("@shared/schema");
    const [row] = await db.update(clientPayments)
      .set(data)
      .where(eq(clientPayments.id, id))
      .returning();
    return row;
  }

  async deleteClientPayment(id: string) {
    const { clientPayments } = await import("@shared/schema");
    const r = await db.delete(clientPayments).where(eq(clientPayments.id, id));
    return (r.rowCount ?? 0) > 0;
  }
}
